import type { RequestHandler } from 'expo-router/server';
import { hasMosqueAdminAccess, json, requireAdminAccess } from '../../../lib/server/adminAccess';

type PrayerTimesRow = {
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

type PrayerScheduleImportRecord = {
  id: string;
  mosque_id: string;
  source_type: 'upload' | 'api' | 'manual' | 'rollback';
  source_label?: string | null;
  import_mode?: string | null;
  fixed_iqama_offset_minutes?: number | null;
  status: 'pending' | 'published' | 'failed' | 'rolled_back';
  coverage_start_date?: string | null;
  coverage_end_date?: string | null;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  warning_count: number;
  error_count: number;
  initiated_by?: string | null;
  rolled_back_from_import_id?: string | null;
  metadata?: Record<string, unknown> | null;
  published_at?: string | null;
  rolled_back_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type StaffRotaFallbackRow = {
  prayer_name?: string | null;
  adhan_time?: string | null;
};

function buildIso(dateIso: string, timeValue?: string | null) {
  if (!timeValue) return null;
  const normalized = /^\d{1,2}:\d{2}$/.test(timeValue) ? `${timeValue}:00` : timeValue;
  const parsed = new Date(`${dateIso}T${normalized}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function emptyPrayerRow(mosqueId: string, dateIso: string): PrayerTimesRow {
  return {
    mosque_id: mosqueId,
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

async function loadFallbackPrayerRow(
  supabaseAdmin: any,
  mosqueId: string,
  dateIso: string
): Promise<{ fallbackRow: PrayerTimesRow | null; fallbackSource: 'mosque_prayer_times' | 'staff_rota' | null }> {
  const { data: legacyRow, error: legacyError } = await supabaseAdmin
    .from('mosque_prayer_times')
    .select('prayer_date, fajr, dhuhr, asr, maghrib, isha')
    .eq('mosque_id', mosqueId)
    .eq('prayer_date', dateIso)
    .maybeSingle();

  if (!legacyError && legacyRow) {
    const row = emptyPrayerRow(mosqueId, dateIso);
    row.fajr_adhan_time = buildIso(dateIso, legacyRow.fajr ?? null);
    row.dhuhr_adhan_time = buildIso(dateIso, legacyRow.dhuhr ?? null);
    row.asr_adhan_time = buildIso(dateIso, legacyRow.asr ?? null);
    row.maghrib_adhan_time = buildIso(dateIso, legacyRow.maghrib ?? null);
    row.isha_adhan_time = buildIso(dateIso, legacyRow.isha ?? null);
    return { fallbackRow: row, fallbackSource: 'mosque_prayer_times' };
  }

  let rotaRows: StaffRotaFallbackRow[] = [];
  let rotaError: any = null;
  ({ data: rotaRows, error: rotaError } = await supabaseAdmin
    .from('staff_rota')
    .select('prayer_name, adhan_time')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso));

  if (rotaError?.code === '42703') {
    rotaRows = [];
    rotaError = null;
  }

  if (!rotaError && rotaRows?.length) {
    const row = emptyPrayerRow(mosqueId, dateIso);
    rotaRows.forEach((rotaRow) => {
      const prayer = (rotaRow.prayer_name ?? '').toLowerCase();
      const value = rotaRow.adhan_time ?? null;
      if (prayer === 'fajr') row.fajr_adhan_time = value;
      if (prayer === 'dhuhr') row.dhuhr_adhan_time = value;
      if (prayer === 'asr') row.asr_adhan_time = value;
      if (prayer === 'maghrib') row.maghrib_adhan_time = value;
      if (prayer === 'isha') row.isha_adhan_time = value;
    });
    return { fallbackRow: row, fallbackSource: 'staff_rota' };
  }

  return { fallbackRow: null, fallbackSource: null };
}

export const GET: RequestHandler = async (request) => {
  const auth = await requireAdminAccess(request);
  if ('response' in auth) {
    return auth.response;
  }

  const url = new URL(request.url);
  const mosqueId = (url.searchParams.get('mosqueId') ?? '').trim();
  const dateIso = (url.searchParams.get('date') ?? '').trim();
  const historyLimit = Math.min(Math.max(Number.parseInt(url.searchParams.get('historyLimit') ?? '6', 10) || 6, 1), 20);

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
  const [rowRes, importRes] = await Promise.all([
    supabaseAdmin
      .from('prayer_times')
      .select('*')
      .eq('mosque_id', mosqueId)
      .eq('date', dateIso)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('prayer_schedule_imports')
      .select('*')
      .eq('mosque_id', mosqueId)
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(historyLimit),
  ]);

  if (rowRes.error && rowRes.error.code !== 'PGRST116') {
    return json({ error: rowRes.error.message || 'Unable to load prayer times.' }, 500);
  }

  if (importRes.error) {
    return json({ error: importRes.error.message || 'Unable to load prayer-time import history.' }, 500);
  }

  const currentRow = (rowRes.data ?? null) as PrayerTimesRow | null;
  const fallback: {
    fallbackRow: PrayerTimesRow | null;
    fallbackSource: 'mosque_prayer_times' | 'staff_rota' | null;
  } = currentRow
    ? { fallbackRow: null, fallbackSource: null }
    : await loadFallbackPrayerRow(supabaseAdmin, mosqueId, dateIso);

  return json({
    currentRow,
    fallbackRow: fallback.fallbackRow,
    fallbackSource: fallback.fallbackSource,
    importHistory: (importRes.data ?? []) as PrayerScheduleImportRecord[],
  });
};
