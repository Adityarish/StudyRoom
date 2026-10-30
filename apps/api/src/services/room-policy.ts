import { HttpError } from '../http/errors.js';

export interface JoinableRoom { status: string; expires_at: Date | string | null; max_participants: number; active_participants: number }
export function assertRoomJoinable(room: JoinableRoom, now = new Date(), currentParticipantIncluded = false) {
  if (room.status !== 'active') throw new HttpError(410, 'ROOM_CLOSED', 'This study room has been closed.');
  if (room.expires_at && new Date(room.expires_at) <= now) throw new HttpError(410, 'ROOM_EXPIRED', 'This study room has expired.');
  if (Number(room.active_participants) >= Number(room.max_participants) + (currentParticipantIncluded ? 1 : 0)) throw new HttpError(409, 'ROOM_FULL', 'This study room is at capacity.');
}
