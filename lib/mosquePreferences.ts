import { persistentStorage } from './persistentStorage';

function scopedKey(userId: string | null, suffix: string) {
  return `${suffix}:${userId ?? 'anonymous'}`;
}

export function defaultMosqueStorageKey(userId: string | null) {
  return scopedKey(userId, 'default_mosque_id');
}

export async function getDefaultMosqueId(userId: string | null) {
  return persistentStorage.getItem(defaultMosqueStorageKey(userId));
}

export async function setDefaultMosqueId(userId: string | null, mosqueId: string) {
  await persistentStorage.setItem(defaultMosqueStorageKey(userId), mosqueId);
}

export async function clearDefaultMosqueId(userId: string | null) {
  await persistentStorage.removeItem(defaultMosqueStorageKey(userId));
}
