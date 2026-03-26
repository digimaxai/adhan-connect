import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';

type UserRole = 'user' | 'local_admin' | 'main_admin' | 'muezzin';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function normalizeRoleFilter(value: string | null): 'all' | 'user' | 'main_admin' {
  if (value === 'user' || value === 'main_admin') return value;
  return 'all';
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
    return json({ error: 'Only main admin users can access the user access matrix.' }, 403);
  }

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get('page'), 0);
  const pageSize = Math.min(parsePositiveInt(url.searchParams.get('pageSize'), 20), 100);
  const search = (url.searchParams.get('search') ?? '').trim();
  const roleFilter = normalizeRoleFilter(url.searchParams.get('role'));

  const from = page * pageSize;
  const to = from + pageSize - 1;

  let usersQuery = supabaseAdmin
    .from('users')
    .select('id, email, role, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search) {
    usersQuery = usersQuery.ilike('email', `%${search}%`);
  }

  if (roleFilter !== 'all') {
    usersQuery = roleFilter === 'main_admin' ? usersQuery.eq('role', 'main_admin') : usersQuery.neq('role', 'main_admin');
  }

  const [usersRes, mosquesRes] = await Promise.all([
    usersQuery,
    supabaseAdmin
      .from('mosques')
      .select('id, name, city, country, status, allow_multi_mosque_local_admins')
      .order('name', { ascending: true })
      .limit(500),
  ]);

  if (usersRes.error) {
    return json({ error: usersRes.error.message || 'Unable to load users.' }, 500);
  }

  if (mosquesRes.error) {
    return json({ error: mosquesRes.error.message || 'Unable to load mosques.' }, 500);
  }

  const users = (usersRes.data ?? []) as {
    id: string;
    email: string | null;
    role: UserRole;
    created_at: string | null;
  }[];
  const ids = users.map((user) => user.id);

  const adminAssignments: Record<string, string[]> = {};
  const muezzinAssignments: Record<string, string[]> = {};

  if (ids.length) {
    const [adminRes, muezzinRes] = await Promise.all([
      supabaseAdmin.from('mosque_admins').select('user_id, mosque_id').in('user_id', ids),
      supabaseAdmin.from('muezzins').select('user_id, mosque_id, is_active').in('user_id', ids),
    ]);

    if (adminRes.error) {
      return json({ error: adminRes.error.message || 'Unable to load mosque admin assignments.' }, 500);
    }

    if (muezzinRes.error) {
      return json({ error: muezzinRes.error.message || 'Unable to load muezzin assignments.' }, 500);
    }

    for (const row of adminRes.data ?? []) {
      adminAssignments[row.user_id] = adminAssignments[row.user_id] ?? [];
      adminAssignments[row.user_id].push(row.mosque_id);
    }

    for (const row of muezzinRes.data ?? []) {
      if ((row as { is_active?: boolean | null }).is_active === false) continue;
      muezzinAssignments[row.user_id] = muezzinAssignments[row.user_id] ?? [];
      muezzinAssignments[row.user_id].push(row.mosque_id);
    }
  }

  return json({
    users,
    totalCount: usersRes.count ?? 0,
    mosques: mosquesRes.data ?? [],
    adminAssignments,
    muezzinAssignments,
  });
};
