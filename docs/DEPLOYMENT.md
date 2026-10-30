# Deploy StudyRoom on Render and Vercel

StudyRoom has four production components:

- **Vercel** serves the Vite/React app from `apps/web/dist`.
- **Render** runs the long-lived Express API and its `/ws` WebSocket endpoint.
- **Supabase Postgres** stores rooms, administrator sessions, guest sessions, and invitation records.
- **LiveKit Cloud** provides browser-reachable WebRTC signaling and media over HTTPS/WSS.

The checked-in `vercel.json` and `render.yaml` are configured for this split. Never put database, LiveKit secret, SMTP, or administrator credentials in Vercel variables prefixed with `VITE_`; every `VITE_` value is public browser code.

## 1. Put the project in Git

Vercel and Render can both deploy from the same GitHub repository. This checkout is already connected to `origin`; verify the remote points to the intended private repository before deploying. For a new checkout, the equivalent setup is:

```bash
git init
git add .
git commit -m "Prepare StudyRoom for Render and Vercel"
git branch -M main
git remote add origin YOUR_PRIVATE_GITHUB_REPOSITORY
git push -u origin main
```

Review the staged files before committing. `.env.local`, build output, and dependencies are already ignored and must stay private.

## 2. Create LiveKit Cloud credentials

Create a LiveKit Cloud project and keep these three values ready for Render:

- `LIVEKIT_URL`: the project WebSocket URL, beginning with `wss://`
- `LIVEKIT_API_KEY`: the server API key
- `LIVEKIT_API_SECRET`: the matching server secret

The browser receives only a short-lived participant token and the public WSS URL. It must never receive the API secret.

## 3. Create and secure the Supabase database

1. Create a Supabase project and save its database password in a password manager.
2. In the project dashboard, select **Connect** and copy the **Session pooler** connection string. Render is a persistent, IPv4-hosted backend, so the session pooler is the most compatible choice. Replace the password placeholder with the URL-encoded database password.
3. Keep this connection string server-only. StudyRoom does not need a Supabase URL, publishable key, anon key, or service-role key because the React client never talks directly to the database.
4. The checked-in migration `006_supabase_privacy.sql` enables RLS and revokes `anon`/`authenticated` access to every StudyRoom table. Do not add public policies for `guest_sessions`; it contains private email and WhatsApp data.

Use these API environment values:

- `DATABASE_URL`: the Supabase Session pooler connection string
- `MIGRATION_DATABASE_URL`: a Direct connection string when your runtime supports IPv6, otherwise the same Session pooler string
- `DATABASE_SSL=true`
- `DATABASE_POOL_MAX=10`

After the first migration, `guest_sessions.email`, `guest_sessions.whatsapp_number`, and `guest_sessions.whatsapp_consent` hold the optional contact details submitted during join. The API returns only capability flags to meeting participants, never either contact value.

## 4. Deploy the API on Render

1. In Render, choose **New > Blueprint** and connect the repository.
2. Render detects the root `render.yaml` and creates `studyroom-api` in Singapore.
3. Supply the prompted values:
   - `WEB_ORIGIN`: the exact final Vercel production origin, for example `https://studyroom-example.vercel.app` (you can temporarily enter the expected Vercel project URL and correct it after the first Vercel deploy).
   - `DATABASE_URL`
   - `MIGRATION_DATABASE_URL`
   - `LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
4. Deploy the Blueprint. The API build compiles the shared package and API; startup applies every unapplied migration before starting Express.
5. Confirm `https://YOUR-RENDER-SERVICE.onrender.com/api/health` returns HTTP 200 and JSON with `"status":"ok"`.
6. In a private Render Shell, run `npm run supabase:check`. It verifies the connection, contact columns, and RLS without printing credentials or guest data.

The Blueprint intentionally uses one API instance because StudyRoom's WebSocket hub is process-local. Do not scale beyond one instance until realtime fan-out is backed by Redis, NATS, or another shared pub/sub service.

### Free service limits

The Blueprint starts with Render's `free` web plan so it can be tested without an initial charge. The service can spin down when idle. Review Supabase project limits, backups, and pause behavior separately before using the app for important or long-lived rooms.

If you use a paid Render web plan, you can move `npm run db:migrate` from `startCommand` to a Render pre-deploy command. The current idempotent startup command also works on the free plan.

## 5. Deploy the frontend on Vercel

1. In Vercel, choose **Add New > Project** and import the same repository.
2. Keep the repository root as the Vercel Root Directory. `vercel.json` supplies the Vite build and `apps/web/dist` output path.
3. Add one Production environment variable:
   - `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com`
4. Update the `/api/:path*` destination in `vercel.json` if your Render service URL differs from the checked-in URL, then deploy. Vercel forwards browser HTTP API requests to Render under the Vercel origin so administrator cookies remain first-party. The SPA rewrite keeps `/room/...` and `/admin/...` working on refresh.
5. Copy the final Vercel production origin back into Render's `WEB_ORIGIN` and redeploy/restart the API if it changed.

`VITE_API_URL` is compiled into the frontend for its direct Render WebSocket connection. Changing it or the HTTP proxy destination requires a new Vercel deployment.

## 6. Create the first administrator

### Free Render service (no Shell access)

In **Render > studyroom-api > Environment**, add these two temporary secret values:

- `ADMIN_BOOTSTRAP_USERNAME=admin`
- `ADMIN_BOOTSTRAP_PASSWORD` set to a new private password with at least 12 characters

Create them as two separate Render environment variables. Use the exact uppercase names, do not add quotes around dashboard values, and make sure neither value is empty. If either value is missing or too short, startup skips bootstrap with a warning and continues serving the API; correct the values and deploy again to create the administrator.

Save the environment and deploy the latest commit. The startup command applies migrations, creates or resets that administrator in the same database used by the API, and then starts the service. In the deployment logs, confirm this message appears:

```text
Administrator “admin” is ready. The password was not logged.
```

After confirming that login works, remove both temporary variables from Render and redeploy. The administrator remains in PostgreSQL. Keeping the variables would reset its password to the same value on every service restart.

### Render service with Shell access

Open a private Render Shell for `studyroom-api` and run the bootstrap command with temporary environment variables. Do not commit or paste the password into source files:

```bash
ADMIN_BOOTSTRAP_USERNAME=admin \
ADMIN_BOOTSTRAP_PASSWORD='use-a-long-unique-password' \
npm run admin:bootstrap
```

The bootstrap command hashes the password before storage.

## 7. Optional email reminders

Add these only to the Render API service, never to Vercel:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` (optional)

For Gmail, use `smtp.gmail.com`, port `465`, `SMTP_SECURE=true`, the full Gmail address, and a Google App Password. A copied App Password may contain display spaces; the API removes those spaces only for Gmail. After saving the variables, restart or redeploy the Render service. The public health response will show `"emailReminders": true` when all required SMTP variables are present.

If the Render plan includes Shell access, run `npm run smtp:check`; this verifies the connection without sending an email. On a free service without Shell access, first check `https://YOUR-RENDER-SERVICE.onrender.com/api/health`, then perform one deliberate inbox test from the meeting People panel. The health flag proves configuration presence, not Gmail authentication or delivery.

## 8. Production verification

Verify each boundary separately:

1. Render `/api/health` returns 200.
2. `npm run supabase:check` succeeds from Render and Supabase Table Editor shows the migrated tables with RLS enabled.
3. Vercel `/`, `/admin/login`, and a direct `/room/...` refresh return the React app rather than 404.
4. Administrator login works, a room can be created, and its invitation opens on the Vercel domain.
5. Join once with an email and opted-in WhatsApp number; verify one `guest_sessions` row contains the normalized values. Do not expose this verification screenshot publicly.
   Also verify that `guest_profiles` contains one person and that repeat joins increase the join count in **Admin → Unique guests** without adding another profile.
6. Two separate browser profiles can join the same room and see/hear each other through LiveKit.
7. Chat updates over `wss://YOUR-RENDER-SERVICE.onrender.com/ws`.
8. Camera, microphone, and screen-share permissions work on HTTPS.
9. If SMTP is configured, run the non-sending check first and then perform a deliberate inbox test.

A successful build or a green platform deployment does not prove database access, WebSocket chat, LiveKit media, or SMTP delivery. Keep these checks in the release routine.

## Custom-domain recommendation

For the most reliable administrator session behavior, put the frontend and API under the same registrable domain, such as `app.example.com` on Vercel and `api.example.com` on Render. The code also sets production cookies to `Secure; SameSite=None` so the default `vercel.app` and `onrender.com` split can work in browsers that permit cross-site credential cookies.

## Network and scaling notes

- Vercel and Render terminate public TLS on port 443.
- Render must preserve WebSocket upgrades for `/ws`; its web service does this automatically.
- LiveKit Cloud provides WSS and media networking. If LiveKit is self-hosted instead, expose the exact TCP/UDP/TURN ports from its deployment configuration.
- Keep Supabase connection strings only in Render's secret environment. Never add them to Vercel or a `VITE_` variable.
- Schedule `SELECT cleanup_studyroom_data();` periodically and define a retention policy for old guest sessions.
