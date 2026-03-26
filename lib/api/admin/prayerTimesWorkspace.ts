import { resolveApiUrl, supportsServerApi } from '../apiBaseUrl';
import { supabase } from '../../supabase';
import { getDailyPrayerTimes } from '../prayerTimesUnified';
import { getPrayerTimesByDate, type PrayerTimesRow } from './prayerTimes';
import { listPrayerScheduleImports, type PrayerScheduleImportRecord } from './prayerScheduleImports';

export type PrayerTimesWorkspacePayload = {
  currentRow: PrayerTimesRow | null;
  fallbackRow: PrayerTimesRow | null;
  fallbackSource: 'mosque_prayer_times' | 'staff_rota' | null;
  importHistory: PrayerScheduleImportRecord[];
};

async function loadPrayerTimesWorkspaceFallback(
  mosqueId: string,
  dateIso: string,
  historyLimit: number
): Promise<PrayerTimesWorkspacePayload> {
  const currentRow = await getPrayerTimesByDate(mosqueId, dateIso);
  const fallbackNormalized = currentRow ? null : await getDailyPrayerTimes(mosqueId, new Date(dateIso));
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
  return {
    currentRow,
    fallbackRow,
    fallbackSource: fallbackRow ? 'mosque_prayer_times' : null,
    importHistory,
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
      fallbackRow: (payload.fallbackRow ?? null) as PrayerTimesRow | null,
      fallbackSource: (payload.fallbackSource ?? null) as PrayerTimesWorkspacePayload['fallbackSource'],
      importHistory: (payload.importHistory ?? []) as PrayerScheduleImportRecord[],
    };
  } catch (error) {
    console.warn('[loadPrayerTimesWorkspace] server fallback', error);
    return loadPrayerTimesWorkspaceFallback(mosqueId, dateIso, historyLimit);
  }
}
