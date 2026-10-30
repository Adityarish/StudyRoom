import { loadConfig } from '../config.js';
import { createPool } from '../db.js';
import { hashPassword } from '../security/crypto.js';

const username = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim().toLowerCase(); const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
if (!username || username.length < 3 || !password || password.length < 12) { console.error('Set ADMIN_BOOTSTRAP_USERNAME (3+ characters) and ADMIN_BOOTSTRAP_PASSWORD (12+ characters) for this command.'); process.exit(1); }
const pool = createPool(loadConfig());
try { const passwordHash = await hashPassword(password); await pool.query(`INSERT INTO administrators(username,password_hash) VALUES ($1,$2) ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash, disabled_at=NULL, updated_at=now()`, [username, passwordHash]); console.log(`Administrator “${username}” is ready. The password was not logged.`); } finally { await pool.end(); }
