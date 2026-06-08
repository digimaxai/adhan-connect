import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';
import { DEFAULT_ALADHAN_METHOD, fetchAladhanTimes } from '../../lib/api/aladhan';
import { fetchELMTimes } from '../../lib/api/londonPrayerTimes';

type PrayerTimesRow = {
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

type MosqueRow = {
  id: string;
  status: string | null;
  lat?: number | null;
  lng?: number | null;
  prayer_calculation_method?: number | null;
  prayer_school?: number | null;
  prayer_source?: string | null;
};

const PRAYER_ADHAN_FIELDS = {
  fajr: 'fajr_adhan_time',
  dhuhr: 'dhuhr_adhan_time',
  asr: 'asr_adhan_time',
  maghrib: 'maghrib_adhan_time',
  isha: 'isha_adhan_time',
} as const;

type PrayerKey = keyof typeof PRAYER_ADHAN_FIELDS;

const PRAYER_IQAMA_FIELDS = {
  fajr: 'fajr_iqama_time',
  dhuhr: 'dhuhr_iqama_time',
  asr: 'asr_iqama_time',
  maghrib: 'maghrib_iqama_time',
  isha: 'isha_iqama_time',
} as const;

type SourceTimingMaps = {
  adhan: Partial<Record<PrayerKey, string | null>>;
  iqama: Partial<Record<PrayerKey, string | null>>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=60',
    },
  });
}

function buildIso(dateIso: string, timeValue?: string | null) {
  if (!timeValue) return null;
  const normalized = /^\d{1,2}:\d{2}$/.test(timeValue) ? `${timeValue}:00` : timeValue;
  const parsed = new Date(`${dateIso}T${normalized}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function fetchAladhanTimingMap(
  mosque: MosqueRow | null,
  dateIso: string,
  school: number
): Promise<Partial<Record<PrayerKey, string>> | null> {
  if (mosque?.lat == null || mosque.lng == null) return null;

  const method = mosque.prayer_calculation_method ?? DEFAULT_ALADHAN_METHOD;
  const timings = await fetchAladhanTimes(mosque.lat, mosque.lng, dateIso, method, school);
  if (!timings) return null;

  return {
    fajr: timings.Fajr,
    dhuhr: timings.Dhuhr,
    asr: timings.Asr,
    maghrib: timings.Maghrib,
    isha: timings.Isha,
  };
}

async function fetchSourceTimingMaps(mosque: MosqueRow | null, dateIso: string): Promise<SourceTimingMaps | null> {
  const source = mosque?.prayer_source ?? 'aladhan';
  const school = mosque?.prayer_school ?? 0;

  if (source !== 'elm') {
    const adhan = await fetchAladhanTimingMap(mosque, dateIso, school);
    return adhan ? { adhan, iqama: {} } : null;
  }

  const elmTimings = await fetchELMTimes(dateIso);
  const aladhanFallback = async () => fetchAladhanTimingMap(mosque, dateIso, school);

  if (!elmTimings) {
    const adhan = await aladhanFallback();
    return adhan ? { adhan, iqama: {} } : null;
  }

  const adhan: SourceTimingMaps['adhan'] = {
    fajr: elmTimings.fajr,
    dhuhr: elmTimings.dhuhr,
    asr: school === 1 ? elmTimings.asr_2 : elmTimings.asr,
    maghrib: elmTimings.magrib,
    isha: elmTimings.isha,
  };

  const missingAdhan = (Object.keys(PRAYER_ADHAN_FIELDS) as PrayerKey[]).filter((prayer) => !adhan[prayer]);
  if (missingAdhan.length) {
    const fallback = await aladhanFallback();
    missingAdhan.forEach((prayer) => {
      adhan[prayer] = fallback?.[prayer] ?? adhan[prayer] ?? null;
    });
  }

  return {
    adhan,
    iqama: {
      fajr: elmTimings.fajr_jamat,
      dhuhr: elmTimings.dhuhr_jamat,
      asr: elmTimings.asr_jamat,
      maghrib: elmTimings.magrib_jamat,
      isha: elmTimings.isha_jamat,
    },
  };
}

export const GET: RequestHandler = async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl) {
    return json({ error: 'Server is missing SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.' }, 500);
  }

  if (!serviceRoleKey) {
    return json({ error: 'Server is missing SUPABASE_SERVICE_ROLE.' }, 500);
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

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let mosque: MosqueRow | null = null;
  let mosqueError: any = null;

  const mosqueFull = await supabaseAdmin
    .from('mosques')
    .select('id, status, lat, lng, prayer_calculation_method, prayer_school, prayer_source')
    .eq('id', mosqueId)
    .maybeSingle<MosqueRow>();
  if (mosqueFull.error?.code === '42703') {
    const mosqueBasic = await supabaseAdmin
      .from('mosques')
      .select('id, status, lat, lng')
      .eq('id', mosqueId)
      .maybeSingle<MosqueRow>();
    mosque = mosqueBasic.data ?? null;
    mosqueError = mosqueBasic.error;
  } else {
    mosque = mosqueFull.data ?? null;
    mosqueError = mosqueFull.error;
  }

  if (mosqueError) {
    return json({ error: mosqueError.message || 'Unable to inspect mosque status.' }, 500);
  }

  if (!mosque || mosque.status !== 'active') {
    return json({ error: 'Prayer times are not available for this mosque.' }, 404);
  }

  const { data: row, error: rowError } = await supabaseAdmin
    .from('prayer_times')
    .select('date,fajr_adhan_time,fajr_iqama_time,dhuhr_adhan_time,dhuhr_iqama_time,asr_adhan_time,asr_iqama_time,maghrib_adhan_time,maghrib_iqama_time,isha_adhan_time,isha_iqama_time')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso)
    .maybeSingle();

  if (rowError && rowError.code !== 'PGRST116') {
    return json({ error: rowError.message || 'Unable to load prayer times.' }, 500);
  }

  if (row) {
    const primaryRow = { ...(row as PrayerTimesRow) };
    const nullPrayers = (Object.keys(PRAYER_ADHAN_FIELDS) as PrayerKey[]).filter(
      (prayer) => !primaryRow[PRAYER_ADHAN_FIELDS[prayer]]
    );

    if (nullPrayers.length > 0) {
      const sourceTimings = await fetchSourceTimingMaps(mosque, dateIso);
      if (sourceTimings) {
        nullPrayers.forEach((prayer) => {
          const fallbackTime = sourceTimings.adhan[prayer] ?? null;
          if (fallbackTime) {
            const field = PRAYER_ADHAN_FIELDS[prayer];
            primaryRow[field] = buildIso(dateIso, fallbackTime);
          }
        });
      }
    }

    return json({ row: primaryRow, source: 'prayer_times' });
  }

  const { data: legacy, error: legacyError } = await supabaseAdmin
    .from('mosque_prayer_times')
    .select('prayer_date, fajr, dhuhr, asr, maghrib, isha')
    .eq('mosque_id', mosqueId)
    .eq('prayer_date', dateIso)
    .maybeSingle();

  if (!legacyError && legacy) {
    return json({
      row: {
        date: dateIso,
        fajr_adhan_time: buildIso(dateIso, legacy.fajr ?? null),
        fajr_iqama_time: null,
        dhuhr_adhan_time: buildIso(dateIso, legacy.dhuhr ?? null),
        dhuhr_iqama_time: null,
        asr_adhan_time: buildIso(dateIso, legacy.asr ?? null),
        asr_iqama_time: null,
        maghrib_adhan_time: buildIso(dateIso, legacy.maghrib ?? null),
        maghrib_iqama_time: null,
        isha_adhan_time: buildIso(dateIso, legacy.isha ?? null),
        isha_iqama_time: null,
      } satisfies PrayerTimesRow,
      source: 'mosque_prayer_times',
    });
  }

  let rotaRows: { prayer_name?: string | null; adhan_time?: string | null }[] = [];
  let rotaError: any = null;
  const rotaResult = await supabaseAdmin
    .from('staff_rota')
    .select('prayer_name, adhan_time')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso);
  rotaRows = (rotaResult.data ?? []) as { prayer_name?: string | null; adhan_time?: string | null }[];
  rotaError = rotaResult.error ?? null;

  if (rotaError?.code === '42703') {
    rotaRows = [];
    rotaError = null;
  }

  if (!rotaError && rotaRows?.length) {
    const fallback: PrayerTimesRow = {
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
    rotaRows.forEach((rotaRow) => {
      const prayer = (rotaRow.prayer_name ?? '').toLowerCase();
      if (prayer === 'fajr') fallback.fajr_adhan_time = rotaRow.adhan_time ?? null;
      if (prayer === 'dhuhr') fallback.dhuhr_adhan_time = rotaRow.adhan_time ?? null;
      if (prayer === 'asr') fallback.asr_adhan_time = rotaRow.adhan_time ?? null;
      if (prayer === 'maghrib') fallback.maghrib_adhan_time = rotaRow.adhan_time ?? null;
      if (prayer === 'isha') fallback.isha_adhan_time = rotaRow.adhan_time ?? null;
    });
    return json({ row: fallback, source: 'staff_rota' });
  }

  const sourceTimings = await fetchSourceTimingMaps(mosque, dateIso);
  if (sourceTimings) {
    const calculated: PrayerTimesRow = { date: dateIso };
    (Object.keys(PRAYER_ADHAN_FIELDS) as PrayerKey[]).forEach((prayer) => {
      calculated[PRAYER_ADHAN_FIELDS[prayer]] = buildIso(dateIso, sourceTimings.adhan[prayer] ?? null);
      calculated[PRAYER_IQAMA_FIELDS[prayer]] = buildIso(dateIso, sourceTimings.iqama[prayer] ?? null);
    });
    return json({ row: calculated, source: 'auto_calculated' });
  }

  return json({ row: null });
};
