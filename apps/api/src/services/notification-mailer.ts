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

export class NotificationMailer {
  private transporter: Transporter | null = null;
  readonly configured: boolean;

  constructor(private config: Config) {
    this.configured = Boolean(config.SMTP_HOST && config.SMTP_PORT && config.SMTP_USER && config.SMTP_PASS);
    if (this.configured) {
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE ?? config.SMTP_PORT === 465,
        auth: { user: config.SMTP_USER, pass: normalizeSmtpPassword(config.SMTP_HOST, config.SMTP_PASS) },
      });
    }
  }

  async verify() {
    if (!this.transporter) throw new Error('SMTP is not configured.');
    await this.transporter.verify();
  }

  async sendReminder(input: ReminderInput) {
    if (!this.transporter || !this.config.SMTP_USER) throw new Error('SMTP is not configured.');
    const target = escapeHtml(input.targetName); const requester = escapeHtml(input.requesterName); const room = escapeHtml(input.roomName); const url = escapeHtml(input.roomUrl);
    await this.transporter.sendMail({
      from: this.config.SMTP_FROM ?? `StudyRoom <${this.config.SMTP_USER}>`,
      to: input.to,
      subject: `${singleLine(input.requesterName)} is waiting for you in ${singleLine(input.roomName)}`,
      text: `Hi ${input.targetName},\n\n${input.requesterName} asked you to return to “${input.roomName}”.\n\nJoin the room: ${input.roomUrl}\n\nThis reminder was sent because you added your email when joining StudyRoom.`,
      html: `<p>Hi ${target},</p><p><strong>${requester}</strong> asked you to return to <strong>${room}</strong>.</p><p><a href="${url}">Return to the study room</a></p><p style="color:#667085;font-size:12px">This reminder was sent because you added your email when joining StudyRoom.</p>`,
    });
  }
}
