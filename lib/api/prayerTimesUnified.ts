import { supabase } from '../supabase';
import { PrayerName } from '../adhans';

export type PrayerTimeSlot = { adhan: Date | null; iqama: Date | null };
export type NormalizedPrayerTimes = Record<PrayerName, PrayerTimeSlot>;

const PRAYER_NAMES: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

type PrayerTimesRow = {
  date?: string | null;
  fajr_adhan_time?: string | Date | null;
  fajr_iqama_time?: string | Date | null;
  dhuhr_adhan_time?: string | Date | null;
  dhuhr_iqama_time?: string | Date | null;
  asr_adhan_time?: string | Date | null;
  asr_iqama_time?: string | Date | null;
  maghrib_adhan_time?: string | Date | null;
  maghrib_iqama_time?: string | Date | null;
  isha_adhan_time?: string | Date | null;
  isha_iqama_time?: string | Date | null;
};

type LegacyPrayerRow = {
  prayer_date?: string | null;
  fajr?: string | null;
  dhuhr?: string | null;
  asr?: string | null;
  maghrib?: string | null;
  isha?: string | null;
};

const safeDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const emptyNormalized = (): NormalizedPrayerTimes => ({
  fajr: { adhan: null, iqama: null },
  dhuhr: { adhan: null, iqama: null },
  asr: { adhan: null, iqama: null },
  maghrib: { adhan: null, iqama: null },
  isha: { adhan: null, iqama: null },
});

export function normalizePrayerTimes(row?: PrayerTimesRow | null): NormalizedPrayerTimes | null {
  if (!row) return null;
  const normalized = emptyNormalized();

  normalized.fajr = { adhan: safeDate(row.fajr_adhan_time), iqama: safeDate(row.fajr_iqama_time) };
  normalized.dhuhr = { adhan: safeDate(row.dhuhr_adhan_time), iqama: safeDate(row.dhuhr_iqama_time) };
  normalized.asr = { adhan: safeDate(row.asr_adhan_time), iqama: safeDate(row.asr_iqama_time) };
  normalized.maghrib = { adhan: safeDate(row.maghrib_adhan_time), iqama: safeDate(row.maghrib_iqama_time) };
  normalized.isha = { adhan: safeDate(row.isha_adhan_time), iqama: safeDate(row.isha_iqama_time) };

  return normalized;
}

export function convertLegacyTimesToDate(prayerDate: string | Date, time?: string | null): Date | null {
  if (!time) return null;
  const datePart = prayerDate instanceof Date ? prayerDate.toISOString().slice(0, 10) : prayerDate;
  const timePart = time.length === 5 ? `${time}:00` : time;
  const parsed = new Date(`${datePart}T${timePart}`);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export async function getDailyPrayerTimes(mosqueId: string, date: Date): Promise<NormalizedPrayerTimes | null> {
  const dateIso = date.toISOString().slice(0, 10);

  const { data: primary, error: primaryErr } = await supabase
    .from('prayer_times')
    .select(
      'date,fajr_adhan_time,fajr_iqama_time,dhuhr_adhan_time,dhuhr_iqama_time,asr_adhan_time,asr_iqama_time,maghrib_adhan_time,maghrib_iqama_time,isha_adhan_time,isha_iqama_time'
    )
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso)
    .maybeSingle<PrayerTimesRow>();

  if (primaryErr && primaryErr.code !== 'PGRST116') throw primaryErr;

  const normalized = normalizePrayerTimes(primary);
  if (normalized) return normalized;

  const { data: legacy, error: legacyErr } = await supabase
    .from('mosque_prayer_times')
    .select('prayer_date,fajr,dhuhr,asr,maghrib,isha')
    .eq('mosque_id', mosqueId)
    .eq('prayer_date', dateIso)
    .maybeSingle<LegacyPrayerRow>();

  if (legacyErr && legacyErr.code !== 'PGRST116') throw legacyErr;
  if (!legacy) return null;

  const fallback = emptyNormalized();
  const legacyDate = legacy.prayer_date ?? dateIso;

  PRAYER_NAMES.forEach((name) => {
    const slot = (() => {
      switch (name) {
        case 'fajr':
          return legacy.fajr;
        case 'dhuhr':
          return legacy.dhuhr;
        case 'asr':
          return legacy.asr;
        case 'maghrib':
          return legacy.maghrib;
        case 'isha':
          return legacy.isha;
        default:
          return null;
      }
    })();
    fallback[name] = { adhan: convertLegacyTimesToDate(legacyDate, slot), iqama: null };
  });

  return fallback;
}
