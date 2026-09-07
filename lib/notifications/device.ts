import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import type { NotificationPermissionsStatus } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { PushEnableResult, PushPermissionState } from './types';
import { notificationClient, withNotificationDeadline } from './client';

const INSTALLATION_KEY_PREFIX = 'adhan-connect-push-installation';
const CHANNEL_ID = 'adhan-alerts';
const NATIVE_OPERATION_TIMEOUT_MS = 8_000;

let registrationFlight: {
  accessToken: string;
  promise: Promise<PushEnableResult>;
} | null = null;
let recentRegistration: {
  accessToken: string;
  completedAt: number;
  result: PushEnableResult;
} | null = null;

function notificationModule() {
  return import('expo-notifications');
}

function deviceModule() {
  return import('expo-device');
}

function appVariant(): 'staging' | 'production' {
  return Constants.expoConfig?.extra?.appVariant === 'staging' ? 'staging' : 'production';
}

function projectId() {
  return Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId ?? null;
}

function permissionState(settings: NotificationPermissionsStatus): PushPermissionState {
  if (settings.granted) return 'granted';
  if (settings.ios?.status === 3) return 'provisional';
  if (settings.canAskAgain) return 'undetermined';
  return 'denied';
}

async function installationId() {
  const key = `${INSTALLATION_KEY_PREFIX}-${appVariant()}`;
  const existing = await withNotificationDeadline(
    SecureStore.getItemAsync(key),
    'Reading this device registration',
    NATIVE_OPERATION_TIMEOUT_MS
  );
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await withNotificationDeadline(
    SecureStore.setItemAsync(key, created, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
    'Saving this device registration',
    NATIVE_OPERATION_TIMEOUT_MS
  );
  return created;
}

export async function configureNotificationPresentation() {
  const Notifications = await notificationModule();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Adhan alerts',
      description: 'Upcoming Adhan, live Adhan, and muezzin duty reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#0EA5E9',
      sound: 'default',
    });
  }
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const [Device, Notifications] = await withNotificationDeadline(
      Promise.all([deviceModule(), notificationModule()]),
      'Checking notification support',
      NATIVE_OPERATION_TIMEOUT_MS
    );
    if (!Device.isDevice) return 'unavailable';
    return permissionState(await withNotificationDeadline(
      Notifications.getPermissionsAsync(),
      'Checking notification permission',
      NATIVE_OPERATION_TIMEOUT_MS
    ));
  } catch {
    // A transient native-module or keychain delay is recoverable on a real
    // phone; do not mislabel it as permanent device incompatibility.
    return 'undetermined';
  }
}

async function registerGrantedDevice(
  status: 'granted' | 'provisional',
  accessToken: string
): Promise<PushEnableResult> {
  if (!accessToken) {
    return { status, registered: false, message: 'Sign in again to finish notification setup.' };
  }
  const cached = cachedRegistration(accessToken);
  if (cached) return { ...cached, status };
  if (registrationFlight?.accessToken === accessToken) return registrationFlight.promise;

  const promise = (async () => {
    const Notifications = await withNotificationDeadline(
      notificationModule(),
      'Loading notification support',
      NATIVE_OPERATION_TIMEOUT_MS
    );
    const easProjectId = projectId();
    if (!easProjectId) {
      return {
        status,
        registered: false,
        message: 'This build is missing its EAS project ID.',
      };
    }

    const token = await withNotificationDeadline(
      Notifications.getExpoPushTokenAsync({ projectId: easProjectId }),
      'Registering with the notification service',
      12_000
    );
    const currentInstallationId = await installationId();
    const { error } = await notificationClient(accessToken).rpc('register_push_device_v1', {
      p_expo_push_token: token.data,
      p_installation_id: currentInstallationId,
      p_platform: Platform.OS,
      p_app_variant: appVariant(),
      p_permission_status: status,
    });
    if (error) throw error;
    return { status, registered: true };
  })();

  registrationFlight = { accessToken, promise };
  try {
    const result = await promise;
    if (result.registered) {
      recentRegistration = { accessToken, completedAt: Date.now(), result };
    }
    return result;
  } finally {
    if (registrationFlight?.promise === promise) registrationFlight = null;
  }
}

function cachedRegistration(accessToken: string) {
  if (
    recentRegistration?.accessToken === accessToken &&
    Date.now() - recentRegistration.completedAt < 5 * 60 * 1000
  ) {
    return recentRegistration.result;
  }
  return null;
}

export async function enablePushNotifications(accessToken?: string | null): Promise<PushEnableResult> {
  if (Platform.OS === 'web') {
    return { status: 'unavailable', registered: false, message: 'Push alerts are available in the mobile app.' };
  }
  try {
    const [Device, Notifications] = await withNotificationDeadline(
      Promise.all([deviceModule(), notificationModule()]),
      'Loading notification support',
      NATIVE_OPERATION_TIMEOUT_MS
    );
    if (!Device.isDevice) {
      return { status: 'unavailable', registered: false, message: 'Push alerts require a physical device.' };
    }
    await withNotificationDeadline(
      configureNotificationPresentation(),
      'Preparing notifications',
      NATIVE_OPERATION_TIMEOUT_MS
    );
    let settings = await withNotificationDeadline(
      Notifications.getPermissionsAsync(),
      'Checking notification permission',
      NATIVE_OPERATION_TIMEOUT_MS
    );
    let status = permissionState(settings);
    if (status === 'undetermined') {
      settings = await withNotificationDeadline(
        Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        }),
        'Waiting for notification permission',
        30_000
      );
      status = permissionState(settings);
    }
    if (status !== 'granted' && status !== 'provisional') {
      return {
        status,
        registered: false,
        message: 'Notifications are disabled in device settings.',
      };
    }
    return await registerGrantedDevice(status, accessToken ?? '');
  } catch (error) {
    return {
      status: await getPushPermissionState(),
      registered: false,
      message: error instanceof Error ? error.message : 'Could not register this device.',
    };
  }
}

export async function syncPushDeviceIfGranted(accessToken?: string | null) {
  if (accessToken) {
    const cached = cachedRegistration(accessToken);
    if (cached) return cached;
  }
  const status = await getPushPermissionState();
  if (status !== 'granted' && status !== 'provisional') return { status, registered: false } as PushEnableResult;
  try {
    await configureNotificationPresentation();
    return await registerGrantedDevice(status, accessToken ?? '');
  } catch (error) {
    return {
      status,
      registered: false,
      message: error instanceof Error ? error.message : 'Could not refresh this device registration.',
    } as PushEnableResult;
  }
}

export async function unregisterCurrentPushDevice(accessToken?: string | null) {
  if (Platform.OS === 'web' || !accessToken) return;
  const currentInstallationId = await installationId();
  const { error } = await notificationClient(accessToken).rpc('unregister_push_device_v1', {
    p_installation_id: currentInstallationId,
    p_app_variant: appVariant(),
  });
  if (error) throw error;
  if (recentRegistration?.accessToken === accessToken) recentRegistration = null;
}

export function subscribeToNotificationResponses(
  listener: (data: Record<string, unknown>) => void
) {
  let active = true;
  let subscription: { remove: () => void } | null = null;
  void notificationModule()
    .then(async (Notifications) => {
      if (!active) return;
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        listener(response.notification.request.content.data);
      });
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!active || !response) return;
      listener(response.notification.request.content.data);
      await Notifications.clearLastNotificationResponseAsync();
    })
    .catch(() => undefined);
  return () => {
    active = false;
    subscription?.remove();
  };
}

export function subscribeToPushTokenChanges(listener: () => void) {
  let active = true;
  let subscription: { remove: () => void } | null = null;
  void notificationModule()
    .then((Notifications) => {
      if (!active) return;
      subscription = Notifications.addPushTokenListener(() => listener());
    })
    .catch(() => undefined);
  return () => {
    active = false;
    subscription?.remove();
  };
}
