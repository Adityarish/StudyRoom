import type { NextFunction, Request, Response } from 'express';
import type { Database } from '../db.js';
import type { GuestAuth } from '../types.js';
import { tokenHash } from '../security/crypto.js';
import { HttpError } from '../http/errors.js';

declare global { namespace Express { interface Request { guest?: GuestAuth } } }
export function guestAuth(db: Database) { return async (req: Request, _res: Response, next: NextFunction) => { try { const bearer = req.get('authorization')?.replace(/^Bearer\s+/i, ''); const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : ''; if (!bearer || !sessionId) throw new HttpError(401, 'GUEST_SESSION_REQUIRED', 'A valid guest session is required.'); const result = await db.query(`SELECT g.id, g.room_id, g.guest_identity, g.display_name, g.avatar_id, g.approval_status, r.public_room_id, r.chat_enabled FROM guest_sessions g JOIN study_rooms r ON r.id=g.room_id WHERE g.id=$1 AND g.session_token_hash=$2 AND g.left_at IS NULL`, [sessionId, tokenHash(bearer)]); const row = result.rows[0]; if (!row) throw new HttpError(401, 'GUEST_SESSION_INVALID', 'This guest session is no longer valid.'); req.guest = { id: row.id, roomId: row.room_id, publicRoomId: row.public_room_id, guestIdentity: row.guest_identity, displayName: row.display_name, avatarId: row.avatar_id, approvalStatus: row.approval_status, chatEnabled: row.chat_enabled }; next(); } catch (error) { next(error); } }; }
