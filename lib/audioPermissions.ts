import { Audio } from 'expo-av';
import { Platform } from 'react-native';

/**
 * Initialize audio settings for the app
 * Should be called once at app startup
 */
export async function initializeAudio(): Promise<boolean> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DUCK_OTHERS,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
      shouldDuckAndroid: true,
    });
    return true;
  } catch (error) {
    console.error('Failed to initialize audio mode:', error);
    return false;
  }
}

/**
 * Request microphone permission (for recording/live streaming)
 * Returns true if granted, false otherwise
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    // Web doesn't need permission request in the same way
    return true;
  }

  try {
    const permission = await Audio.requestPermissionsAsync();
    return permission.status === 'granted';
  } catch (error) {
    console.error('Failed to request microphone permission:', error);
    return false;
  }
}

/**
 * Check if microphone permission is granted
 */
export async function hasMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }

  try {
    const permission = await Audio.getPermissionsAsync();
    return permission.status === 'granted';
  } catch (error) {
    console.error('Failed to check microphone permission:', error);
    return false;
  }
}

/**
 * Set volume for playback (0-1)
 */
export async function setPlaybackVolume(volume: number): Promise<boolean> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
    return true;
  } catch (error) {
    console.error('Failed to set playback volume:', error);
    return false;
  }
}

/**
 * Set playback speed (0.5x, 1x, 1.5x, 2x, etc)
 * Note: Not all formats support variable playback rates
 */
export async function setPlaybackRate(sound: Audio.Sound, rate: number): Promise<boolean> {
  try {
    // Clamp rate between 0.5 and 2
    const clampedRate = Math.max(0.5, Math.min(2, rate));
    await sound.setRateAsync(clampedRate, true);
    return true;
  } catch (error) {
    console.error('Failed to set playback rate:', error);
    return false;
  }
}

/**
 * Get audio format capabilities
 */
export async function getAudioCapabilities(): Promise<{
  supportsRecording: boolean;
  supportsPlayback: boolean;
  platform: string;
}> {
  return {
    supportsRecording: Platform.OS !== 'web',
    supportsPlayback: true,
    platform: Platform.OS,
  };
}

/**
 * Clean up audio resources
 */
export async function cleanupAudio(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DEFAULT,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DEFAULT,
      shouldDuckAndroid: false,
    });
  } catch (error) {
    console.error('Failed to cleanup audio:', error);
  }
}

/**
 * Load audio from URL and return Sound object
 * Caller is responsible for managing the Sound object lifecycle
 */
export async function loadAudioFromUrl(url: string): Promise<Audio.Sound | null> {
  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: false },
      null
    );
    return sound;
  } catch (error) {
    console.error('Failed to load audio:', error);
    return null;
  }
}

/**
 * Validate audio URL
 */
export function isValidAudioUrl(url: string): boolean {
  try {
    new URL(url);
    return /\.(mp3|m4a|aac|opus|ogg|wav|aiff|flac|wma)$/i.test(url) ||
      url.includes('audio') ||
      url.includes('stream');
  } catch {
    return false;
  }
}

/**
 * Format audio duration for display
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60)
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

/**
 * Get file size in human readable format (for progress indication)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
