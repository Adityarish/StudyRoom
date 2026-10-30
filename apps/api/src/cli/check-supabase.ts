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
      AND column_name=ANY($1::text[])`, [['email', 'whatsapp_number', 'whatsapp_consent']]);
  const found = new Set(columns.rows.map(row => row.column_name));
  const missing = ['email', 'whatsapp_number', 'whatsapp_consent'].filter(column => !found.has(column));
  if (missing.length) throw new Error(`Guest contact schema is incomplete: ${missing.join(', ')}. Run npm run db:migrate.`);

  const privacy = await pool.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity
    FROM pg_class JOIN pg_namespace ON pg_namespace.oid=pg_class.relnamespace
    WHERE pg_namespace.nspname='public' AND pg_class.relname='guest_sessions'`);
  if (!privacy.rows[0]?.relrowsecurity) throw new Error('Guest contact table is not protected by row-level security. Run npm run db:migrate.');

  console.log('Supabase connection OK. Guest email/WhatsApp columns and RLS protection are ready.');
} finally {
  await pool.end();
}
