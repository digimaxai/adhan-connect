import { supabase } from '../../supabase';

export type PrayerTimesRow = {
  id?: string;
  mosque_id: string;
  date: string;
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
  source_type?: string | null;
  generated_method?: string | null;
  overrides_exist?: boolean | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function getPrayerTimesByDate(mosqueId: string, dateIso: string) {
  const { data, error } = await supabase
    .from('prayer_times')
    .select('*')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso)
    .order('updated_at', { ascending: false, nullsLast: true })
    .order('created_at', { ascending: false, nullsLast: true })
    .limit(1)
    .maybeSingle<PrayerTimesRow>();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

export async function upsertPrayerTimes(mosqueId: string, dateIso: string, data: Partial<PrayerTimesRow>) {
  const payload = {
    ...data,
    mosque_id: mosqueId,
    date: dateIso,
    overrides_exist: true,
  };
  // First try with the intended composite key; if the constraint is missing in some environments, retry without onConflict.
  const attempt = async (useConflict: boolean) =>
    supabase
      .from('prayer_times')
      .upsert(payload, useConflict ? { onConflict: 'mosque_id,date' } : undefined)
      .select('*')
      .maybeSingle<PrayerTimesRow>();

  const { data: row, error } = await attempt(true);
  if (!error) return row;

  const conflictMissing =
    error?.message?.toLowerCase().includes('no unique or exclusion constraint') ||
    error?.message?.toLowerCase().includes('on conflict specification');

  if (conflictMissing) {
    // Ensure only one row per mosque/date by removing existing then inserting fresh.
    const { error: deleteError } = await supabase.from('prayer_times').delete().eq('mosque_id', mosqueId).eq('date', dateIso);
    if (deleteError && deleteError.code !== 'PGRST116') throw deleteError;

    const { data: fallbackRow, error: fallbackError } = await attempt(false);
    if (fallbackError) throw fallbackError;
    return fallbackRow;
  }

  throw error;
}
