import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';
import { validateMosquePlaybackAccess } from '../../lib/server/liveStreamListenerAccess';
import {
  fetchAllowedLiveStreamUpstream,
  LiveStreamUpstreamError,
  prepareContinuousPlaybackBody,
} from '../../lib/server/liveStreamUpstreamPolicy';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

function copyIfPresent(headers: Headers, source: Headers, name: string) {
  const value = source.get(name);
  if (value) {
    headers.set(name, value);
  }
}

async function authorizePlayback(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl) {
    return json({ error: 'Server is missing SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.' }, 500);
  }
  if (!serviceRoleKey) {
    return json({ error: 'Server is missing SUPABASE_SERVICE_ROLE.' }, 500);
  }

  const url = new URL(request.url);
  const mosqueId = (url.searchParams.get('mosqueId') ?? '').trim();
  const streamId = (url.searchParams.get('streamId') ?? '').trim();
  const expires = (url.searchParams.get('expires') ?? '').trim();
  const subject = (url.searchParams.get('subject') ?? '').trim();
  const token = (url.searchParams.get('token') ?? '').trim();
  const requestedDelivery = (url.searchParams.get('delivery') ?? '').trim();
  const delivery = requestedDelivery === 'proxy' ? requestedDelivery : null;

  if (!mosqueId || !streamId || !expires || !subject || !token || !delivery) {
    return json({ error: 'Live stream playback request is missing required query parameters.' }, 400);
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const context = await validateMosquePlaybackAccess({
      supabaseAdmin,
      mosqueId,
      streamId,
      expires,
      subject,
      delivery,
      token,
    });

    const method = request.method === 'HEAD' ? 'HEAD' : 'GET';
    const { response: upstreamResponse } = await fetchAllowedLiveStreamUpstream(
      context.playbackUrl,
      {
        method,
        rejectHls: true,
        // The listener proxy supports continuous audio, not playlists or
        // random-access media. Do not forward client Range/Accept headers that
        // could make one upstream URL negotiate an uninspected HLS response.
        headers: {
          Accept: 'audio/aac,audio/aacp,audio/mpeg,audio/ogg,application/ogg,application/octet-stream',
          ...(request.headers.get('icy-metadata')
            ? { 'Icy-Metadata': request.headers.get('icy-metadata') as string }
            : {}),
        },
      }
    );

    if (upstreamResponse.status !== 200) {
      await upstreamResponse.body?.cancel().catch(() => {});
      return json(
        {
          error: `Upstream playback failed with status ${upstreamResponse.status}.`,
        },
        502
      );
    }

    const playbackBody = await prepareContinuousPlaybackBody(
      upstreamResponse,
      method
    );

    const responseHeaders = new Headers();
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'content-type');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-br');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-description');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-genre');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-metaint');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-name');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-pub');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-url');
    responseHeaders.set('Cache-Control', 'private, no-store, max-age=0');
    responseHeaders.set('Referrer-Policy', 'no-referrer');

    return new Response(method === 'HEAD' ? null : playbackBody, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    if (error instanceof LiveStreamUpstreamError) {
      return json({ error: error.message }, error.status);
    }
    const message = error?.message ?? 'Unable to authorize this live stream.';
    const status = /expired|invalid|access/i.test(message)
      ? 403
      : /not currently have an active live broadcast|no playback url|no longer active/i.test(message)
      ? 404
      : 500;
    return json({ error: message }, status);
  }
}

export const GET: RequestHandler = authorizePlayback;
export const HEAD: RequestHandler = authorizePlayback;
