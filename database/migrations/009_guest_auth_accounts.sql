BEGIN;

-- Keep the durable StudyRoom guest profile linked to the verified Supabase
-- account that created it. This lets an administrator remove both records,
-- invalidating saved room sessions and requiring a fresh sign-up.
ALTER TABLE guest_profiles
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- Existing production guests already have verified email accounts. Backfill
-- them when this migration runs inside Supabase, while keeping local Postgres
-- development compatible (where the auth schema does not exist).
DO $backfill_auth_users$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE guest_profiles profile
      SET auth_user_id=auth_user.id
      FROM auth.users auth_user
      WHERE profile.auth_user_id IS NULL
        AND profile.email IS NOT NULL
        AND lower(auth_user.email)=lower(profile.email)
    $sql$;
  END IF;
END
$backfill_auth_users$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_profiles_auth_user
  ON guest_profiles(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMIT;
