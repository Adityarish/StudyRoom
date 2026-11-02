import { describe, expect, it, vi } from 'vitest';
import { resolveGuestProfile } from './guest-profile.js';

const authenticatedInput = {
  authUserId: '11111111-1111-4111-8111-111111111111',
  clientId: 'browser-client-identifier',
  displayName: 'Aditya',
  avatarId: 'nova',
  presentation: 'neutral',
  email: 'aditya@example.com',
  whatsappNumber: null,
  whatsappConsent: false,
};

describe('resolveGuestProfile authenticated identity', () => {
  it('uses the verified account even when a contact identifier was stale', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      if (sql.includes('WHERE auth_user_id=$1')) return { rows: [], rowCount: 0 };
      if (sql.includes('profile.auth_user_id IS NULL')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO guest_profiles')) return { rows: [{ id: 'new-aditya-profile' }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });

    const result = await resolveGuestProfile({ query } as never, authenticatedInput);

    expect(result).toBe('new-aditya-profile');
    expect(query.mock.calls.some(([sql]) => String(sql).includes("identifier.kind='whatsapp'"))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('ON CONFLICT(kind,value) DO UPDATE'))).toBe(true);
  });

  it('reuses only the profile owned by the same verified account', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      if (sql.includes('WHERE auth_user_id=$1')) return { rows: [{ id: 'owned-profile' }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });

    const result = await resolveGuestProfile({ query } as never, authenticatedInput);

    expect(result).toBe('owned-profile');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('profile.auth_user_id IS NULL'))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO guest_profiles'))).toBe(false);
  });

  it('can safely claim an unowned pre-authentication profile with the verified email', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      if (sql.includes('WHERE auth_user_id=$1')) return { rows: [], rowCount: 0 };
      if (sql.includes('profile.auth_user_id IS NULL')) return { rows: [{ id: 'legacy-profile' }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });

    const result = await resolveGuestProfile({ query } as never, authenticatedInput);

    expect(result).toBe('legacy-profile');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('auth_user_id=$8'))).toBe(true);
  });
});
