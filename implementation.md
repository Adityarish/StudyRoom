# MASTER PROMPT: Build StudyRoom — A High-Quality, Login-Free Video Conferencing and Study Room Platform

## 1. Role and Objective

Act as a senior full-stack engineer, WebRTC specialist, performance engineer, UI/UX designer, and application security architect.

Build a complete, working web application called **StudyRoom**, inspired by the usability of Google Meet but with original branding, an efficient video engine, and features designed specifically for students.

The application must support real-time, multi-participant video and audio, guest access without login, administrator-controlled room creation, shareable room links, customizable avatars, real-time chat, and high video quality.

This is an implementation task, not a UI prototype. Create the actual application, implement the backend and database, integrate real video calling, test the functionality, and document deployment.

Do not stop after creating a plan, landing page, static mockup, or placeholder buttons.

## 2. Mandatory Access Requirements

**No login or registration is required for participants.**

Guests must be able to:
- Open a shared study-room link.
- Enter a display name.
- Select an avatar.
- Optionally choose an avatar presentation preference, including gender presentation, without making gender mandatory.
- Preview and configure their camera and microphone.
- Join the room without an account.
- Chat, participate in video calls, share their screen when permitted, and leave whenever they want.

Do not create:
- A public signup page.
- A guest login page.
- A mandatory email-verification flow.
- A mandatory Google OAuth flow.
- A mandatory social-login flow.
- A participant account-creation requirement.

Guests must not be asked to provide an email address, password, phone number, or personal identity to join a room.

Administrator functionality is separate. Room creation and management must be protected by server-side administrator authorization. Do not add a public admin registration page or hardcode administrator credentials.

For initial administration, use a secure server-side bootstrap mechanism or a private administrative identity configured through environment variables. Guests should never need administrator credentials.

## 3. Technology Stack

Use the following stack unless the existing repository has a compelling compatibility constraint.

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Lucide React icons
- LiveKit React SDK
- LiveKit client SDK

### Backend
- Node.js
- TypeScript
- Express
- LiveKit server SDK
- Zod for validation
- Secure administrator session management

### Database
- PostgreSQL
- Supabase PostgreSQL or local PostgreSQL
- Database migrations
- Appropriate indexes, constraints, and access policies

### Real-Time Communication
- LiveKit for WebRTC audio and video
- LiveKit rooms and participant access tokens
- Adaptive streaming, simulcast, dynacast, and scalable video features where supported
- STUN/TURN configuration for reliable connectivity

### Testing
- Vitest
- React Testing Library
- Supertest
- Playwright

Verify compatibility with the actual installed package versions. Use documented APIs and avoid invented SDK methods.

The application must be capable of running locally and should support self-hosted open-source infrastructure wherever practical.

Do not expose database passwords, LiveKit API secrets, or privileged server credentials in frontend code.

## 4. Required Pages

### A. Landing page: `/`

Create a modern landing page with:
- StudyRoom branding
- Hero section with a clear value proposition
- "Join a Room" button
- Room-code or invitation-link input
- Feature cards
- Explanation of login-free guest access
- Video quality and low-resource mode highlights
- Responsive navigation and footer

The landing page must not require participants to authenticate.

### B. Administrator interface

Create a protected administrative dashboard for managing rooms.

Administrators can:
- Create rooms.
- Edit room information.
- Delete rooms.
- Create, edit, and permanently delete rooms.
- Generate invitation links.
- Set maximum participant counts.
- Configure waiting-room approval.
- Enable or disable chat.
- Enable or disable screen sharing.
- Set room expiration.
- View active participants where supported.
- Remove participants.
- End meetings.

Protect all administrative operations on the backend.

Do not rely on hidden buttons or frontend route protection alone.

### C. Guest pre-join page: `/room/:roomId`

Show:
- Room name and description.
- Guest display-name input.
- Avatar selector.
- Optional avatar presentation preference.
- Camera preview.
- Microphone toggle.
- Camera toggle.
- Available camera and microphone selection.
- Join button.
- Connection and permission error messages.

Do not require guest login.

Request camera and microphone permission only after the user interacts with the relevant controls or joins the meeting.

Allow users to join with the camera disabled or microphone muted.

Remember non-sensitive guest preferences locally when appropriate. Do not require an account to retain these preferences on the current device.

### D. Live meeting page: `/room/:roomId/live`

Build a complete, real-time video-conferencing interface.

Include:
- Responsive participant video grid.
- Speaker-focused layout.
- Participant names and avatars.
- Active-speaker highlighting where supported.
- Bottom control toolbar.
- Microphone mute/unmute.
- Camera on/off.
- Leave meeting.
- Participant list.
- Real-time chat.
- Screen sharing.
- Connection-quality indicator.
- Optional raise-hand and emoji reactions.
- Device settings.
- Fullscreen support.
- Mobile-friendly panels.

The local video preview must work. Remote video must come from real connected participants, not placeholder videos.

Handle connection failures, reconnecting, camera errors, missing devices, and permission denial.

## 5. High Video Quality Is a Core Requirement

The application must prioritize **clear, smooth, high-quality video**, while adapting to each participant's hardware and network.

Do not permanently restrict everyone to 360p simply to reduce resource consumption.

Implement a quality strategy with three user-selectable options:

### High Quality
- Prefer 1080p when the device, camera, network, and media server can support it.
- Support 720p as an appropriate fallback.
- Use a suitable frame rate, generally up to 30 fps where supported.
- Use appropriate bitrate targets based on the actual resolution, frame rate, codec, and network.
- Avoid unnecessary upscaling when the camera cannot produce the requested resolution.

### Balanced
- Prefer 720p for the local camera and important remote video.
- Adapt resolution and bitrate based on network conditions and video tile size.
- Prioritize stable playback over unnecessary maximum resolution.

### Low-Resource
- Prefer 360p or 480p when appropriate.
- Reduce remote video quality for small participant tiles.
- Preserve clear audio and responsive controls.
- Avoid expensive visual effects.

Allow participants to change quality settings during a meeting.

Use the selected quality as a preference, not a guarantee. Respect device limitations and network conditions.

### Local camera capture

Use the browser's supported media APIs and request an appropriate resolution and frame rate.

Implement sensible constraints for high-quality mode, such as 1280×720 or 1920×1080 at up to 30 fps, with fallbacks when unsupported.

Use actual camera capabilities to choose a valid configuration.

If a requested resolution fails, retry with lower supported constraints instead of failing the entire meeting.

Do not request 4K capture by default.

### Remote video quality

Configure LiveKit to use the appropriate supported features:
- Simulcast or scalable video.
- Adaptive stream subscriptions.
- Dynacast.
- Subscriber quality selection.
- Appropriate video layers for tile size and layout.
- Active-speaker prioritization where supported.
- Connection-quality reporting.
- Network-aware bitrate adaptation.

Use higher-quality streams for the active speaker or pinned participant where appropriate and lower-quality streams for small thumbnails.

Ensure these features are actually configured and functioning. Merely resizing the displayed video element is not adaptive streaming.

### Video codecs

Use compatible codecs supported by the selected SDK and target browsers.

Prefer efficient hardware-accelerated encoding and decoding where available, but provide compatibility fallbacks.

Do not assume that a specific codec is hardware-accelerated on every device.

### Screen sharing quality

Support readable screen sharing for lectures, coding, notes, and presentations.

Use an appropriate screen-share resolution and frame rate. Prefer a modest frame rate for mostly static content while preserving sufficient detail for text.

Allow users to stop sharing immediately.

## 6. Low CPU, GPU, Memory, and Battery Consumption

The application must aim to reduce unnecessary resource usage without sacrificing quality when sufficient resources are available.

Implement:

1. Efficient participant video tiles.
2. Adaptive video subscriptions.
3. Lower-quality layers for small or off-screen tiles where supported.
4. Audio-only mode.
5. Optional low-resource mode.
6. No virtual backgrounds or expensive video effects by default.
7. No continuous unnecessary animations.
8. Proper event-listener and media-track cleanup.
9. No unnecessary creation of camera streams.
10. Efficient React rendering.
11. Graceful handling of limited network bandwidth.
12. Immediate cleanup when leaving a meeting.

### Audio-only mode

When selected:
- Stop publishing the local camera track.
- Stop or reduce remote video subscriptions as appropriate.
- Preserve microphone audio.
- Keep chat functional.
- Allow video to be restored without requiring the participant to rejoin.

### Participant layouts

Implement:
- Grid view.
- Speaker view.
- Optional pinned-participant view.

Speaker view must reduce unnecessary video rendering and prioritize the active speaker. Use the SDK's actual subscription and quality controls where available.

Do not simulate performance optimization by hiding video elements while continuing to decode every stream unnecessarily.

Do not disable a participant's camera without their consent.

Do not claim that the application can read CPU temperature through ordinary browser APIs.

Measure CPU usage, memory consumption, frame rate, dropped frames, network bandwidth, and connection quality during testing. Compare performance only under equivalent conditions.

## 7. Guest Identity and Avatar System

Provide an original, attractive collection of illustrated avatars.

Features:
- Avatar grid.
- Avatar preview.
- Display-name input.
- Optional avatar presentation preferences.
- Default avatar.
- Avatar and name displayed when the camera is off.
- Safe handling of names and avatar identifiers.

Use locally bundled assets or appropriately licensed resources.

Do not depend on an external avatar API for basic functionality.

Do not use gender to determine access or infer personal characteristics.

Validate display names and enforce sensible length limits.

Generate a random guest identity on the server. Do not trust a guest-supplied role or identity to grant privileges.

Guest identities are temporary and must not be treated as verified real-world identities.

## 8. Shareable Invitation Links

Every room must have a unique invitation URL, for example:

`https://your-domain.example/room/UNPREDICTABLE_ROOM_ID`

Implement:
- Copy link.
- Native share support where available.
- Direct room navigation.
- Room-code entry.
- Guest pre-join screen.
- Expired-room handling.
- Closed-room handling.
- Invalid-room handling.

Invitation links must not grant administrator permissions.

Use cryptographically secure room identifiers.

Support optional room passwords or waiting-room approval for private groups. These features must be enforced on the server.

Do not require participant registration or email verification.

## 9. Administrator-Only Room Creation

Only authorized administrators may create, edit, close, or delete rooms.

Use a secure server-side administrator authentication mechanism. This is not guest login.

Possible implementation:
- A private administrator identity provisioned through a secure bootstrap command.
- Secure administrator sessions.
- Password hashing when using local credentials.
- HTTP-only cookies.
- Rate-limited login.
- CSRF protection for cookie-authenticated mutations.
- Session expiration and revocation.

Do not create public administrator signup.

Every administrative API must validate administrator permissions on the backend.

A guest must never gain administrative privileges by changing browser state, modifying a request body, or supplying a role field.

Room settings must be enforced server-side.

## 10. Secure Guest Joining and LiveKit Tokens

Create a server-side join-token endpoint.

Before issuing a token:

1. Validate the public room identifier.
2. Verify the room exists.
3. Verify the room is active and not expired.
4. Enforce participant capacity.
5. Enforce waiting-room or approval requirements.
6. Generate a unique, unpredictable participant identity.
7. Issue a short-lived LiveKit token for the authorized room.
8. Grant only the permissions required for that guest.
9. Return the LiveKit URL and token.

Never expose LiveKit API secrets to the browser.

Never trust a client-provided LiveKit room name, participant role, or permission set.

Implement server-side participant tracking and cleanup where needed.

When a room is closed, reject new joins and disconnect existing participants when appropriate.

Protect token issuance against repeated abuse.

## 11. Real-Time Chat

Implement a working chat panel using LiveKit data messages or another suitable real-time mechanism.

Features:
- Real-time message delivery.
- Sender name and avatar.
- Timestamps.
- New-message indicators.
- Scroll handling.
- Message validation.
- Empty-message rejection.
- Message length limits.
- Chat enabled/disabled per room.
- Useful network error states.

Choose one primary chat-delivery architecture.

If using persistent history, store messages in PostgreSQL and enforce room membership server-side.

If chat is ephemeral, document that messages are not retained after the relevant session ends.

Do not trust sender identity or role values supplied by the client.

Apply rate limits and protect against message spam.

## 12. Screen Sharing and Meeting Controls

Implement real functionality for:
- Microphone mute/unmute.
- Camera on/off.
- Camera and microphone selection where supported.
- Screen sharing.
- Stop screen sharing.
- Participant list.
- Chat panel.
- Raise hand.
- Emoji reactions where practical.
- Fullscreen.
- Leave meeting.
- Admin participant removal.
- Admin meeting termination.

Buttons must change the actual media or application state.

When a camera is disabled, release or disable the local video track as appropriate and show the selected avatar.

When a participant leaves, clean up media tracks, listeners, subscriptions, and session state.

Use only permissions supported by the chosen SDK version.

## 13. Database Schema

Create migrations for:

### study_rooms
- id
- public_room_id
- name
- description
- subject
- status
- max_participants
- chat_enabled
- screen_sharing_enabled
- waiting_room_enabled
- expires_at
- created_by
- created_at
- updated_at
- closed_at

### guest_sessions
- id
- room_id
- guest_identity
- display_name
- avatar_id
- joined_at
- last_seen_at
- left_at

### chat_messages
- id
- room_id
- sender_identity
- sender_display_name
- message
- created_at

### administrators
Use the appropriate schema for the chosen administrator authentication provider. Do not duplicate external authentication passwords.

Add indexes, foreign keys, validation constraints, and cleanup policies.

Use PostgreSQL migrations committed to source control.

If using Supabase, configure Row Level Security for exposed tables. Keep privileged operations and service-role credentials on the server.

Do not store unnecessary personal information about guests.

## 14. Backend APIs

Implement endpoints equivalent to:

### Public
- GET `/api/health`
- GET `/api/rooms/:roomId`
- POST `/api/rooms/:roomId/join`
- POST `/api/rooms/:roomId/leave`
- POST `/api/rooms/:roomId/chat` if required by the chosen chat architecture

### Administrator
- POST `/api/admin/login`
- POST `/api/admin/logout`
- GET `/api/admin/me`
- GET `/api/admin/rooms`
- POST `/api/admin/rooms`
- GET `/api/admin/rooms/:id`
- PATCH `/api/admin/rooms/:id`
- DELETE `/api/admin/rooms/:id`

Add any necessary endpoints for waiting-room approval, participant removal, or room statistics.

Use Zod validation, centralized error handling, consistent JSON responses, secure session management, rate limiting, request-size limits, and appropriate CORS restrictions.

Do not expose stack traces or secrets to clients.

## 15. UI and Responsive Design

Create a premium interface inspired by modern video-conferencing products without copying proprietary branding.

Design requirements:
- Dark, distraction-free meeting interface.
- Clean landing page.
- Rounded video tiles.
- Consistent spacing and typography.
- Accessible contrast.
- Smooth but restrained transitions.
- Clear microphone and camera states.
- Active-speaker highlighting.
- Professional icons.
- Responsive sidebars.
- Useful tooltips.
- Loading indicators.
- Toast notifications.
- Confirmation dialogs.
- Keyboard accessibility.

On desktop, prioritize the participant grid and provide optional chat and participant sidebars.

On mobile, use compact meeting controls and collapsible panels.

Do not sacrifice video rendering performance for decorative effects.

## 16. Security and Privacy

Implement:
- Backend authorization for every administrator operation.
- Secure administrator sessions.
- Short-lived LiveKit participant tokens.
- Unpredictable room identifiers.
- Input validation.
- Safe rendering of user-generated content.
- Rate limiting.
- CORS allowlisting.
- CSRF protection where applicable.
- Secure cookie settings.
- No exposed secrets.
- No unrestricted guest permissions.
- Room capacity enforcement.
- Chat abuse controls.
- Expired-room cleanup.
- Safe error handling.

Provide a clear privacy notice explaining that camera and microphone access require browser permission.

Do not record meetings by default.

If recording is added later, require explicit consent and clearly communicate retention and access policies.

## 17. Development and Deployment

Create a maintainable monorepo, adapting to the existing repository if necessary.

Suggested structure:

studyroom/
  apps/
    web/
      src/
        components/
        pages/
        hooks/
        services/
        lib/
        types/
        styles/
      tests/
    api/
      src/
        routes/
        middleware/
        services/
        repositories/
        validation/
        config/
        utils/
      tests/
  packages/
    shared/
  database/
    migrations/
  docs/
    ARCHITECTURE.md
    SETUP.md
    DEPLOYMENT.md
    SECURITY.md
    PERFORMANCE.md
  .env.example
  .gitignore
  README.md
  package.json

Create environment-variable validation and a complete `.env.example` without actual secrets.

Include:
- LiveKit server URL.
- LiveKit API key.
- LiveKit API secret.
- Database connection.
- Frontend origin.
- Backend port.
- Administrator bootstrap configuration.
- Session secret.

Use Docker Compose for local PostgreSQL and optional self-hosted LiveKit infrastructure where practical.

Document TLS, firewall, UDP connectivity, TURN relay configuration, and bandwidth requirements.

Do not claim that a free hosting provider guarantees unlimited video capacity.

The application must run locally using documented commands, and production deployment must use HTTPS.

## 18. Testing Requirements

Write automated tests for:
- Guest access without login.
- Admin-only room creation.
- Unauthorized room modification rejection.
- Invalid room handling.
- Closed-room rejection.
- Expired-room rejection.
- Participant capacity.
- Guest token issuance.
- Protection against privilege escalation.
- Chat authorization.
- Input validation.
- Secret protection.
- Avatar selection.
- Camera and microphone controls.
- Error handling.
- Responsive UI.

Where infrastructure permits, test real meetings using two separate browser contexts:
1. Administrator creates a room.
2. First guest joins without an account.
3. Second guest opens the shared link and joins without an account.
4. Both participants receive real remote audio and video.
5. Microphone and camera controls work.
6. Chat messages arrive in real time.
7. Screen sharing works.
8. Leaving the room cleans up media tracks.
9. Closed rooms reject new participants.

Do not claim real video integration tests passed if they were not executed.

## 19. Performance Acceptance Criteria

Test the application with two, five, and ten participants where the infrastructure permits.

Test:
- 720p video.
- 1080p video where supported.
- Grid mode.
- Speaker mode.
- Audio-only mode.
- Screen sharing.
- Camera toggling.
- Network degradation.
- Device and permission failures.

Record:
- Actual local CPU usage.
- Memory usage.
- Video frame rate.
- Dropped frames.
- Network bandwidth.
- Connection quality.
- Whether the device sustains the selected video quality.

Use real measurements rather than invented benchmarks.

Prioritize clear audio and smooth playback during constrained network conditions.

Do not guarantee 1080p for every participant under all conditions.

## 20. Execution Instructions

First inspect the repository, existing dependencies, environment, and current implementation.

Then implement the project in these phases:

Phase 1: Project setup, routing, design system, and landing page.

Phase 2: PostgreSQL schema, administrator authorization, room-management APIs, and invitation links.

Phase 3: Guest identity, avatars, camera preview, microphone settings, and pre-join page.

Phase 4: LiveKit integration, high-quality video, adaptive streaming, participant tiles, and meeting controls.

Phase 5: Real-time chat, screen sharing, participant management, and low-resource mode.

Phase 6: Security hardening, automated tests, performance testing, documentation, and deployment preparation.

Run type checks, linting, builds, and relevant tests after each phase. Fix failures before proceeding.

Do not stop after creating the UI. Continue until the application is functional to the extent permitted by available services and credentials.

When complete, report:
1. Implemented features.
2. Important files created or changed.
3. Exact commands for local execution.
4. Required environment variables.
5. Database and LiveKit setup steps.
6. Tests actually executed and their results.
7. Remaining external configuration requirements.
8. Known limitations and recommended next steps.

**Final objective:** Deliver a real, login-free guest video-conferencing application for study groups, with administrator-only room creation, shareable room links, high-quality adaptive video, reliable audio, working chat, screen sharing, avatar personalization, and careful resource management. Prioritize functional correctness, privacy, security, performance, and user experience over superficial completeness.
