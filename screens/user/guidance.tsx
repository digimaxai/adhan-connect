import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/screen-container';
import { tokens } from '../../theme/tokens';

type GuidancePath = '/(user)/guidance/quran' | '/(user)/guidance/reflection';

type GuidanceCard = {
  key: 'quran' | 'reflection';
  title: string;
  description: string;
  eyebrow: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  iconBackground: string;
  actionBackground: string;
  colors: readonly [string, string];
  borderColor: string;
  path: GuidancePath;
};

const GUIDANCE_CARDS: GuidanceCard[] = [
  {
    key: 'quran',
    title: 'Qur’an',
    description: 'Read a surah or listen at your own pace.',
    eyebrow: 'READ & LISTEN',
    icon: 'book-outline',
    accent: '#31533D',
    iconBackground: '#DCEAD9',
    actionBackground: '#E5F0E2',
    colors: ['#F5F9F3', '#EEF5EC'],
    borderColor: '#D7E5D4',
    path: '/(user)/guidance/quran',
  },
  {
    key: 'reflection',
    title: 'Daily Reflection',
    description: 'Duas and reminders for the day ahead.',
    eyebrow: 'FOR TODAY',
    icon: 'sparkles-outline',
    accent: '#6A5B2E',
    iconBackground: '#F4EBCF',
    actionBackground: '#F6EDD4',
    colors: ['#FFFDF6', '#FAF6E8'],
    borderColor: '#EAE2C9',
    path: '/(user)/guidance/reflection',
  },
];

export default function GuidanceScreen() {
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const useStackedCards = width < 360 || fontScale > 1.2;

  const openGuidance = useCallback((path: GuidancePath) => {
    void Haptics.selectionAsync().catch(() => undefined);
    router.push(path as any);
  }, [router]);

  return (
    <ScreenContainer
      contentStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Guidance</Text>
        <Text style={styles.subtitle}>
          Qur’an, reflection and learning for everyday life.
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>YOUR SPACE</Text>
        <Text style={styles.sectionTitle}>What would help right now?</Text>
      </View>

      <View style={[styles.primaryGrid, useStackedCards && styles.primaryGridStacked]}>
        {GUIDANCE_CARDS.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.title}`}
            accessibilityHint={item.description}
            onPress={() => openGuidance(item.path)}
            style={({ pressed }) => [
              styles.primaryCard,
              useStackedCards && styles.primaryCardStacked,
              { borderColor: item.borderColor },
              pressed && styles.cardPressed,
            ]}
          >
            <LinearGradient
              colors={item.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradient}
            >
              <View style={styles.cardIconRow}>
                <View style={[styles.cardIcon, { backgroundColor: item.iconBackground }]}>
                  <Ionicons name={item.icon} size={23} color={item.accent} />
                </View>
              </View>

              <View style={styles.cardCopy}>
                <Text style={[styles.cardEyebrow, { color: item.accent }]}>
                  {item.eyebrow}
                </Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </View>

              <View style={styles.cardActionRow}>
                <Text style={[styles.cardActionText, { color: item.accent }]}>Open</Text>
                <View style={[styles.cardActionIcon, { backgroundColor: item.actionBackground }]}>
                  <Ionicons name="arrow-forward" size={16} color={item.accent} />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        ))}
      </View>

      <View style={styles.upcomingSection}>
        <View style={styles.upcomingHeader}>
          <Text style={styles.sectionEyebrow}>LEARN & DISCOVER</Text>
          <Text style={styles.upcomingHeaderNote}>More, thoughtfully added</Text>
        </View>

        <View
          accessible
          accessibilityLabel="Knowledge Centre, coming soon"
          accessibilityState={{ disabled: true }}
          style={styles.upcomingCard}
        >
          <View style={styles.upcomingIcon}>
            <Ionicons name="library-outline" size={22} color="#46617A" />
          </View>

          <View style={styles.upcomingCopy}>
            <View style={styles.upcomingTitleRow}>
              <Text style={styles.upcomingTitle}>Knowledge Centre</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>COMING SOON</Text>
              </View>
            </View>
            <Text style={styles.upcomingDescription}>
              Trusted learning, organised into clear and useful topics.
            </Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: tokens.spacing.md,
    paddingBottom: 120,
    gap: tokens.spacing.xl,
  },
  header: {
    gap: 6,
  },
  title: {
    color: tokens.color.reading.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  subtitle: {
    maxWidth: 340,
    color: tokens.color.reading.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: tokens.typography.weight.medium,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionEyebrow: {
    color: tokens.color.reading.accent,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.15,
  },
  sectionTitle: {
    color: tokens.color.reading.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  primaryGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: tokens.spacing.sm,
  },
  primaryGridStacked: {
    flexDirection: 'column',
  },
  primaryCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 222,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: tokens.color.bg.surface,
    shadowColor: '#183526',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  primaryCardStacked: {
    flex: 0,
    width: '100%',
    minHeight: 196,
  },
  cardGradient: {
    flex: 1,
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
    borderRadius: 23,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  cardIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    marginVertical: tokens.spacing.md,
    gap: 4,
  },
  cardEyebrow: {
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.85,
  },
  cardTitle: {
    color: tokens.color.reading.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  cardDescription: {
    marginTop: 2,
    color: tokens.color.reading.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: tokens.typography.weight.medium,
  },
  cardActionRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardActionText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  cardActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingSection: {
    gap: tokens.spacing.sm,
  },
  upcomingHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  upcomingHeaderNote: {
    flexShrink: 1,
    color: tokens.color.text.muted,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'right',
    fontWeight: tokens.typography.weight.medium,
  },
  upcomingCard: {
    minHeight: 118,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DDE6ED',
    backgroundColor: '#F4F7F9',
  },
  upcomingIcon: {
    width: 46,
    height: 46,
    flexShrink: 0,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E1ECF3',
  },
  upcomingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  upcomingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  upcomingTitle: {
    flexShrink: 1,
    color: tokens.color.reading.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  badge: {
    minHeight: 21,
    justifyContent: 'center',
    paddingHorizontal: 7,
    borderRadius: tokens.radius.pill,
    backgroundColor: '#E1EAF1',
  },
  badgeText: {
    color: '#4F667A',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  upcomingDescription: {
    color: tokens.color.reading.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: tokens.typography.weight.medium,
  },
});
