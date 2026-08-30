import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { tokens } from '../theme/tokens';

interface LiveAdhan {
  mosque_id: string;
  mosque_name: string;
  mosque_city: string;
  prayer: string;
  adhan_time: string;
  listeners: number;
  started_at: string;
  duration_seconds: number;
  is_live: boolean;
  broadcast_url?: string;
  distance_km?: number;
}

interface LiveAdhansCardProps {
  adhans: LiveAdhan[];
  loading: boolean;
  error: string | null;
  onAdhanPress?: (adhan: LiveAdhan) => void;
  onRefresh?: () => Promise<void>;
}

export default function LiveAdhansCard({
  adhans,
  loading,
  error,
  onAdhanPress,
  onRefresh,
}: LiveAdhansCardProps) {
  if (loading && adhans.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="radio-outline" size={20} color={tokens.color.primary} />
          <Text style={styles.title}>Live Broadcasts Now</Text>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={tokens.color.primary} size="small" />
          <Text style={styles.loadingText}>Finding nearby broadcasts...</Text>
        </View>
      </View>
    );
  }

  if (error || adhans.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="radio-outline" size={20} color={tokens.color.muted} />
          <Text style={styles.title}>Live Broadcasts</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="radio-off-outline" size={40} color={tokens.color.border.light} />
          <Text style={styles.emptyText}>
            {error ? 'Could not load broadcasts' : 'No live broadcasts nearby'}
          </Text>
          <Text style={styles.emptySubtext}>
            Check back later or expand your search radius
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="radio-outline" size={20} color={tokens.color.primary} />
          <Text style={styles.title}>Live Broadcasts Now</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>
        {onRefresh && (
          <Pressable onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={20} color={tokens.color.primary} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={adhans.slice(0, 3)} // Show top 3
        keyExtractor={(item) => `${item.mosque_id}-${item.prayer}`}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <Pressable
            style={styles.adhanItem}
            onPress={() => onAdhanPress?.(item)}
          >
            {/* Live indicator + mosque info */}
            <View style={styles.itemHeader}>
              <View style={styles.liveDotSmall} />
              <View style={styles.mosqueInfo}>
                <Text style={styles.mosqueName}>{item.mosque_name}</Text>
                <Text style={styles.mosqueCity}>
                  {item.mosque_city}
                  {item.distance_km ? ` • ${item.distance_km}km away` : ''}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.prayer}</Text>
              </View>
            </View>

            {/* Prayer info */}
            <View style={styles.itemDetails}>
              <View style={styles.detailItem}>
                <Ionicons name="time-outline" size={16} color={tokens.color.text.muted} />
                <Text style={styles.detailText}>{item.adhan_time}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons
                  name="headset-outline"
                  size={16}
                  color={tokens.color.text.muted}
                />
                <Text style={styles.detailText}>{item.listeners || 'Live'}</Text>
              </View>
            </View>

            {/* Action */}
            <Pressable style={styles.listenButton}>
              <Ionicons name="play-circle" size={20} color={tokens.color.primary} />
              <Text style={styles.listenButtonText}>Listen Now</Text>
            </Pressable>
          </Pressable>
        )}
      />

      {adhans.length > 3 && (
        <Pressable style={styles.viewMoreButton}>
          <Text style={styles.viewMoreText}>View all {adhans.length} broadcasts</Text>
          <Ionicons name="chevron-forward-outline" size={16} color={tokens.color.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.color.bg.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.color.border.light,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  title: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.primary,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: tokens.typography.weight.bold,
    color: '#dc2626',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#dc2626',
  },
  liveDotSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#dc2626',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.lg,
  },
  loadingText: {
    marginTop: tokens.spacing.sm,
    fontSize: tokens.typography.size.sm,
    color: tokens.color.text.muted,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.lg,
  },
  emptyText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.secondary,
    marginTop: tokens.spacing.sm,
  },
  emptySubtext: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.text.muted,
    marginTop: tokens.spacing.xs,
    textAlign: 'center',
  },
  adhanItem: {
    backgroundColor: tokens.color.bg.page,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  mosqueInfo: {
    flex: 1,
  },
  mosqueName: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.primary,
  },
  mosqueCity: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.text.muted,
    marginTop: 2,
  },
  badge: {
    backgroundColor: tokens.color.bg.tintSoft,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.primary,
  },
  itemDetails: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  detailText: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.text.muted,
  },
  listenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.bg.tintSoft,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    gap: tokens.spacing.xs,
  },
  listenButtonText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.primary,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border.light,
    marginHorizontal: -tokens.spacing.md,
    marginBottom: -tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
  },
  viewMoreText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.primary,
  },
});
