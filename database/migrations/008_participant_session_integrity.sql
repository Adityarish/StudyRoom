BEGIN;

-- Older clients could create more than one active row for the same logical
-- participant. Keep the newest row active before enforcing the invariant.
WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY room_id, profile_id
      ORDER BY (approval_status='approved') DESC, joined_at DESC, id DESC
    ) AS position
  FROM guest_sessions
  WHERE left_at IS NULL
)
UPDATE guest_sessions session
SET left_at=now(), last_seen_at=now()
FROM ranked
WHERE session.id=ranked.id AND ranked.position>1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_sessions_one_active_profile_per_room
  ON guest_sessions(room_id, profile_id)
  WHERE left_at IS NULL;

COMMIT;
