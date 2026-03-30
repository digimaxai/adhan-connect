import { PrayerName, labelForPrayer } from './adhans';
import type { NormalizedPrayerTimes } from './api/prayerTimesUnified';

export type PrayerTimesDisplay = Partial<Record<PrayerName, string | null>>;

export type NextPrayerSummary = {
  name: PrayerName;
  scheduledAt: Date;
  label: string;
  remaining: string;
};

const PRAYER_NAMES: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const toTimeString = (value: Date | null) =>
  value ? value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null;

const formatRemaining = (target: Date, now: Date) => {
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMin / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (diffMin % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

export function mapNormalizedPrayerTimesToDisplay(normalized: NormalizedPrayerTimes | null): PrayerTimesDisplay | null {
  if (!normalized) return null;
  const mapped: PrayerTimesDisplay = {};
  PRAYER_NAMES.forEach((name) => {
    mapped[name] = toTimeString(normalized[name]?.adhan ?? null);
  });
  return mapped;
}

export function computeNextPrayerSummary(
  normalized: NormalizedPrayerTimes | null,
  now = new Date()
): NextPrayerSummary | null {
  if (!normalized) return null;

  const available = PRAYER_NAMES.map((name) => ({
    name,
    when: normalized[name]?.adhan ?? null,
  }))
    .filter((entry): entry is { name: PrayerName; when: Date } => !!entry.when)
    .sort((a, b) => a.when.getTime() - b.when.getTime());

  if (!available.length) return null;

  const upcoming = available.find((entry) => entry.when.getTime() > now.getTime());
  const chosen = upcoming
    ? upcoming
    : {
        ...available[0],
        when: new Date(available[0].when.getTime() + 24 * 60 * 60 * 1000),
      };

  return {
    name: chosen.name,
    scheduledAt: chosen.when,
    label: chosen.when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    remaining: formatRemaining(chosen.when, now),
  };
}

export function computeNextPrayerSummaryAcrossDays(
  normalizedToday: NormalizedPrayerTimes | null,
  normalizedTomorrow: NormalizedPrayerTimes | null,
  now = new Date()
): NextPrayerSummary | null {
  const todayAvailable = PRAYER_NAMES.map((name) => ({
    name,
    when: normalizedToday?.[name]?.adhan ?? null,
  }))
    .filter((entry): entry is { name: PrayerName; when: Date } => !!entry.when)
    .sort((a, b) => a.when.getTime() - b.when.getTime());

  const upcomingToday = todayAvailable.find((entry) => entry.when.getTime() > now.getTime());
  if (upcomingToday) {
    return {
      name: upcomingToday.name,
      scheduledAt: upcomingToday.when,
      label: upcomingToday.when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      remaining: formatRemaining(upcomingToday.when, now),
    };
  }

  const tomorrowAvailable = PRAYER_NAMES.map((name) => ({
    name,
    when: normalizedTomorrow?.[name]?.adhan ?? null,
  }))
    .filter((entry): entry is { name: PrayerName; when: Date } => !!entry.when)
    .sort((a, b) => a.when.getTime() - b.when.getTime());

  const nextTomorrow = tomorrowAvailable[0] ?? null;
  if (!nextTomorrow) return null;

  return {
    name: nextTomorrow.name,
    scheduledAt: nextTomorrow.when,
    label: nextTomorrow.when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    remaining: formatRemaining(nextTomorrow.when, now),
  };
}

export { labelForPrayer };
