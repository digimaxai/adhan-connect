import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrayerName, labelForPrayer } from '../../lib/adhans';
import { useLiveBroadcastEngine } from '../../lib/hooks/useLiveBroadcastEngine';
import { useMuezzinSchedule } from '../../lib/hooks/useMuezzinSchedule';
import { useMosquePrayerTimes } from '../shared/hooks/useMosquePrayerTimes';

type Params = {
  slotId?: string;
  mosqueId?: string;
  mosqueName?: string;
  prayerName?: string;
  scheduledTime?: string;
  adhanTime?: string;
  mode?: string;
  adhanId?: string;
};

const WINDOW_START_MS = 3 * 60 * 1000; // 3 minutes before
const WINDOW_END_MS = 2 * 60 * 1000; // 2 minutes after
const VALID_PRAYER_KEYS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

function normalizePrayerKey(value?: string | null): PrayerName | null {
  if (!value) return null;
  const normalized = value.toString().trim().toLowerCase();
  return VALID_PRAYER_KEYS.includes(normalized as PrayerName) ? (normalized as PrayerName) : null;
}

const formatCountdown = (seconds: number) => {
  const mins = Math.max(0, Math.floor(seconds / 60));
  const secs = Math.max(0, Math.floor(seconds % 60));
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

function formatHealthStatus(status?: string | null) {
  switch (status) {
    case 'reachable':
      return 'Reachable';
    case 'auth_required':
      return 'Auth required';
    case 'failing':
      return 'Check failed';
    case 'manual_check_required':
      return 'Manual check';
    case 'not_configured':
      return 'Missing';
    case 'not_required':
      return 'Not required';
    default:
      return 'Unknown';
  }
}

export default function MuezzinLiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const { schedule, nextAssignedSlot } = useMuezzinSchedule();
  const paramsMosqueId = params.mosqueId ?? null;
  const resolvedMosqueId = paramsMosqueId ?? schedule?.mosqueId ?? '';
  const fallbackSlot = nextAssignedSlot ?? schedule?.nextMosqueSlot ?? null;
  const selectedSlot = useMemo(() => {
    if (params.slotId) {
      const found = schedule?.slots?.find((slot) => slot.id === params.slotId);
      if (found) return found;
    }
    return fallbackSlot;
  }, [fallbackSlot, params.slotId, schedule?.slots]);
  const mosqueName = params.mosqueName ?? selectedSlot?.mosqueName ?? schedule?.mosqueName ?? 'Mosque';
  const prayerName = params.prayerName ?? (selectedSlot?.prayerName as string) ?? (fallbackSlot?.prayerName as string) ?? 'Adhan';
  const effectivePrayerKey = normalizePrayerKey(
    params.prayerName ?? selectedSlot?.prayerName ?? fallbackSlot?.prayerName ?? null
  );
  const mode = params.mode === 'test' ? 'test' : 'normal';

  const prayerTimes = useMosquePrayerTimes(resolvedMosqueId);
  const [banner, setBanner] = useState<string | null>(null);
  const [showStreamKey, setShowStreamKey] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const adhanFromParams = useMemo(() => {
    const scheduledTime = (params.adhanTime as string | undefined) ?? params.scheduledTime;
    if (!scheduledTime || !effectivePrayerKey) return null;
    return {
      id: params.adhanId ?? params.slotId ?? 'pending',
      mosque_id: resolvedMosqueId,
      prayer: effectivePrayerKey,
      scheduled_at: scheduledTime,
      status: 'scheduled',
    };
  }, [effectivePrayerKey, params.adhanId, params.adhanTime, params.scheduledTime, params.slotId, resolvedMosqueId]);

  const adhanFromSlot = useMemo(() => {
    if (!selectedSlot?.adhanTime) return null;
    return {
      id: selectedSlot.id,
      mosque_id: resolvedMosqueId,
      prayer: selectedSlot.prayerName.toLowerCase(),
      scheduled_at: selectedSlot.adhanTime.toISOString(),
      status: selectedSlot.status ?? 'scheduled',
    };
  }, [resolvedMosqueId, selectedSlot?.adhanTime, selectedSlot?.id, selectedSlot?.prayerName, selectedSlot?.status]);

  const activeAdhan = useMemo(() => {
    if (adhanFromParams) return adhanFromParams;
    if (adhanFromSlot) return adhanFromSlot;
    if (fallbackSlot?.adhanTime) {
      const assignedPrayerKey = fallbackSlot.prayerName.toLowerCase();
      return {
        id: `assigned-${fallbackSlot.prayerName}`,
        mosque_id: resolvedMosqueId,
        prayer: assignedPrayerKey,
        scheduled_at: fallbackSlot.adhanTime.toISOString(),
        status: 'scheduled',
      };
    }
    // Only synthesize from prayer times when the page resolved a concrete prayer.
    const fromTimes = effectivePrayerKey ? prayerTimes.times?.[effectivePrayerKey] : null;
    if (fromTimes) {
      const resolvedPrayerKey = effectivePrayerKey as PrayerName;
      const [h, m] = fromTimes.split(':').map((v) => parseInt(v, 10));
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return {
        id: 'fallback',
        mosque_id: resolvedMosqueId,
        prayer: resolvedPrayerKey,
        scheduled_at: d.toISOString(),
        status: 'scheduled',
      };
    }
    if (mode === 'test' && resolvedMosqueId) {
      const d = new Date();
      d.setSeconds(d.getSeconds() + 120);
      return {
        id: 'test-broadcast',
        mosque_id: resolvedMosqueId,
        prayer: effectivePrayerKey ?? 'maghrib',
        scheduled_at: d.toISOString(),
        status: 'scheduled',
      };
    }
    return null;
  }, [adhanFromParams, adhanFromSlot, effectivePrayerKey, fallbackSlot?.adhanTime, fallbackSlot?.prayerName, mode, prayerTimes.times, resolvedMosqueId]);

  const scheduledDate = useMemo(() => {
    if (activeAdhan?.scheduled_at) return new Date(activeAdhan.scheduled_at);
    if (mode === 'test') {
      const d = new Date();
      d.setSeconds(d.getSeconds() + 120);
      return d;
    }
    return null;
  }, [activeAdhan?.scheduled_at, mode]);

  const engine = useLiveBroadcastEngine(resolvedMosqueId, activeAdhan);

  useEffect(() => {
    if (engine.status === 'READY' || engine.status === 'LIVE') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.05, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [engine.status, pulse]);

  const timeUntil = engine.timeUntilSeconds;
  const windowStartLabel = scheduledDate ? new Date(scheduledDate.getTime() - WINDOW_START_MS) : null;
  const windowEndLabel = scheduledDate ? new Date(scheduledDate.getTime() + WINDOW_END_MS) : null;

  const statusPill = (() => {
    if (engine.isLive) return { label: 'LIVE', bg: '#FEE2E2', color: '#B91C1C' };
    if (engine.isEarly) return { label: 'Not yet', bg: '#E2E8F0', color: '#475569' };
    if (engine.canStart) return { label: 'Ready', bg: '#DCFCE7', color: '#166534' };
    if (engine.isLate) return { label: 'Completed', bg: '#E2E8F0', color: '#475569' };
    return { label: 'Scheduled', bg: '#E2E8F0', color: '#475569' };
  })();

  const broadcastConfigured = engine.config?.is_ready_for_broadcast ?? true;
  const preflightStatus = engine.config?.encoder_preflight_status ?? (broadcastConfigured ? 'manual_check_required' : 'not_configured');
  const helperText = (() => {
    if (engine.isLive) return 'Broadcast is live.';
    if (!broadcastConfigured) return engine.config?.issues?.[0] ?? 'This mosque is not configured for follower playback yet.';
    if (preflightStatus === 'attention') {
      return engine.config?.encoder_preflight_summary ?? 'Endpoint preflight needs attention before you go live.';
    }
    if (preflightStatus === 'manual_check_required') {
      return engine.config?.encoder_preflight_summary ?? 'Configuration is ready. Complete the provider check before going live.';
    }
    if (engine.isEarly) return 'You can start within 3 minutes before the adhan time.';
    if (engine.canStart) return 'Ready to start broadcast.';
    if (engine.isLate) return 'Adhan window has passed.';
    return 'Awaiting schedule.';
  })();

  const isAssigned = selectedSlot?.isAssignedToMe ?? fallbackSlot?.isAssignedToMe ?? false;

  const connectionStatus = engine.isLive
    ? 'Stream connected'
    : engine.loading
    ? 'Connecting...'
    : preflightStatus === 'attention'
    ? 'Endpoint check failed'
    : preflightStatus === 'manual_check_required'
    ? 'Manual provider check needed'
    : broadcastConfigured
    ? 'Endpoint preflight passed'
    : 'Needs configuration';

  const providerName = engine.config?.provider_label ?? engine.config?.provider ?? 'External';
  const usesExternalEncoder = !!engine.config?.supports_external_encoder;
  const playbackUrl = engine.config?.playback_url ?? engine.stream?.stream_url ?? engine.stream?.url ?? null;
  const ingestUrl = engine.config?.ingest_url ?? null;
  const usernameValue = engine.config?.username ?? null;
  const streamKeyValue = showStreamKey ? engine.config?.stream_key ?? null : engine.config?.masked_stream_key ?? null;
  const encoderCredentialsLabel = !usesExternalEncoder
    ? 'Not required'
    : engine.config?.is_ready_for_external_encoder
    ? 'Configured'
    : engine.config?.requires_ingest_url || engine.config?.requires_username || engine.config?.requires_stream_key
    ? 'Required'
    : 'Optional';
  const credentialLabel = engine.config?.credential_label ?? 'Stream key';
  const usernameLabel = engine.config?.username_label ?? 'Username';
  const providerSummary = engine.config?.provider_summary ?? 'Mosque live streaming details';
  const readinessMessage = usesExternalEncoder
    ? engine.config?.is_ready_for_external_encoder
      ? 'Mosque playback and encoder settings are in place.'
      : engine.config?.requires_ingest_url || engine.config?.requires_username || engine.config?.requires_stream_key
      ? 'This provider requires encoder credentials before the muezzin can go live.'
      : 'Follower playback is ready. Encoder details are optional for this provider.'
    : 'Follower playback is the only requirement in test mode.';
  const playbackHealthLabel = formatHealthStatus(engine.config?.playback_health?.status);
  const ingestHealthLabel = formatHealthStatus(engine.config?.ingest_health?.status);
  const preflightLabel = (() => {
    switch (preflightStatus) {
      case 'ready':
        return 'Passed';
      case 'attention':
        return 'Needs attention';
      case 'manual_check_required':
        return 'Manual check';
      default:
        return 'Not ready';
    }
  })();
  const upstreamStatusLabel = engine.config?.upstream_status
    ? engine.config.upstream_status.charAt(0).toUpperCase() + engine.config.upstream_status.slice(1)
    : 'No signal';
  const upstreamLastSeenLabel = engine.config?.upstream_last_seen_at
    ? new Date(engine.config.upstream_last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleCopy = async (label: string, value?: string | null) => {
    if (!value) {
      setBanner(`${label} is not configured`);
      return;
    }
    try {
      await Clipboard.setStringAsync(value);
      setBanner(`${label} copied`);
    } catch {
      setBanner(`Could not copy ${label.toLowerCase()}`);
    }
  };

  const handlePrimaryPress = async () => {
    setBanner(null);
    if (engine.isLive) {
      const success = await engine.endBroadcast();
      if (success) setBanner('Broadcast ended');
    } else {
      const success = await engine.startBroadcast();
      if (success) setBanner('Broadcast started');
    }
  };

  const circleStyle = (() => {
    if (engine.isLive)
      return {
        bg: '#DC2626',
        main: 'Live',
        sub: engine.stream?.started_at ? `Since ${new Date(engine.stream.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Tap to end',
      };
    if (engine.canStart)
      return {
        bg: '#0EA5E9',
        main: 'Ready',
        sub: timeUntil !== null ? `Starts in ${formatCountdown(timeUntil)}` : 'Tap to start',
      };
    if (!broadcastConfigured)
      return {
        bg: '#CBD5E1',
        main: 'Config needed',
        sub: 'Set follower playback before going live',
      };
    if (engine.isEarly)
      return {
        bg: '#E2E8F0',
        main: 'Too early',
        sub: 'You can start within 3 minutes before time',
      };
    if (engine.isLate)
      return { bg: '#0F172A', main: 'Completed', sub: 'Adhan window ended' };
    return { bg: '#E2E8F0', main: 'Scheduled', sub: timeUntil !== null ? `In ${formatCountdown(timeUntil)}` : '' };
  })();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>Live Broadcast</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{labelForPrayer(prayerName as any)} for {mosqueName}</Text>
        <View style={[styles.statusPill, { backgroundColor: statusPill.bg }]}>
          <Text style={[styles.statusPillText, { color: statusPill.color }]}>{statusPill.label}</Text>
        </View>
        {isAssigned ? <Text style={styles.assignmentNote}>You are assigned to this adhan today.</Text> : null}

        {(banner || engine.errorMessage) ? (
          <View style={[styles.banner, engine.errorMessage ? styles.bannerError : null]}>
            <Text style={[styles.bannerText, engine.errorMessage ? styles.bannerErrorText : null]}>
              {engine.errorMessage ?? banner}
            </Text>
          </View>
        ) : null}

        <View style={styles.circleWrap}>
          <Animated.View style={[styles.circleOuter, (engine.canStart || engine.isLive) && timeUntil !== null ? styles.circleOuterReady : null, { transform: [{ scale: pulse }] }]}>
            <Pressable
              disabled={engine.loading || (!engine.isLive && (!engine.canStart || !broadcastConfigured))}
              onPress={handlePrimaryPress}
              style={({ pressed }) => [
                styles.circle,
                {
                  backgroundColor: circleStyle.bg,
                  opacity: pressed && !engine.isEarly ? 0.9 : engine.isEarly ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons
                name="mic"
                size={36}
                color={engine.isEarly ? '#475569' : '#FFFFFF'}
                style={{ marginBottom: 10 }}
              />
              <Text style={styles.circleText}>{engine.loading ? 'Working...' : circleStyle.main}</Text>
              {circleStyle.sub ? <Text style={styles.circleSub}>{circleStyle.sub}</Text> : null}
            </Pressable>
          </Animated.View>
        </View>
        <Text style={styles.helperText}>{helperText}</Text>

        <View style={styles.metaCard}>
          <Text style={styles.metaHeading}>Stream readiness</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Provider</Text>
            <Text style={styles.metaValue}>{providerName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Follower playback</Text>
            <Text style={styles.metaValue}>{engine.config?.playback_url_configured ? 'Configured' : 'Missing'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Encoder credentials</Text>
            <Text style={styles.metaValue}>{encoderCredentialsLabel}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Endpoint preflight</Text>
            <Text style={styles.metaValue}>{preflightLabel}</Text>
          </View>
          {engine.config?.issues?.length ? (
            <Text style={styles.readinessNote}>{engine.config.issues.join(' ')}</Text>
          ) : (
            <Text style={styles.readinessNote}>{readinessMessage}</Text>
          )}
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaHeading}>Encoder setup</Text>
          <Text style={styles.readinessNote}>{providerSummary}</Text>

          <View style={styles.detailBlock}>
            <View style={styles.detailHeaderRow}>
              <Text style={styles.detailLabel}>Follower playback URL</Text>
              {playbackUrl ? (
                <Pressable onPress={() => void handleCopy('Follower playback URL', playbackUrl)} style={styles.detailAction}>
                  <Text style={styles.detailActionText}>Copy</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.detailValue}>{playbackUrl ?? 'Not configured'}</Text>
          </View>

          {usesExternalEncoder ? (
            <>
              <View style={styles.detailBlock}>
                <View style={styles.detailHeaderRow}>
                  <Text style={styles.detailLabel}>Encoder ingest URL</Text>
                  {ingestUrl ? (
                    <Pressable onPress={() => void handleCopy('Encoder ingest URL', ingestUrl)} style={styles.detailAction}>
                      <Text style={styles.detailActionText}>Copy</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.detailValue}>{ingestUrl ?? 'Not configured'}</Text>
              </View>

              {engine.config?.username_label ? (
                <View style={styles.detailBlock}>
                  <View style={styles.detailHeaderRow}>
                    <Text style={styles.detailLabel}>{usernameLabel}</Text>
                    {usernameValue ? (
                      <Pressable onPress={() => void handleCopy(usernameLabel, usernameValue)} style={styles.detailAction}>
                        <Text style={styles.detailActionText}>Copy</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={styles.detailValue}>{usernameValue ?? 'Not configured'}</Text>
                </View>
              ) : null}

              <View style={styles.detailBlock}>
                <View style={styles.detailHeaderRow}>
                  <Text style={styles.detailLabel}>{credentialLabel}</Text>
                  <View style={styles.detailActions}>
                    {engine.config?.masked_stream_key ? (
                      <Pressable onPress={() => setShowStreamKey((value) => !value)} style={styles.detailAction}>
                        <Text style={styles.detailActionText}>{showStreamKey ? 'Hide' : 'Reveal'}</Text>
                      </Pressable>
                    ) : null}
                    {engine.config?.stream_key ? (
                      <Pressable
                        onPress={() => void handleCopy(credentialLabel, engine.config?.stream_key)}
                        style={styles.detailAction}
                      >
                        <Text style={styles.detailActionText}>Copy</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.detailValue}>{streamKeyValue ?? 'Not configured'}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.readinessNote}>
              This mosque is in test mode. No external encoder credentials are required.
            </Text>
          )}

          {engine.config?.encoder_instructions ? (
            <Text style={styles.encoderInstruction}>{engine.config.encoder_instructions}</Text>
          ) : null}
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaHeading}>Endpoint health</Text>
          <Text style={styles.readinessNote}>
            {engine.config?.encoder_preflight_summary ?? 'Endpoint checks run automatically while this screen is open.'}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Playback endpoint</Text>
            <Text style={styles.metaValue}>{playbackHealthLabel}</Text>
          </View>
          {engine.config?.playback_health?.message ? (
            <Text style={styles.healthMessage}>{engine.config.playback_health.message}</Text>
          ) : null}
          {usesExternalEncoder ? (
            <>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Ingest endpoint</Text>
                <Text style={styles.metaValue}>{ingestHealthLabel}</Text>
              </View>
              {engine.config?.ingest_health?.message ? (
                <Text style={styles.healthMessage}>{engine.config.ingest_health.message}</Text>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaHeading}>Upstream provider state</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Provider status</Text>
            <Text style={styles.metaValue}>{upstreamStatusLabel}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Encoder connected</Text>
            <Text style={styles.metaValue}>{engine.config?.upstream_encoder_connected ? 'Yes' : 'No'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Playback active</Text>
            <Text style={styles.metaValue}>{engine.config?.upstream_playback_active ? 'Yes' : 'No'}</Text>
          </View>
          {upstreamLastSeenLabel ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Last provider signal</Text>
              <Text style={styles.metaValue}>{upstreamLastSeenLabel}</Text>
            </View>
          ) : null}
          {engine.config?.upstream_stream_id ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Provider stream ID</Text>
              <Text style={styles.metaValue}>{engine.config.upstream_stream_id}</Text>
            </View>
          ) : null}
          <Text style={styles.healthMessage}>
            {engine.config?.upstream_message ??
              'No provider callback has been received yet. RTMP providers will stay in manual-check mode until a callback or vendor integration reports encoder state.'}
          </Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaHeading}>Timing</Text>
          {scheduledDate ? (
            <>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Scheduled</Text>
                <Text style={styles.metaValue}>{scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              {windowStartLabel && windowEndLabel ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Live window</Text>
                  <Text style={styles.metaValue}>
                    {windowStartLabel.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {windowEndLabel.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Scheduled</Text>
              <Text style={styles.metaValue}>Soon</Text>
            </View>
          )}
          {engine.isLive && engine.stream?.started_at ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Live since</Text>
              <Text style={styles.metaValue}>
                {new Date(engine.stream.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ) : !engine.isLate && timeUntil !== null ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Time until adhan</Text>
              <Text style={styles.metaValue}>{formatCountdown(timeUntil)}</Text>
            </View>
          ) : null}
        </View>

        {engine.isLive ? (
          <Pressable onPress={handlePrimaryPress} style={({ pressed }) => [styles.secondaryAction, { opacity: pressed ? 0.85 : 1 }]}>
            <Text style={styles.secondaryActionText}>End and mark adhan completed</Text>
          </Pressable>
        ) : null}

        <View style={styles.connectionRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="radio-outline" size={18} color="#0F172A" />
            <Text style={styles.connectionText}>{connectionStatus}</Text>
          </View>
          <Text style={styles.connectionMuted}>Listeners: --</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  content: { flex: 1, paddingHorizontal: 16, gap: 14 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: { fontWeight: '800', fontSize: 12 },
  banner: {
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 10,
  },
  bannerText: { color: '#166534', fontWeight: '700' },
  bannerError: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  bannerErrorText: { color: '#B91C1C' },
  circleWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 12, marginBottom: 8 },
  circleOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  circleOuterReady: {
    backgroundColor: '#E0F2FE',
  },
  circle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  circleText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17, marginBottom: 2 },
  circleSub: { color: '#E0F2FE', fontWeight: '700', fontSize: 14 },
  helperText: { textAlign: 'center', color: '#475569', marginTop: 6, fontWeight: '600' },
  assignmentNote: { color: '#0F172A', fontWeight: '700', marginTop: 6 },
  readinessNote: { color: '#475569', fontWeight: '600', marginTop: 2, lineHeight: 20 },
  healthMessage: { color: '#334155', fontWeight: '600', lineHeight: 20 },
  detailBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailLabel: { color: '#475569', fontWeight: '700', flex: 1 },
  detailValue: { color: '#0F172A', fontWeight: '700', lineHeight: 20 },
  detailActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  detailActionText: { color: '#0F172A', fontWeight: '800', fontSize: 12 },
  encoderInstruction: {
    color: '#0F172A',
    fontWeight: '600',
    lineHeight: 20,
  },
  metaCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  metaHeading: { color: '#0F172A', fontWeight: '800', fontSize: 14 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { color: '#475569', fontWeight: '700' },
  metaValue: { color: '#0F172A', fontWeight: '800' },
  secondaryAction: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryActionText: { color: '#DC2626', fontWeight: '800' },
  connectionRow: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectionText: { color: '#0F172A', fontWeight: '700' },
  connectionMuted: { color: '#94A3B8', fontWeight: '700' },
});
