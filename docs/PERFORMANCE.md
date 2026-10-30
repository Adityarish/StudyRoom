# Media quality and performance

## Implemented strategy

High quality requests up to 1080p at 30 fps, balanced prefers 720p at 30 fps, and low-resource requests 360p with a reduced frame-rate ceiling. Pre-join capture retries at 640×360 if the preferred camera constraint fails. These are preferences, not promises; browsers and LiveKit remain free to adapt.

The meeting Room enables adaptive streaming, dynacast, and three simulcast layers. Active or pinned speakers request a higher subscriber layer. Small tiles request medium or low layers. Speaker view renders one primary stream and thumbnail publications. Audio-only mode stops local camera publication and unsubscribes remote video, while microphone and chat remain active. Tracks and listeners are detached on tile unmount and the room disconnects on page exit.

Screen sharing targets 1920×1080 at 12 fps so code and notes remain readable without spending bandwidth on unnecessary motion.

## Measurement procedure

No synthetic benchmark is claimed by this repository. Record measurements on the actual target device and LiveKit deployment:

1. Open separate browser/device contexts for 2, 5, and 10 participants.
2. Run each quality mode for at least five minutes in grid and speaker layouts.
3. Use Chrome `webrtc-internals` for encoded/decoded fps, bytes, packet loss, jitter, RTT, frames dropped, and selected simulcast layer.
4. Use browser Task Manager or OS Activity Monitor for renderer CPU, GPU, energy, and memory.
5. Repeat with screen sharing, audio-only, camera toggle, and simulated packet loss/bandwidth limits.
6. Record camera model, device, browser, network, server region, and LiveKit version so results are comparable.

Acceptance should prioritize intelligible audio, stable controls, and recovery under degradation. Never compare CPU or bandwidth numbers from different devices or network conditions as if they were equivalent.
