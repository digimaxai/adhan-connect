import type { Session } from '@supabase/supabase-js';
import { fetchSessionAccess } from '../../sessionAccess';
import { supabase } from '../../supabase';
import { fetchAllMosqueRows } from './mosqueDirectory';

export type AdminMosqueSummary = {
  mosqueId: string;
  name: string;
  city?: string | null;
  country?: string | null;
};

type GetAdminMosquesOptions = {
  /**
   * Supplying the mounted auth session avoids reacquiring Supabase's auth lock
   * while another write (for example notification preferences) is settling.
   */
  session?: Session | null;
  timeoutMs?: number;
  signal?: AbortSignal;
};

const DEFAULT_ADMIN_MOSQUE_TIMEOUT_MS = 10_000;

async function loadAdminMosquesForCurrentUser(
  options: GetAdminMosquesOptions = {}
): Promise<{ mosques: AdminMosqueSummary[]; error: string | null }> {
  try {
    let authUser = options.session?.user ?? null;
    if (!authUser) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id) {
        return { mosques: [], error: authError?.message ?? 'No authenticated user.' };
      }
      authUser = authData.user;
    }
    const userId = authUser.id;
    const appMetadataRole = (((authUser.app_metadata as any)?.role ?? null) || null) as string | null;

    try {
      const payload = await fetchSessionAccess({
        preferCache: true,
        session: options.session,
      });
      return {
        mosques: ((payload.adminMosques ?? []) as AdminMosqueSummary[]).sort((a, b) => a.name.localeCompare(b.name)),
        error: null,
      };
    } catch (serverError: any) {
      console.warn('[adminMosques] server access fallback', serverError?.message ?? serverError);
    }

    const userRoleQuery = supabase
      .from('users')
      .select('role')
      .eq('id', userId);
    const { data: userRow, error: userError } = await (
      options.signal ? userRoleQuery.abortSignal(options.signal) : userRoleQuery
    )
      .maybeSingle<{ role?: string | null }>();

    const resolvedRole = userRow?.role ?? appMetadataRole ?? null;

    if (userError) {
      console.warn('[adminMosques] role lookup error', userError);
    }

    if (resolvedRole === 'main_admin') {
      const { data: mosquesData, error: mosquesError } = await fetchAllMosqueRows<any>(
        supabase,
        'id, name, city, country',
        { signal: options.signal }
      );

      if (mosquesError || !mosquesData) {
        return { mosques: [], error: mosquesError?.message ?? null };
      }

      const mosques = mosquesData.map((m: any) => ({
        mosqueId: m.id,
        name: m.name ?? 'Mosque',
        city: m.city ?? null,
        country: m.country ?? null,
      }));

      return { mosques, error: null };
    }

    // Step 1: fetch mosque_admins rows for this user (no role filter)
    const adminRowsQuery = supabase
      .from('mosque_admins')
      .select('mosque_id, role')
      .eq('user_id', userId);
    const { data: adminRows, error: adminError } = await (
      options.signal ? adminRowsQuery.abortSignal(options.signal) : adminRowsQuery
    );

    if (adminError || !adminRows || adminRows.length === 0) {
      return { mosques: [], error: adminError?.message ?? null };
    }

    const ids = adminRows.map((r: any) => r?.mosque_id).filter(Boolean);
    if (!ids.length) {
      return { mosques: [], error: null };
    }

    // Step 2: fetch mosque details for those IDs
    const mosquesQuery = supabase
      .from('mosques')
      .select('id, name, city, country')
      .in('id', ids);
    const { data: mosquesData, error: mosquesError } = await (
      options.signal ? mosquesQuery.abortSignal(options.signal) : mosquesQuery
    );

    if (mosquesError || !mosquesData) {
      return { mosques: [], error: mosquesError?.message ?? null };
    }

    const mosques = mosquesData.map((m: any) => ({
      mosqueId: m.id,
      name: m.name ?? 'Mosque',
      city: m.city ?? null,
      country: m.country ?? null,
    }));

    return { mosques, error: null };
  } catch (e: any) {
    console.warn('[getAdminMosquesForCurrentUser]', e?.message ?? e);
    return { mosques: [], error: 'Unable to load admin mosques.' };
  }
}

export async function getAdminMosquesForCurrentUser(
  options: GetAdminMosquesOptions = {}
): Promise<{ mosques: AdminMosqueSummary[]; error: string | null }> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_ADMIN_MOSQUE_TIMEOUT_MS;
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutResult = new Promise<{ mosques: AdminMosqueSummary[]; error: string | null }>((resolve) => {
    timeoutId = setTimeout(
      () => {
        controller.abort();
        resolve({ mosques: [], error: 'Admin mosques took too long to load. Please try again.' });
      },
      timeoutMs
    );
  });

  try {
    return await Promise.race([
      loadAdminMosquesForCurrentUser({ ...options, signal: controller.signal }),
      timeoutResult,
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function getSingleAdminMosqueForCurrentUser(): Promise<AdminMosqueSummary | null> {
  const { mosques } = await getAdminMosquesForCurrentUser();
  return mosques.length === 1 ? mosques[0] : null;
}
