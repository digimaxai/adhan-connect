import { persistentStorage } from './persistentStorage';

function scopedKey(userId: string | null, suffix: string) {
  return `${suffix}:${userId ?? 'anonymous'}`;
}

export function locationPromptSeenStorageKey(userId: string | null) {
  return scopedKey(userId, 'location_prompt_seen');
}

export async function hasSeenLocationPrompt(userId: string | null): Promise<boolean> {
  return (await persistentStorage.getItem(locationPromptSeenStorageKey(userId))) === '1';
}

export async function markLocationPromptSeen(userId: string | null): Promise<void> {
  await persistentStorage.setItem(locationPromptSeenStorageKey(userId), '1');
}
