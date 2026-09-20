import { parseBuffer } from 'music-metadata';
import { ADHAN_AUDIO_MAX_BYTES, AdhanAudioError } from '../adhanAudio';

/** Parse actual file bytes, never the client duration or Content-Type header. */
export async function validateAdhanAudio(bytes: Uint8Array, mime: string, expectedSize: number) {
  if (!bytes.length || bytes.length > ADHAN_AUDIO_MAX_BYTES || bytes.length !== expectedSize) {
    throw new AdhanAudioError('The uploaded file size is invalid. Choose a file up to 20 MB.');
  }
  try {
    const { format } = await parseBuffer(bytes, undefined, { duration: true, skipCovers: true });
    const audioTracks = format.trackInfo?.filter(track => track.type === 2) ?? [];
    const hasVideo = format.hasVideo || format.trackInfo?.some(track => track.type === 1);
    const allowed = (mime === 'audio/mpeg' && format.container === 'MPEG' && /^MPEG (1|2|2\.5) Layer 3$/.test(format.codec ?? '')) ||
      (mime === 'audio/wav' && format.container === 'WAVE' && format.codec?.startsWith('PCM')) ||
      (mime === 'audio/mp4' && format.container?.split('/').some(brand => ['M4A', 'isom', 'iso2', 'mp41', 'mp42'].includes(brand)) && format.codec === 'MPEG-4/AAC');
    if (!allowed || hasVideo || audioTracks.length > 1 || !format.sampleRate || !format.numberOfChannels ||
        format.numberOfChannels > 2 || !Number.isFinite(format.duration) || format.duration! < 1 || format.duration! > 600) {
      throw new Error('Unsupported recording');
    }
    return { duration_sec: Math.ceil(format.duration!) };
  } catch {
    throw new AdhanAudioError('Use a valid mono or stereo MP3, AAC M4A or PCM WAV recording lasting 1 second to 10 minutes.');
  }
}
