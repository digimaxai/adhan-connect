import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';
import { validateMosquePlaybackAccess } from '../../lib/server/liveStreamListenerAccess';

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

function redirectToPlayback(url: string) {
  return new Response(null, {
    status: 307,
    headers: {
      Location: url,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
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
  const token = (url.searchParams.get('token') ?? '').trim();
  const delivery = (url.searchParams.get('delivery') ?? '').trim() === 'redirect' ? 'redirect' : 'proxy';

  if (!mosqueId || !streamId || !expires || !token) {
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
      token,
    });

    if (delivery === 'redirect') {
      return redirectToPlayback(context.playbackUrl);
    }

    const upstreamResponse = await fetch(context.playbackUrl, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: {
        Accept: request.headers.get('accept') || '*/*',
        ...(request.headers.get('range') ? { Range: request.headers.get('range') as string } : {}),
        ...(request.headers.get('icy-metadata')
          ? { 'Icy-Metadata': request.headers.get('icy-metadata') as string }
          : {}),
      },
    });

    if (!upstreamResponse.ok) {
      return json(
        {
          error: `Upstream playback failed with status ${upstreamResponse.status}.`,
        },
        502
      );
    }

    const responseHeaders = new Headers();
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'content-type');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'content-length');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'accept-ranges');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-br');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-description');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-genre');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-metaint');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-name');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-pub');
    copyIfPresent(responseHeaders, upstreamResponse.headers, 'icy-url');
    responseHeaders.set('Cache-Control', 'private, no-store, max-age=0');

    return new Response(request.method === 'HEAD' ? null : upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
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
