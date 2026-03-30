import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { AdhanBroadcast, PrayerName } from '../../../lib/adhans';
import { isFreshLiveAdhan, isFreshLiveStream } from '../../../lib/liveStreamFreshness';

type StreamRow = {
  id: string;
  mosque_id: string;
  url?: string | null;
  stream_url?: string | null;
  is_live?: boolean | null;
  status?: string | null;
  started_at?: string | null;
  last_health_check?: string | null;
};

type AdhanRow = {
  id?: string;
  mosque_id?: string | null;
  prayer?: PrayerName | string | null;
  scheduled_at?: string | null;
  scheduled_for?: string | null;
  status?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
};

type LiveState = {
  isLive: boolean;
  currentAdhan: (AdhanBroadcast & { prayer?: PrayerName }) | null;
  streamUrl: string | null;
};

const LIVE_REFRESH_MS = 15000;

export function useLiveStreamForMosque(mosqueId?: string | null): LiveState {
  const [state, setState] = useState<LiveState>({ isLive: false, currentAdhan: null, streamUrl: null });

  useEffect(() => {
    if (!mosqueId) {
      setState({ isLive: false, currentAdhan: null, streamUrl: null });
      return;
    }

    let mounted = true;

    const fetchLive = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [streamRes, liveAdhanRes, latestAdhanRes] = await Promise.all([
        supabase
          .from('streams')
          .select('id, mosque_id, url, stream_url, is_live, status, started_at, last_health_check')
          .eq('mosque_id', mosqueId)
          .order('started_at', { ascending: false, nullsFirst: false })
          .limit(1),
        supabase
          .from('adhans')
          .select('*')
          .eq('mosque_id', mosqueId)
          .eq('status', 'live')
          .order('scheduled_at', { ascending: false })
          .limit(1)
          .maybeSingle<AdhanRow>(),
        supabase
          .from('adhans')
          .select('*')
          .eq('mosque_id', mosqueId)
          .gte('scheduled_at', `${today}T00:00:00Z`)
          .order('scheduled_at', { ascending: false })
          .limit(1)
          .maybeSingle<AdhanRow>(),
      ]);

      if (!mounted) return;

      if (streamRes.error) {
        console.warn('[useLiveStreamForMosque] stream lookup failed', streamRes.error.message);
      }
      if (liveAdhanRes.error && liveAdhanRes.error.code !== 'PGRST116') {
        console.warn('[useLiveStreamForMosque] live adhan lookup failed', liveAdhanRes.error.message);
      }
      if (latestAdhanRes.error && latestAdhanRes.error.code !== 'PGRST116') {
        console.warn('[useLiveStreamForMosque] recent adhan lookup failed', latestAdhanRes.error.message);
      }

      const streamData = ((streamRes.data ?? []) as StreamRow[])[0] ?? null;
      const liveAdhanData = (liveAdhanRes.data as AdhanRow | null) ?? null;
      const latestAdhanData = (latestAdhanRes.data as AdhanRow | null) ?? null;
      const currentAdhan = isFreshLiveAdhan(liveAdhanData) ? liveAdhanData : latestAdhanData;
      const isLive = isFreshLiveStream(streamData) || isFreshLiveAdhan(liveAdhanData);

      setState({
        isLive,
        currentAdhan: (currentAdhan as any) ?? null,
        streamUrl: streamData?.stream_url ?? streamData?.url ?? null,
      });
    };

    void fetchLive();

    const channel = supabase
      .channel(`live-listen-${mosqueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'streams', filter: `mosque_id=eq.${mosqueId}` },
        () => {
          void fetchLive();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'adhans', filter: `mosque_id=eq.${mosqueId}` },
        () => {
          void fetchLive();
        }
      )
      .subscribe();
    const pollId = setInterval(() => {
      void fetchLive();
    }, LIVE_REFRESH_MS);

    return () => {
      mounted = false;
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [mosqueId]);

  return state;
}
