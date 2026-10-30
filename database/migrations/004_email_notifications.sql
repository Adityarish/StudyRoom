BEGIN;

ALTER TABLE guest_sessions
  ADD COLUMN IF NOT EXISTS email varchar(320);

CREATE TABLE IF NOT EXISTS participant_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  requester_session_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  target_session_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_session_id <> target_session_id)
);

CREATE INDEX IF NOT EXISTS idx_participant_notifications_target_sent
  ON participant_notifications(target_session_id, sent_at DESC);

COMMIT;
