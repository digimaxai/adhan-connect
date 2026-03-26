import { supabase } from '../../supabase';
import { resolveApiUrls } from '../apiBaseUrl';

export type LiveBroadcastStreamRow = {
  id?: string;
  mosque_id: string;
  is_live?: boolean | null;
  current_prayer?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  stream_url?: string | null;
  url?: string | null;
  status?: string | null;
};

type LiveBroadcastPayload = {
  stream?: LiveBroadcastStreamRow | null;
  error?: string | null;
};

type UpdateLiveBroadcastArgs = {
  action: 'start' | 'end';
  mosqueId: string;
  prayer?: string | null;
  scheduledAt?: string | null;
  adhanId?: string | null;
};

function isLiveBroadcastPayload(value: unknown): value is LiveBroadcastPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return 'stream' in payload || 'error' in payload;
}

async function getAccessToken() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Your session has expired. Refresh the app and sign in again.');
  }
  return sessionData.session.access_token;
}

async function requestLiveBroadcast(input: string | URL, init: RequestInit): Promise<LiveBroadcastPayload> {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string'
        ? (payload as any).error
        : null) || `Live broadcast request failed with status ${response.status}.`;
    throw new Error(message);
  }

  if (!isLiveBroadcastPayload(payload)) {
    throw new Error('Unexpected live broadcast payload.');
  }

  return payload;
}

export async function fetchMuezzinLiveBroadcastState(mosqueId: string): Promise<LiveBroadcastStreamRow | null> {
  const endpoints = resolveApiUrls('/api/muezzin/live-broadcast');
  if (!endpoints.length) {
    throw new Error('Could not resolve the live broadcast endpoint.');
  }

  const accessToken = await getAccessToken();
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('mosqueId', mosqueId);
      const payload = await requestLiveBroadcast(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return payload.stream ?? null;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(error?.message ?? String(error));
    }
  }

  throw lastError ?? new Error('Unable to load the live broadcast state.');
}

export async function updateMuezzinLiveBroadcast(args: UpdateLiveBroadcastArgs): Promise<LiveBroadcastStreamRow | null> {
  const endpoints = resolveApiUrls('/api/muezzin/live-broadcast');
  if (!endpoints.length) {
    throw new Error('Could not resolve the live broadcast endpoint.');
  }

  const accessToken = await getAccessToken();
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const payload = await requestLiveBroadcast(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: args.action,
          mosqueId: args.mosqueId,
          prayer: args.prayer ?? null,
          scheduledAt: args.scheduledAt ?? null,
          adhanId: args.adhanId ?? null,
        }),
      });
      return payload.stream ?? null;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(error?.message ?? String(error));
    }
  }

  throw lastError ?? new Error('Unable to update the live broadcast state.');
}
