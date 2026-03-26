import { fetchSessionAccess } from '../../sessionAccess';
import { supabase } from '../../supabase';

export type AdminMosqueSummary = {
  mosqueId: string;
  name: string;
  city?: string | null;
  country?: string | null;
};

export async function getAdminMosquesForCurrentUser(): Promise<{ mosques: AdminMosqueSummary[]; error: string | null }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user?.id) {
      console.log('[adminMosques] no auth user', authError);
      return { mosques: [], error: authError?.message ?? 'No authenticated user.' };
    }
    const userId = authData.user.id;
    const appMetadataRole = (((authData.user.app_metadata as any)?.role ?? null) || null) as string | null;

    try {
      const payload = await fetchSessionAccess({ preferCache: true });
      return {
        mosques: ((payload.adminMosques ?? []) as AdminMosqueSummary[]).sort((a, b) => a.name.localeCompare(b.name)),
        error: null,
      };
    } catch (serverError: any) {
      console.warn('[adminMosques] server access fallback', serverError?.message ?? serverError);
    }

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle<{ role?: string | null }>();

    const resolvedRole = userRow?.role ?? appMetadataRole ?? null;

    if (userError) {
      console.warn('[adminMosques] role lookup error', userError);
    }

    if (resolvedRole === 'main_admin') {
      const { data: mosquesData, error: mosquesError } = await supabase
        .from('mosques')
        .select('id, name, city, country')
        .order('name', { ascending: true })
        .limit(500);

      console.log('[adminMosques] main admin mosqueRows', mosquesData, mosquesError);

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
    const { data: adminRows, error: adminError } = await supabase
      .from('mosque_admins')
      .select('mosque_id, role')
      .eq('user_id', userId);

    console.log('[adminMosques] adminRows', adminRows, adminError, 'userId', userId);

    if (adminError || !adminRows || adminRows.length === 0) {
      return { mosques: [], error: adminError?.message ?? null };
    }

    const ids = adminRows.map((r: any) => r?.mosque_id).filter(Boolean);
    if (!ids.length) {
      return { mosques: [], error: null };
    }

    // Step 2: fetch mosque details for those IDs
    const { data: mosquesData, error: mosquesError } = await supabase
      .from('mosques')
      .select('id, name, city, country')
      .in('id', ids);

    console.log('[adminMosques] mosqueRows', mosquesData, mosquesError);

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

export async function getSingleAdminMosqueForCurrentUser(): Promise<AdminMosqueSummary | null> {
  const { mosques } = await getAdminMosquesForCurrentUser();
  return mosques.length === 1 ? mosques[0] : null;
}
