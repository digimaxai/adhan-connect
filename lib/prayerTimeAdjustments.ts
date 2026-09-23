import type { PrayerName } from './adhans';

export const PRAYER_ADJUSTMENT_MIN = -30;
export const PRAYER_ADJUSTMENT_MAX = 30;
export const PRAYER_ADJUSTMENT_KEYS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export type PrayerTimeAdjustments = Record<PrayerName, number>;

export const EMPTY_PRAYER_TIME_ADJUSTMENTS: PrayerTimeAdjustments = {
  fajr: 0,
  dhuhr: 0,
  asr: 0,
  maghrib: 0,
  isha: 0,
};

export function normalizePrayerTimeAdjustments(value: unknown): PrayerTimeAdjustments {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return PRAYER_ADJUSTMENT_KEYS.reduce((result, prayer) => {
    const raw = input[prayer];
    const parsed = typeof raw === 'number' ? raw : Number(raw ?? 0);
    result[prayer] = Number.isInteger(parsed)
      ? Math.max(PRAYER_ADJUSTMENT_MIN, Math.min(PRAYER_ADJUSTMENT_MAX, parsed))
      : 0;
    return result;
  }, { ...EMPTY_PRAYER_TIME_ADJUSTMENTS });
}

export function addMinutes(date: Date | null, minutes: number): Date | null {
  if (!date || !Number.isFinite(date.getTime()) || !minutes) return date;
  return new Date(date.getTime() + minutes * 60_000);
}

export function adjustClockTime(value: string | null | undefined, minutes: number) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const total = Number(match[1]) * 60 + Number(match[2]) + minutes;
  const dayOffset = Math.floor(total / 1440);
  const normalized = ((total % 1440) + 1440) % 1440;
  return {
    time: `${Math.floor(normalized / 60).toString().padStart(2, '0')}:${(normalized % 60).toString().padStart(2, '0')}`,
    dayOffset,
  };
}

export function formatPrayerAdjustment(minutes: number) {
  if (!minutes) return 'No adjustment';
  return `${minutes > 0 ? '+' : ''}${minutes} min`;
}
