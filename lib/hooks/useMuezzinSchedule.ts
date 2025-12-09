import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMuezzinScheduleForToday, MuezzinPrayerSlot, MuezzinScheduleForDay } from '../api/muezzin/schedule';

export type MuezzinScheduleEntry = {
  id?: string;
  mosque_id?: string;
  prayer: string;
  prayer_name?: string | null;
  scheduled_at: string;
  status?: string | null;
};

export function useMuezzinSchedule() {
  const [schedule, setSchedule] = useState<MuezzinScheduleForDay | null>(null);
  const [nextAssignedSlot, setNextAssignedSlot] = useState<MuezzinPrayerSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PRAYER_ORDER: MuezzinPrayerSlot['prayerName'][] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const cancelledRef = useRef(false);

  const slotTimeMs = (slot: MuezzinPrayerSlot) => (slot.adhanTime ? slot.adhanTime.getTime() : Number.MAX_SAFE_INTEGER);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { schedule: data, error: apiError } = await getMuezzinScheduleForToday();
      if (cancelledRef.current) return;
      if (apiError) {
        setSchedule(null);
        setNextAssignedSlot(null);
        setError(apiError.message ?? 'Unable to load schedule');
      } else {
        setSchedule(data);
        setError(null);
      }
    } catch (err: any) {
      if (!cancelledRef.current) {
        setSchedule(null);
        setNextAssignedSlot(null);
        setError(err?.message ?? 'Unable to load schedule');
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  useEffect(() => {
    if (!schedule?.slots?.length) {
      setNextAssignedSlot(null);
      return;
    }
    const now = Date.now();
    const upcoming = schedule.slots
      .filter((slot) => slot.isAssignedToMe && slot.adhanTime && slot.adhanTime.getTime() >= now)
      .sort((a, b) => (a.adhanTime?.getTime() ?? 0) - (b.adhanTime?.getTime() ?? 0));
    if (upcoming[0]) {
      setNextAssignedSlot(upcoming[0]);
      return;
    }
    // Fallback: earliest assigned slot today, even if time is missing/past.
    const firstAssigned = [...schedule.slots]
      .filter((slot) => slot.isAssignedToMe)
      .sort((a, b) => {
        const timeA = slotTimeMs(a);
        const timeB = slotTimeMs(b);
        if (timeA !== timeB) return timeA - timeB;
        return PRAYER_ORDER.indexOf(a.prayerName) - PRAYER_ORDER.indexOf(b.prayerName);
      })[0];
    setNextAssignedSlot(firstAssigned ?? null);
  }, [schedule]);

  const result = useMemo(
    () => ({
      schedule,
      nextAssignedSlot,
      loading,
      error,
      refresh: load,
    }),
    [schedule, nextAssignedSlot, loading, error, load]
  );

  console.log('[useMuezzinSchedule] schedule', schedule, 'nextAssigned', nextAssignedSlot, 'error', error);

  return result;
}
