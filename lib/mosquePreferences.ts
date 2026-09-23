import { persistentStorage } from './persistentStorage';
import { notificationClient } from './notifications/client';

function scopedKey(userId: string | null, suffix: string) {
  return `${suffix}:${userId ?? 'anonymous'}`;
}

export function defaultMosqueStorageKey(userId: string | null) {
  return scopedKey(userId, 'default_mosque_id');
}

export function adminDefaultMosqueStorageKey(userId: string | null) {
  return scopedKey(userId, 'admin_default_mosque_id');
}

export async function getDefaultMosqueId(userId: string | null) {
  return persistentStorage.getItem(defaultMosqueStorageKey(userId));
}

export async function setDefaultMosqueId(
  userId: string | null,
  mosqueId: string,
  accessToken?: string | null
) {
  await persistentStorage.setItem(defaultMosqueStorageKey(userId), mosqueId);
  if (userId && accessToken) {
    // Keep the notification primary mosque aligned even when this is the
    // user's first preference. Use the mounted session token so this write
    // cannot queue behind Supabase Auth's process lock.
    const { error } = await notificationClient(accessToken)
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        listener_primary_mosque_id: mosqueId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (error) throw error;
  }
}

export async function clearDefaultMosqueId(userId: string | null, accessToken?: string | null) {
  await persistentStorage.removeItem(defaultMosqueStorageKey(userId));
  if (userId && accessToken) {
    const { error } = await notificationClient(accessToken)
      .from('notification_preferences')
      .update({ listener_primary_mosque_id: null, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) throw error;
  }
}

/** Admin console context is intentionally independent from Listener choices. */
export function getAdminDefaultMosqueId(userId: string | null) {
  return persistentStorage.getItem(adminDefaultMosqueStorageKey(userId));
}

export function setAdminDefaultMosqueId(userId: string | null, mosqueId: string) {
  return persistentStorage.setItem(adminDefaultMosqueStorageKey(userId), mosqueId);
}

export function clearAdminDefaultMosqueId(userId: string | null) {
  return persistentStorage.removeItem(adminDefaultMosqueStorageKey(userId));
}
