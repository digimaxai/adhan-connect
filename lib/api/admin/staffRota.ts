import { PrayerName } from '../../adhans';
import { normalizePrayerTimes } from '../prayerTimesUnified';
import { getPrayerTimesByDate } from './prayerTimes';
import { supabase } from '../../supabase';

const PRAYERS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export type StaffRotaRow = {
  id?: string;
  mosque_id: string;
  muezzin_user_id: string;
  prayer_name: string;
  date: string;
  adhan_time?: string | null;
  iqama_time?: string | null;
  notes?: string | null;
  assigned_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type StaffRotaForDay = Partial<
  Record<
    PrayerName,
    {
      muezzinUserId: string | null;
      notes: string | null;
      adhanTime: Date | null;
      iqamaTime: Date | null;
    }
  >
>;

export type MuezzinSummary = {
  userId: string;
  displayName: string;
  // Legacy shape kept for backward compatibility with older screens.
  user_id: string;
  name: string;
};

export async function getMuezzinsForMosque(mosqueId: string): Promise<MuezzinSummary[]> {
  try {
    // Primary query: avoid joins so RLS on profiles can't filter out the base rows.
    let { data, error } = await supabase
      .from('muezzins')
      .select('user_id, is_active')
      .match({ mosque_id: mosqueId, is_active: true });

    // If is_active column missing, retry without that filter.
    if (error && error.code === '42703') {
      ({ data, error } = await supabase.from('muezzins').select('user_id').match({ mosque_id: mosqueId }));
    }

    if (error && error.code !== 'PGRST116') throw error;

    const rows = data ?? [];
    const profileMap = await fetchProfilesForUsers(rows.map((r: any) => r.user_id));

    return rows.map((row: any) => {
      const display = profileMap[row.user_id] ?? 'Muezzin';
      return {
        userId: row.user_id,
        displayName: display,
        user_id: row.user_id,
        name: display,
      };
    });
  } catch (e) {
    console.warn('[getMuezzinsForMosque]', e);
    return [];
  }
}

async function fetchProfilesForUsers(userIds: string[]) {
  if (!userIds.length) return {} as Record<string, string>;
  try {
    let { data, error } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);
    if (error && error.code === '42703') {
      // full_name/email column missing; fall back to id only.
      ({ data, error } = await supabase.from('profiles').select('id').in('id', userIds));
    }
    if (error && error.code !== 'PGRST116') throw error;
    const map: Record<string, string> = {};
    (data ?? []).forEach((row: any) => {
      map[row.id] = row?.full_name ?? row?.email ?? '';
    });
    return map;
  } catch (e) {
    console.warn('[fetchProfilesForUsers]', e);
    return {} as Record<string, string>;
  }
}

export async function getStaffRotaByDate(mosqueId: string, dateIso: string) {
  const { data, error } = await supabase
    .from('staff_rota')
    .select('*')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso)
    .order('prayer_name', { ascending: true });
  if (error && error.code !== 'PGRST116') throw error;
  return (data ?? []) as StaffRotaRow[];
}

export async function upsertStaffRotaForDate(
  mosqueId: string,
  dateIso: string,
  assignments: Array<Omit<StaffRotaRow, 'mosque_id' | 'date'>>
) {
  if (!assignments.length) return [];
  const rows = assignments.map((a) => ({
    ...a,
    mosque_id: mosqueId,
    date: dateIso,
  }));
  const { data, error } = await supabase
    .from('staff_rota')
    .upsert(rows, { onConflict: 'mosque_id,date,prayer_name' })
    .select('*');
  if (error) throw error;
  return (data ?? []) as StaffRotaRow[];
}

export async function getStaffRotaForDate(mosqueId: string, date: Date): Promise<StaffRotaForDay> {
  const dateIso = formatLocalDate(date);
  try {
    const baseSelect =
      'prayer_name, muezzin_user_id, staff_user_id, notes, adhan_time, iqama_time';
    let { data, error } = await supabase
      .from('staff_rota')
      .select(baseSelect)
      .eq('mosque_id', mosqueId)
      .eq('date', dateIso);

    // If newer columns are missing, fall back to a minimal projection.
    if (error && error.code === '42703') {
      const fallback = await supabase
        .from('staff_rota')
        .select('prayer_name, muezzin_user_id, staff_user_id, notes')
        .eq('mosque_id', mosqueId)
        .eq('date', dateIso);
      data = fallback.data ?? [];
      error = fallback.error ?? null;
    }

    if (error && error.code !== 'PGRST116') throw error;
    const map: StaffRotaForDay = {};
    (data ?? []).forEach((row: any) => {
      const key = (row.prayer_name ?? '').toLowerCase() as PrayerName;
      const userId = row?.muezzin_user_id ?? row?.staff_user_id ?? null;
      map[key] = {
        muezzinUserId: userId,
        notes: row.notes ?? null,
        adhanTime: safeDate(row.adhan_time),
        iqamaTime: safeDate(row.iqama_time),
      };
    });
    return map;
  } catch (e) {
    console.warn('[getStaffRotaForDate]', e);
    return {};
  }
}

export async function saveStaffRotaForDate(
  mosqueId: string,
  date: Date,
  assignments: StaffRotaForDay,
  assignedByUserId: string
): Promise<{ success: boolean; error?: string | null }> {
  const dateIso = formatLocalDate(date);
  const normalizedTimes = await loadPrayerTimesSlotMap(mosqueId, date);
  const rows = PRAYERS.map((prayer) => {
    const assignment = assignments?.[prayer];
    if (!assignment?.muezzinUserId) return null;
    const slot = normalizedTimes?.[prayer];
    return {
      mosque_id: mosqueId,
      date: dateIso,
      prayer_name: prayer,
      muezzin_user_id: assignment.muezzinUserId,
      // Legacy column support
      staff_user_id: assignment.muezzinUserId,
      duty_date: dateIso, // legacy column
      prayer: prayer, // legacy column
      adhan_time: toIsoString(assignment.adhanTime ?? slot?.adhanTime),
      iqama_time: toIsoString(assignment.iqamaTime ?? slot?.iqamaTime),
      notes: assignment.notes ?? null,
      assigned_by: assignedByUserId || null,
    };
  }).filter(Boolean) as StaffRotaRow[];

  if (!rows.length) {
    return { success: true };
  }

  try {
    // Replace rows for this mosque/date/prayer set to avoid onConflict inconsistencies across environments.
    const prayers = rows.map((r) => r.prayer_name);
    const { error: delError } = await supabase
      .from('staff_rota')
      .delete()
      .eq('mosque_id', mosqueId)
      .eq('date', dateIso)
      .in('prayer_name', prayers);
    if (delError && delError.code !== 'PGRST116') throw delError;

    const { data: inserted, error } = await supabase.from('staff_rota').insert(rows).select('*');
    if (error) throw error;
    if (!inserted || inserted.length === 0) {
      return { success: false, error: 'Save failed: no rows persisted (check RLS permissions for staff_rota).' };
    }
    return { success: true };
  } catch (e: any) {
    // If schema lacks adhan/iqama columns, retry without them.
    const msg = e?.message ?? '';
    const missingTimes = e?.code === '42703' || msg.toLowerCase().includes('adhan_time') || msg.toLowerCase().includes('iqama_time');
    const fkIssueMain = msg.toLowerCase().includes('foreign key') || e?.code === '23503';
    if (missingTimes || fkIssueMain) {
      const rowsWithoutTimes = rows.map((r) => ({
        mosque_id: r.mosque_id,
        date: r.date,
        prayer_name: r.prayer_name,
        muezzin_user_id: r.muezzin_user_id ?? r.staff_user_id ?? null,
        staff_user_id: r.staff_user_id ?? r.muezzin_user_id,
        duty_date: r.date,
        prayer: r.prayer_name,
        notes: r.notes ?? null,
      }));

      // Fallback: if FK is the issue, try nulling muezzin_user_id for legacy schemas.
      // If FK is the issue, try a minimal legacy insert without muezzin_user_id.
      const rowsLegacyFk = rowsWithoutTimes.map((r) => ({
        mosque_id: r.mosque_id,
        date: r.date,
        prayer_name: r.prayer_name,
        muezzin_user_id: r.muezzin_user_id ?? r.staff_user_id ?? null,
        staff_user_id: r.staff_user_id ?? r.muezzin_user_id,
        duty_date: r.date,
        prayer: r.prayer_name,
        notes: r.notes ?? null,
      }));

      try {
        // Clean slate for these prayers on this date.
        const prayers = rowsLegacyFk.map((r) => r.prayer_name);
        const { error: delError } = await supabase
          .from('staff_rota')
          .delete()
          .eq('mosque_id', rowsLegacyFk[0].mosque_id)
          .eq('date', rowsLegacyFk[0].date)
          .in('prayer_name', prayers);
        if (delError && delError.code !== 'PGRST116') throw delError;

        const { data: insertedFallback, error: insertError } = await supabase.from('staff_rota').insert(rowsLegacyFk as any).select('*');
        if (insertError) throw insertError;
        if (!insertedFallback || insertedFallback.length === 0) {
          return { success: false, error: 'Legacy save failed: no rows persisted (check RLS permissions).' };
        }
        return { success: true };
      } catch (retryErr: any) {
        console.warn('[saveStaffRotaForDate:retry]', retryErr?.message ?? retryErr);
        return { success: false, error: retryErr?.message ?? 'Unable to save staff rota.' };
      }
    }
    console.warn('[saveStaffRotaForDate]', e?.message ?? e);
    return { success: false, error: e?.message ?? 'Unable to save staff rota.' };
  }
}

async function loadPrayerTimesSlotMap(mosqueId: string, date: Date) {
  try {
    const row = await getPrayerTimesByDate(mosqueId, formatLocalDate(date));
    const normalized = normalizePrayerTimes(row as any);
    if (!normalized) return null;
    const map: StaffRotaForDay = {};
    PRAYERS.forEach((p) => {
      map[p] = {
        muezzinUserId: null,
        notes: null,
        adhanTime: normalized[p].adhan,
        iqamaTime: normalized[p].iqama,
      };
    });
    return map;
  } catch (e) {
    console.warn('[loadPrayerTimesSlotMap]', e);
    return null;
  }
}

function safeDate(val?: string | null) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function toIsoString(val?: Date | null) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
