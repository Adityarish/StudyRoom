# Local setup

## 1. Start infrastructure

```bash
docker compose up -d
docker compose ps
```

This starts PostgreSQL on `localhost:5432` and LiveKit on `localhost:7880`, including TCP/UDP media port `7882`.

When started through `python3 run.py`, the launcher passes `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` from the private root environment to the self-hosted LiveKit container. It recreates the video container and verifies the credentials before opening the app, without logging either private value.

## 2. Configure the environment

Copy `.env.example` to `.env.local` (or `.env`). Keep it private. The API loads a root environment file automatically, while `VITE_API_URL` is read by Vite from the root shell or `apps/web/.env.local`. The default API URL already points to `http://localhost:4000`, so no frontend file is required for the standard local ports.

| Variable | Purpose | Local value/source |
| --- | --- | --- |
| `VITE_API_URL` | API origin compiled into the browser | `http://localhost:4000` |
| `NODE_ENV` | cookie/security behavior | `development` |
| `PORT` | Express port | `4000` |
| `WEB_ORIGIN` | exact allowed browser origin | `http://localhost:5173` |
| `DATABASE_URL` | server-only PostgreSQL DSN | Compose value from `.env.example` |
| `MIGRATION_DATABASE_URL` | optional direct/session-pooler migration DSN | Supabase **Connect** dialog; leave empty for local Compose |
| `DATABASE_SSL` | managed database TLS toggle | `false` locally |
| `DATABASE_POOL_MAX` | maximum API-side PostgreSQL connections | `10` for one Render instance |
| `SESSION_SECRET` | reserved application secret | `openssl rand -base64 48` |
| `LIVEKIT_URL` | browser-reachable WebSocket URL | `ws://localhost:7880` |
| `LIVEKIT_API_KEY` | server token issuer key | `devkey` locally |
| `LIVEKIT_API_SECRET` | server-only token issuer secret | `secret` locally; strong random value in production |
| `SMTP_HOST` | optional reminder-email SMTP server | `smtp.gmail.com` for Gmail |
| `SMTP_PORT` | SMTP port | `465` for encrypted Gmail SMTP |
| `SMTP_SECURE` | use TLS immediately | `true` with port `465` |
| `SMTP_USER` | server-only SMTP login | full Gmail address or provider username |
| `SMTP_PASS` | server-only SMTP password | Google App Password or provider credential; never the normal Gmail password |
| `SMTP_FROM` | optional From header | for example `StudyRoom <your-address@gmail.com>` |
| `TRUST_PROXY` | Express proxy trust | `false` locally; normally `true` behind one controlled proxy |

Never prefix server secrets with `VITE_`; Vite variables are public browser code.

### Supabase Postgres setup

StudyRoom uses Supabase only as server-side Postgres. It does not use the browser Supabase SDK, so do not add a project URL, anon key, publishable key, or service-role key to the web app.

1. Open the Supabase project, select **Connect**, and copy the Session pooler URI for an IPv4-hosted API such as Render.
2. Put that URI in the ignored root `.env.local` as `DATABASE_URL`. Set `DATABASE_SSL=true`. For migrations, set `MIGRATION_DATABASE_URL` to the Direct URI when IPv6 is available, or reuse the Session pooler URI.
3. Run `npm run db:migrate`, then `npm run supabase:check`.
4. In **Table Editor > guest_sessions**, the optional `email`, `whatsapp_number`, and `whatsapp_consent` columns are populated atomically by the join request. WhatsApp numbers are normalized to `91XXXXXXXXXX`; contact values are never returned to other guests.
5. Keep RLS enabled with no browser policies. Migration `006_supabase_privacy.sql` also revokes the `anon` and `authenticated` roles, because all access goes through the Express API.

The join is transactional: a meeting session is not created unless its contact fields are stored successfully in the same insert. If the room uses a waiting room, the row is stored when the guest requests entry and reused after approval.

### Optional email reminders

Participants may enter an email on the pre-join screen. The address remains on the API/database side and is never returned to other participants. If that participant disconnects, active meeting members can open **Participants** and press **Notify**. Reminders are limited to one email per target every 10 minutes.

For Gmail, enable 2-Step Verification, create a Google App Password, and place the SMTP values only in the ignored root `.env.local` file. Do not use or share the normal Gmail password. Verify the connection without sending an email:

```bash
npm run smtp:check
```

SMTP is optional; meetings continue to work when it is not configured, but the Notify action will not be offered.

### Optional WhatsApp invitations

WhatsApp invitations use the free official Click-to-Chat URL (`https://wa.me/`) and require no Meta account, API token, webhook, template, or extra environment variable.

1. A participant optionally enters an Indian WhatsApp number and explicitly opts in on the pre-join screen. StudyRoom stores the normalized `91XXXXXXXXXX` contact in PostgreSQL.
2. After creating a room, the administrator is shown **Notify on WhatsApp** and can select one or more opted-in contacts. Active meeting participants can also open **WhatsApp** in the room header and select opted-in room members.
3. StudyRoom records each generated invitation as `prepared`. Each recipient has an individual **Open WhatsApp** button that opens WhatsApp Web or the installed app with a personalized message.
4. The host must press **Send** in WhatsApp. Clicking the button updates the record only to `opened_whatsapp`; StudyRoom never marks a Click-to-Chat invitation `sent` or `delivered` because it cannot verify either state.

Run `npm run db:migrate` after updating so migration `005_whatsapp_click_to_chat.sql` adds the opt-in contact fields and invitation audit table.

## 3. Prepare the database and administrator

```bash
npm install
npm run db:migrate
ADMIN_BOOTSTRAP_USERNAME=admin \
ADMIN_BOOTSTRAP_PASSWORD='a-long-unique-private-password' \
npm run admin:bootstrap
```

Bootstrap values are read only by the command. They are not returned to the browser or logged.

## 4. Run

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/api/health`
- Admin: `http://localhost:5173/admin/login`

Browsers allow camera and microphone access on `localhost`. For another device, use HTTPS; insecure LAN HTTP origins will usually be denied media access.

## 5. Test two participants on one computer

1. Sign in as the administrator, create a room, and disable the waiting room for the first media test.
2. Open the invitation in a normal Chrome window as participant A. Enable the camera and microphone, then join.
3. Open the same invitation in a Chrome Incognito window as participant B. Use a different display name and join with camera and microphone off.
4. Participant B should see participant A's remote video and both windows should show two participants. Send chat messages from both windows to verify the room-scoped realtime channel and compact avatars.
5. To test the opposite direction, turn participant A's camera off before enabling participant B's camera. One physical camera may not be available to two browser contexts simultaneously.

Keep one window muted, or use headphones, to prevent audio feedback. If the waiting room is enabled, approve the second participant from the admin dashboard before expecting the second meeting tile.

## Troubleshooting

- Vite `431 Request Header Fields Too Large`: the launcher raises the local Node.js header limit to 64 KiB. Stop the existing process with `Ctrl+C`, rerun `python3 run.py`, and clear cookies/site data for `localhost` if an unusually large stale cookie still exceeds that limit. This development allowance is not applied to production.
- `ROOM_NOT_FOUND`: use the full generated invitation ID, not the internal database UUID.
- Camera denied: reset the site's browser permissions, reload, and use the preview control.
- LiveKit cannot connect: confirm `7880/tcp` and `7882/tcp+udp` are reachable and `LIVEKIT_URL` is browser-accessible.
- LiveKit reports `Failed` immediately: stop the launcher, rerun `python3 run.py` so Compose recreates LiveKit with the configured credentials, then leave and rejoin to obtain a new short-lived meeting token.
- Remote video absent: two tabs on one machine may compete for the same camera. Use a second device or a virtual camera.
- Database errors: check `docker compose ps`, then rerun `npm run db:migrate`.
