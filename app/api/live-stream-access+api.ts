import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';
import { issueMosquePlaybackAccessUrl } from '../../lib/server/liveStreamListenerAccess';
import { requireCurrentAccountConsent } from '../../lib/server/accountConsentAccess';
import { LiveStreamUpstreamError } from '../../lib/server/liveStreamUpstreamPolicy';

type AccessInput = {
  mosqueId: string;
  streamId: string | null;
  delivery: 'proxy';
  location: { latitude: number; longitude: number } | null;
};

const MAX_ACCESS_BODY_BYTES = 4_096;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

function parseCoordinate(value: unknown, min: number, max: number) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function normalizeAccessInput(value: unknown): AccessInput | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const mosqueId = typeof input.mosqueId === 'string' ? input.mosqueId.trim() : '';
  const streamId = typeof input.streamId === 'string' ? input.streamId.trim() || null : null;
  // Provider playback URLs remain server-side. The client cannot request a
  // redirect that would outlive the signed access grant.
  const delivery = 'proxy' as const;
  let location: AccessInput['location'] = null;

  if (input.location && typeof input.location === 'object') {
    const rawLocation = input.location as Record<string, unknown>;
    const latitude = parseCoordinate(rawLocation.latitude, -90, 90);
    const longitude = parseCoordinate(rawLocation.longitude, -180, 180);
    if (latitude == null || longitude == null) return null;
    location = { latitude, longitude };
  }

  return mosqueId ? { mosqueId, streamId, delivery, location } : null;
}

async function readAccessBody(request: Request) {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const parsedLength = Number.parseInt(contentLength, 10);
    if (
      !Number.isFinite(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > MAX_ACCESS_BODY_BYTES
    ) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
  }

  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let rawBody = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > MAX_ACCESS_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    rawBody += decoder.decode(value, { stream: true });
  }
  rawBody += decoder.decode();
  return JSON.parse(rawBody) as unknown;
}

async function authorizeAccess(request: Request, input: AccessInput) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server configuration error.' }, 500);
  }

  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) {
    return json({ error: 'Missing bearer token.' }, 401);
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return json({ error: 'Session is invalid or has expired.' }, 401);
    }

    const consentAccess = await requireCurrentAccountConsent(
      supabaseAdmin,
      authData.user
    );
    if (!consentAccess.granted) return consentAccess.response;

    const payload = await issueMosquePlaybackAccessUrl({
      request,
      supabaseAdmin,
      userId: authData.user.id,
      mosqueId: input.mosqueId,
      streamId: input.streamId,
      delivery: input.delivery,
      listenerLocation: input.location,
    });

    return json(payload);
  } catch (error: any) {
    if (error instanceof LiveStreamUpstreamError) {
      return json({ error: error.message }, error.status);
    }
    const message = error?.message ?? 'Unable to authorize this live stream.';
    const status = /access|expired|invalid|not have access/i.test(message)
      ? 403
      : /not currently have an active live broadcast|no playback url|moved on/i.test(message)
      ? 404
      : 500;
    return json({ error: message }, status);
  }
}

export const POST: RequestHandler = async (request) => {
  let body: unknown;
  try {
    body = await readAccessBody(request);
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
      return json({ error: 'Request body is too large.' }, 413);
    }
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const input = normalizeAccessInput(body);
  if (!input) {
    return json({ error: 'A valid mosqueId and optional location are required.' }, 400);
  }
  return authorizeAccess(request, input);
};

// Backwards compatibility for already-released clients. New clients use POST so
// precise coordinates are not placed in request URLs or routine URL logs.
export const GET: RequestHandler = async (request) => {
  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  const input = normalizeAccessInput({
    mosqueId: url.searchParams.get('mosqueId'),
    streamId: url.searchParams.get('streamId'),
    delivery: url.searchParams.get('delivery'),
    location:
      lat != null && lng != null
        ? {
            latitude: lat,
            longitude: lng,
          }
        : null,
  });
  if (!input) {
    return json({ error: 'A valid mosqueId and optional location are required.' }, 400);
  }
  return authorizeAccess(request, input);
};
