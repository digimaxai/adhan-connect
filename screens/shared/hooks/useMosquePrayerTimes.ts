import { useEffect, useState } from 'react';
import { PrayerName } from '../../../lib/adhans';
import { getDailyPrayerTimes, NormalizedPrayerTimes } from '@/lib/api/prayerTimesUnified';

type PrayerTimes = Partial<Record<PrayerName, string | null>>;

type State = {
  loading: boolean;
  error: string | null;
  times: PrayerTimes | null;
};

const PRAYER_NAMES: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const toTimeString = (value: Date | null) =>
  value ? value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null;

const mapToLegacyShape = (normalized: NormalizedPrayerTimes | null): PrayerTimes | null => {
  if (!normalized) return null;
  const times: PrayerTimes = {};
  PRAYER_NAMES.forEach((name) => {
    times[name] = toTimeString(normalized[name]?.adhan ?? null);
  });
  return times;
};

export function useMosquePrayerTimes(mosqueId?: string | null): State {
  const [state, setState] = useState<State>({ loading: false, error: null, times: null });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!mosqueId) {
        if (mounted) setState({ loading: false, error: null, times: null });
        return;
      }
      if (mounted) setState({ loading: true, error: null, times: null });

      try {
        const normalized = await getDailyPrayerTimes(mosqueId, new Date());
        if (!mounted) return;
        setState({ loading: false, error: null, times: mapToLegacyShape(normalized) });
      } catch (e: any) {
        if (!mounted) return;
        setState({ loading: false, error: e?.message ?? 'Could not load prayer times', times: null });
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [mosqueId]);

  return state;
}
