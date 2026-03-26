import { supabase } from '../../supabase';
import { bulkUpsertPrayerTimes, PrayerTimesRow, PrayerTimesWriteMeta } from './prayerTimes';

export type PrayerScheduleImportMode =
  | 'smart_auto'
  | 'explicit_iqama'
  | 'adhan_only'
  | 'adhan_plus_fixed_offset';

export type PrayerScheduleImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningCount: number;
  errorCount: number;
  startDate: string | null;
  endDate: string | null;
};

export type PrayerScheduleImportRecord = {
  id: string;
  mosque_id: string;
  source_type: 'upload' | 'api' | 'manual' | 'rollback';
  source_label?: string | null;
  import_mode?: PrayerScheduleImportMode | null;
  fixed_iqama_offset_minutes?: number | null;
  status: 'pending' | 'published' | 'failed' | 'rolled_back';
  coverage_start_date?: string | null;
  coverage_end_date?: string | null;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  warning_count: number;
  error_count: number;
  initiated_by?: string | null;
  rolled_back_from_import_id?: string | null;
  metadata?: Record<string, unknown> | null;
  published_at?: string | null;
  rolled_back_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PrayerScheduleImportRowSnapshot = {
  import_id: string;
  mosque_id: string;
  date: string;
  action: 'insert' | 'update' | 'replace' | 'rollback' | 'delete';
  previous_row?: PrayerTimesSnapshot | null;
  published_row?: PrayerTimesSnapshot | null;
};

type PrayerTimesSnapshot = {
  id?: string | null;
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
  created_by?: string | null;
  updated_by?: string | null;
  import_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PrayerScheduleImportWriteRow = {
  date: string;
  data: Partial<PrayerTimesRow>;
};

type PrayerScheduleImportCreateParams = {
  mosqueId: string;
  sourceType?: PrayerScheduleImportRecord['source_type'];
  sourceLabel?: string | null;
  importMode?: PrayerScheduleImportMode | null;
  fixedIqamaOffsetMinutes?: number | null;
  summary: PrayerScheduleImportSummary;
  initiatedBy?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function listPrayerScheduleImports(mosqueId: string, limit = 8) {
  const { data, error } = await supabase
    .from('prayer_schedule_imports')
    .select('*')
    .eq('mosque_id', mosqueId)
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as PrayerScheduleImportRecord[];
}

export async function publishPrayerScheduleImportAudit(params: {
  mosqueId: string;
  rows: PrayerScheduleImportWriteRow[];
  summary: PrayerScheduleImportSummary;
  sourceLabel?: string | null;
  sourceType?: PrayerScheduleImportRecord['source_type'];
  importMode?: PrayerScheduleImportMode | null;
  fixedIqamaOffsetMinutes?: number | null;
  initiatedBy?: string | null;
  metadata?: Record<string, unknown> | null;
  meta?: PrayerTimesWriteMeta;
}) {
  await assertCurrentUserIsMainAdmin();

  if (!params.rows.length) {
    throw new Error('No valid timetable rows are available to publish.');
  }

  const dates = uniqueDates(params.rows.map((row) => row.date));
  const existingRows = await getPrayerTimesRowsByDate(params.mosqueId, dates);
  const existingByDate = new Map(existingRows.map((row) => [normalizeDateKey(row.date), row]));
  const impactSummary = {
    existingDates: existingByDate.size,
    updates: dates.filter((date) => existingByDate.has(date)).length,
    inserts: dates.filter((date) => !existingByDate.has(date)).length,
  };

  const createdImport = await createPrayerScheduleImportRecord({
    mosqueId: params.mosqueId,
    sourceType: params.sourceType,
    sourceLabel: params.sourceLabel,
    importMode: params.importMode,
    fixedIqamaOffsetMinutes: params.fixedIqamaOffsetMinutes,
    summary: params.summary,
    initiatedBy: params.initiatedBy,
    metadata: params.metadata,
  });

  if (!createdImport) throw new Error('Unable to create a prayer schedule import record.');

  try {
    const publishedRows = await bulkUpsertPrayerTimes(
      params.mosqueId,
      params.rows,
      {
        sourceType: params.meta?.sourceType ?? 'upload',
        generatedMethod: params.meta?.generatedMethod ?? null,
        overridesExist: params.meta?.overridesExist ?? true,
        createdBy: params.meta?.createdBy ?? params.initiatedBy ?? null,
        updatedBy: params.meta?.updatedBy ?? params.initiatedBy ?? null,
        importId: createdImport.id,
      }
    );

    const publishedByDate = new Map(
      publishedRows.map((row) => [normalizeDateKey(row.date), row as PrayerTimesRow])
    );

    await insertPrayerScheduleImportSnapshots(
      params.mosqueId,
      createdImport.id,
      dates.map((date) => ({
        import_id: createdImport.id,
        mosque_id: params.mosqueId,
        date,
        action: existingByDate.get(date) ? 'update' : 'insert',
        previous_row: sanitizePrayerTimesForSnapshot(existingByDate.get(date) ?? null),
        published_row: sanitizePrayerTimesForSnapshot(publishedByDate.get(date) ?? null),
      }))
    );

    const updatedImport = await updatePrayerScheduleImport(createdImport.id, {
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return {
      importRecord: updatedImport,
      rows: publishedRows as PrayerTimesRow[],
      impactSummary,
    };
  } catch (error: any) {
    await markPrayerScheduleImportFailed(createdImport.id, error?.message ?? 'Unknown publish failure.');
    throw error;
  }
}

async function createPrayerScheduleImportRecord(params: PrayerScheduleImportCreateParams) {
  const attemptCreate = async (
    importMode: PrayerScheduleImportMode | null | undefined,
    metadata: Record<string, unknown>
  ) =>
    supabase
      .from('prayer_schedule_imports')
      .insert({
        mosque_id: params.mosqueId,
        source_type: params.sourceType ?? 'upload',
        source_label: params.sourceLabel ?? null,
        import_mode: importMode ?? null,
        fixed_iqama_offset_minutes: params.fixedIqamaOffsetMinutes ?? null,
        status: 'pending',
        coverage_start_date: params.summary.startDate,
        coverage_end_date: params.summary.endDate,
        total_rows: params.summary.totalRows,
        valid_rows: params.summary.validRows,
        invalid_rows: params.summary.invalidRows,
        warning_count: params.summary.warningCount,
        error_count: params.summary.errorCount,
        initiated_by: params.initiatedBy ?? null,
        metadata,
      })
      .select('*')
      .maybeSingle<PrayerScheduleImportRecord>();

  const baseMetadata = params.metadata ?? {};
  const primaryAttempt = await attemptCreate(params.importMode, baseMetadata);
  if (!primaryAttempt.error) {
    return primaryAttempt.data ?? null;
  }

  if (!shouldRetryWithoutImportMode(primaryAttempt.error, params.importMode)) {
    throw primaryAttempt.error;
  }

  const compatibilityMetadata: Record<string, unknown> = {
    ...baseMetadata,
    import_mode_requested: params.importMode,
    import_mode_storage: 'legacy_constraint_fallback',
  };
  const fallbackAttempt = await attemptCreate(null, compatibilityMetadata);
  if (fallbackAttempt.error) throw fallbackAttempt.error;
  return fallbackAttempt.data ?? null;
}

function shouldRetryWithoutImportMode(error: any, importMode?: PrayerScheduleImportMode | null) {
  if (importMode !== 'smart_auto') return false;

  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  return (
    message.includes('prayer_schedule_imports_import_mode_check') ||
    message.includes('import_mode_check')
  );
}

export async function rollbackPrayerScheduleImport(params: {
  importId: string;
  currentUserId?: string | null;
}) {
  await assertCurrentUserIsMainAdmin();

  const originalImport = await getPrayerScheduleImportById(params.importId);

  if (originalImport.status !== 'published') {
    throw new Error('Only published timetable imports can be rolled back.');
  }

  const snapshotRows = await getPrayerScheduleImportSnapshots(params.importId);
  if (!snapshotRows.length) {
    throw new Error('This import has no stored snapshots to roll back.');
  }

  const dates = uniqueDates(snapshotRows.map((row) => row.date));
  const currentRows = await getPrayerTimesRowsByDate(originalImport.mosque_id, dates);
  const currentByDate = new Map(currentRows.map((row) => [normalizeDateKey(row.date), row]));

  const { data: createdRollback, error: createError } = await supabase
    .from('prayer_schedule_imports')
    .insert({
      mosque_id: originalImport.mosque_id,
      source_type: 'rollback',
      source_label: originalImport.source_label
        ? `Rollback: ${originalImport.source_label}`
        : `Rollback of import ${originalImport.id}`,
      import_mode: originalImport.import_mode ?? null,
      fixed_iqama_offset_minutes: originalImport.fixed_iqama_offset_minutes ?? null,
      status: 'pending',
      coverage_start_date: originalImport.coverage_start_date ?? null,
      coverage_end_date: originalImport.coverage_end_date ?? null,
      total_rows: snapshotRows.length,
      valid_rows: snapshotRows.length,
      invalid_rows: 0,
      warning_count: 0,
      error_count: 0,
      initiated_by: params.currentUserId ?? null,
      rolled_back_from_import_id: originalImport.id,
      metadata: {
        rollback_of_import_id: originalImport.id,
      },
    })
    .select('*')
    .maybeSingle<PrayerScheduleImportRecord>();

  if (createError) throw createError;
  if (!createdRollback) throw new Error('Unable to create a rollback import record.');

  try {
    const restoreRows = snapshotRows
      .filter((row) => row.previous_row)
      .map((row) => ({
        date: row.date,
        data: toPrayerTimesRestoreData(row.previous_row as PrayerTimesRow),
      }));
    const deleteDates = snapshotRows
      .filter((row) => !row.previous_row)
      .map((row) => row.date);

    if (deleteDates.length) {
      const { error: deleteError } = await supabase
        .from('prayer_times')
        .delete()
        .eq('mosque_id', originalImport.mosque_id)
        .in('date', deleteDates);

      if (deleteError) throw deleteError;
    }

    const restoredRows = restoreRows.length
      ? await bulkUpsertPrayerTimes(originalImport.mosque_id, restoreRows, {
          updatedBy: params.currentUserId ?? null,
          importId: createdRollback.id,
        })
      : [];

    const restoredByDate = new Map(
      (restoredRows as PrayerTimesRow[]).map((row) => [normalizeDateKey(row.date), row])
    );

    await insertPrayerScheduleImportSnapshots(
      originalImport.mosque_id,
      createdRollback.id,
      dates.map((date) => ({
        import_id: createdRollback.id,
        mosque_id: originalImport.mosque_id,
        date,
        action: restoredByDate.get(date) ? 'rollback' : 'delete',
        previous_row: sanitizePrayerTimesForSnapshot(currentByDate.get(date) ?? null),
        published_row: sanitizePrayerTimesForSnapshot(restoredByDate.get(date) ?? null),
      }))
    );

    await updatePrayerScheduleImport(originalImport.id, {
      status: 'rolled_back',
      rolled_back_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const updatedRollback = await updatePrayerScheduleImport(createdRollback.id, {
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return {
      importRecord: updatedRollback,
      restoredRows: restoredRows as PrayerTimesRow[],
      deletedDates: deleteDates,
    };
  } catch (error: any) {
    await markPrayerScheduleImportFailed(createdRollback.id, error?.message ?? 'Unknown rollback failure.');
    throw error;
  }
}

async function getPrayerScheduleImportById(importId: string) {
  const { data, error } = await supabase
    .from('prayer_schedule_imports')
    .select('*')
    .eq('id', importId)
    .maybeSingle<PrayerScheduleImportRecord>();

  if (error) throw error;
  if (!data) throw new Error('Prayer schedule import not found.');
  return data;
}

async function getPrayerScheduleImportSnapshots(importId: string) {
  const { data, error } = await supabase
    .from('prayer_schedule_import_rows')
    .select('*')
    .eq('import_id', importId)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PrayerScheduleImportRowSnapshot[];
}

async function getPrayerTimesRowsByDate(mosqueId: string, dates: string[]) {
  if (!dates.length) return [];

  const { data, error } = await supabase
    .from('prayer_times')
    .select('*')
    .eq('mosque_id', mosqueId)
    .in('date', dates)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  const unique = new Map<string, PrayerTimesRow>();
  for (const row of (data ?? []) as PrayerTimesRow[]) {
    const dateKey = normalizeDateKey(row.date);
    if (!dateKey || unique.has(dateKey)) continue;
    unique.set(dateKey, row);
  }

  return Array.from(unique.values());
}

async function insertPrayerScheduleImportSnapshots(
  mosqueId: string,
  importId: string,
  rows: PrayerScheduleImportRowSnapshot[]
) {
  if (!rows.length) return;

  const payload = rows.map((row) => ({
    import_id: importId,
    mosque_id: mosqueId,
    date: row.date,
    action: row.action,
    previous_row: row.previous_row ?? null,
    published_row: row.published_row ?? null,
  }));

  const { error } = await supabase.from('prayer_schedule_import_rows').insert(payload);
  if (error) throw error;
}

async function updatePrayerScheduleImport(
  importId: string,
  patch: Partial<PrayerScheduleImportRecord>
) {
  const { data, error } = await supabase
    .from('prayer_schedule_imports')
    .update(patch)
    .eq('id', importId)
    .select('*')
    .maybeSingle<PrayerScheduleImportRecord>();

  if (error) throw error;
  if (!data) throw new Error('Unable to update prayer schedule import.');
  return data;
}

async function markPrayerScheduleImportFailed(importId: string, message: string) {
  const current = await getPrayerScheduleImportById(importId);
  const metadata = {
    ...(current.metadata ?? {}),
    failure_message: message,
  };

  await updatePrayerScheduleImport(importId, {
    status: 'failed',
    metadata,
    updated_at: new Date().toISOString(),
  });
}

function sanitizePrayerTimesForSnapshot(row: PrayerTimesRow | null) {
  if (!row) return null;

  return {
    id: row.id ?? null,
    mosque_id: row.mosque_id,
    date: row.date,
    fajr_adhan_time: row.fajr_adhan_time ?? null,
    fajr_iqama_time: row.fajr_iqama_time ?? null,
    dhuhr_adhan_time: row.dhuhr_adhan_time ?? null,
    dhuhr_iqama_time: row.dhuhr_iqama_time ?? null,
    asr_adhan_time: row.asr_adhan_time ?? null,
    asr_iqama_time: row.asr_iqama_time ?? null,
    maghrib_adhan_time: row.maghrib_adhan_time ?? null,
    maghrib_iqama_time: row.maghrib_iqama_time ?? null,
    isha_adhan_time: row.isha_adhan_time ?? null,
    isha_iqama_time: row.isha_iqama_time ?? null,
    source_type: row.source_type ?? null,
    generated_method: row.generated_method ?? null,
    overrides_exist: row.overrides_exist ?? null,
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
    import_id: row.import_id ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function toPrayerTimesRestoreData(row: PrayerTimesRow) {
  return {
    fajr_adhan_time: row.fajr_adhan_time ?? null,
    fajr_iqama_time: row.fajr_iqama_time ?? null,
    dhuhr_adhan_time: row.dhuhr_adhan_time ?? null,
    dhuhr_iqama_time: row.dhuhr_iqama_time ?? null,
    asr_adhan_time: row.asr_adhan_time ?? null,
    asr_iqama_time: row.asr_iqama_time ?? null,
    maghrib_adhan_time: row.maghrib_adhan_time ?? null,
    maghrib_iqama_time: row.maghrib_iqama_time ?? null,
    isha_adhan_time: row.isha_adhan_time ?? null,
    isha_iqama_time: row.isha_iqama_time ?? null,
    source_type: row.source_type ?? 'manual',
    generated_method: row.generated_method ?? null,
    overrides_exist: row.overrides_exist ?? true,
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
  } satisfies Partial<PrayerTimesRow>;
}

function uniqueDates(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeDateKey(value)).filter(Boolean))) as string[];
}

function normalizeDateKey(value: string | null | undefined) {
  if (!value) return '';
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

async function assertCurrentUserIsMainAdmin() {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user?.id) {
    throw new Error(authError?.message ?? 'You must be signed in as a main admin to manage timetable imports.');
  }

  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle<{ role?: string | null }>();

  if (userError) throw userError;

  if (userRow?.role !== 'main_admin') {
    throw new Error('Only Main Admin can publish or roll back timetable imports.');
  }
}
