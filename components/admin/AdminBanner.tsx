import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { tokens } from '@/theme/tokens';

type AdminBannerTone = 'info' | 'success' | 'warning' | 'danger';

type AdminBannerProps = {
  tone?: AdminBannerTone;
  title?: string;
  message: string;
};

const toneStyles: Record<AdminBannerTone, { bg: string; border: string; title: string; body: string }> = {
  info: { bg: '#F0F9FF', border: '#BAE6FD', title: '#075985', body: '#0F172A' },
  success: { bg: '#F0FDF4', border: '#BBF7D0', title: '#166534', body: '#14532D' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', title: '#92400E', body: '#78350F' },
  danger: { bg: '#FEF2F2', border: '#FECACA', title: '#B91C1C', body: '#7F1D1D' },
};

export function AdminBanner({ tone = 'info', title, message }: AdminBannerProps) {
  const palette = toneStyles[tone];
  return (
    <View style={[styles.container, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {title ? (
        <AppText variant="caption" color={palette.title} style={styles.title}>
          {title}
        </AppText>
      ) : null}
      <AppText variant="body" color={palette.body} style={styles.message}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: 4,
  },
  title: {
    fontWeight: tokens.typography.weight.extrabold,
  },
  message: {
    lineHeight: 20,
  },
});
