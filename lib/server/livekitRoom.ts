import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

type LiveKitConfig = {
  apiKey: string;
  apiSecret: string;
  url: string;
};

function getConfig(): LiveKitConfig {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  const url = process.env.LIVEKIT_URL?.trim();
  if (!apiKey || !apiSecret || !url) {
    throw new Error('LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set.');
  }
  return { apiKey, apiSecret, url };
}

export function isLiveKitConfigured(): boolean {
  return !!(
    process.env.LIVEKIT_API_KEY?.trim() &&
    process.env.LIVEKIT_API_SECRET?.trim() &&
    process.env.LIVEKIT_URL?.trim()
  );
}

// Deterministic room name: same muezzin + mosque + prayer + date always lands in the same room.
export function computeLiveKitRoomName(mosqueId: string, prayer: string, isoDateOrTimestamp: string): string {
  const date = isoDateOrTimestamp.slice(0, 10); // YYYY-MM-DD
  return `adhan-${mosqueId}-${prayer.toLowerCase()}-${date}`;
}

export function getLiveKitHttpUrl(): string {
  const { url } = getConfig();
  return url.replace(/^wss?:\/\//, 'https://');
}

export function getLiveKitWssUrl(): string {
  return getConfig().url;
}

export async function createPublisherToken(userId: string, roomName: string): Promise<string> {
  const { apiKey, apiSecret } = getConfig();
  const at = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    ttl: 60 * 60 * 2, // 2 hours
  });
  at.addGrant({
    roomJoin: true,
    roomCreate: true,
    room: roomName,
    canPublish: true,
    canSubscribe: false,
    canPublishData: false,
  });
  return at.toJwt();
}

export async function createSubscriberToken(userId: string, roomName: string): Promise<string> {
  const { apiKey, apiSecret } = getConfig();
  const at = new AccessToken(apiKey, apiSecret, {
    identity: `listener-${userId}`,
    ttl: 60 * 60, // 1 hour
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: false,
    canSubscribe: true,
    canPublishData: false,
  });
  return at.toJwt();
}

export async function deleteLiveKitRoom(roomName: string): Promise<void> {
  try {
    const { apiKey, apiSecret } = getConfig();
    const httpUrl = getLiveKitHttpUrl();
    const svc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    await svc.deleteRoom(roomName);
  } catch (err) {
    // Non-fatal: room may already be empty or not exist.
    console.warn('[livekitRoom] deleteRoom failed', err instanceof Error ? err.message : err);
  }
}
