BEGIN;

ALTER TABLE guest_sessions
  ADD COLUMN IF NOT EXISTS whatsapp_number varchar(12),
  ADD COLUMN IF NOT EXISTS whatsapp_consent boolean NOT NULL DEFAULT false;

ALTER TABLE guest_sessions
  DROP CONSTRAINT IF EXISTS valid_indian_whatsapp_number;

ALTER TABLE guest_sessions
  ADD CONSTRAINT valid_indian_whatsapp_number CHECK (
    (whatsapp_number IS NULL AND whatsapp_consent = false)
    OR (whatsapp_number ~ '^91[6-9][0-9]{9}$' AND whatsapp_consent = true)
  );

CREATE TABLE IF NOT EXISTS whatsapp_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  target_session_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  requester_session_id uuid REFERENCES guest_sessions(id) ON DELETE CASCADE,
  created_by uuid REFERENCES administrators(id) ON DELETE CASCADE,
  participant_name varchar(48) NOT NULL,
  host_name varchar(80) NOT NULL,
  phone_number varchar(12) NOT NULL CHECK (phone_number ~ '^91[6-9][0-9]{9}$'),
  meeting_url text NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'opened_whatsapp')),
  prepared_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  CHECK ((requester_session_id IS NOT NULL) <> (created_by IS NOT NULL)),
  CHECK ((status = 'prepared' AND opened_at IS NULL) OR (status = 'opened_whatsapp' AND opened_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_invitations_room_prepared
  ON whatsapp_invitations(room_id, prepared_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts
  ON guest_sessions(whatsapp_number, joined_at DESC)
  WHERE whatsapp_consent = true AND whatsapp_number IS NOT NULL;

COMMIT;
