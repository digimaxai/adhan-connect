import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';
import {
  normalizeLiveStreamProvider,
  normalizePlaybackUrl,
  summarizeMosqueLiveBroadcastConfig,
  type MosqueLiveStreamConfigRow,
} from '../../../lib/liveStreamProviders';
import { attachMosqueLiveHealthChecks } from '../../../lib/server/liveStreamHealth';
import {
  attachMosqueLiveUpstreamState,
  fetchMosqueLiveStreamUpstreamState,
} from '../../../lib/server/liveStreamUpstreamState';
import { resolveMuezzinMosquesForUser } from '../../../lib/server/muezzinAccess';

type StreamRow = {
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

type ActionPayload = {
  action?: 'start' | 'end';
  mosqueId?: string;
  prayer?: string | null;
  scheduledAt?: string | null;
  adhanId?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function getSupabaseEnv():
  | { response: Response }
  | {
      supabaseUrl: string;
      serviceRoleKey: string;
    } {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl) {
    return { response: json({ error: 'Server is missing SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.' }, 500) };
  }

  if (!serviceRoleKey) {
    return { response: json({ error: 'Server is missing SUPABASE_SERVICE_ROLE.' }, 500) };
  }

  return {
    supabaseUrl,
    serviceRoleKey,
  };
}

async function requireMuezzinContext(
  request: Request
): Promise<
  | { response: Response }
  | {
      supabaseAdmin: SupabaseClient<any, any, any>;
      userId: string;
    }
> {
  const env = getSupabaseEnv();
  if ('response' in env) {
    return env;
  }

  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) {
    return { response: json({ error: 'Missing bearer token.' }, 401) };
  }

  const supabaseAdmin = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return { response: json({ error: 'Session is invalid or has expired.' }, 401) };
  }

  return {
    supabaseAdmin,
    userId: authData.user.id,
  };
}

async function ensureMuezzinMosqueAccess(
  supabaseAdmin: SupabaseClient<any, any, any>,
  userId: string,
  mosqueId: string
) {
  const mosques = await resolveMuezzinMosquesForUser(supabaseAdmin, userId);
  const allowed = mosques.some((mosque) => mosque.mosqueId === mosqueId);
  if (!allowed) {
    throw new Error('You do not have muezzin access to this mosque.');
  }
}

async function fetchLatestStreamRow(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string
): Promise<StreamRow | null> {
  const { data, error } = await supabaseAdmin
    .from('streams')
    .select('id, mosque_id, is_live, current_prayer, started_at, ended_at, stream_url, url, status')
    .eq('mosque_id', mosqueId)
    .order('started_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(1);

  if (error) throw error;
  return ((data ?? []) as StreamRow[])[0] ?? null;
}

async function fetchMosqueLiveStreamConfig(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string
): Promise<MosqueLiveStreamConfigRow> {
  const { data, error } = await supabaseAdmin
    .from('mosques')
    .select('id, name, live_stream_enabled, live_stream_provider, live_stream_playback_url, live_stream_ingest_url, live_stream_username, live_stream_stream_key, live_stream_status_secret')
    .eq('id', mosqueId)
    .maybeSingle<MosqueLiveStreamConfigRow>();

  if (error) throw error;
  if (!data) {
    throw new Error('The selected mosque could not be found.');
  }
  return data;
}

async function requireMosquePlaybackUrl(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string
) {
  const config = await fetchMosqueLiveStreamConfig(supabaseAdmin, mosqueId);
  const mosqueName = config.name?.trim() || 'This mosque';
  const summary = summarizeMosqueLiveBroadcastConfig(config);

  if (!summary.streaming_enabled) {
    throw new Error(`${mosqueName} does not have live streaming enabled yet.`);
  }
  if (!summary.is_ready_for_broadcast) {
    throw new Error(summary.issues[0] ?? `${mosqueName} is not ready for broadcast.`);
  }
  const playbackUrl = normalizePlaybackUrl(config.live_stream_playback_url);
  if (!playbackUrl) {
    throw new Error(`${mosqueName} is missing a live stream playback URL.`);
  }

  return {
    mosqueName,
    playbackUrl,
    provider: normalizeLiveStreamProvider(config.live_stream_provider),
    summary,
  };
}

function isUuid(value?: string | null) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizePrayer(value?: string | null) {
  const lower = (value ?? 'adhan').trim().toLowerCase();
  return lower || 'adhan';
}

function normalizeScheduledAt(value?: string | null) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

type AdhanWritePayload = Record<string, string | null>;

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return String(error ?? 'Unknown error');
  const record = error as { code?: unknown; message?: unknown; details?: unknown };
  return [record.code, record.message, record.details]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join(' | ');
}

function dedupePayloadVariants<T extends AdhanWritePayload>(variants: T[]) {
  const seen = new Set<string>();
  return variants.filter((variant) => {
    const key = JSON.stringify(Object.keys(variant).sort().map((field) => [field, variant[field]]));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildStartAdhanPayloadVariants(
  mosqueId: string,
  prayer: string,
  scheduledAt: string,
  startedAt: string,
  streamId: string | null
) {
  return dedupePayloadVariants([
    {
      mosque_id: mosqueId,
      prayer,
      scheduled_at: scheduledAt,
      status: 'live',
      started_at: startedAt,
      ended_at: null,
      stream_id: streamId,
      source: 'live',
      broadcast_started_at: startedAt,
      broadcast_ended_at: null,
    },
    {
      mosque_id: mosqueId,
      prayer,
      scheduled_at: scheduledAt,
      status: 'live',
      started_at: startedAt,
      ended_at: null,
      source: 'live',
      broadcast_started_at: startedAt,
      broadcast_ended_at: null,
    },
    {
      mosque_id: mosqueId,
      prayer,
      scheduled_at: scheduledAt,
      status: 'live',
      source: 'live',
      broadcast_started_at: startedAt,
      broadcast_ended_at: null,
    },
    {
      mosque_id: mosqueId,
      prayer,
      scheduled_at: scheduledAt,
      status: 'live',
      started_at: startedAt,
      ended_at: null,
    },
    {
      mosque_id: mosqueId,
      prayer,
      scheduled_at: scheduledAt,
      status: 'live',
    },
  ]);
}

function buildCompleteAdhanPayloadVariants(endedAt: string) {
  return dedupePayloadVariants([
    {
      status: 'completed',
      ended_at: endedAt,
      broadcast_ended_at: endedAt,
    },
    {
      status: 'completed',
      broadcast_ended_at: endedAt,
    },
    {
      status: 'completed',
      ended_at: endedAt,
    },
    {
      status: 'completed',
    },
  ]);
}

async function tryUpdateAdhanWithPayloads(
  supabaseAdmin: SupabaseClient<any, any, any>,
  candidateId: string,
  payloads: AdhanWritePayload[]
) {
  let lastError: unknown = null;

  for (const payload of payloads) {
    const { data, error } = await supabaseAdmin
      .from('adhans')
      .update(payload as any)
      .eq('id', candidateId)
      .select('id')
      .maybeSingle<{ id?: string | null }>();

    if (error && error.code !== 'PGRST116') {
      lastError = error;
      continue;
    }

    return data?.id ?? null;
  }

  if (lastError) throw lastError;
  return null;
}

async function tryInsertAdhanWithPayloads(
  supabaseAdmin: SupabaseClient<any, any, any>,
  payloads: AdhanWritePayload[]
) {
  let lastError: unknown = null;

  for (const payload of payloads) {
    const { data, error } = await supabaseAdmin
      .from('adhans')
      .insert(payload as any)
      .select('id')
      .maybeSingle<{ id?: string | null }>();

    if (error) {
      lastError = error;
      continue;
    }

    return data?.id ?? null;
  }

  if (lastError) throw lastError;
  return null;
}

async function startOrCreateStream(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string,
  prayer: string,
  startedAt: string,
  playbackUrl: string
) {
  const existing = await fetchLatestStreamRow(supabaseAdmin, mosqueId);

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('streams')
      .update({
        is_live: true,
        current_prayer: prayer,
        started_at: startedAt,
        ended_at: null,
        stream_url: playbackUrl,
        url: playbackUrl,
        status: 'active',
      } as any)
      .eq('id', existing.id)
      .select('id, mosque_id, is_live, current_prayer, started_at, ended_at, stream_url, url, status')
      .maybeSingle<StreamRow>();

    if (error) throw error;
    return data ?? {
      ...existing,
      is_live: true,
      current_prayer: prayer,
      started_at: startedAt,
      ended_at: null,
      stream_url: playbackUrl,
      url: playbackUrl,
      status: 'active',
    };
  }

  const { data, error } = await supabaseAdmin
    .from('streams')
    .insert({
      mosque_id: mosqueId,
      is_live: true,
      current_prayer: prayer,
      started_at: startedAt,
      ended_at: null,
      stream_url: playbackUrl,
      url: playbackUrl,
      status: 'active',
    } as any)
    .select('id, mosque_id, is_live, current_prayer, started_at, ended_at, stream_url, url, status')
    .maybeSingle<StreamRow>();

  if (error) throw error;
  return data ?? null;
}

async function endCurrentStream(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string,
  endedAt: string
) {
  const existing = await fetchLatestStreamRow(supabaseAdmin, mosqueId);
  if (!existing?.id) return null;

  const { data, error } = await supabaseAdmin
    .from('streams')
    .update({
      is_live: false,
      ended_at: endedAt,
      status: 'active',
    } as any)
    .eq('id', existing.id)
    .select('id, mosque_id, is_live, current_prayer, started_at, ended_at, stream_url, url, status')
    .maybeSingle<StreamRow>();

  if (error && error.code !== 'PGRST116') throw error;
  return (
    data ?? {
      ...existing,
      is_live: false,
      ended_at: endedAt,
      status: 'active',
    }
  );
}

async function startOrCreateAdhan(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string,
  prayer: string,
  scheduledAt: string,
  adhanId: string | null,
  startedAt: string,
  streamId: string | null
) {
  try {
    const payloads = buildStartAdhanPayloadVariants(mosqueId, prayer, scheduledAt, startedAt, streamId);
    const candidateIds = new Set<string>();
    if (isUuid(adhanId)) {
      candidateIds.add(adhanId as string);
    }

    const { data: existingLive, error: existingLiveError } = await supabaseAdmin
      .from('adhans')
      .select('id')
      .eq('mosque_id', mosqueId)
      .eq('status', 'live')
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id?: string | null }>();

    if (existingLiveError && existingLiveError.code !== 'PGRST116') {
      throw existingLiveError;
    }

    if (existingLive?.id) {
      candidateIds.add(existingLive.id);
    }

    for (const candidateId of candidateIds) {
      const updatedId = await tryUpdateAdhanWithPayloads(supabaseAdmin, candidateId, payloads);
      if (updatedId) {
        return updatedId;
      }
    }

    return await tryInsertAdhanWithPayloads(supabaseAdmin, payloads);
  } catch (error) {
    console.warn('[live-broadcast] adhan start sync failed', {
      mosqueId,
      prayer,
      adhanId,
      message: describeError(error),
    });
    return null;
  }
}

async function completeAdhan(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string,
  adhanId: string | null,
  endedAt: string
) {
  try {
    const payloads = buildCompleteAdhanPayloadVariants(endedAt);
    const candidateIds = new Set<string>();
    if (isUuid(adhanId)) {
      candidateIds.add(adhanId as string);
    }

    const { data: existingLive, error: existingLiveError } = await supabaseAdmin
      .from('adhans')
      .select('id')
      .eq('mosque_id', mosqueId)
      .eq('status', 'live')
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id?: string | null }>();

    if (existingLiveError && existingLiveError.code !== 'PGRST116') {
      throw existingLiveError;
    }

    if (existingLive?.id) {
      candidateIds.add(existingLive.id);
    }

    for (const candidateId of candidateIds) {
      const updatedId = await tryUpdateAdhanWithPayloads(supabaseAdmin, candidateId, payloads);
      if (updatedId) {
        return updatedId;
      }
    }

    return null;
  } catch (error) {
    console.warn('[live-broadcast] adhan completion sync failed', {
      mosqueId,
      adhanId,
      message: describeError(error),
    });
    return null;
  }
}

export const GET: RequestHandler = async (request) => {
  const auth = await requireMuezzinContext(request);
  if ('response' in auth) {
    return auth.response;
  }

  const url = new URL(request.url);
  const mosqueId = (url.searchParams.get('mosqueId') ?? '').trim();
  if (!mosqueId) {
    return json({ error: 'A mosqueId query parameter is required.' }, 400);
  }

  try {
    await ensureMuezzinMosqueAccess(auth.supabaseAdmin, auth.userId, mosqueId);
    const [stream, mosqueConfig, upstreamState] = await Promise.all([
      fetchLatestStreamRow(auth.supabaseAdmin, mosqueId),
      fetchMosqueLiveStreamConfig(auth.supabaseAdmin, mosqueId),
      fetchMosqueLiveStreamUpstreamState(auth.supabaseAdmin, mosqueId),
    ]);
    const config = attachMosqueLiveUpstreamState(
      await attachMosqueLiveHealthChecks(summarizeMosqueLiveBroadcastConfig(mosqueConfig)),
      upstreamState
    );
    return json({ stream, config });
  } catch (error: any) {
    const message = error?.message ?? 'Unable to load the current broadcast state.';
    const status = message === 'You do not have muezzin access to this mosque.' ? 403 : 500;
    return json({ error: message }, status);
  }
};

export const POST: RequestHandler = async (request) => {
  const auth = await requireMuezzinContext(request);
  if ('response' in auth) {
    return auth.response;
  }

  let body: ActionPayload;
  try {
    body = (await request.json()) as ActionPayload;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const action = body.action;
  const mosqueId = body.mosqueId?.trim() ?? '';
  if (!action || !['start', 'end'].includes(action)) {
    return json({ error: 'Expected action to be either start or end.' }, 400);
  }

  if (!mosqueId) {
    return json({ error: 'A mosqueId is required.' }, 400);
  }

  try {
    await ensureMuezzinMosqueAccess(auth.supabaseAdmin, auth.userId, mosqueId);

    if (action === 'start') {
      const startedAt = new Date().toISOString();
      const prayer = normalizePrayer(body.prayer);
      const scheduledAt = normalizeScheduledAt(body.scheduledAt);
      const { playbackUrl, summary } = await requireMosquePlaybackUrl(auth.supabaseAdmin, mosqueId);
      const stream = await startOrCreateStream(auth.supabaseAdmin, mosqueId, prayer, startedAt, playbackUrl);
      await startOrCreateAdhan(auth.supabaseAdmin, mosqueId, prayer, scheduledAt, body.adhanId ?? null, startedAt, stream?.id ?? null);
      const upstreamState = await fetchMosqueLiveStreamUpstreamState(auth.supabaseAdmin, mosqueId);
      const config = attachMosqueLiveUpstreamState(await attachMosqueLiveHealthChecks(summary), upstreamState);
      return json({ stream, config });
    }

    const endedAt = new Date().toISOString();
    const [stream, mosqueConfig, upstreamState] = await Promise.all([
      endCurrentStream(auth.supabaseAdmin, mosqueId, endedAt),
      fetchMosqueLiveStreamConfig(auth.supabaseAdmin, mosqueId),
      fetchMosqueLiveStreamUpstreamState(auth.supabaseAdmin, mosqueId),
    ]);
    await completeAdhan(auth.supabaseAdmin, mosqueId, body.adhanId ?? null, endedAt);
    const config = attachMosqueLiveUpstreamState(
      await attachMosqueLiveHealthChecks(summarizeMosqueLiveBroadcastConfig(mosqueConfig)),
      upstreamState
    );
    return json({ stream, config });
  } catch (error: any) {
    const message = error?.message ?? 'Unable to update the live broadcast state.';
    const status = message === 'You do not have muezzin access to this mosque.' ? 403 : 500;
    return json({ error: message }, status);
  }
};
