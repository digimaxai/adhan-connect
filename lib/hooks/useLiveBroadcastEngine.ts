import { useEffect, useMemo, useRef, useState } from 'react';
import { PrayerName } from '../adhans';
import {
  fetchMuezzinLiveBroadcastState,
  type LiveBroadcastStreamRow,
  updateMuezzinLiveBroadcast,
} from '../api/muezzin/liveBroadcast';
import { MuezzinScheduleEntry } from './useMuezzinSchedule';

type LiveStatus = 'TOO_EARLY' | 'READY' | 'LIVE' | 'LATE' | 'NO_ADHAN';

type StreamRow = {
  id?: string;
  mosque_id: string;
  is_live?: boolean | null;
  current_prayer?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  stream_url?: string | null;
  url?: string | null;
  status?: string | null;
};

export type LiveBroadcastEngineState = {
  status: LiveStatus;
  isLive: boolean;
  isEarly: boolean;
  isLate: boolean;
  canStart: boolean;
  mosqueId: string | null;
  stream: StreamRow | null;
  loading: boolean;
  errorMessage: string | null;
  timeUntilSeconds: number | null;
  startBroadcast: () => Promise<void>;
  endBroadcast: () => Promise<void>;
};

const WINDOW_BEFORE_MS = 3 * 60 * 1000;
const WINDOW_AFTER_MS = 2 * 60 * 1000;

function normalizeStreamRow(stream: LiveBroadcastStreamRow | null): StreamRow | null {
  return stream ? { ...stream } : null;
}

export function useLiveBroadcastEngine(mosqueId?: string | null, nextAdhan?: MuezzinScheduleEntry | null): LiveBroadcastEngineState {
  const [stream, setStream] = useState<StreamRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scheduledAt = nextAdhan?.scheduled_at ? new Date(nextAdhan.scheduled_at) : null;
  const windowStart = scheduledAt ? scheduledAt.getTime() - WINDOW_BEFORE_MS : null;
  const windowEnd = scheduledAt ? scheduledAt.getTime() + WINDOW_AFTER_MS : null;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!mosqueId) {
      setStream(null);
      setErrorMessage(null);
      return;
    }

    const fetchStream = async (showRetryBanner = true) => {
      try {
        const data = await fetchMuezzinLiveBroadcastState(mosqueId);
        if (!cancelled) {
          setStream(normalizeStreamRow(data));
          setErrorMessage(null);
        }
      } catch (err: any) {
        console.warn('[useLiveBroadcastEngine] fetchStream', err?.message ?? err);
        if (!cancelled && showRetryBanner) {
          setErrorMessage('Connection error. Retrying...');
        }
        if (!cancelled) {
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            void fetchStream(false);
          }, 3000);
        }
      }
    };

    void fetchStream();
    pollTimerRef.current = setInterval(() => {
      void fetchStream(false);
    }, 15000);

    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [mosqueId]);

  const derived = useMemo(() => {
    const isLive = !!stream?.is_live;
    if (!nextAdhan && !stream?.is_live) {
      return { status: 'NO_ADHAN' as LiveStatus, isLive: false, isEarly: false, isLate: false, canStart: false, timeUntilSeconds: null };
    }
    if (isLive) {
      return { status: 'LIVE' as LiveStatus, isLive: true, isEarly: false, isLate: false, canStart: false, timeUntilSeconds: null };
    }
    if (!scheduledAt || windowStart === null || windowEnd === null) {
      return { status: 'NO_ADHAN' as LiveStatus, isLive, isEarly: false, isLate: false, canStart: false, timeUntilSeconds: null };
    }
    const nowMs = now;
    const isEarly = nowMs < windowStart;
    const within = nowMs >= windowStart && nowMs <= windowEnd;
    const isLate = nowMs > windowEnd;
    const status: LiveStatus = isEarly ? 'TOO_EARLY' : within ? 'READY' : 'LATE';
    const timeUntilSeconds = Math.max(0, Math.floor((scheduledAt.getTime() - nowMs) / 1000));
    return { status, isLive, isEarly, isLate, canStart: within && !isLive, timeUntilSeconds };
  }, [stream?.is_live, nextAdhan, scheduledAt, windowStart, windowEnd, now]);

  const startBroadcast = async () => {
    if (!mosqueId) {
      setErrorMessage('Missing mosque information.');
      return;
    }
    if (!nextAdhan) {
      setErrorMessage('No upcoming adhan found.');
      return;
    }
    if (!derived.canStart) {
      setErrorMessage('You can start within the live window.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    const prayer = (nextAdhan.prayer ?? nextAdhan.prayer_name ?? 'adhan') as PrayerName | string;

    try {
      const streamRow = await updateMuezzinLiveBroadcast({
        action: 'start',
        mosqueId,
        prayer: prayer.toString().toLowerCase(),
        scheduledAt: nextAdhan.scheduled_at ?? null,
        adhanId: nextAdhan.id ?? null,
      });
      setStream(normalizeStreamRow(streamRow));
      setErrorMessage(null);
    } catch (err: any) {
      const msg = err?.message ?? err;
      console.warn('[useLiveBroadcastEngine] start', msg);
      setErrorMessage('Unable to update live status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const endBroadcast = async () => {
    if (!mosqueId) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const streamRow = await updateMuezzinLiveBroadcast({
        action: 'end',
        mosqueId,
        adhanId: nextAdhan?.id ?? null,
      });
      setStream(normalizeStreamRow(streamRow));
      setErrorMessage(null);
    } catch (err: any) {
      console.warn('[useLiveBroadcastEngine] end', err?.message ?? err);
      setErrorMessage('Unable to update live status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    status: derived.status,
    isLive: derived.isLive,
    isEarly: derived.isEarly,
    isLate: derived.isLate,
    canStart: derived.canStart,
    mosqueId: mosqueId ?? null,
    stream,
    loading,
    errorMessage,
    timeUntilSeconds: derived.timeUntilSeconds,
    startBroadcast,
    endBroadcast,
  };
}
