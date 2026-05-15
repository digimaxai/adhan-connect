import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';
import { resolvePrimaryMuezzinMosqueForUser } from '../../../lib/server/muezzinAccess';

type StaffRotaEntry = {
  id: string;
  mosque_id: string;
  date: string;
  duty_date?: string | null;
  prayer_name: string;
  prayer?: string | null;
  muezzin_user_id: string | null;
  staff_user_id?: string | null;
  role_on_duty?: string | null;
  adhan_time?: string | null;
  iqama_time?: string | null;
  notes?: string | null;
};

type MuezzinCoverRequest = {
  id: string;
  mosque_id: string;
  date: string;
  prayer_name: string;
  requester_user_id: string;
  original_muezzin_user_id: string;
  volunteer_user_id?: string | null;
  request_kind: string;
  urgency: string;
  status: string;
  reason?: string | null;
  requested_at?: string | null;
  responded_at?: string | null;
  resolved_at?: string | null;
  resolved_by_user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  requester_name?: string | null;
  volunteer_name?: string | null;
  resolved_by_name?: string | null;
};

type ProfileRow = {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  email?: string | null;
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

type CoverOverride = {
  volunteerUserId: string;
  status: 'provisional_cover' | 'approved';
};

const ROTA_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
const ACTIVE_REQUEST_STATUSES = ['open', 'volunteered', 'provisional_cover'] as const;
const APPROVED_OVERRIDE_STATUSES = ['provisional_cover', 'approved'] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function normalizePrayerName(value?: string | null) {
  const lower = (value ?? '').toLowerCase();
  return ROTA_PRAYERS.includes(lower as (typeof ROTA_PRAYERS)[number])
    ? (lower as (typeof ROTA_PRAYERS)[number])
    : null;
}

function parseIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatUtcDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function buildDateRange(startIso: string, endIso: string) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return [];

  const dates: string[] = [];
  const cursor = new Date(Math.min(start.getTime(), end.getTime()));
  const finalMs = Math.max(start.getTime(), end.getTime());
  while (cursor.getTime() <= finalMs) {
    dates.push(formatUtcDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function fetchProfileNameMap(supabaseAdmin: any, userIds: string[]) {
  if (!userIds.length) return {} as Record<string, string>;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, full_name, email')
    .in('id', Array.from(new Set(userIds)));

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const map: Record<string, string> = {};
  ((data ?? []) as ProfileRow[]).forEach((row) => {
    map[row.id] = row.display_name ?? row.full_name ?? row.email ?? row.id;
  });
  return map;
}

async function loadStaffRotaRows(supabaseAdmin: any, mosqueId: string, startIso: string, endIso: string) {
  let data: any[] | null = null;
  let error: any = null;

  ({ data, error } = await supabaseAdmin
    .from('staff_rota')
    .select('id, mosque_id, date, duty_date, prayer_name, prayer, muezzin_user_id, staff_user_id, role_on_duty, notes, adhan_time, iqama_time')
    .eq('mosque_id', mosqueId)
    .gte('date', startIso)
    .lte('date', endIso)
    .order('date', { ascending: true }));

  if (error?.code === '42703') {
    const fallback = await supabaseAdmin
      .from('staff_rota')
      .select('id, mosque_id, date, duty_date, prayer_name, prayer, muezzin_user_id, staff_user_id, role_on_duty, notes')
      .eq('mosque_id', mosqueId)
      .gte('date', startIso)
      .lte('date', endIso)
      .order('date', { ascending: true });
    data = fallback.data ?? [];
    error = fallback.error ?? null;
  }

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return (data ?? []) as any[];
}

async function loadCoverOverrides(supabaseAdmin: any, mosqueId: string, startIso: string, endIso: string) {
  const { data, error } = await supabaseAdmin
    .from('muezzin_cover_requests')
    .select('date, prayer_name, volunteer_user_id, status')
    .eq('mosque_id', mosqueId)
    .gte('date', startIso)
    .lte('date', endIso)
    .in('status', [...APPROVED_OVERRIDE_STATUSES]);

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const overrides: Record<string, CoverOverride> = {};
  ((data ?? []) as { date?: string | null; prayer_name?: string | null; volunteer_user_id?: string | null; status?: string | null }[]).forEach((row) => {
    const prayerName = normalizePrayerName(row.prayer_name);
    if (!row.date || !prayerName || !row.volunteer_user_id) return;
    overrides[`${row.date}:${prayerName}`] = {
      volunteerUserId: row.volunteer_user_id,
      status: row.status === 'approved' ? 'approved' : 'provisional_cover',
    };
  });
  return overrides;
}

async function loadActiveRequests(supabaseAdmin: any, mosqueId: string) {
  const { data, error } = await supabaseAdmin
    .from('muezzin_cover_requests')
    .select(
      'id, mosque_id, date, prayer_name, requester_user_id, original_muezzin_user_id, volunteer_user_id, request_kind, urgency, status, reason, requested_at, responded_at, resolved_at, resolved_by_user_id, created_at, updated_at'
    )
    .eq('mosque_id', mosqueId)
    .in('status', [...ACTIVE_REQUEST_STATUSES])
    .order('created_at', { ascending: false });

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return (data ?? []) as MuezzinCoverRequest[];
}

async function loadPrayerTimesRows(supabaseAdmin: any, mosqueId: string, startIso: string, endIso: string) {
  const { data, error } = await supabaseAdmin
    .from('prayer_times')
    .select(
      'date,fajr_adhan_time,fajr_iqama_time,dhuhr_adhan_time,dhuhr_iqama_time,asr_adhan_time,asr_iqama_time,maghrib_adhan_time,maghrib_iqama_time,isha_adhan_time,isha_iqama_time'
    )
    .eq('mosque_id', mosqueId)
    .gte('date', startIso)
    .lte('date', endIso);

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return (data ?? []) as PrayerTimesRow[];
}

function getPrayerTimeValue(row: PrayerTimesRow | undefined, prayerName: string, kind: 'adhan' | 'iqama') {
  if (!row) return null;
  if (prayerName === 'fajr') return kind === 'adhan' ? row.fajr_adhan_time ?? null : row.fajr_iqama_time ?? null;
  if (prayerName === 'dhuhr') return kind === 'adhan' ? row.dhuhr_adhan_time ?? null : row.dhuhr_iqama_time ?? null;
  if (prayerName === 'asr') return kind === 'adhan' ? row.asr_adhan_time ?? null : row.asr_iqama_time ?? null;
  if (prayerName === 'maghrib') return kind === 'adhan' ? row.maghrib_adhan_time ?? null : row.maghrib_iqama_time ?? null;
  if (prayerName === 'isha') return kind === 'adhan' ? row.isha_adhan_time ?? null : row.isha_iqama_time ?? null;
  return null;
}

async function loadDefaultMuezzinUserId(supabaseAdmin: any, mosqueId: string) {
  const { data: mosqueRow, error: mosqueError } = await supabaseAdmin
    .from('mosques')
    .select('default_muezzin_user_id')
    .eq('id', mosqueId)
    .maybeSingle();

  if (mosqueError) {
    if (['PGRST116', '42703'].includes(mosqueError.code)) return null;
    throw mosqueError;
  }

  const defaultUserId = (mosqueRow as { default_muezzin_user_id?: string | null } | null)?.default_muezzin_user_id ?? null;
  if (!defaultUserId) return null;

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from('muezzins')
    .select('user_id, is_active')
    .eq('mosque_id', mosqueId)
    .eq('user_id', defaultUserId)
    .maybeSingle();

  if (assignmentError && assignmentError.code !== 'PGRST116') {
    throw assignmentError;
  }

  const assignmentRow = assignment as { user_id?: string | null; is_active?: boolean | null } | null;
  return assignmentRow?.user_id && assignmentRow.is_active !== false ? defaultUserId : null;
}

function buildExplicitSlotKeys(rows: any[]) {
  const keys = new Set<string>();
  rows.forEach((row) => {
    const prayerName = normalizePrayerName(row?.prayer_name ?? row?.prayer ?? null);
    const date = row?.date ?? row?.duty_date ?? null;
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
  startIso,
  endIso,
  prayerTimesByDate,
}: {
  entries: StaffRotaEntry[];
  explicitSlotKeys: Set<string>;
  coverOverrides: Record<string, CoverOverride>;
  defaultMuezzinUserId: string | null;
  mosqueId: string;
  startIso: string;
  endIso: string;
  prayerTimesByDate: Record<string, PrayerTimesRow | undefined>;
}) {
  if (!defaultMuezzinUserId) return entries;

  const withDefaults = [...entries];
  buildDateRange(startIso, endIso).forEach((date) => {
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

export const GET: RequestHandler = async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server is missing Supabase configuration.' }, 500);
  }

  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) {
    return json({ error: 'Missing bearer token.' }, 401);
  }

  const url = new URL(request.url);
  const startIso = (url.searchParams.get('start') ?? '').trim();
  const endIso = (url.searchParams.get('end') ?? '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endIso)) {
    return json({ error: 'Expected start and end query parameters in YYYY-MM-DD format.' }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return json({ error: 'Session is invalid or has expired.' }, 401);
  }

  const userId = authData.user.id;
  let primaryMosque: { mosqueId: string; name: string; city?: string | null; country?: string | null } | null = null;
  try {
    primaryMosque = await resolvePrimaryMuezzinMosqueForUser(supabaseAdmin, userId);
  } catch (muezzinError: any) {
    return json({ error: muezzinError?.message || 'Unable to resolve muezzin assignment.' }, 500);
  }

  if (!primaryMosque?.mosqueId) {
    return json({
      entries: [],
      profileNames: {},
      mosqueId: null,
      mosqueName: null,
      userId,
      myRequests: [],
      openRequests: [],
      error: null,
    });
  }

  const mosqueId = primaryMosque.mosqueId;
  const mosqueName = primaryMosque.name ?? null;

  try {
    const [staffRows, coverOverrides, requestRows, prayerTimesRows, defaultMuezzinUserId] = await Promise.all([
      loadStaffRotaRows(supabaseAdmin, mosqueId, startIso, endIso),
      loadCoverOverrides(supabaseAdmin, mosqueId, startIso, endIso),
      loadActiveRequests(supabaseAdmin, mosqueId),
      loadPrayerTimesRows(supabaseAdmin, mosqueId, startIso, endIso),
      loadDefaultMuezzinUserId(supabaseAdmin, mosqueId),
    ]);
    const prayerTimesByDate = Object.fromEntries(prayerTimesRows.map((row) => [row.date, row]));
    const explicitSlotKeys = buildExplicitSlotKeys(staffRows);

    const explicitEntries: StaffRotaEntry[] = staffRows
      .map((row) => {
        const prayerName = normalizePrayerName(row?.prayer_name ?? row?.prayer ?? null);
        const date = row?.date ?? row?.duty_date ?? null;
        if (!prayerName || !date) return null;
        const canonicalPrayerRow = prayerTimesByDate[date];
        const override = coverOverrides[`${date}:${prayerName}`];
        const effectiveUserId = override?.volunteerUserId ?? row?.muezzin_user_id ?? row?.staff_user_id ?? null;
        return {
          id: row?.id ?? `${mosqueId}-${date}-${prayerName}`,
          mosque_id: row?.mosque_id ?? mosqueId,
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
        } satisfies StaffRotaEntry;
      })
      .filter(Boolean) as StaffRotaEntry[];

    const entries = appendDefaultRotaEntries({
      entries: explicitEntries,
      explicitSlotKeys,
      coverOverrides,
      defaultMuezzinUserId,
      mosqueId,
      startIso,
      endIso,
      prayerTimesByDate,
    });

    const relatedUserIds = Array.from(
      new Set(
        [
          ...entries.map((entry) => entry.muezzin_user_id ?? entry.staff_user_id ?? null),
          ...requestRows.flatMap((row) => [row.requester_user_id, row.volunteer_user_id ?? null, row.resolved_by_user_id ?? null]),
        ].filter(Boolean)
      )
    ) as string[];

    const profileNames = await fetchProfileNameMap(supabaseAdmin, relatedUserIds);

    const enrichedRequests = requestRows.map((row) => ({
      ...row,
      requester_name: profileNames[row.requester_user_id] ?? null,
      volunteer_name: row.volunteer_user_id ? profileNames[row.volunteer_user_id] ?? null : null,
      resolved_by_name: row.resolved_by_user_id ? profileNames[row.resolved_by_user_id] ?? null : null,
    }));

    return json({
      entries,
      profileNames,
      mosqueId,
      mosqueName,
      userId,
      defaultMuezzinUserId,
      myRequests: enrichedRequests.filter((row) => row.requester_user_id === userId),
      openRequests: enrichedRequests.filter((row) => row.requester_user_id !== userId && !row.volunteer_user_id && row.status === 'open'),
      error: null,
    });
  } catch (error: any) {
    return json({ error: error?.message || 'Unable to load the muezzin rota workspace.' }, 500);
  }
};
