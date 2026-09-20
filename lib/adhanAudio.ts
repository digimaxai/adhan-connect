/** Admin preparation only. Nothing in this module schedules listener playback. */
export const ADHAN_AUDIO_MAX_BYTES = 20 * 1024 * 1024;
export const ADHAN_AUDIO_BUCKET = 'adhan-audio';
export const ADHAN_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type AdhanPrayer = typeof ADHAN_PRAYERS[number];
export type AdhanAudioMode = 'live_only' | 'recorded_only' | 'live_with_fallback';
export type AdhanAudioDraft = {
  draft_mode: AdhanAudioMode;
  default_asset_id: string | null;
  fajr_asset_id: string | null;
  enabled_prayers: AdhanPrayer[];
  revision: number;
};
export type AdhanAudioAsset = {
  id: string;
  mosque_id: string | null;
  title: string;
  reciter: string;
  state: 'uploading' | 'ready' | 'archived';
  duration_sec: number | null;
  created_at: string;
};
export type AdhanAudioWorkspace = {
  settings: AdhanAudioDraft;
  assets: AdhanAudioAsset[];
  canManageCatalogue: boolean;
  automaticPlaybackActive: false;
};
export const EMPTY_ADHAN_AUDIO_DRAFT: AdhanAudioDraft = {
  draft_mode: 'live_only', default_asset_id: null, fajr_asset_id: null,
  enabled_prayers: [...ADHAN_PRAYERS], revision: 0,
};

export class AdhanAudioError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function audioUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function validateAudioDraft(value: unknown): AdhanAudioDraft {
  const v = value as Partial<AdhanAudioDraft> | null;
  if (!v || !['live_only', 'recorded_only', 'live_with_fallback'].includes(v.draft_mode ?? '')) {
    throw new AdhanAudioError('Choose a valid broadcast mode.');
  }
  if (!Number.isSafeInteger(v.revision) || v.revision! < 0) throw new AdhanAudioError('Reload the saved settings.');
  if (![v.default_asset_id, v.fajr_asset_id].every(id => id === null || audioUuid(id))) {
    throw new AdhanAudioError('Choose a valid recording.');
  }
  if (!Array.isArray(v.enabled_prayers) || !v.enabled_prayers.length || v.enabled_prayers.length > 5 ||
      new Set(v.enabled_prayers).size !== v.enabled_prayers.length ||
      !v.enabled_prayers.every(prayer => ADHAN_PRAYERS.includes(prayer))) {
    throw new AdhanAudioError('Choose one or more of the five daily prayers.');
  }
  if (v.draft_mode !== 'live_only' && !v.default_asset_id) throw new AdhanAudioError('Choose a default recording first.');
  return {
    draft_mode: v.draft_mode!, default_asset_id: v.default_asset_id!, fajr_asset_id: v.fajr_asset_id!,
    enabled_prayers: ADHAN_PRAYERS.filter(p => v.enabled_prayers!.includes(p)), revision: v.revision!,
  };
}
export function audioFileType(name: unknown): { mime: string; extension: string } {
  const ext = typeof name === 'string' ? name.split('.').pop()?.toLowerCase() : '';
  if (ext === 'mp3') return { mime: 'audio/mpeg', extension: 'mp3' };
  if (ext === 'm4a') return { mime: 'audio/mp4', extension: 'm4a' };
  if (ext === 'wav') return { mime: 'audio/wav', extension: 'wav' };
  throw new AdhanAudioError('Choose an MP3, M4A or WAV file.');
}
export function audioText(value: unknown, label: string, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new AdhanAudioError(`${label} must be between 1 and ${max} characters.`);
  }
  return value.trim();
}
