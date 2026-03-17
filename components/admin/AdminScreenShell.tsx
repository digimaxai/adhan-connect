import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle, ScrollViewProps } from 'react-native';
import { useRouter } from 'expo-router';
import { AppCard } from '@/components/ui/app-card';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';
import { ScreenContainer } from '@/components/ui/screen-container';
import { tokens } from '@/theme/tokens';

type AdminScreenShellProps = ScrollViewProps & {
  title: string;
  subtitle: string;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  activeTab?: 'prayerTimes' | 'rota';
  onGoPrayerTimes?: () => void;
  onGoStaffRota?: () => void;
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
  backLabel = 'Back to Home',
  activeTab,
  onGoPrayerTimes,
  onGoStaffRota,
  mosqueName,
  mosqueMeta,
  contentStyle,
  children,
  ...scrollProps
}: AdminScreenShellProps) {
  const router = useRouter();
  const showTabs = activeTab && onGoPrayerTimes && onGoStaffRota;

  return (
    <ScreenContainer {...scrollProps} contentStyle={[styles.content, contentStyle]}>
      <View style={styles.hero}>
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
        {backHref ? (
          <AppButton
            title={backLabel}
            variant="ghost"
            onPress={() => router.push(backHref as any)}
            style={styles.backButton}
          />
        ) : null}
      </View>

      {showTabs ? (
        <View style={styles.tabRow}>
          <AdminTab label="Prayer Times" active={activeTab === 'prayerTimes'} onPress={onGoPrayerTimes} />
          <AdminTab label="Staff Rota" active={activeTab === 'rota'} onPress={onGoStaffRota} />
        </View>
      ) : null}

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

function AdminTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={active}
      style={({ pressed }) => [
        styles.tab,
        active ? styles.tabActive : null,
        pressed && !active ? styles.tabPressed : null,
      ]}
    >
      <AppText variant="body" color={active ? '#075985' : tokens.color.text.primary} style={styles.tabLabel}>
        {label}
      </AppText>
    </Pressable>
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
  backButton: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    minHeight: 34,
    paddingHorizontal: tokens.spacing.sm,
    backgroundColor: '#FFFFFF',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.border.muted,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#E6F6FF',
    borderColor: '#0EA5E9',
  },
  tabPressed: {
    opacity: 0.9,
  },
  tabLabel: {
    fontWeight: tokens.typography.weight.extrabold,
    fontSize: 15,
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
