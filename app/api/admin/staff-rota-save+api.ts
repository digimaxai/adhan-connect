import type { RequestHandler } from 'expo-router/server';
import { hasMosqueAdminAccess, json, requireAdminAccess } from '../../../lib/server/adminAccess';

const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
type PrayerName = (typeof PRAYERS)[number];

type AssignmentValue = {
  muezzinUserId?: string | null;
  notes?: string | null;
  adhanTime?: string | null;
  iqamaTime?: string | null;
  assignmentSource?: 'manual' | 'default' | null;
};

type SavePayload = {
  mosqueId?: string;
  date?: string;
  mosqueName?: string | null;
  assignments?: Partial<Record<PrayerName, AssignmentValue>>;
};

type StaffRotaRow = {
  mosque_id: string;
  date: string;
  prayer_name: string;
  muezzin_user_id?: string | null;
  staff_user_id?: string | null;
  duty_date?: string | null;
  prayer?: string | null;
  adhan_time?: string | null;
  iqama_time?: string | null;
  notes?: string | null;
  assigned_by?: string | null;
};

function normalizeDateIso(value?: string | null) {
  const raw = (value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function normalizeUserId(value?: string | null) {
  const raw = (value ?? '').trim();
  return raw || null;
}

function normalizeIso(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function parsePayload(
  request: Request
): Promise<
  | { response: Response }
  | {
      mosqueId: string;
      dateIso: string;
      mosqueName: string | null;
      assignments: Partial<Record<PrayerName, AssignmentValue>>;
    }
> {
  let body: SavePayload;
  try {
    body = (await request.json()) as SavePayload;
  } catch {
    return { response: json({ error: 'Invalid JSON body.' }, 400) } as const;
  }

  const mosqueId = (body.mosqueId ?? '').trim();
  const dateIso = normalizeDateIso(body.date);
  const assignments = body.assignments ?? {};

  if (!mosqueId) {
    return { response: json({ error: 'A mosqueId is required.' }, 400) } as const;
  }

  if (!dateIso) {
    return { response: json({ error: 'A valid date is required.' }, 400) } as const;
  }

  return {
    mosqueId,
    dateIso,
    mosqueName: body.mosqueName?.trim() || null,
    assignments,
  } as const;
}

function buildRows(
  mosqueId: string,
  dateIso: string,
  assignments: Partial<Record<PrayerName, AssignmentValue>>,
  assignedByUserId: string
) {
  return PRAYERS.map((prayerName) => {
    const assignment = assignments?.[prayerName];
    const muezzinUserId = normalizeUserId(assignment?.muezzinUserId);
    if (!muezzinUserId || assignment?.assignmentSource === 'default') return null;

    return {
      mosque_id: mosqueId,
      date: dateIso,
      prayer_name: prayerName,
      muezzin_user_id: muezzinUserId,
      staff_user_id: muezzinUserId,
      duty_date: dateIso,
      prayer: prayerName,
      adhan_time: normalizeIso(assignment?.adhanTime ?? null),
      iqama_time: normalizeIso(assignment?.iqamaTime ?? null),
      notes: assignment?.notes ?? null,
      assigned_by: assignedByUserId,
    } satisfies StaffRotaRow;
  }).filter(Boolean) as StaffRotaRow[];
}

async function loadActiveMuezzinUserIds(supabaseAdmin: any, mosqueId: string) {
  let result = await supabaseAdmin
    .from('muezzins')
    .select('user_id, is_active')
    .eq('mosque_id', mosqueId);

  if (result.error?.code === '42703') {
    result = await supabaseAdmin
      .from('muezzins')
      .select('user_id')
      .eq('mosque_id', mosqueId);
  }

  if (result.error && result.error.code !== 'PGRST116') {
    throw result.error;
  }

  return new Set(
    ((result.data ?? []) as { user_id?: string | null; is_active?: boolean | null }[])
      .filter((row) => row.user_id && row.is_active !== false)
      .map((row) => row.user_id as string)
  );
}

function formatNotificationDate(dateIso: string) {
  const parsed = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function buildNotificationRows(args: {
  mosqueId: string;
  mosqueName?: string | null;
  dateIso: string;
  previousRows: StaffRotaRow[];
  nextRows: StaffRotaRow[];
  actorUserId: string;
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
        actor_user_id: args.actorUserId,
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
        actor_user_id: args.actorUserId,
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

  return notifications;
}

async function insertNotifications(
  supabaseAdmin: any,
  args: {
    mosqueId: string;
    mosqueName?: string | null;
    dateIso: string;
    previousRows: StaffRotaRow[];
    nextRows: StaffRotaRow[];
    actorUserId: string;
  }
) {
  const notifications = buildNotificationRows(args);
  if (!notifications.length) return 0;

  const { error } = await supabaseAdmin.from('app_notifications').insert(notifications);
  if (error) {
    console.warn('[staff-rota-save] notification insert failed', error);
    return 0;
  }

  return notifications.length;
}

async function persistRows(supabaseAdmin: any, rows: StaffRotaRow[]) {
  if (!rows.length) return { success: true as const, error: null };

  const fullInsert = await supabaseAdmin.from('staff_rota').insert(rows).select('id');
  if (!fullInsert.error) {
    if ((fullInsert.data ?? []).length === 0) {
      return { success: false as const, error: 'Save failed: no rows persisted.' };
    }
    return { success: true as const, error: null };
  }

  const message = fullInsert.error.message ?? '';
  const retryWithLegacyShape =
    fullInsert.error.code === '42703' ||
    fullInsert.error.code === '23503' ||
    message.toLowerCase().includes('adhan_time') ||
    message.toLowerCase().includes('iqama_time') ||
    message.toLowerCase().includes('assigned_by') ||
    message.toLowerCase().includes('foreign key');

  if (!retryWithLegacyShape) {
    return { success: false as const, error: fullInsert.error.message || 'Unable to save staff rota.' };
  }

  const legacyRows = rows.map((row) => ({
    mosque_id: row.mosque_id,
    date: row.date,
    prayer_name: row.prayer_name,
    muezzin_user_id: row.muezzin_user_id ?? row.staff_user_id ?? null,
    staff_user_id: row.staff_user_id ?? row.muezzin_user_id ?? null,
    duty_date: row.date,
    prayer: row.prayer_name,
    notes: row.notes ?? null,
  }));

  const legacyInsert = await supabaseAdmin.from('staff_rota').insert(legacyRows as any).select('id');
  if (!legacyInsert.error) {
    if ((legacyInsert.data ?? []).length === 0) {
      return { success: false as const, error: 'Legacy save failed: no rows persisted.' };
    }
    return { success: true as const, error: null };
  }

  const retryMessage = legacyInsert.error.message ?? '';
  const retryWithMinimalShape =
    legacyInsert.error.code === '42703' ||
    retryMessage.toLowerCase().includes('staff_user_id') ||
    retryMessage.toLowerCase().includes('duty_date') ||
    retryMessage.toLowerCase().includes('prayer');

  if (!retryWithMinimalShape) {
    return { success: false as const, error: legacyInsert.error.message || 'Unable to save staff rota.' };
  }

  const minimalRows = rows.map((row) => ({
    mosque_id: row.mosque_id,
    date: row.date,
    prayer_name: row.prayer_name,
    muezzin_user_id: row.muezzin_user_id ?? row.staff_user_id ?? null,
    notes: row.notes ?? null,
  }));

  const minimalInsert = await supabaseAdmin.from('staff_rota').insert(minimalRows as any).select('id');
  if (minimalInsert.error) {
    return { success: false as const, error: minimalInsert.error.message || 'Unable to save staff rota.' };
  }

  if ((minimalInsert.data ?? []).length === 0) {
    return { success: false as const, error: 'Minimal save failed: no rows persisted.' };
  }

  return { success: true as const, error: null };
}

async function loadPreviousRows(supabaseAdmin: any, mosqueId: string, dateIso: string) {
  const primary = await supabaseAdmin
    .from('staff_rota')
    .select('mosque_id,date,prayer_name,muezzin_user_id,staff_user_id,notes')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso);

  if (!primary.error || primary.error.code === 'PGRST116') {
    return {
      rows: (primary.data ?? []) as StaffRotaRow[],
      error: null,
    };
  }

  return {
    rows: [] as StaffRotaRow[],
    error: primary.error,
  };
}

export const POST: RequestHandler = async (request) => {
  const auth = await requireAdminAccess(request);
  if ('response' in auth) {
    return auth.response;
  }

  const payload = await parsePayload(request);
  if ('response' in payload) {
    return payload.response;
  }

  if (!hasMosqueAdminAccess(auth.context, payload.mosqueId)) {
    return json({ error: 'You do not have access to this mosque workspace.' }, 403);
  }

  const actorUserId = auth.context.userId;
  const { supabaseAdmin } = auth.context;
  const nextRows = buildRows(payload.mosqueId, payload.dateIso, payload.assignments, actorUserId);

  if (!nextRows.length) {
    return json({ error: 'Choose at least one manual muezzin assignment before saving.' }, 400);
  }

  const activeMuezzinUserIds = await loadActiveMuezzinUserIds(supabaseAdmin, payload.mosqueId);
  const invalidRows = nextRows.filter((row) => {
    const userId = row.muezzin_user_id ?? row.staff_user_id ?? null;
    return !userId || !activeMuezzinUserIds.has(userId);
  });

  if (invalidRows.length) {
    return json({ error: 'One or more selected muezzins are no longer active for this mosque. Refresh the rota and choose again.' }, 400);
  }

  const previousResult = await loadPreviousRows(supabaseAdmin, payload.mosqueId, payload.dateIso);
  if (previousResult.error) {
    return json({ error: previousResult.error.message || 'Unable to inspect the current staff rota.' }, 500);
  }

  const previousRows = previousResult.rows;

  const deleteResult = await supabaseAdmin
    .from('staff_rota')
    .delete()
    .eq('mosque_id', payload.mosqueId)
    .eq('date', payload.dateIso);

  if (deleteResult.error && deleteResult.error.code !== 'PGRST116') {
    return json({ error: deleteResult.error.message || 'Unable to clear the current staff rota.' }, 500);
  }

  const saveResult = await persistRows(supabaseAdmin, nextRows);
  if (!saveResult.success) {
    return json({ error: saveResult.error || 'Unable to save staff rota.' }, 500);
  }

  const notificationCount = await insertNotifications(supabaseAdmin, {
    mosqueId: payload.mosqueId,
    mosqueName: payload.mosqueName,
    dateIso: payload.dateIso,
    previousRows,
    nextRows,
    actorUserId,
  });

  return json({
    success: true,
    notificationCount,
  });
};
