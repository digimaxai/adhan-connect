import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';
import { fetchAllMosqueRows } from '../../../lib/api/admin/mosqueDirectory';

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
  allow_multi_mosque_local_admins?: boolean | null;
  lat?: number | null;
  lng?: number | null;
  prayer_calculation_method?: number | null;
  prayer_school?: number | null;
  prayer_source?: string | null;
  live_stream_enabled?: boolean | null;
  live_stream_provider?: string | null;
  live_stream_playback_url?: string | null;
  live_stream_ingest_url?: string | null;
  live_stream_mount_path?: string | null;
  live_stream_username?: string | null;
  live_stream_stream_key?: string | null;
  live_stream_status_secret?: string | null;
  live_stream_listener_secret?: string | null;
  created_at?: string | null;
};

type AssignmentUser = {
  id: string;
  email: string | null;
  role: string | null;
  created_at?: string | null;
};

type MosqueAdmin = { user_id: string; mosque_id: string };
type MuezzinRow = { user_id: string; mosque_id: string; is_active?: boolean | null };
type UpstreamStateRow = {
  mosque_id: string;
  provider_status?: string | null;
  encoder_connected?: boolean | null;
  playback_active?: boolean | null;
  provider_stream_id?: string | null;
  provider_message?: string | null;
  last_seen_at?: string | null;
  updated_at?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
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
  if (!mosqueId) {
    return json({ error: 'A mosqueId query parameter is required.' }, 400);
  }

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

  const { data: requesterProfile, error: requesterError } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (requesterError || !requesterProfile || requesterProfile.role !== 'main_admin') {
    return json({ error: 'Only main admin users can access the mosque workspace.' }, 403);
  }

  let mosqueRes = await supabaseAdmin
    .from('mosques')
    .select('id, name, city, country, status, allow_multi_mosque_local_admins, lat, lng, prayer_calculation_method, prayer_school, prayer_source, live_stream_enabled, live_stream_provider, live_stream_playback_url, live_stream_ingest_url, live_stream_mount_path, live_stream_username, live_stream_stream_key, live_stream_status_secret, live_stream_listener_secret, created_at')
    .eq('id', mosqueId)
    .maybeSingle();

  if (mosqueRes.error?.code === '42703') {
    mosqueRes = await supabaseAdmin
      .from('mosques')
      .select('id, name, city, country, status, allow_multi_mosque_local_admins, lat, lng, prayer_calculation_method, prayer_school, live_stream_enabled, live_stream_provider, live_stream_playback_url, live_stream_ingest_url, live_stream_mount_path, live_stream_username, live_stream_stream_key, live_stream_status_secret, live_stream_listener_secret, created_at')
      .eq('id', mosqueId)
      .maybeSingle();
  }

  const [mosquesRes, adminsRes, muezzinRes, upstreamStateRes] = await Promise.all([
    fetchAllMosqueRows<MosqueRow>(
      supabaseAdmin,
      'id, name, city, country, status, allow_multi_mosque_local_admins'
    ),
    supabaseAdmin.from('mosque_admins').select('user_id, mosque_id').eq('mosque_id', mosqueId),
    supabaseAdmin.from('muezzins').select('user_id, mosque_id, is_active').eq('mosque_id', mosqueId),
    supabaseAdmin
      .from('mosque_live_stream_upstream_states')
      .select('mosque_id, provider_status, encoder_connected, playback_active, provider_stream_id, provider_message, last_seen_at, updated_at')
      .eq('mosque_id', mosqueId)
      .maybeSingle(),
  ]);

  if (mosqueRes.error) {
    return json({ error: mosqueRes.error.message || 'Unable to load the mosque.' }, 500);
  }

  if (!mosqueRes.data) {
    return json({ error: 'Mosque not found.' }, 404);
  }

  if (mosquesRes.error) {
    return json({ error: mosquesRes.error.message || 'Unable to load mosque options.' }, 500);
  }

  if (adminsRes.error) {
    return json({ error: adminsRes.error.message || 'Unable to load local-admin assignments.' }, 500);
  }

  if (muezzinRes.error) {
    return json({ error: muezzinRes.error.message || 'Unable to load muezzin assignments.' }, 500);
  }

  if (upstreamStateRes.error) {
    return json({ error: upstreamStateRes.error.message || 'Unable to load live stream provider state.' }, 500);
  }

  const admins = (adminsRes.data ?? []) as MosqueAdmin[];
  const activeMuezzins = ((muezzinRes.data ?? []) as MuezzinRow[]).filter((row) => row.is_active !== false);
  const userIds = Array.from(new Set([...admins.map((row) => row.user_id), ...activeMuezzins.map((row) => row.user_id)]));

  let people: AssignmentUser[] = [];
  if (userIds.length) {
    const peopleRes = await supabaseAdmin.from('users').select('id, email, role, created_at').in('id', userIds);
    if (peopleRes.error) {
      return json({ error: peopleRes.error.message || 'Unable to load assigned user profiles.' }, 500);
    }
    people = (peopleRes.data ?? []) as AssignmentUser[];
  }

  return json({
    mosque: mosqueRes.data as MosqueRow,
    mosques: (mosquesRes.data ?? []) as MosqueRow[],
    admins,
    muezzins: activeMuezzins,
    people,
    upstreamState: (upstreamStateRes.data ?? null) as UpstreamStateRow | null,
  });
};
