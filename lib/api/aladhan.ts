/**
 * Aladhan prayer times API client.
 * Free, no auth required. https://aladhan.com/prayer-times-api
 *
 * Used as the last-resort fallback in getDailyPrayerTimes when no stored times exist
 * for a mosque+date. Returns astronomically calculated times based on coordinates
 * and the mosque's chosen calculation method.
 *
 * NOTE: These are *calculated* times, not mosque-announced times. They serve as a
 * sensible default for newly onboarded mosques until an admin uploads a verified schedule.
 */

export type AladhanMethod = {
  id: number;
  label: string;
  region: string;
  tradition?: 'sunni' | 'shia';
};

export const ALADHAN_METHODS: AladhanMethod[] = [
  // Sunni methods
  { id: 3,  label: 'Muslim World League (MWL)',                              region: 'Global / Europe', tradition: 'sunni' },
  { id: 2,  label: 'Islamic Society of North America (ISNA)',                region: 'North America', tradition: 'sunni' },
  { id: 4,  label: 'Umm Al-Qura, Makkah',                                   region: 'Saudi Arabia', tradition: 'sunni' },
  { id: 8,  label: 'Gulf Region',                                            region: 'Gulf States', tradition: 'sunni' },
  { id: 9,  label: 'Kuwait',                                                 region: 'Kuwait', tradition: 'sunni' },
  { id: 10, label: 'Qatar',                                                  region: 'Qatar', tradition: 'sunni' },
  { id: 1,  label: 'Karachi / University of Islamic Sciences',               region: 'South Asia (Pakistan)', tradition: 'sunni' },
  { id: 5,  label: 'Egyptian General Authority of Survey',                   region: 'Egypt / North Africa', tradition: 'sunni' },
  { id: 11, label: 'Majlis Ugama Islam Singapura (MUIS)',                    region: 'Singapore / SE Asia', tradition: 'sunni' },
  { id: 12, label: 'Union des Organisations Islamiques de France (UOIF)',    region: 'France / Francophone', tradition: 'sunni' },
  { id: 13, label: 'Diyanet İşleri Başkanlığı',                             region: 'Turkey', tradition: 'sunni' },
  { id: 15, label: 'Moonsighting Committee Worldwide (MCW)',                 region: 'Global', tradition: 'sunni' },
  { id: 14, label: 'Spiritual Administration of Muslims of Russia',          region: 'Russia / Central Asia', tradition: 'sunni' },
  // Shia methods
  { id: 7,  label: 'Institute of Geophysics, Tehran (Twelver/Jafari)',       region: 'Iran', tradition: 'shia' },
];

export const DEFAULT_ALADHAN_METHOD = 3; // Muslim World League — sensible global default

export type AladhanTimings = {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Sunset: string;
  Maghrib: string;
  Isha: string;
  Imsak: string;
  Midnight: string;
};

/**
 * Fetch calculated prayer times for a given location and date.
 *
 * @param lat       Mosque latitude
 * @param lng       Mosque longitude
 * @param dateIso   Date in YYYY-MM-DD format
 * @param method    Aladhan calculation method ID (default: 3 — MWL)
 * @param school    Asr jurisprudence: 0 = Shafi (shadow 1×, default), 1 = Hanafi (shadow 2×)
 * @returns         Timings object with HH:mm strings in the mosque's local time, or null on error
 */
export async function fetchAladhanTimes(
  lat: number,
  lng: number,
  dateIso: string,
  method: number = DEFAULT_ALADHAN_METHOD,
  school: number = 0
): Promise<AladhanTimings | null> {
  // Use manual AbortController instead of AbortSignal.timeout() — the static
  // method is not available in React Native's Hermes engine and throws silently.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const [year, month, day] = dateIso.split('-');
    const aladhanDate = `${day}-${month}-${year}`;
    const url =
      `https://api.aladhan.com/v1/timings/${aladhanDate}` +
      `?latitude=${lat}&longitude=${lng}&method=${method}&school=${school}`;

    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const json = await response.json().catch(() => null);
    if (!json || json.code !== 200 || !json.data?.timings) return null;

    return json.data.timings as AladhanTimings;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
