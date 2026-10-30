import pg from 'pg';
import type { Config } from './config.js';

const { Pool } = pg;
export type Database = pg.Pool;
export function createPool(config: Config, connectionString = config.DATABASE_URL) {
  return new Pool({
    connectionString,
    ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    max: config.DATABASE_POOL_MAX ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: config.NODE_ENV === 'test',
  });
}

export function mapRoom(row: Record<string, unknown>) {
  return {
    id: String(row.id), publicRoomId: String(row.public_room_id), name: String(row.name), description: String(row.description ?? ''), subject: String(row.subject ?? ''),
    status: row.status as 'active'|'closed', maxParticipants: Number(row.max_participants), chatEnabled: Boolean(row.chat_enabled), screenSharingEnabled: Boolean(row.screen_sharing_enabled), waitingRoomEnabled: Boolean(row.waiting_room_enabled), passwordRequired: Boolean(row.room_password_hash),
    expiresAt: row.expires_at ? new Date(String(row.expires_at)).toISOString() : null, activeParticipants: Number(row.active_participants ?? 0),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined, updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : undefined, closedAt: row.closed_at ? new Date(String(row.closed_at)).toISOString() : null,
  };
}
