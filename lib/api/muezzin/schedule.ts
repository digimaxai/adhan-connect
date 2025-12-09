import { supabase } from '../../supabase';
import { getDailyPrayerTimes } from '../prayerTimesUnified';

export type MuezzinPrayerSlot = {
  prayerName: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
  adhanTime: Date | null;
  iqamaTime: Date | null;
  assignedMuezzinUserId: string | null;
  assignedMuezzinName: string | null;
  isAssignedToMe: boolean;
};

export type MuezzinScheduleForDay = {
  mosqueId: string | null;
  mosqueName: string | null;
  date: Date;
  slots: MuezzinPrayerSlot[];
};

type StaffRotaRow = {
  prayer_name?: string | null;
  muezzin_user_id?: string | null;
  adhan_time?: string | Date | null;
  iqama_time?: string | Date | null;
};

const PRAYERS: MuezzinPrayerSlot['prayerName'][] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const toDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export async function getMuezzinScheduleForToday(): Promise<{
  schedule: MuezzinScheduleForDay | null;
  error: Error | null;
}> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.warn('[getMuezzinScheduleForToday] auth error', authError.message);
      return { schedule: null, error: authError };
    }
    const user = authData?.user ?? null;
    if (!user) return { schedule: null, error: new Error('No user') };

    let mosqueId: string | null = null;
    let muezzinError: Error | null = null;
    try {
      const { data, error } = await supabase
        .from('muezzins')
        .select('mosque_id')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (error && (error as any)?.code === '42703') {
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from('muezzins')
          .select('mosque_id')
          .eq('user_id', user.id);
        if (fallbackErr) throw fallbackErr;
        mosqueId = (fallbackData ?? [])[0]?.mosque_id ?? null;
      } else if (error) {
        throw error;
      } else {
        mosqueId = (data ?? [])[0]?.mosque_id ?? null;
      }
    } catch (err: any) {
      muezzinError = err;
    }

    if (muezzinError) {
      console.warn('[getMuezzinScheduleForToday] muezzin lookup', muezzinError?.message ?? muezzinError);
      return { schedule: null, error: muezzinError };
    }
    if (!mosqueId) {
      return { schedule: null, error: null };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateIso = formatLocalDate(today);

    // Fetch prayer times + rota with a fallback if adhan/iqama columns are missing.
    const prayerTimesPromise = getDailyPrayerTimes(mosqueId, today);
    const rotaPromise = (async () => {
      let rotaQuery = supabase
        .from('staff_rota')
        .select('prayer_name,muezzin_user_id,staff_user_id,adhan_time,iqama_time')
        .eq('mosque_id', mosqueId)
        .eq('date', dateIso);
      const res = await rotaQuery;
      if (res.error && res.error.code === '42703') {
        // Fallback without time columns for older schemas.
        const fallback = await supabase
          .from('staff_rota')
          .select('prayer_name,muezzin_user_id,staff_user_id')
          .eq('mosque_id', mosqueId)
          .eq('date', dateIso);
        return fallback;
      }
      return res;
    })();
    const mosquePromise = supabase.from('mosques').select('name').eq('id', mosqueId).maybeSingle<{ name: string | null }>();

    const [prayerTimes, rotaRes, mosqueRes] = await Promise.all([prayerTimesPromise, rotaPromise, mosquePromise]);

    const rotaRows = (rotaRes.data ?? []) as StaffRotaRow[];
    if (rotaRes.error) {
      console.warn('[getMuezzinScheduleForToday] rota error', rotaRes.error.message);
    }

    const userIds = Array.from(
      new Set(
        rotaRows
          .map((r) => (r.muezzin_user_id ?? r.staff_user_id) as string | null)
          .filter(Boolean) as string[]
      )
    );
    const nameMap: Record<string, string> = {};
    if (userIds.length) {
      const { data: profiles, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, full_name, display_name')
        .in('id', userIds);
      if (!profilesErr && profiles) {
        profiles.forEach((p: any) => {
          const display = p?.display_name || p?.full_name;
          if (display) nameMap[p.id] = display;
        });
      } else if (profilesErr) {
        console.warn('[getMuezzinScheduleForToday] profiles error', profilesErr.message);
      }
    }

    const slots: MuezzinPrayerSlot[] = PRAYERS.map((prayerName) => {
      const rota = rotaRows.find((r) => (r.prayer_name ?? '').toLowerCase() === prayerName);
      const assignedMuezzinUserId = (rota?.muezzin_user_id ?? rota?.staff_user_id ?? null) as string | null;
      const slotTimes = prayerTimes?.[prayerName] ?? null;
      const adhanTime = slotTimes?.adhan ?? toDate(rota?.adhan_time);
      const iqamaTime = slotTimes?.iqama ?? toDate(rota?.iqama_time);

      return {
        prayerName,
        adhanTime,
        iqamaTime,
        assignedMuezzinUserId,
        assignedMuezzinName: assignedMuezzinUserId ? nameMap[assignedMuezzinUserId] ?? null : null,
        isAssignedToMe: assignedMuezzinUserId === user.id,
      };
    });

    const mosqueName = mosqueRes.data?.name ?? null;
    console.log('[getMuezzinScheduleForToday] user', user.id, 'mosque', mosqueId, 'slots', slots);

    return {
      schedule: {
        mosqueId,
        mosqueName,
        date: today,
        slots,
      },
      error: null,
    };
  } catch (err: any) {
    console.warn('[getMuezzinScheduleForToday] error', err?.message ?? err);
    return { schedule: null, error: err };
  }
}
