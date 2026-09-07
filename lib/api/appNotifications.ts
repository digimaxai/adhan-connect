import { supabase } from '../supabase';
import { notificationClient } from '../notifications/client';
import type { AppNotification } from '../types/muezzin';

export type AppNotificationInsert = {
  user_id: string;
  mosque_id?: string | null;
  actor_user_id?: string | null;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
};

export async function getAppNotifications(
  limit = 40,
  accessToken?: string | null
): Promise<AppNotification[]> {
  const client = accessToken ? notificationClient(accessToken) : supabase;
  const { data, error } = await client
    .from('app_notifications')
    .select('id, user_id, mosque_id, actor_user_id, type, title, body, metadata, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error && error.code !== 'PGRST116') throw error;
  return (data ?? []) as AppNotification[];
}

export async function insertAppNotifications(rows: AppNotificationInsert[]) {
  if (!rows.length) return [];
  const { data, error } = await supabase
    .from('app_notifications')
    .insert(rows)
    .select('id, user_id, mosque_id, actor_user_id, type, title, body, metadata, read_at, created_at');

  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function markAppNotificationRead(notificationId: string, accessToken?: string | null) {
  const readAt = new Date().toISOString();
  const client = accessToken ? notificationClient(accessToken) : supabase;
  const { error } = await client
    .from('app_notifications')
    .update({ read_at: readAt })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllAppNotificationsRead(
  userId?: string | null,
  accessToken?: string | null
) {
  if (!userId) return;
  const readAt = new Date().toISOString();
  const client = accessToken ? notificationClient(accessToken) : supabase;
  const { error } = await client
    .from('app_notifications')
    .update({ read_at: readAt })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
}
