import nodemailer, { type Transporter } from 'nodemailer';
import type { Config } from '../config.js';

export interface ReminderInput {
  to: string;
  targetName: string;
  requesterName: string;
  roomName: string;
  roomUrl: string;
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function singleLine(value: string) { return value.replace(/[\r\n]+/g, ' ').trim(); }

export function normalizeSmtpPassword(host: string | undefined, password: string | undefined) {
  if (!password) return password;
  return host?.toLowerCase() === 'smtp.gmail.com' ? password.replace(/\s+/g, '') : password;
}

export type EmailProvider = 'smtp' | 'none';
export type EmailDeliveryStatus = 'unconfigured' | 'unchecked' | 'checking' | 'ready' | 'error';

class EmailProviderError extends Error {
  constructor(readonly code: string) { super(code); }
}

export function emailErrorCode(error: unknown) {
  if (error instanceof EmailProviderError) return error.code;
  if (typeof error === 'object' && error) {
    const value = error as { code?: unknown; responseCode?: unknown };
    if (typeof value.code === 'string' && /^[A-Z0-9_-]{1,40}$/i.test(value.code)) return value.code;
    if (typeof value.responseCode === 'number') return `SMTP_${value.responseCode}`;
  }
  return 'UNKNOWN';
}

export class NotificationMailer {
  private transporter: Transporter | null = null;
  readonly configured: boolean;
  readonly provider: EmailProvider;
  status: EmailDeliveryStatus;

  constructor(private config: Config) {
    const smtpConfigured = Boolean(config.SMTP_HOST && config.SMTP_PORT && config.SMTP_USER && config.SMTP_PASS);
    this.provider = smtpConfigured ? 'smtp' : 'none';
    this.configured = this.provider !== 'none';
    this.status = this.configured ? 'unchecked' : 'unconfigured';
    if (this.provider === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE ?? config.SMTP_PORT === 465,
        auth: { user: config.SMTP_USER, pass: normalizeSmtpPassword(config.SMTP_HOST, config.SMTP_PASS) },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
    }
  }

  async verify() {
    if (!this.configured) throw new EmailProviderError('EMAIL_NOT_CONFIGURED');
    this.status = 'checking';
    try {
      await this.transporter!.verify();
      this.status = 'ready';
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  async sendReminder(input: ReminderInput) {
    if (!this.configured) throw new EmailProviderError('EMAIL_NOT_CONFIGURED');
    try {
      const target = escapeHtml(input.targetName); const requester = escapeHtml(input.requesterName); const room = escapeHtml(input.roomName); const url = escapeHtml(input.roomUrl);
      const result = await this.transporter!.sendMail({
        from: this.config.SMTP_FROM ?? `StudyRoom <${this.config.SMTP_USER}>`,
        to: input.to,
        subject: `${singleLine(input.requesterName)} is waiting for you in ${singleLine(input.roomName)}`,
        text: `Hi ${input.targetName},\n\n${input.requesterName} asked you to return to “${input.roomName}”.\n\nJoin the room: ${input.roomUrl}\n\nThis reminder was sent because you added your email when joining StudyRoom.`,
        html: `<p>Hi ${target},</p><p><strong>${requester}</strong> asked you to return to <strong>${room}</strong>.</p><p><a href="${url}">Return to the study room</a></p><p style="color:#667085;font-size:12px">This reminder was sent because you added your email when joining StudyRoom.</p>`,
      });
      this.status = 'ready';
      return { messageId: result.messageId };
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }
}
