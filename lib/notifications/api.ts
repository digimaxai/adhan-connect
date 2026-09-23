import {
  PRAYER_NAMES,
  defaultNotificationPreferences,
  type NotificationPrayer,
  type NotificationPreferences,
  type TravelNotificationRegion,
} from './types';
import { notificationClient } from './client';

export type NotificationPreferencePatch = Partial<
  Omit<NotificationPreferences, 'user_id' | 'created_at' | 'updated_at'>
>;

const PREFERENCE_COLUMNS = [
  'user_id',
  'listener_upcoming_enabled',
  'listener_live_enabled',
  'listener_mosque_scope',
  'listener_primary_mosque_id',
  'listener_lead_minutes',
  'listener_prayers',
  'muezzin_assignment_updates_enabled',
  'muezzin_duty_reminders_enabled',
  'muezzin_live_enabled',
  'muezzin_lead_minutes',
  'travel_live_enabled',
  'travel_radius_km',
  'created_at',
  'updated_at',
].join(',');

const preferenceCache = new Map<string, NotificationPreferences>();
const MUEZZIN_LEADS = [3, 5, 10, 30] as const;
const LISTENER_LEADS = [0, 5, 10, 15, 30, 60] as const;
const TRAVEL_RADII = [5, 15, 30] as const;

function numberArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function normalizePreferences(value: unknown, userId: string): NotificationPreferences {
  const defaults = defaultNotificationPreferences(userId);
  if (!value || typeof value !== 'object') return defaults;
  const row = value as Partial<NotificationPreferences>;
  const prayers = Array.isArray(row.listener_prayers)
    ? Array.from(new Set(row.listener_prayers.filter(
        (prayer): prayer is NotificationPrayer => PRAYER_NAMES.includes(prayer as NotificationPrayer)
      )))
    : [];
  const muezzinLeads = Array.from(new Set(
    numberArray(row.muezzin_lead_minutes).filter((lead) =>
      MUEZZIN_LEADS.includes(lead as (typeof MUEZZIN_LEADS)[number])
    )
  )).sort((left, right) => right - left);
  const listenerLead = Number(row.listener_lead_minutes);
  const travelRadius = Number(row.travel_radius_km);

  return {
    ...defaults,
    ...row,
    user_id: userId,
    listener_mosque_scope: row.listener_mosque_scope === 'all_followed' ? 'all_followed' : 'primary',
    listener_lead_minutes: LISTENER_LEADS.includes(listenerLead as (typeof LISTENER_LEADS)[number])
      ? listenerLead as NotificationPreferences['listener_lead_minutes']
      : defaults.listener_lead_minutes,
    listener_prayers: prayers.length ? prayers : defaults.listener_prayers,
    muezzin_lead_minutes: muezzinLeads.length ? muezzinLeads : defaults.muezzin_lead_minutes,
    travel_radius_km: TRAVEL_RADII.includes(travelRadius as (typeof TRAVEL_RADII)[number])
      ? travelRadius
      : defaults.travel_radius_km,
  };
}

export function getCachedNotificationPreferences(userId: string) {
  return preferenceCache.get(userId) ?? null;
}

export async function getNotificationPreferences(userId: string, accessToken: string) {
  const { data, error } = await notificationClient(accessToken)
    .from('notification_preferences')
    .select(PREFERENCE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  const preferences = normalizePreferences(data, userId);
  preferenceCache.set(userId, preferences);
  return preferences;
}

export async function saveNotificationPreferencePatch(
  userId: string,
  patch: NotificationPreferencePatch,
  accessToken: string
) {
  const payload = {
    user_id: userId,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await notificationClient(accessToken)
    .from('notification_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select(PREFERENCE_COLUMNS)
    .single();

  if (error) throw error;
  const preferences = normalizePreferences(data, userId);
  preferenceCache.set(userId, preferences);
  return preferences;
}

export async function getTravelNotificationRegion(userId: string, accessToken: string) {
  const { data, error } = await notificationClient(accessToken)
    .from('travel_notification_regions')
    .select('user_id, radius_km, label, expires_at, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as TravelNotificationRegion | null;
}

export async function setTravelNotificationRegion(input: {
  latitude: number;
  longitude: number;
  radiusKm: number;
  label?: string | null;
  durationHours?: number;
}, accessToken: string) {
  const { data, error } = await notificationClient(accessToken).rpc('set_travel_notification_region_v1', {
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_radius_km: input.radiusKm,
    p_label: input.label ?? null,
    p_duration_hours: input.durationHours ?? 24,
  });
  if (error) throw error;
  return data as string;
}

export async function clearTravelNotificationRegion(accessToken: string) {
  const { error } = await notificationClient(accessToken).rpc('clear_travel_notification_region_v1');
  if (error) throw error;
}

export async function getFollowedMosquesForNotifications(userId: string, accessToken: string) {
  const { data, error } = await notificationClient(accessToken)
    .from('subscriptions')
    .select('mosque_id, mosques(id, name)')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw error;
  return data ?? [];
}
