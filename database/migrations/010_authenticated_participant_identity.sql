BEGIN;

-- Record the verified account on each join. Profiles remain the durable contact
-- record, while this immutable session attribution prevents stale profile or
-- browser/contact mappings from displacing a different signed-in participant.
ALTER TABLE guest_sessions
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

DO $backfill_verified_sessions$
DECLARE
  authentication_enabled_at timestamptz;
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    SELECT applied_at INTO authentication_enabled_at
    FROM schema_migrations
    WHERE name='009_guest_auth_accounts.sql';

    IF authentication_enabled_at IS NOT NULL THEN
      EXECUTE $sql$
        UPDATE guest_sessions session
        SET auth_user_id=auth_user.id
        FROM auth.users auth_user
        WHERE session.auth_user_id IS NULL
          AND session.joined_at >= $1
          AND session.email IS NOT NULL
          AND lower(session.email)=lower(auth_user.email)
      $sql$ USING authentication_enabled_at;
    END IF;
  END IF;
END
$backfill_verified_sessions$;

-- An unclaimed legacy profile with sessions from exactly one verified account
-- can be adopted without splitting it.
WITH single_account AS (
  SELECT profile_id,min(auth_user_id::text)::uuid AS auth_user_id
  FROM guest_sessions
  WHERE auth_user_id IS NOT NULL
  GROUP BY profile_id
  HAVING count(DISTINCT auth_user_id)=1
)
UPDATE guest_profiles profile
SET auth_user_id=single_account.auth_user_id,updated_at=now()
FROM single_account
WHERE profile.id=single_account.profile_id
  AND profile.auth_user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM guest_profiles claimed
    WHERE claimed.auth_user_id=single_account.auth_user_id
      AND claimed.id<>profile.id
  );

-- Split profiles that were accidentally shared by multiple verified accounts.
-- This repairs historical participant lists as well as the Aditya/Tushita-style
-- join loop where each new join removed the other account from LiveKit.
DO $split_conflated_profiles$
DECLARE
  conflated record;
  target_profile_id uuid;
BEGIN
  FOR conflated IN
    SELECT session.profile_id,session.auth_user_id,
      (array_agg(session.display_name ORDER BY session.joined_at DESC))[1] AS display_name,
      (array_agg(session.avatar_id ORDER BY session.joined_at DESC))[1] AS avatar_id,
      (array_agg(session.presentation ORDER BY session.joined_at DESC))[1] AS presentation,
      (array_agg(lower(session.email) ORDER BY session.joined_at DESC)
        FILTER (WHERE session.email IS NOT NULL))[1] AS email
    FROM guest_sessions session
    JOIN guest_profiles profile ON profile.id=session.profile_id
    WHERE session.auth_user_id IS NOT NULL
      AND session.auth_user_id IS DISTINCT FROM profile.auth_user_id
    GROUP BY session.profile_id,session.auth_user_id
  LOOP
    SELECT id INTO target_profile_id
    FROM guest_profiles
    WHERE auth_user_id=conflated.auth_user_id;

    IF target_profile_id IS NULL THEN
      INSERT INTO guest_profiles(
        display_name,avatar_id,presentation,email,whatsapp_number,
        whatsapp_consent,auth_user_id,last_joined_at
      ) VALUES(
        conflated.display_name,conflated.avatar_id,conflated.presentation,
        conflated.email,NULL,false,conflated.auth_user_id,now()
      )
      RETURNING id INTO target_profile_id;
    END IF;

    -- Avoid the partial unique profile index if this account already has a
    -- newer active session in the same room.
    UPDATE guest_sessions moving
    SET left_at=now(),last_seen_at=now()
    WHERE moving.profile_id=conflated.profile_id
      AND moving.auth_user_id=conflated.auth_user_id
      AND moving.left_at IS NULL
      AND EXISTS (
        SELECT 1 FROM guest_sessions current
        WHERE current.profile_id=target_profile_id
          AND current.room_id=moving.room_id
          AND current.left_at IS NULL
      );

    UPDATE guest_sessions
    SET profile_id=target_profile_id
    WHERE profile_id=conflated.profile_id
      AND auth_user_id=conflated.auth_user_id;

    IF conflated.email IS NOT NULL THEN
      INSERT INTO guest_profile_identifiers(kind,value,profile_id)
      VALUES('email',conflated.email,target_profile_id)
      ON CONFLICT(kind,value) DO UPDATE
      SET profile_id=EXCLUDED.profile_id,last_seen_at=now();
    END IF;
  END LOOP;
END
$split_conflated_profiles$;

-- If old data has the same account active through more than one profile, keep
-- only the newest session before adding the cross-profile invariant.
WITH ranked AS (
  SELECT id,row_number() OVER (
    PARTITION BY room_id,auth_user_id
    ORDER BY (approval_status='approved') DESC,last_seen_at DESC,joined_at DESC,id DESC
  ) AS position
  FROM guest_sessions
  WHERE left_at IS NULL AND auth_user_id IS NOT NULL
)
UPDATE guest_sessions session
SET left_at=now(),last_seen_at=now()
FROM ranked
WHERE session.id=ranked.id AND ranked.position>1;

CREATE INDEX IF NOT EXISTS idx_guest_sessions_auth_user_joined
  ON guest_sessions(auth_user_id,joined_at DESC)
  WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_sessions_one_active_auth_per_room
  ON guest_sessions(room_id,auth_user_id)
  WHERE left_at IS NULL AND auth_user_id IS NOT NULL;

COMMIT;
