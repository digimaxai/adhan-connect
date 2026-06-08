import { supabase } from '../../supabase';
import { LiveStatus, MuezzinSchedule, MuezzinSlot, PrayerName, RotaPrayerName, StaffRotaEntry } from '../../types/muezzin';
import { getDailyPrayerTimes } from '../prayerTimesUnified';
import { getMuezzinPrimaryMosque } from '../../liveAdhan';
import { fetchServerApi, resolveApiUrls, supportsServerApi } from '../apiBaseUrl';

function logMuezzinApiTrace(stage: string, details?: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log('[muezzin.schedule.api]', stage, details ?? {});
}

export type MuezzinPrayerSlot = MuezzinSlot;
export type MuezzinScheduleForDay = MuezzinSchedule & { date: Date };

type StaffRotaRow = {
  date?: string | null;
  duty_date?: string | null;
  prayer_name?: string | null;
  prayer?: string | null;
  muezzin_user_id?: string | null;
  staff_user_id?: string | null;
  adhan_time?: string | Date | null;
  iqama_time?: string | Date | null;
};

type PrayerTimesRow = {
  date: string;
  fajr_adhan_time?: string | null;
  fajr_iqama_time?: string | null;
  dhuhr_adhan_time?: string | null;
  dhuhr_iqama_time?: string | null;
  asr_adhan_time?: string | null;
  asr_iqama_time?: string | null;
  maghrib_adhan_time?: string | null;
  maghrib_iqama_time?: string | null;
  isha_adhan_time?: string | null;
  isha_iqama_time?: string | null;
};

type RotaWorkspacePayload = {
  entries?: StaffRotaEntry[] | null;
  profileNames?: Record<string, string> | null;
  mosqueId?: string | null;
  mosqueName?: string | null;
  userId?: string | null;
  defaultMuezzinUserId?: string | null;
  error?: string | null;
};

function isRotaWorkspacePayload(value: unknown): value is RotaWorkspacePayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    'entries' in payload ||
    'profileNames' in payload ||
    'mosqueId' in payload ||
    'mosqueName' in payload ||
    'userId' in payload ||
    'defaultMuezzinUserId' in payload ||
    'error' in payload
  );
}

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const ROTA_PRAYERS: RotaPrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const WINDOW_START_MS = 3 * 60 * 1000;
const WINDOW_END_MS = 2 * 60 * 1000;
const FUTURE_LOOKAHEAD_DAYS = 14;

type CoverOverride = { volunteerUserId: string; status: 'provisional_cover' | 'approved' };

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

function getPrayerTimeValue(row: PrayerTimesRow | undefined, prayerName: RotaPrayerName, kind: 'adhan' | 'iqama') {
  if (!row) return null;
  if (prayerName === 'fajr') return kind === 'adhan' ? row.fajr_adhan_time ?? null : row.fajr_iqama_time ?? null;
  if (prayerName === 'dhuhr') return kind === 'adhan' ? row.dhuhr_adhan_time ?? null : row.dhuhr_iqama_time ?? null;
  if (prayerName === 'asr') return kind === 'adhan' ? row.asr_adhan_time ?? null : row.asr_iqama_time ?? null;
  if (prayerName === 'maghrib') return kind === 'adhan' ? row.maghrib_adhan_time ?? null : row.maghrib_iqama_time ?? null;
  if (prayerName === 'isha') return kind === 'adhan' ? row.isha_adhan_time ?? null : row.isha_iqama_time ?? null;
  return null;
}

async function loadRotaWorkspaceForRange(startDate: Date, endDate: Date): Promise<RotaWorkspacePayload | null> {
  if (!supportsServerApi()) return null;

  const endpoints = resolveApiUrls('/api/muezzin/rota-workspace');
  if (!endpoints.length) return null;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    return null;
  }

  const startIso = formatLocalDate(startDate);
  const endIso = formatLocalDate(endDate);
  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('start', startIso);
      url.searchParams.set('end', endIso);

      const response = await fetchServerApi(url.toString(), {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        console.warn(
          '[loadRotaWorkspaceForRange] server response',
          {
            endpoint,
            status: response.status,
            statusText: response.statusText,
            error: payload && typeof payload === 'object' && 'error' in payload ? (payload as any).error : null,
          }
        );
        continue;
      }

      if (!contentType.includes('application/json') || !isRotaWorkspacePayload(payload)) {
        console.warn('[loadRotaWorkspaceForRange] unexpected payload', {
          endpoint,
          status: response.status,
          contentType,
        });
        continue;
      }

      return payload;
    } catch (error: any) {
      console.warn('[loadRotaWorkspaceForRange] error', error?.message ?? error);
    }
  }

  return null;
}

async function loadRotaWorkspaceForDate(date: Date): Promise<RotaWorkspacePayload | null> {
  return loadRotaWorkspaceForRange(date, date);
}

async function fetchCoverOverrideMap(
  mosqueId: string,
  startIso: string,
  endIso: string
): Promise<Record<string, CoverOverride>> {
  const { data, error } = await supabase
    .from('muezzin_cover_requests')
    .select('date, prayer_name, volunteer_user_id, status')
    .eq('mosque_id', mosqueId)
    .gte('date', startIso)
    .lte('date', endIso)
    .in('status', ['provisional_cover', 'approved']);

  if (error && error.code !== 'PGRST116') {
    console.warn('[fetchCoverOverrideMap]', error.message);
    return {};
  }

  const overrides: Record<string, CoverOverride> = {};
  ((data ?? []) as {
    date?: string | null;
    prayer_name?: string | null;
    volunteer_user_id?: string | null;
    status?: 'provisional_cover' | 'approved' | null;
  }[]).forEach((row) => {
    const prayerName = normalizeRotaPrayerName(row.prayer_name);
    if (!row.date || !prayerName || !row.volunteer_user_id) return;
    const key = `${row.date}:${prayerName}`;
    overrides[key] = {
      volunteerUserId: row.volunteer_user_id,
      status: row.status === 'approved' ? 'approved' : 'provisional_cover',
    };
  });
  return overrides;
}

async function fetchProfileNameMap(userIds: string[]) {
  if (!userIds.length) return {} as Record<string, string>;
  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, email')
    .in('id', Array.from(new Set(userIds)));

  if (profilesErr && profilesErr.code !== 'PGRST116') {
    console.warn('[fetchProfileNameMap]', profilesErr.message);
    return {};
  }

  const profileNames: Record<string, string> = {};
  (profiles ?? []).forEach((p: any) => {
    const display = p?.display_name || p?.full_name || p?.email;
    if (display) profileNames[p.id] = display;
  });
  return profileNames;
}

async function fetchDefaultMuezzinUserId(mosqueId: string) {
  const { data: mosqueRow, error: mosqueError } = await supabase
    .from('mosques')
    .select('default_muezzin_user_id')
    .eq('id', mosqueId)
    .maybeSingle<{ default_muezzin_user_id?: string | null }>();

  if (mosqueError) {
    if (!['PGRST116', '42703'].includes(mosqueError.code)) {
      console.warn('[fetchDefaultMuezzinUserId] mosque lookup', mosqueError.message);
    }
    return null;
  }

  const defaultUserId = mosqueRow?.default_muezzin_user_id ?? null;
  if (!defaultUserId) return null;

  const { data: assignment, error: assignmentError } = await supabase
    .from('muezzins')
    .select('user_id, is_active')
    .eq('mosque_id', mosqueId)
    .eq('user_id', defaultUserId)
    .maybeSingle<{ user_id?: string | null; is_active?: boolean | null }>();

  if (assignmentError && assignmentError.code !== 'PGRST116') {
    console.warn('[fetchDefaultMuezzinUserId] assignment lookup', assignmentError.message);
    return null;
  }

  return assignment?.user_id && assignment.is_active !== false ? defaultUserId : null;
}

function buildDateRange(start: Date, end: Date) {
  const startDate = clampToDayStart(start);
  const endDate = clampToDayStart(end);
  const cursor = new Date(Math.min(startDate.getTime(), endDate.getTime()));
  const finalMs = Math.max(startDate.getTime(), endDate.getTime());
  const dates: string[] = [];
  while (cursor.getTime() <= finalMs) {
    dates.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function buildExplicitSlotKeys(rows: (Partial<StaffRotaEntry> | StaffRotaRow)[]) {
  const keys = new Set<string>();
  rows.forEach((row) => {
    const prayerName = normalizeRotaPrayerName(row.prayer_name ?? row.prayer ?? null);
    const date = row.date ?? row.duty_date ?? null;
    if (date && prayerName) {
      keys.add(`${date}:${prayerName}`);
    }
  });
  return keys;
}

function appendDefaultRotaEntries({
  entries,
  explicitSlotKeys,
  coverOverrides,
  defaultMuezzinUserId,
  mosqueId,
  startDate,
  endDate,
  prayerTimesByDate,
}: {
  entries: StaffRotaEntry[];
  explicitSlotKeys: Set<string>;
  coverOverrides: Record<string, CoverOverride>;
  defaultMuezzinUserId: string | null;
  mosqueId: string;
  startDate: Date;
  endDate: Date;
  prayerTimesByDate: Record<string, PrayerTimesRow | undefined>;
}) {
  if (!defaultMuezzinUserId) return entries;

  const withDefaults = [...entries];
  buildDateRange(startDate, endDate).forEach((date) => {
    ROTA_PRAYERS.forEach((prayerName) => {
      const key = `${date}:${prayerName}`;
      if (explicitSlotKeys.has(key)) return;

      const canonicalPrayerRow = prayerTimesByDate[date];
      const override = coverOverrides[key];
      const effectiveUserId = override?.volunteerUserId ?? defaultMuezzinUserId;
      withDefaults.push({
        id: `default-${mosqueId}-${date}-${prayerName}`,
        mosque_id: mosqueId,
        date,
        duty_date: date,
        prayer_name: prayerName,
        prayer: prayerName,
        muezzin_user_id: effectiveUserId,
        staff_user_id: effectiveUserId,
        role_on_duty: 'default',
        adhan_time: getPrayerTimeValue(canonicalPrayerRow, prayerName, 'adhan'),
        iqama_time: getPrayerTimeValue(canonicalPrayerRow, prayerName, 'iqama'),
        notes:
          override?.status === 'provisional_cover'
            ? 'Emergency cover pending local-admin confirmation.'
            : null,
      });
    });
  });

  return withDefaults;
}

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

    const workspacePayload = await loadRotaWorkspaceForRange(from, to);
    if (workspacePayload?.mosqueId) {
      return {
        entries: (workspacePayload.entries ?? []) as StaffRotaEntry[],
        profileNames: (workspacePayload.profileNames ?? {}) as Record<string, string>,
        mosqueId: workspacePayload.mosqueId ?? null,
        mosqueName: workspacePayload.mosqueName ?? null,
        userId: workspacePayload.userId ?? user.id,
        error: workspacePayload.error ? new Error(workspacePayload.error) : null,
      };
    }

    let mosqueId: string | null = null;
    let mosqueName: string | null = null;
    let muezzinError: Error | null = null;
    try {
      const primaryMosque = await getMuezzinPrimaryMosque(supabase as any, user.id);
      mosqueId = primaryMosque?.mosqueId ?? null;
      mosqueName = primaryMosque?.mosqueName ?? null;
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
    let data: {
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
    }[] | null = null;
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
    const coverOverrides = await fetchCoverOverrideMap(mosqueId, startIso, endIso);
    const { data: prayerTimesRows, error: prayerTimesError } = await supabase
      .from('prayer_times')
      .select(
        'date,fajr_adhan_time,fajr_iqama_time,dhuhr_adhan_time,dhuhr_iqama_time,asr_adhan_time,asr_iqama_time,maghrib_adhan_time,maghrib_iqama_time,isha_adhan_time,isha_iqama_time'
      )
      .eq('mosque_id', mosqueId)
      .gte('date', startIso)
      .lte('date', endIso);

    if (prayerTimesError && prayerTimesError.code !== 'PGRST116') {
      console.warn('[getMuezzinRotaForRange] prayer_times error', prayerTimesError.message);
    }
    const prayerTimesByDate = Object.fromEntries(((prayerTimesRows ?? []) as PrayerTimesRow[]).map((row) => [row.date, row]));
    const explicitSlotKeys = buildExplicitSlotKeys((data ?? []) as StaffRotaRow[]);
    const defaultMuezzinUserId = await fetchDefaultMuezzinUserId(mosqueId);

    const explicitEntries: StaffRotaEntry[] = (data ?? [])
      .map((row: any) => {
        const prayerName = normalizeRotaPrayerName(row?.prayer_name ?? row?.prayer ?? null);
        const date = row?.date ?? row?.duty_date ?? null;
        if (!prayerName || !date) return null;
        const resolvedMosqueId = row?.mosque_id ?? mosqueId;
        const canonicalPrayerRow = prayerTimesByDate[date];
        const override = coverOverrides[`${date}:${prayerName}`];
        const effectiveUserId = override?.volunteerUserId ?? row?.muezzin_user_id ?? row?.staff_user_id ?? null;
        return {
          id: row?.id ?? `${resolvedMosqueId ?? 'mosque'}-${date}-${prayerName}`,
          mosque_id: resolvedMosqueId,
          date,
          duty_date: row?.duty_date ?? null,
          prayer_name: prayerName,
          prayer: row?.prayer ?? null,
          muezzin_user_id: effectiveUserId,
          staff_user_id: effectiveUserId,
          role_on_duty: row?.role_on_duty ?? null,
          adhan_time: row?.adhan_time ?? getPrayerTimeValue(canonicalPrayerRow, prayerName, 'adhan'),
          iqama_time: row?.iqama_time ?? getPrayerTimeValue(canonicalPrayerRow, prayerName, 'iqama'),
          notes:
            override?.status === 'provisional_cover'
              ? [row?.notes ?? null, 'Emergency cover pending local-admin confirmation.'].filter(Boolean).join(' ')
              : row?.notes ?? null,
        } as StaffRotaEntry;
      })
      .filter(Boolean) as StaffRotaEntry[];

    const entries = appendDefaultRotaEntries({
      entries: explicitEntries,
      explicitSlotKeys,
      coverOverrides,
      defaultMuezzinUserId,
      mosqueId,
      startDate: from,
      endDate: to,
      prayerTimesByDate,
    });

    const userIds = Array.from(
      new Set(
        entries
          .map((r) => (r.muezzin_user_id ?? r.staff_user_id) as string | null)
          .filter(Boolean) as string[]
      )
    );
    const profileNames = await fetchProfileNameMap(userIds);

    if (!mosqueName) {
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

function hasConcreteSlotTime(slot: MuezzinPrayerSlot | null | undefined) {
  return !!slot?.adhanTime || !!slot?.liveWindowStart || !!slot?.liveWindowEnd;
}

function pickNextAssignedSlot(slots: MuezzinPrayerSlot[], now: Date) {
  const nowMs = now.getTime();
  const actionable = slots
    .filter((slot) => hasConcreteSlotTime(slot))
    .filter((slot) => slot.isAssignedToMe)
    .filter((slot) => (slot.liveWindowEnd?.getTime() ?? slot.adhanTime?.getTime() ?? Number.MAX_SAFE_INTEGER) >= nowMs)
    .sort((a, b) => (a.adhanTime?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.adhanTime?.getTime() ?? Number.MAX_SAFE_INTEGER));
  return actionable[0] ?? null;
}

function pickNextMosqueSlot(slots: MuezzinPrayerSlot[], now: Date) {
  const nowMs = now.getTime();
  const actionable = slots
    .filter((slot) => hasConcreteSlotTime(slot))
    .filter((slot) => (slot.liveWindowEnd?.getTime() ?? slot.adhanTime?.getTime() ?? Number.MAX_SAFE_INTEGER) >= nowMs)
    .sort((a, b) => (a.adhanTime?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.adhanTime?.getTime() ?? Number.MAX_SAFE_INTEGER));
  return actionable[0] ?? null;
}

async function buildSlotsForDate(
  mosqueId: string,
  mosqueName: string | null,
  userId: string,
  date: Date,
  workspacePayloadOverride?: RotaWorkspacePayload | null
): Promise<MuezzinPrayerSlot[]> {
  const dateIso = formatLocalDate(date);
  const [prayerTimes, workspacePayload] = await Promise.all([
    getDailyPrayerTimes(mosqueId, date),
    workspacePayloadOverride ? Promise.resolve(workspacePayloadOverride) : loadRotaWorkspaceForDate(date),
  ]);

  let dayEntries: StaffRotaEntry[] = [];
  let nameMap: Record<string, string> = {};
  let defaultMuezzinUserId = workspacePayload?.defaultMuezzinUserId ?? null;
  let coverOverrideMap: Record<string, CoverOverride> = {};

  if (workspacePayload?.mosqueId === mosqueId) {
    dayEntries = (workspacePayload.entries ?? []) as StaffRotaEntry[];
    nameMap = (workspacePayload.profileNames ?? {}) as Record<string, string>;
    mosqueName = mosqueName ?? workspacePayload.mosqueName ?? null;
  } else {
    const rotaPromise = (async () => {
      const res = await supabase
        .from('staff_rota')
        .select('prayer_name,muezzin_user_id,staff_user_id,adhan_time,iqama_time,notes')
        .eq('mosque_id', mosqueId)
        .eq('date', dateIso);
      if (res.error && res.error.code === '42703') {
        return supabase
          .from('staff_rota')
          .select('prayer_name,muezzin_user_id,staff_user_id,notes')
          .eq('mosque_id', mosqueId)
          .eq('date', dateIso);
      }
      return res;
    })();

    const [rotaRes, coverOverrides, fallbackDefaultMuezzinUserId] = await Promise.all([
      rotaPromise,
      fetchCoverOverrideMap(mosqueId, dateIso, dateIso),
      fetchDefaultMuezzinUserId(mosqueId),
    ]);
    defaultMuezzinUserId = fallbackDefaultMuezzinUserId;
    coverOverrideMap = coverOverrides;

    const rotaRows = (rotaRes.data ?? []) as (StaffRotaRow & { notes?: string | null })[];
    dayEntries = rotaRows
      .map((row) => {
        const prayerName = normalizeRotaPrayerName(row.prayer_name ?? row.prayer ?? null);
        if (!prayerName) return null;
        const override = coverOverrides[`${dateIso}:${prayerName}`];
        const effectiveUserId = override?.volunteerUserId ?? row.muezzin_user_id ?? row.staff_user_id ?? null;
        return {
          id: `${mosqueId}-${dateIso}-${prayerName}`,
          mosque_id: mosqueId,
          date: dateIso,
          prayer_name: prayerName,
          prayer: row.prayer ?? null,
          muezzin_user_id: effectiveUserId,
          staff_user_id: effectiveUserId,
          adhan_time: row.adhan_time ?? null,
          iqama_time: row.iqama_time ?? null,
          notes:
            override?.status === 'provisional_cover'
              ? [row.notes ?? null, 'Emergency cover pending local-admin confirmation.'].filter(Boolean).join(' ')
              : row.notes ?? null,
        } as StaffRotaEntry;
      })
      .filter(Boolean) as StaffRotaEntry[];

    const userIds = Array.from(
      new Set(
        dayEntries
          .map((entry) => (entry.muezzin_user_id ?? entry.staff_user_id) as string | null)
          .filter(Boolean) as string[]
      )
    );

    Object.assign(nameMap, await fetchProfileNameMap(userIds));
  }

  const missingProfileIds = Array.from(
    new Set(
      [
        defaultMuezzinUserId,
        ...dayEntries.map((entry) => entry.muezzin_user_id ?? entry.staff_user_id ?? null),
      ].filter((id): id is string => !!id && !nameMap[id])
    )
  );
  if (missingProfileIds.length) {
    Object.assign(nameMap, await fetchProfileNameMap(missingProfileIds));
  }

  const now = new Date();
  return PRAYERS.map((prayerName) => {
    const lowerKey = lowerPrayerKey(prayerName);
    const entry = dayEntries.find((row) => {
      const normalized = normalizeRotaPrayerName(row.prayer_name ?? row.prayer ?? null);
      return normalized === lowerKey;
    }) ?? null;
    const override = coverOverrideMap[`${dateIso}:${lowerKey}`];
    const assignedMuezzinUserId = (
      entry
        ? entry.muezzin_user_id ?? entry.staff_user_id ?? null
        : override?.volunteerUserId ?? defaultMuezzinUserId
    ) as string | null;
    const assignmentSource = override
      ? 'cover'
      : entry
      ? entry.role_on_duty === 'default'
        ? 'default'
        : 'manual'
      : assignedMuezzinUserId
      ? 'default'
      : null;
    const slotTimes = (prayerTimes as any)?.[lowerKey] ?? null;
    const adhanTime = slotTimes?.adhan ?? toDate(entry?.adhan_time);
    const iqamaTime = slotTimes?.iqama ?? toDate(entry?.iqama_time);
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
      assignmentSource,
      isAssignedToMe: assignedMuezzinUserId === userId,
      notes: entry?.notes ?? null,
    };
  });
}

export async function getMuezzinScheduleForToday(): Promise<{
  schedule: MuezzinScheduleForDay | null;
  error: Error | null;
}> {
  const startedAt = Date.now();
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.warn('[getMuezzinScheduleForToday] auth error', authError.message);
      logMuezzinApiTrace('today:auth-error', { durationMs: Date.now() - startedAt, message: authError.message });
      return { schedule: null, error: authError };
    }
    const user = authData?.user ?? null;
    if (!user) {
      logMuezzinApiTrace('today:no-user', { durationMs: Date.now() - startedAt });
      return { schedule: null, error: new Error('No user') };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const workspacePayload = await loadRotaWorkspaceForDate(today);
    logMuezzinApiTrace('today:workspace', {
      durationMs: Date.now() - startedAt,
      userId: user.id,
      hasWorkspace: !!workspacePayload,
      mosqueId: workspacePayload?.mosqueId ?? null,
      mosqueName: workspacePayload?.mosqueName ?? null,
      entries: workspacePayload?.entries?.length ?? 0,
      workspaceError: workspacePayload?.error ?? null,
    });

    let mosqueId: string | null = null;
    let mosqueName: string | null = null;
    let muezzinError: Error | null = null;

    if (workspacePayload?.mosqueId) {
      mosqueId = workspacePayload.mosqueId ?? null;
      mosqueName = workspacePayload.mosqueName ?? null;
    } else {
      try {
        const primaryMosque = await getMuezzinPrimaryMosque(supabase as any, user.id);
        mosqueId = primaryMosque?.mosqueId ?? null;
        mosqueName = primaryMosque?.mosqueName ?? null;
        logMuezzinApiTrace('today:primary-mosque', {
          durationMs: Date.now() - startedAt,
          userId: user.id,
          mosqueId,
          mosqueName,
        });
      } catch (err: any) {
        muezzinError = err;
      }
    }

    if (muezzinError) {
      console.warn('[getMuezzinScheduleForToday] muezzin lookup', muezzinError?.message ?? muezzinError);
      logMuezzinApiTrace('today:primary-mosque-error', {
        durationMs: Date.now() - startedAt,
        userId: user.id,
        message: muezzinError?.message ?? String(muezzinError),
      });
      return { schedule: null, error: muezzinError };
    }
    if (!mosqueId) {
      logMuezzinApiTrace('today:no-mosque', {
        durationMs: Date.now() - startedAt,
        userId: user.id,
      });
      return { schedule: null, error: null };
    }

    const resolvedMosqueId = mosqueId;
    const now = new Date();
    if (!mosqueName) {
      const mosquePromise = supabase.from('mosques').select('name').eq('id', mosqueId).maybeSingle<{ name: string | null }>();
      const [mosqueRes] = await Promise.all([mosquePromise]);
      mosqueName = mosqueRes.data?.name ?? null;
    }
    const slots = await buildSlotsForDate(resolvedMosqueId, mosqueName, user.id, today, workspacePayload);
    let nextAssignedSlot = pickNextAssignedSlot(slots, now);
    let nextMosqueSlot = pickNextMosqueSlot(slots, now);
    if (!nextAssignedSlot || !nextMosqueSlot) {
      for (let offset = 1; offset <= FUTURE_LOOKAHEAD_DAYS && (!nextAssignedSlot || !nextMosqueSlot); offset += 1) {
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + offset);
        const futureSlots = await buildSlotsForDate(resolvedMosqueId, mosqueName, user.id, futureDate);
        if (!nextAssignedSlot) {
          nextAssignedSlot = pickNextAssignedSlot(futureSlots, now);
        }
        if (!nextMosqueSlot) {
          nextMosqueSlot = pickNextMosqueSlot(futureSlots, now);
        }
      }
    }

    logMuezzinApiTrace('today:resolved', {
      durationMs: Date.now() - startedAt,
      userId: user.id,
      mosqueId: resolvedMosqueId,
      mosqueName,
      slots: slots.length,
      nextAssignedPrayer: nextAssignedSlot?.prayerName ?? null,
      nextMosquePrayer: nextMosqueSlot?.prayerName ?? null,
    });

    console.log('[getMuezzinScheduleForToday] user', user.id, 'mosque', mosqueId, 'slots', slots);

    return {
      schedule: {
        mosqueId: resolvedMosqueId,
        mosqueName,
        date: today,
        nextAssignedSlot,
        nextMosqueSlot,
        slots,
      },
      error: null,
    };
  } catch (err: any) {
    console.warn('[getMuezzinScheduleForToday] error', err?.message ?? err);
    logMuezzinApiTrace('today:error', {
      durationMs: Date.now() - startedAt,
      message: err?.message ?? String(err),
    });
    return { schedule: null, error: err };
  }
}
