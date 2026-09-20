import { AdhanAudioError, audioUuid } from '../adhanAudio';

export function audioSetupEnabled(env: Record<string, string | undefined>) {
  return env.RECORDED_ADHAN_SETUP_ENABLED === 'true';
}
export function audioSetupMosqueIds(env: Record<string, string | undefined>) {
  return [...new Set((env.RECORDED_ADHAN_SETUP_MOSQUE_IDS ?? '').split(',').map(id => id.trim().toLowerCase()).filter(audioUuid))];
}
export function authorizeAudioMosque(
  env: Record<string, string | undefined>,
  context: { isMainAdmin: boolean; adminMosqueIds: string[] },
  mosqueId: unknown
): asserts mosqueId is string {
  if (!audioUuid(mosqueId)) throw new AdhanAudioError('A valid mosque is required.');
  if (!context.isMainAdmin && !context.adminMosqueIds.includes(mosqueId)) {
    throw new AdhanAudioError('You do not administer this mosque.', 403);
  }
  const allowed = audioSetupMosqueIds(env);
  if (!audioSetupEnabled(env) || !allowed.includes(mosqueId.toLowerCase())) {
    throw new AdhanAudioError('Recording setup is not available for this mosque yet.', 404);
  }
}
export function authorizeAudioAsset(
  asset: { mosque_id: string | null } | null,
  mosqueId: string,
  isMainAdmin: boolean,
  write: boolean
) {
  if (!asset || (asset.mosque_id !== mosqueId && !(asset.mosque_id === null && (!write || isMainAdmin)))) {
    throw new AdhanAudioError('Recording not found.', 404);
  }
}
