import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Config } from './config.js';
import type { Database } from './db.js';
import type { LiveKitService } from './services/livekit.js';
import { NotificationMailer } from './services/notification-mailer.js';
import { publicRoutes } from './routes/public.js';
import { adminRoutes } from './routes/admin.js';
import { errorHandler, notFound } from './http/errors.js';
import { asyncHandler } from './http/async-handler.js';

export function createApp(db: Database, config: Config, livekit: LiveKitService, mailer = new NotificationMailer(config)) {
  const app = express(); app.disable('x-powered-by'); if (config.TRUST_PROXY !== 'false') app.set('trust proxy', config.TRUST_PROXY === 'true' ? 1 : config.TRUST_PROXY);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } })); app.use(cors({ origin: config.WEB_ORIGIN, credentials: true, methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-CSRF-Token'] })); app.use(express.json({ limit: '32kb', type: ['application/json','text/plain'] })); app.use(cookieParser());
  const generalLimit = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }); const joinLimit = rateLimit({ windowMs: 60_000, limit: 15, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many join attempts. Wait a moment and try again.' } } }); const loginLimit = rateLimit({ windowMs: 15*60_000, limit: 10, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'LOGIN_RATE_LIMITED', message: 'Too many sign-in attempts. Try again later.' } } });
  app.use('/api', generalLimit); app.use('/api/rooms/:roomId/join', joinLimit); app.use('/api/admin/login', loginLimit);
  app.get('/api/health', asyncHandler(async (_req, res) => { await db.query('SELECT 1'); res.json({ status: 'ok', service: 'studyroom-api', features: { emailReminders: mailer.configured, emailProvider: mailer.provider, emailStatus: mailer.status }, timestamp: new Date().toISOString() }); }));
  app.use('/api', publicRoutes(db, livekit, mailer, config)); app.use('/api/admin', adminRoutes(db, config, livekit)); app.use(notFound); app.use(errorHandler); return app;
}
