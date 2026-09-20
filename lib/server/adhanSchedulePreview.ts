import { ADHAN_PRAYERS, AdhanAudioAsset, AdhanAudioError, EMPTY_ADHAN_AUDIO_DRAFT, validateAudioDraft } from '../adhanAudio';
import { AdhanSchedulePreview, explicitInstant, mosqueLocalDate, nextCalendarDate, planAdhanDay } from '../adhanDelivery';
import type { AdminAccessContext } from './adminAccess';

const ADHAN_COLUMNS = ADHAN_PRAYERS.map(p => `${p}_adhan_time`).join(',');

/** Reads existing prayer resolution without changing its calculation or storage.
 * This is an admin preview of saved drafts, never a dispatch/activation action. */
export async function loadAdhanSchedulePreview(
  context: AdminAccessContext,
  mosqueId: string,
  expectedSettings: unknown,
  readDaily: (request: Request) => Response | Promise<Response>,
  now = new Date().toISOString()
): Promise<AdhanSchedulePreview> {
  const db = context.supabaseAdmin;
  const [mosqueResult, settingsResult, assetsResult] = await Promise.all([
    db.from('mosques').select('id,status,time_zone,prayers_not_offered').eq('id', mosqueId).maybeSingle(),
    db.from('mosque_adhan_audio_settings').select('draft_mode,default_asset_id,fajr_asset_id,enabled_prayers,revision').eq('mosque_id', mosqueId).maybeSingle(),
    db.from('adhan_audio_assets').select('id,mosque_id,title,reciter,state,duration_sec,created_at')
      .or(`mosque_id.eq.${mosqueId},mosque_id.is.null`).eq('state', 'ready'),
  ]);
  if (mosqueResult.error || settingsResult.error || assetsResult.error) {
    throw new AdhanAudioError('Could not load the saved schedule settings. Try again.', 503);
  }
  const mosque = mosqueResult.data;
  if (!mosque) throw new AdhanAudioError('Mosque not found.', 404);
  const settings = validateAudioDraft(settingsResult.data ?? EMPTY_ADHAN_AUDIO_DRAFT);
  if (JSON.stringify(settings) !== JSON.stringify(validateAudioDraft(expectedSettings))) {
    throw new AdhanAudioError('Save your changes or reload the current settings before previewing the schedule.', 409);
  }
  const timeZone = mosque.time_zone?.trim() ?? '';
  let today: string;
  try { today = mosqueLocalDate(now, timeZone); }
  catch { throw new AdhanAudioError('Set a valid mosque timezone in Mosque Profile before previewing automatic playback.', 409); }
  const slots: AdhanSchedulePreview['slots'] = [];
  for (const date of [today, nextCalendarDate(today)]) {
    const query = new URLSearchParams({ mosqueId, date });
    // The URL supplies query parameters to the in-process existing read handler;
    // it is never fetched over the network or derived from user input.
    const response = await readDaily(new Request(`https://adhan-connect.invalid/api/prayer-times-daily?${query}`));
    if (!response.ok && mosque.status === 'active') throw new AdhanAudioError('Prayer times could not be loaded. Try the schedule preview again later.', 503);
    const payload = response.ok ? await response.json() : { row: null };
    const row = payload?.row ?? {};
    let trustedTimes = [...ADHAN_PRAYERS];
    if (timeZone !== 'Europe/London') {
      // Current legacy/calculated fallbacks assume London. Only explicitly saved
      // canonical instants can qualify outside London until that shared resolver
      // is deliberately extended and tested for all mosque timezones.
      const canonical = await db.from('prayer_times').select(ADHAN_COLUMNS).eq('mosque_id', mosqueId).eq('date', date).maybeSingle<Record<string, string | null>>();
      if (canonical.error) throw new AdhanAudioError('Could not verify the mosque’s saved timetable. Try again.', 503);
      trustedTimes = ADHAN_PRAYERS.filter(prayer => {
        const field = `${prayer}_adhan_time`;
        const saved = explicitInstant(canonical.data?.[field]);
        return saved !== null && saved === explicitInstant(row[field]);
      });
    }
    slots.push(...planAdhanDay({
      mosqueId, localDate: date, timeZone, mosqueActive: mosque.status === 'active',
      notOffered: mosque.prayers_not_offered ?? [], settings, assets: (assetsResult.data ?? []) as AdhanAudioAsset[],
      adhanTimes: Object.fromEntries(ADHAN_PRAYERS.map(p => [p, row[`${p}_adhan_time`]])), trustedTimes,
    }));
  }
  return { automaticPlaybackActive: false, timeZone, generatedAt: now, settingsRevision: settings.revision, slots };
}
