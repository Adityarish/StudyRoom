import { describe, expect, it } from 'vitest';
import { guestJoinSchema } from '@studyroom/shared';
import { normalizeGuestContact } from './guest-contact.js';

const base = { displayName: 'Guest', avatarId: 'nova', clientId: 'browser_client_1234567890' } as const;

describe('guest contact persistence values', () => {
  it('normalizes email and Indian WhatsApp values before the join insert', () => {
    const input = guestJoinSchema.parse({
      ...base,
      email: '  Guest.Name@Example.COM ',
      whatsappNumber: '+91 98765 43210',
      whatsappConsent: true,
    });

    expect(normalizeGuestContact(input)).toEqual({
      email: 'guest.name@example.com',
      whatsappNumber: '919876543210',
      whatsappConsent: true,
    });
  });

  it('stores nulls when contact fields are omitted', () => {
    const input = guestJoinSchema.parse(base);
    expect(normalizeGuestContact(input)).toEqual({ email: null, whatsappNumber: null, whatsappConsent: false });
  });

  it('rejects a WhatsApp number without explicit consent', () => {
    expect(() => guestJoinSchema.parse({ ...base, whatsappNumber: '9876543210' })).toThrow('Confirm WhatsApp invitation consent');
  });
});
