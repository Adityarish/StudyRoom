import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { createApp } from './app.js';
import { LiveKitService } from './services/livekit.js';
import { createRealtimeServer } from './realtime.js';
import { NotificationMailer } from './services/notification-mailer.js';

const config = loadConfig(); const db = createPool(config); const livekit = new LiveKitService(config); const mailer = new NotificationMailer(config); const app = createApp(db, config, livekit, mailer); const server = createServer(app); const realtime = createRealtimeServer(db, config);
server.on('upgrade', realtime.handleUpgrade); server.listen(config.PORT, () => console.log(`StudyRoom API listening on http://localhost:${config.PORT}`));
async function shutdown(signal: string) { console.log(`${signal}: shutting down`); realtime.wss.clients.forEach(client => client.close(1012, 'Server restarting')); server.close(async () => { await db.end(); process.exit(0); }); setTimeout(() => process.exit(1), 10_000).unref(); }
process.on('SIGTERM', () => void shutdown('SIGTERM')); process.on('SIGINT', () => void shutdown('SIGINT'));
