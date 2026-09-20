import { ADHAN_AUDIO_MAX_BYTES, AdhanAudioError, audioFileType } from '../../adhanAudio';
import { resolveApiUrls } from '../apiBaseUrl';

async function boundedFetch<T>(url: string, init: RequestInit, consume: (response: Response) => Promise<T>, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await consume(await fetch(url, { ...init, signal: controller.signal }));
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The request timed out. Reload to check whether it completed.');
    throw error;
  } finally { clearTimeout(timer); }
}

export async function adhanAudioRequest<T>(token: string, mosqueId: string, body?: unknown): Promise<T> {
  const url = resolveApiUrls(`/api/admin/adhan-audio?mosqueId=${encodeURIComponent(mosqueId)}`)[0];
  if (!url) throw new Error('The admin server is unavailable.');
  return boundedFetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, async response => {
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new AdhanAudioError(result?.error ?? 'Recording setup is unavailable on this server.', response.status);
    }
    if (!result) throw new Error('The admin server returned an invalid response.');
    return result as T;
  });
}

export async function uploadAdhanAudio(input: {
  token: string; mosqueId: string; uri: string; fileName: string; sizeBytes: number;
  title: string; reciter: string; rightsNote: string; rightsConfirmed: boolean; scope: 'mosque' | 'catalogue';
}) {
  audioFileType(input.fileName);
  if (input.sizeBytes <= 0 || input.sizeBytes > ADHAN_AUDIO_MAX_BYTES) throw new Error('Choose a recording up to 20 MB.');
  const bytes = await boundedFetch(input.uri, {}, file => file.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > ADHAN_AUDIO_MAX_BYTES) throw new Error('Choose a recording up to 20 MB.');
  const reservation = await adhanAudioRequest<{ assetId: string; uploadUrl: string; mime: string }>(input.token, input.mosqueId, {
    action: 'begin_upload', fileName: input.fileName, sizeBytes: bytes.byteLength,
    title: input.title, reciter: input.reciter, rightsNote: input.rightsNote,
    rightsConfirmed: input.rightsConfirmed, scope: input.scope,
  });
  // Signed URL is issued by the authenticated server for one immutable object.
  const uploaded = await boundedFetch(reservation.uploadUrl, {
    method: 'PUT', body: bytes,
    headers: { 'Content-Type': reservation.mime, 'cache-control': 'max-age=0', 'x-upsert': 'false' },
  }, async response => response.ok, 120000);
  if (!uploaded) throw new Error('Upload failed. Reload to verify or archive the unfinished recording, then retry.');
  await adhanAudioRequest(input.token, input.mosqueId, { action: 'complete_upload', assetId: reservation.assetId });
}
