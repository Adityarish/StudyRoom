# StudyRoom

StudyRoom is a login-free video conferencing platform for study groups. Guests join from a private room link with only a display name and locally bundled avatar. Administrators are provisioned privately and manage room capacity, expiry, waiting rooms, passwords, chat, screen sharing, participants, and direct room deletion.

The application is a TypeScript monorepo:

- `apps/web`: React, Vite, React Router, LiveKit client, responsive interface
- `apps/api`: Express, PostgreSQL, LiveKit server tokens, WebSocket realtime channel
- `packages/shared`: shared validation schemas and API types
- `database/migrations`: versioned PostgreSQL schema and cleanup function
- `docs`: architecture, setup, deployment, security, and performance guidance

## Quick start

Requirements: Node.js 20+, npm, and Docker Desktop (or your own PostgreSQL and LiveKit services).

The local launcher starts Docker services, waits for PostgreSQL, runs migrations, and starts both development servers:

```bash
python3 run.py
```

On the first run, create the administrator with the private values already stored in `.env.local`:

```bash
python3 run.py --bootstrap-admin
```

Use `python3 run.py --help` for external-service and preparation-only options.

The equivalent manual commands are:

```bash
cp .env.example .env.local
docker compose up -d
npm install
npm run db:migrate
ADMIN_BOOTSTRAP_USERNAME=admin ADMIN_BOOTSTRAP_PASSWORD='use-a-long-private-password' npm run admin:bootstrap
npm run dev
```

Open `http://localhost:5173`. The private administrator page is `http://localhost:5173/admin/login`.

The local LiveKit development server uses API key `devkey` and secret `secret`. Set those only in `.env.local`; production must use new strong credentials and HTTPS/WSS.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Playwright requires an installed Chromium browser. Real two-browser audio/video verification additionally requires working camera/microphone devices or configured virtual media devices.

See [local setup](docs/SETUP.md), [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), [performance](docs/PERFORMANCE.md), and the step-by-step [Render + Vercel deployment guide](docs/DEPLOYMENT.md).
