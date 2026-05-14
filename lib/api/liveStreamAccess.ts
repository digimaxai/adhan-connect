import { supabase } from '../supabase';
import { resolveApiUrls } from './apiBaseUrl';
import { Platform } from 'react-native';

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

function cacheKey(mosqueId: string, streamId?: string | null) {
  return `${mosqueId}:${streamId ?? ''}`;
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

async function getAccessToken() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Your session has expired. Refresh the app and sign in again.');
  }
  return sessionData.session.access_token;
}

export async function fetchAuthorizedLiveStreamPlayback(
  mosqueId: string,
  streamId?: string | null,
  location?: ListenerLocation
) {
  const key = cacheKey(mosqueId, streamId);
  const cached = accessCache.get(key);
  if (cached && cached.expiresAtMs - Date.now() > 30_000) {
    return cached.payload;
  }

  const endpoints = resolveApiUrls('/api/live-stream-access');
  if (!endpoints.length) {
    throw new Error('Could not resolve the live stream access endpoint.');
  }

  const accessToken = await getAccessToken();
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('mosqueId', mosqueId);
      if (streamId) {
        url.searchParams.set('streamId', streamId);
      }
      if (location) {
        url.searchParams.set('lat', String(location.latitude));
        url.searchParams.set('lng', String(location.longitude));
      }
      url.searchParams.set('delivery', Platform.OS === 'web' ? 'redirect' : 'proxy');

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
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
