import { useCallback, useEffect, useRef, useState } from 'react';
import { PrayerName } from '../../../lib/adhans';
import { getDailyPrayerTimes, NormalizedPrayerTimes } from '@/lib/api/prayerTimesUnified';
import { usePrayerTimesRealtime } from './usePrayerTimesRealtime';

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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (options?: { background?: boolean }) => {
      const background = !!options?.background;
      if (!mosqueId) {
        if (mountedRef.current) setState({ loading: false, error: null, times: null });
        return;
      }
      if (background) {
        if (mountedRef.current) setState((prev) => ({ ...prev, error: null }));
      } else {
        if (mountedRef.current) setState({ loading: true, error: null, times: null });
      }

      try {
        const normalized = await getDailyPrayerTimes(mosqueId, new Date());
        if (mountedRef.current) setState({ loading: false, error: null, times: mapToLegacyShape(normalized) });
      } catch (e: any) {
        if (mountedRef.current) {
          setState((prev) => ({
            loading: false,
            error: e?.message ?? 'Could not load prayer times',
            times: background ? prev.times : null,
          }));
        }
      }
    },
    [mosqueId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  usePrayerTimesRealtime(
    mosqueId,
    () => {
      void load({ background: true });
    },
    { channelName: 'mosque-prayer-times-hook' }
  );

  return state;
}
