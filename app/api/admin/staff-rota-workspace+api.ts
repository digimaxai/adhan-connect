import type { RequestHandler } from 'expo-router/server';
import { hasMosqueAdminAccess, json, requireAdminAccess } from '../../../lib/server/adminAccess';

type PrayerTimeSourceRow = {
  date?: string | null;
  fajr_adhan_time?: string | null;
  fajr_iqama_time?: string | null;
  dhuhr_adhan_time?: string | null;
  dhuhr_iqama_time?: string | null;
  asr_adhan_time?: string | null;
  asr_iqama_time?: string | null;
  maghrib_adhan_time?: string | null;
  maghrib_iqama_time?: string | null;
  isha_adhan_time?: string | null;
  isha_iqama_time?: string | null;
};

type StaffRotaWorkspaceRow = {
  prayer_name?: string | null;
  muezzin_user_id?: string | null;
  staff_user_id?: string | null;
  notes?: string | null;
  adhan_time?: string | null;
  iqama_time?: string | null;
};

type MuezzinMemberRow = {
  user_id: string;
  is_active?: boolean | null;
};

type ProfileLookup = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

function buildIso(dateIso: string, timeValue?: string | null) {
  if (!timeValue) return null;
  const normalized = /^\d{1,2}:\d{2}$/.test(timeValue) ? `${timeValue}:00` : timeValue;
  const parsed = new Date(`${dateIso}T${normalized}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function emptyPrayerRow(dateIso: string): PrayerTimeSourceRow {
  return {
    date: dateIso,
    fajr_adhan_time: null,
    fajr_iqama_time: null,
    dhuhr_adhan_time: null,
    dhuhr_iqama_time: null,
    asr_adhan_time: null,
    asr_iqama_time: null,
    maghrib_adhan_time: null,
    maghrib_iqama_time: null,
    isha_adhan_time: null,
    isha_iqama_time: null,
  };
}

async function fetchProfileMap(supabaseAdmin: any, userIds: string[]) {
  if (!userIds.length) return {} as Record<string, ProfileLookup>;
  const ids = Array.from(new Set(userIds));

  const [profilesRes, usersRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, full_name, display_name, email').in('id', ids),
    supabaseAdmin.from('users').select('id, email').in('id', ids),
  ]);

  const map: Record<string, ProfileLookup> = {};
  (profilesRes.data ?? []).forEach((row: any) => {
    map[row.id] = row as ProfileLookup;
  });
  (usersRes.data ?? []).forEach((row: any) => {
    map[row.id] = {
      ...(map[row.id] ?? {}),
      id: row.id,
      email: map[row.id]?.email ?? row.email ?? null,
    };
  });
  return map;
}

function labelProfile(profile?: ProfileLookup | null) {
  return profile?.display_name ?? profile?.full_name ?? profile?.email ?? 'Muezzin';
}

async function loadStaffRotaRows(supabaseAdmin: any, mosqueId: string, dateIso: string) {
  const primary = await supabaseAdmin
    .from('staff_rota')
    .select('prayer_name, muezzin_user_id, staff_user_id, notes, adhan_time, iqama_time')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso);

  if (!primary.error || primary.error.code === 'PGRST116') {
    return {
      rows: (primary.data ?? []) as StaffRotaWorkspaceRow[],
      error: null,
    };
  }

  if (primary.error.code !== '42703') {
    return { rows: [] as StaffRotaWorkspaceRow[], error: primary.error };
  }

  const fallback = await supabaseAdmin
    .from('staff_rota')
    .select('prayer_name, muezzin_user_id, staff_user_id, notes')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso);

  if (fallback.error && fallback.error.code !== 'PGRST116') {
    return { rows: [] as StaffRotaWorkspaceRow[], error: fallback.error };
  }

  return {
    rows: ((fallback.data ?? []) as StaffRotaWorkspaceRow[]).map((row) => ({
      ...row,
      adhan_time: null,
      iqama_time: null,
    })),
    error: null,
  };
}

async function loadFallbackPrayerRow(supabaseAdmin: any, mosqueId: string, dateIso: string) {
  const { data: legacyRow, error: legacyError } = await supabaseAdmin
    .from('mosque_prayer_times')
    .select('prayer_date, fajr, dhuhr, asr, maghrib, isha')
    .eq('mosque_id', mosqueId)
    .eq('prayer_date', dateIso)
    .maybeSingle();

  if (!legacyError && legacyRow) {
    const row = emptyPrayerRow(dateIso);
    row.fajr_adhan_time = buildIso(dateIso, legacyRow.fajr ?? null);
    row.dhuhr_adhan_time = buildIso(dateIso, legacyRow.dhuhr ?? null);
    row.asr_adhan_time = buildIso(dateIso, legacyRow.asr ?? null);
    row.maghrib_adhan_time = buildIso(dateIso, legacyRow.maghrib ?? null);
    row.isha_adhan_time = buildIso(dateIso, legacyRow.isha ?? null);
    return row;
  }

  return null;
}

export const GET: RequestHandler = async (request) => {
  const auth = await requireAdminAccess(request);
  if ('response' in auth) {
    return auth.response;
  }

  const url = new URL(request.url);
  const mosqueId = (url.searchParams.get('mosqueId') ?? '').trim();
  const dateIso = (url.searchParams.get('date') ?? '').trim();

  if (!mosqueId) {
    return json({ error: 'A mosqueId query parameter is required.' }, 400);
  }

  if (!dateIso) {
    return json({ error: 'A date query parameter is required.' }, 400);
  }

  if (!hasMosqueAdminAccess(auth.context, mosqueId)) {
    return json({ error: 'You do not have access to this mosque workspace.' }, 403);
  }

  const { supabaseAdmin } = auth.context;
  const [timesRes, rotaResult, muezzinRes] = await Promise.all([
    supabaseAdmin
      .from('prayer_times')
      .select('date,fajr_adhan_time,fajr_iqama_time,dhuhr_adhan_time,dhuhr_iqama_time,asr_adhan_time,asr_iqama_time,maghrib_adhan_time,maghrib_iqama_time,isha_adhan_time,isha_iqama_time')
      .eq('mosque_id', mosqueId)
      .eq('date', dateIso)
      .maybeSingle(),
    loadStaffRotaRows(supabaseAdmin, mosqueId, dateIso),
    supabaseAdmin
      .from('muezzins')
      .select('user_id, is_active')
      .eq('mosque_id', mosqueId),
  ]);

  if (timesRes.error && timesRes.error.code !== 'PGRST116') {
    return json({ error: timesRes.error.message || 'Unable to load prayer times.' }, 500);
  }

  if (rotaResult.error) {
    return json({ error: rotaResult.error.message || 'Unable to load staff rota.' }, 500);
  }

  if (muezzinRes.error && muezzinRes.error.code !== 'PGRST116') {
    return json({ error: muezzinRes.error.message || 'Unable to load muezzin assignments.' }, 500);
  }

  const activeMuezzins = ((muezzinRes.data ?? []) as MuezzinMemberRow[]).filter((row) => row.is_active !== false);
  const rotaRows = rotaResult.rows;
  const fallbackPrayerTimesRow = timesRes.data ?? (await loadFallbackPrayerRow(supabaseAdmin, mosqueId, dateIso));
  const relatedUserIds = Array.from(
    new Set([
      ...activeMuezzins.map((row) => row.user_id),
      ...rotaRows
        .map((row) => row.muezzin_user_id ?? row.staff_user_id ?? null)
        .filter(Boolean),
    ])
  ) as string[];
  const profileMap = await fetchProfileMap(supabaseAdmin, relatedUserIds);

  return json({
    prayerTimesRow: timesRes.data ?? null,
    fallbackPrayerTimesRow,
    rotaRows,
    muezzins: activeMuezzins.map((row) => {
      const profile = profileMap[row.user_id];
      const displayName = labelProfile(profile);
      return {
        userId: row.user_id,
        displayName,
        user_id: row.user_id,
        name: displayName,
      };
    }),
  });
};
