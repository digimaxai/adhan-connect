import {
  ADHAN_PRAYERS, AdhanAudioAsset, AdhanAudioDraft, AdhanAudioMode, AdhanPrayer, audioUuid,
} from './adhanAudio';
import { isValidTimeZone } from './timeZones';

export const ADHAN_FALLBACK_GRACE_MS = 10000;
export const ADHAN_MAX_JOB_LATENESS_MS = 30000;
export const ADHAN_EARLY_LIVE_WINDOW_MS = 180000;

export type AdhanPlanSlot = {
  key: string;
  mosqueId: string;
  localDate: string;
  timeZone: string;
  prayer: AdhanPrayer;
  mode: AdhanAudioMode;
  settingsRevision: number;
  scheduledAt: string | null;
  recordingDueAt: string | null;
  recordingId: string | null;
  recordingTitle: string | null;
  durationSec: number | null;
  status: 'ready' | 'live_only' | 'blocked' | 'not_offered';
  reason: string | null;
};
export type AdhanSchedulePreview = {
  automaticPlaybackActive: false;
  timeZone: string;
  settingsRevision: number;
  generatedAt: string;
  slots: AdhanPlanSlot[];
};

export function validCalendarDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) &&
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
}
export function mosqueLocalDate(instant: string | number, timeZone: string) {
  if (!isValidTimeZone(timeZone)) throw new Error('Set a valid mosque timezone in Mosque Profile.');
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid clock time.');
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return ['year', 'month', 'day'].map(key => parts.find(p => p.type === key)!.value).join('-');
}
export function nextCalendarDate(date: string) {
  if (!validCalendarDate(date)) throw new Error('Invalid timetable date.');
  return new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
}
export function explicitInstant(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value) ||
      !validCalendarDate(value.slice(0, 10))) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

/** Pure planning: no timers, pushes, writes or device-timezone assumptions. */
export function planAdhanDay(input: {
  mosqueId: string; localDate: string; timeZone: string; mosqueActive: boolean;
  notOffered: string[]; settings: AdhanAudioDraft; assets: AdhanAudioAsset[];
  adhanTimes: Partial<Record<AdhanPrayer, unknown>>;
  // Per-prayer evidence: the existing resolver may fill missing canonical times
  // from its London-only clock conversion. Never enable such fallbacks worldwide.
  trustedTimes: AdhanPrayer[];
}): AdhanPlanSlot[] {
  if (!audioUuid(input.mosqueId) || !validCalendarDate(input.localDate)) throw new Error('Invalid mosque or timetable date.');
  if (!isValidTimeZone(input.timeZone)) throw new Error('Set a valid mosque timezone in Mosque Profile.');
  return ADHAN_PRAYERS.map(prayer => {
    const mode = input.settings.enabled_prayers.includes(prayer) ? input.settings.draft_mode : 'live_only';
    const assetId = prayer === 'fajr' && input.settings.fajr_asset_id ? input.settings.fajr_asset_id : input.settings.default_asset_id;
    const asset = input.assets.find(a => a.id === assetId && a.state === 'ready' && (a.mosque_id === null || a.mosque_id === input.mosqueId));
    const instant = explicitInstant(input.adhanTimes[prayer]);
    const slot: AdhanPlanSlot = {
      key: `${input.mosqueId.toLowerCase()}:${input.localDate}:${prayer}`,
      mosqueId: input.mosqueId, localDate: input.localDate, prayer, timeZone: input.timeZone,
      mode, settingsRevision: input.settings.revision, scheduledAt: instant,
      recordingDueAt: instant && mode !== 'live_only'
        ? new Date(Date.parse(instant) + (mode === 'live_with_fallback' ? ADHAN_FALLBACK_GRACE_MS : 0)).toISOString() : null,
      recordingId: asset?.id ?? null, recordingTitle: asset?.title ?? null,
      durationSec: asset?.duration_sec ?? null, status: 'ready', reason: null,
    };
    if (input.notOffered.includes(prayer)) {
      return { ...slot, status: 'not_offered', reason: 'This prayer is marked as not offered by the mosque.' };
    }
    if (!input.mosqueActive) return { ...slot, status: 'blocked', reason: 'The mosque must be active before automatic broadcasts can be enabled.' };
    if (mode === 'live_only') return { ...slot, status: 'live_only' };
    if (!instant || mosqueLocalDate(instant, input.timeZone) !== input.localDate || !input.trustedTimes.includes(prayer)) {
      return { ...slot, status: 'blocked', reason: 'Review and save this prayer’s time in Prayer Times before enabling automatic playback.' };
    }
    if (!asset || !asset.duration_sec || asset.duration_sec < 1 || asset.duration_sec > 600) {
      return { ...slot, status: 'blocked', reason: 'Choose a verified recording for this prayer.' };
    }
    return slot;
  });
}

export type AdhanDeliveryDecision =
  | { source: 'wait'; dueAt: string }
  | { source: 'none'; reason: string }
  | { source: 'live'; occurrenceKey: string; streamId: string; startedAt: string }
  | { source: 'recording'; occurrenceKey: string; recordingId: string; startedAt: string; endsAt: string };

/** Decision contract for the future transactional worker. A stream's is_live
 * flag is deliberately insufficient: readiness must be verified server-side. */
export function decideAdhanDelivery(input: {
  slot: AdhanPlanSlot;
  now: string;
  previousWinner?: Extract<AdhanDeliveryDecision, { source: 'live' | 'recording' }> | null;
  confirmedLive?: { occurrenceKey: string; streamId: string; readyAt: string } | null;
}): AdhanDeliveryDecision {
  // A retry, disconnect or delayed webhook never changes an existing winner.
  if (input.previousWinner?.occurrenceKey === input.slot.key) return input.previousWinner;
  const { slot } = input;
  if (slot.status !== 'ready' || slot.mode === 'live_only') return { source: 'none', reason: slot.reason ?? 'Live-only prayer.' };
  const now = explicitInstant(input.now);
  if (!now || !slot.scheduledAt || !slot.recordingDueAt || !slot.recordingId || !slot.durationSec) {
    return { source: 'none', reason: 'Incomplete delivery plan.' };
  }
  const clock = Date.parse(now), scheduled = Date.parse(slot.scheduledAt), due = Date.parse(slot.recordingDueAt);
  const live = input.confirmedLive;
  const liveAt = explicitInstant(live?.readyAt);
  if (slot.mode === 'live_with_fallback' && live && liveAt && audioUuid(live.streamId) && live.occurrenceKey === slot.key &&
      Date.parse(liveAt) >= scheduled - ADHAN_EARLY_LIVE_WINDOW_MS && Date.parse(liveAt) < due && Date.parse(liveAt) <= clock) {
    return { source: 'live', occurrenceKey: slot.key, streamId: live.streamId, startedAt: liveAt };
  }
  if (clock < due) return { source: 'wait', dueAt: slot.recordingDueAt };
  if (clock >= due + ADHAN_MAX_JOB_LATENESS_MS) return { source: 'none', reason: 'The automatic start window has expired.' };
  return { source: 'recording', occurrenceKey: slot.key, recordingId: slot.recordingId, startedAt: now,
    endsAt: new Date(clock + slot.durationSec * 1000).toISOString() };
}
