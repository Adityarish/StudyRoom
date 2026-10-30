import { Router } from 'express';
import { adminLoginSchema, roomInputSchema, whatsappInvitationSelectionSchema } from '@studyroom/shared';
import type { Database } from '../db.js';
import { mapRoom } from '../db.js';
import type { Config } from '../config.js';
import type { LiveKitService } from '../services/livekit.js';
import type { AdminRequest } from '../types.js';
import { asyncHandler } from '../http/async-handler.js';
import { HttpError } from '../http/errors.js';
import { adminAuth, requireCsrf } from '../middleware/admin-auth.js';
import { hashPassword, randomToken, tokenHash, verifyPassword } from '../security/crypto.js';
import { maskWhatsAppNumber, prepareWhatsAppInvitations } from '../services/whatsapp-click-to-chat.js';

const listSql = `SELECT r.*, (SELECT count(*) FROM guest_sessions g WHERE g.room_id=r.id AND g.left_at IS NULL AND g.approval_status='approved' AND g.last_seen_at>now()-interval '5 minutes')::int active_participants FROM study_rooms r`;
export function adminRoutes(db: Database, config: Config, livekit: LiveKitService) {
  const router = Router(); const auth = adminAuth(db); const production = config.NODE_ENV === 'production';
  // Vercel and Render use different sites by default. SameSite=None keeps the
  // credentialed admin API usable there; local development remains Lax/HTTP.
  const cookie = { httpOnly: true, secure: production, sameSite: (production ? 'none' : 'lax') as 'none' | 'lax', path: '/', maxAge: 8*60*60*1000 };
  router.post('/login', asyncHandler(async (req, res) => { const input = adminLoginSchema.parse(req.body); const found = await db.query('SELECT id,username,password_hash FROM administrators WHERE username=$1 AND disabled_at IS NULL', [input.username.toLowerCase()]); const row = found.rows[0]; const valid = row ? await verifyPassword(input.password, row.password_hash) : await verifyPassword(input.password, await hashPassword('constant-time-placeholder-password')); if (!row || !valid) throw new HttpError(401, 'LOGIN_FAILED', 'Username or password is incorrect.'); const sessionToken = randomToken(); const csrfToken = randomToken(); await db.query(`INSERT INTO admin_sessions(administrator_id,token_hash,csrf_token_hash,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')`, [row.id, tokenHash(sessionToken), tokenHash(csrfToken)]); res.cookie('studyroom_admin', sessionToken, cookie); res.cookie('studyroom_csrf', csrfToken, { ...cookie, httpOnly: false }); res.json({ administrator: { id: row.id, username: row.username }, csrfToken }); }));
  router.get('/me', auth, asyncHandler(async (req: AdminRequest, res) => { const csrfToken = req.cookies?.studyroom_csrf as string | undefined; if (!csrfToken || tokenHash(csrfToken) !== req.administrator!.csrfToken) throw new HttpError(401, 'SESSION_INVALID', 'Your session verification token is missing.'); await db.query('UPDATE admin_sessions SET last_seen_at=now() WHERE id=$1', [req.administrator!.sessionId]); res.json({ administrator: { id: req.administrator!.id, username: req.administrator!.username }, csrfToken }); }));
  router.post('/logout', auth, requireCsrf, asyncHandler(async (req: AdminRequest, res) => { await db.query('UPDATE admin_sessions SET revoked_at=now() WHERE id=$1', [req.administrator!.sessionId]); res.clearCookie('studyroom_admin', cookie); res.clearCookie('studyroom_csrf', { ...cookie, httpOnly: false }); res.status(204).end(); }));
  router.use(auth);
  router.get('/whatsapp-contacts', asyncHandler(async (_req, res) => {
    const result = await db.query(`SELECT DISTINCT ON (whatsapp_number) id,display_name,whatsapp_number
      FROM guest_sessions WHERE whatsapp_consent=true AND whatsapp_number IS NOT NULL
      ORDER BY whatsapp_number,joined_at DESC LIMIT 250`);
    res.json({ contacts: result.rows.map(contact => ({ id: String(contact.id), displayName: String(contact.display_name), maskedNumber: maskWhatsAppNumber(String(contact.whatsapp_number)) })) });
  }));
  router.get('/rooms', asyncHandler(async (_req, res) => { const result = await db.query(`${listSql} ORDER BY r.created_at DESC`); res.json({ rooms: result.rows.map(mapRoom) }); }));
  router.post('/rooms', requireCsrf, asyncHandler(async (req: AdminRequest, res) => { const input = roomInputSchema.parse(req.body); assertFutureExpiry(input.expiresAt); const publicId = randomToken(24); const livekitName = `studyroom_${randomToken(18)}`; const passwordHash = input.password ? await hashPassword(input.password) : null; const result = await db.query(`INSERT INTO study_rooms(public_room_id,livekit_room_name,name,description,subject,max_participants,chat_enabled,screen_sharing_enabled,waiting_room_enabled,expires_at,room_password_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *,0::int active_participants`, [publicId, livekitName, input.name, input.description, input.subject, input.maxParticipants, input.chatEnabled, input.screenSharingEnabled, input.waitingRoomEnabled, input.expiresAt ?? null, passwordHash, req.administrator!.id]); res.status(201).json({ room: mapRoom(result.rows[0]) }); }));
  router.post('/rooms/:id/whatsapp-invitations', requireCsrf, asyncHandler(async (req: AdminRequest, res) => {
    const input = whatsappInvitationSelectionSchema.parse(req.body); const selectedIds = [...new Set(input.targetSessionIds)];
    const roomResult = await db.query('SELECT id,name,public_room_id,status FROM study_rooms WHERE id=$1', [req.params.id]); const room = roomResult.rows[0];
    if (!room) throw new HttpError(404, 'ROOM_NOT_FOUND', 'Room not found.');
    if (room.status !== 'active') throw new HttpError(410, 'ROOM_CLOSED', 'This study room is no longer active.');
    const targetResult = await db.query(`SELECT id,display_name,whatsapp_number FROM guest_sessions
      WHERE id=ANY($1::uuid[]) AND whatsapp_consent=true AND whatsapp_number IS NOT NULL`, [selectedIds]);
    if (targetResult.rows.length !== selectedIds.length) throw new HttpError(409, 'WHATSAPP_CONTACT_UNAVAILABLE', 'One or more selected contacts are no longer available. Refresh the contact list.');
    const targetsById = new Map(targetResult.rows.map(target => [String(target.id), target]));
    const invitations = await prepareWhatsAppInvitations(db, {
      roomId: String(room.id), roomName: String(room.name), publicRoomId: String(room.public_room_id), webOrigin: config.WEB_ORIGIN,
      hostName: req.administrator!.username, administratorId: req.administrator!.id,
      targets: selectedIds.map(id => { const target = targetsById.get(id)!; return { id, displayName: String(target.display_name), whatsappNumber: String(target.whatsapp_number) }; }),
    });
    res.status(201).json({ invitations });
  }));
  router.post('/whatsapp-invitations/:invitationId/opened', requireCsrf, asyncHandler(async (req: AdminRequest, res) => {
    const result = await db.query(`UPDATE whatsapp_invitations SET status='opened_whatsapp',opened_at=COALESCE(opened_at,now())
      WHERE id=$1 AND created_by=$2 RETURNING id`, [req.params.invitationId, req.administrator!.id]);
    if (!result.rowCount) throw new HttpError(404, 'INVITATION_NOT_FOUND', 'This prepared WhatsApp invitation is no longer available.');
    res.status(204).end();
  }));
  router.get('/rooms/:id', asyncHandler(async (req, res) => { const result = await db.query(`${listSql} WHERE r.id=$1`, [req.params.id]); if (!result.rows[0]) throw new HttpError(404, 'ROOM_NOT_FOUND', 'Room not found.'); res.json({ room: mapRoom(result.rows[0]) }); }));
  router.patch('/rooms/:id', requireCsrf, asyncHandler(async (req, res) => { const input = roomInputSchema.partial().parse(req.body); assertFutureExpiry(input.expiresAt); const current = await db.query('SELECT * FROM study_rooms WHERE id=$1', [req.params.id]); if (!current.rows[0]) throw new HttpError(404, 'ROOM_NOT_FOUND', 'Room not found.'); const row = current.rows[0]; const passwordHash = input.password === null ? null : input.password ? await hashPassword(input.password) : row.room_password_hash; const result = await db.query(`UPDATE study_rooms SET name=$2,description=$3,subject=$4,max_participants=$5,chat_enabled=$6,screen_sharing_enabled=$7,waiting_room_enabled=$8,expires_at=$9,room_password_hash=$10,updated_at=now() WHERE id=$1 RETURNING *, (SELECT count(*)::int FROM guest_sessions g WHERE g.room_id=study_rooms.id AND g.left_at IS NULL AND g.approval_status='approved') active_participants`, [req.params.id, input.name ?? row.name, input.description ?? row.description, input.subject ?? row.subject, input.maxParticipants ?? row.max_participants, input.chatEnabled ?? row.chat_enabled, input.screenSharingEnabled ?? row.screen_sharing_enabled, input.waitingRoomEnabled ?? row.waiting_room_enabled, input.expiresAt === undefined ? row.expires_at : input.expiresAt, passwordHash]); res.json({ room: mapRoom(result.rows[0]) }); }));
  router.delete('/rooms/:id', requireCsrf, asyncHandler(async (req, res) => { await deleteStudyRoom(db, livekit, String(req.params.id)); res.status(204).end(); }));
  router.get('/rooms/:id/participants', asyncHandler(async (req, res) => { const room = await db.query('SELECT livekit_room_name FROM study_rooms WHERE id=$1', [req.params.id]); if (!room.rows[0]) throw new HttpError(404, 'ROOM_NOT_FOUND', 'Room not found.'); const live = new Set(await livekit.activeIdentities(room.rows[0].livekit_room_name)); const result = await db.query(`SELECT id,guest_identity,display_name,avatar_id,joined_at,left_at,approval_status,last_seen_at FROM guest_sessions WHERE room_id=$1 AND ((approval_status='pending' AND left_at IS NULL) OR (approval_status='approved' AND left_at IS NULL AND last_seen_at>now()-interval '5 minutes') OR guest_identity=ANY($2::text[])) ORDER BY joined_at DESC LIMIT 100`, [req.params.id, [...live]]); res.json({ participants: result.rows.map(p => ({ id:p.id, identity:p.guest_identity, displayName:p.display_name, avatarId:p.avatar_id, joinedAt:new Date(p.joined_at).toISOString(), approvalStatus:p.approval_status, live: live.has(p.guest_identity) || (p.approval_status === 'approved' && !p.left_at && new Date(p.last_seen_at).getTime() > Date.now() - 5*60_000) })) }); }));
  router.delete('/rooms/:id/participants/:identity', requireCsrf, asyncHandler(async (req, res) => { const room = await db.query('SELECT livekit_room_name FROM study_rooms WHERE id=$1', [req.params.id]); if (!room.rows[0]) throw new HttpError(404, 'ROOM_NOT_FOUND', 'Room not found.'); const identity = String(req.params.identity); await livekit.remove(room.rows[0].livekit_room_name, identity); await db.query('UPDATE guest_sessions SET left_at=COALESCE(left_at,now()) WHERE room_id=$1 AND guest_identity=$2', [req.params.id, identity]); res.status(204).end(); }));
  router.post('/rooms/:id/waiting/:sessionId', requireCsrf, asyncHandler(async (req, res) => {
    const approved = Boolean(req.body?.approved); const replacedIdentities: string[] = []; let livekitRoomName = '';
    if (approved) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const room = await client.query('SELECT max_participants,livekit_room_name FROM study_rooms WHERE id=$1 FOR UPDATE', [req.params.id]);
        if (!room.rows[0]) throw new HttpError(404, 'ROOM_NOT_FOUND', 'Room not found.');
        livekitRoomName = String(room.rows[0].livekit_room_name);
        const pending = await client.query(`SELECT client_id FROM guest_sessions WHERE id=$1 AND room_id=$2 AND approval_status='pending' AND left_at IS NULL FOR UPDATE`, [req.params.sessionId, req.params.id]);
        if (!pending.rows[0]) throw new HttpError(404, 'WAITING_REQUEST_NOT_FOUND', 'Waiting request not found.');
        if (pending.rows[0].client_id) {
          const replaced = await client.query(`UPDATE guest_sessions SET left_at=now(),last_seen_at=now() WHERE room_id=$1 AND client_id=$2 AND id<>$3 AND left_at IS NULL AND approval_status='approved' RETURNING guest_identity`, [req.params.id, pending.rows[0].client_id, req.params.sessionId]);
          replacedIdentities.push(...replaced.rows.map(row => String(row.guest_identity)));
        }
        const active = await client.query(`SELECT count(*)::int AS total FROM guest_sessions WHERE room_id=$1 AND left_at IS NULL AND approval_status='approved' AND last_seen_at>now()-interval '5 minutes'`, [req.params.id]);
        if (active.rows[0].total >= room.rows[0].max_participants) throw new HttpError(409, 'ROOM_FULL', 'The room is at capacity.');
        await client.query(`UPDATE guest_sessions SET approval_status='approved',last_seen_at=now(),left_at=NULL WHERE id=$1 AND room_id=$2`, [req.params.sessionId, req.params.id]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
      finally { client.release(); }
      await Promise.all(replacedIdentities.map(identity => livekit.remove(livekitRoomName, identity).catch(() => {})));
    } else {
      const result = await db.query(`UPDATE guest_sessions SET approval_status='declined',last_seen_at=now(),left_at=now() WHERE id=$1 AND room_id=$2 AND approval_status='pending' RETURNING id`, [req.params.sessionId, req.params.id]);
      if (!result.rowCount) throw new HttpError(404, 'WAITING_REQUEST_NOT_FOUND', 'Waiting request not found.');
    }
    res.status(204).end();
  }));
  return router;
}
export async function deleteStudyRoom(db: Database, livekit: LiveKitService, roomId: string) {
  const found = await db.query('SELECT livekit_room_name FROM study_rooms WHERE id=$1', [roomId]);
  if (!found.rows[0]) throw new HttpError(404, 'ROOM_NOT_FOUND', 'Room not found.');
  try {
    await livekit.end(found.rows[0].livekit_room_name);
  } catch (error) {
    // Removing the persisted room must still work if LiveKit is temporarily unavailable.
    console.warn('Unable to close LiveKit room during deletion', error instanceof Error ? error.message : error);
  }
  const deleted = await db.query('DELETE FROM study_rooms WHERE id=$1', [roomId]);
  if (!deleted.rowCount) throw new HttpError(404, 'ROOM_NOT_FOUND', 'Room not found.');
}
function assertFutureExpiry(value: string | null | undefined) { if (value && new Date(value) <= new Date()) throw new HttpError(400, 'EXPIRY_IN_PAST', 'Room expiration must be in the future.'); }
