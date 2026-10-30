import { describe, expect, it, vi } from 'vitest';
import { createWhatsAppClickToChatUrl, createWhatsAppInvitationMessage, normalizeIndianWhatsAppNumber } from '@studyroom/shared';
import { maskWhatsAppNumber, prepareWhatsAppInvitations } from './whatsapp-click-to-chat.js';

describe('WhatsApp Click-to-Chat invitations', () => {
  it('normalizes supported Indian phone formats', () => {
    expect(normalizeIndianWhatsAppNumber('98765 43210')).toBe('919876543210');
    expect(normalizeIndianWhatsAppNumber('+91 (98765) 43210')).toBe('919876543210');
    expect(normalizeIndianWhatsAppNumber('09876543210')).toBe('919876543210');
    expect(maskWhatsAppNumber('919876543210')).toBe('+91 ••••••3210');
  });

  it('rejects non-Indian and invalid mobile numbers', () => {
    expect(() => normalizeIndianWhatsAppNumber('+1 415 555 2671')).toThrow('valid Indian');
    expect(() => normalizeIndianWhatsAppNumber('911234567890')).toThrow('valid Indian');
  });

  it('creates a personalized and URL-encoded official wa.me link', () => {
    const message = createWhatsAppInvitationMessage({ participantName: 'Asha', hostName: 'Aditya', roomName: 'Physics Circle', meetingUrl: 'https://study.example/room/abc' });
    expect(message).toContain('Hey Asha! 👋');
    expect(message).toContain('Aditya has invited you to join *Physics Circle*');
    expect(message).toContain('https://study.example/room/abc');
    const url = createWhatsAppClickToChatUrl('9876543210', message);
    expect(url).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);
    expect(decodeURIComponent(url.split('?text=')[1]!)).toBe(message);
  });

  it('stores prepared records without claiming they were sent', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'invitation-1' }] })
      .mockResolvedValueOnce({ rows: [] });
    const release = vi.fn();
    const db = { connect: vi.fn(async () => ({ query, release })) } as never;
    const result = await prepareWhatsAppInvitations(db, {
      roomId: 'room-db-id', publicRoomId: 'public-room', roomName: 'Chemistry', webOrigin: 'https://study.example/', hostName: 'Host', administratorId: 'admin-id',
      targets: [{ id: 'participant-id', displayName: 'Riya', whatsappNumber: '+91 98765 43210' }],
    });
    expect(result[0]).toMatchObject({ id: 'invitation-1', recipientName: 'Riya', status: 'prepared' });
    expect(query.mock.calls[1]?.[0]).toContain("'prepared'");
    expect(query.mock.calls[1]?.[0]).not.toContain("'sent'");
    expect(query).toHaveBeenLastCalledWith('COMMIT');
    expect(release).toHaveBeenCalled();
  });
});
