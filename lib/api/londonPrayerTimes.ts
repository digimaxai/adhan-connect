/**
 * London Prayer Times API client - East London Mosque (ELM) official timetable.
 * https://www.londonprayertimes.com/api/
 *
 * Returns the official ELM published schedule for London, including both adhan
 * and congregation (jamaat) times. Provides both Shafi (asr) and Hanafi (asr_2)
 * Asr times in every response.
 *
 * Used as the auto-calculated fallback for London mosques whose prayer_source
 * is set to 'elm'. Times sourced directly from East London Mosque, not calculated.
 */

const ELM_API_KEY = process.env.EXPO_PUBLIC_LPT_API_KEY ?? '';
const ELM_BASE_URL = 'https://www.londonprayertimes.com/api/times/';

type ELMTimeValue = string | null;
type ELMTimingField = Exclude<keyof ELMTimings, 'date'>;

export type ELMTimings = {
  date: string;
  fajr: ELMTimeValue;
  fajr_jamat: ELMTimeValue;
  sunrise: ELMTimeValue;
  dhuhr: ELMTimeValue;
  dhuhr_jamat: ELMTimeValue;
  asr: ELMTimeValue;       // Shafi (shadow 1x)
  asr_2: ELMTimeValue;     // Hanafi (shadow 2x)
  asr_jamat: ELMTimeValue;
  magrib: ELMTimeValue;    // NB: ELM API spells it "magrib"
  magrib_jamat: ELMTimeValue;
  isha: ELMTimeValue;
  isha_jamat: ELMTimeValue;
};

const ELM_TIME_FIELDS: ELMTimingField[] = [
  'fajr',
  'fajr_jamat',
  'sunrise',
  'dhuhr',
  'dhuhr_jamat',
  'asr',
  'asr_2',
  'asr_jamat',
  'magrib',
  'magrib_jamat',
  'isha',
  'isha_jamat',
];

function normalizeELMTime(value: unknown, field: ELMTimingField, dateIso: string): ELMTimeValue {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  // The upstream ELM data has had rare early-December Dhuhr values around 23:55.
  // Dhuhr/Jamaat should never be an evening time, so drop it and allow fallback.
  if ((field === 'dhuhr' || field === 'dhuhr_jamat') && hour > 16) {
    console.warn(`[fetchELMTimes] Ignoring invalid ${field} value "${value}" for ${dateIso}`);
    return null;
  }

  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function normalizeELMTimings(value: unknown, dateIso: string): ELMTimings | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const normalized = {
    date: typeof raw.date === 'string' ? raw.date : dateIso,
  } as ELMTimings;

  ELM_TIME_FIELDS.forEach((field) => {
    normalized[field] = normalizeELMTime(raw[field], field, dateIso);
  });

  if (!normalized.fajr && !normalized.dhuhr && !normalized.asr && !normalized.asr_2 && !normalized.magrib && !normalized.isha) {
    return null;
  }

  return normalized;
}

/**
 * Fetch the ELM official timetable for a specific date.
 *
 * @param dateIso  Date in YYYY-MM-DD format
 * @returns        ELM timings with HH:mm strings in London local time, or null on error
 */
export async function fetchELMTimes(dateIso: string): Promise<ELMTimings | null> {
  if (!ELM_API_KEY) {
    console.warn('[fetchELMTimes] EXPO_PUBLIC_LPT_API_KEY is not set - skipping ELM fetch');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `${ELM_BASE_URL}?format=json&key=${ELM_API_KEY}&date=${dateIso}&24hours=true`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const json = await response.json().catch(() => null);
    return normalizeELMTimings(json, dateIso);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
