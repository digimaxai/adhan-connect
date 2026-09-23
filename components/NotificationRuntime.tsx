import { router } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../lib/auth';
import {
  configureNotificationPresentation,
  subscribeToNotificationResponses,
  subscribeToPushTokenChanges,
  syncPushDeviceIfGranted,
} from '../lib/notifications/device';
import { setPreferredStaffEntry, type StaffEntryMode } from '../lib/roleEntryPreferences';

function readString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function openNotificationDestination(
  data: Record<string, unknown>,
  userId: string
) {
  const screen = readString(data, 'screen');
  const mosqueId = readString(data, 'mosqueId');
  let workspace: StaffEntryMode | null = null;

  if (screen === 'live' || screen === 'mosque' || screen === 'event' || screen === 'jumuah') workspace = 'listener';
  if (screen === 'muezzin_broadcast' || screen === 'muezzin_rota') workspace = 'muezzin';
  if (workspace) {
    await setPreferredStaffEntry(userId, workspace).catch(() => undefined);
  }

  if (screen === 'live' && mosqueId) {
    router.replace({ pathname: '/(user)/now', params: { mosqueId } } as any);
    return;
  }
  if (screen === 'mosque' && mosqueId) {
    router.replace(`/(user)/mosque/${encodeURIComponent(mosqueId)}` as any);
    return;
  }
  if (screen === 'muezzin_broadcast') {
    router.replace({
      pathname: '/(muezzin)/live-broadcast',
      params: {
        ...(mosqueId ? { mosqueId } : {}),
        ...(readString(data, 'prayer') ? { prayer: readString(data, 'prayer') } : {}),
      },
    } as any);
    return;
  }
  if (screen === 'muezzin_rota') {
    router.replace('/(muezzin)/my-rota' as any);
    return;
  }
  if (screen === 'event') {
    const eventId = readString(data, 'eventId');
    if (eventId) router.replace(`/(user)/event/${encodeURIComponent(eventId)}` as any);
    return;
  }
  if (screen === 'jumuah' && mosqueId) {
    router.replace({ pathname: '/(user)/jumuah/[id]', params: { id: mosqueId } } as any);
  }
}

/**
 * Native push lifecycle kept outside every broadcast screen. A token or
 * notification failure is logged only and cannot affect LIVE state.
 */
export function NotificationRuntime() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const accessToken = session?.access_token ?? null;

  useEffect(() => {
    void configureNotificationPresentation().catch((error) => {
      console.warn('[push] presentation setup unavailable', error);
    });
  }, []);

  useEffect(() => {
    if (!userId || !accessToken) return;

    let active = true;
    const sync = () => {
      void syncPushDeviceIfGranted(accessToken).then((result) => {
        if (active && result.message) console.warn('[push] device sync skipped', result.message);
      });
    };
    sync();

    const unsubscribeToken = subscribeToPushTokenChanges(sync);
    const unsubscribeResponses = subscribeToNotificationResponses((data) => {
      void openNotificationDestination(data, userId);
    });
    return () => {
      active = false;
      unsubscribeToken();
      unsubscribeResponses();
    };
  }, [accessToken, userId]);

  return null;
}
