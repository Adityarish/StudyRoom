import { beforeEach, describe, expect, it } from 'vitest';
import { getGuestClientId, guestSession } from '../src/lib/guest';

describe('guest browser identity', () => {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };

  beforeEach(() => {
    values.clear();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: storage });
  });

  it('reuses one stable id for repeated joins from the same browser', () => {
    const first = getGuestClientId();
    const second = getGuestClientId();

    expect(first.length).toBeGreaterThanOrEqual(16);
    expect(second).toBe(first);
  });

  it('replaces an old invalid browser id before joining', () => {
    window.localStorage.setItem('studyroom.guest-client-id', 'old id');

    const repaired = getGuestClientId();

    expect(repaired).not.toBe('old id');
    expect(repaired.length).toBeGreaterThanOrEqual(16);
    expect(repaired).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(window.localStorage.getItem('studyroom.guest-client-id')).toBe(repaired);
  });

  it('keeps the resumable room session and original join time across a refresh', () => {
    const joined = {
      status: 'joined' as const,
      livekitUrl: 'wss://livekit.example.com', token: 'short-lived-token',
      sessionId: 'session-1', sessionToken: 'application-token', identity: 'guest_1',
      joinedAt: '2026-10-31T08:00:00.000Z',
      room: { publicRoomId: 'room-1', name: 'Focus room', description: '', subject: 'Study', status: 'active' as const, maxParticipants: 10, chatEnabled: true, screenSharingEnabled: true, waitingRoomEnabled: false, passwordRequired: false, expiresAt: null, activeParticipants: 1 },
    };

    guestSession.save('room-1', joined);

    expect(guestSession.load('room-1')).toEqual(joined);
  });
});
