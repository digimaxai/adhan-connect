import { useEffect, useState } from 'react';
import { PrayerName } from '../../../lib/adhans';
import { supabase } from '../../../lib/supabase';

type PrayerTimes = Partial<Record<PrayerName, string | null>>;

type State = {
  loading: boolean;
  error: string | null;
  times: PrayerTimes | null;
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

      const todayStr = new Date().toISOString().slice(0, 10);

      const fetchWithDate = async (op: 'eq' | 'gte' | 'lte', asc: boolean) => {
        const query = supabase
          .from('mosque_prayer_times')
          .select('prayer_date,fajr,dhuhr,asr,maghrib,isha')
          .eq('mosque_id', mosqueId)
          [op]('prayer_date', todayStr)
          .order('prayer_date', { ascending: asc })
          .limit(1)
          .maybeSingle<PrayerTimes & { prayer_date?: string }>();
        return query;
      };

      try {
        const { data: todayData } = await fetchWithDate('eq', true);
        if (mounted && todayData) {
          setState({ loading: false, error: null, times: todayData });
          return;
        }

        const { data: nextData, error: nextErr } = await fetchWithDate('gte', true);
        if (nextErr) throw nextErr;
        if (mounted && nextData) {
          setState({ loading: false, error: null, times: nextData });
          return;
        }

        const { data: prevData, error: prevErr } = await fetchWithDate('lte', false);
        if (prevErr) throw prevErr;
        if (mounted) {
          setState({ loading: false, error: null, times: prevData ?? null });
        }
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
