import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';
import { hasMosqueAdminAccess, json, requireAdminAccess } from '../../../lib/server/adminAccess';
import { addMinutes, normalizePrayerTimeAdjustments, type PrayerTimeAdjustments } from '../../../lib/prayerTimeAdjustments';
import { fetchAladhanTimes, DEFAULT_ALADHAN_METHOD } from '../../../lib/api/aladhan';
import { fetchELMTimes, type ELMTimings } from '../../../lib/api/londonPrayerTimes';

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

type MosqueGeoSettings = {
  lat?: number | null;
  lng?: number | null;
  prayer_source?: string | null;
  prayer_calculation_method?: number | null;
  prayer_school?: number | null;
  prayer_time_adjustments?: PrayerTimeAdjustments | null;
};

function getLondonOffsetMinutes(dateIso: string): number {
  // Get London UTC offset at noon on the given date (avoids DST edge cases)
  const utcNoon = new Date(`${dateIso}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(utcNoon);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 12);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m - 720; // London hours/mins at UTC noon minus 720 = offset in minutes
}

function buildIso(dateIso: string, timeValue?: string | null) {
  if (!timeValue) return null;
  const normalized = /^\d{1,2}:\d{2}$/.test(timeValue) ? `${timeValue}:00` : timeValue;
  const [hStr, mStr, sStr = '0'] = normalized.split(':');
  const h = Number(hStr), min = Number(mStr), s = Number(sStr);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  // ELM/prayer times are London local — convert to UTC before building ISO
  const offsetMin = getLondonOffsetMinutes(dateIso);
  const utcMs = Date.UTC(
    Number(dateIso.slice(0, 4)),
    Number(dateIso.slice(5, 7)) - 1,
    Number(dateIso.slice(8, 10)),
    h, min, s
  ) - offsetMin * 60 * 1000;
  return new Date(utcMs).toISOString();
}

function adjustedIso(dateIso: string, timeValue: string | null | undefined, minutes: number) {
  const iso = buildIso(dateIso, timeValue);
  if (!iso) return null;
  return addMinutes(new Date(iso), minutes)?.toISOString() ?? null;
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
  dateIso: string,
  mosqueGeo?: MosqueGeoSettings | null
): Promise<{ fallbackRow: PrayerTimesRow | null; fallbackSource: 'mosque_prayer_times' | 'staff_rota' | 'auto' | null }> {
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

  // Final fallback: auto-calculate from ELM or Aladhan (server has LPT_API_KEY)
  if (mosqueGeo) {
    try {
      const source = mosqueGeo.prayer_source ?? 'aladhan';
      const school = mosqueGeo.prayer_school ?? 0;
      const method = mosqueGeo.prayer_calculation_method ?? DEFAULT_ALADHAN_METHOD;
      const adjustments = normalizePrayerTimeAdjustments(mosqueGeo.prayer_time_adjustments);
      const row = emptyPrayerRow(mosqueId, dateIso);

      if (source === 'elm') {
        const elm = (await supabaseAdmin
          .from('elm_timetable')
          .select('fajr,fajr_jamat,sunrise,dhuhr,dhuhr_jamat,asr,asr_2,asr_jamat,magrib,magrib_jamat,isha,isha_jamat')
          .eq('date', dateIso)
          .maybeSingle()
          .then(({ data }) => (data ? { date: dateIso, ...data } as ELMTimings : null))
        ) ?? (await fetchELMTimes(dateIso));
        if (elm) {
          row.fajr_adhan_time = adjustedIso(dateIso, elm.fajr, adjustments.fajr);
          row.fajr_iqama_time = buildIso(dateIso, elm.fajr_jamat);
          row.dhuhr_adhan_time = adjustedIso(dateIso, elm.dhuhr, adjustments.dhuhr);
          row.dhuhr_iqama_time = buildIso(dateIso, elm.dhuhr_jamat);
          row.asr_adhan_time = adjustedIso(dateIso, school === 1 ? elm.asr_2 : elm.asr, adjustments.asr);
          row.asr_iqama_time = buildIso(dateIso, elm.asr_jamat);
          row.maghrib_adhan_time = adjustedIso(dateIso, elm.magrib, adjustments.maghrib);
          row.maghrib_iqama_time = buildIso(dateIso, elm.magrib_jamat);
          row.isha_adhan_time = adjustedIso(dateIso, elm.isha, adjustments.isha);
          row.isha_iqama_time = buildIso(dateIso, elm.isha_jamat);
          const hasTimes = [row.fajr_adhan_time, row.dhuhr_adhan_time, row.asr_adhan_time, row.maghrib_adhan_time, row.isha_adhan_time].some(Boolean);
          if (hasTimes) return { fallbackRow: row, fallbackSource: 'auto' };
        }
      }

      if (mosqueGeo.lat != null && mosqueGeo.lng != null) {
        const timings = await fetchAladhanTimes(mosqueGeo.lat, mosqueGeo.lng, dateIso, method, school);
        if (timings) {
          row.fajr_adhan_time = adjustedIso(dateIso, timings.Fajr, adjustments.fajr);
          row.dhuhr_adhan_time = adjustedIso(dateIso, timings.Dhuhr, adjustments.dhuhr);
          row.asr_adhan_time = adjustedIso(dateIso, timings.Asr, adjustments.asr);
          row.maghrib_adhan_time = adjustedIso(dateIso, timings.Maghrib, adjustments.maghrib);
          row.isha_adhan_time = adjustedIso(dateIso, timings.Isha, adjustments.isha);
          return { fallbackRow: row, fallbackSource: 'auto' };
        }
      }
    } catch {
      // auto-calc failure is non-fatal; form stays blank
    }
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
  const [rowRes, importRes, mosqueRes] = await Promise.all([
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
    supabaseAdmin.from('mosques')
      .select('lat, lng, prayer_source, prayer_calculation_method, prayer_school, prayer_time_adjustments')
      .eq('id', mosqueId).single(),
  ]);

  if (rowRes.error && rowRes.error.code !== 'PGRST116') {
    return json({ error: rowRes.error.message || 'Unable to load prayer times.' }, 500);
  }

  if (importRes.error) {
    return json({ error: importRes.error.message || 'Unable to load prayer-time import history.' }, 500);
  }
  if (mosqueRes.error) return json({ error: mosqueRes.error.message || 'Unable to load prayer settings.' }, 500);

  const currentRow = (rowRes.data ?? null) as PrayerTimesRow | null;
  const fallback: {
    fallbackRow: PrayerTimesRow | null;
    fallbackSource: 'mosque_prayer_times' | 'staff_rota' | 'auto' | null;
  } = currentRow
    ? { fallbackRow: null, fallbackSource: null }
    : await loadFallbackPrayerRow(supabaseAdmin, mosqueId, dateIso, mosqueRes.data);

  return json({
    currentRow,
    fallbackRow: fallback.fallbackRow,
    fallbackSource: fallback.fallbackSource,
    importHistory: (importRes.data ?? []) as PrayerScheduleImportRecord[],
    prayerSettings: {
      prayerSource: mosqueRes.data.prayer_source === 'elm' ? 'elm' : 'aladhan',
      calculationMethod: mosqueRes.data.prayer_calculation_method ?? 3,
      school: mosqueRes.data.prayer_school === 1 ? 1 : 0,
      adjustments: normalizePrayerTimeAdjustments(mosqueRes.data.prayer_time_adjustments),
    },
  });
};
