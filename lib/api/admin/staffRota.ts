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
    const builder = supabase
      .from('muezzins')
      .select('user_id, is_active, profiles:profiles(id, full_name, email)')
      .eq('mosque_id', mosqueId);

    let { data, error } = await builder.eq('is_active', true);
    if (error && error.code === '42703') {
      // is_active column might not exist in older schemas.
      ({ data, error } = await builder);
    }
    if (error && error.code !== 'PGRST116') throw error;

    return (data ?? []).map((row: any) => {
      const display = row?.profiles?.full_name ?? row?.profiles?.email ?? 'Muezzin';
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
  const dateIso = date.toISOString().slice(0, 10);
  try {
    const { data, error } = await supabase
      .from('staff_rota')
      .select('prayer_name, muezzin_user_id, notes, adhan_time, iqama_time')
      .eq('mosque_id', mosqueId)
      .eq('date', dateIso);
    if (error && error.code !== 'PGRST116') throw error;
    const map: StaffRotaForDay = {};
    (data ?? []).forEach((row: any) => {
      const key = (row.prayer_name ?? '').toLowerCase() as PrayerName;
      map[key] = {
        muezzinUserId: row.muezzin_user_id ?? null,
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
  const dateIso = date.toISOString().slice(0, 10);
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
    const { error } = await supabase.from('staff_rota').upsert(rows, { onConflict: 'mosque_id,date,prayer_name' });
    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    console.warn('[saveStaffRotaForDate]', e?.message ?? e);
    return { success: false, error: e?.message ?? 'Unable to save staff rota.' };
  }
}

async function loadPrayerTimesSlotMap(mosqueId: string, date: Date) {
  try {
    const row = await getPrayerTimesByDate(mosqueId, date.toISOString().slice(0, 10));
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
