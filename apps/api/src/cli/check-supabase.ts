import { loadConfig } from '../config.js';
import { createPool } from '../db.js';

const config = loadConfig();
const connectionString = config.MIGRATION_DATABASE_URL ?? config.DATABASE_URL;
const pool = createPool(config, connectionString);

try {
  await pool.query('SELECT 1');
  const columns = await pool.query<{ column_name: string }>(`SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='guest_sessions'
      AND column_name=ANY($1::text[])`, [['email', 'whatsapp_number', 'whatsapp_consent', 'profile_id']]);
  const found = new Set(columns.rows.map(row => row.column_name));
  const missing = ['email', 'whatsapp_number', 'whatsapp_consent', 'profile_id'].filter(column => !found.has(column));
  if (missing.length) throw new Error(`Guest contact schema is incomplete: ${missing.join(', ')}. Run npm run db:migrate.`);

  const privacy = await pool.query<{ relname: string; relrowsecurity: boolean }>(`SELECT relname,relrowsecurity
    FROM pg_class JOIN pg_namespace ON pg_namespace.oid=pg_class.relnamespace
    WHERE pg_namespace.nspname='public' AND pg_class.relname=ANY($1::text[])`, [['guest_sessions', 'guest_profiles', 'guest_profile_identifiers']]);
  const protectedTables = new Set(privacy.rows.filter(row => row.relrowsecurity).map(row => row.relname));
  const unprotected = ['guest_sessions', 'guest_profiles', 'guest_profile_identifiers'].filter(table => !protectedTables.has(table));
  if (unprotected.length) throw new Error(`Guest contact privacy is incomplete: ${unprotected.join(', ')}. Run npm run db:migrate.`);

  const activeSessionIndex = await pool.query<{ present: boolean }>(`SELECT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='guest_sessions'
      AND indexname='idx_guest_sessions_one_active_profile_per_room'
  ) AS present`);
  if (!activeSessionIndex.rows[0]?.present) throw new Error('Participant session integrity index is missing. Run npm run db:migrate.');
  const duplicateActive = await pool.query(`SELECT 1 FROM guest_sessions WHERE left_at IS NULL GROUP BY room_id,profile_id HAVING count(*)>1 LIMIT 1`);
  if (duplicateActive.rowCount) throw new Error('Duplicate active participant sessions remain. Run npm run db:migrate.');
  const authProfileColumn = await pool.query<{ present: boolean }>(`SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='guest_profiles' AND column_name='auth_user_id'
  ) AS present`);
  if (!authProfileColumn.rows[0]?.present) throw new Error('Guest Supabase account linkage is missing. Run npm run db:migrate.');

  console.log('Supabase connection OK. Auth-linked unique profiles, one active room session per participant, contact fields, and RLS protection are ready.');
} finally {
  await pool.end();
}
