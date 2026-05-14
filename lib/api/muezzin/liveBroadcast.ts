import { supabase } from '../../supabase';
import { fetchServerApi, resolveApiUrls } from '../apiBaseUrl';

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
  livekit_room_name?: string | null;
};

export type MosqueLiveBroadcastConfig = {
  streaming_enabled: boolean;
  provider?: string | null;
  provider_label?: string | null;
  provider_summary?: string | null;
  playback_url_configured: boolean;
  playback_url?: string | null;
  ingest_url_configured: boolean;
  username_configured?: boolean;
  username_label?: string | null;
  username?: string | null;
  stream_key_configured: boolean;
  credential_label?: string | null;
  is_ready_for_broadcast: boolean;
  is_ready_for_external_encoder: boolean;
  supports_external_encoder?: boolean;
  requires_ingest_url?: boolean;
  requires_username?: boolean;
  requires_stream_key?: boolean;
  ingest_url?: string | null;
  ingest_protocol_hint?: string | null;
  stream_key?: string | null;
  masked_stream_key?: string | null;
  playback_health?: {
    target: 'playback' | 'ingest';
    status: 'reachable' | 'auth_required' | 'failing' | 'manual_check_required' | 'not_configured' | 'not_required' | 'unknown';
    message: string;
    url: string | null;
    checked_at: string | null;
    http_status: number | null;
  } | null;
  ingest_health?: {
    target: 'playback' | 'ingest';
    status: 'reachable' | 'auth_required' | 'failing' | 'manual_check_required' | 'not_configured' | 'not_required' | 'unknown';
    message: string;
    url: string | null;
    checked_at: string | null;
    http_status: number | null;
  } | null;
  encoder_preflight_status?: 'ready' | 'attention' | 'manual_check_required' | 'not_configured';
  encoder_preflight_summary?: string | null;
  upstream_status?: string | null;
  upstream_encoder_connected?: boolean;
  upstream_playback_active?: boolean;
  upstream_last_seen_at?: string | null;
  upstream_stream_id?: string | null;
  upstream_message?: string | null;
  encoder_instructions?: string | null;
  issues: string[];
};

type LiveBroadcastPayload = {
  stream?: LiveBroadcastStreamRow | null;
  config?: MosqueLiveBroadcastConfig | null;
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
  const response = await fetchServerApi(input, init, 10000);
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

export async function fetchMuezzinLiveBroadcastState(mosqueId: string): Promise<LiveBroadcastPayload> {
  const endpoints = resolveApiUrls('/api/muezzin/live-broadcast');
  if (!endpoints.length) {
    throw new Error('Could not resolve the live broadcast endpoint.');
  }
  console.log('[muezzin.liveBroadcast] state endpoints', endpoints);

  const accessToken = await getAccessToken();
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('mosqueId', mosqueId);
      console.log('[muezzin.liveBroadcast] requesting state', url.toString());
      const payload = await requestLiveBroadcast(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return payload;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(error?.message ?? String(error));
      console.warn('[muezzin.liveBroadcast] state endpoint failed', endpoint, lastError.message);
    }
  }

  throw lastError ?? new Error('Unable to load the live broadcast state.');
}

export async function updateMuezzinLiveBroadcast(args: UpdateLiveBroadcastArgs): Promise<LiveBroadcastPayload> {
  const endpoints = resolveApiUrls('/api/muezzin/live-broadcast');
  if (!endpoints.length) {
    throw new Error('Could not resolve the live broadcast endpoint.');
  }
  console.log('[muezzin.liveBroadcast] update endpoints', endpoints);

  const accessToken = await getAccessToken();
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      console.log('[muezzin.liveBroadcast] requesting update', endpoint, args.action);
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
      return payload;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(error?.message ?? String(error));
      console.warn('[muezzin.liveBroadcast] update endpoint failed', endpoint, lastError.message);
    }
  }

  throw lastError ?? new Error('Unable to update the live broadcast state.');
}
