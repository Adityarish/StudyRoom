import { createWhatsAppClickToChatUrl, createWhatsAppInvitationMessage, normalizeIndianWhatsAppNumber, type PreparedWhatsAppInvitation } from '@studyroom/shared';
import type { Database } from '../db.js';

interface InvitationTarget { id: string; targetSessionId?: string; displayName: string; whatsappNumber: string }
interface PrepareInput {
  roomId: string;
  roomName: string;
  publicRoomId: string;
  webOrigin: string;
  hostName: string;
  targets: InvitationTarget[];
  requesterSessionId?: string;
  administratorId?: string;
}

export function maskWhatsAppNumber(value: string) {
  const number = normalizeIndianWhatsAppNumber(value);
  return `+91 ••••••${number.slice(-4)}`;
}

export function formatWhatsAppNumber(value: string) {
  const number = normalizeIndianWhatsAppNumber(value);
  return `+91 ${number.slice(2, 7)} ${number.slice(7)}`;
}

export async function prepareWhatsAppInvitations(db: Database, input: PrepareInput): Promise<PreparedWhatsAppInvitation[]> {
  if (Boolean(input.requesterSessionId) === Boolean(input.administratorId)) throw new Error('Exactly one invitation creator is required.');
  const meetingUrl = `${input.webOrigin.replace(/\/$/, '')}/room/${encodeURIComponent(input.publicRoomId)}`;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const invitations: PreparedWhatsAppInvitation[] = [];
    for (const target of input.targets) {
      const phoneNumber = normalizeIndianWhatsAppNumber(target.whatsappNumber);
      const message = createWhatsAppInvitationMessage({ participantName: target.displayName, roomName: input.roomName, hostName: input.hostName, meetingUrl });
      const saved = await client.query(`INSERT INTO whatsapp_invitations(
        room_id,target_session_id,requester_session_id,created_by,participant_name,host_name,phone_number,meeting_url,status
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'prepared') RETURNING id`, [
        input.roomId, target.targetSessionId ?? target.id, input.requesterSessionId ?? null, input.administratorId ?? null,
        target.displayName, input.hostName, phoneNumber, meetingUrl,
      ]);
      invitations.push({
        id: String(saved.rows[0].id),
        recipientName: target.displayName,
        message,
        whatsappUrl: createWhatsAppClickToChatUrl(phoneNumber, message),
        status: 'prepared',
      });
    }
    await client.query('COMMIT');
    return invitations;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
