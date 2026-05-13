import { resolveApiUrl, supportsServerApi } from '../apiBaseUrl';
import { supabase } from '../../supabase';
import { getDailyPrayerTimes } from '../prayerTimesUnified';
import type { PrayerTimesRow } from './prayerTimes';
import { getStaffRotaForDate, type MuezzinSummary, type StaffRotaForDay } from './staffRota';
import { getMosqueMuezzinMembers } from './muezzins';

type StaffRotaWorkspacePayload = {
  prayerTimesRow: PrayerTimesRow | null;
  fallbackPrayerTimesRow: PrayerTimesRow | null;
  rotaRows: {
    prayer_name?: string | null;
    muezzin_user_id?: string | null;
    staff_user_id?: string | null;
    notes?: string | null;
    adhan_time?: string | null;
    iqama_time?: string | null;
  }[];
  muezzins: MuezzinSummary[];
};

function safeDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapRotaRows(rows: StaffRotaWorkspacePayload['rotaRows']): StaffRotaForDay {
  const map: StaffRotaForDay = {};
  rows.forEach((row) => {
    const key = (row.prayer_name ?? '').toLowerCase();
    if (!key) return;
    map[key as keyof StaffRotaForDay] = {
      muezzinUserId: row.muezzin_user_id ?? row.staff_user_id ?? null,
      notes: row.notes ?? null,
      adhanTime: safeDate(row.adhan_time ?? null),
      iqamaTime: safeDate(row.iqama_time ?? null),
    };
  });
  return map;
}

function parseDateIso(dateIso: string) {
  const [year, month, day] = dateIso.split('-').map((value) => Number.parseInt(value, 10));
  return new Date(year, (month || 1) - 1, day || 1);
}

function mapNormalizedToPrayerTimesRow(
  mosqueId: string,
  dateIso: string,
  normalized: Awaited<ReturnType<typeof getDailyPrayerTimes>>
): PrayerTimesRow | null {
  if (!normalized) return null;

  return {
    mosque_id: mosqueId,
    date: dateIso,
    fajr_adhan_time: normalized.fajr.adhan?.toISOString() ?? null,
    fajr_iqama_time: normalized.fajr.iqama?.toISOString() ?? null,
    dhuhr_adhan_time: normalized.dhuhr.adhan?.toISOString() ?? null,
    dhuhr_iqama_time: normalized.dhuhr.iqama?.toISOString() ?? null,
    asr_adhan_time: normalized.asr.adhan?.toISOString() ?? null,
    asr_iqama_time: normalized.asr.iqama?.toISOString() ?? null,
    maghrib_adhan_time: normalized.maghrib.adhan?.toISOString() ?? null,
    maghrib_iqama_time: normalized.maghrib.iqama?.toISOString() ?? null,
    isha_adhan_time: normalized.isha.adhan?.toISOString() ?? null,
    isha_iqama_time: normalized.isha.iqama?.toISOString() ?? null,
  };
}

async function loadStaffRotaWorkspaceFallback(mosqueId: string, dateIso: string) {
  const normalizedPrayerTimes = await getDailyPrayerTimes(mosqueId, parseDateIso(dateIso));
  const members = await getMosqueMuezzinMembers(mosqueId).catch((error) => {
    console.warn('[loadStaffRotaWorkspaceFallback] muezzin lookup failed', error);
    return [];
  });
  return {
    prayerTimesRow: null,
    fallbackPrayerTimesRow: mapNormalizedToPrayerTimesRow(mosqueId, dateIso, normalizedPrayerTimes),
    rota: await getStaffRotaForDate(mosqueId, parseDateIso(dateIso)),
    muezzins: members
      .filter((member) => member.isActive)
      .map((member) => ({
        userId: member.userId,
        displayName: member.displayName,
        user_id: member.userId,
        name: member.displayName,
      })),
  };
}

export async function loadStaffRotaWorkspace(mosqueId: string, dateIso: string) {
  if (!supportsServerApi()) {
    return loadStaffRotaWorkspaceFallback(mosqueId, dateIso);
  }

  const endpoint = resolveApiUrl('/api/admin/staff-rota-workspace');
  if (!endpoint) {
    return loadStaffRotaWorkspaceFallback(mosqueId, dateIso);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Your session has expired. Refresh and sign in again.');
  }

  try {
    const url = new URL(endpoint);
    url.searchParams.set('mosqueId', mosqueId);
    url.searchParams.set('date', dateIso);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Unable to load staff rota.');
    }

    const typed = payload as Partial<StaffRotaWorkspacePayload>;
    const validPayload =
      Array.isArray(typed?.rotaRows) &&
      Array.isArray(typed?.muezzins) &&
      ('prayerTimesRow' in typed || 'fallbackPrayerTimesRow' in typed);

    if (!validPayload) {
      throw new Error('Staff-rota workspace response was incomplete.');
    }

    const rotaRows = typed.rotaRows ?? [];
    const muezzins = typed.muezzins ?? [];

    const prayerTimesRow = (typed.prayerTimesRow ?? null) as PrayerTimesRow | null;
    let fallbackPrayerTimesRow = (typed.fallbackPrayerTimesRow ?? null) as PrayerTimesRow | null;

    // Server has no stored times for this date — apply Aladhan as last resort on the client
    if (!prayerTimesRow && !fallbackPrayerTimesRow) {
      try {
        const normalized = await getDailyPrayerTimes(mosqueId, parseDateIso(dateIso));
        if (normalized) {
          fallbackPrayerTimesRow = mapNormalizedToPrayerTimesRow(mosqueId, dateIso, normalized);
        }
      } catch {
        // silent — screen will show "create prayer times" warning
      }
    }

    return {
      prayerTimesRow,
      fallbackPrayerTimesRow,
      rota: mapRotaRows(rotaRows),
      muezzins: muezzins as MuezzinSummary[],
    };
  } catch (error) {
    console.warn('[loadStaffRotaWorkspace] server fallback', error);
    return loadStaffRotaWorkspaceFallback(mosqueId, dateIso);
  }
}
