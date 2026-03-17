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
  import_id?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PrayerTimesWriteMeta = {
  sourceType?: 'manual' | 'auto' | 'upload' | null;
  generatedMethod?: string | null;
  overridesExist?: boolean | null;
  importId?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export async function getPrayerTimesByDate(mosqueId: string, dateIso: string) {
  const { data, error } = await supabase
    .from('prayer_times')
    .select('*')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<PrayerTimesRow>();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

export async function listPrayerTimesByDates(mosqueId: string, dateIsos: string[]) {
  const dates = Array.from(new Set(dateIsos.map((value) => value?.slice(0, 10)).filter(Boolean)));
  if (!dates.length) return [] as PrayerTimesRow[];

  const { data, error } = await supabase
    .from('prayer_times')
    .select('*')
    .eq('mosque_id', mosqueId)
    .in('date', dates)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error && error.code !== 'PGRST116') throw error;
  return (data ?? []) as PrayerTimesRow[];
}

function buildPrayerTimesPayload(
  mosqueId: string,
  dateIso: string,
  data: Partial<PrayerTimesRow>,
  meta?: PrayerTimesWriteMeta
) {
  const payload = {
    ...data,
    mosque_id: mosqueId,
    date: dateIso,
    source_type: meta?.sourceType ?? data.source_type ?? 'manual',
    generated_method: meta?.generatedMethod ?? data.generated_method ?? null,
    overrides_exist: meta?.overridesExist ?? data.overrides_exist ?? true,
    import_id: meta?.importId ?? data.import_id ?? null,
    created_by: meta?.createdBy ?? data.created_by ?? null,
    updated_by: meta?.updatedBy ?? data.updated_by ?? null,
  };
  return payload;
}

export async function upsertPrayerTimes(
  mosqueId: string,
  dateIso: string,
  data: Partial<PrayerTimesRow>,
  meta?: PrayerTimesWriteMeta
) {
  const payload = buildPrayerTimesPayload(mosqueId, dateIso, data, meta);
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

export async function bulkUpsertPrayerTimes(
  mosqueId: string,
  rows: { date: string; data: Partial<PrayerTimesRow> }[],
  meta?: PrayerTimesWriteMeta
) {
  if (!rows.length) return [];

  const payloads = rows.map((row) => buildPrayerTimesPayload(mosqueId, row.date, row.data, meta));

  const attempt = async (useConflict: boolean) =>
    supabase
      .from('prayer_times')
      .upsert(payloads, useConflict ? { onConflict: 'mosque_id,date' } : undefined)
      .select('*');

  const { data, error } = await attempt(true);
  if (!error) return data ?? [];

  const conflictMissing =
    error?.message?.toLowerCase().includes('no unique or exclusion constraint') ||
    error?.message?.toLowerCase().includes('on conflict specification');

  if (conflictMissing) {
    const dates = Array.from(new Set(rows.map((row) => row.date)));
    const { error: deleteError } = await supabase
      .from('prayer_times')
      .delete()
      .eq('mosque_id', mosqueId)
      .in('date', dates);

    if (deleteError && deleteError.code !== 'PGRST116') throw deleteError;

    const { data: insertedRows, error: insertError } = await attempt(false);
    if (insertError) throw insertError;
    return insertedRows ?? [];
  }

  throw error;
}
