import { loadConfig } from '../config.js';
import { LiveKitService } from '../services/livekit.js';

const service = new LiveKitService(loadConfig());

try {
  await service.rooms.listRooms();
  console.log('LiveKit accepted the configured API credentials.');
} catch {
  console.error('LiveKit did not accept the configured API credentials.');
  process.exitCode = 1;
}
