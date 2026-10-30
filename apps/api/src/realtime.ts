import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { chatMessageSchema, type RealtimeClientMessage, type RealtimeServerMessage } from '@studyroom/shared';
import type { Database } from './db.js';
import type { Config } from './config.js';
import { tokenHash } from './security/crypto.js';

interface ClientState { authenticated: boolean; roomId?: string; sessionId?: string; identity?: string; displayName?: string; avatarId?: string; chatEnabled?: boolean; recent: number[] }
const state = new WeakMap<WebSocket, ClientState>();

function isSingleEmoji(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 32 || /[\r\n]/.test(value)) return false;
  const graphemes = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value));
  return graphemes.length === 1 && /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u.test(value);
}

export function createRealtimeServer(db: Database, config: Config) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 12_000 });
  wss.on('connection', socket => {
    state.set(socket, { authenticated: false, recent: [] }); const authTimer = setTimeout(() => socket.close(4401, 'Authentication timeout'), 5000);
    socket.on('message', async raw => { try {
      const message = JSON.parse(raw.toString()) as RealtimeClientMessage; const client = state.get(socket)!;
      if (!client.authenticated) {
        if (message.type !== 'authenticate' || !message.roomId || !message.sessionId || !message.sessionToken) return socket.close(4401, 'Authentication required');
        const result = await db.query(`SELECT g.id,g.guest_identity,g.display_name,g.avatar_id,r.public_room_id,r.chat_enabled,r.status,r.expires_at FROM guest_sessions g JOIN study_rooms r ON r.id=g.room_id WHERE g.id=$1 AND g.session_token_hash=$2 AND r.public_room_id=$3 AND g.left_at IS NULL AND g.approval_status='approved'`, [message.sessionId, tokenHash(message.sessionToken), message.roomId]);
        const row = result.rows[0]; if (!row || row.status !== 'active' || (row.expires_at && new Date(row.expires_at) <= new Date())) return socket.close(4403, 'Session unavailable');
        Object.assign(client, { authenticated: true, roomId: row.public_room_id, sessionId: row.id, identity: row.guest_identity, displayName: row.display_name, avatarId: row.avatar_id, chatEnabled: row.chat_enabled }); clearTimeout(authTimer); send(socket, { type: 'ready' }); broadcastPresence(wss, client.roomId!); return;
      }
      const now = Date.now(); client.recent = client.recent.filter(t => now - t < 10_000); if (client.recent.length >= 15) return send(socket, { type: 'error', code: 'RATE_LIMIT', message: 'Slow down for a moment.' }); client.recent.push(now);
      if (message.type === 'chat') { if (!client.chatEnabled) return send(socket, { type: 'error', code: 'CHAT_DISABLED', message: 'Chat is disabled for this room.' }); const parsed = chatMessageSchema.safeParse({ message: message.message }); if (!parsed.success) return send(socket, { type: 'error', code: 'MESSAGE_INVALID', message: 'Messages must be between 1 and 1000 characters.' }); broadcast(wss, client.roomId!, { type: 'chat', identity: client.identity, displayName: client.displayName, avatarId: client.avatarId as never, message: parsed.data.message, timestamp: new Date().toISOString() }); }
      if (message.type === 'reaction' && isSingleEmoji(message.emoji)) broadcast(wss, client.roomId!, { type: 'reaction', identity: client.identity, displayName: client.displayName, avatarId: client.avatarId as never, emoji: message.emoji, timestamp: new Date().toISOString() });
      if (message.type === 'hand' && typeof message.raised === 'boolean') broadcast(wss, client.roomId!, { type: 'hand', identity: client.identity, displayName: client.displayName, avatarId: client.avatarId as never, raised: message.raised, timestamp: new Date().toISOString() });
    } catch { send(socket, { type: 'error', code: 'BAD_MESSAGE', message: 'That realtime message could not be read.' }); } });
    socket.on('close', () => { clearTimeout(authTimer); const client = state.get(socket); if (client?.roomId) broadcastPresence(wss, client.roomId); });
  });
  return { wss, handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer) { const origin = request.headers.origin; const pathname = new URL(request.url ?? '/', 'http://localhost').pathname; if (pathname !== '/ws' || origin !== config.WEB_ORIGIN) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; } wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request)); } };
}
function send(socket: WebSocket, value: RealtimeServerMessage) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); }
function broadcast(wss: WebSocketServer, roomId: string, value: RealtimeServerMessage) { for (const socket of wss.clients) { const client = state.get(socket); if (client?.authenticated && client.roomId === roomId) send(socket, value); } }
function broadcastPresence(wss: WebSocketServer, roomId: string) { const participants = Array.from(wss.clients).map(socket => state.get(socket)).filter((client): client is ClientState & Required<Pick<ClientState,'identity'|'displayName'|'avatarId'>> => Boolean(client?.authenticated && client.roomId === roomId && client.identity && client.displayName && client.avatarId)).map(client => ({ identity: client.identity, displayName: client.displayName, avatarId: client.avatarId as never })); broadcast(wss, roomId, { type: 'presence', participants }); }
