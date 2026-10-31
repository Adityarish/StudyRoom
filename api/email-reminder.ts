import { createHash, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelResponse {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: unknown): void;
}

interface Reminder {
  to: string;
  targetName: string;
  requesterName: string;
  roomName: string;
  roomUrl: string;
}

function normalizeSmtpPassword(host: string, password: string) {
  return host.toLowerCase() === 'smtp.gmail.com' ? password.replace(/\s+/g, '') : password;
}

function relayCredential(password: string) {
  return createHash('sha256').update(`studyroom-email-relay-v1\0${password}`).digest('hex');
}

function headerValue(request: VercelRequest, name: string) {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function singleLine(value: string) { return value.replace(/[\r\n]+/g, ' ').trim(); }
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function isReminder(value: unknown): value is Reminder {
  if (!value || typeof value !== 'object') return false;
  const reminder = value as Record<string, unknown>;
  if (typeof reminder.to !== 'string' || reminder.to.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reminder.to)) return false;
  for (const field of ['targetName', 'requesterName', 'roomName'] as const) {
    if (typeof reminder[field] !== 'string' || reminder[field].length < 1 || reminder[field].length > 120) return false;
  }
  if (typeof reminder.roomUrl !== 'string' || reminder.roomUrl.length > 2048) return false;
  try { return new URL(reminder.roomUrl).protocol === 'https:'; } catch { return false; }
}

function parseBody(body: unknown) {
  if (typeof body !== 'string') return body;
  try { return JSON.parse(body) as unknown; } catch { return null; }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
    return;
  }

  const host = process.env.SMTP_HOST?.trim() ?? '';
  const port = Number(process.env.SMTP_PORT ?? 0);
  const user = process.env.SMTP_USER?.trim() ?? '';
  const rawPassword = process.env.SMTP_PASS ?? '';
  const password = normalizeSmtpPassword(host, rawPassword);
  const from = process.env.SMTP_FROM?.trim() || `StudyRoom <${user}>`;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password) {
    response.status(503).json({ error: { code: 'EMAIL_RELAY_NOT_CONFIGURED' } });
    return;
  }

  const suppliedKey = headerValue(request, 'x-studyroom-relay-key') ?? '';
  if (!secureEqual(suppliedKey, relayCredential(password))) {
    response.status(401).json({ error: { code: 'EMAIL_RELAY_UNAUTHORIZED' } });
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || (process.env.SMTP_SECURE !== 'false' && port === 465),
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  const body = parseBody(request.body);

  try {
    if (body && typeof body === 'object' && (body as { action?: unknown }).action === 'verify') {
      await transporter.verify();
      response.status(200).json({ status: 'ready' });
      return;
    }

    const payload = body as { action?: unknown; reminder?: unknown } | null;
    if (!payload || payload.action !== 'send' || !isReminder(payload.reminder)) {
      response.status(400).json({ error: { code: 'INVALID_EMAIL_REMINDER' } });
      return;
    }

    const reminder = payload.reminder;
    const result = await transporter.sendMail({
      from,
      to: reminder.to,
      subject: `${singleLine(reminder.requesterName)} is waiting for you in ${singleLine(reminder.roomName)}`,
      text: `Hi ${reminder.targetName},\n\n${reminder.requesterName} asked you to return to “${reminder.roomName}”.\n\nJoin the room: ${reminder.roomUrl}\n\nThis reminder was sent because you added your email when joining StudyRoom.`,
      html: `<p>Hi ${escapeHtml(reminder.targetName)},</p><p><strong>${escapeHtml(reminder.requesterName)}</strong> asked you to return to <strong>${escapeHtml(reminder.roomName)}</strong>.</p><p><a href="${escapeHtml(reminder.roomUrl)}">Return to the study room</a></p><p style="color:#667085;font-size:12px">This reminder was sent because you added your email when joining StudyRoom.</p>`,
    });
    console.log('StudyRoom email reminder accepted by the SMTP provider.');
    response.status(200).json({ messageId: result.messageId });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error && typeof error.code === 'string' && /^[A-Z0-9_-]{1,40}$/i.test(error.code)
      ? error.code
      : 'EMAIL_DELIVERY_FAILED';
    console.error('StudyRoom email relay failed.', { code });
    response.status(502).json({ error: { code } });
  } finally {
    transporter.close();
  }
}
