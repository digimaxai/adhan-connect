import { fetchAladhanTimes } from '../../../lib/api/aladhan';
import { fetchELMTimes } from '../../../lib/api/londonPrayerTimes';
import { supabase } from '../../../lib/supabase';
import { adjustClockTime, normalizePrayerTimeAdjustments, type PrayerTimeAdjustments } from '../../../lib/prayerTimeAdjustments';

export const runtime = 'nodejs';

type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

type NearbyRpcRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  time_zone: string | null;
  prayer_calculation_method: number | null;
  prayer_school: number | null;
  distance_km: number;
  prayer_source: string | null;
  prayer_time_adjustments?: PrayerTimeAdjustments | null;
  next_prayer: string | null;
  next_adhan_at: string | null;
  is_live: boolean;
  live_prayer: string | null;
  live_adhan_id: string | null;
  live_started_at: string | null;
};

export type NearbyMosqueContext = {
  id: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  next_prayer: PrayerName | null;
  next_adhan_at: string | null;
  minutes_until: number | null;
  schedule_source: 'mosque' | 'calculated' | 'unavailable';
  is_live: boolean;
  live_prayer: string | null;
  live_adhan_id: string | null;
  live_started_at: string | null;
};

const CACHE_TTL_MS = 10_000;
const cache = new Map<string, { at: number; rows: NearbyMosqueContext[] }>();
const CALCULATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const calculationCache = new Map<
  string,
  { expiresAt: number; value: Promise<Record<PrayerName, { time: string; dayOffset: number } | null> | null> }
>();
const PRAYERS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      // Coordinates are request-specific and must never enter a shared CDN cache.
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

function isPrayerName(value: unknown): value is PrayerName {
  return typeof value === 'string' && PRAYERS.includes(value.toLowerCase() as PrayerName);
}

function safeTimeZone(value: string | null | undefined) {
  const candidate = value?.trim() || 'UTC';
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'UTC';
  }
}

function dateIsoInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function addDays(dateIso: string, days: number) {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseClock(value: string | null | undefined) {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null;
}

/** Convert a mosque-local wall-clock time to a UTC Date without adding a date library. */
function zonedTimeToUtc(dateIso: string, clock: string, timeZone: string) {
  const parsed = parseClock(clock);
  if (!parsed) return null;
  const [year, month, day] = dateIso.split('-').map(Number);
  const desiredUtcMs = Date.UTC(year, month - 1, day, parsed.hour, parsed.minute, 0);

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const offsetAt = (instantMs: number) => {
    const parts = formatter.formatToParts(new Date(instantMs));
    const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const hour = number('hour') === 24 ? 0 : number('hour');
    return Date.UTC(number('year'), number('month') - 1, number('day'), hour, number('minute'), number('second')) - instantMs;
  };

  let resultMs = desiredUtcMs - offsetAt(desiredUtcMs);
  resultMs = desiredUtcMs - offsetAt(resultMs);
  const result = new Date(resultMs);
  return Number.isFinite(result.getTime()) ? result : null;
}

function locationBucket(value: number) {
  // Calculated times are estimates; a roughly 5 km bucket prevents one nearby
  // screen from multiplying upstream requests for adjacent mosques.
  return Math.round(value * 20) / 20;
}

function calculationCacheKey(row: NearbyRpcRow, dateIso: string, timeZone: string) {
  const adjustmentKey = JSON.stringify(normalizePrayerTimeAdjustments(row.prayer_time_adjustments));
  if (row.prayer_source === 'elm') {
    return ['elm', dateIso, row.prayer_school ?? 0, adjustmentKey].join(':');
  }
  return [
    'aladhan',
    dateIso,
    timeZone,
    row.prayer_calculation_method ?? 3,
    row.prayer_school ?? 0,
    locationBucket(row.latitude),
    locationBucket(row.longitude),
    adjustmentKey,
  ].join(':');
}

function calculatedDay(row: NearbyRpcRow, dateIso: string, timeZone: string) {
  const key = calculationCacheKey(row, dateIso, timeZone);
  const cached = calculationCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  if (calculationCache.size > 500) {
    const now = Date.now();
    for (const [entryKey, entry] of calculationCache) {
      if (entry.expiresAt <= now) calculationCache.delete(entryKey);
    }
  }

  const value = (async () => {
    let base: Record<PrayerName, string | null | undefined> | null = null;
    if (row.prayer_source === 'elm') {
      const elm = await fetchELMTimes(dateIso);
      if (elm) {
        base = {
          fajr: elm.fajr,
          dhuhr: elm.dhuhr,
          asr: row.prayer_school === 1 ? elm.asr_2 : elm.asr,
          maghrib: elm.magrib,
          isha: elm.isha,
        };
      }
    }
    if (!base) {
      const timings = await fetchAladhanTimes(
        locationBucket(row.latitude), locationBucket(row.longitude), dateIso,
        row.prayer_calculation_method ?? 3, row.prayer_school ?? 0
      );
      base = timings ? { fajr: timings.Fajr, dhuhr: timings.Dhuhr, asr: timings.Asr, maghrib: timings.Maghrib, isha: timings.Isha } : null;
    }
    if (!base) return null;
    const adjustments = normalizePrayerTimeAdjustments(row.prayer_time_adjustments);
    return Object.fromEntries(PRAYERS.map((prayer) => [
      prayer,
      base?.[prayer] ? adjustClockTime(base[prayer]!, adjustments[prayer]) : null,
    ])) as Record<PrayerName, { time: string; dayOffset: number } | null>;
  })().catch(() => null);

  calculationCache.set(key, {
    expiresAt: Date.now() + CALCULATION_CACHE_TTL_MS,
    value,
  });
  return value;
}

async function calculatedNextPrayer(row: NearbyRpcRow, now: Date) {
  const timeZone = safeTimeZone(row.time_zone);
  const today = dateIsoInTimeZone(now, timeZone);
  const dates = [today, addDays(today, 1)];

  const days = await Promise.all(dates.map(async (dateIso) => ({
    dateIso,
    timings: await calculatedDay(row, dateIso, timeZone),
  })));

  const occurrences = days.flatMap(({ dateIso, timings }) => (
    timings
      ? PRAYERS.map((prayer) => ({
          prayer,
          at: timings[prayer]
            ? zonedTimeToUtc(addDays(dateIso, timings[prayer]!.dayOffset), timings[prayer]!.time, timeZone)
            : null,
        }))
      : []
  ));

  return occurrences
    .filter((occurrence): occurrence is { prayer: PrayerName; at: Date } => (
      occurrence.at !== null && occurrence.at.getTime() >= now.getTime() - 90_000
    ))
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0] ?? null;
}

function sourceLabel(source: string | null, hasStoredTime: boolean): NearbyMosqueContext['schedule_source'] {
  if (!hasStoredTime) return 'calculated';
  return source === 'manual' || source === 'upload' || source === 'mosque'
    ? 'mosque'
    : 'calculated';
}

async function enrichRows(rows: NearbyRpcRow[], now: Date) {
  return Promise.all(rows.map(async (row): Promise<NearbyMosqueContext> => {
    let nextPrayer = isPrayerName(row.next_prayer) ? row.next_prayer.toLowerCase() as PrayerName : null;
    let nextAt = row.next_adhan_at ? new Date(row.next_adhan_at) : null;
    let scheduleSource = sourceLabel(row.prayer_source, !!nextAt && Number.isFinite(nextAt.getTime()));

    if (!nextAt || !Number.isFinite(nextAt.getTime())) {
      const calculated = await calculatedNextPrayer(row, now);
      nextPrayer = calculated?.prayer ?? null;
      nextAt = calculated?.at ?? null;
      scheduleSource = calculated ? 'calculated' : 'unavailable';
    }

    const nextAtMs = nextAt?.getTime() ?? Number.NaN;
    return {
      id: row.id,
      name: row.name,
      city: row.city?.trim() || 'Location unavailable',
      country: row.country?.trim() || '',
      latitude: row.latitude,
      longitude: row.longitude,
      distance_km: Number(row.distance_km.toFixed(1)),
      next_prayer: nextPrayer,
      next_adhan_at: Number.isFinite(nextAtMs) ? new Date(nextAtMs).toISOString() : null,
      minutes_until: Number.isFinite(nextAtMs)
        ? Math.max(0, Math.ceil((nextAtMs - now.getTime()) / 60_000))
        : null,
      schedule_source: scheduleSource,
      is_live: row.is_live === true,
      live_prayer: row.live_prayer,
      live_adhan_id: row.live_adhan_id,
      live_started_at: row.live_started_at,
    };
  }));
}

async function fallbackNearbyRows(latitude: number, longitude: number, radiusKm: number, limit: number) {
  const { data, error } = await supabase
    .from('mosques')
    .select('id,name,city,country,lat,lng,time_zone,timezone,prayer_source,prayer_calculation_method,prayer_school,prayer_time_adjustments')
    .eq('status', 'active')
    .eq('is_active', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(1000);
  if (error) throw error;

  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const distance = (lat: number, lon: number) => {
    const dLat = toRadians(lat - latitude);
    const dLon = toRadians(lon - longitude);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(latitude)) * Math.cos(toRadians(lat)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  return (data ?? [])
    .map((mosque) => ({ mosque, distanceKm: distance(Number(mosque.lat), Number(mosque.lng)) }))
    .filter((item) => item.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map(({ mosque, distanceKm }): NearbyRpcRow => ({
      id: mosque.id,
      name: mosque.name,
      city: mosque.city,
      country: mosque.country,
      latitude: Number(mosque.lat),
      longitude: Number(mosque.lng),
      time_zone: mosque.time_zone ?? mosque.timezone ?? 'UTC',
      prayer_calculation_method: mosque.prayer_calculation_method,
      prayer_school: mosque.prayer_school,
      distance_km: distanceKm,
      prayer_source: mosque.prayer_source,
      prayer_time_adjustments: mosque.prayer_time_adjustments,
      next_prayer: null,
      next_adhan_at: null,
      is_live: false,
      live_prayer: null,
      live_adhan_id: null,
      live_started_at: null,
    }));
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const latitude = Number(requestUrl.searchParams.get('lat'));
  const longitude = Number(requestUrl.searchParams.get('lon'));
  const requestedRadius = Number(requestUrl.searchParams.get('radius') ?? 15);
  const requestedLimit = Number(requestUrl.searchParams.get('limit') ?? 10);
  const radiusKm = Number.isFinite(requestedRadius) ? Math.min(Math.max(requestedRadius, 1), 100) : 15;
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.round(requestedLimit), 1), 25) : 10;

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return json({ error: 'Valid latitude and longitude parameters are required.' }, 400);
  }

  const cacheKey = `${Math.round(latitude * 100)}:${Math.round(longitude * 100)}:${radiusKm}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return json({ mosques: cached.rows, cached: true, fresh_as_of: new Date(cached.at).toISOString() });
  }

  try {
    const { data, error } = await supabase.rpc('nearby_mosque_context_v1', {
      p_latitude: latitude,
      p_longitude: longitude,
      p_radius_km: radiusKm,
      p_limit: limit,
    });

    let rows = error
      ? await fallbackNearbyRows(latitude, longitude, radiusKm, limit)
      : (data ?? []) as NearbyRpcRow[];
    if (!error && rows.length > 0) {
      const { data: configs } = await supabase
        .from('mosques')
        .select('id, prayer_time_adjustments')
        .in('id', rows.map((row) => row.id));
      const byId = new Map((configs ?? []).map((config) => [config.id, config.prayer_time_adjustments]));
      rows = rows.map((row) => ({ ...row, prayer_time_adjustments: byId.get(row.id) ?? null }));
    }
    const now = new Date();
    const enriched = await enrichRows(rows, now);
    const sorted = enriched.sort((a, b) => {
      if (a.is_live !== b.is_live) return a.is_live ? -1 : 1;
      return a.distance_km - b.distance_km;
    });
    cache.set(cacheKey, { at: now.getTime(), rows: sorted });

    return json({
      mosques: sorted,
      cached: false,
      fresh_as_of: now.toISOString(),
      location_precision: 'approximately_1km_cache_cell',
    });
  } catch (error) {
    console.error('[nearby-mosques]', error);
    return json({ error: 'Nearby mosques are temporarily unavailable.', mosques: [] }, 503);
  }
}
