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

type RotaRow = {
  prayer_name?: string | null;
  adhan_time?: string | Date | null;
};

const safeDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const safeDateWithBase = (value: string | Date | null | undefined, dateIso: string) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(value.trim())) {
    const timePart = value.length === 5 ? `${value}:00` : value;
    const parsed = new Date(`${dateIso}T${timePart}`);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const emptyNormalized = (): NormalizedPrayerTimes => ({
  fajr: { adhan: null, iqama: null },
  dhuhr: { adhan: null, iqama: null },
  asr: { adhan: null, iqama: null },
  maghrib: { adhan: null, iqama: null },
  isha: { adhan: null, iqama: null },
});

const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  // NOTE: prayer_times is the canonical source; if a row exists for (mosque_id, date) it fully overrides mosque_prayer_times for that day. mosque_prayer_times is fallback only.
  // Example: for Harrow on 2025-12-09, if prayer_times has edited times and mosque_prayer_times still holds imported ones, this helper returns the prayer_times values for all prayers.
  const dateIso = formatLocalDate(date);

  let normalized: NormalizedPrayerTimes | null = null;
  try {
    const { data: primary, error: primaryErr } = await supabase
      .from('prayer_times')
      .select(
        'date,fajr_adhan_time,fajr_iqama_time,dhuhr_adhan_time,dhuhr_iqama_time,asr_adhan_time,asr_iqama_time,maghrib_adhan_time,maghrib_iqama_time,isha_adhan_time,isha_iqama_time'
      )
      .eq('mosque_id', mosqueId)
      .eq('date', dateIso)
      .maybeSingle<PrayerTimesRow>();

    if (!primaryErr && primary) {
      normalized = {
        fajr: { adhan: safeDateWithBase(primary.fajr_adhan_time, dateIso), iqama: safeDateWithBase(primary.fajr_iqama_time, dateIso) },
        dhuhr: { adhan: safeDateWithBase(primary.dhuhr_adhan_time, dateIso), iqama: safeDateWithBase(primary.dhuhr_iqama_time, dateIso) },
        asr: { adhan: safeDateWithBase(primary.asr_adhan_time, dateIso), iqama: safeDateWithBase(primary.asr_iqama_time, dateIso) },
        maghrib: { adhan: safeDateWithBase(primary.maghrib_adhan_time, dateIso), iqama: safeDateWithBase(primary.maghrib_iqama_time, dateIso) },
        isha: { adhan: safeDateWithBase(primary.isha_adhan_time, dateIso), iqama: safeDateWithBase(primary.isha_iqama_time, dateIso) },
      };
    } else if (primaryErr && primaryErr.code !== 'PGRST116') {
      // RLS or permission errors should not block fallback; log and continue to legacy.
      console.warn('[getDailyPrayerTimes] primary prayer_times fetch error', primaryErr.message ?? primaryErr);
    }
  } catch (err: any) {
    console.warn('[getDailyPrayerTimes] primary prayer_times fetch threw', err?.message ?? err);
  }

  if (normalized) return normalized;

  try {
    const { data: legacy, error: legacyErr } = await supabase
      .from('mosque_prayer_times')
      .select('prayer_date,fajr,dhuhr,asr,maghrib,isha')
      .eq('mosque_id', mosqueId)
      .eq('prayer_date', dateIso)
      .maybeSingle<LegacyPrayerRow>();

    if (!legacyErr && legacy) {
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
    if (legacyErr && legacyErr.code !== 'PGRST116') {
      console.warn('[getDailyPrayerTimes] legacy mosque_prayer_times error', legacyErr.message ?? legacyErr);
    }
  } catch (err: any) {
    console.warn('[getDailyPrayerTimes] legacy mosque_prayer_times fetch threw', err?.message ?? err);
  }

  // As a last resort, try staff_rota adhan_time so listeners can still see schedule-driven times.
  try {
    const { data: rota, error: rotaErr } = await supabase
      .from('staff_rota')
      .select('prayer_name, adhan_time')
      .eq('mosque_id', mosqueId)
      .eq('date', dateIso);

    if (!rotaErr && rota?.length) {
      const rotaNormalized = emptyNormalized();
      (rota as RotaRow[]).forEach((row) => {
        const key = (row.prayer_name ?? '').toLowerCase() as PrayerName;
        if (!PRAYER_NAMES.includes(key)) return;
        rotaNormalized[key] = { adhan: safeDateWithBase(row.adhan_time ?? null, dateIso), iqama: null };
      });
      const hasAny = PRAYER_NAMES.some((p) => rotaNormalized[p].adhan);
      if (hasAny) return rotaNormalized;
    } else if (rotaErr && rotaErr.code !== 'PGRST116') {
      console.warn('[getDailyPrayerTimes] staff_rota fallback error', rotaErr.message ?? rotaErr);
    }
  } catch (err: any) {
    console.warn('[getDailyPrayerTimes] staff_rota fallback threw', err?.message ?? err);
  }

  return null;
}
