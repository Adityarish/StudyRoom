import { describe, expect, it, vi } from 'vitest';
import { escapeHtml, normalizeSmtpPassword, NotificationMailer } from './notification-mailer.js';
import type { Config } from '../config.js';

describe('notification email HTML', () => {
  it('escapes participant supplied content', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">`)).toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
  });

  it('accepts a Gmail App Password copied with display spaces', () => {
    expect(normalizeSmtpPassword('smtp.gmail.com', 'abcd efgh ijkl mnop')).toBe('abcdefghijklmnop');
    expect(normalizeSmtpPassword('smtp.example.com', 'password with spaces')).toBe('password with spaces');
  });

  it('configures Supabase email delivery when Supabase keys are provided', async () => {
    const config = {
      NODE_ENV: 'test',
      PORT: 4000,
      WEB_ORIGIN: 'https://example.com',
      DATABASE_URL: 'postgres://unused',
      DATABASE_SSL: false,
      SESSION_SECRET: 'x'.repeat(32),
      LIVEKIT_URL: 'ws://unused',
      LIVEKIT_API_KEY: 'key',
      LIVEKIT_API_SECRET: 'x'.repeat(20),
      TRUST_PROXY: 'false',
      SUPABASE_URL: 'https://test-ref.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
    } as unknown as Config;

    const mailer = new NotificationMailer(config);
    expect(mailer.provider).toBe('supabase');
    expect(mailer.configured).toBe(true);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await mailer.sendReminder({
      to: 'guest@school.edu',
      targetName: 'Alex',
      requesterName: 'Sam',
      roomName: 'Physics Study',
      roomUrl: 'https://example.com/room/abc-123',
    });

    expect(result.messageId).toContain('supabase_');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test-ref.supabase.co/auth/v1/otp',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'test-anon-key',
        }),
      })
    );

    vi.unstubAllGlobals();
  });
});
