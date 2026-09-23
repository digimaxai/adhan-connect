import { resolveApiUrl, supportsServerApi } from '../apiBaseUrl';
import { supabase } from '../../supabase';
import { getDailyPrayerTimes } from '../prayerTimesUnified';
import { getPrayerTimesByDate, type PrayerTimesRow } from './prayerTimes';
import { listPrayerScheduleImports, type PrayerScheduleImportRecord } from './prayerScheduleImports';
import { normalizePrayerTimeAdjustments, type PrayerTimeAdjustments } from '../../prayerTimeAdjustments';

export type MosquePrayerSettings = {
  prayerSource: 'aladhan' | 'elm';
  calculationMethod: number;
  school: 0 | 1;
  adjustments: PrayerTimeAdjustments;
};

export type IqamahPrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export type PrayerTimesWorkspacePayload = {
  currentRow: PrayerTimesRow | null;
  autoFilledIqama: IqamahPrayerKey[];
  fallbackRow: PrayerTimesRow | null;
  fallbackSource: 'mosque_prayer_times' | 'staff_rota' | 'auto' | null;
  importHistory: PrayerScheduleImportRecord[];
  prayerSettings: MosquePrayerSettings;
};

const IQAMA_FIELD: Record<IqamahPrayerKey, keyof PrayerTimesRow> = {
  fajr: 'fajr_iqama_time',
  dhuhr: 'dhuhr_iqama_time',
  asr: 'asr_iqama_time',
  maghrib: 'maghrib_iqama_time',
  isha: 'isha_iqama_time',
};

async function loadPrayerTimesWorkspaceFallback(
  mosqueId: string,
  dateIso: string,
  historyLimit: number
): Promise<PrayerTimesWorkspacePayload> {
  const currentRow = await getPrayerTimesByDate(mosqueId, dateIso);
  // getDailyPrayerTimes resolves iqama (schedule -> ELM jamat) for whichever
  // fields are null on the canonical row, independent of whether currentRow
  // already exists — reuse it here rather than re-deriving that resolution.
  const resolvedNormalized = await getDailyPrayerTimes(mosqueId, new Date(dateIso));
  const autoFilledIqama: IqamahPrayerKey[] = [];
  if (currentRow && resolvedNormalized) {
    (Object.keys(IQAMA_FIELD) as IqamahPrayerKey[]).forEach((prayer) => {
      const field = IQAMA_FIELD[prayer];
      if (!currentRow[field] && resolvedNormalized[prayer]?.iqama) {
        (currentRow as any)[field] = resolvedNormalized[prayer].iqama!.toISOString();
        autoFilledIqama.push(prayer);
      }
    });
  }
  const fallbackNormalized = currentRow ? null : resolvedNormalized;
  const fallbackRow =
    currentRow || !fallbackNormalized
      ? null
      : ({
          mosque_id: mosqueId,
          date: dateIso,
          fajr_adhan_time: fallbackNormalized.fajr.adhan?.toISOString() ?? null,
          fajr_iqama_time: fallbackNormalized.fajr.iqama?.toISOString() ?? null,
          dhuhr_adhan_time: fallbackNormalized.dhuhr.adhan?.toISOString() ?? null,
          dhuhr_iqama_time: fallbackNormalized.dhuhr.iqama?.toISOString() ?? null,
          asr_adhan_time: fallbackNormalized.asr.adhan?.toISOString() ?? null,
          asr_iqama_time: fallbackNormalized.asr.iqama?.toISOString() ?? null,
          maghrib_adhan_time: fallbackNormalized.maghrib.adhan?.toISOString() ?? null,
          maghrib_iqama_time: fallbackNormalized.maghrib.iqama?.toISOString() ?? null,
          isha_adhan_time: fallbackNormalized.isha.adhan?.toISOString() ?? null,
          isha_iqama_time: fallbackNormalized.isha.iqama?.toISOString() ?? null,
        } satisfies PrayerTimesRow);
  const importHistory = await listPrayerScheduleImports(mosqueId, historyLimit).catch(() => []);
  const { data: mosque } = await supabase.from('mosques')
    .select('prayer_source, prayer_calculation_method, prayer_school, prayer_time_adjustments')
    .eq('id', mosqueId).maybeSingle();
  return {
    currentRow,
    autoFilledIqama,
    fallbackRow,
    fallbackSource: fallbackRow ? 'mosque_prayer_times' : null,
    importHistory,
    prayerSettings: {
      prayerSource: mosque?.prayer_source === 'elm' ? 'elm' : 'aladhan',
      calculationMethod: mosque?.prayer_calculation_method ?? 3,
      school: mosque?.prayer_school === 1 ? 1 : 0,
      adjustments: normalizePrayerTimeAdjustments(mosque?.prayer_time_adjustments),
    },
  };
}

export async function loadPrayerTimesWorkspace(
  mosqueId: string,
  dateIso: string,
  historyLimit = 6
): Promise<PrayerTimesWorkspacePayload> {
  if (!supportsServerApi()) {
    return loadPrayerTimesWorkspaceFallback(mosqueId, dateIso, historyLimit);
  }

  const endpoint = resolveApiUrl('/api/admin/prayer-times-workspace');
  if (!endpoint) {
    return loadPrayerTimesWorkspaceFallback(mosqueId, dateIso, historyLimit);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Your session has expired. Refresh and sign in again.');
  }

  try {
    const url = new URL(endpoint);
    url.searchParams.set('mosqueId', mosqueId);
    url.searchParams.set('date', dateIso);
    url.searchParams.set('historyLimit', String(historyLimit));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Unable to load prayer times.');
    }

    return {
      currentRow: (payload.currentRow ?? null) as PrayerTimesRow | null,
      autoFilledIqama: (payload.autoFilledIqama ?? []) as IqamahPrayerKey[],
      fallbackRow: (payload.fallbackRow ?? null) as PrayerTimesRow | null,
      fallbackSource: (payload.fallbackSource ?? null) as PrayerTimesWorkspacePayload['fallbackSource'],
      importHistory: (payload.importHistory ?? []) as PrayerScheduleImportRecord[],
      prayerSettings: payload.prayerSettings
        ? {
            prayerSource: payload.prayerSettings.prayerSource === 'elm' ? 'elm' : 'aladhan',
            calculationMethod: payload.prayerSettings.calculationMethod ?? 3,
            school: payload.prayerSettings.school === 1 ? 1 : 0,
            adjustments: normalizePrayerTimeAdjustments(payload.prayerSettings.adjustments),
          }
        : { prayerSource: 'aladhan', calculationMethod: 3, school: 0, adjustments: normalizePrayerTimeAdjustments(null) },
    };
  } catch (error) {
    console.warn('[loadPrayerTimesWorkspace] server fallback', error);
    return loadPrayerTimesWorkspaceFallback(mosqueId, dateIso, historyLimit);
  }
}
