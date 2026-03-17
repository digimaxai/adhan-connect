import { supabase } from '../../supabase';
import { LiveStatus, MuezzinSchedule, MuezzinSlot, PrayerName, RotaPrayerName, StaffRotaEntry } from '../../types/muezzin';
import { getDailyPrayerTimes } from '../prayerTimesUnified';

export type MuezzinPrayerSlot = MuezzinSlot;
export type MuezzinScheduleForDay = MuezzinSchedule & { date: Date };

type StaffRotaRow = {
  prayer_name?: string | null;
  muezzin_user_id?: string | null;
  staff_user_id?: string | null;
  adhan_time?: string | Date | null;
  iqama_time?: string | Date | null;
};

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const ROTA_PRAYERS: RotaPrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const WINDOW_START_MS = 3 * 60 * 1000;
const WINDOW_END_MS = 2 * 60 * 1000;

const toDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const lowerPrayerKey = (name: PrayerName) => name.toLowerCase();

const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const clampToDayStart = (value: Date) => {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const normalizeRotaPrayerName = (value?: string | null): RotaPrayerName | null => {
  if (!value) return null;
  const lower = value.toString().toLowerCase();
  return ROTA_PRAYERS.includes(lower as RotaPrayerName) ? (lower as RotaPrayerName) : null;
};

export async function getMuezzinRotaForRange(
  startDate: Date,
  endDate: Date
): Promise<{
  entries: StaffRotaEntry[];
  profileNames: Record<string, string>;
  mosqueId: string | null;
  mosqueName: string | null;
  userId: string | null;
  error: Error | null;
}> {
  const rangeStart = clampToDayStart(startDate);
  const rangeEnd = clampToDayStart(endDate);
  const [from, to] = rangeStart.getTime() <= rangeEnd.getTime() ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.warn('[getMuezzinRotaForRange] auth error', authError.message);
      return { entries: [], profileNames: {}, mosqueId: null, mosqueName: null, userId: null, error: authError };
    }
    const user = authData?.user ?? null;
    if (!user?.id) {
      const noUserErr = new Error('No user');
      return { entries: [], profileNames: {}, mosqueId: null, mosqueName: null, userId: null, error: noUserErr };
    }

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
      console.warn('[getMuezzinRotaForRange] muezzin lookup', muezzinError?.message ?? muezzinError);
      return { entries: [], profileNames: {}, mosqueId: null, mosqueName: null, userId: user.id, error: muezzinError };
    }

    if (!mosqueId) {
      return { entries: [], profileNames: {}, mosqueId: null, mosqueName: null, userId: user.id, error: null };
    }

    const startIso = formatLocalDate(from);
    const endIso = formatLocalDate(to);
    const baseSelect =
      'id, mosque_id, date, duty_date, prayer_name, prayer, muezzin_user_id, staff_user_id, role_on_duty, notes, adhan_time, iqama_time';
    let data: Array<{
      id?: string | null;
      mosque_id?: string | null;
      date?: string | null;
      duty_date?: string | null;
      prayer_name?: string | null;
      prayer?: string | null;
      muezzin_user_id?: string | null;
      staff_user_id?: string | null;
      role_on_duty?: string | null;
      notes?: string | null;
      adhan_time?: string | Date | null;
      iqama_time?: string | Date | null;
    }> | null = null;
    let error: any = null;
    ({ data, error } = await supabase
      .from('staff_rota')
      .select(baseSelect)
      .eq('mosque_id', mosqueId)
      .gte('date', startIso)
      .lte('date', endIso)
      .order('date', { ascending: true }));

    if (error && (error as any)?.code === '42703') {
      const fallback = await supabase
        .from('staff_rota')
        .select('id, mosque_id, date, duty_date, prayer_name, prayer, muezzin_user_id, staff_user_id, notes')
        .eq('mosque_id', mosqueId)
        .gte('date', startIso)
        .lte('date', endIso)
        .order('date', { ascending: true });
      data = fallback.data ?? [];
      error = fallback.error ?? null;
    }

    if (error && (error as any)?.code !== 'PGRST116') throw error;
    const entries: StaffRotaEntry[] = (data ?? [])
      .map((row: any) => {
        const prayerName = normalizeRotaPrayerName(row?.prayer_name ?? row?.prayer ?? null);
        const date = row?.date ?? row?.duty_date ?? null;
        if (!prayerName || !date) return null;
        const resolvedMosqueId = row?.mosque_id ?? mosqueId;
        return {
          id: row?.id ?? `${resolvedMosqueId ?? 'mosque'}-${date}-${prayerName}`,
          mosque_id: resolvedMosqueId,
          date,
          duty_date: row?.duty_date ?? null,
          prayer_name: prayerName,
          prayer: row?.prayer ?? null,
          muezzin_user_id: row?.muezzin_user_id ?? row?.staff_user_id ?? null,
          staff_user_id: row?.staff_user_id ?? null,
          role_on_duty: row?.role_on_duty ?? null,
          adhan_time: row?.adhan_time ?? null,
          iqama_time: row?.iqama_time ?? null,
          notes: row?.notes ?? null,
        } as StaffRotaEntry;
      })
      .filter(Boolean) as StaffRotaEntry[];

    const userIds = Array.from(
      new Set(
        entries
          .map((r) => (r.muezzin_user_id ?? r.staff_user_id) as string | null)
          .filter(Boolean) as string[]
      )
    );
    const profileNames: Record<string, string> = {};
    if (userIds.length) {
      const { data: profiles, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, full_name, display_name, email')
        .in('id', userIds);
      if (!profilesErr && profiles) {
        profiles.forEach((p: any) => {
          const display = p?.display_name || p?.full_name || p?.email;
          if (display) profileNames[p.id] = display;
        });
      } else if (profilesErr) {
        console.warn('[getMuezzinRotaForRange] profiles error', profilesErr.message);
      }
    }

    let mosqueName: string | null = null;
    try {
      const { data: mosqueRow, error: mosqueErr } = await supabase
        .from('mosques')
        .select('name')
        .eq('id', mosqueId)
        .maybeSingle<{ name: string | null }>();
      if (!mosqueErr) mosqueName = mosqueRow?.name ?? null;
    } catch (mosqueErr: any) {
      console.warn('[getMuezzinRotaForRange] mosque lookup', mosqueErr?.message ?? mosqueErr);
    }

    return { entries, profileNames, mosqueId, mosqueName, userId: user.id, error: null };
  } catch (err: any) {
    console.warn('[getMuezzinRotaForRange] error', err?.message ?? err);
    return { entries: [], profileNames: {}, mosqueId: null, mosqueName: null, userId: null, error: err };
  }
}

function getSlotStatus(
  now: Date,
  slot: { adhanTime: Date | null; liveWindowStart: Date | null; liveWindowEnd: Date | null }
): LiveStatus {
  const { adhanTime, liveWindowStart, liveWindowEnd } = slot;
  if (!adhanTime) return 'scheduled';

  if (liveWindowStart && now < liveWindowStart) return 'scheduled';
  if (liveWindowStart && liveWindowEnd && now >= liveWindowStart && now <= liveWindowEnd) {
    // Window is open; actual "live" is still driven by stream state.
    return 'ready';
  }
  if (liveWindowEnd && now > liveWindowEnd) return 'completed';
  if (now < adhanTime) return 'scheduled';
  if (now >= adhanTime) return 'ready';
  return 'scheduled';
}

function pickNextAssignedSlot(slots: MuezzinPrayerSlot[], now: Date) {
  const nowMs = now.getTime();
  const actionable = slots
    .filter((slot) => slot.isAssignedToMe)
    .filter((slot) => (slot.liveWindowEnd?.getTime() ?? slot.adhanTime?.getTime() ?? Number.MAX_SAFE_INTEGER) >= nowMs)
    .sort((a, b) => (a.adhanTime?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.adhanTime?.getTime() ?? Number.MAX_SAFE_INTEGER));
  return actionable[0] ?? null;
}

async function buildSlotsForDate(
  mosqueId: string,
  mosqueName: string | null,
  userId: string,
  date: Date
): Promise<MuezzinPrayerSlot[]> {
  const dateIso = formatLocalDate(date);
  const prayerTimesPromise = getDailyPrayerTimes(mosqueId, date);
  const rotaPromise = (async () => {
    const res = await supabase
      .from('staff_rota')
      .select('prayer_name,muezzin_user_id,staff_user_id,adhan_time,iqama_time')
      .eq('mosque_id', mosqueId)
      .eq('date', dateIso);
    if (res.error && res.error.code === '42703') {
      return supabase
        .from('staff_rota')
        .select('prayer_name,muezzin_user_id,staff_user_id')
        .eq('mosque_id', mosqueId)
        .eq('date', dateIso);
    }
    return res;
  })();

  const [prayerTimes, rotaRes] = await Promise.all([prayerTimesPromise, rotaPromise]);
  const rotaRows = (rotaRes.data ?? []) as StaffRotaRow[];
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
      console.warn('[buildSlotsForDate] profiles error', profilesErr.message);
    }
  }

  const now = new Date();
  return PRAYERS.map((prayerName) => {
    const lowerKey = lowerPrayerKey(prayerName);
    const rota = rotaRows.find((r) => (r.prayer_name ?? '').toLowerCase() === lowerKey);
    const assignedMuezzinUserId = (rota?.muezzin_user_id ?? rota?.staff_user_id ?? null) as string | null;
    const slotTimes = (prayerTimes as any)?.[lowerKey] ?? null;
    const adhanTime = slotTimes?.adhan ?? toDate(rota?.adhan_time);
    const iqamaTime = slotTimes?.iqama ?? toDate(rota?.iqama_time);
    const liveWindowStart = slotTimes?.liveWindowStart
      ? toDate(slotTimes.liveWindowStart)
      : adhanTime
      ? new Date(adhanTime.getTime() - WINDOW_START_MS)
      : null;
    const liveWindowEnd = slotTimes?.liveWindowEnd
      ? toDate(slotTimes.liveWindowEnd)
      : adhanTime
      ? new Date(adhanTime.getTime() + WINDOW_END_MS)
      : null;

    return {
      id: `${mosqueId}-${dateIso}-${lowerKey}`,
      mosqueId,
      mosqueName: mosqueName ?? 'Mosque',
      prayerName,
      adhanTime,
      liveWindowStart,
      liveWindowEnd,
      iqamaTime,
      status: getSlotStatus(now, { adhanTime, liveWindowStart, liveWindowEnd }),
      assignedMuezzinUserId,
      assignedMuezzinName: assignedMuezzinUserId ? nameMap[assignedMuezzinUserId] ?? null : null,
      isAssignedToMe: assignedMuezzinUserId === userId,
    };
  });
}

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

    const resolvedMosqueId = mosqueId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const mosquePromise = supabase.from('mosques').select('name').eq('id', mosqueId).maybeSingle<{ name: string | null }>();
    const [mosqueRes] = await Promise.all([mosquePromise]);
    const mosqueName = mosqueRes.data?.name ?? null;
    const slots = await buildSlotsForDate(resolvedMosqueId, mosqueName, user.id, today);
    let nextAssignedSlot = pickNextAssignedSlot(slots, now);
    if (!nextAssignedSlot) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowSlots = await buildSlotsForDate(resolvedMosqueId, mosqueName, user.id, tomorrow);
      nextAssignedSlot = pickNextAssignedSlot(tomorrowSlots, now);
    }

    console.log('[getMuezzinScheduleForToday] user', user.id, 'mosque', mosqueId, 'slots', slots);

    return {
      schedule: {
        mosqueId: resolvedMosqueId,
        mosqueName,
        date: today,
        nextAssignedSlot,
        slots,
      },
      error: null,
    };
  } catch (err: any) {
    console.warn('[getMuezzinScheduleForToday] error', err?.message ?? err);
    return { schedule: null, error: err };
  }
}
