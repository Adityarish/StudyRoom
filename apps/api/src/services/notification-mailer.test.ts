import { describe, expect, it } from 'vitest';
import { escapeHtml, normalizeSmtpPassword } from './notification-mailer.js';

describe('notification email HTML', () => {
  it('escapes participant supplied content', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">`)).toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
  });

  it('accepts a Gmail App Password copied with display spaces', () => {
    expect(normalizeSmtpPassword('smtp.gmail.com', 'abcd efgh ijkl mnop')).toBe('abcdefghijklmnop');
    expect(normalizeSmtpPassword('smtp.example.com', 'password with spaces')).toBe('password with spaces');
  });
});
