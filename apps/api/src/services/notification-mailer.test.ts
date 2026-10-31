import { afterEach, describe, expect, it, vi } from 'vitest';
import { escapeHtml, normalizeSmtpPassword, NotificationMailer, relayCredential } from './notification-mailer.js';
import type { Config } from '../config.js';

afterEach(() => vi.unstubAllGlobals());

describe('notification email HTML', () => {
  it('escapes participant supplied content', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">`)).toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
  });

  it('accepts a Gmail App Password copied with display spaces', () => {
    expect(normalizeSmtpPassword('smtp.gmail.com', 'abcd efgh ijkl mnop')).toBe('abcdefghijklmnop');
    expect(normalizeSmtpPassword('smtp.example.com', 'password with spaces')).toBe('password with spaces');
  });

  it('uses the protected HTTPS relay in production', async () => {
    const config = {
      NODE_ENV: 'production',
      PORT: 4000,
      WEB_ORIGIN: 'https://example.com',
      DATABASE_URL: 'postgres://unused',
      DATABASE_SSL: false,
      SESSION_SECRET: 'x'.repeat(32),
      LIVEKIT_URL: 'ws://unused',
      LIVEKIT_API_KEY: 'key',
      LIVEKIT_API_SECRET: 'x'.repeat(20),
      TRUST_PROXY: 'false',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: 465,
      SMTP_SECURE: true,
      SMTP_USER: 'sender@example.com',
      SMTP_PASS: 'abcd efgh ijkl mnop',
    } as unknown as Config;

    const mailer = new NotificationMailer(config);
    expect(mailer.provider).toBe('relay');
    expect(mailer.configured).toBe(true);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messageId: 'relay-message-id' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await mailer.verify();

    const result = await mailer.sendReminder({
      to: 'guest@school.edu',
      targetName: 'Alex',
      requesterName: 'Sam',
      roomName: 'Physics Study',
      roomUrl: 'https://example.com/room/abc-123',
    });

    expect(result.messageId).toBe('relay-message-id');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/email-reminder',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-StudyRoom-Relay-Key': relayCredential('abcdefghijklmnop'),
        }),
      })
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not treat a Supabase Auth key as a custom reminder provider', () => {
    const config = {
      NODE_ENV: 'test',
      PORT: 4000,
      WEB_ORIGIN: 'http://localhost:5173',
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
    expect(mailer.provider).toBe('none');
    expect(mailer.configured).toBe(false);
  });

  it('routes a free Render production service through HTTPS even with a stale smtp override', () => {
    const config = {
      NODE_ENV: 'production',
      PORT: 4000,
      WEB_ORIGIN: 'https://example.com',
      DATABASE_URL: 'postgres://unused',
      DATABASE_SSL: false,
      SESSION_SECRET: 'x'.repeat(32),
      LIVEKIT_URL: 'ws://unused',
      LIVEKIT_API_KEY: 'key',
      LIVEKIT_API_SECRET: 'x'.repeat(20),
      TRUST_PROXY: 'true',
      RENDER: 'true',
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: 465,
      SMTP_SECURE: true,
      SMTP_USER: 'sender@example.com',
      SMTP_PASS: 'abcdefghijklmnop',
    } as unknown as Config;

    expect(new NotificationMailer(config).provider).toBe('relay');
  });
});
