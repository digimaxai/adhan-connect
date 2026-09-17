import React from 'react';
import { StyleSheet, View, ViewStyle, ScrollViewProps } from 'react-native';
import { AppCard } from '@/components/ui/app-card';
import { AppText } from '@/components/ui/app-text';
import { BackButton } from '@/components/ui/back-button';
import { ScreenContainer } from '@/components/ui/screen-container';
import { tokens } from '@/theme/tokens';

type AdminScreenShellProps = ScrollViewProps & {
  title: string;
  subtitle: string;
  eyebrow?: string;
  backHref?: string;
  /** false for a screen that is itself a bottom-tab root (no back chevron). */
  showBack?: boolean;
  mosqueName?: string | null;
  mosqueMeta?: string | null;
  contentStyle?: ViewStyle;
  children: React.ReactNode;
};

export function AdminScreenShell({
  title,
  subtitle,
  eyebrow = 'Local Admin',
  backHref,
  showBack = true,
  mosqueName,
  mosqueMeta,
  contentStyle,
  children,
  ...scrollProps
}: AdminScreenShellProps) {
  return (
    <ScreenContainer {...scrollProps} contentStyle={[styles.content, contentStyle]}>
      <View style={styles.hero}>
        {showBack ? <BackButton fallbackHref={backHref ?? '/(admin)'} /> : null}
        <View style={styles.heroCopy}>
          <AppText variant="label" style={styles.eyebrow}>
            {eyebrow}
          </AppText>
          <AppText variant="sectionTitle" style={styles.title}>
            {title}
          </AppText>
          <AppText variant="body" color={tokens.color.text.secondary} style={styles.subtitle}>
            {subtitle}
          </AppText>
        </View>
      </View>

      {mosqueName ? (
        <AppCard style={styles.contextCard}>
          <AppText variant="caption" color={tokens.color.text.secondary}>
            Managing mosque
          </AppText>
          <AppText variant="title" style={styles.contextTitle}>
            {mosqueName}
          </AppText>
          {mosqueMeta ? (
            <AppText variant="body" color={tokens.color.text.secondary}>
              {mosqueMeta}
            </AppText>
          ) : null}
        </AppCard>
      ) : null}

      {children}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: tokens.spacing.sm,
  },
  hero: {
    gap: 10,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF5',
  },
  heroCopy: {
    gap: 6,
  },
  eyebrow: {
    color: '#0369A1',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
  },
  subtitle: {
    maxWidth: 420,
    lineHeight: 20,
    fontSize: 13,
  },
  contextCard: {
    gap: 4,
    backgroundColor: '#FDFEFF',
    padding: 14,
    borderRadius: 18,
    borderColor: '#E5EEF7',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  contextTitle: {
    fontSize: 17,
    lineHeight: 21,
  },
});
