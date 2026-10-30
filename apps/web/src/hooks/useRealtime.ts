import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeClientMessage, RealtimeServerMessage } from '@studyroom/shared';
import { REALTIME_URL } from '../lib/api';

export function useRealtime(roomId: string, sessionId: string, sessionToken: string) {
  const wsRef = useRef<WebSocket | null>(null); const [messages, setMessages] = useState<RealtimeServerMessage[]>([]); const [participants, setParticipants] = useState<NonNullable<RealtimeServerMessage['participants']>>([]); const [connected, setConnected] = useState(false); const [unread, setUnread] = useState(0);
  useEffect(() => {
    const url = new URL(REALTIME_URL); const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; let active = true; let retryTimer: number | undefined; let attempts = 0;
    const connect = () => {
      if (!active) return;
      const ws = new WebSocket(`${protocol}//${url.host}/ws`); wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'authenticate', roomId, sessionId, sessionToken } satisfies RealtimeClientMessage));
      ws.onmessage = event => { try { const value = JSON.parse(event.data as string) as RealtimeServerMessage; if (value.type === 'ready') { attempts = 0; setConnected(true); } else if (value.type === 'presence') { setParticipants(value.participants ?? []); } else { setMessages(old => [...old.slice(-199), value]); if (value.type === 'chat') setUnread(n => n + 1); } } catch { /* ignored */ } };
      ws.onclose = () => { if (wsRef.current === ws) wsRef.current = null; setConnected(false); setParticipants([]); if (active) { const delay = Math.min(1000 * 2 ** attempts, 10_000); attempts += 1; retryTimer = window.setTimeout(connect, delay); } };
    };
    connect();
    return () => { active = false; if (retryTimer) clearTimeout(retryTimer); wsRef.current?.close(); wsRef.current = null; };
  }, [roomId, sessionId, sessionToken]);
  const send = useCallback((message: RealtimeClientMessage) => { if (wsRef.current?.readyState !== WebSocket.OPEN || !connected) return false; wsRef.current.send(JSON.stringify(message)); return true; }, [connected]);
  return { messages, participants, connected, unread, clearUnread: () => setUnread(0), send };
}
