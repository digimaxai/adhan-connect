import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';
import { resolveMuezzinMosquesForUser } from '../../lib/server/muezzinAccess';
import { fetchAllMosqueRows } from '../../lib/api/admin/mosqueDirectory';

type MosqueSummary = {
  mosqueId: string;
  name: string;
  city?: string | null;
  country?: string | null;
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

  const userId = authData.user.id;

  const [userRes, adminRes, mosquesRes] = await Promise.all([
    supabaseAdmin.from('users').select('role').eq('id', userId).maybeSingle<{ role?: string | null }>(),
    supabaseAdmin
      .from('mosque_admins')
      .select('mosque_id, mosques(id, name, city, country)')
      .eq('user_id', userId),
    fetchAllMosqueRows(supabaseAdmin, 'id, name, city, country'),
  ]);

  if (userRes.error) {
    return json({ error: userRes.error.message || 'Unable to load the user role.' }, 500);
  }

  if (adminRes.error) {
    return json({ error: adminRes.error.message || 'Unable to load mosque admin access.' }, 500);
  }

  if (mosquesRes.error) {
    return json({ error: mosquesRes.error.message || 'Unable to load mosque access.' }, 500);
  }

  const globalRole = userRes.data?.role === 'main_admin' ? 'main_admin' : 'user';

  const membershipAdminMosques = (adminRes.data ?? [])
    .map((row: any) => {
      const mosque = row?.mosques;
      if (!mosque?.id) return null;
      return {
        mosqueId: mosque.id,
        name: mosque.name ?? 'Mosque',
        city: mosque.city ?? null,
        country: mosque.country ?? null,
      } satisfies MosqueSummary;
    })
    .filter(Boolean) as MosqueSummary[];

  const adminMosques =
    globalRole === 'main_admin'
      ? ((mosquesRes.data ?? []).map((mosque: any) => ({
          mosqueId: mosque.id,
          name: mosque.name ?? 'Mosque',
          city: mosque.city ?? null,
          country: mosque.country ?? null,
        })) as MosqueSummary[])
      : membershipAdminMosques;

  let muezzinMosques: MosqueSummary[] = [];
  try {
    muezzinMosques = (await resolveMuezzinMosquesForUser(supabaseAdmin, userId)) as MosqueSummary[];
  } catch (muezzinError: any) {
    return json({ error: muezzinError?.message || 'Unable to load muezzin access.' }, 500);
  }

  const effectiveRole =
    globalRole === 'main_admin'
      ? 'main_admin'
      : adminMosques.length
      ? 'local_admin'
      : muezzinMosques.length
      ? 'muezzin'
      : 'user';

  return json({
    globalRole,
    effectiveRole,
    isMainAdmin: globalRole === 'main_admin',
    isLocalAdmin: adminMosques.length > 0,
    isMuezzin: muezzinMosques.length > 0,
    adminMosques,
    muezzinMosques,
  });
};
