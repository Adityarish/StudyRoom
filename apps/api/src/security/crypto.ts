import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);

export function randomToken(bytes = 32) { return randomBytes(bytes).toString('base64url'); }
export function tokenHash(value: string) { return createHash('sha256').update(value).digest('hex'); }
export async function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); const derived = await scrypt(password, salt, 64) as Buffer; return `scrypt:${salt}:${derived.toString('hex')}`; }
export async function verifyPassword(password: string, stored: string) { const [algorithm, salt, expectedHex] = stored.split(':'); if (algorithm !== 'scrypt' || !salt || !expectedHex) return false; const actual = await scrypt(password, salt, 64) as Buffer; const expected = Buffer.from(expectedHex, 'hex'); return actual.length === expected.length && timingSafeEqual(actual, expected); }
export function secureEqual(a: string, b: string) { const aa = Buffer.from(a); const bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); }
