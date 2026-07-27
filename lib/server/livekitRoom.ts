import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

type LiveKitConfig = {
  apiKey: string;
  apiSecret: string;
  url: string;
};

type DeleteLiveKitRoomOptions = {
  maxAttempts?: number;
  requestTimeoutSeconds?: number;
  treatMissingAsSuccess?: boolean;
};

// Token expiry limits how long a consented request can be used to establish or
// re-establish a room connection. The token endpoints re-check current consent
// and role/mosque access before minting every replacement.
export const LIVEKIT_ACCESS_TOKEN_TTL_SECONDS = 10 * 60;

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
    ttl: LIVEKIT_ACCESS_TOKEN_TTL_SECONDS,
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
    ttl: LIVEKIT_ACCESS_TOKEN_TTL_SECONDS,
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

export async function deleteLiveKitRoom(
  roomName: string,
  options: DeleteLiveKitRoomOptions = {}
): Promise<void> {
  const describe = (error: unknown) => error instanceof Error ? error.message : String(error);
  const isMissingRoom = (error: unknown) => {
    const record = error && typeof error === 'object'
      ? error as { status?: unknown; code?: unknown }
      : null;
    if (record?.status === 404 || record?.code === 'not_found') return true;
    const message = describe(error).toLowerCase();
    return /room.+(?:not[ _-]?found|does not exist|missing)/.test(message);
  };
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 1));
  let attemptsMade = 0;

  try {
    const { apiKey, apiSecret } = getConfig();
    const httpUrl = getLiveKitHttpUrl();
    const svc = options.requestTimeoutSeconds
      ? new RoomServiceClient(httpUrl, apiKey, apiSecret, {
          requestTimeout: options.requestTimeoutSeconds,
        })
      : new RoomServiceClient(httpUrl, apiKey, apiSecret);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      attemptsMade = attempt;
      try {
        await svc.deleteRoom(roomName);
        return;
      } catch (error) {
        // An already-closed room is the desired end state.
        if (options.treatMissingAsSuccess && isMissingRoom(error)) return;
        if (attempt === maxAttempts) throw error;
      }
    }
  } catch (error) {
    // Non-fatal: database state is already committed and listeners also lose
    // access through that state. A repeated end can retry the retained room.
    console.warn('[livekitRoom] deleteRoom failed', {
      roomName,
      message: describe(error),
      attempts: attemptsMade,
    });
  }
}
