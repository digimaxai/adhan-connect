import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { router, useFocusEffect, useSegments } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Appbar, Text } from 'react-native-paper';
import {
  getAppNotifications,
  markAllAppNotificationsRead,
  markAppNotificationRead,
} from '../../../lib/api/appNotifications';
import { useAuth } from '../../../lib/auth';
import { getDefaultMosqueId } from '../../../lib/mosquePreferences';
import {
  clearTravelNotificationRegion,
  getCachedNotificationPreferences,
  getFollowedMosquesForNotifications,
  getNotificationPreferences,
  getTravelNotificationRegion,
  saveNotificationPreferencePatch,
  setTravelNotificationRegion,
  type NotificationPreferencePatch,
} from '../../../lib/notifications/api';
import { withNotificationDeadline } from '../../../lib/notifications/client';
import {
  enablePushNotifications,
  getPushPermissionState,
  syncPushDeviceIfGranted,
} from '../../../lib/notifications/device';
import {
  PRAYER_NAMES,
  defaultNotificationPreferences,
  type NotificationPrayer,
  type NotificationPreferences,
  type PushPermissionState,
  type TravelNotificationRegion,
} from '../../../lib/notifications/types';
import { requireRoleEntrySelection } from '../../../lib/roleEntrySession';
import { useRoleFlags } from '../../../lib/roles';
import type { AppNotification } from '../../../lib/types/muezzin';

const PRAYER_LABELS: Record<NotificationPrayer, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

type SettingRowProps = {
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  saving?: boolean;
  onChange: (next: boolean) => void;
};

function SettingRow({ title, description, value, disabled, saving, onChange }: SettingRowProps) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <View style={styles.settingControl}>
        {saving ? <ActivityIndicator size="small" color="#2F6B45" /> : null}
        <Switch
          accessibilityLabel={title}
          value={value}
          disabled={disabled || saving}
          onValueChange={onChange}
          trackColor={{ false: '#CBD5E1', true: '#A7D7B2' }}
          thumbColor={value ? '#2F6B45' : '#F8FAFC'}
          ios_backgroundColor="#CBD5E1"
        />
      </View>
    </View>
  );
}

function ChoiceChip({
  label,
  selected,
  disabled,
  showCheckmark = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  showCheckmark?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceChip,
        selected && styles.choiceChipSelected,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {showCheckmark && selected ? (
        <Ionicons name="checkmark" size={15} color="#28593B" />
      ) : null}
      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function formatRegionExpiry(region: TravelNotificationRegion | null) {
  if (!region) return null;
  const expiry = new Date(region.expires_at);
  if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) return null;
  return `${region.label || 'Current area'} · until ${expiry.toLocaleString([], {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

export default function NotificationsScreen() {
  const { session } = useAuth();
  const roles = useRoleFlags({ reuseResolvedSessionAccess: true });
  const segments = useSegments();
  const isMuezzinWorkspace = String(segments[0] ?? '') === '(muezzin)';
  const userId = session?.user?.id ?? null;
  const accessToken = session?.access_token ?? null;
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const preferencesRef = useRef<NotificationPreferences | null>(null);
  const loadVersionRef = useRef(0);
  const deviceCheckVersionRef = useRef(0);
  const saveQueuesRef = useRef(new Map<string, Promise<void>>());
  const saveVersionsRef = useRef(new Map<string, number>());
  const [items, setItems] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<PushPermissionState>('undetermined');
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [deviceChecking, setDeviceChecking] = useState(true);
  const [deviceMessage, setDeviceMessage] = useState<string | null>(null);
  const [travelRegion, setTravelRegion] = useState<TravelNotificationRegion | null>(null);
  const [primaryMosqueName, setPrimaryMosqueName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState<string[]>([]);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [travelBusy, setTravelBusy] = useState(false);
  const [activityBusy, setActivityBusy] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const replacePreferences = useCallback((next: NotificationPreferences | null) => {
    preferencesRef.current = next;
    setPreferences(next);
  }, []);

  const patchPreferences = useCallback((patch: NotificationPreferencePatch) => {
    const current = preferencesRef.current;
    if (!current) return null;
    const next = { ...current, ...patch };
    preferencesRef.current = next;
    setPreferences(next);
    return next;
  }, []);

  const refreshDeviceState = useCallback(async () => {
    const checkVersion = deviceCheckVersionRef.current + 1;
    deviceCheckVersionRef.current = checkVersion;
    setDeviceChecking(true);
    setDeviceMessage(null);
    try {
      const permissionState = await getPushPermissionState();
      if (deviceCheckVersionRef.current !== checkVersion) return;
      setPermission(permissionState);
      if (
        (permissionState === 'granted' || permissionState === 'provisional') &&
        accessToken
      ) {
        const result = await syncPushDeviceIfGranted(accessToken);
        if (deviceCheckVersionRef.current !== checkVersion) return;
        setPermission(result.status);
        setDeviceRegistered(result.registered);
        setDeviceMessage(result.registered ? null : result.message ?? 'Tap Retry to finish device setup.');
      } else {
        setDeviceRegistered(false);
      }
    } finally {
      if (deviceCheckVersionRef.current === checkVersion) setDeviceChecking(false);
    }
  }, [accessToken]);

  const loadSecondaryDetails = useCallback(async (
    requestVersion: number,
    loadedPreferences: NotificationPreferences
  ) => {
    if (!userId || !accessToken) return;
    if (isMuezzinWorkspace) {
      try {
        const nextItems = await getAppNotifications(40, accessToken);
        if (loadVersionRef.current === requestVersion) setItems(nextItems);
      } catch (activityError) {
        if (loadVersionRef.current === requestVersion) {
          setNotice(activityError instanceof Error ? activityError.message : 'Activity could not be refreshed.');
        }
      }
      return;
    }

    try {
      const storedPrimaryMosqueId = await withNotificationDeadline(
        getDefaultMosqueId(userId),
        'Reading your primary mosque'
      );
      const [region, subscriptionRows] = await Promise.all([
        getTravelNotificationRegion(userId, accessToken),
        getFollowedMosquesForNotifications(userId, accessToken),
      ]);
      if (loadVersionRef.current !== requestVersion) return;

      const storedPrimaryIsFollowed = !!storedPrimaryMosqueId &&
        subscriptionRows.some((row) => row.mosque_id === storedPrimaryMosqueId);
      const resolvedPrimaryMosqueId = storedPrimaryIsFollowed
        ? storedPrimaryMosqueId
        : subscriptionRows[0]?.mosque_id ?? null;
      const primaryRow = subscriptionRows.find((row) => row.mosque_id === resolvedPrimaryMosqueId);
      const joinedMosque = primaryRow?.mosques as unknown as { name?: string | null } | null;
      setPrimaryMosqueName(joinedMosque?.name?.trim() || null);
      setTravelRegion(region);

      if (loadedPreferences.listener_primary_mosque_id !== resolvedPrimaryMosqueId) {
        await saveNotificationPreferencePatch(
          userId,
          { listener_primary_mosque_id: resolvedPrimaryMosqueId },
          accessToken
        );
        if (loadVersionRef.current === requestVersion) {
          patchPreferences({ listener_primary_mosque_id: resolvedPrimaryMosqueId });
        }
      }
    } catch (listenerError) {
      if (loadVersionRef.current === requestVersion) {
        setNotice(listenerError instanceof Error ? listenerError.message : 'Listener details could not be refreshed.');
      }
    }
  }, [accessToken, isMuezzinWorkspace, patchPreferences, userId]);

  const load = useCallback(async () => {
    const requestVersion = loadVersionRef.current + 1;
    loadVersionRef.current = requestVersion;
    if (!userId || !accessToken) {
      replacePreferences(null);
      setLoading(false);
      setError('Sign in again to manage notification preferences.');
      return;
    }

    const current = preferencesRef.current?.user_id === userId
      ? preferencesRef.current
      : getCachedNotificationPreferences(userId);
    if (current) replacePreferences(current);
    else replacePreferences(null);
    setLoading(!current);
    setError(null);

    try {
      const nextPreferences = await getNotificationPreferences(userId, accessToken);
      if (loadVersionRef.current !== requestVersion) return;
      replacePreferences(nextPreferences);
      setLoading(false);
      void loadSecondaryDetails(requestVersion, nextPreferences);
    } catch (loadError) {
      if (loadVersionRef.current !== requestVersion) return;
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notification settings.');
      setLoading(false);
    }
  }, [accessToken, loadSecondaryDetails, replacePreferences, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void refreshDeviceState();
      return () => {
        loadVersionRef.current += 1;
        deviceCheckVersionRef.current += 1;
      };
    }, [load, refreshDeviceState])
  );

  const ensureDeviceReady = useCallback(async () => {
    if (!accessToken) {
      setDeviceMessage('Sign in again to finish notification setup.');
      return false;
    }
    setDeviceBusy(true);
    setDeviceMessage(null);
    try {
      const result = await enablePushNotifications(accessToken);
      setPermission(result.status);
      setDeviceRegistered(result.registered);
      if (result.registered) return true;
      setDeviceMessage(result.message ?? 'Notifications could not be enabled on this device.');
      return false;
    } finally {
      setDeviceBusy(false);
    }
  }, [accessToken]);

  const commit = useCallback(
    async (
      patch: NotificationPreferencePatch,
      key: keyof NotificationPreferences,
      enablingPush = false
    ) => {
      const currentPreferences = preferencesRef.current;
      if (!currentPreferences || !userId || !accessToken) return false;
      const previous = Object.fromEntries(
        Object.keys(patch).map((patchKey) => [patchKey, currentPreferences[patchKey as keyof NotificationPreferences]])
      ) as NotificationPreferencePatch;
      patchPreferences(patch);
      const queueKey = String(key);
      const version = (saveVersionsRef.current.get(queueKey) ?? 0) + 1;
      saveVersionsRef.current.set(queueKey, version);
      setSavingKeys((current) => current.includes(queueKey) ? current : [...current, queueKey]);
      setNotice(null);
      try {
        if (enablingPush && !deviceRegistered && !(await ensureDeviceReady())) {
          if (saveVersionsRef.current.get(queueKey) === version) {
            patchPreferences(previous);
          }
          return false;
        }

        const previousSave = saveQueuesRef.current.get(queueKey) ?? Promise.resolve();
        const queuedSave = previousSave
          .catch(() => undefined)
          .then(async () => {
            await saveNotificationPreferencePatch(userId, patch, accessToken);
          });
        saveQueuesRef.current.set(queueKey, queuedSave);
        await queuedSave;
        return true;
      } catch (saveError) {
        if (saveVersionsRef.current.get(queueKey) === version) {
          patchPreferences(previous);
          setNotice(saveError instanceof Error ? saveError.message : 'Your preference could not be saved.');
          // A failed item in a rapid multi-select sequence can make the last
          // optimistic snapshot differ from the server. Reconcile once after
          // the queue settles; cached preferences remain visible meanwhile.
          void load();
        }
        return false;
      } finally {
        const queuedSave = saveQueuesRef.current.get(queueKey);
        if (queuedSave) {
          void queuedSave.finally(() => {
            if (saveQueuesRef.current.get(queueKey) === queuedSave) {
              saveQueuesRef.current.delete(queueKey);
            }
          });
        }
        if (saveVersionsRef.current.get(queueKey) === version) {
          setSavingKeys((current) => current.filter((item) => item !== queueKey));
        }
      }
    },
    [accessToken, deviceRegistered, ensureDeviceReady, load, patchPreferences, userId]
  );

  const updateBoolean = useCallback(
    (key: keyof NotificationPreferences, value: boolean) => {
      if (!preferences) return;
      void commit({ [key]: value }, key, value);
    },
    [commit, preferences]
  );

  const enableTravelForCurrentArea = useCallback(async () => {
    if (!preferences || !accessToken || travelBusy) return;
    setTravelBusy(true);
    setNotice(null);
    try {
      if (!(await ensureDeviceReady())) return;
      const permissionResult = await withNotificationDeadline(
        Location.requestForegroundPermissionsAsync(),
        'Waiting for location permission',
        30_000
      );
      if (permissionResult.status !== 'granted') {
        setNotice('Location access is needed to choose your current area. Your default mosque will not change.');
        return;
      }

      const position = await withNotificationDeadline(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        'Finding your current area',
        15_000
      );
      const geocoded = await withNotificationDeadline(
        Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
        'Naming your current area'
      ).catch(() => []);
      const place = geocoded[0];
      const label = place?.city || place?.district || place?.region || 'Current area';
      const expiresAt = await setTravelNotificationRegion({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        radiusKm: preferences.travel_radius_km,
        label,
        durationHours: 24,
      }, accessToken);
      patchPreferences({ travel_live_enabled: true });
      setTravelRegion({
        user_id: preferences.user_id,
        radius_km: preferences.travel_radius_km,
        label,
        expires_at: expiresAt,
      });
      setNotice(`Nearby LIVE alerts are active around ${label} for 24 hours.`);
    } catch (travelError) {
      setNotice(travelError instanceof Error ? travelError.message : 'Current-area alerts could not be enabled.');
    } finally {
      setTravelBusy(false);
    }
  }, [accessToken, ensureDeviceReady, patchPreferences, preferences, travelBusy]);

  const disableTravelAlerts = useCallback(async () => {
    if (!preferences || !accessToken || travelBusy) return;
    setTravelBusy(true);
    setNotice(null);
    try {
      await clearTravelNotificationRegion(accessToken);
      patchPreferences({ travel_live_enabled: false });
      setTravelRegion(null);
    } catch (travelError) {
      setNotice(travelError instanceof Error ? travelError.message : 'Current-area alerts could not be disabled.');
    } finally {
      setTravelBusy(false);
    }
  }, [accessToken, patchPreferences, preferences, travelBusy]);

  const toggleListenerPrayer = useCallback((prayer: NotificationPrayer) => {
    const current = preferencesRef.current;
    if (!current) return;
    const selected = current.listener_prayers.includes(prayer);
    if (selected && current.listener_prayers.length === 1) return;
    const prayers = selected
      ? current.listener_prayers.filter((item) => item !== prayer)
      : PRAYER_NAMES.filter((item) => current.listener_prayers.includes(item) || item === prayer);
    void commit({ listener_prayers: prayers }, 'listener_prayers');
  }, [commit]);

  const toggleMuezzinLead = useCallback((minutes: number) => {
    const current = preferencesRef.current;
    if (!current) return;
    const selected = current.muezzin_lead_minutes.includes(minutes);
    if (selected && current.muezzin_lead_minutes.length === 1) return;
    const leads = selected
      ? current.muezzin_lead_minutes.filter((item) => item !== minutes)
      : [...current.muezzin_lead_minutes, minutes].sort((a, b) => b - a);
    void commit({ muezzin_lead_minutes: leads }, 'muezzin_lead_minutes');
  }, [commit]);

  const handleSwitchWorkspace = useCallback(async () => {
    if (!userId || workspaceBusy) return;
    setWorkspaceBusy(true);
    setNotice(null);
    try {
      await requireRoleEntrySelection(userId);
      router.replace('/role-entry' as any);
    } catch (workspaceError) {
      setNotice(workspaceError instanceof Error ? workspaceError.message : 'The workspace chooser could not be opened.');
      setWorkspaceBusy(false);
    }
  }, [userId, workspaceBusy]);

  const handleMarkAll = async () => {
    if (!userId || !accessToken) return;
    setActivityBusy(true);
    try {
      await markAllAppNotificationsRead(userId, accessToken);
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
    } finally {
      setActivityBusy(false);
    }
  };

  const handleOpenActivity = async (item: AppNotification) => {
    if (!item.read_at) {
      try {
        await markAppNotificationRead(item.id, accessToken);
        setItems((current) => current.map((row) => (
          row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row
        )));
      } catch {
        // A read receipt is cosmetic and must not block the activity item.
      }
    }
  };

  const activeTravelRegion = useMemo(() => formatRegionExpiry(travelRegion), [travelRegion]);
  const permissionGranted = permission === 'granted' || permission === 'provisional';
  const deviceReady = permissionGranted && deviceRegistered;
  const deviceStatus = deviceChecking
    ? 'Checking this device…'
    : deviceReady
      ? permission === 'provisional' ? 'Ready for quiet alerts' : 'Ready for alerts'
      : permissionGranted
        ? 'Setup needs attention'
        : permission === 'denied'
          ? 'Disabled in device settings'
          : permission === 'unavailable'
            ? Platform.OS === 'web' ? 'Available in the mobile app' : 'Requires a physical device'
            : 'Not enabled yet';
  const deviceAction = permission === 'denied'
    ? 'Settings'
    : permission === 'unavailable'
      ? null
      : permissionGranted && !deviceRegistered
        ? 'Retry'
        : !permissionGranted
          ? 'Enable'
          : null;

  return (
    <>
      <Appbar.Header style={styles.appbar}>
        <Appbar.BackAction
          onPress={() => router.replace(
            (isMuezzinWorkspace ? '/(muezzin)/muezzin-settings' : '/(user)/settings') as any
          )}
        />
        <Appbar.Content title="Notifications" />
        {roles.hasMultipleWorkspaceAccess ? (
          <Appbar.Action
            accessibilityLabel="Switch workspace"
            disabled={workspaceBusy}
            icon="swap-horizontal"
            onPress={() => void handleSwitchWorkspace()}
          />
        ) : null}
      </Appbar.Header>

      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="notifications-outline" size={23} color="#2F6B45" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>
              {isMuezzinWorkspace ? 'Stay ready for every duty' : 'Useful alerts, on your terms'}
            </Text>
            <Text style={styles.heroBody}>
              {isMuezzinWorkspace
                ? 'Choose reminders for your assignments and LIVE broadcast responsibilities.'
                : 'Choose Adhan and travel alerts without changing your followed or default mosque.'}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={deviceBusy || deviceChecking || permission === 'unavailable'}
          onPress={() => {
            if (permission === 'denied') void Linking.openSettings();
            else if (!deviceReady) void ensureDeviceReady();
          }}
          style={({ pressed }) => [styles.permissionCard, pressed && styles.pressed]}
        >
          <View style={styles.permissionIcon}>
            <Ionicons
              name={deviceReady ? 'checkmark' : 'phone-portrait-outline'}
              size={18}
              color={deviceReady ? '#2F6B45' : '#64748B'}
            />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.permissionTitle}>This device</Text>
            <Text style={styles.permissionBody}>{deviceStatus}</Text>
          </View>
          {deviceBusy || deviceChecking ? (
            <ActivityIndicator size="small" color="#2F6B45" />
          ) : deviceAction ? (
            <Text style={styles.permissionAction}>{deviceAction}</Text>
          ) : null}
        </Pressable>

        {deviceMessage ? (
          <View style={styles.deviceNotice}>
            <Text style={styles.deviceNoticeText}>{deviceMessage}</Text>
            {permission !== 'unavailable' ? (
              <Pressable onPress={() => void ensureDeviceReady()}>
                <Text style={styles.deviceNoticeAction}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {notice ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={19} color="#2F6B45" />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
        {error && preferences ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.inlineButton}>
              <Text style={styles.inlineButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {loading && !preferences ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#2F6B45" />
            <Text style={styles.loadingText}>Loading your preferences…</Text>
          </View>
        ) : !preferences ? (
          <View style={styles.recoveryCard}>
            <Ionicons name="cloud-offline-outline" size={27} color="#7A9B83" />
            <Text style={styles.recoveryTitle}>Preferences are temporarily unavailable</Text>
            <Text style={styles.recoveryBody}>
              {error || 'Check your connection and try again. Your existing choices have not changed.'}
            </Text>
            <Pressable onPress={() => void load()} style={styles.recoveryButton}>
              <Text style={styles.recoveryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {!isMuezzinWorkspace ? (
              <Section
                eyebrow="LISTENER"
                title="Adhan alerts"
                description="Choose the moments that are genuinely useful to you."
              >
              <SettingRow
                title="Upcoming Adhan"
                description="A single reminder before the selected prayer time."
                value={preferences.listener_upcoming_enabled}
                saving={savingKeys.includes('listener_upcoming_enabled')}
                onChange={(value) => updateBoolean('listener_upcoming_enabled', value)}
              />
              {preferences.listener_upcoming_enabled ? (
                <View style={styles.detailGroup}>
                  <Text style={styles.detailLabel}>REMIND ME</Text>
                  <View style={styles.chipRow}>
                    {[5, 10, 15, 30].map((minutes) => (
                      <ChoiceChip
                        key={minutes}
                        label={`${minutes} min`}
                        selected={preferences.listener_lead_minutes === minutes}
                        disabled={savingKeys.includes('listener_lead_minutes')}
                        onPress={() => void commit(
                          { listener_lead_minutes: minutes as 5 | 10 | 15 | 30 },
                          'listener_lead_minutes'
                        )}
                      />
                    ))}
                  </View>

                  <Text style={styles.detailLabel}>FOR</Text>
                  <View style={styles.chipRow}>
                    <ChoiceChip
                      label={primaryMosqueName ? `Primary · ${primaryMosqueName}` : 'Primary mosque'}
                      selected={preferences.listener_mosque_scope === 'primary'}
                      disabled={savingKeys.includes('listener_mosque_scope') || !preferences.listener_primary_mosque_id}
                      onPress={() => void commit({ listener_mosque_scope: 'primary' }, 'listener_mosque_scope')}
                    />
                    <ChoiceChip
                      label="All followed"
                      selected={preferences.listener_mosque_scope === 'all_followed'}
                      disabled={savingKeys.includes('listener_mosque_scope')}
                      onPress={() => void commit({ listener_mosque_scope: 'all_followed' }, 'listener_mosque_scope')}
                    />
                  </View>

                  <Text style={styles.detailLabel}>PRAYERS</Text>
                  <View style={styles.chipRow}>
                    {PRAYER_NAMES.map((prayer) => {
                      const selected = preferences.listener_prayers.includes(prayer);
                      return (
                        <ChoiceChip
                          key={prayer}
                          label={PRAYER_LABELS[prayer]}
                          selected={selected}
                          disabled={selected && preferences.listener_prayers.length === 1}
                          onPress={() => toggleListenerPrayer(prayer)}
                        />
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.divider} />
              <SettingRow
                title="When an Adhan goes LIVE"
                description="Receive an alert from your primary or followed mosques."
                value={preferences.listener_live_enabled}
                saving={savingKeys.includes('listener_live_enabled')}
                onChange={(value) => updateBoolean('listener_live_enabled', value)}
              />
              </Section>
            ) : null}

            {isMuezzinWorkspace ? (
              <Section
                eyebrow="MUEZZIN"
                title="My duties"
                description="Operational reminders use your existing assignments and rota."
              >
                <SettingRow
                  title="Assignment and rota changes"
                  description="Push the same staff updates that remain available in Activity below."
                  value={preferences.muezzin_assignment_updates_enabled}
                  saving={savingKeys.includes('muezzin_assignment_updates_enabled')}
                  onChange={(value) => updateBoolean('muezzin_assignment_updates_enabled', value)}
                />
                <View style={styles.divider} />
                <SettingRow
                  title="Upcoming duty"
                  description="Prepare early, then open LIVE when the 3-minute window begins."
                  value={preferences.muezzin_duty_reminders_enabled}
                  saving={savingKeys.includes('muezzin_duty_reminders_enabled')}
                  onChange={(value) => updateBoolean('muezzin_duty_reminders_enabled', value)}
                />
                {preferences.muezzin_duty_reminders_enabled ? (
                  <View style={styles.detailGroup}>
                    <Text style={styles.detailLabel}>REMIND ME</Text>
                    <Text style={styles.detailHint}>
                      3 min opens LIVE. Earlier reminders open My Rota. Select one or more.
                    </Text>
                    <View style={styles.chipRow}>
                      {[3, 5, 10, 30].map((minutes) => {
                        const selected = preferences.muezzin_lead_minutes.includes(minutes);
                        return (
                          <ChoiceChip
                            key={minutes}
                            label={`${minutes} min`}
                            selected={selected}
                            showCheckmark
                            disabled={selected && preferences.muezzin_lead_minutes.length === 1}
                            onPress={() => toggleMuezzinLead(minutes)}
                          />
                        );
                      })}
                    </View>
                    <Text style={styles.saveState}>
                      {savingKeys.includes('muezzin_lead_minutes')
                        ? 'Saving reminder times…'
                        : `${preferences.muezzin_lead_minutes.length} reminder${preferences.muezzin_lead_minutes.length === 1 ? '' : 's'} selected`}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.divider} />
                <SettingRow
                  title="LIVE status"
                  description="Know when an active mosque you serve begins broadcasting."
                  value={preferences.muezzin_live_enabled}
                  saving={savingKeys.includes('muezzin_live_enabled')}
                  onChange={(value) => updateBoolean('muezzin_live_enabled', value)}
                />
              </Section>
            ) : null}

            {!isMuezzinWorkspace ? (
              <Section
                eyebrow="TRAVEL"
                title="Current-area LIVE alerts"
                description="Useful for a journey, without changing your primary or followed mosques."
              >
              <View style={styles.travelHeader}>
                <View style={styles.travelIcon}>
                  <Ionicons name="navigate-outline" size={20} color="#2F6B45" />
                </View>
                <View style={styles.settingCopy}>
                  <Text style={styles.settingTitle}>{activeTravelRegion || 'Off'}</Text>
                  <Text style={styles.settingDescription}>
                    We store an approximately 1 km area for no more than 24 hours—not your journey history.
                  </Text>
                </View>
              </View>

              <Text style={styles.detailLabel}>RADIUS</Text>
              <View style={styles.chipRow}>
                {[5, 15, 30].map((radius) => (
                  <ChoiceChip
                    key={radius}
                    label={`${radius} km`}
                    selected={preferences.travel_radius_km === radius}
                    disabled={savingKeys.includes('travel_radius_km') || travelBusy}
                    onPress={() => void commit({ travel_radius_km: radius }, 'travel_radius_km').then((saved) => {
                      if (saved && activeTravelRegion) {
                        setNotice('Radius saved. Refresh your current area below to apply an increased radius now.');
                      }
                    })}
                  />
                ))}
              </View>

              <View style={styles.travelActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={travelBusy}
                  onPress={() => void enableTravelForCurrentArea()}
                  style={({ pressed }) => [styles.primaryButton, travelBusy && styles.disabled, pressed && styles.pressed]}
                >
                  {travelBusy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="location" size={18} color="#FFFFFF" />}
                  <Text style={styles.primaryButtonText}>{activeTravelRegion ? 'Refresh for 24 hours' : 'Use my current area'}</Text>
                </Pressable>
                {activeTravelRegion ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={travelBusy}
                    onPress={() => {
                      Alert.alert(
                        'Turn off current-area alerts?',
                        'Your primary and followed mosques will stay unchanged.',
                        [
                          { text: 'Keep alerts', style: 'cancel' },
                          { text: 'Turn off', style: 'destructive', onPress: () => void disableTravelAlerts() },
                        ]
                      );
                    }}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.secondaryButtonText}>Turn off</Text>
                  </Pressable>
                ) : null}
              </View>
              </Section>
            ) : null}

            {isMuezzinWorkspace ? (
              <Section
                eyebrow="ACTIVITY"
                title="Assignment updates"
                description="Your existing rota, cover and approval history remains here."
              >
              {items.some((item) => !item.read_at) ? (
                <Pressable disabled={activityBusy} onPress={() => void handleMarkAll()} style={styles.markAllButton}>
                  <Ionicons name="checkmark-done" size={17} color="#2F6B45" />
                  <Text style={styles.markAllText}>Mark all as read</Text>
                </Pressable>
              ) : null}

              {items.length ? items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => void handleOpenActivity(item)}
                  style={({ pressed }) => [
                    styles.activityItem,
                    !item.read_at && styles.activityItemUnread,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.activityDotWrap}>
                    <View style={[styles.activityDot, item.read_at && styles.activityDotRead]} />
                  </View>
                  <View style={styles.settingCopy}>
                    <Text style={styles.activityTitle}>{item.title}</Text>
                    <Text style={styles.activityBody} numberOfLines={3}>{item.body}</Text>
                    <Text style={styles.activityTime}>
                      {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                    </Text>
                  </View>
                </Pressable>
              )) : (
                <View style={styles.emptyActivity}>
                  <Ionicons name="checkmark-circle-outline" size={27} color="#7A9B83" />
                  <Text style={styles.emptyActivityTitle}>You’re up to date</Text>
                  <Text style={styles.emptyActivityBody}>Rota assignments and cover updates will appear here.</Text>
                </View>
              )}
              </Section>
            ) : null}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  appbar: { backgroundColor: '#F7F9F8' },
  page: { flex: 1, backgroundColor: '#F7F9F8' },
  content: { padding: 16, paddingBottom: 44, gap: 14 },
  hero: {
    backgroundColor: '#EAF3EC',
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    gap: 13,
    borderWidth: 1,
    borderColor: '#D3E5D7',
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: 19, lineHeight: 24, fontWeight: '800', color: '#183526' },
  heroBody: { marginTop: 5, fontSize: 14, lineHeight: 20, color: '#4F6B59' },
  permissionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DEE6E1',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EEF5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: { fontSize: 14, fontWeight: '800', color: '#183526' },
  permissionBody: { marginTop: 2, fontSize: 13, color: '#617267' },
  permissionAction: { fontSize: 13, fontWeight: '800', color: '#2F6B45' },
  notice: {
    backgroundColor: '#EFF6F0',
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  noticeText: { flex: 1, color: '#31553D', fontSize: 13, lineHeight: 19 },
  deviceNotice: {
    backgroundColor: '#FFF8E7',
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deviceNoticeText: { flex: 1, color: '#745C20', fontSize: 13, lineHeight: 18 },
  deviceNoticeAction: { color: '#725A18', fontSize: 13, fontWeight: '800' },
  errorCard: { backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14, gap: 10 },
  errorText: { color: '#991B1B', fontSize: 13, lineHeight: 19 },
  inlineButton: { alignSelf: 'flex-start', paddingVertical: 5 },
  inlineButtonText: { color: '#991B1B', fontWeight: '800' },
  loadingCard: { alignItems: 'center', paddingVertical: 42, gap: 10 },
  loadingText: { color: '#64748B' },
  recoveryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DEE6E1',
    padding: 24,
    alignItems: 'center',
  },
  recoveryTitle: { marginTop: 10, color: '#183526', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  recoveryBody: { marginTop: 6, color: '#66776B', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  recoveryButton: { marginTop: 15, minHeight: 42, paddingHorizontal: 20, justifyContent: 'center' },
  recoveryButtonText: { color: '#2F6B45', fontSize: 14, fontWeight: '800' },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DEE6E1',
    padding: 18,
  },
  eyebrow: { color: '#4F765B', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { marginTop: 5, color: '#183526', fontSize: 22, lineHeight: 28, fontWeight: '800' },
  sectionDescription: { marginTop: 5, color: '#66776B', fontSize: 14, lineHeight: 20 },
  sectionBody: { marginTop: 14 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56 },
  settingCopy: { flex: 1 },
  settingControl: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  settingTitle: { color: '#1B2F23', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  settingDescription: { marginTop: 3, color: '#68776D', fontSize: 13, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5EBE7', marginVertical: 13 },
  detailGroup: { marginTop: 14, backgroundColor: '#F7FAF8', borderRadius: 16, padding: 14 },
  detailLabel: { color: '#708078', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 9, marginTop: 4 },
  detailHint: { color: '#68776D', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  choiceChip: {
    minHeight: 40,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8E2DB',
    backgroundColor: '#FFFFFF',
  },
  choiceChipSelected: { backgroundColor: '#DFECE2', borderColor: '#A9C9B0' },
  choiceChipText: { color: '#5F6F65', fontSize: 13, fontWeight: '700' },
  choiceChipTextSelected: { color: '#28593B', fontWeight: '800' },
  saveState: { color: '#708078', fontSize: 11, lineHeight: 16 },
  travelHeader: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  travelIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#EAF3EC', alignItems: 'center', justifyContent: 'center' },
  travelActions: { gap: 9, marginTop: 4 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: '#2F6B45',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#8B3A3A', fontSize: 13, fontWeight: '800' },
  markAllButton: { flexDirection: 'row', alignSelf: 'flex-end', gap: 6, marginBottom: 8, paddingVertical: 5 },
  markAllText: { color: '#2F6B45', fontSize: 13, fontWeight: '800' },
  activityItem: { flexDirection: 'row', gap: 10, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5EBE7' },
  activityItemUnread: { backgroundColor: '#F4F9F5', marginHorizontal: -10, paddingHorizontal: 10, borderRadius: 12 },
  activityDotWrap: { width: 13, paddingTop: 7, alignItems: 'center' },
  activityDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2F6B45' },
  activityDotRead: { backgroundColor: '#CBD5E1' },
  activityTitle: { color: '#1B2F23', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  activityBody: { color: '#66776B', fontSize: 13, lineHeight: 18, marginTop: 3 },
  activityTime: { color: '#94A3B8', fontSize: 11, marginTop: 6 },
  emptyActivity: { alignItems: 'center', paddingVertical: 22 },
  emptyActivityTitle: { marginTop: 7, color: '#31553D', fontSize: 15, fontWeight: '800' },
  emptyActivityBody: { marginTop: 4, color: '#718078', textAlign: 'center', fontSize: 13 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});
