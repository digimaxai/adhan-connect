import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { AdhanBroadcast, PrayerName } from '../../../lib/adhans';

type StreamRow = {
  id: string;
  mosque_id: string;
  url?: string | null;
  stream_url?: string | null;
  is_live?: boolean | null;
  status?: string | null;
  last_health_check?: string | null;
};

type LiveState = {
  isLive: boolean;
  currentAdhan: (AdhanBroadcast & { prayer?: PrayerName }) | null;
  streamUrl: string | null;
};

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
      const [{ data: streamRows }, { data: adhanData }] = await Promise.all([
        supabase
          .from('streams')
          .select('id, mosque_id, url, stream_url, is_live, status, last_health_check')
          .eq('mosque_id', mosqueId)
          .order('started_at', { ascending: false, nullsFirst: false })
          .limit(1),
        supabase
          .from('adhans')
          .select('*')
          .eq('mosque_id', mosqueId)
          .gte('scheduled_at', `${today}T00:00:00Z`)
          .order('scheduled_at', { ascending: false })
          .limit(1)
          .maybeSingle<AdhanBroadcast>(),
      ]);

      if (!mounted) return;
      const streamData = ((streamRows ?? []) as StreamRow[])[0] ?? null;
      const isLive = !!(streamData?.is_live || adhanData?.status === 'live');
      setState({
        isLive,
        currentAdhan: (adhanData as any) ?? null,
        streamUrl: streamData?.stream_url ?? streamData?.url ?? null,
      });
    };

    fetchLive();

    const channel = supabase
      .channel(`live-listen-${mosqueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'streams', filter: `mosque_id=eq.${mosqueId}` },
        fetchLive
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'adhans', filter: `mosque_id=eq.${mosqueId}` },
        fetchLive
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [mosqueId]);

  return state;
}
