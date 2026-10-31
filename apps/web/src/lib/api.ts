import type { ApiError, GuestContact, JoinResponse, PreparedWhatsAppInvitation, PublicRoom, RoomMember, WaitingResponse, WhatsAppContact } from '@studyroom/shared';

const configuredBackendUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
const configuredPublicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim().replace(/\/$/, '');
const defaultProductionAppUrl = 'https://studyroom-liart.vercel.app';
const defaultProductionBackendUrl = 'https://studyroom-api-0x2w.onrender.com';

// Production HTTP requests stay on the Vercel origin and are forwarded to
// Render by vercel.json. This keeps administrator cookies first-party. The
// direct Render URL remains necessary for the WebSocket connection.
export const API_URL = import.meta.env.PROD ? '' : configuredBackendUrl ?? 'http://localhost:4000';
export const REALTIME_URL = import.meta.env.PROD
  ? configuredBackendUrl && configuredBackendUrl !== window.location.origin ? configuredBackendUrl : defaultProductionBackendUrl
  : configuredBackendUrl ?? 'http://localhost:4000';

export function roomInvitationUrl(publicRoomId: string) {
  const appOrigin = configuredPublicAppUrl ?? (import.meta.env.PROD ? defaultProductionAppUrl : window.location.origin);
  return new URL(`/room/${encodeURIComponent(publicRoomId)}`, appOrigin).toString();
}

export class ApiRequestError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const csrf = localStorage.getItem('studyroom.csrf');
  if (csrf && !['GET', 'HEAD'].includes(init.method ?? 'GET')) headers.set('x-csrf-token', csrf);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  const body = await response.json().catch(() => ({})) as T | ApiError;
  if (!response.ok) {
    const error = (body as ApiError).error;
    throw new ApiRequestError(response.status, error?.code ?? 'REQUEST_FAILED', error?.message ?? 'Request failed', error?.details);
  }
  return body as T;
}

export const api = {
  getRoom: (id: string) => request<{ room: PublicRoom }>(`/api/rooms/${encodeURIComponent(id)}`),
  joinRoom: (id: string, body: unknown) => request<JoinResponse | WaitingResponse>(`/api/rooms/${encodeURIComponent(id)}/join`, { method: 'POST', body: JSON.stringify(body) }),
  waitingStatus: (id: string, requestId: string, token: string) => request<JoinResponse | WaitingResponse>(`/api/rooms/${encodeURIComponent(id)}/waiting/${encodeURIComponent(requestId)}?token=${encodeURIComponent(token)}`),
  resumeRoom: (id: string, sessionId: string, token: string) => request<JoinResponse>(`/api/rooms/${encodeURIComponent(id)}/resume`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionId }) }),
  leaveRoom: (id: string, sessionId: string, token: string) => request(`/api/rooms/${encodeURIComponent(id)}/leave`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionId }) }),
  heartbeat: (id: string, sessionId: string, token: string) => request(`/api/rooms/${encodeURIComponent(id)}/heartbeat`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionId }) }),
  roomMembers: (id: string, sessionId: string, token: string) => request<{ members: RoomMember[] }>(`/api/rooms/${encodeURIComponent(id)}/members`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionId }) }),
  notifyMember: (id: string, targetSessionId: string, sessionId: string, token: string) => request<{ message: string; notifiedAt: string }>(`/api/rooms/${encodeURIComponent(id)}/members/${encodeURIComponent(targetSessionId)}/notify`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionId }) }),
  prepareRoomWhatsAppInvitations: (id: string, targetSessionIds: string[], sessionId: string, token: string) => request<{ invitations: PreparedWhatsAppInvitation[] }>(`/api/rooms/${encodeURIComponent(id)}/whatsapp-invitations`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionId, targetSessionIds }) }),
  markRoomWhatsAppOpened: (id: string, invitationId: string, sessionId: string, token: string) => request(`/api/rooms/${encodeURIComponent(id)}/whatsapp-invitations/${encodeURIComponent(invitationId)}/opened`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionId }) }),
  adminLogin: (body: unknown) => request<{ administrator: { id: string; username: string }; csrfToken: string }>('/api/admin/login', { method: 'POST', body: JSON.stringify(body) }),
  adminLogout: () => request('/api/admin/logout', { method: 'POST' }),
  adminMe: () => request<{ administrator: { id: string; username: string }; csrfToken: string }>('/api/admin/me'),
  adminRooms: () => request<{ rooms: import('@studyroom/shared').AdminRoom[] }>('/api/admin/rooms'),
  createRoom: (body: unknown) => request<{ room: import('@studyroom/shared').AdminRoom }>('/api/admin/rooms', { method: 'POST', body: JSON.stringify(body) }),
  guestContacts: () => request<{ contacts: GuestContact[] }>('/api/admin/guest-contacts'),
  whatsappContacts: () => request<{ contacts: WhatsAppContact[] }>('/api/admin/whatsapp-contacts'),
  prepareAdminWhatsAppInvitations: (id: string, targetSessionIds: string[]) => request<{ invitations: PreparedWhatsAppInvitation[] }>(`/api/admin/rooms/${encodeURIComponent(id)}/whatsapp-invitations`, { method: 'POST', body: JSON.stringify({ targetSessionIds }) }),
  markAdminWhatsAppOpened: (invitationId: string) => request(`/api/admin/whatsapp-invitations/${encodeURIComponent(invitationId)}/opened`, { method: 'POST' }),
  updateRoom: (id: string, body: unknown) => request<{ room: import('@studyroom/shared').AdminRoom }>(`/api/admin/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRoom: (id: string) => request(`/api/admin/rooms/${id}`, { method: 'DELETE' }),
  participants: (id: string) => request<{ participants: AdminParticipant[] }>(`/api/admin/rooms/${id}/participants`),
  removeParticipant: (id: string, identity: string) => request(`/api/admin/rooms/${id}/participants/${encodeURIComponent(identity)}`, { method: 'DELETE' }),
  approveParticipant: (id: string, sessionId: string, approved: boolean) => request(`/api/admin/rooms/${id}/waiting/${sessionId}`, { method: 'POST', body: JSON.stringify({ approved }) }),
};

export interface AdminParticipant { id: string; identity: string; displayName: string; avatarId: string; joinedAt: string; approvalStatus: string; live: boolean }
