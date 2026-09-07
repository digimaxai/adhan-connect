import type { PushEnableResult, PushPermissionState } from './types';

export async function configureNotificationPresentation() {}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  return 'unavailable';
}

export async function enablePushNotifications(_accessToken?: string | null): Promise<PushEnableResult> {
  return {
    status: 'unavailable',
    registered: false,
    message: 'Push alerts are available in the mobile app.',
  };
}

export async function syncPushDeviceIfGranted(_accessToken?: string | null): Promise<PushEnableResult> {
  return { status: 'unavailable', registered: false };
}

export async function unregisterCurrentPushDevice(_accessToken?: string | null) {}

export function subscribeToNotificationResponses(
  _listener: (data: Record<string, unknown>) => void
) {
  return () => {};
}

export function subscribeToPushTokenChanges(_listener: () => void) {
  return () => {};
}
