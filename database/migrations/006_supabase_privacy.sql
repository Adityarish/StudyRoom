BEGIN;

-- StudyRoom uses a trusted server-side PostgreSQL connection. Browser clients
-- must not query these tables through Supabase REST/GraphQL with public keys.
ALTER TABLE administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

DO $privacy$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE administrators, admin_sessions, study_rooms, guest_sessions,
      chat_messages, participant_notifications, whatsapp_invitations, schema_migrations FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE administrators, admin_sessions, study_rooms, guest_sessions,
      chat_messages, participant_notifications, whatsapp_invitations, schema_migrations FROM authenticated';
  END IF;
END
$privacy$;

-- Functions are executable by PUBLIC by default in PostgreSQL. This maintenance
-- routine mutates private tables and must only be called by the database owner.
REVOKE ALL ON FUNCTION cleanup_studyroom_data() FROM PUBLIC;

COMMIT;
