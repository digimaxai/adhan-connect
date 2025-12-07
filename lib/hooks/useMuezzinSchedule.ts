import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth';
import { supabase } from '../supabase';
import { PrayerName } from '../adhans';
import { getMuezzinPrimaryMosque } from '../liveAdhan';
import { getDailyPrayerTimes, NormalizedPrayerTimes } from '../api/prayerTimesUnified';

export type MuezzinScheduleEntry = {
  id: string;
  mosque_id: string;
  prayer: PrayerName | string;
  scheduled_at: string;
  status?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  stream_id?: string | null;
};

export type MuezzinScheduleState = {
  loading: boolean;
  error: string | null;
  mosqueId: string | null;
  mosqueName: string | null;
  todayAdhans: MuezzinScheduleEntry[];
  nextAdhan: MuezzinScheduleEntry | null;
  assignedPrayers: Record<PrayerName, boolean>;
  assignedAdhanTimes: Partial<Record<PrayerName, string | null>>;
};

const PRAYER_ORDER: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

// Hook: fetch active muezzin assignment and today's adhans (local day).
export function useMuezzinSchedule(): MuezzinScheduleState {
  const { session } = useAuth();
  const [state, setState] = useState<MuezzinScheduleState>({
    loading: true,
    error: null,
    mosqueId: null,
    mosqueName: null,
    todayAdhans: [],
    nextAdhan: null,
    assignedPrayers: {
      fajr: false,
      dhuhr: false,
      asr: false,
      maghrib: false,
      isha: false,
    },
    assignedAdhanTimes: {},
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const userId = session?.user?.id ?? null;
      if (!userId) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false, mosqueId: null, mosqueName: null, todayAdhans: [], nextAdhan: null, error: null }));
        }
        return;
      }

      if (!cancelled) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      }

      try {
        const primary = await getMuezzinPrimaryMosque(supabase as any, userId);
        const mosqueId = primary?.mosqueId ?? null;
        const mosqueName = primary?.mosqueName ?? null;

        if (!mosqueId) {
          if (!cancelled) {
            setState({
              loading: false,
              error: null,
              mosqueId: null,
              mosqueName: null,
              todayAdhans: [],
              nextAdhan: null,
              assignedPrayers: state.assignedPrayers,
              assignedAdhanTimes: state.assignedAdhanTimes,
            });
          }
          return;
        }

        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const prayerTimes = await getDailyPrayerTimes(mosqueId, startOfDay);

        const { data, error } = await supabase
          .from('adhans')
          .select('id, mosque_id, prayer, status, scheduled_at, started_at, ended_at, stream_id, broadcast_started_at, broadcast_ended_at')
          .eq('mosque_id', mosqueId)
          .gte('scheduled_at', startOfDay.toISOString())
          .lte('scheduled_at', endOfDay.toISOString())
          .order('scheduled_at', { ascending: true });

        if (error) throw error;

        const rows = (data ?? []) as MuezzinScheduleEntry[];
        const rota = await fetchTodayAssignments(mosqueId, userId, startOfDay.toISOString().slice(0, 10));
        const assignedPrayers = buildAssignmentMap(rota);
        const assignedAdhanTimes = buildAssignmentTimes(rota);
        const fallbackRows = buildPrayerTimeSchedule(prayerTimes, mosqueId);
        const mergedRows = mergeAdhanSchedule(rows, fallbackRows);
        const next = deriveNextAdhan(mergedRows, assignedAdhanTimes);

        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            mosqueId,
            mosqueName,
            todayAdhans: mergedRows,
            nextAdhan: next,
            assignedPrayers,
            assignedAdhanTimes,
          });
        }
      } catch (err: any) {
        console.warn('[useMuezzinSchedule]', err?.message ?? err);
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: 'Unable to load your adhan schedule.',
            mosqueId: prev.mosqueId ?? null,
            mosqueName: prev.mosqueName ?? null,
            todayAdhans: [],
            nextAdhan: null,
            assignedPrayers: prev.assignedPrayers,
            assignedAdhanTimes: prev.assignedAdhanTimes,
          }));
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  return useMemo(() => state, [state]);
}

async function fetchTodayAssignments(mosqueId: string, userId: string, dateIso: string) {
  try {
    const { data, error } = await supabase
      .from('staff_rota')
      .select('prayer_name, adhan_time')
      .eq('mosque_id', mosqueId)
      .eq('muezzin_user_id', userId)
      .eq('date', dateIso);
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('[useMuezzinSchedule] rota fetch', (e as any)?.message ?? e);
    return [];
  }
}

function buildAssignmentMap(rows: Array<{ prayer_name?: string | null }>): Record<PrayerName, boolean> {
  const base: Record<PrayerName, boolean> = { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false };
  rows.forEach((r) => {
    const key = (r.prayer_name ?? '').toLowerCase() as PrayerName;
    if (base.hasOwnProperty(key)) base[key] = true;
  });
  return base;
}

function buildAssignmentTimes(rows: Array<{ prayer_name?: string | null; adhan_time?: string | null }>): Partial<Record<PrayerName, string | null>> {
  const times: Partial<Record<PrayerName, string | null>> = {};
  rows.forEach((r) => {
    const key = (r.prayer_name ?? '').toLowerCase() as PrayerName;
    times[key] = r.adhan_time ?? null;
  });
  return times;
}

function buildPrayerTimeSchedule(prayerTimes: NormalizedPrayerTimes | null, mosqueId: string): MuezzinScheduleEntry[] {
  if (!prayerTimes) return [];
  return PRAYER_ORDER.map((prayer) => {
    const adhan = prayerTimes[prayer]?.adhan;
    if (!adhan) return null;
    return {
      id: `prayer-times-${prayer}-${adhan.toISOString()}`,
      mosque_id: mosqueId,
      prayer,
      scheduled_at: adhan.toISOString(),
      status: 'scheduled',
    } as MuezzinScheduleEntry;
  }).filter(Boolean) as MuezzinScheduleEntry[];
}

function normalizePrayerKey(prayer?: string | null): PrayerName {
  return ((prayer ?? '') as string).toLowerCase() as PrayerName;
}

function mergeAdhanSchedule(
  primary: MuezzinScheduleEntry[],
  fallback: MuezzinScheduleEntry[]
): MuezzinScheduleEntry[] {
  const byPrayer = new Map<PrayerName, MuezzinScheduleEntry>();
  fallback.forEach((row) => {
    const key = normalizePrayerKey(row.prayer);
    byPrayer.set(key, row);
  });
  primary.forEach((row) => {
    const key = normalizePrayerKey(row.prayer);
    byPrayer.set(key, row);
  });
  return Array.from(byPrayer.values()).sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
}

function deriveNextAdhan(
  rows: MuezzinScheduleEntry[],
  assignedAdhanTimes: Partial<Record<PrayerName, string | null>>
): MuezzinScheduleEntry | null {
  if (!rows.length && !Object.keys(assignedAdhanTimes).length) return null;
  const now = new Date().getTime();
  const live = rows.find((r) => r.status === 'live');
  if (live) return live;

  const assignedUpcoming = Object.entries(assignedAdhanTimes)
    .map(([prayer, iso]) => ({ prayer: prayer as PrayerName, iso }))
    .filter((e) => !!e.iso)
    .map((e) => ({ ...e, when: new Date(e.iso as string).getTime() }))
    .filter((e) => e.when >= now)
    .sort((a, b) => a.when - b.when);

  if (assignedUpcoming[0]) {
    const existing = rows.find((r) => (r.prayer as string)?.toLowerCase() === assignedUpcoming[0].prayer);
    if (existing) return existing;
    return {
      id: `assigned-${assignedUpcoming[0].prayer}-${assignedUpcoming[0].iso}`,
      mosque_id: rows[0]?.mosque_id ?? '',
      prayer: assignedUpcoming[0].prayer,
      scheduled_at: assignedUpcoming[0].iso as string,
      status: 'scheduled',
    };
  }

  const upcoming = rows
    .map((row) => ({ row, when: new Date(row.scheduled_at).getTime() }))
    .filter((item) => item.when >= now)
    .sort((a, b) => a.when - b.when);

  return upcoming[0]?.row ?? null;
}
