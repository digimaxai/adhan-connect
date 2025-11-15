// lib/notify.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Optional: set up an Android channel so sounds/vibration behave as expected */
export async function ensureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('adhans', {
      name: 'Adhan Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

export async function ensureNotificationPermissions() {
  const current = await Notifications.getPermissionsAsync();
  const granted =
    current.granted ||
    (Platform.OS === 'ios' &&
      current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);

  if (granted) return true;

  const req = await Notifications.requestPermissionsAsync();
  return (
    req.granted ||
    (Platform.OS === 'ios' &&
      req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL)
  );
}

/**
 * Schedule a local notification roughly at a target time using a time-interval trigger.
 * (Most compatible across Expo SDKs/types.)
 */
export async function scheduleLocal(title: string, body: string, when: Date) {
  // at least 1s in the future
  const seconds = Math.max(1, Math.floor((when.getTime() - Date.now()) / 1000));

  // Use the enum to satisfy strict TypeScript defs:
  // Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
      ...(Platform.OS === 'android' ? { channelId: 'adhans' } : {}),
    },
  });
}

/** Schedule multiple reminders N minutes before a target time. */
export async function scheduleReminders(
  target: Date,
  offsetsMins: number[],
  label: string
) {
  await ensureNotificationPermissions();
  if (Platform.OS === 'android') {
    await ensureAndroidChannel();
  }

  const ids: string[] = [];
  for (const mins of offsetsMins) {
    const when = new Date(target.getTime() - mins * 60_000);
    if (when.getTime() > Date.now()) {
      const id = await scheduleLocal(
        `${label} in ${mins} min`,
        `Reminder: ${label} starts soon.`,
        when
      );
      ids.push(id);
    }
  }
  return ids;
}
