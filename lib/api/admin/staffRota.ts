import { PrayerName } from '../../adhans';
import { normalizePrayerTimes } from '../prayerTimesUnified';
import { getPrayerTimesByDate } from './prayerTimes';
import { supabase } from '../../supabase';
import { insertAppNotifications } from '../appNotifications';
import { resolveApiUrl, supportsServerApi } from '../apiBaseUrl';

const PRAYERS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export type StaffRotaRow = {
  id?: string;
  mosque_id: string;
  muezzin_user_id: string;
  staff_user_id?: string | null;
  prayer_name: string;
  date: string;
  adhan_time?: string | null;
  iqama_time?: string | null;
  notes?: string | null;
  assigned_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type StaffRotaForDay = Partial<
  Record<
    PrayerName,
    {
      muezzinUserId: string | null;
      notes: string | null;
      adhanTime: Date | null;
      iqamaTime: Date | null;
      assignmentSource?: 'manual' | 'default' | null;
    }
  >
>;

export type MuezzinSummary = {
  userId: string;
  displayName: string;
  // Legacy shape kept for backward compatibility with older screens.
  user_id: string;
  name: string;
  isDefault?: boolean;
};

export async function getMuezzinsForMosque(mosqueId: string): Promise<MuezzinSummary[]> {
  try {
    // Primary query: avoid joins so RLS on profiles can't filter out the base rows.
    let data: { user_id: string; is_active?: boolean | null }[] | null = null;
    let error: any = null;
    ({ data, error } = await supabase
      .from('muezzins')
      .select('user_id, is_active')
      .match({ mosque_id: mosqueId, is_active: true }));

    // If is_active column missing, retry without that filter.
    if (error && error.code === '42703') {
      ({ data, error } = await supabase.from('muezzins').select('user_id').match({ mosque_id: mosqueId }) as any);
    }

    if (error && error.code !== 'PGRST116') throw error;

    const rows = data ?? [];
    const profileMap = await fetchProfilesForUsers(rows.map((r: any) => r.user_id));

    return rows.map((row: any) => {
      const display = profileMap[row.user_id] ?? 'Muezzin';
      return {
        userId: row.user_id,
        displayName: display,
        user_id: row.user_id,
        name: display,
      };
    });
  } catch (e) {
    console.warn('[getMuezzinsForMosque]', e);
    return [];
  }
}

async function fetchProfilesForUsers(userIds: string[]) {
  if (!userIds.length) return {} as Record<string, string>;
  try {
    let data: { id: string; full_name?: string | null; email?: string | null }[] | null = null;
    let error: any = null;
    ({ data, error } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds));
    if (error && error.code === '42703') {
      // full_name/email column missing; fall back to id only.
      ({ data, error } = await supabase.from('profiles').select('id').in('id', userIds) as any);
    }
    if (error && error.code !== 'PGRST116') throw error;
    const map: Record<string, string> = {};
    (data ?? []).forEach((row: any) => {
      map[row.id] = row?.full_name ?? row?.email ?? '';
    });
    return map;
  } catch (e) {
    console.warn('[fetchProfilesForUsers]', e);
    return {} as Record<string, string>;
  }
}

export async function getStaffRotaByDate(mosqueId: string, dateIso: string) {
  const { data, error } = await supabase
    .from('staff_rota')
    .select('*')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso)
    .order('prayer_name', { ascending: true });
  if (error && error.code !== 'PGRST116') throw error;
  return (data ?? []) as StaffRotaRow[];
}

export async function upsertStaffRotaForDate(
  mosqueId: string,
  dateIso: string,
  assignments: Omit<StaffRotaRow, 'mosque_id' | 'date'>[]
) {
  if (!assignments.length) return [];
  const rows = assignments.map((a) => ({
    ...a,
    mosque_id: mosqueId,
    date: dateIso,
  }));
  const { data, error } = await supabase
    .from('staff_rota')
    .upsert(rows, { onConflict: 'mosque_id,date,prayer_name' })
    .select('*');
  if (error) throw error;
  return (data ?? []) as StaffRotaRow[];
}

export async function getStaffRotaForDate(mosqueId: string, date: Date): Promise<StaffRotaForDay> {
  const dateIso = formatLocalDate(date);
  try {
    const baseSelect =
      'prayer_name, muezzin_user_id, staff_user_id, notes, adhan_time, iqama_time';
    let data: {
      prayer_name?: string | null;
      muezzin_user_id?: string | null;
      staff_user_id?: string | null;
      notes?: string | null;
      adhan_time?: string | null;
      iqama_time?: string | null;
    }[] | null = null;
    let error: any = null;
    ({ data, error } = await supabase
      .from('staff_rota')
      .select(baseSelect)
      .eq('mosque_id', mosqueId)
      .eq('date', dateIso));

    // If newer columns are missing, fall back to a minimal projection.
    if (error && error.code === '42703') {
      const fallback = await supabase
        .from('staff_rota')
        .select('prayer_name, muezzin_user_id, staff_user_id, notes')
        .eq('mosque_id', mosqueId)
        .eq('date', dateIso);
      data = fallback.data ?? [];
      error = fallback.error ?? null;
    }

    if (error && error.code !== 'PGRST116') throw error;
    const map: StaffRotaForDay = {};
    (data ?? []).forEach((row: any) => {
      const key = (row.prayer_name ?? '').toLowerCase() as PrayerName;
      const userId = row?.muezzin_user_id ?? row?.staff_user_id ?? null;
      map[key] = {
        muezzinUserId: userId,
        notes: row.notes ?? null,
        adhanTime: safeDate(row.adhan_time),
        iqamaTime: safeDate(row.iqama_time),
        assignmentSource: 'manual',
      };
    });
    return map;
  } catch (e) {
    console.warn('[getStaffRotaForDate]', e);
    return {};
  }
}

export async function saveStaffRotaForDate(
  mosqueId: string,
  date: Date,
  assignments: StaffRotaForDay,
  assignedByUserId: string,
  mosqueName?: string | null
): Promise<{ success: boolean; error?: string | null; notificationCount?: number }> {
  const dateIso = formatLocalDate(date);
  const serverResult = await saveStaffRotaForDateViaServer(mosqueId, dateIso, assignments, mosqueName ?? null);
  if (serverResult) {
    return serverResult;
  }
  const previousRows = await getStaffRotaByDate(mosqueId, dateIso).catch(() => []);
  const normalizedTimes = await loadPrayerTimesSlotMap(mosqueId, date);
  const rows = PRAYERS.map((prayer) => {
    const assignment = assignments?.[prayer];
    if (!assignment?.muezzinUserId || assignment.assignmentSource === 'default') return null;
    const slot = normalizedTimes?.[prayer];
    return {
      mosque_id: mosqueId,
      date: dateIso,
      prayer_name: prayer,
      muezzin_user_id: assignment.muezzinUserId,
      // Legacy column support
      staff_user_id: assignment.muezzinUserId,
      duty_date: dateIso, // legacy column
      prayer: prayer, // legacy column
      adhan_time: toIsoString(assignment.adhanTime ?? slot?.adhanTime),
      iqama_time: toIsoString(assignment.iqamaTime ?? slot?.iqamaTime),
      notes: assignment.notes ?? null,
      assigned_by: assignedByUserId || null,
    };
  }).filter(Boolean) as StaffRotaRow[];

  if (!rows.length) {
    return { success: false, error: 'Choose at least one manual muezzin assignment before saving.' };
  }

  const activeMuezzins = await getMuezzinsForMosque(mosqueId);
  const activeMuezzinIds = new Set(activeMuezzins.map((muezzin) => muezzin.userId ?? muezzin.user_id).filter(Boolean));
  const invalidRows = rows.filter((row) => !activeMuezzinIds.has(row.muezzin_user_id ?? row.staff_user_id ?? ''));
  if (invalidRows.length) {
    return { success: false, error: 'One or more selected muezzins are no longer active for this mosque. Refresh the rota and choose again.' };
  }

  try {
    // Treat the full day as the source of truth so clearing an assignment removes the old row.
    const { error: delError } = await supabase
      .from('staff_rota')
      .delete()
      .eq('mosque_id', mosqueId)
      .eq('date', dateIso);
    if (delError && delError.code !== 'PGRST116') throw delError;

    let inserted: StaffRotaRow[] = [];
    if (rows.length) {
      const insertResult = await supabase.from('staff_rota').insert(rows).select('*');
      if (insertResult.error) throw insertResult.error;
      inserted = (insertResult.data ?? []) as StaffRotaRow[];
      if (inserted.length === 0) {
        return { success: false, error: 'Save failed: no rows persisted (check RLS permissions for staff_rota).' };
      }
    }

    const notificationCount = await notifyRotaChanges({
      mosqueId,
      mosqueName: mosqueName ?? null,
      dateIso,
      previousRows,
      nextRows: rows,
      assignedByUserId,
    }).catch((notificationError) => {
      console.warn('[saveStaffRotaForDate] notification fallback', notificationError);
      return 0;
    });

    return { success: true, notificationCount };
  } catch (e: any) {
    // If schema lacks adhan/iqama columns, retry without them.
    const msg = e?.message ?? '';
    const missingTimes = e?.code === '42703' || msg.toLowerCase().includes('adhan_time') || msg.toLowerCase().includes('iqama_time');
    const fkIssueMain = msg.toLowerCase().includes('foreign key') || e?.code === '23503';
    if (missingTimes || fkIssueMain) {
      const rowsWithoutTimes = rows.map((r) => ({
        mosque_id: r.mosque_id,
        date: r.date,
        prayer_name: r.prayer_name,
        muezzin_user_id: r.muezzin_user_id ?? r.staff_user_id ?? null,
        staff_user_id: r.staff_user_id ?? r.muezzin_user_id,
        duty_date: r.date,
        prayer: r.prayer_name,
        notes: r.notes ?? null,
      }));

      // Fallback: if FK is the issue, try nulling muezzin_user_id for legacy schemas.
      // If FK is the issue, try a minimal legacy insert without muezzin_user_id.
      const rowsLegacyFk = rowsWithoutTimes.map((r) => ({
        mosque_id: r.mosque_id,
        date: r.date,
        prayer_name: r.prayer_name,
        muezzin_user_id: r.muezzin_user_id ?? r.staff_user_id ?? null,
        staff_user_id: r.staff_user_id ?? r.muezzin_user_id,
        duty_date: r.date,
        prayer: r.prayer_name,
        notes: r.notes ?? null,
      }));

      try {
        const { error: delError } = await supabase
          .from('staff_rota')
          .delete()
          .eq('mosque_id', rowsLegacyFk[0].mosque_id)
          .eq('date', rowsLegacyFk[0].date);
        if (delError && delError.code !== 'PGRST116') throw delError;

        let insertedFallback: StaffRotaRow[] = [];
        if (rowsLegacyFk.length) {
          const fallbackResult = await supabase.from('staff_rota').insert(rowsLegacyFk as any).select('*');
          if (fallbackResult.error) throw fallbackResult.error;
          insertedFallback = (fallbackResult.data ?? []) as StaffRotaRow[];
          if (insertedFallback.length === 0) {
            return { success: false, error: 'Legacy save failed: no rows persisted (check RLS permissions).' };
          }
        }
        const notificationCount = await notifyRotaChanges({
          mosqueId,
          mosqueName: mosqueName ?? null,
          dateIso,
          previousRows,
          nextRows: rowsLegacyFk,
          assignedByUserId,
        }).catch((notificationError) => {
          console.warn('[saveStaffRotaForDate:retry] notification fallback', notificationError);
          return 0;
        });
        return { success: true, notificationCount };
      } catch (retryErr: any) {
        console.warn('[saveStaffRotaForDate:retry]', retryErr?.message ?? retryErr);
        return { success: false, error: retryErr?.message ?? 'Unable to save staff rota.' };
      }
    }
    console.warn('[saveStaffRotaForDate]', e?.message ?? e);
    return { success: false, error: e?.message ?? 'Unable to save staff rota.' };
  }
}

async function saveStaffRotaForDateViaServer(
  mosqueId: string,
  dateIso: string,
  assignments: StaffRotaForDay,
  mosqueName?: string | null
): Promise<{ success: boolean; error?: string | null; notificationCount?: number } | null> {
  if (!supportsServerApi()) {
    return null;
  }

  const endpoint = resolveApiUrl('/api/admin/staff-rota-save');
  if (!endpoint) {
    return null;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    return { success: false, error: 'Your session has expired. Refresh and sign in again.' };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        mosqueId,
        date: dateIso,
        mosqueName: mosqueName ?? null,
        assignments,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: payload?.error || 'Unable to save staff rota.',
      };
    }

    return {
      success: payload?.success !== false,
      error: payload?.error ?? null,
      notificationCount:
        typeof payload?.notificationCount === 'number' ? payload.notificationCount : undefined,
    };
  } catch (error) {
    console.warn('[saveStaffRotaForDateViaServer] fallback', error);
    return null;
  }
}

async function loadPrayerTimesSlotMap(mosqueId: string, date: Date) {
  try {
    const row = await getPrayerTimesByDate(mosqueId, formatLocalDate(date));
    const normalized = normalizePrayerTimes(row as any);
    if (!normalized) return null;
    const map: StaffRotaForDay = {};
    PRAYERS.forEach((p) => {
      map[p] = {
        muezzinUserId: null,
        notes: null,
        adhanTime: normalized[p].adhan,
        iqamaTime: normalized[p].iqama,
      };
    });
    return map;
  } catch (e) {
    console.warn('[loadPrayerTimesSlotMap]', e);
    return null;
  }
}

function safeDate(val?: string | null) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function toIsoString(val?: Date | null) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function notifyRotaChanges(args: {
  mosqueId: string;
  mosqueName?: string | null;
  dateIso: string;
  previousRows: StaffRotaRow[];
  nextRows: StaffRotaRow[];
  assignedByUserId: string;
}) {
  const previousMap = new Map<string, StaffRotaRow>();
  const nextMap = new Map<string, StaffRotaRow>();

  args.previousRows.forEach((row) => previousMap.set(row.prayer_name, row));
  args.nextRows.forEach((row) => nextMap.set(row.prayer_name, row));

  const notifications: {
    user_id: string;
    mosque_id: string;
    actor_user_id: string;
    type: string;
    title: string;
    body: string;
    metadata: Record<string, unknown>;
  }[] = [];

  PRAYERS.forEach((prayerName) => {
    const previous = previousMap.get(prayerName);
    const next = nextMap.get(prayerName);
    const previousUserId = previous?.muezzin_user_id ?? previous?.staff_user_id ?? null;
    const nextUserId = next?.muezzin_user_id ?? next?.staff_user_id ?? null;
    if (previousUserId === nextUserId) return;

    const prayerLabel = prayerName.charAt(0).toUpperCase() + prayerName.slice(1);
    const dateLabel = formatNotificationDate(args.dateIso);
    const mosqueLabel = args.mosqueName?.trim() || 'your mosque';

    if (nextUserId) {
      notifications.push({
        user_id: nextUserId,
        mosque_id: args.mosqueId,
        actor_user_id: args.assignedByUserId,
        type: previousUserId ? 'rota_reassigned' : 'rota_assigned',
        title: previousUserId ? `${prayerLabel} rota updated` : `${prayerLabel} rota assigned`,
        body: `${dateLabel} at ${mosqueLabel} now includes you for ${prayerLabel}.`,
        metadata: {
          prayerName,
          date: args.dateIso,
          previousUserId,
          nextUserId,
        },
      });
    }

    if (previousUserId) {
      notifications.push({
        user_id: previousUserId,
        mosque_id: args.mosqueId,
        actor_user_id: args.assignedByUserId,
        type: 'rota_unassigned',
        title: `${prayerLabel} rota changed`,
        body: `${dateLabel} at ${mosqueLabel} no longer has you assigned for ${prayerLabel}.`,
        metadata: {
          prayerName,
          date: args.dateIso,
          previousUserId,
          nextUserId,
        },
      });
    }
  });

  if (!notifications.length) return 0;
  await insertAppNotifications(notifications);
  return notifications.length;
}

function formatNotificationDate(dateIso: string) {
  const parsed = new Date(`${dateIso}T00:00:00`);
  if (isNaN(parsed.getTime())) return dateIso;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
