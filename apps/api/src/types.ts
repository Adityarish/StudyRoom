import type { Request } from 'express';
export interface AdminIdentity { id: string; username: string; sessionId: string; csrfToken: string }
export interface AdminRequest extends Request { administrator?: AdminIdentity }
export interface GuestAuth { id: string; profileId: string; roomId: string; publicRoomId: string; guestIdentity: string; displayName: string; avatarId: string; approvalStatus: string; chatEnabled: boolean }
