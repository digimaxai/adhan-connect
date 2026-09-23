// Keep the stored service name stable so existing selections remain editable.
export const MOSQUE_SERVICE_OPTIONS = [
  "Friday Jumu'ah Prayer",
  "Friday Jumu'ah Prayer (at another location)",
  'Daily congregation prayers (5 daily)',
  'Eid prayers',
  'Ramadan programs / Tarawih',
  'Islamic education / Madrasah',
  'Quran classes',
  'Youth programs',
  "Women's prayer area",
  'Convert / new Muslim support',
  'Funeral services (Janazah)',
  'Wedding ceremonies (Nikah)',
  'Food bank / welfare support',
  'Parking available',
  'Wheelchair accessible',
  'Wudu facilities',
  'Online services / live stream',
] as const;

const DAILY_CONGREGATION_SERVICE = 'Daily congregation prayers (5 daily)';
const DAILY_PRAYERS = [
  ['fajr', 'Fajr'],
  ['dhuhr', 'Dhuhr'],
  ['asr', 'Asr'],
  ['maghrib', 'Maghrib'],
  ['isha', 'Isha'],
] as const;

export function mosqueServiceLabel(service: string, prayersNotOffered?: readonly string[] | null): string {
  if (service !== DAILY_CONGREGATION_SERVICE) return service;

  const excluded = DAILY_PRAYERS
    .filter(([key]) => prayersNotOffered?.includes(key))
    .map(([, label]) => label);

  if (excluded.length === 0) return service;
  if (excluded.length === DAILY_PRAYERS.length) return 'Daily congregation prayers (not offered here)';
  return `Daily congregation prayers (except ${excluded.join(', ')})`;
}
