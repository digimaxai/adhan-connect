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
import {
  computeLiveKitRoomName,
  deleteLiveKitRoom,
  isLiveKitConfigured,
} from '../../../lib/server/livekitRoom';

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
  livekit_room_name?: string | null;
};

type ActionPayload = {
  action?: 'start' | 'end';
  mosqueId?: string;
  prayer?: string | null;
  scheduledAt?: string | null;
  adhanId?: string | null;
};

type BroadcastAccess = {
  hasMuezzinAccess: boolean;
  hasAdminOverride: boolean;
};

type RotaAssignmentRow = {
  id?: string | null;
  muezzin_user_id?: string | null;
};

type CoverAssignmentRow = {
  id?: string | null;
  volunteer_user_id?: string | null;
  status?: string | null;
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
) : Promise<BroadcastAccess> {
  const mosques = await resolveMuezzinMosquesForUser(supabaseAdmin, userId);
  const hasMuezzinAccess = mosques.some((mosque) => mosque.mosqueId === mosqueId);

  const [{ data: userRow, error: userError }, { data: adminRow, error: adminError }] = await Promise.all([
    supabaseAdmin.from('users').select('role').eq('id', userId).maybeSingle<{ role?: string | null }>(),
    supabaseAdmin
      .from('mosque_admins')
      .select('mosque_id')
      .eq('user_id', userId)
      .eq('mosque_id', mosqueId)
      .limit(1)
      .maybeSingle<{ mosque_id?: string | null }>(),
  ]);

  if (userError && userError.code !== 'PGRST116') throw userError;
  if (adminError && adminError.code !== 'PGRST116') throw adminError;

  const hasAdminOverride = userRow?.role === 'main_admin' || !!adminRow?.mosque_id;
  if (!hasMuezzinAccess && !hasAdminOverride) {
    throw new Error('You do not have muezzin access to this mosque.');
  }

  return { hasMuezzinAccess, hasAdminOverride };
}

async function fetchLatestStreamRow(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string
): Promise<StreamRow | null> {
  const { data, error } = await supabaseAdmin
    .from('streams')
    .select('id, mosque_id, is_live, current_prayer, started_at, ended_at, stream_url, url, status, livekit_room_name')
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
    .select('id, name, live_stream_enabled, live_stream_provider, live_stream_playback_url, live_stream_ingest_url, live_stream_mount_path, live_stream_username, live_stream_stream_key, live_stream_status_secret, live_stream_listener_secret')
    .eq('id', mosqueId)
    .maybeSingle<MosqueLiveStreamConfigRow>();

  if (error) throw error;
  if (!data) {
    throw new Error('The selected mosque could not be found.');
  }
  return data;
}

async function requireMosqueBroadcastReady(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string
) {
  const config = await fetchMosqueLiveStreamConfig(supabaseAdmin, mosqueId);
  const mosqueName = config.name?.trim() || 'This mosque';
  const provider = normalizeLiveStreamProvider(config.live_stream_provider);
  const summary = summarizeMosqueLiveBroadcastConfig(config);

  if (!summary.streaming_enabled) {
    throw new Error(`${mosqueName} does not have live streaming enabled yet.`);
  }
  if (!summary.is_ready_for_broadcast) {
    throw new Error(summary.issues[0] ?? `${mosqueName} is not ready for broadcast.`);
  }

  // LiveKit: no playback URL needed — listeners join the room via token.
  if (provider === 'livekit') {
    if (!isLiveKitConfigured()) {
      throw new Error('LiveKit is not configured on the server. Contact support.');
    }
    return { mosqueName, playbackUrl: null as null, provider, summary };
  }

  const playbackUrl = normalizePlaybackUrl(config.live_stream_playback_url);
  if (!playbackUrl) {
    throw new Error(`${mosqueName} is missing a live stream playback URL.`);
  }
  return { mosqueName, playbackUrl, provider, summary };
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

function isTestBroadcastId(value?: string | null) {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized === 'test-broadcast' || normalized.startsWith('test-');
}

// Mirrors the client window in useLiveBroadcastEngine.ts
const BROADCAST_WINDOW_BEFORE_MS = 3 * 60 * 1000;
const BROADCAST_WINDOW_AFTER_MS = 2 * 60 * 1000;

const CANONICAL_PRAYERS = new Set(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);

/**
 * Resolve the most authoritative scheduled time for a broadcast start,
 * working down a priority chain so the server — not the client — owns the
 * reference time whenever a DB record exists.
 *
 * Priority:
 *   1. adhans.scheduled_at  (explicit scheduled record for this adhanId)
 *   2. staff_rota.adhan_time (this muezzin's assigned slot for today)
 *   3. prayer_times.{prayer}_adhan_time (canonical mosque schedule)
 *   4. client-supplied scheduledAt (backward-compat fallback)
 *
 * Every lookup is wrapped in try/catch: a DB error never hard-blocks the muezzin.
 */
async function resolveAuthoritativeScheduledAt(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string,
  userId: string,
  prayer: string,
  adhanId: string | null,
  clientScheduledAt: string
): Promise<string> {
  // 1. adhans table — most explicit, verified against mosqueId
  if (adhanId && isUuid(adhanId)) {
    try {
      const { data } = await supabaseAdmin
        .from('adhans')
        .select('scheduled_at')
        .eq('id', adhanId)
        .eq('mosque_id', mosqueId)
        .maybeSingle<{ scheduled_at?: string | null }>();
      if (data?.scheduled_at) return data.scheduled_at;
    } catch {}
  }

  const today = clientScheduledAt.slice(0, 10); // YYYY-MM-DD from ISO string

  // 2. staff_rota — this muezzin's specific assignment
  try {
    const { data: rotaRow } = await supabaseAdmin
      .from('staff_rota')
      .select('adhan_time')
      .eq('mosque_id', mosqueId)
      .eq('muezzin_user_id', userId)
      .eq('prayer_name', prayer)
      .eq('date', today)
      .maybeSingle<{ adhan_time?: string | null }>();
    if (rotaRow?.adhan_time) return rotaRow.adhan_time;
  } catch {}

  // 3. prayer_times canonical table
  if (CANONICAL_PRAYERS.has(prayer)) {
    try {
      const col = `${prayer}_adhan_time`;
      const { data: ptRow } = await supabaseAdmin
        .from('prayer_times')
        .select(col)
        .eq('mosque_id', mosqueId)
        .eq('date', today)
        .maybeSingle<Record<string, string | null>>();
      const t = ptRow?.[col];
      if (t) return t;
    } catch {}
  }

  // 4. Fallback: client-supplied time (preserves backward compat)
  return clientScheduledAt;
}

async function fetchRotaAssignmentRows(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string,
  prayer: string,
  dateIso: string
): Promise<RotaAssignmentRow[]> {
  let result = await supabaseAdmin
    .from('staff_rota')
    .select('id, muezzin_user_id')
    .eq('mosque_id', mosqueId)
    .eq('prayer_name', prayer)
    .eq('date', dateIso);

  if (result.error?.code === '42703') {
    result = await supabaseAdmin
      .from('staff_rota')
      .select('id, muezzin_user_id')
      .eq('mosque_id', mosqueId)
      .eq('prayer_name', prayer)
      .eq('duty_date', dateIso);
  }

  if (result.error && result.error.code !== 'PGRST116') {
    throw result.error;
  }

  return (result.data ?? []) as RotaAssignmentRow[];
}

async function fetchCoverAssignmentRows(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string,
  userId: string,
  prayer: string,
  dateIso: string
): Promise<CoverAssignmentRow[]> {
  const { data, error } = await supabaseAdmin
    .from('muezzin_cover_requests')
    .select('id, volunteer_user_id, status')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso)
    .eq('prayer_name', prayer)
    .eq('volunteer_user_id', userId)
    .in('status', ['provisional_cover', 'approved']);

  if (error && error.code !== 'PGRST116') {
    if (error.code === '42P01' || error.code === '42703') return [];
    throw error;
  }

  return (data ?? []) as CoverAssignmentRow[];
}

async function assertUserCanStartRealBroadcast(
  supabaseAdmin: SupabaseClient<any, any, any>,
  access: BroadcastAccess,
  userId: string,
  mosqueId: string,
  prayer: string,
  scheduledAt: string,
  adhanId: string | null
) {
  if (isTestBroadcastId(adhanId)) return;
  if (access.hasAdminOverride) return;

  const dateIso = scheduledAt.slice(0, 10);
  const [rotaRows, coverRows] = await Promise.all([
    fetchRotaAssignmentRows(supabaseAdmin, mosqueId, prayer, dateIso),
    fetchCoverAssignmentRows(supabaseAdmin, mosqueId, userId, prayer, dateIso),
  ]);

  const isAssignedMuezzin = rotaRows.some((row) => row.muezzin_user_id === userId);
  const hasApprovedCover = coverRows.some((row) => row.volunteer_user_id === userId);

  if (isAssignedMuezzin || hasApprovedCover) return;

  throw new Error('Only the assigned muezzin, approved cover, provisional urgent cover, or a mosque admin can start this live adhan.');
}

async function assertBroadcastWindow(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string,
  userId: string,
  prayer: string,
  adhanId: string | null,
  clientScheduledAt: string
): Promise<void> {
  const authoritative = await resolveAuthoritativeScheduledAt(
    supabaseAdmin, mosqueId, userId, prayer, adhanId, clientScheduledAt
  );
  const scheduledMs = new Date(authoritative).getTime();
  if (Number.isNaN(scheduledMs)) return; // unparseable time — allow through

  const nowMs = Date.now();
  const windowOpenMs = scheduledMs - BROADCAST_WINDOW_BEFORE_MS;
  const windowCloseMs = scheduledMs + BROADCAST_WINDOW_AFTER_MS;

  if (nowMs < windowOpenMs) {
    const minutesLeft = Math.ceil((windowOpenMs - nowMs) / 60000);
    throw new Error(
      `Too early — the broadcast window opens in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`
    );
  }
  if (nowMs > windowCloseMs) {
    throw new Error('The broadcast window for this adhan has closed.');
  }
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
  playbackUrl: string | null,
  livekitRoomName: string | null
) {
  const existing = await fetchLatestStreamRow(supabaseAdmin, mosqueId);
  const cols = 'id, mosque_id, is_live, current_prayer, started_at, ended_at, stream_url, url, status, livekit_room_name';
  const payload: Record<string, unknown> = {
    is_live: true,
    current_prayer: prayer,
    started_at: startedAt,
    ended_at: null,
    status: 'active',
    livekit_room_name: livekitRoomName,
  };
  if (playbackUrl) {
    payload.stream_url = playbackUrl;
    payload.url = playbackUrl;
  }

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('streams')
      .update(payload as any)
      .eq('id', existing.id)
      .select(cols)
      .maybeSingle<StreamRow>();

    if (error) throw error;
    return data ?? { ...existing, ...payload };
  }

  const { data, error } = await supabaseAdmin
    .from('streams')
    .insert({ mosque_id: mosqueId, ...payload } as any)
    .select(cols)
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
    const access = await ensureMuezzinMosqueAccess(auth.supabaseAdmin, auth.userId, mosqueId);

    if (action === 'start') {
      const startedAt = new Date().toISOString();
      const prayer = normalizePrayer(body.prayer);
      const scheduledAt = normalizeScheduledAt(body.scheduledAt);
      await assertUserCanStartRealBroadcast(
        auth.supabaseAdmin,
        access,
        auth.userId,
        mosqueId,
        prayer,
        scheduledAt,
        body.adhanId ?? null
      );
      await assertBroadcastWindow(auth.supabaseAdmin, mosqueId, auth.userId, prayer, body.adhanId ?? null, scheduledAt);
      const { playbackUrl, provider, summary } = await requireMosqueBroadcastReady(auth.supabaseAdmin, mosqueId);
      const livekitRoomName = provider === 'livekit'
        ? computeLiveKitRoomName(mosqueId, prayer, scheduledAt)
        : null;
      const stream = await startOrCreateStream(auth.supabaseAdmin, mosqueId, prayer, startedAt, playbackUrl, livekitRoomName);
      await startOrCreateAdhan(auth.supabaseAdmin, mosqueId, prayer, scheduledAt, body.adhanId ?? null, startedAt, stream?.id ?? null);
      const upstreamState = await fetchMosqueLiveStreamUpstreamState(auth.supabaseAdmin, mosqueId);
      const config = attachMosqueLiveUpstreamState(await attachMosqueLiveHealthChecks(summary), upstreamState);
      return json({ stream, config });
    }

    const endedAt = new Date().toISOString();
    // Fetch current stream before ending so we can clean up the LiveKit room.
    const activeStream = await fetchLatestStreamRow(auth.supabaseAdmin, mosqueId);
    const [stream, mosqueConfig, upstreamState] = await Promise.all([
      endCurrentStream(auth.supabaseAdmin, mosqueId, endedAt),
      fetchMosqueLiveStreamConfig(auth.supabaseAdmin, mosqueId),
      fetchMosqueLiveStreamUpstreamState(auth.supabaseAdmin, mosqueId),
    ]);
    await completeAdhan(auth.supabaseAdmin, mosqueId, body.adhanId ?? null, endedAt);
    // Terminate the LiveKit room so all listeners are immediately disconnected.
    if (activeStream?.livekit_room_name) {
      await deleteLiveKitRoom(activeStream.livekit_room_name);
    }
    const config = attachMosqueLiveUpstreamState(
      await attachMosqueLiveHealthChecks(summarizeMosqueLiveBroadcastConfig(mosqueConfig)),
      upstreamState
    );
    return json({ stream, config });
  } catch (error: any) {
    const message = error?.message ?? 'Unable to update the live broadcast state.';
    const forbidden =
      message === 'You do not have muezzin access to this mosque.' ||
      message.startsWith('Only the assigned muezzin') ||
      message.startsWith('Too early') ||
      message.startsWith('The broadcast window');
    return json({ error: message }, forbidden ? 403 : 500);
  }
};
