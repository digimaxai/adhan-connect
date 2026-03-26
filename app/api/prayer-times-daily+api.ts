import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';

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

  const { data: mosque, error: mosqueError } = await supabaseAdmin
    .from('mosques')
    .select('id, status')
    .eq('id', mosqueId)
    .maybeSingle();

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
    return json({ row: row as PrayerTimesRow });
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

  return json({ row: null });
};
