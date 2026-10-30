BEGIN;

ALTER TABLE guest_sessions
  ADD COLUMN IF NOT EXISTS client_id varchar(128);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_room_client_active
  ON guest_sessions(room_id, client_id)
  WHERE left_at IS NULL AND client_id IS NOT NULL;

COMMIT;
