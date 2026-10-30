import type { NextFunction, Response } from 'express';
import type { Database } from '../db.js';
import type { AdminRequest } from '../types.js';
import { HttpError } from '../http/errors.js';
import { tokenHash, secureEqual } from '../security/crypto.js';

export function adminAuth(db: Database) { return async (req: AdminRequest, _res: Response, next: NextFunction) => { try { const token = req.cookies?.studyroom_admin as string | undefined; if (!token) throw new HttpError(401, 'ADMIN_REQUIRED', 'Administrator authentication is required.'); const result = await db.query('SELECT s.id AS session_id, s.csrf_token_hash, a.id, a.username FROM admin_sessions s JOIN administrators a ON a.id=s.administrator_id WHERE s.token_hash=$1 AND s.expires_at>now() AND s.revoked_at IS NULL', [tokenHash(token)]); const row = result.rows[0]; if (!row) throw new HttpError(401, 'SESSION_EXPIRED', 'Your administrator session has expired.'); req.administrator = { id: row.id, username: row.username, sessionId: row.session_id, csrfToken: String(row.csrf_token_hash) }; next(); } catch (error) { next(error); } }; }
export function requireCsrf(req: AdminRequest, _res: Response, next: NextFunction) { const header = req.get('x-csrf-token') ?? ''; const cookie = req.cookies?.studyroom_csrf as string | undefined; if (!header || !cookie || !secureEqual(header, cookie) || tokenHash(header) !== req.administrator?.csrfToken) return next(new HttpError(403, 'CSRF_REJECTED', 'Request verification failed. Refresh and try again.')); next(); }
