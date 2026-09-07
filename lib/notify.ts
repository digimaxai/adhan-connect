import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_CHANNEL_ID = 'adhan-alerts';

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Adhan alerts',
    description: 'Upcoming Adhan, live Adhan, and muezzin duty reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#0EA5E9',
    sound: 'default',
  });
}

export async function ensureNotificationPermissions() {
  await ensureAndroidChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  return permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function scheduleLocal(title: string, body: string, when: Date) {
  if (when.getTime() <= Date.now()) return '';
  const allowed = await ensureNotificationPermissions();
  if (!allowed) return '';

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { screen: 'muezzin_broadcast' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: Platform.OS === 'android' ? REMINDER_CHANNEL_ID : undefined,
    },
  });
}

export async function scheduleReminders(
  target: Date,
  offsetsMins: number[],
  label: string
) {
  const notificationIds: string[] = [];
  for (const offset of Array.from(new Set(offsetsMins))) {
    if (!Number.isFinite(offset) || offset < 0) continue;
    const when = new Date(target.getTime() - offset * 60 * 1000);
    if (when.getTime() <= Date.now()) continue;
    const id = await scheduleLocal(
      offset === 0 ? `${label} is ready` : `${label} in ${offset} minutes`,
      'Open Adhan Connect to prepare your broadcast.',
      when
    );
    if (id) notificationIds.push(id);
  }
  return notificationIds;
}
