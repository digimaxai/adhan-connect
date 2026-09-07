// Keep the stored service name stable so existing selections remain editable.
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
