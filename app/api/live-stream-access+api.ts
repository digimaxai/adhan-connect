import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';
import { issueMosquePlaybackAccessUrl } from '../../lib/server/liveStreamListenerAccess';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

export const GET: RequestHandler = async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl) {
    return json({ error: 'Server is missing SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.' }, 500);
  }
  if (!serviceRoleKey) {
    return json({ error: 'Server is missing SUPABASE_SERVICE_ROLE.' }, 500);
  }

  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) {
    return json({ error: 'Missing bearer token.' }, 401);
  }

  const url = new URL(request.url);
  const mosqueId = (url.searchParams.get('mosqueId') ?? '').trim();
  const streamId = (url.searchParams.get('streamId') ?? '').trim() || null;
  const delivery = (url.searchParams.get('delivery') ?? '').trim() === 'redirect' ? 'redirect' : 'proxy';
  if (!mosqueId) {
    return json({ error: 'A mosqueId query parameter is required.' }, 400);
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

    const payload = await issueMosquePlaybackAccessUrl({
      request,
      supabaseAdmin,
      userId: authData.user.id,
      mosqueId,
      streamId,
      delivery,
    });

    return json(payload);
  } catch (error: any) {
    const message = error?.message ?? 'Unable to authorize this live stream.';
    const status = /access|expired|invalid|not have access/i.test(message)
      ? 403
      : /not currently have an active live broadcast|no playback url|moved on/i.test(message)
      ? 404
      : 500;
    return json({ error: message }, status);
  }
};
