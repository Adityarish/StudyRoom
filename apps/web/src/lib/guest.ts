import type { JoinResponse, QualityMode } from '@studyroom/shared';

const key = (roomId: string) => `studyroom.join.${roomId}`;
const clientIdKey = 'studyroom.guest-client-id';
const validClientId = (value: string | null): value is string => Boolean(value && value.length >= 16 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value));

export function getGuestClientId() {
  const existing = window.localStorage.getItem(clientIdKey);
  if (validClientId(existing)) return existing;
  const generated = globalThis.crypto?.randomUUID?.() ?? `browser_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(clientIdKey, generated);
  return generated;
}

export const guestSession = {
  save(roomId: string, value: JoinResponse) { sessionStorage.setItem(key(roomId), JSON.stringify(value)); },
  load(roomId: string): JoinResponse | null {
    try { return JSON.parse(sessionStorage.getItem(key(roomId)) ?? 'null') as JoinResponse | null; } catch { return null; }
  },
  clear(roomId: string) { sessionStorage.removeItem(key(roomId)); },
};

export interface GuestPreferences { displayName: string; avatarId: string; presentation?: string; quality: QualityMode; email?: string }
export function loadPreferences(): GuestPreferences {
  try {
    const stored = JSON.parse(window.localStorage.getItem('studyroom.preferences') ?? 'null') as Partial<GuestPreferences> | null;
    return {
      displayName: typeof stored?.displayName === 'string' ? stored.displayName.slice(0, 48) : '',
      avatarId: ['nova', 'sage', 'orbit', 'lumen', 'pixel', 'moss', 'ember', 'wave', 'comet', 'bloom', 'atlas', 'echo'].includes(stored?.avatarId ?? '') ? stored!.avatarId! : 'nova',
      presentation: ['neutral', 'feminine', 'masculine'].includes(stored?.presentation ?? '') ? stored!.presentation : 'neutral',
      quality: ['high', 'balanced', 'low'].includes(stored?.quality ?? '') ? stored!.quality! : 'balanced',
      email: typeof stored?.email === 'string' ? stored.email.slice(0, 320) : undefined,
    };
  }
  catch { return { displayName: '', avatarId: 'nova', quality: 'balanced' }; }
}
export function savePreferences(value: GuestPreferences) { window.localStorage.setItem('studyroom.preferences', JSON.stringify(value)); }
