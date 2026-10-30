import { beforeEach, describe, expect, it } from 'vitest';
import { getGuestClientId } from '../src/lib/guest';

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
});
