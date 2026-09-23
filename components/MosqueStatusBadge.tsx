import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './ui/app-text';

export type MosqueOnboardingStatus = 'directory_only' | 'in_progress' | 'claimed' | null | undefined;

type StatusConfig = {
  label: string;
  bg: string;
  fg: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const STATUS_CONFIG: Record<'directory_only' | 'in_progress' | 'claimed', StatusConfig> = {
  claimed: { label: 'Claimed', bg: '#DCFCE7', fg: '#15803D', icon: 'checkmark-circle' },
  in_progress: { label: 'Setting up', bg: '#FEF3C7', fg: '#B45309', icon: 'time' },
  directory_only: { label: 'Directory listing', bg: '#F1F5F9', fg: '#64748B', icon: 'information-circle-outline' },
};

export function resolveOnboardingStatus(status: MosqueOnboardingStatus): 'directory_only' | 'in_progress' | 'claimed' {
  if (status === 'claimed' || status === 'in_progress') return status;
  return 'directory_only';
}

export function mosqueHasLiveCapability(mosque: { live_stream_enabled?: boolean | null; live_stream_provider?: string | null } | null | undefined) {
  return !!(mosque?.live_stream_enabled && mosque?.live_stream_provider);
}

type MosqueStatusBadgeProps = {
  status: MosqueOnboardingStatus;
  compact?: boolean;
};

export function MosqueStatusBadge({ status, compact }: MosqueStatusBadgeProps) {
  const config = STATUS_CONFIG[resolveOnboardingStatus(status)];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, compact && styles.badgeCompact]}>
      <Ionicons name={config.icon} size={compact ? 10 : 12} color={config.fg} />
      <AppText style={[styles.badgeText, { color: config.fg }, compact && styles.badgeTextCompact]} numberOfLines={1}>
        {config.label}
      </AppText>
    </View>
  );
}

type LiveCapabilityBadgeProps = {
  capable: boolean;
  compact?: boolean;
};

export function LiveCapabilityBadge({ capable, compact }: LiveCapabilityBadgeProps) {
  if (!capable) return null;
  return (
    <View style={[styles.liveBadge, compact && styles.badgeCompact]}>
      <Ionicons name="radio-outline" size={compact ? 10 : 12} color="#B91C1C" />
      <AppText style={[styles.liveBadgeText, compact && styles.badgeTextCompact]} numberOfLines={1}>
        Live capable
      </AppText>
    </View>
  );
}

export function mosqueStatusDescription(status: MosqueOnboardingStatus): string {
  const resolved = resolveOnboardingStatus(status);
  if (resolved === 'claimed') {
    return 'This mosque is claimed and actively managed by its staff. Prayer times are kept up to date.';
  }
  if (resolved === 'in_progress') {
    return 'A mosque admin has started setting this mosque up. Some information may still be incomplete.';
  }
  return 'This mosque has not yet been claimed by its staff. Prayer times shown are calculated estimates and may not match the mosque’s actual schedule.';
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextCompact: {
    fontSize: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FEE2E2',
    alignSelf: 'flex-start',
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
});
