import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';
import { createSubscriberToken, getLiveKitWssUrl, isLiveKitConfigured } from '../../../lib/server/livekitRoom';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: RequestHandler = async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server configuration error.' }, 500);
  }
  if (!isLiveKitConfigured()) {
    return json({ error: 'LiveKit is not configured on this server.' }, 503);
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) {
    return json({ error: 'Missing bearer token.' }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return json({ error: 'Session is invalid or has expired.' }, 401);
  }
  const userId = authData.user.id;

  let body: { mosqueId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const mosqueId = body.mosqueId?.trim() ?? '';
  if (!mosqueId) {
    return json({ error: 'mosqueId is required.' }, 400);
  }

  // Verify the mosque is currently live and has a LiveKit room.
  const { data: streamData, error: streamError } = await supabaseAdmin
    .from('streams')
    .select('id, is_live, livekit_room_name')
    .eq('mosque_id', mosqueId)
    .eq('is_live', true)
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{ id: string; is_live: boolean; livekit_room_name: string | null }>();

  if (streamError) {
    return json({ error: 'Could not look up stream.' }, 500);
  }
  if (!streamData?.is_live || !streamData?.livekit_room_name) {
    return json({ error: 'No active LiveKit broadcast for this mosque.' }, 404);
  }

  const roomName = streamData.livekit_room_name;

  try {
    const token = await createSubscriberToken(userId, roomName);
    return json({ token, roomName, livekitUrl: getLiveKitWssUrl() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not generate token.';
    return json({ error: message }, 500);
  }
};
