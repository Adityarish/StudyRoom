import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { createPool } from '../db.js';

const config = loadConfig(); const pool = createPool(config);
const here = dirname(fileURLToPath(import.meta.url)); const migrationDir = resolve(here, '../../../../database/migrations');
try {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const files = (await readdir(migrationDir)).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [file]);
    if (exists.rowCount) { console.log(`skip ${file}`); continue; }
    const client = await pool.connect(); try { await client.query('BEGIN'); await client.query(await readFile(join(migrationDir, file), 'utf8')); await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]); await client.query('COMMIT'); console.log(`applied ${file}`); } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
} finally { await pool.end(); }
