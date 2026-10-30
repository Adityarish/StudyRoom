import { describe, expect, it } from 'vitest';
import { escapeHtml } from './notification-mailer.js';

describe('notification email HTML', () => {
  it('escapes participant supplied content', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">`)).toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
  });
});
