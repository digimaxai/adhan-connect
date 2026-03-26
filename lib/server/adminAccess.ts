import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type JsonResponse = { response: Response };

export type AdminAccessContext = {
  supabaseAdmin: SupabaseClient<any, any, any>;
  userId: string;
  isMainAdmin: boolean;
  adminMosqueIds: string[];
  muezzinMosqueIds: string[];
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function requireAdminAccess(
  request: Request
): Promise<JsonResponse | { context: AdminAccessContext }> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl) {
    return { response: json({ error: 'Server is missing SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.' }, 500) };
  }

  if (!serviceRoleKey) {
    return { response: json({ error: 'Server is missing SUPABASE_SERVICE_ROLE.' }, 500) };
  }

  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) {
    return { response: json({ error: 'Missing bearer token.' }, 401) };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return { response: json({ error: 'Session is invalid or has expired.' }, 401) };
  }

  const userId = authData.user.id;
  const [userRes, adminRes, muezzinRes] = await Promise.all([
    supabaseAdmin.from('users').select('role').eq('id', userId).maybeSingle<{ role?: string | null }>(),
    supabaseAdmin.from('mosque_admins').select('mosque_id').eq('user_id', userId),
    supabaseAdmin.from('muezzins').select('mosque_id, is_active').eq('user_id', userId),
  ]);

  if (userRes.error) {
    return { response: json({ error: userRes.error.message || 'Unable to load the user role.' }, 500) };
  }

  if (adminRes.error) {
    return { response: json({ error: adminRes.error.message || 'Unable to load mosque-admin access.' }, 500) };
  }

  if (muezzinRes.error) {
    return { response: json({ error: muezzinRes.error.message || 'Unable to load muezzin access.' }, 500) };
  }

  const isMainAdmin = userRes.data?.role === 'main_admin';
  const adminMosqueIds = Array.from(
    new Set((adminRes.data ?? []).map((row: any) => row?.mosque_id).filter(Boolean))
  ) as string[];
  const muezzinMosqueIds = Array.from(
    new Set(
      (muezzinRes.data ?? [])
        .filter((row: any) => row?.is_active !== false)
        .map((row: any) => row?.mosque_id)
        .filter(Boolean)
    )
  ) as string[];

  if (!isMainAdmin && !adminMosqueIds.length) {
    return { response: json({ error: 'Only main admins and mosque local admins can access this admin workspace.' }, 403) };
  }

  return {
    context: {
      supabaseAdmin,
      userId,
      isMainAdmin,
      adminMosqueIds,
      muezzinMosqueIds,
    },
  };
}

export function hasMosqueAdminAccess(context: AdminAccessContext, mosqueId: string) {
  return context.isMainAdmin || context.adminMosqueIds.includes(mosqueId);
}
