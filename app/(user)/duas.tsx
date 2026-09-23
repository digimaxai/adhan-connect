import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDailyDua } from '../../lib/hooks/useDailyDua';
import { useDailyTip } from '../../lib/hooks/useDailyTip';
import { tokens } from '../../theme/tokens';

const PRAYER_FILTERS = [
  { label: 'Today', value: undefined },
  { label: 'Fajr', value: 'Fajr' },
  { label: 'Dhuhr', value: 'Dhuhr' },
  { label: 'Asr', value: 'Asr' },
  { label: 'Maghrib', value: 'Maghrib' },
  { label: 'Isha', value: 'Isha' },
] as const;

const REFLECTION_THEMES = [
  'Adab',
  'Charity',
  'Knowledge',
  'Gratitude',
  'Ihsan',
  'Community',
  'Health',
  'Patience',
] as const;

export default function DuasScreen() {
  const router = useRouter();
  const segments = useSegments();
  const isInsideGuidance = segments.some((segment) => segment === 'guidance');
  const [selectedPrayer, setSelectedPrayer] = useState<string | undefined>();
  const [selectedTheme, setSelectedTheme] = useState<string | undefined>();
  const [showTransliteration, setShowTransliteration] = useState(false);
  const {
    dua,
    loading: loadingDua,
    error: duaError,
    refetch: refetchDua,
  } = useDailyDua(selectedPrayer);
  const {
    tip,
    loading: loadingTip,
    error: tipError,
    refetch: refetchTip,
    showNext,
  } = useDailyTip(selectedTheme);

  useEffect(() => {
    setShowTransliteration(false);
  }, [selectedPrayer]);

  const chooseTheme = (theme: string) => {
    setSelectedTheme((current) =>
      current?.toLowerCase() === theme.toLowerCase() ? undefined : theme
    );
  };

  const showAnotherReflection = () => {
    setSelectedTheme(undefined);
    showNext();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isInsideGuidance ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Guidance"
            onPress={() => router.replace('/(user)/guidance' as any)}
            hitSlop={10}
            style={({ pressed }) => [styles.guidanceBack, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={19} color={tokens.color.reading.accent} />
            <Text style={styles.guidanceBackText}>Guidance</Text>
          </Pressable>
        ) : null}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Daily Reflection</Text>
          <Text style={styles.pageSubtitle}>
            Duas, remembrance and meaningful guidance for every part of your day.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>CHOOSE A MOMENT</Text>
          <Text style={styles.sectionTitle}>A dua for right now</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {PRAYER_FILTERS.map((filter) => {
              const selected = selectedPrayer === filter.value;
              return (
                <Pressable
                  key={filter.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedPrayer(filter.value)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    selected && styles.filterChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected && styles.filterChipTextSelected,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loadingDua ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={tokens.color.reading.accent} />
              <Text style={styles.loadingText}>Finding the dua…</Text>
            </View>
          ) : duaError ? (
            <View style={styles.errorCard}>
              <View style={styles.errorIcon}>
                <Ionicons name="refresh-outline" size={21} color={tokens.color.reading.accent} />
              </View>
              <Text style={styles.errorTitle}>Your dua is not available just now</Text>
              <Text style={styles.errorBody}>{duaError}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void refetchDua()}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : dua ? (
            <View style={styles.duaCard}>
              <View style={styles.duaCardHeader}>
                <View style={styles.prayerBadge}>
                  <Ionicons name="moon-outline" size={16} color={tokens.color.reading.accent} />
                  <Text style={styles.prayerBadgeText}>
                    {selectedPrayer ? dua.prayer + ' dua' : 'Dua for today'}
                  </Text>
                </View>
                <Text style={styles.sourceText}>{dua.attribution}</Text>
              </View>
              <View style={styles.duaArabicPanel}>
                <Text style={styles.duaArabic}>{dua.dua_arabic}</Text>
              </View>
              <Text style={styles.duaTranslation}>{dua.dua_english}</Text>
              {dua.transliteration ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showTransliteration }}
                    onPress={() => setShowTransliteration((value) => !value)}
                    style={({ pressed }) => [
                      styles.disclosureButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={showTransliteration ? 'chevron-up' : 'language-outline'}
                      size={18}
                      color={tokens.color.reading.accent}
                    />
                    <Text style={styles.disclosureText}>
                      {showTransliteration ? 'Hide transliteration' : 'Show transliteration'}
                    </Text>
                  </Pressable>
                  {showTransliteration ? (
                    <Text style={styles.transliteration}>{dua.transliteration}</Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>REFLECT</Text>
          <Text style={styles.sectionTitle}>
            {selectedTheme ? selectedTheme : 'A reminder for today'}
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {REFLECTION_THEMES.map((theme) => {
              const selected = selectedTheme === theme;
              return (
                <Pressable
                  key={theme}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => chooseTheme(theme)}
                  style={({ pressed }) => [
                    styles.themeChip,
                    selected && styles.themeChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.themeChipText,
                      selected && styles.themeChipTextSelected,
                    ]}
                  >
                    {theme}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loadingTip ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={tokens.color.reading.accent} />
              <Text style={styles.loadingText}>Loading the reminder…</Text>
            </View>
          ) : tipError ? (
            <View style={styles.errorCard}>
              <View style={styles.errorIcon}>
                <Ionicons name="refresh-outline" size={21} color={tokens.color.reading.accent} />
              </View>
              <Text style={styles.errorTitle}>Your reflection is not available just now</Text>
              <Text style={styles.errorBody}>{tipError}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void refetchTip()}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : tip ? (
            <View style={styles.reflectionCard}>
              <View style={styles.reflectionTopRow}>
                <View style={styles.reflectionIcon}>
                  <Ionicons name="sparkles-outline" size={20} color={tokens.color.reading.accent} />
                </View>
                <Text style={styles.reflectionCategory}>{tip.category}</Text>
              </View>
              <Text style={styles.reflectionTitle}>{tip.title}</Text>
              <Text style={styles.reflectionBody}>{tip.description}</Text>
              {tip.reference ? (
                <View style={styles.referenceRow}>
                  <Ionicons name="bookmark-outline" size={16} color={tokens.color.reading.muted} />
                  <Text style={styles.referenceText}>{tip.reference}</Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={showAnotherReflection}
                style={({ pressed }) => [
                  styles.anotherButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="refresh" size={17} color={tokens.color.reading.accent} />
                <Text style={styles.anotherButtonText}>Show another reminder</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.app },
  content: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: 120,
  },
  pageHeader: { marginBottom: tokens.spacing.xl },
  guidanceBack: {
    minHeight: 36,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: tokens.spacing.sm,
    paddingRight: tokens.spacing.sm,
  },
  guidanceBackText: {
    color: tokens.color.reading.accent,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
  },
  pageTitle: {
    color: tokens.color.reading.text,
    fontSize: 28,
    fontWeight: tokens.typography.weight.extrabold,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    color: tokens.color.reading.muted,
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    marginTop: tokens.spacing.xs,
  },
  section: { marginBottom: tokens.spacing.xl },
  sectionEyebrow: {
    color: tokens.color.reading.accent,
    fontSize: 10,
    fontWeight: tokens.typography.weight.extrabold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  sectionTitle: {
    color: tokens.color.reading.text,
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.extrabold,
    marginBottom: tokens.spacing.md,
  },
  chipRow: {
    gap: tokens.spacing.xs,
    paddingRight: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
  },
  filterChip: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.reading.border,
    backgroundColor: tokens.color.bg.surface,
  },
  filterChipSelected: {
    borderColor: tokens.color.reading.selectedBorder,
    backgroundColor: tokens.color.reading.selected,
  },
  filterChipText: {
    color: tokens.color.reading.muted,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  filterChipTextSelected: { color: tokens.color.reading.selectedText },
  themeChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.reading.surface,
    borderColor: tokens.color.reading.border,
    borderWidth: 1,
  },
  themeChipSelected: {
    backgroundColor: tokens.color.reading.selected,
    borderColor: tokens.color.reading.selectedBorder,
  },
  themeChipText: {
    color: tokens.color.reading.accent,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  themeChipTextSelected: { color: tokens.color.reading.selectedText },
  loadingCard: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.reading.arabicSurface,
    borderWidth: 1,
    borderColor: tokens.color.reading.border,
  },
  loadingText: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.size.sm,
  },
  errorCard: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.border.muted,
    padding: tokens.spacing.lg,
  },
  errorIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.reading.iconBg,
  },
  errorTitle: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.bold,
  },
  errorBody: {
    color: tokens.color.text.secondary,
    fontSize: tokens.typography.size.sm,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.reading.iconBg,
    paddingHorizontal: tokens.spacing.lg,
  },
  retryButtonText: {
    color: tokens.color.reading.accent,
    fontWeight: tokens.typography.weight.bold,
  },
  duaCard: {
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg.surface,
    borderWidth: 1,
    borderColor: tokens.color.reading.border,
    padding: tokens.spacing.lg,
  },
  duaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.lg,
  },
  prayerBadge: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.reading.iconBg,
  },
  prayerBadgeText: {
    color: tokens.color.reading.accent,
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.bold,
  },
  sourceText: {
    flex: 1,
    color: tokens.color.reading.muted,
    fontSize: 11,
    textAlign: 'right',
  },
  duaArabicPanel: {
    backgroundColor: tokens.color.reading.arabicSurface,
    borderRadius: tokens.radius.md,
    marginBottom: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  duaArabic: {
    color: '#172033',
    fontFamily: tokens.typography.reading.arabicFontFamily,
    fontSize: tokens.typography.reading.arabicSize,
    lineHeight: tokens.typography.reading.arabicLineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  duaTranslation: {
    color: tokens.color.reading.muted,
    fontSize: tokens.typography.reading.translationSize,
    lineHeight: tokens.typography.reading.translationLineHeight,
    textAlign: 'right',
    writingDirection: 'ltr',
  },
  disclosureButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.color.reading.border,
    paddingTop: tokens.spacing.md,
  },
  disclosureText: {
    color: tokens.color.reading.accent,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
  },
  transliteration: {
    color: tokens.color.reading.muted,
    fontSize: tokens.typography.size.sm,
    fontStyle: 'italic',
    lineHeight: 21,
    paddingTop: tokens.spacing.sm,
    textAlign: 'right',
    writingDirection: 'ltr',
  },
  reflectionCard: {
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.reading.surface,
    borderColor: tokens.color.reading.border,
    borderWidth: 1,
    padding: tokens.spacing.lg,
  },
  reflectionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  reflectionIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.reading.iconBg,
  },
  reflectionCategory: {
    color: tokens.color.reading.accent,
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.extrabold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  reflectionTitle: {
    color: tokens.color.reading.text,
    fontSize: 18,
    fontWeight: tokens.typography.weight.extrabold,
    lineHeight: 24,
    marginBottom: tokens.spacing.sm,
  },
  reflectionBody: {
    color: tokens.color.reading.muted,
    fontSize: tokens.typography.size.md,
    lineHeight: 23,
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: tokens.spacing.md,
  },
  referenceText: {
    color: tokens.color.reading.muted,
    fontSize: tokens.typography.size.xs,
  },
  anotherButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.lg,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.bg.surface,
    borderColor: tokens.color.reading.border,
    borderWidth: 1,
  },
  anotherButtonText: {
    color: tokens.color.reading.accent,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
  },
  pressed: { opacity: 0.72 },
});
