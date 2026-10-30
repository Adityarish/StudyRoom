BEGIN;
CREATE OR REPLACE FUNCTION cleanup_studyroom_data() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE study_rooms SET status='closed', closed_at=COALESCE(closed_at, now()), updated_at=now()
    WHERE status='active' AND expires_at IS NOT NULL AND expires_at <= now();
  UPDATE guest_sessions SET left_at=now()
    WHERE left_at IS NULL AND last_seen_at < now() - interval '5 minutes';
  DELETE FROM admin_sessions WHERE expires_at < now() - interval '7 days' OR revoked_at < now() - interval '7 days';
  DELETE FROM chat_messages WHERE created_at < now() - interval '30 days';
END;
$$;
COMMIT;
