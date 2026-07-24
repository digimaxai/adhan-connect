import { supabase } from '../supabase';
import { resolveApiUrls } from './apiBaseUrl';

export type AuthorizedLiveStreamAccess = {
  mosqueId: string;
  streamId: string;
  streamUrl: string;
  expiresAt: string;
  provider?: string | null;
  mountPath?: string | null;
};

type CachedAccessEntry = {
  expiresAtMs: number;
  payload: AuthorizedLiveStreamAccess;
};

type ListenerLocation = {
  latitude: number;
  longitude: number;
} | null;

const accessCache = new Map<string, CachedAccessEntry>();

function cacheKey(
  userId: string,
  mosqueId: string,
  streamId: string | null | undefined,
  location: ListenerLocation
) {
  const locationKey = location
    ? `${location.latitude}:${location.longitude}`
    : 'no-location';
  return `${userId}:${mosqueId}:${streamId ?? ''}:${locationKey}`;
}

function isAuthorizedLiveStreamAccess(value: unknown): value is AuthorizedLiveStreamAccess {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.mosqueId === 'string' &&
    typeof payload.streamId === 'string' &&
    typeof payload.streamUrl === 'string' &&
    typeof payload.expiresAt === 'string'
  );
}

async function getAccessSession() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Your session has expired. Refresh the app and sign in again.');
  }
  return {
    accessToken: sessionData.session.access_token,
    userId: sessionData.session.user.id,
  };
}

export async function fetchAuthorizedLiveStreamPlayback(
  mosqueId: string,
  streamId?: string | null,
  location?: ListenerLocation
) {
  // Authentication and the location-dependent cache key are checked before a
  // cached playback grant is returned. This prevents a later user on the same
  // device from inheriting another account's signed playback URL.
  const { accessToken, userId } = await getAccessSession();
  const key = cacheKey(userId, mosqueId, streamId, location ?? null);
  const cached = accessCache.get(key);
  if (cached && cached.expiresAtMs - Date.now() > 30_000) {
    return cached.payload;
  }

  const endpoints = resolveApiUrls('/api/live-stream-access');
  if (!endpoints.length) {
    throw new Error('Could not resolve the live stream access endpoint.');
  }

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mosqueId,
          streamId: streamId ?? null,
          // Keep the provider URL server-side on every platform. A redirect
          // would reveal a reusable upstream URL outside the signed grant.
          delivery: 'proxy',
          location: location ?? null,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string'
            ? (payload as any).error
            : `Live stream access failed with status ${response.status}.`
        );
      }

      if (!isAuthorizedLiveStreamAccess(payload)) {
        throw new Error('Unexpected live stream access payload.');
      }

      const expiresAtMs = new Date(payload.expiresAt).getTime();
      accessCache.set(key, {
        expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : Date.now(),
        payload,
      });
      return payload;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(error?.message ?? String(error));
    }
  }

  throw lastError ?? new Error('Unable to authorize this live stream.');
}
