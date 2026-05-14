import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';
import { computeLiveKitRoomName, createPublisherToken, getLiveKitWssUrl, isLiveKitConfigured } from '../../../lib/server/livekitRoom';
import { resolveMuezzinMosquesForUser } from '../../../lib/server/muezzinAccess';
import { isFreshLiveStream } from '../../../lib/liveStreamFreshness';

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

  let body: { mosqueId?: string; prayer?: string; scheduledAt?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const mosqueId = body.mosqueId?.trim() ?? '';
  const prayer = (body.prayer?.trim() ?? 'adhan').toLowerCase();
  const scheduledAt = body.scheduledAt?.trim() ?? new Date().toISOString();

  if (!mosqueId) {
    return json({ error: 'mosqueId is required.' }, 400);
  }

  // Verify this user has muezzin access to the mosque.
  try {
    const allowedMosques = await resolveMuezzinMosquesForUser(supabaseAdmin, userId);
    if (!allowedMosques.some((m) => m.mosqueId === mosqueId)) {
      return json({ error: 'You do not have muezzin access to this mosque.' }, 403);
    }
  } catch {
    return json({ error: 'Could not verify mosque access.' }, 500);
  }

  const { data: activeStream, error: streamError } = await supabaseAdmin
    .from('streams')
    .select('id, is_live, current_prayer, started_at, livekit_room_name')
    .eq('mosque_id', mosqueId)
    .eq('is_live', true)
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      is_live: boolean;
      current_prayer: string | null;
      started_at: string | null;
      livekit_room_name: string | null;
    }>();

  if (streamError) {
    return json({ error: 'Could not look up the active LiveKit room.' }, 500);
  }

  const expectedRoomName = computeLiveKitRoomName(mosqueId, prayer, scheduledAt);
  const activeRoomName = activeStream?.livekit_room_name?.trim() ?? '';
  const activePrayer = activeStream?.current_prayer?.trim().toLowerCase() ?? '';
  const activeStreamIsFresh = isFreshLiveStream(activeStream);
  const activeStreamMatchesRequest =
    activeStreamIsFresh &&
    activePrayer === prayer &&
    activeRoomName === expectedRoomName;

  if (activeStream && activeStreamIsFresh && !activeStreamMatchesRequest) {
    console.warn('[muezzin.livekit-token] refusing conflicting active stream', {
      streamId: activeStream.id,
      activePrayer,
      activeRoomName,
      expectedRoomName,
      startedAt: activeStream.started_at,
    });
    return json(
      {
        error: 'Another live broadcast is still active for this mosque. Please refresh the broadcast screen and start the current adhan again.',
        activePrayer,
        activeRoomName,
        expectedRoomName,
      },
      409
    );
  }

  const roomName = activeStreamMatchesRequest ? activeRoomName : expectedRoomName;

  if (activeStream && !activeStreamMatchesRequest) {
    console.warn('[muezzin.livekit-token] ignoring stale or mismatched active stream', {
      streamId: activeStream.id,
      activePrayer,
      activeRoomName,
      expectedRoomName,
      startedAt: activeStream.started_at,
    });
  }

  try {
    const token = await createPublisherToken(userId, roomName);
    return json({ token, roomName, livekitUrl: getLiveKitWssUrl() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not generate token.';
    return json({ error: message }, 500);
  }
};
