import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeLiveStreamProvider,
  normalizePlaybackUrl,
  resolveLiveStreamListenerSecret,
  resolveLiveStreamMountPath,
  type MosqueLiveStreamConfigRow,
} from '../liveStreamProviders';
import { isFreshLiveStream } from '../liveStreamFreshness';
import { assertAllowedLiveStreamUpstreamUrl } from './liveStreamUpstreamPolicy';

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

type MosqueLocationRow = {
  id: string;
  lat?: number | null;
  lng?: number | null;
};

export type ListenerLocation = {
  latitude?: number | null;
  longitude?: number | null;
};

type NormalizedListenerLocation = {
  latitude: number;
  longitude: number;
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
const MIN_ACCESS_TTL_MS = 30 * 1000;
const PLAYBACK_SUBJECT_VERSION = 'listener-subject-v1';
const PLAYBACK_TOKEN_VERSION = 'listener-playback-v2';
export const NEARBY_LIVE_ACCESS_RADIUS_KM = 30;
const textEncoder = new TextEncoder();
type PlaybackDelivery = 'proxy';

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

function buildPlaybackSubjectMessage(args: {
  userId: string;
  mosqueId: string;
  streamId: string;
  expiresAtMs: number;
  delivery: PlaybackDelivery;
}) {
  return JSON.stringify([
    PLAYBACK_SUBJECT_VERSION,
    args.userId,
    args.mosqueId,
    args.streamId,
    args.expiresAtMs,
    args.delivery,
  ]);
}

function buildPlaybackTokenMessage(args: {
  subject: string;
  mosqueId: string;
  streamId: string;
  expiresAtMs: number;
  delivery: PlaybackDelivery;
}) {
  return JSON.stringify([
    PLAYBACK_TOKEN_VERSION,
    args.subject,
    args.mosqueId,
    args.streamId,
    args.expiresAtMs,
    args.delivery,
  ]);
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function normalizeListenerLocation(location?: ListenerLocation | null): NormalizedListenerLocation | null {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function toRad(deg: number) {
  return deg * (Math.PI / 180);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNearbyDistanceKm(location: NormalizedListenerLocation | null, mosque?: MosqueLocationRow | null) {
  if (!location || mosque?.lat == null || mosque?.lng == null) return null;
  const mosqueLat = Number(mosque.lat);
  const mosqueLng = Number(mosque.lng);
  if (!Number.isFinite(mosqueLat) || !Number.isFinite(mosqueLng)) return null;
  return haversineKm(location.latitude, location.longitude, mosqueLat, mosqueLng);
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

  const configuredPlaybackUrl =
    safeNormalizePlaybackUrl(stream.stream_url) ||
    safeNormalizePlaybackUrl(stream.url) ||
    safeNormalizePlaybackUrl(mosqueRes.data.live_stream_playback_url);

  if (!configuredPlaybackUrl) {
    throw new Error('This mosque is live, but no playback URL is configured.');
  }
  const playbackUrl = assertAllowedLiveStreamUpstreamUrl(configuredPlaybackUrl, {
    rejectHls: true,
  }).toString();

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
  mosqueId: string,
  options?: { listenerLocation?: ListenerLocation | null }
) {
  const listenerLocation = normalizeListenerLocation(options?.listenerLocation);
  const [userRes, subscriptionRes, adminRes, muezzinRes, mosqueRes] = await Promise.all([
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
    listenerLocation
      ? supabaseAdmin
          .from('mosques')
          .select('id, lat, lng')
          .eq('id', mosqueId)
          .maybeSingle<MosqueLocationRow>()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (userRes.error) throw userRes.error;
  if (subscriptionRes.error && subscriptionRes.error.code !== 'PGRST116') throw subscriptionRes.error;
  if (adminRes.error && adminRes.error.code !== 'PGRST116') throw adminRes.error;
  if (muezzinRes.error && muezzinRes.error.code !== 'PGRST116') throw muezzinRes.error;
  if (mosqueRes.error && mosqueRes.error.code !== 'PGRST116') throw mosqueRes.error;

  const isMainAdmin = userRes.data?.role === 'main_admin';
  const hasFollowerAccess = !!subscriptionRes.data?.mosque_id;
  const hasAdminAccess = !!adminRes.data?.mosque_id;
  const hasMuezzinAccess = !!muezzinRes.data?.mosque_id;
  const nearbyDistanceKm = getNearbyDistanceKm(listenerLocation, mosqueRes.data);
  const hasNearbyAccess = nearbyDistanceKm !== null && nearbyDistanceKm <= NEARBY_LIVE_ACCESS_RADIUS_KM;

  if (isMainAdmin || hasFollowerAccess || hasAdminAccess || hasMuezzinAccess || hasNearbyAccess) {
    return {
      reason: isMainAdmin
        ? 'main-admin'
        : hasAdminAccess
        ? 'admin'
        : hasMuezzinAccess
        ? 'muezzin'
        : hasFollowerAccess
        ? 'followed'
        : 'nearby',
      nearbyDistanceKm,
    };
  }

  throw new Error('Follow this mosque or enable nearby access to listen to its live adhan.');
}

export async function issueMosquePlaybackAccessUrl(args: {
  request: Request;
  supabaseAdmin: SupabaseClient<any, any, any>;
  userId: string;
  mosqueId: string;
  streamId?: string | null;
  ttlMs?: number;
  delivery?: 'proxy';
  listenerLocation?: ListenerLocation | null;
}) {
  await ensureUserCanAccessMosquePlayback(args.supabaseAdmin, args.userId, args.mosqueId, {
    listenerLocation: args.listenerLocation,
  });
  const context = await fetchListenerPlaybackContext(args.supabaseAdmin, args.mosqueId);

  if (args.streamId && context.stream.id !== args.streamId) {
    throw new Error('This live stream has moved on. Refresh and try again.');
  }

  const requestedTtlMs =
    args.ttlMs != null && Number.isFinite(args.ttlMs)
      ? args.ttlMs
      : DEFAULT_ACCESS_TTL_MS;
  const ttlMs = Math.min(
    DEFAULT_ACCESS_TTL_MS,
    Math.max(MIN_ACCESS_TTL_MS, requestedTtlMs)
  );
  const expiresAtMs = Date.now() + ttlMs;
  const delivery: PlaybackDelivery = 'proxy';
  // The subject is scoped to this one grant. It proves that the token was
  // derived from the authenticated account without putting its raw UUID in
  // playback URLs, browser history, proxy logs, or upstream referrers.
  const subject = await signHmacHex(
    context.listenerSecret,
    buildPlaybackSubjectMessage({
      userId: args.userId,
      mosqueId: args.mosqueId,
      streamId: context.stream.id,
      expiresAtMs,
      delivery,
    })
  );
  const token = await signHmacHex(
    context.listenerSecret,
    buildPlaybackTokenMessage({
      subject,
      mosqueId: args.mosqueId,
      streamId: context.stream.id,
      expiresAtMs,
      delivery,
    })
  );
  const playbackUrl = new URL('/api/live-stream-playback', args.request.url);
  playbackUrl.searchParams.set('mosqueId', args.mosqueId);
  playbackUrl.searchParams.set('streamId', context.stream.id);
  playbackUrl.searchParams.set('expires', String(expiresAtMs));
  playbackUrl.searchParams.set('subject', subject);
  playbackUrl.searchParams.set('delivery', delivery);
  playbackUrl.searchParams.set('token', token);

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
  subject: string;
  delivery: PlaybackDelivery;
  token: string;
}) {
  const expiresAtMs = Number(args.expires);
  if (!Number.isSafeInteger(expiresAtMs)) {
    throw new Error('Live stream access expiry is invalid.');
  }
  if (expiresAtMs <= Date.now()) {
    throw new Error('Live stream access has expired.');
  }
  if (!/^[a-f0-9]{64}$/.test(args.subject) || !/^[a-f0-9]{64}$/.test(args.token)) {
    throw new Error('Live stream access token is invalid.');
  }

  const context = await fetchListenerPlaybackContext(args.supabaseAdmin, args.mosqueId);
  if (context.stream.id !== args.streamId) {
    throw new Error('The requested live stream is no longer active.');
  }

  const expected = await signHmacHex(
    context.listenerSecret,
    buildPlaybackTokenMessage({
      subject: args.subject,
      mosqueId: args.mosqueId,
      streamId: args.streamId,
      expiresAtMs,
      delivery: args.delivery,
    })
  );

  if (!constantTimeEqual(expected, args.token)) {
    throw new Error('Live stream access token is invalid.');
  }

  return context;
}
