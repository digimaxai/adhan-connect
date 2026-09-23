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
  return PRAYER_LABELS[value.toLowerCase()] ?? value;
}

function timeLabel(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

type Props = {
  mosques: NearbyMosque[];
  loading: boolean;
  error: string | null;
  onOpenNearby: () => void;
  onListen: (mosque: NearbyMosque) => void;
  onRefresh: () => void;
};

export const NearbyHomeSummary = React.memo(function NearbyHomeSummary({
  mosques,
  loading,
  error,
  onOpenNearby,
  onListen,
  onRefresh,
}: Props) {
  const featured = mosques.find((mosque) => mosque.is_live) ?? mosques[0] ?? null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headingGroup}>
          <View style={styles.iconWrap}>
            <Ionicons name="navigate" size={16} color="#2F6B45" />
          </View>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>CURRENT AREA</Text>
            <Text style={styles.title}>Nearby mosques</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all nearby mosques"
          onPress={onOpenNearby}
          hitSlop={8}
          style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
        >
          <Text style={styles.seeAllText}>See all</Text>
          <Ionicons name="chevron-forward" size={16} color="#2F6B45" />
        </Pressable>
      </View>

      {loading && !featured ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color="#2F6B45" />
          <Text style={styles.statusText}>Checking what is nearby…</Text>
        </View>
      ) : error && !featured ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry nearby mosques"
          onPress={onRefresh}
          style={({ pressed }) => [styles.statusRow, pressed && styles.pressed]}
        >
          <Ionicons name="refresh" size={17} color="#2F6B45" />
          <Text style={styles.statusText}>Nearby information is unavailable. Try again.</Text>
        </Pressable>
      ) : featured ? (
        <View style={[styles.featuredRow, featured.is_live && styles.featuredLive]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open nearby mosques. ${featured.name} is the most relevant result.`}
            onPress={onOpenNearby}
            style={({ pressed }) => [styles.featuredCopy, pressed && styles.pressed]}
          >
            <View style={styles.nameRow}>
              {featured.is_live ? <View style={styles.liveDot} /> : null}
              <Text style={styles.mosqueName} numberOfLines={1}>{featured.name}</Text>
            </View>
            <Text style={styles.location} numberOfLines={1}>
              {featured.distance_km.toFixed(1)} km · {featured.city}
              {mosques.length > 1 ? ` · ${mosques.length} nearby` : ''}
            </Text>
          </Pressable>

          {featured.is_live ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Listen live to ${featured.name}`}
              onPress={() => onListen(featured)}
              style={({ pressed }) => [styles.liveButton, pressed && styles.pressed]}
            >
              <Ionicons name="play" size={14} color="#FFFFFF" />
              <Text style={styles.liveButtonText}>Listen LIVE</Text>
            </Pressable>
          ) : (
            <View style={styles.timeCopy}>
              <Text style={styles.prayer}>{prayerLabel(featured.next_prayer)}</Text>
              <Text style={styles.time}>{timeLabel(featured.next_adhan_at)}</Text>
              {featured.minutes_until !== null ? (
                <Text style={styles.countdown}>in {featured.minutes_until} min</Text>
              ) : null}
            </View>
          )}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenNearby}
          style={({ pressed }) => [styles.statusRow, pressed && styles.pressed]}
        >
          <Text style={styles.statusText}>No active mosques found nearby.</Text>
          <Ionicons name="chevron-forward" size={16} color="#2F6B45" />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D4E4D7',
    backgroundColor: '#F0F6F1',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headingGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  headingCopy: { flex: 1 },
  eyebrow: { color: '#577862', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.9 },
  title: { color: '#183526', fontSize: 17, lineHeight: 21, fontWeight: '900' },
  seeAll: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 1, paddingLeft: 8 },
  seeAllText: { color: '#2F6B45', fontSize: 12, fontWeight: '900' },
  featuredRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 15, borderWidth: 1, borderColor: '#DEE8E0', backgroundColor: '#FFFFFF' },
  featuredLive: { borderColor: '#F1C8C8' },
  featuredCopy: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D64545' },
  mosqueName: { flex: 1, color: '#183526', fontSize: 14, lineHeight: 19, fontWeight: '900' },
  location: { marginTop: 3, color: '#718078', fontSize: 10.5, lineHeight: 15 },
  timeCopy: { minWidth: 68, alignItems: 'flex-end' },
  prayer: { color: '#52675A', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  time: { color: '#183526', fontSize: 17, lineHeight: 21, fontWeight: '900' },
  countdown: { color: '#4F765B', fontSize: 9.5, lineHeight: 13, fontWeight: '800' },
  liveButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, borderRadius: 12, backgroundColor: '#9F3434' },
  liveButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  statusRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  statusText: { flexShrink: 1, color: '#5D7062', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  pressed: { opacity: 0.78 },
});
