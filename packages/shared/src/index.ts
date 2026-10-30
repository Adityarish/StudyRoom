import { z } from 'zod';

export const AVATAR_IDS = [
  'nova', 'sage', 'orbit', 'lumen', 'pixel', 'moss', 'ember', 'wave', 'comet', 'bloom', 'atlas', 'echo',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];
export type RoomStatus = 'active' | 'closed';
export type QualityMode = 'high' | 'balanced' | 'low';
export type LayoutMode = 'grid' | 'speaker';

export const displayNameSchema = z.string().trim().min(1, 'Enter a display name').max(48);
export const avatarIdSchema = z.enum(AVATAR_IDS);
export const presentationSchema = z.enum(['neutral', 'feminine', 'masculine']).optional();
export function normalizeIndianWhatsAppNumber(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  if (!/^91[6-9]\d{9}$/.test(digits)) throw new Error('Enter a valid Indian WhatsApp number.');
  return digits;
}

export function createWhatsAppInvitationMessage(input: { participantName: string; roomName: string; hostName: string; meetingUrl: string }) {
  return `📚 *Study Room Invitation!*\n\nHey ${input.participantName.trim()}! 👋\n\n${input.hostName.trim()} has invited you to join *${input.roomName.trim()}*.\n\n🟢 Your friends are waiting!\n\n🔗 Join Meeting: ${input.meetingUrl}\n\n✨ Come online and study together!`;
}

export function createWhatsAppClickToChatUrl(phoneNumber: string, message: string) {
  return `https://wa.me/${normalizeIndianWhatsAppNumber(phoneNumber)}?text=${encodeURIComponent(message)}`;
}

const optionalWhatsAppNumberSchema = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().max(32).refine(value => {
    try { normalizeIndianWhatsAppNumber(value); return true; } catch { return false; }
  }, 'Enter a valid Indian WhatsApp number').optional(),
).optional();

const optionalEmailSchema = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().email().max(320).transform(value => value.toLowerCase()).optional(),
).optional();

export const guestJoinSchema = z.object({
  displayName: displayNameSchema,
  avatarId: avatarIdSchema,
  presentation: presentationSchema,
  clientId: z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/),
  email: optionalEmailSchema,
  whatsappNumber: optionalWhatsAppNumberSchema,
  whatsappConsent: z.boolean().optional(),
  roomPassword: z.string().max(128).optional(),
}).superRefine((value, context) => {
  if (value.whatsappNumber && value.whatsappConsent !== true) context.addIssue({ code: z.ZodIssueCode.custom, path: ['whatsappConsent'], message: 'Confirm WhatsApp invitation consent' });
});
export type GuestJoinInput = z.infer<typeof guestJoinSchema>;

export const roomInputSchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(1000).default(''),
  subject: z.string().trim().max(100).default('General study'),
  maxParticipants: z.coerce.number().int().min(2).max(100),
  chatEnabled: z.boolean().default(true),
  screenSharingEnabled: z.boolean().default(true),
  waitingRoomEnabled: z.boolean().default(false),
  expiresAt: z.string().datetime().nullable().optional(),
  password: z.string().min(6).max(128).nullable().optional(),
});

export const adminLoginSchema = z.object({
  username: z.string().trim().min(3).max(80),
  password: z.string().min(10).max(256),
});

export const chatMessageSchema = z.object({ message: z.string().trim().min(1).max(1000) });
export const whatsappInvitationSelectionSchema = z.object({
  targetSessionIds: z.array(z.string().uuid()).min(1, 'Select at least one WhatsApp contact.').max(25, 'Open at most 25 invitations at a time.'),
});

export interface PublicRoom {
  publicRoomId: string;
  name: string;
  description: string;
  subject: string;
  status: RoomStatus;
  maxParticipants: number;
  chatEnabled: boolean;
  screenSharingEnabled: boolean;
  waitingRoomEnabled: boolean;
  passwordRequired: boolean;
  expiresAt: string | null;
  activeParticipants: number;
}

export interface AdminRoom extends PublicRoom {
  id: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface JoinResponse {
  status: 'joined';
  livekitUrl: string;
  token: string;
  sessionId: string;
  sessionToken: string;
  identity: string;
  room: PublicRoom;
}

export interface WaitingResponse {
  status: 'waiting';
  requestId: string;
  requestToken: string;
}

export interface RoomMember {
  id: string;
  displayName: string;
  avatarId: AvatarId;
  identities: string[];
  live: boolean;
  isSelf: boolean;
  canNotify: boolean;
  emailReminderStatus: 'available' | 'cooldown' | 'unavailable';
  lastNotifiedAt: string | null;
  canInviteOnWhatsApp: boolean;
}

export interface WhatsAppContact {
  id: string;
  displayName: string;
  maskedNumber: string;
}

export interface GuestContact {
  id: string;
  displayName: string;
  email: string | null;
  whatsappNumber: string | null;
  joinCount: number;
  createdAt: string;
  lastJoinedAt: string;
}

export interface PreparedWhatsAppInvitation {
  id: string;
  recipientName: string;
  message: string;
  whatsappUrl: string;
  status: 'prepared' | 'opened_whatsapp';
}

export interface ApiError { error: { code: string; message: string; details?: unknown } }

export interface RealtimeClientMessage {
  type: 'authenticate' | 'chat' | 'reaction' | 'hand';
  roomId?: string;
  sessionId?: string;
  sessionToken?: string;
  message?: string;
  emoji?: string;
  raised?: boolean;
}

export interface RealtimeServerMessage {
  type: 'ready' | 'chat' | 'reaction' | 'hand' | 'presence' | 'error';
  identity?: string;
  displayName?: string;
  avatarId?: AvatarId;
  message?: string;
  emoji?: string;
  raised?: boolean;
  timestamp?: string;
  code?: string;
  participants?: Array<{ identity: string; displayName: string; avatarId: AvatarId }>;
}
