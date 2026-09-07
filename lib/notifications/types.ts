export const PRAYER_NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type NotificationPrayer = (typeof PRAYER_NAMES)[number];

export type ListenerMosqueScope = 'primary' | 'all_followed';

export type NotificationPreferences = {
  user_id: string;
  listener_upcoming_enabled: boolean;
  listener_live_enabled: boolean;
  listener_mosque_scope: ListenerMosqueScope;
  listener_primary_mosque_id: string | null;
  listener_lead_minutes: 0 | 5 | 10 | 15 | 30 | 60;
  listener_prayers: NotificationPrayer[];
  muezzin_assignment_updates_enabled: boolean;
  muezzin_duty_reminders_enabled: boolean;
  muezzin_live_enabled: boolean;
  muezzin_lead_minutes: number[];
  travel_live_enabled: boolean;
  travel_radius_km: number;
  created_at?: string;
  updated_at?: string;
};

export type PushPermissionState =
  | 'granted'
  | 'provisional'
  | 'denied'
  | 'undetermined'
  | 'unavailable';

export type PushEnableResult = {
  status: PushPermissionState;
  registered: boolean;
  message?: string;
};

export type TravelNotificationRegion = {
  user_id: string;
  radius_km: number;
  label: string | null;
  expires_at: string;
  created_at?: string;
  updated_at?: string;
};

export function defaultNotificationPreferences(userId: string): NotificationPreferences {
  return {
    user_id: userId,
    listener_upcoming_enabled: false,
    listener_live_enabled: false,
    listener_mosque_scope: 'primary',
    listener_primary_mosque_id: null,
    listener_lead_minutes: 15,
    listener_prayers: [...PRAYER_NAMES],
    muezzin_assignment_updates_enabled: false,
    muezzin_duty_reminders_enabled: false,
    muezzin_live_enabled: false,
    muezzin_lead_minutes: [30, 10],
    travel_live_enabled: false,
    travel_radius_km: 15,
  };
}
