# Security and privacy

## Implemented controls

- No participant registration, email, phone, or verified real-world identity
- Private administrator provisioning with scrypt password hashing
- Opaque, revocable, expiring administrator sessions in HTTP-only SameSite cookies
- CSRF cookie/header validation on every administrator mutation
- Backend authorization on every administration endpoint
- Cryptographically random invitation, guest identity, session, and waiting tokens
- One-way SHA-256 lookup hashes for session tokens at rest
- 15-minute room-scoped LiveKit guest tokens
- Server-selected room, identity, role metadata, and publish-source permissions (screen share is omitted when disabled)
- Transactional room-capacity checks and locked waiting-room approval
- Zod input validation and request-body limits
- Strict browser-origin CORS and WebSocket Origin checks
- Helmet security headers and request/login/join/realtime rate limits
- Generic production errors without stack traces or secrets
- Five-minute stale guest cleanup and revocable room closure

Camera and microphone tracks are sent through the configured LiveKit deployment after explicit browser permission. StudyRoom does not record meetings. The current chat channel is ephemeral and kept in process memory only long enough to broadcast each event. Guest session rows are pseudonymous and should be periodically removed according to the operator's retention policy.

## Production checklist

- Use HTTPS/WSS everywhere and `NODE_ENV=production` so cookies are Secure.
- Replace all development credentials; store secrets in the hosting platform's secret manager.
- Set `WEB_ORIGIN` to one exact trusted origin.
- Restrict PostgreSQL network access to the API service.
- Put LiveKit behind TLS and configure TURN/TLS for restrictive networks.
- Run one realtime API instance or add a shared pub/sub adapter before horizontal scaling.
- Schedule `SELECT cleanup_studyroom_data();` at least every five minutes.
- Review dependency advisories in a network-enabled CI job.
- Add audit logs if administrator accountability is required; do not log guest tokens or media credentials.

