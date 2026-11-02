import { Router } from 'express';
import { guestJoinSchema, whatsappInvitationSelectionSchema } from '@studyroom/shared';
import type { Database } from '../db.js';
import { mapRoom } from '../db.js';
import type { LiveKitService } from '../services/livekit.js';
import { asyncHandler } from '../http/async-handler.js';
import { HttpError } from '../http/errors.js';
import { assertRoomJoinable } from '../services/room-policy.js';
import { randomToken, tokenHash, verifyPassword } from '../security/crypto.js';
import { guestAuth } from '../middleware/guest-auth.js';
import type { Config } from '../config.js';
import { emailErrorCode, type NotificationMailer } from '../services/notification-mailer.js';
import { prepareWhatsAppInvitations } from '../services/whatsapp-click-to-chat.js';
import { normalizeGuestContact } from '../services/guest-contact.js';
import { resolveGuestProfile } from '../services/guest-profile.js';
import type { SupabaseAuthAdmin } from '../services/supabase-auth-admin.js';

const roomSelect = `SELECT r.*, (SELECT count(DISTINCT COALESCE(g.auth_user_id::text,g.profile_id::text)) FROM guest_sessions g WHERE g.room_id=r.id AND g.left_at IS NULL AND g.approval_status='approved' AND g.last_seen_at > now()-interval '5 minutes')::int AS active_participants FROM study_rooms r`;

export function publicRoutes(db: Database, livekit: LiveKitService, mailer: NotificationMailer, config: Config, supabaseAuth: SupabaseAuthAdmin) {
  const router = Router();
  router.get('/rooms/:roomId', asyncHandler(async (req, res) => { const result = await db.query(`${roomSelect} WHERE r.public_room_id=$1`, [req.params.roomId]); const row = result.rows[0]; if (!row) throw new HttpError(404, 'ROOM_NOT_FOUND', 'This invitation does not match a study room.'); if (row.status !== 'active') throw new HttpError(410, 'ROOM_CLOSED', 'This study room has been closed.'); if (row.expires_at && new Date(row.expires_at) <= new Date()) throw new HttpError(410, 'ROOM_EXPIRED', 'This study room has expired.'); res.json({ room: stripAdmin(mapRoom(row)) }); }));
  router.post('/rooms/:roomId/join', asyncHandler(async (req, res) => {
    const input = guestJoinSchema.parse(req.body);
    const verifiedUser = await supabaseAuth.verifyAccessToken(req.get('authorization'));
    const client = await db.connect();
    try { await client.query('BEGIN'); const result = await client.query(`${roomSelect} WHERE r.public_room_id=$1 FOR UPDATE OF r`, [req.params.roomId]); const room = result.rows[0]; if (!room) throw new HttpError(404, 'ROOM_NOT_FOUND', 'This invitation does not match a study room.');
      if (room.room_password_hash) { if (!input.roomPassword || !(await verifyPassword(input.roomPassword, room.room_password_hash))) throw new HttpError(403, 'ROOM_PASSWORD_INVALID', 'The room password is incorrect.'); }
      const contact = normalizeGuestContact({ ...input, email: verifiedUser?.email ?? input.email });
      const profileId = await resolveGuestProfile(client, { authUserId: verifiedUser?.id ?? null, clientId: input.clientId, displayName: input.displayName, avatarId: input.avatarId, presentation: input.presentation, ...contact });
      const previous = await client.query<{ guest_identity: string; approval_status: string }>(`SELECT guest_identity,approval_status FROM guest_sessions
        WHERE room_id=$1 AND left_at IS NULL
          AND (($3::uuid IS NOT NULL AND auth_user_id=$3) OR ($3::uuid IS NULL AND profile_id=$2))
        FOR UPDATE`, [room.id, profileId, verifiedUser?.id ?? null]);
      const replacingApprovedSession = previous.rows.some(session => session.approval_status === 'approved');
      assertRoomJoinable(room, new Date(), replacingApprovedSession);
      await client.query(`UPDATE guest_sessions SET left_at=now(),last_seen_at=now()
        WHERE room_id=$1 AND left_at IS NULL
          AND (($3::uuid IS NOT NULL AND auth_user_id=$3) OR ($3::uuid IS NULL AND profile_id=$2))`, [room.id, profileId, verifiedUser?.id ?? null]);
      const identity = `guest_${randomToken(18)}`; const sessionToken = randomToken(); const waitingToken = randomToken(); const approval = room.waiting_room_enabled && !replacingApprovedSession ? 'pending' : 'approved';
      const session = await client.query(`INSERT INTO guest_sessions(room_id,profile_id,auth_user_id,guest_identity,display_name,avatar_id,presentation,client_id,email,whatsapp_number,whatsapp_consent,session_token_hash,waiting_token_hash,approval_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id,joined_at`, [room.id, profileId, verifiedUser?.id ?? null, identity, input.displayName, input.avatarId, input.presentation ?? null, input.clientId, contact.email, contact.whatsappNumber, contact.whatsappConsent, tokenHash(sessionToken), tokenHash(waitingToken), approval]);
      await client.query('COMMIT');
      await Promise.allSettled(previous.rows.map(oldSession => livekit.remove(room.livekit_room_name, oldSession.guest_identity)));
      if (approval === 'pending') return res.status(202).json({ status: 'waiting', requestId: session.rows[0].id, requestToken: waitingToken });
      const token = await livekit.guestToken({ roomName: room.livekit_room_name, identity, displayName: input.displayName, avatarId: input.avatarId, screenSharingEnabled: room.screen_sharing_enabled });
      return res.status(201).json({ status: 'joined', livekitUrl: livekit.publicUrl, token, sessionId: session.rows[0].id, sessionToken, identity, joinedAt: new Date(session.rows[0].joined_at).toISOString(), room: stripAdmin(mapRoom(room)) });
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
  }));
  router.post('/rooms/:roomId/resume', guestAuth(db), asyncHandler(async (req, res) => {
    const guest = req.guest; if (!guest || guest.publicRoomId !== req.params.roomId) throw new HttpError(403, 'ROOM_MISMATCH', 'This session belongs to another room.');
    const result = await db.query(`SELECT r.*,session.joined_at AS session_joined_at,
      (SELECT count(DISTINCT COALESCE(active.auth_user_id::text,active.profile_id::text)) FROM guest_sessions active WHERE active.room_id=r.id AND active.left_at IS NULL AND active.approval_status='approved' AND active.last_seen_at>now()-interval '5 minutes')::int AS active_participants
      FROM study_rooms r JOIN guest_sessions session ON session.room_id=r.id WHERE r.id=$1 AND session.id=$2`, [guest.roomId, guest.id]);
    const row = result.rows[0]; if (!row) throw new HttpError(404, 'ROOM_NOT_FOUND', 'Room not found.');
    assertRoomJoinable(row, new Date(), true);
    await db.query('UPDATE guest_sessions SET last_seen_at=now() WHERE id=$1', [guest.id]);
    const token = await livekit.guestToken({ roomName: row.livekit_room_name, identity: guest.guestIdentity, displayName: guest.displayName, avatarId: guest.avatarId, screenSharingEnabled: row.screen_sharing_enabled });
    const sessionToken = req.get('authorization')!.replace(/^Bearer\s+/i, '');
    res.json({ status: 'joined', livekitUrl: livekit.publicUrl, token, sessionId: guest.id, sessionToken, identity: guest.guestIdentity, joinedAt: new Date(row.session_joined_at).toISOString(), room: stripAdmin(mapRoom(row)) });
  }));
  router.post('/rooms/:roomId/members', guestAuth(db), asyncHandler(async (req, res) => {
    const guest = req.guest; if (!guest || guest.publicRoomId !== req.params.roomId) throw new HttpError(403, 'ROOM_MISMATCH', 'This session belongs to another room.');
    const room = await db.query('SELECT livekit_room_name FROM study_rooms WHERE id=$1', [guest.roomId]);
    if (!room.rows[0]) throw new HttpError(404, 'ROOM_NOT_FOUND', 'Room not found.');
    const live = new Set(await livekit.activeIdentities(room.rows[0].livekit_room_name));
    const result = await db.query(`WITH latest AS (
      SELECT session.profile_id,
        (array_agg(session.id ORDER BY session.joined_at DESC))[1] AS id,
        (array_agg(session.display_name ORDER BY session.joined_at DESC))[1] AS display_name,
        (array_agg(session.avatar_id ORDER BY session.joined_at DESC))[1] AS avatar_id,
        array_agg(DISTINCT session.guest_identity) AS guest_identities,
        profile.email,profile.whatsapp_number,profile.whatsapp_consent,max(session.joined_at) AS joined_at
      FROM guest_sessions session
      JOIN guest_profiles profile ON profile.id=session.profile_id
      WHERE session.room_id=$1 AND session.approval_status='approved'
      GROUP BY session.profile_id, profile.email, profile.whatsapp_number, profile.whatsapp_consent
    )
    SELECT latest.*,notification.sent_at AS last_notified_at
    FROM latest
    LEFT JOIN LATERAL (
      SELECT notification.sent_at FROM participant_notifications notification
      JOIN guest_sessions notified_session ON notified_session.id=notification.target_session_id
      WHERE notified_session.profile_id=latest.profile_id
      ORDER BY notification.sent_at DESC LIMIT 1
    ) notification ON true
    ORDER BY latest.joined_at DESC LIMIT 100`, [guest.roomId]);
    const now = Date.now();
    res.json({ members: result.rows.map(member => {
      const identities = (member.guest_identities as string[] | null) ?? [];
      const isLive = identities.some(identity => live.has(identity)); const lastNotifiedAt = member.last_notified_at ? new Date(member.last_notified_at).toISOString() : null;
      const canReceiveReminder = mailer.configured && Boolean(member.email) && !isLive && member.profile_id !== guest.profileId;
      const coolingDown = Boolean(canReceiveReminder && lastNotifiedAt && now - new Date(lastNotifiedAt).getTime() < 600_000);
      const emailReminderStatus = canReceiveReminder ? (coolingDown ? 'cooldown' : 'available') : 'unavailable';
      const isSelf = member.profile_id === guest.profileId;
      return { id: member.id, displayName: member.display_name, avatarId: member.avatar_id, identities, live: isLive, isSelf, lastNotifiedAt, canNotify: emailReminderStatus === 'available', emailReminderStatus, canInviteOnWhatsApp: Boolean(member.whatsapp_consent && member.whatsapp_number) && member.profile_id !== guest.profileId };
    }) });
  }));
  router.post('/rooms/:roomId/whatsapp-invitations', guestAuth(db), asyncHandler(async (req, res) => {
    const guest = req.guest; if (!guest || guest.publicRoomId !== req.params.roomId) throw new HttpError(403, 'ROOM_MISMATCH', 'This session belongs to another room.');
    const input = whatsappInvitationSelectionSchema.parse(req.body);
    const roomResult = await db.query('SELECT id,name,public_room_id,livekit_room_name,status FROM study_rooms WHERE id=$1', [guest.roomId]);
    const room = roomResult.rows[0];
    if (!room || room.status !== 'active') throw new HttpError(410, 'ROOM_CLOSED', 'This study room is no longer active.');
    const live = new Set(await livekit.activeIdentities(room.livekit_room_name));
    if (!live.has(guest.guestIdentity)) throw new HttpError(403, 'NOT_ACTIVE_IN_MEETING', 'Only an active meeting participant can prepare WhatsApp invitations.');
    const selectedIds = [...new Set(input.targetSessionIds)];
    const targetResult = await db.query(`SELECT session.id,session.display_name,profile.whatsapp_number FROM guest_sessions session
      JOIN guest_profiles profile ON profile.id=session.profile_id
      WHERE session.room_id=$1 AND session.id=ANY($2::uuid[]) AND session.profile_id<>$3 AND session.approval_status='approved'
        AND profile.whatsapp_consent=true AND profile.whatsapp_number IS NOT NULL`, [guest.roomId, selectedIds, guest.profileId]);
    if (targetResult.rows.length !== selectedIds.length) throw new HttpError(409, 'WHATSAPP_CONTACT_UNAVAILABLE', 'One or more selected participants have not opted in with a valid WhatsApp number. Refresh the participant list.');
    const targetsById = new Map(targetResult.rows.map(target => [String(target.id), target]));
    const invitations = await prepareWhatsAppInvitations(db, {
      roomId: String(room.id), roomName: String(room.name), publicRoomId: String(room.public_room_id), webOrigin: config.WEB_ORIGIN,
      hostName: guest.displayName, requesterSessionId: guest.id,
      targets: selectedIds.map(id => { const target = targetsById.get(id)!; return { id, displayName: String(target.display_name), whatsappNumber: String(target.whatsapp_number) }; }),
    });
    res.status(201).json({ invitations });
  }));
  router.post('/rooms/:roomId/whatsapp-invitations/:invitationId/opened', guestAuth(db), asyncHandler(async (req, res) => {
    const guest = req.guest; if (!guest || guest.publicRoomId !== req.params.roomId) throw new HttpError(403, 'ROOM_MISMATCH', 'This session belongs to another room.');
    const result = await db.query(`UPDATE whatsapp_invitations SET status='opened_whatsapp',opened_at=COALESCE(opened_at,now())
      WHERE id=$1 AND room_id=$2 AND requester_session_id=$3 RETURNING id`, [req.params.invitationId, guest.roomId, guest.id]);
    if (!result.rowCount) throw new HttpError(404, 'INVITATION_NOT_FOUND', 'This prepared WhatsApp invitation is no longer available.');
    res.status(204).end();
  }));
  router.post('/rooms/:roomId/members/:targetSessionId/notify', guestAuth(db), asyncHandler(async (req, res) => {
    const guest = req.guest; if (!guest || guest.publicRoomId !== req.params.roomId) throw new HttpError(403, 'ROOM_MISMATCH', 'This session belongs to another room.');
    if (!mailer.configured) throw new HttpError(503, 'SMTP_NOT_CONFIGURED', 'Email reminders are not configured for this StudyRoom server.');
    if (guest.id === req.params.targetSessionId) throw new HttpError(400, 'CANNOT_NOTIFY_SELF', 'You cannot send a reminder to yourself.');
    const targetResult = await db.query(`SELECT g.id,g.profile_id,g.guest_identity,g.display_name,profile.email,r.name AS room_name,r.public_room_id,r.livekit_room_name,r.status,
        ARRAY(SELECT sibling.guest_identity FROM guest_sessions sibling WHERE sibling.profile_id=g.profile_id AND sibling.room_id=g.room_id AND sibling.approval_status='approved') AS guest_identities
      FROM guest_sessions g JOIN guest_profiles profile ON profile.id=g.profile_id JOIN study_rooms r ON r.id=g.room_id
      WHERE g.id=$1 AND g.room_id=$2 AND g.approval_status='approved'`, [req.params.targetSessionId, guest.roomId]);
    const target = targetResult.rows[0];
    if (!target) throw new HttpError(404, 'PARTICIPANT_NOT_FOUND', 'That participant is no longer available.');
    if (target.profile_id === guest.profileId) throw new HttpError(400, 'CANNOT_NOTIFY_SELF', 'You cannot send a reminder to yourself.');
    if (!target.email) throw new HttpError(409, 'EMAIL_NOT_PROVIDED', 'That participant did not opt in to email reminders.');
    if (target.status !== 'active') throw new HttpError(410, 'ROOM_CLOSED', 'This study room is no longer active.');
    const live = new Set(await livekit.activeIdentities(target.livekit_room_name));
    if (!live.has(guest.guestIdentity)) throw new HttpError(403, 'NOT_ACTIVE_IN_MEETING', 'Only an active meeting participant can send reminders.');
    if (((target.guest_identities as string[] | null) ?? []).some(identity => live.has(identity))) throw new HttpError(409, 'PARTICIPANT_ACTIVE', 'That participant is already active in the meeting.');

    const client = await db.connect(); let notificationId = '';
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`email-reminder:${target.profile_id}`]);
      const recent = await client.query(`SELECT 1 FROM participant_notifications notification
        JOIN guest_sessions target_session ON target_session.id=notification.target_session_id
        WHERE target_session.profile_id=$1 AND notification.sent_at>now()-interval '10 minutes' LIMIT 1`, [target.profile_id]);
      if (recent.rowCount) throw new HttpError(429, 'NOTIFICATION_COOLDOWN', 'A reminder was already sent recently. Try again later.');
      const inserted = await client.query(`INSERT INTO participant_notifications(room_id,requester_session_id,target_session_id) VALUES($1,$2,$3) RETURNING id,sent_at`, [guest.roomId, guest.id, target.id]);
      notificationId = String(inserted.rows[0].id);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }

    try {
      const delivery = await mailer.sendReminder({ to: target.email, targetName: target.display_name, requesterName: guest.displayName, roomName: target.room_name, roomUrl: `${config.WEB_ORIGIN}/room/${target.public_room_id}` });
      console.log(`Email reminder sent; provider=${mailer.provider} notificationId=${notificationId} messageId=${delivery.messageId ?? 'unavailable'}.`);
    } catch (error) {
      console.error(`Email reminder failed; provider=${mailer.provider} notificationId=${notificationId} code=${emailErrorCode(error)}.`);
      await db.query('DELETE FROM participant_notifications WHERE id=$1', [notificationId]).catch(() => {});
      throw new HttpError(502, 'EMAIL_DELIVERY_FAILED', 'The reminder email could not be delivered. Try again later.');
    }
    res.status(202).json({ message: `Reminder sent to ${target.display_name}.`, notifiedAt: new Date().toISOString() });
  }));
  router.get('/rooms/:roomId/waiting/:requestId', asyncHandler(async (req, res) => { const token = String(req.query.token ?? ''); const result = await db.query(`SELECT r.*,g.waiting_token_hash,g.approval_status,g.guest_identity,g.display_name,g.avatar_id,g.joined_at,(SELECT count(DISTINCT COALESCE(active.auth_user_id::text,active.profile_id::text)) FROM guest_sessions active WHERE active.room_id=r.id AND active.left_at IS NULL AND active.approval_status='approved' AND active.last_seen_at>now()-interval '5 minutes')::int AS active_participants FROM study_rooms r JOIN guest_sessions g ON g.room_id=r.id WHERE r.public_room_id=$1 AND g.id=$2`, [req.params.roomId, req.params.requestId]); const row = result.rows[0]; if (!row || !token || tokenHash(token) !== row.waiting_token_hash) throw new HttpError(404, 'WAITING_REQUEST_NOT_FOUND', 'The waiting request is no longer available.'); if (row.approval_status === 'declined') throw new HttpError(403, 'WAITING_DECLINED', 'The room administrator declined this request.'); if (row.approval_status === 'pending') return res.status(202).json({ status: 'waiting', requestId: req.params.requestId, requestToken: token }); assertRoomJoinable(row, new Date(), true); const sessionToken = randomToken(); await db.query('UPDATE guest_sessions SET session_token_hash=$1, last_seen_at=now() WHERE id=$2', [tokenHash(sessionToken), req.params.requestId]); const lk = await livekit.guestToken({ roomName: row.livekit_room_name, identity: row.guest_identity, displayName: row.display_name, avatarId: row.avatar_id, screenSharingEnabled: row.screen_sharing_enabled }); return res.json({ status: 'joined', livekitUrl: livekit.publicUrl, token: lk, sessionId: req.params.requestId, sessionToken, identity: row.guest_identity, joinedAt: new Date(row.joined_at).toISOString(), room: stripAdmin(mapRoom(row)) }); }));
  router.post('/rooms/:roomId/heartbeat', guestAuth(db), asyncHandler(async (req, res) => { const guest = req.guest; if (!guest || guest.publicRoomId !== req.params.roomId) throw new HttpError(403, 'ROOM_MISMATCH', 'This session belongs to another room.'); await db.query('UPDATE guest_sessions SET last_seen_at=now() WHERE id=$1', [guest.id]); res.status(204).end(); }));
  router.post('/rooms/:roomId/leave', guestAuth(db), asyncHandler(async (req, res) => { const guest = req.guest; if (!guest || guest.publicRoomId !== req.params.roomId) throw new HttpError(403, 'ROOM_MISMATCH', 'This session belongs to another room.'); await db.query('UPDATE guest_sessions SET left_at=COALESCE(left_at,now()), last_seen_at=now() WHERE id=$1', [guest.id]); res.status(204).end(); }));
  // Compatibility for already-cached clients. Page lifecycle events also fire
  // during refresh, so they must never end a resumable participant session.
  router.post('/rooms/:roomId/leave-beacon', (_req, res) => { res.status(204).end(); });
  return router;
}
function stripAdmin(room: ReturnType<typeof mapRoom>) { const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, closedAt: _closedAt, ...safe } = room; return safe; }
