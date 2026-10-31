# Architecture

## Request boundaries

The browser never receives PostgreSQL credentials, a Supabase service-role key, a LiveKit API secret, or an administrator password hash. The Vite application uses the public Supabase client for user authentication and calls the Express API through a single configured origin. Express verifies the Supabase access token during join, remains the only database client, and is the only LiveKit token issuer.

Guest flow:

1. A public invitation ID resolves to a safe room projection.
2. The guest selects a name, local avatar, device state, and quality preference.
3. The API locks the room row and checks status, expiry, password, and capacity.
4. It creates a random server identity plus an opaque guest session token.
5. Waiting-room guests poll with a separate one-way-hashed request token.
6. Approved guests receive a 15-minute LiveKit token scoped to the server-selected LiveKit room.
7. Heartbeats and explicit leave events update presence; stale sessions age out after five minutes.

The browser keeps the application guest session for the current tab and resumes it after a page refresh. Resume issues a fresh short-lived LiveKit token while retaining the original `joined_at` time, so the meeting timer and logical participant do not reset. Only the explicit **Leave** action ends the application session; closing or refreshing a page is handled by heartbeat expiry and LiveKit presence. A database invariant permits only one active session per profile in a room, and a new join retires and removes any older connection for that profile.

Administrator flow:

1. `admin:bootstrap` creates or rotates a private scrypt-hashed identity.
2. Login issues an opaque session in an HTTP-only SameSite cookie and a separate CSRF token.
3. Every mutation requires database-backed session authorization and a matching cookie/header CSRF token.
4. Closing or deleting a room terminates its LiveKit room and invalidates active database sessions.

## Realtime media and messaging

LiveKit carries WebRTC camera, microphone, and screen tracks. The client enables adaptive streaming, simulcast layers, and dynacast. Remote publication quality is raised for the active/pinned speaker and reduced for small tiles. Audio-only mode stops the local camera and unsubscribes remote video tracks.

For larger calls, non-primary remote tiles step down from high to medium and then low layers as participant count grows. This keeps every participant subscribed while protecting the bandwidth needed for audio and the active speaker.

Each remote camera tile has private viewer controls. A participant can change only that person's playback volume, mute them locally, hide/show their video, or pin them. These preferences stay in the current tab across refresh and are never broadcast to the room. Speaker view attaches remote audio in exactly one rendered tile to avoid duplicate playback.

Chat, reactions, and hand raises use the API WebSocket at `/ws`, not guest-controlled LiveKit data packets. The first WebSocket frame authenticates the hashed guest session. The server supplies the sender identity, validates content, applies a per-connection burst limit, and broadcasts only within that room. Messages are ephemeral and are not replayed after a session.

## Data model

- `administrators`, `admin_sessions`: private administrator identity and revocable sessions
- `study_rooms`: invitation identity, policy, LiveKit mapping, lifecycle, and owner
- `guest_sessions`: temporary pseudonymous identity, approval, presence, and one-way token hashes
- `chat_messages`: reserved for a future opt-in persistent chat mode; current chat is ephemeral

All public IDs and tokens use cryptographically secure random bytes. Internal rows use UUIDs.
