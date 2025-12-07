import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { PrayerName } from '../adhans';
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

export function useLiveBroadcastEngine(mosqueId?: string | null, nextAdhan?: MuezzinScheduleEntry | null): LiveBroadcastEngineState {
  const [stream, setStream] = useState<StreamRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
      return;
    }

    const fetchStream = async () => {
      try {
        const { data, error } = await supabase
          .from('streams')
          .select('id, mosque_id, is_live, current_prayer, started_at, ended_at, stream_url, status')
          .eq('mosque_id', mosqueId)
          .maybeSingle<StreamRow>();
        if (error) throw error;
        if (!cancelled) setStream(data ?? null);
      } catch (err: any) {
        console.warn('[useLiveBroadcastEngine] fetchStream', err?.message ?? err);
        if (!cancelled) setErrorMessage('Connection error. Retrying…');
      }
    };

    fetchStream();

    const channel = supabase
      .channel(`live-engine-${mosqueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams', filter: `mosque_id=eq.${mosqueId}` }, (payload) => {
        const row = (payload.new as StreamRow) ?? null;
        setStream(row);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [mosqueId]);

  const derived = useMemo(() => {
    const isLive = !!(stream?.is_live);
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
    const startedAt = new Date().toISOString();
    const prayer = (nextAdhan.prayer ?? nextAdhan.prayer_name ?? 'adhan') as PrayerName | string;

    try {
      // Ensure a row exists; update if found, insert if missing (avoid upsert without unique constraint).
      const { data: existing, error: fetchErr } = await supabase
        .from('streams')
        .select('id')
        .eq('mosque_id', mosqueId)
        .maybeSingle<{ id: string }>();
      if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;

      let streamRow: StreamRow | null = null;
      if (existing?.id) {
        const { data, error } = await supabase
          .from('streams')
          .update({
            is_live: true,
            current_prayer: prayer,
            started_at: startedAt,
            ended_at: null,
            status: 'live',
          } as any)
          .eq('id', existing.id)
          .select('id, mosque_id, is_live, current_prayer, started_at, ended_at, stream_url, status')
          .maybeSingle<StreamRow>();
        if (error) throw error;
        streamRow = data ?? null;
      } else {
        const { data, error } = await supabase
          .from('streams')
          .insert({
            mosque_id: mosqueId,
            is_live: true,
            current_prayer: prayer,
            started_at: startedAt,
            ended_at: null,
            status: 'live',
          } as any)
          .select('id, mosque_id, is_live, current_prayer, started_at, ended_at, stream_url, status')
          .maybeSingle<StreamRow>();
        if (error) throw error;
        streamRow = data ?? null;
      }

      if (nextAdhan.id) {
        const { error: adhanErr } = await supabase
          .from('adhans')
          .update({ status: 'live', started_at: startedAt, stream_id: streamRow?.id ?? null })
          .eq('id', nextAdhan.id);
        if (adhanErr) throw adhanErr;
      }

      setStream(streamRow ?? null);
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
    const endedAt = new Date().toISOString();
    try {
      const { data: streamRow, error: streamErr } = await supabase
        .from('streams')
        .update({ is_live: false, ended_at: endedAt, status: 'active' })
        .eq('mosque_id', mosqueId)
        .select('id, mosque_id, is_live, current_prayer, started_at, ended_at, stream_url, status')
        .maybeSingle<StreamRow>();
      if (streamErr && streamErr.code !== 'PGRST116') throw streamErr;

      if (nextAdhan?.id) {
        const { error: adhanErr } = await supabase
          .from('adhans')
          .update({ status: 'completed', ended_at: endedAt })
          .eq('id', nextAdhan.id);
        if (adhanErr) throw adhanErr;
      }

      setStream(streamRow ?? null);
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
