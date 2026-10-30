import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import type { Config } from './config.js';

const config: Config = { NODE_ENV:'test', PORT:4000, WEB_ORIGIN:'http://localhost:5173', DATABASE_URL:'postgres://unused', DATABASE_SSL:false, SESSION_SECRET:'x'.repeat(32), LIVEKIT_URL:'ws://localhost:7880', LIVEKIT_API_KEY:'key', LIVEKIT_API_SECRET:'x'.repeat(20), TRUST_PROXY:'false' };
const db = { query: vi.fn(async (sql: string) => sql === 'SELECT 1' ? { rows:[{ '?column?': 1 }], rowCount:1 } : { rows:[], rowCount:0 }), connect: vi.fn(), end: vi.fn() } as never;
const livekit = { publicUrl:'ws://localhost:7880', guestToken:vi.fn(), remove:vi.fn(), end:vi.fn(), activeIdentities:vi.fn(async () => []) } as never;

describe.skipIf(Boolean(process.env.CODEX_SANDBOX))('HTTP application security', () => {
  const app = createApp(db, config, livekit);
  it('reports database-backed health', async () => { const response = await request(app).get('/api/health').expect(200); expect(response.body.status).toBe('ok'); });
  it('rejects anonymous admin room creation', async () => { const response = await request(app).post('/api/admin/rooms').send({ name:'Unauthorized room' }).expect(401); expect(response.body.error.code).toBe('ADMIN_REQUIRED'); });
  it('does not expose stack traces on unknown routes', async () => { const response = await request(app).get('/api/does-not-exist').expect(404); expect(response.body.error).toEqual({ code:'NOT_FOUND', message:'The requested resource was not found.' }); expect(response.text).not.toContain('at '); });
  it('uses the origin allowlist', async () => { const response = await request(app).options('/api/health').set('Origin','http://localhost:5173').expect(204); expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173'); });
});
