import { describe, expect, it } from 'vitest';
import { assertRoomJoinable } from './room-policy.js';

const base = { status: 'active', expires_at: null, max_participants: 5, active_participants: 2 };
describe('room join policy', () => {
  it('allows an active room with capacity', () => expect(() => assertRoomJoinable(base)).not.toThrow());
  it('rejects a closed room', () => expect(() => assertRoomJoinable({ ...base, status: 'closed' })).toThrowError(/closed/i));
  it('rejects an expired room', () => expect(() => assertRoomJoinable({ ...base, expires_at: '2020-01-01T00:00:00Z' })).toThrowError(/expired/i));
  it('rejects a room at capacity', () => expect(() => assertRoomJoinable({ ...base, active_participants: 5 })).toThrowError(/capacity/i));
  it('does not double count an approved waiting guest', () => expect(() => assertRoomJoinable({ ...base, active_participants: 5 }, new Date(), true)).not.toThrow());
});
