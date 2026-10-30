import { describe, expect, it } from 'vitest';
import { hashPassword, randomToken, tokenHash, verifyPassword } from './crypto.js';

describe('security primitives', () => {
  it('hashes passwords with a random salt', async () => { const one = await hashPassword('a-secure-example-password'); const two = await hashPassword('a-secure-example-password'); expect(one).not.toBe(two); expect(await verifyPassword('a-secure-example-password', one)).toBe(true); expect(await verifyPassword('wrong-password', one)).toBe(false); });
  it('creates unpredictable opaque tokens and one-way lookup hashes', () => { const one = randomToken(); const two = randomToken(); expect(one).not.toBe(two); expect(one).toHaveLength(43); expect(tokenHash(one)).toMatch(/^[a-f0-9]{64}$/); });
});
