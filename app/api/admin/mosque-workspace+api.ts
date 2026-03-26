import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';

type MosqueRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status?: string | null;
  allow_multi_mosque_local_admins?: boolean | null;
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

  const [mosqueRes, mosquesRes, adminsRes, muezzinRes] = await Promise.all([
    supabaseAdmin
      .from('mosques')
      .select('id, name, city, country, status, allow_multi_mosque_local_admins, created_at')
      .eq('id', mosqueId)
      .maybeSingle(),
    supabaseAdmin
      .from('mosques')
      .select('id, name, city, country, status, allow_multi_mosque_local_admins')
      .order('name', { ascending: true })
      .limit(500),
    supabaseAdmin.from('mosque_admins').select('user_id, mosque_id').eq('mosque_id', mosqueId),
    supabaseAdmin.from('muezzins').select('user_id, mosque_id, is_active').eq('mosque_id', mosqueId),
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
  });
};
