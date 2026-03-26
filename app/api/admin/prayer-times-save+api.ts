import type { RequestHandler } from 'expo-router/server';
import { hasMosqueAdminAccess, json, requireAdminAccess } from '../../../lib/server/adminAccess';

type PrayerTimesRow = {
  id?: string;
  mosque_id: string;
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
  source_type?: string | null;
  generated_method?: string | null;
  overrides_exist?: boolean | null;
  import_id?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PrayerTimesWriteMeta = {
  sourceType?: 'manual' | 'auto' | 'upload' | null;
  generatedMethod?: string | null;
  overridesExist?: boolean | null;
  importId?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
};

type SavePayload = {
  mosqueId?: string;
  date?: string;
  data?: Partial<PrayerTimesRow>;
  meta?: PrayerTimesWriteMeta;
};

const PRAYER_TIME_FIELDS: (keyof PrayerTimesRow)[] = [
  'fajr_adhan_time',
  'fajr_iqama_time',
  'dhuhr_adhan_time',
  'dhuhr_iqama_time',
  'asr_adhan_time',
  'asr_iqama_time',
  'maghrib_adhan_time',
  'maghrib_iqama_time',
  'isha_adhan_time',
  'isha_iqama_time',
];

function normalizeDateIso(value?: string | null) {
  const raw = (value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function normalizeIso(value: unknown) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeUserId(value?: string | null) {
  const raw = (value ?? '').trim();
  return raw || null;
}

function buildPrayerTimesPayload(args: {
  mosqueId: string;
  dateIso: string;
  data: Partial<PrayerTimesRow>;
  meta?: PrayerTimesWriteMeta;
  existingRow?: PrayerTimesRow | null;
  actorUserId: string;
}) {
  const { mosqueId, dateIso, data, meta, existingRow, actorUserId } = args;
  const payload: Partial<PrayerTimesRow> & { mosque_id: string; date: string } = {
    ...(existingRow ?? {}),
    mosque_id: mosqueId,
    date: dateIso,
    source_type: meta?.sourceType ?? data.source_type ?? existingRow?.source_type ?? 'manual',
    generated_method:
      meta?.generatedMethod ?? data.generated_method ?? existingRow?.generated_method ?? null,
    overrides_exist:
      meta?.overridesExist ?? data.overrides_exist ?? existingRow?.overrides_exist ?? true,
    import_id: meta?.importId ?? data.import_id ?? existingRow?.import_id ?? null,
    created_by:
      existingRow?.created_by ??
      normalizeUserId(meta?.createdBy) ??
      normalizeUserId(data.created_by) ??
      actorUserId,
    updated_by:
      normalizeUserId(meta?.updatedBy) ??
      normalizeUserId(data.updated_by) ??
      actorUserId,
  };

  for (const field of PRAYER_TIME_FIELDS) {
    if (field in data) {
      (payload as Record<string, string | null | boolean | undefined>)[field] = normalizeIso(
        data[field] ?? null
      );
    }
  }

  return payload;
}

async function persistPrayerTimesRow(
  supabaseAdmin: any,
  payload: Partial<PrayerTimesRow> & { mosque_id: string; date: string }
) {
  const attempt = async (useConflict: boolean) =>
    supabaseAdmin
      .from('prayer_times')
      .upsert(payload, useConflict ? { onConflict: 'mosque_id,date' } : undefined)
      .select('*')
      .maybeSingle();

  const firstAttempt = await attempt(true);
  if (!firstAttempt.error) {
    return firstAttempt.data as PrayerTimesRow | null;
  }

  const message = (firstAttempt.error.message ?? '').toLowerCase();
  const conflictMissing =
    message.includes('no unique or exclusion constraint') ||
    message.includes('on conflict specification');

  if (!conflictMissing) {
    throw new Error(firstAttempt.error.message || 'Unable to save prayer times.');
  }

  const deleteResult = await supabaseAdmin
    .from('prayer_times')
    .delete()
    .eq('mosque_id', payload.mosque_id)
    .eq('date', payload.date);

  if (deleteResult.error && deleteResult.error.code !== 'PGRST116') {
    throw new Error(deleteResult.error.message || 'Unable to replace the existing prayer-times row.');
  }

  const fallbackAttempt = await attempt(false);
  if (fallbackAttempt.error) {
    throw new Error(fallbackAttempt.error.message || 'Unable to save prayer times.');
  }

  return fallbackAttempt.data as PrayerTimesRow | null;
}

export const POST: RequestHandler = async (request) => {
  const auth = await requireAdminAccess(request);
  if ('response' in auth) {
    return auth.response;
  }

  let body: SavePayload;
  try {
    body = (await request.json()) as SavePayload;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const mosqueId = (body.mosqueId ?? '').trim();
  const dateIso = normalizeDateIso(body.date);
  const rawData = body.data ?? {};

  if (!mosqueId) {
    return json({ error: 'A mosqueId is required.' }, 400);
  }

  if (!dateIso) {
    return json({ error: 'A valid date is required.' }, 400);
  }

  if (!hasMosqueAdminAccess(auth.context, mosqueId)) {
    return json({ error: 'You do not have access to this mosque workspace.' }, 403);
  }

  const { supabaseAdmin, userId } = auth.context;

  const existingResult = await supabaseAdmin
    .from('prayer_times')
    .select('*')
    .eq('mosque_id', mosqueId)
    .eq('date', dateIso)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingResult.error && existingResult.error.code !== 'PGRST116') {
    return json({ error: existingResult.error.message || 'Unable to inspect the current prayer times.' }, 500);
  }

  try {
    const row = await persistPrayerTimesRow(
      supabaseAdmin,
      buildPrayerTimesPayload({
        mosqueId,
        dateIso,
        data: rawData,
        meta: body.meta,
        existingRow: (existingResult.data ?? null) as PrayerTimesRow | null,
        actorUserId: userId,
      })
    );

    return json({ row });
  } catch (error: any) {
    return json({ error: error?.message ?? 'Unable to save prayer times.' }, 500);
  }
};
