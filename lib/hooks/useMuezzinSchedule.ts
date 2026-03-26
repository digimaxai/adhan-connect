import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { getMuezzinScheduleForToday } from '../api/muezzin/schedule';
import { persistentStorage } from '../persistentStorage';
import { MuezzinSchedule, MuezzinSlot, PrayerName } from '../types/muezzin';

const PRAYER_ORDER: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const runtimeScheduleCache = new Map<string, MuezzinSchedule>();

function logMuezzinScheduleTrace(stage: string, details?: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log('[muezzin.schedule]', stage, details ?? {});
}

type CachedMuezzinSlot = Omit<MuezzinSlot, 'adhanTime' | 'liveWindowStart' | 'liveWindowEnd' | 'iqamaTime'> & {
  adhanTime: string | null;
  liveWindowStart: string | null;
  liveWindowEnd: string | null;
  iqamaTime: string | null;
};

type CachedMuezzinSchedule = Omit<MuezzinSchedule, 'date' | 'slots' | 'nextAssignedSlot' | 'nextMosqueSlot'> & {
  date?: string | null;
  slots: CachedMuezzinSlot[];
  nextAssignedSlot: CachedMuezzinSlot | null;
  nextMosqueSlot?: CachedMuezzinSlot | null;
};

function scheduleCacheKey(userId: string) {
  return `muezzin_schedule_cache:${userId}`;
}

function toIsoOrNull(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function parseDateOrNull(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serializeSlot(slot: MuezzinSlot | null): CachedMuezzinSlot | null {
  if (!slot) return null;
  return {
    ...slot,
    adhanTime: toIsoOrNull(slot.adhanTime),
    liveWindowStart: toIsoOrNull(slot.liveWindowStart),
    liveWindowEnd: toIsoOrNull(slot.liveWindowEnd),
    iqamaTime: toIsoOrNull(slot.iqamaTime),
  };
}

function deserializeSlot(slot: CachedMuezzinSlot | null | undefined): MuezzinSlot | null {
  if (!slot) return null;
  return {
    ...slot,
    adhanTime: parseDateOrNull(slot.adhanTime),
    liveWindowStart: parseDateOrNull(slot.liveWindowStart),
    liveWindowEnd: parseDateOrNull(slot.liveWindowEnd),
    iqamaTime: parseDateOrNull(slot.iqamaTime),
  };
}

function serializeSchedule(schedule: MuezzinSchedule): CachedMuezzinSchedule {
  return {
    ...schedule,
    date: toIsoOrNull(schedule.date ?? null),
    slots: schedule.slots.map((slot) => serializeSlot(slot)!).filter(Boolean),
    nextAssignedSlot: serializeSlot(schedule.nextAssignedSlot),
    nextMosqueSlot: serializeSlot(schedule.nextMosqueSlot ?? null),
  };
}

function deserializeSchedule(schedule: CachedMuezzinSchedule | null | undefined): MuezzinSchedule | null {
  if (!schedule) return null;
  return {
    ...schedule,
    date: parseDateOrNull(schedule.date ?? null),
    slots: (schedule.slots ?? []).map((slot) => deserializeSlot(slot)).filter((slot): slot is MuezzinSlot => !!slot),
    nextAssignedSlot: deserializeSlot(schedule.nextAssignedSlot),
    nextMosqueSlot: deserializeSlot(schedule.nextMosqueSlot ?? null),
  };
}

function isSameLocalDay(left: Date | null | undefined, right: Date) {
  if (!left) return false;
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

async function loadCachedSchedule(userId: string): Promise<MuezzinSchedule | null> {
  const runtimeSchedule = runtimeScheduleCache.get(userId) ?? null;
  const today = new Date();
  if (runtimeSchedule && isSameLocalDay(runtimeSchedule.date ?? null, today)) {
    return runtimeSchedule;
  }

  try {
    const raw = await persistentStorage.getItem(scheduleCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedMuezzinSchedule;
    const schedule = deserializeSchedule(parsed);
    if (!schedule || !isSameLocalDay(schedule.date ?? null, today)) {
      return null;
    }
    runtimeScheduleCache.set(userId, schedule);
    return schedule;
  } catch {
    return null;
  }
}

async function saveCachedSchedule(userId: string, schedule: MuezzinSchedule | null) {
  if (!schedule) return;
  try {
    runtimeScheduleCache.set(userId, schedule);
    await persistentStorage.setItem(scheduleCacheKey(userId), JSON.stringify(serializeSchedule(schedule)));
  } catch {
    // ignore cache write failures
  }
}

export type MuezzinScheduleEntry = {
  id?: string;
  mosque_id?: string;
  prayer: string;
  prayer_name?: string | null;
  scheduled_at: string;
  status?: string | null;
};

export function useMuezzinSchedule() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const initialRuntimeSchedule = (() => {
    if (!userId) return null;
    const cached = runtimeScheduleCache.get(userId) ?? null;
    return cached && isSameLocalDay(cached.date ?? null, new Date()) ? cached : null;
  })();
  const [schedule, setSchedule] = useState<MuezzinSchedule | null>(initialRuntimeSchedule);
  const [nextAssignedSlot, setNextAssignedSlot] = useState<MuezzinSlot | null>(initialRuntimeSchedule?.nextAssignedSlot ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const lastGoodScheduleRef = useRef<MuezzinSchedule | null>(null);
  const lastGoodAssignedSlotRef = useRef<MuezzinSlot | null>(null);
  const loadCountRef = useRef(0);

  const slotTimeMs = (slot: MuezzinSlot) => (slot.adhanTime ? slot.adhanTime.getTime() : Number.MAX_SAFE_INTEGER);
  const slotWindowEndMs = (slot: MuezzinSlot) =>
    slot.liveWindowEnd?.getTime() ?? slot.adhanTime?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const isWindowOpen = (slot: MuezzinSlot, nowMs: number) =>
    !!slot.liveWindowStart && !!slot.liveWindowEnd && nowMs >= slot.liveWindowStart.getTime() && nowMs <= slot.liveWindowEnd.getTime();

  const load = useCallback(async () => {
    const loadId = ++loadCountRef.current;
    const startedAt = Date.now();
    if (!userId) {
      logMuezzinScheduleTrace('load:skip-no-user', { loadId });
      setSchedule(null);
      setNextAssignedSlot(null);
      setError(null);
      setLoading(false);
      return;
    }
    logMuezzinScheduleTrace('load:start', {
      loadId,
      userId,
      hasRuntimeSchedule: !!lastGoodScheduleRef.current,
      hasAssignedSlot: !!lastGoodAssignedSlotRef.current,
    });
    setLoading(true);
    setError(null);
    try {
      const { schedule: data, error: apiError } = await getMuezzinScheduleForToday();
      if (cancelledRef.current) return;
      if (apiError) {
        logMuezzinScheduleTrace('load:api-error', {
          loadId,
          durationMs: Date.now() - startedAt,
          message: apiError.message ?? 'Unable to load schedule',
          reusedCachedSchedule: !!lastGoodScheduleRef.current,
        });
        setSchedule(lastGoodScheduleRef.current);
        setNextAssignedSlot(lastGoodAssignedSlotRef.current);
        setError(apiError.message ?? 'Unable to load schedule');
      } else {
        logMuezzinScheduleTrace('load:api-success', {
          loadId,
          durationMs: Date.now() - startedAt,
          mosqueId: data?.mosqueId ?? null,
          mosqueName: data?.mosqueName ?? null,
          slots: data?.slots.length ?? 0,
          nextAssignedPrayer: data?.nextAssignedSlot?.prayerName ?? null,
          nextMosquePrayer: data?.nextMosqueSlot?.prayerName ?? null,
        });
        setSchedule(data);
        setNextAssignedSlot(data?.nextAssignedSlot ?? null);
        if (data) {
          lastGoodScheduleRef.current = data;
          lastGoodAssignedSlotRef.current = data.nextAssignedSlot ?? null;
          void saveCachedSchedule(userId, data);
        }
        setError(null);
      }
    } catch (err: any) {
      if (!cancelledRef.current) {
        logMuezzinScheduleTrace('load:unexpected-error', {
          loadId,
          durationMs: Date.now() - startedAt,
          message: err?.message ?? 'Unable to load schedule',
          reusedCachedSchedule: !!lastGoodScheduleRef.current,
        });
        setSchedule(lastGoodScheduleRef.current);
        setNextAssignedSlot(lastGoodAssignedSlotRef.current);
        setError(err?.message ?? 'Unable to load schedule');
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromCache() {
      if (!userId) {
        lastGoodScheduleRef.current = null;
        lastGoodAssignedSlotRef.current = null;
        setSchedule(null);
        setNextAssignedSlot(null);
        setError(null);
        setLoading(false);
        return;
      }

      const cachedSchedule = await loadCachedSchedule(userId);
      if (cancelled) return;
      if (!cachedSchedule) {
        logMuezzinScheduleTrace('cache:miss', { userId });
        return;
      }
      logMuezzinScheduleTrace('cache:hydrate', {
        userId,
        mosqueId: cachedSchedule.mosqueId ?? null,
        mosqueName: cachedSchedule.mosqueName ?? null,
        slots: cachedSchedule.slots.length,
        nextAssignedPrayer: cachedSchedule.nextAssignedSlot?.prayerName ?? null,
      });
      lastGoodScheduleRef.current = cachedSchedule;
      lastGoodAssignedSlotRef.current = cachedSchedule.nextAssignedSlot ?? null;
      setSchedule(cachedSchedule);
      setNextAssignedSlot(cachedSchedule.nextAssignedSlot ?? null);
    }

    hydrateFromCache();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
    if (schedule.nextAssignedSlot) {
      setNextAssignedSlot(schedule.nextAssignedSlot);
      return;
    }
    const now = Date.now();
    const actionable = schedule.slots
      .filter((slot) => slot.isAssignedToMe)
      .filter((slot) => slotWindowEndMs(slot) >= now)
      .sort((a, b) => (a.adhanTime?.getTime() ?? 0) - (b.adhanTime?.getTime() ?? 0));
    actionable.sort((a, b) => {
      const openA = isWindowOpen(a, now);
      const openB = isWindowOpen(b, now);
      if (openA !== openB) return openA ? -1 : 1;
      const timeA = slotTimeMs(a);
      const timeB = slotTimeMs(b);
      if (timeA !== timeB) return timeA - timeB;
      return PRAYER_ORDER.indexOf(a.prayerName) - PRAYER_ORDER.indexOf(b.prayerName);
    });
    if (actionable[0]) {
      setNextAssignedSlot(actionable[0]);
      return;
    }

    // Fallback only for schedules missing concrete times.
    const firstAssigned = [...schedule.slots]
      .filter((slot) => slot.isAssignedToMe && !slot.adhanTime)
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
