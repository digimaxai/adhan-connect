import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NearbyMosque } from '../lib/hooks/useMosquesNearby';

const PRAYER_LABELS: Record<string, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

function prayerLabel(value: string | null) {
  if (!value) return 'Adhan';
  return PRAYER_LABELS[value.toLowerCase()] ?? `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function timeLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

type Props = {
  mosques: NearbyMosque[];
  loading: boolean;
  error: string | null;
  freshAsOf: string | null;
  onRefresh: () => void;
  onViewMosque: (mosque: NearbyMosque) => void;
  onListen: (mosque: NearbyMosque) => void;
  onDirections: (mosque: NearbyMosque) => void;
  limit?: number;
};

export const NearYouNowCard = React.memo(function NearYouNowCard({
  mosques,
  loading,
  error,
  freshAsOf,
  onRefresh,
  onViewMosque,
  onListen,
  onDirections,
  limit = 4,
}: Props) {
  const visible = mosques.slice(0, limit);
  const updatedLabel = freshAsOf
    ? `Updated ${new Date(freshAsOf).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : 'Your current area';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="navigate" size={17} color="#2F6B45" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CURRENT AREA</Text>
          <Text style={styles.title}>Near you now</Text>
          <Text style={styles.updated}>{updatedLabel} · does not change your primary mosque</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh nearby mosques"
          disabled={loading}
          onPress={onRefresh}
          hitSlop={10}
          style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#2F6B45" />
          ) : (
            <Ionicons name="refresh" size={18} color="#2F6B45" />
          )}
        </Pressable>
      </View>

      {error && !visible.length ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>Nearby mosques are taking longer than expected</Text>
          <Text style={styles.stateBody}>Your primary and followed mosques are still available below.</Text>
          <Pressable onPress={onRefresh} style={styles.tryAgain}>
            <Text style={styles.tryAgainText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {loading && !visible.length ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#2F6B45" />
          <Text style={styles.loadingText}>Finding mosques and their next Adhan…</Text>
        </View>
      ) : null}

      {!loading && !error && !visible.length ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>No active mosques found nearby</Text>
          <Text style={styles.stateBody}>Try refreshing after you move, or use mosque search.</Text>
        </View>
      ) : null}

      {visible.map((mosque) => {
        const nextTime = timeLabel(mosque.next_adhan_at);
        const source = mosque.schedule_source === 'mosque'
          ? 'Mosque timetable'
          : mosque.schedule_source === 'calculated'
            ? 'Calculated estimate'
            : 'Time unavailable';

        return (
          <View key={mosque.id} style={[styles.mosqueRow, mosque.is_live && styles.mosqueRowLive]}>
            <View style={styles.mosqueTopline}>
              <View style={styles.mosqueCopy}>
                <View style={styles.nameLine}>
                  {mosque.is_live ? <View style={styles.liveDot} /> : null}
                  <Text style={styles.mosqueName} numberOfLines={1}>{mosque.name}</Text>
                </View>
                <Text style={styles.location} numberOfLines={1}>
                  {mosque.distance_km.toFixed(1)} km · {mosque.city}
                </Text>
              </View>
              {mosque.is_live ? (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE · {prayerLabel(mosque.live_prayer)}</Text>
                </View>
              ) : (
                <View style={styles.timeCopy}>
                  <Text style={styles.nextPrayer}>{prayerLabel(mosque.next_prayer)}</Text>
                  <Text style={styles.nextTime}>{nextTime ?? '—'}</Text>
                </View>
              )}
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.source}>{source}</Text>
              {!mosque.is_live && mosque.minutes_until !== null ? (
                <Text style={styles.countdown}>in {mosque.minutes_until} min</Text>
              ) : null}
            </View>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => onDirections(mosque)}
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
              >
                <Ionicons name="navigate-outline" size={15} color="#2F6B45" />
                <Text style={styles.secondaryActionText}>Directions</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => mosque.is_live ? onListen(mosque) : onViewMosque(mosque)}
                style={({ pressed }) => [styles.primaryAction, mosque.is_live && styles.liveAction, pressed && styles.pressed]}
              >
                <Ionicons name={mosque.is_live ? 'play' : 'arrow-forward'} size={15} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>{mosque.is_live ? 'Listen live' : 'View mosque'}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F0F6F1',
    borderColor: '#D4E4D7',
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 2 },
  headerIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#577862', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#183526', fontSize: 20, lineHeight: 24, fontWeight: '900', marginTop: 2 },
  updated: { color: '#718078', fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  refresh: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  loadingRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#5D7062', fontSize: 13 },
  stateBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14 },
  stateTitle: { color: '#203A2A', fontSize: 14, fontWeight: '800' },
  stateBody: { color: '#6A786F', fontSize: 12, lineHeight: 18, marginTop: 4 },
  tryAgain: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  tryAgainText: { color: '#2F6B45', fontSize: 13, fontWeight: '800' },
  mosqueRow: { backgroundColor: '#FFFFFF', borderColor: '#DEE8E0', borderRadius: 17, borderWidth: 1, padding: 13 },
  mosqueRowLive: { borderColor: '#F1C8C8' },
  mosqueTopline: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  mosqueCopy: { flex: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D64545' },
  mosqueName: { flex: 1, color: '#182A1E', fontSize: 14, lineHeight: 19, fontWeight: '900' },
  location: { color: '#728078', fontSize: 11.5, marginTop: 3 },
  liveBadge: { backgroundColor: '#FDE8E8', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  liveBadgeText: { color: '#A92F2F', fontSize: 10, fontWeight: '900' },
  timeCopy: { alignItems: 'flex-end' },
  nextPrayer: { color: '#52675A', fontSize: 10.5, fontWeight: '800' },
  nextTime: { color: '#183526', fontSize: 16, fontWeight: '900', marginTop: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  source: { color: '#859188', fontSize: 10.5 },
  countdown: { color: '#4F765B', fontSize: 10.5, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 11 },
  secondaryAction: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#ECF4EE', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { color: '#2F6B45', fontSize: 13, fontWeight: '800' },
  primaryAction: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#2F6B45', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  liveAction: { backgroundColor: '#9F3434' },
  primaryActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.8 },
});
