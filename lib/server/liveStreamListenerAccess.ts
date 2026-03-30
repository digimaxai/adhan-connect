import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeLiveStreamProvider,
  normalizePlaybackUrl,
  resolveLiveStreamListenerSecret,
  resolveLiveStreamMountPath,
  type MosqueLiveStreamConfigRow,
} from '../liveStreamProviders';
import { isFreshLiveStream } from '../liveStreamFreshness';

type LiveStreamRow = {
  id: string;
  mosque_id: string;
  is_live?: boolean | null;
  status?: string | null;
  stream_url?: string | null;
  url?: string | null;
  started_at?: string | null;
};

type MosqueListenerConfigRow = MosqueLiveStreamConfigRow & {
  live_stream_mount_path?: string | null;
  live_stream_listener_secret?: string | null;
};

type ListenerPlaybackContext = {
  config: MosqueListenerConfigRow;
  stream: LiveStreamRow;
  playbackUrl: string;
  listenerSecret: string;
  mountPath: string | null;
  provider: ReturnType<typeof normalizeLiveStreamProvider>;
};

export type IssuedMosquePlaybackAccess = {
  mosqueId: string;
  streamId: string;
  streamUrl: string;
  expiresAt: string;
  provider: ReturnType<typeof normalizeLiveStreamProvider>;
  mountPath: string | null;
};

const DEFAULT_ACCESS_TTL_MS = 10 * 60 * 1000;
const textEncoder = new TextEncoder();

function safeNormalizePlaybackUrl(value?: string | null) {
  try {
    return normalizePlaybackUrl(value);
  } catch {
    return null;
  }
}

function getServerCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Server crypto is unavailable for live stream signing.');
  }
  return globalThis.crypto;
}

async function signHmacHex(secret: string, message: string) {
  const cryptoImpl = getServerCrypto();
  const key = await cryptoImpl.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await cryptoImpl.subtle.sign('HMAC', key, textEncoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function buildPlaybackTokenMessage(mosqueId: string, streamId: string, expiresAtMs: number) {
  return `${mosqueId}:${streamId}:${expiresAtMs}`;
}

async function fetchListenerPlaybackContext(
  supabaseAdmin: SupabaseClient<any, any, any>,
  mosqueId: string
): Promise<ListenerPlaybackContext> {
  const [mosqueRes, streamRes] = await Promise.all([
    supabaseAdmin
      .from('mosques')
      .select('id, name, live_stream_provider, live_stream_playback_url, live_stream_mount_path, live_stream_listener_secret, live_stream_status_secret')
      .eq('id', mosqueId)
      .maybeSingle<MosqueListenerConfigRow>(),
    supabaseAdmin
      .from('streams')
      .select('id, mosque_id, is_live, status, stream_url, url, started_at')
      .eq('mosque_id', mosqueId)
      .eq('is_live', true)
      .order('started_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(1),
  ]);

  if (mosqueRes.error) throw mosqueRes.error;
  if (!mosqueRes.data) {
    throw new Error('The selected mosque could not be found.');
  }

  if (streamRes.error) throw streamRes.error;
  const stream = ((streamRes.data ?? []) as LiveStreamRow[])[0] ?? null;
  if (!stream?.id || !isFreshLiveStream(stream)) {
    throw new Error('This mosque does not currently have an active live broadcast.');
  }

  const playbackUrl =
    safeNormalizePlaybackUrl(stream.stream_url) ||
    safeNormalizePlaybackUrl(stream.url) ||
    safeNormalizePlaybackUrl(mosqueRes.data.live_stream_playback_url);

  if (!playbackUrl) {
    throw new Error('This mosque is live, but no playback URL is configured.');
  }

  const listenerSecret = resolveLiveStreamListenerSecret(mosqueRes.data);
  if (!listenerSecret) {
    throw new Error('This mosque is missing a listener access secret.');
  }

  return {
    config: mosqueRes.data,
    stream,
    playbackUrl,
    listenerSecret,
    mountPath: resolveLiveStreamMountPath(mosqueRes.data),
    provider: normalizeLiveStreamProvider(mosqueRes.data.live_stream_provider),
  };
}

export async function ensureUserCanAccessMosquePlayback(
  supabaseAdmin: SupabaseClient<any, any, any>,
  userId: string,
  mosqueId: string
) {
  const [userRes, subscriptionRes, adminRes, muezzinRes] = await Promise.all([
    supabaseAdmin.from('users').select('role').eq('id', userId).maybeSingle<{ role?: string | null }>(),
    supabaseAdmin
      .from('subscriptions')
      .select('mosque_id')
      .eq('user_id', userId)
      .eq('mosque_id', mosqueId)
      .limit(1)
      .maybeSingle<{ mosque_id?: string | null }>(),
    supabaseAdmin
      .from('mosque_admins')
      .select('mosque_id')
      .eq('user_id', userId)
      .eq('mosque_id', mosqueId)
      .limit(1)
      .maybeSingle<{ mosque_id?: string | null }>(),
    supabaseAdmin
      .from('muezzins')
      .select('mosque_id, is_active')
      .eq('user_id', userId)
      .eq('mosque_id', mosqueId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle<{ mosque_id?: string | null }>(),
  ]);

  if (userRes.error) throw userRes.error;
  if (subscriptionRes.error && subscriptionRes.error.code !== 'PGRST116') throw subscriptionRes.error;
  if (adminRes.error && adminRes.error.code !== 'PGRST116') throw adminRes.error;
  if (muezzinRes.error && muezzinRes.error.code !== 'PGRST116') throw muezzinRes.error;

  const isMainAdmin = userRes.data?.role === 'main_admin';
  const hasFollowerAccess = !!subscriptionRes.data?.mosque_id;
  const hasAdminAccess = !!adminRes.data?.mosque_id;
  const hasMuezzinAccess = !!muezzinRes.data?.mosque_id;

  if (isMainAdmin || hasFollowerAccess || hasAdminAccess || hasMuezzinAccess) {
    return;
  }

  throw new Error('You do not have access to this mosque live stream.');
}

export async function issueMosquePlaybackAccessUrl(args: {
  request: Request;
  supabaseAdmin: SupabaseClient<any, any, any>;
  userId: string;
  mosqueId: string;
  streamId?: string | null;
  ttlMs?: number;
  delivery?: 'proxy' | 'redirect';
}) {
  await ensureUserCanAccessMosquePlayback(args.supabaseAdmin, args.userId, args.mosqueId);
  const context = await fetchListenerPlaybackContext(args.supabaseAdmin, args.mosqueId);

  if (args.streamId && context.stream.id !== args.streamId) {
    throw new Error('This live stream has moved on. Refresh and try again.');
  }

  const expiresAtMs = Date.now() + Math.max(30_000, args.ttlMs ?? DEFAULT_ACCESS_TTL_MS);
  const token = await signHmacHex(
    context.listenerSecret,
    buildPlaybackTokenMessage(args.mosqueId, context.stream.id, expiresAtMs)
  );
  const playbackUrl = new URL('/api/live-stream-playback', args.request.url);
  playbackUrl.searchParams.set('mosqueId', args.mosqueId);
  playbackUrl.searchParams.set('streamId', context.stream.id);
  playbackUrl.searchParams.set('expires', String(expiresAtMs));
  playbackUrl.searchParams.set('token', token);
  if (args.delivery === 'redirect') {
    playbackUrl.searchParams.set('delivery', 'redirect');
  }

  return {
    mosqueId: args.mosqueId,
    streamId: context.stream.id,
    streamUrl: playbackUrl.toString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    provider: context.provider,
    mountPath: context.mountPath,
  } satisfies IssuedMosquePlaybackAccess;
}

export async function validateMosquePlaybackAccess(args: {
  supabaseAdmin: SupabaseClient<any, any, any>;
  mosqueId: string;
  streamId: string;
  expires: string;
  token: string;
}) {
  const expiresAtMs = Number(args.expires);
  if (!Number.isFinite(expiresAtMs)) {
    throw new Error('Live stream access expiry is invalid.');
  }
  if (expiresAtMs < Date.now()) {
    throw new Error('Live stream access has expired.');
  }

  const context = await fetchListenerPlaybackContext(args.supabaseAdmin, args.mosqueId);
  if (context.stream.id !== args.streamId) {
    throw new Error('The requested live stream is no longer active.');
  }

  const expected = await signHmacHex(
    context.listenerSecret,
    buildPlaybackTokenMessage(args.mosqueId, args.streamId, expiresAtMs)
  );

  if (expected !== args.token) {
    throw new Error('Live stream access token is invalid.');
  }

  return context;
}
