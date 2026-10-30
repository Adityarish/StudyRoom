import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { TrackSource } from '@livekit/protocol';
import type { Config } from '../config.js';

export class LiveKitService {
  readonly rooms: RoomServiceClient;
  readonly publicUrl: string;
  constructor(private config: Config) { this.publicUrl = config.LIVEKIT_URL; this.rooms = new RoomServiceClient(config.LIVEKIT_URL.replace(/^ws/, 'http'), config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET); }
  async guestToken(input: { roomName: string; identity: string; displayName: string; avatarId: string; screenSharingEnabled: boolean }) {
    const token = new AccessToken(this.config.LIVEKIT_API_KEY, this.config.LIVEKIT_API_SECRET, { identity: input.identity, name: input.displayName, ttl: '15m', metadata: JSON.stringify({ displayName: input.displayName, avatarId: input.avatarId, role: 'guest' }) });
    const sources = [TrackSource.CAMERA, TrackSource.MICROPHONE];
    if (input.screenSharingEnabled) sources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
    token.addGrant({ roomJoin: true, room: input.roomName, canSubscribe: true, canPublishSources: sources, canPublishData: false });
    return token.toJwt();
  }
  async remove(roomName: string, identity: string) { try { await this.rooms.removeParticipant(roomName, identity); } catch (error) { if (!(error instanceof Error) || !/not found/i.test(error.message)) throw error; } }
  async end(roomName: string) { try { await this.rooms.deleteRoom(roomName); } catch (error) { if (!(error instanceof Error) || !/not found/i.test(error.message)) throw error; } }
  async activeIdentities(roomName: string) { try { return (await this.rooms.listParticipants(roomName)).map(p => p.identity); } catch { return []; } }
}
