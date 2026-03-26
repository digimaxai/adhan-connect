import type { SupabaseClient } from '@supabase/supabase-js';

export type MuezzinMosqueSummary = {
  mosqueId: string;
  name: string;
  city?: string | null;
  country?: string | null;
};

type MosqueJoinRow = {
  id?: string | null;
  name?: string | null;
  city?: string | null;
  country?: string | null;
};

type MuezzinMembershipRow = {
  mosque_id?: string | null;
  is_active?: boolean | null;
  mosques?: MosqueJoinRow | MosqueJoinRow[] | null;
};

type StaffRotaMosqueRow = {
  mosque_id?: string | null;
  date?: string | null;
  duty_date?: string | null;
  mosques?: MosqueJoinRow | MosqueJoinRow[] | null;
};

function normalizeMosqueJoin(value: MosqueJoinRow | MosqueJoinRow[] | null | undefined) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function toMosqueSummary(mosqueId: string, joined?: MosqueJoinRow | null): MuezzinMosqueSummary {
  return {
    mosqueId,
    name: joined?.name ?? 'Mosque',
    city: joined?.city ?? null,
    country: joined?.country ?? null,
  };
}

function dedupeMosques(rows: MuezzinMosqueSummary[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row.mosqueId || seen.has(row.mosqueId)) return false;
    seen.add(row.mosqueId);
    return true;
  });
}

async function hydrateMosqueSummaries(
  supabaseAdmin: SupabaseClient<any, any, any>,
  rows: Array<{ mosqueId: string; joined?: MosqueJoinRow | null }>
) {
  const missingIds = Array.from(new Set(rows.filter((row) => !row.joined).map((row) => row.mosqueId)));
  const hydrated = new Map<string, MosqueJoinRow>();

  if (missingIds.length) {
    const { data, error } = await supabaseAdmin
      .from('mosques')
      .select('id, name, city, country')
      .in('id', missingIds);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    ((data ?? []) as MosqueJoinRow[]).forEach((mosque) => {
      if (mosque.id) hydrated.set(mosque.id, mosque);
    });
  }

  return dedupeMosques(
    rows.map((row) => toMosqueSummary(row.mosqueId, row.joined ?? hydrated.get(row.mosqueId) ?? null))
  );
}

async function loadActiveMuezzinMosques(
  supabaseAdmin: SupabaseClient<any, any, any>,
  userId: string
) {
  const { data, error } = await supabaseAdmin
    .from('muezzins')
    .select('mosque_id, is_active, mosques(id, name, city, country)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const rows = ((data ?? []) as MuezzinMembershipRow[])
    .filter((row) => row.mosque_id)
    .map((row) => ({
      mosqueId: row.mosque_id as string,
      joined: normalizeMosqueJoin(row.mosques),
    }));

  return hydrateMosqueSummaries(supabaseAdmin, rows);
}

async function loadRotaDerivedMosques(
  supabaseAdmin: SupabaseClient<any, any, any>,
  userId: string
) {
  const ownerFilter = `muezzin_user_id.eq.${userId},staff_user_id.eq.${userId}`;
  const todayIso = new Date().toISOString().slice(0, 10);

  let futureRows:
    | {
        data: StaffRotaMosqueRow[] | null;
        error: any;
      }
    | undefined;

  futureRows = await supabaseAdmin
    .from('staff_rota')
    .select('mosque_id, date, duty_date, mosques(id, name, city, country)')
    .or(ownerFilter)
    .gte('date', todayIso)
    .order('date', { ascending: true })
    .limit(50);

  if (futureRows.error?.code === '42703') {
    futureRows = await supabaseAdmin
      .from('staff_rota')
      .select('mosque_id, date, duty_date, mosques(id, name, city, country)')
      .or(ownerFilter)
      .gte('duty_date', todayIso)
      .order('duty_date', { ascending: true })
      .limit(50);
  }

  if (futureRows.error && futureRows.error.code !== 'PGRST116') {
    throw futureRows.error;
  }

  const future = (futureRows.data ?? []).filter((row) => row.mosque_id);
  if (future.length) {
    return hydrateMosqueSummaries(
      supabaseAdmin,
      future.map((row) => ({
        mosqueId: row.mosque_id as string,
        joined: normalizeMosqueJoin(row.mosques),
      }))
    );
  }

  let pastRows:
    | {
        data: StaffRotaMosqueRow[] | null;
        error: any;
      }
    | undefined;

  pastRows = await supabaseAdmin
    .from('staff_rota')
    .select('mosque_id, date, duty_date, mosques(id, name, city, country)')
    .or(ownerFilter)
    .order('date', { ascending: false })
    .limit(50);

  if (pastRows.error?.code === '42703') {
    pastRows = await supabaseAdmin
      .from('staff_rota')
      .select('mosque_id, date, duty_date, mosques(id, name, city, country)')
      .or(ownerFilter)
      .order('duty_date', { ascending: false })
      .limit(50);
  }

  if (pastRows.error && pastRows.error.code !== 'PGRST116') {
    throw pastRows.error;
  }

  return hydrateMosqueSummaries(
    supabaseAdmin,
    ((pastRows.data ?? []) as StaffRotaMosqueRow[])
      .filter((row) => row.mosque_id)
      .map((row) => ({
        mosqueId: row.mosque_id as string,
        joined: normalizeMosqueJoin(row.mosques),
      }))
  );
}

export async function resolveMuezzinMosquesForUser(
  supabaseAdmin: SupabaseClient<any, any, any>,
  userId: string
) {
  const activeMemberships = await loadActiveMuezzinMosques(supabaseAdmin, userId);
  if (activeMemberships.length) return activeMemberships;
  return loadRotaDerivedMosques(supabaseAdmin, userId);
}

export async function resolvePrimaryMuezzinMosqueForUser(
  supabaseAdmin: SupabaseClient<any, any, any>,
  userId: string
) {
  const mosques = await resolveMuezzinMosquesForUser(supabaseAdmin, userId);
  return mosques[0] ?? null;
}
