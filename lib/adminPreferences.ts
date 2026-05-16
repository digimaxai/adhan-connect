import { persistentStorage } from './persistentStorage';

function key(userId: string | null, pref: string) {
  return `admin_pref:${pref}:${userId ?? 'anonymous'}`;
}

export async function getAdminNotifCoverRequests(userId: string | null): Promise<boolean> {
  const val = await persistentStorage.getItem(key(userId, 'notif_cover_requests'));
  return val !== 'false';
}
export async function setAdminNotifCoverRequests(userId: string | null, v: boolean) {
  await persistentStorage.setItem(key(userId, 'notif_cover_requests'), String(v));
}

export async function getAdminNotifRotaChanges(userId: string | null): Promise<boolean> {
  const val = await persistentStorage.getItem(key(userId, 'notif_rota_changes'));
  return val !== 'false';
}
export async function setAdminNotifRotaChanges(userId: string | null, v: boolean) {
  await persistentStorage.setItem(key(userId, 'notif_rota_changes'), String(v));
}

export async function getAdminTimeFormat(userId: string | null): Promise<'12h' | '24h'> {
  const val = await persistentStorage.getItem(key(userId, 'time_format'));
  return val === '24h' ? '24h' : '12h';
}
export async function setAdminTimeFormat(userId: string | null, format: '12h' | '24h') {
  await persistentStorage.setItem(key(userId, 'time_format'), format);
}
