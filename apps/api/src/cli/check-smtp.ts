import { loadConfig } from '../config.js';
import { NotificationMailer } from '../services/notification-mailer.js';

const mailer = new NotificationMailer(loadConfig());
if (!mailer.configured) {
  console.error('SMTP is not configured. Add the SMTP variables to the private environment.');
  process.exitCode = 1;
} else {
  try { await mailer.verify(); console.log('SMTP credentials and connection were accepted. No email was sent.'); }
  catch { console.error('SMTP connection or authentication was rejected. Check the private SMTP settings.'); process.exitCode = 1; }
}
