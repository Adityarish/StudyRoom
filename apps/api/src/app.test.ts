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

describe.skipIf(Boolean(process.env.CODEX_SANDBOX))('participant session resume', () => {
  it('does not end a participant session when a cached client sends a refresh beacon', async () => {
    const query = vi.fn();
    const app = createApp({ query, connect:vi.fn(), end:vi.fn() } as never, config, livekit);

    await request(app).post('/api/rooms/public-room/leave-beacon').send({ sessionId:'session-1', sessionToken:'application-token' }).expect(204);

    expect(query).not.toHaveBeenCalled();
  });

  it('issues a fresh LiveKit token while preserving the original join time', async () => {
    const joinedAt = new Date('2026-10-31T08:00:00.000Z');
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM guest_sessions g JOIN study_rooms r')) return { rows: [{ id:'session-1', profile_id:'profile-1', room_id:'room-1', guest_identity:'guest_1', display_name:'Asha', avatar_id:'nova', approval_status:'approved', public_room_id:'public-room', chat_enabled:true }], rowCount:1 };
      if (sql.includes('session.joined_at AS session_joined_at')) return { rows: [{ id:'room-1', public_room_id:'public-room', livekit_room_name:'studyroom_1', name:'Physics', description:'', subject:'Study', status:'active', max_participants:10, chat_enabled:true, screen_sharing_enabled:true, waiting_room_enabled:false, room_password_hash:null, expires_at:null, active_participants:1, session_joined_at:joinedAt }], rowCount:1 };
      if (sql.startsWith('UPDATE guest_sessions')) return { rows:[], rowCount:1 };
      return { rows:[], rowCount:0 };
    });
    const resumeLivekit = { publicUrl:'wss://livekit.example.com', guestToken:vi.fn(async () => 'fresh-livekit-token'), remove:vi.fn(), end:vi.fn(), activeIdentities:vi.fn(async () => []) } as never;
    const app = createApp({ query, connect:vi.fn(), end:vi.fn() } as never, config, resumeLivekit);

    const response = await request(app).post('/api/rooms/public-room/resume').set('Authorization','Bearer application-token').send({ sessionId:'session-1' }).expect(200);

    expect(response.body).toMatchObject({ status:'joined', token:'fresh-livekit-token', sessionId:'session-1', identity:'guest_1', joinedAt:joinedAt.toISOString() });
    expect((resumeLivekit as { guestToken: ReturnType<typeof vi.fn> }).guestToken).toHaveBeenCalledWith(expect.objectContaining({ roomName:'studyroom_1', identity:'guest_1' }));
  });
});
