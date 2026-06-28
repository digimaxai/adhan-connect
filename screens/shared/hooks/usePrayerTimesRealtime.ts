import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../../../lib/supabase';

type Options = {
  channelName?: string;
  enabled?: boolean;
  includeLegacy?: boolean;
  reconcileMs?: number;
};

const DEFAULT_RECONCILE_MS = 60000;

function safeChannelPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function usePrayerTimesRealtime(
  mosqueId: string | null | undefined,
  onRefresh: () => void | Promise<void>,
  options: Options = {}
) {
  const onRefreshRef = useRef(onRefresh);
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));
  const {
    channelName = 'prayer-times',
    enabled = true,
    includeLegacy = true,
    reconcileMs = DEFAULT_RECONCILE_MS,
  } = options;

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || !mosqueId) return;

    let cancelled = false;
    const refresh = () => {
      if (!cancelled) void onRefreshRef.current();
    };

    const channel = supabase
      .channel(`${channelName}-${safeChannelPart(mosqueId)}-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prayer_times', filter: `mosque_id=eq.${mosqueId}` },
        refresh
      );

    if (includeLegacy) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mosque_prayer_times', filter: `mosque_id=eq.${mosqueId}` },
        refresh
      );
    }

    channel.subscribe();

    const pollId = reconcileMs > 0 ? setInterval(refresh, reconcileMs) : null;
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      appStateSub.remove();
      supabase.removeChannel(channel);
    };
  }, [channelName, enabled, includeLegacy, mosqueId, reconcileMs]);
}
