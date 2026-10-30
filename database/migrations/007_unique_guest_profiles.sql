BEGIN;

CREATE TABLE IF NOT EXISTS guest_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(48) NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 48),
  avatar_id varchar(24) NOT NULL,
  presentation varchar(16),
  email varchar(320),
  whatsapp_number varchar(12),
  whatsapp_consent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_profile_email_normalized CHECK (email IS NULL OR email = lower(trim(email))),
  CONSTRAINT guest_profile_presentation CHECK (presentation IS NULL OR presentation IN ('neutral','feminine','masculine')),
  CONSTRAINT guest_profile_whatsapp CHECK (
    (whatsapp_number IS NULL AND whatsapp_consent = false)
    OR (whatsapp_number ~ '^91[6-9][0-9]{9}$' AND whatsapp_consent = true)
  )
);

CREATE TABLE IF NOT EXISTS guest_profile_identifiers (
  kind varchar(16) NOT NULL CHECK (kind IN ('email','whatsapp','client')),
  value varchar(320) NOT NULL,
  profile_id uuid NOT NULL REFERENCES guest_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, value)
);

ALTER TABLE guest_sessions ADD COLUMN IF NOT EXISTS profile_id uuid;

-- Backfill every historical join. Matching any normalized email, WhatsApp
-- number, or stable browser client ID reuses the same profile. If a historical
-- row connects two previously separate profiles, they are merged.
DO $profiles$
DECLARE
  session_row record;
  matching_ids uuid[];
  canonical_id uuid;
  duplicate_ids uuid[];
  normalized_email text;
BEGIN
  FOR session_row IN
    SELECT id, display_name, avatar_id, presentation, email, whatsapp_number,
      whatsapp_consent, client_id, joined_at
    FROM guest_sessions
    ORDER BY joined_at, id
  LOOP
    normalized_email := CASE WHEN session_row.email IS NULL THEN NULL ELSE lower(trim(session_row.email)) END;

    SELECT array_agg(DISTINCT identifier.profile_id)
    INTO matching_ids
    FROM guest_profile_identifiers identifier
    WHERE (normalized_email IS NOT NULL AND identifier.kind='email' AND identifier.value=normalized_email)
       OR (session_row.whatsapp_number IS NOT NULL AND identifier.kind='whatsapp' AND identifier.value=session_row.whatsapp_number)
       OR (session_row.client_id IS NOT NULL AND identifier.kind='client' AND identifier.value=session_row.client_id);

    IF COALESCE(cardinality(matching_ids), 0) = 0 THEN
      INSERT INTO guest_profiles(display_name,avatar_id,presentation,email,whatsapp_number,whatsapp_consent,created_at,updated_at,last_joined_at)
      VALUES(session_row.display_name,session_row.avatar_id,session_row.presentation,normalized_email,session_row.whatsapp_number,session_row.whatsapp_consent,session_row.joined_at,session_row.joined_at,session_row.joined_at)
      RETURNING id INTO canonical_id;
    ELSE
      SELECT profile.id INTO canonical_id
      FROM guest_profiles profile
      WHERE profile.id=ANY(matching_ids)
      ORDER BY profile.created_at, profile.id
      LIMIT 1;

      duplicate_ids := array_remove(matching_ids, canonical_id);
      IF COALESCE(cardinality(duplicate_ids), 0) > 0 THEN
        UPDATE guest_sessions SET profile_id=canonical_id WHERE profile_id=ANY(duplicate_ids);
        UPDATE guest_profile_identifiers SET profile_id=canonical_id WHERE profile_id=ANY(duplicate_ids);
        DELETE FROM guest_profiles WHERE id=ANY(duplicate_ids);
      END IF;

      UPDATE guest_profiles SET
        display_name=session_row.display_name,
        avatar_id=session_row.avatar_id,
        presentation=session_row.presentation,
        email=COALESCE(normalized_email,email),
        whatsapp_number=COALESCE(session_row.whatsapp_number,whatsapp_number),
        whatsapp_consent=CASE WHEN session_row.whatsapp_number IS NOT NULL THEN session_row.whatsapp_consent ELSE whatsapp_consent END,
        updated_at=session_row.joined_at,
        last_joined_at=GREATEST(last_joined_at,session_row.joined_at)
      WHERE id=canonical_id;
    END IF;

    IF normalized_email IS NOT NULL THEN
      INSERT INTO guest_profile_identifiers(kind,value,profile_id,created_at,last_seen_at)
      VALUES('email',normalized_email,canonical_id,session_row.joined_at,session_row.joined_at)
      ON CONFLICT(kind,value) DO UPDATE SET profile_id=EXCLUDED.profile_id,last_seen_at=EXCLUDED.last_seen_at;
    END IF;
    IF session_row.whatsapp_number IS NOT NULL THEN
      INSERT INTO guest_profile_identifiers(kind,value,profile_id,created_at,last_seen_at)
      VALUES('whatsapp',session_row.whatsapp_number,canonical_id,session_row.joined_at,session_row.joined_at)
      ON CONFLICT(kind,value) DO UPDATE SET profile_id=EXCLUDED.profile_id,last_seen_at=EXCLUDED.last_seen_at;
    END IF;
    IF session_row.client_id IS NOT NULL THEN
      INSERT INTO guest_profile_identifiers(kind,value,profile_id,created_at,last_seen_at)
      VALUES('client',session_row.client_id,canonical_id,session_row.joined_at,session_row.joined_at)
      ON CONFLICT(kind,value) DO UPDATE SET profile_id=EXCLUDED.profile_id,last_seen_at=EXCLUDED.last_seen_at;
    END IF;

    UPDATE guest_sessions SET profile_id=canonical_id WHERE id=session_row.id;
  END LOOP;
END
$profiles$;

ALTER TABLE guest_sessions ALTER COLUMN profile_id SET NOT NULL;
ALTER TABLE guest_sessions DROP CONSTRAINT IF EXISTS guest_sessions_profile_id_fkey;
ALTER TABLE guest_sessions ADD CONSTRAINT guest_sessions_profile_id_fkey
  FOREIGN KEY(profile_id) REFERENCES guest_profiles(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_guest_sessions_room_profile_joined
  ON guest_sessions(room_id,profile_id,joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_profiles_last_joined
  ON guest_profiles(last_joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_profile_identifiers_profile
  ON guest_profile_identifiers(profile_id);

ALTER TABLE guest_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_profile_identifiers ENABLE ROW LEVEL SECURITY;

DO $privacy$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE guest_profiles, guest_profile_identifiers FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE guest_profiles, guest_profile_identifiers FROM authenticated';
  END IF;
END
$privacy$;

COMMIT;
