import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  FlatList,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { tokens } from '../../theme/tokens';
import { useQuranReciters } from '../../lib/hooks/useQuranReciters';
import { useDailyDua } from '../../lib/hooks/useDailyDua';

interface QuranReciter {
  id: number;
  reciter_name: string;
  english_name: string;
  style: string;
}

export default function QuranScreen() {
  const { reciters, loading: loadingReciters, error: reciterError } = useQuranReciters();
  const { dua, loading: loadingDua } = useDailyDua();
  const [selectedReciter, setSelectedReciter] = useState<QuranReciter | null>(null);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Verse of Day Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🕌 Verse of the Day</Text>
        <View style={styles.card}>
          <Text style={styles.verseArabic}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
          <Text style={styles.verseTranslation}>
            In the name of Allah, the most Gracious, the most Merciful
          </Text>
          <Text style={styles.verseReference}>— Quran 1:1</Text>
        </View>
      </View>

      {/* Reciter Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎵 Select Reciter</Text>
        {loadingReciters ? (
          <ActivityIndicator color={tokens.color.primary} size="large" style={styles.loader} />
        ) : reciterError ? (
          <Text style={styles.error}>Failed to load reciters</Text>
        ) : (
          <View>
            <Text style={styles.hintText}>
              {reciters.length} reciters available
            </Text>
            <FlatList
              data={reciters.slice(0, 10)} // Show top 10
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelectedReciter(item)}
                  style={[
                    styles.reciterItem,
                    selectedReciter?.id === item.id && styles.reciterItemSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.reciterName,
                      selectedReciter?.id === item.id && styles.reciterNameSelected,
                    ]}
                  >
                    {item.english_name}
                  </Text>
                  <Text style={styles.reciterStyle}>{item.style}</Text>
                </Pressable>
              )}
            />
          </View>
        )}
      </View>

      {/* Daily Dua */}
      {dua && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📖 Daily Dua</Text>
          <View style={styles.card}>
            <Text style={styles.duaTitle}>{dua.prayer} Prayer</Text>
            <Text style={styles.duaArabic}>{dua.dua_arabic}</Text>
            <Text style={styles.duaEnglish}>{dua.dua_english}</Text>
            {dua.transliteration && (
              <Text style={styles.duaTransliteration}>{dua.transliteration}</Text>
            )}
            <Text style={styles.duaAttribution}>— {dua.attribution}</Text>
          </View>
        </View>
      )}

      {/* Browse by Chapter */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📚 Browse by Chapter</Text>
        <Pressable
          style={styles.ctaButton}
          onPress={() => {
            // TODO: Navigate to chapter browser
          }}
        >
          <Ionicons name="book-outline" size={20} color={tokens.color.primary} />
          <Text style={styles.ctaButtonText}>Browse All 114 Chapters</Text>
          <Ionicons name="chevron-forward" size={20} color={tokens.color.primary} />
        </Pressable>
      </View>

      {/* Learn More */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💡 Learn More</Text>
        <Pressable
          style={styles.ctaButton}
          onPress={() => {
            // TODO: Navigate to learning resources
          }}
        >
          <Ionicons name="school-outline" size={20} color={tokens.color.secondary} />
          <Text style={styles.ctaButtonText}>Tafsir (Explanation)</Text>
          <Ionicons name="chevron-forward" size={20} color={tokens.color.secondary} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.page },
  content: { padding: tokens.spacing.md, paddingBottom: 100 },
  section: { marginBottom: tokens.spacing.lg },
  sectionTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.extrabold,
    color: tokens.color.text.primary,
    marginBottom: tokens.spacing.sm,
  },
  card: {
    backgroundColor: tokens.color.bg.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.color.border.light,
  },
  verseArabic: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.color.primary,
    textAlign: 'center',
    marginBottom: tokens.spacing.sm,
  },
  verseTranslation: {
    fontSize: tokens.typography.size.sm,
    color: tokens.color.text.secondary,
    lineHeight: 20,
    marginBottom: tokens.spacing.sm,
  },
  verseReference: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.text.muted,
    textAlign: 'center',
  },
  loader: { marginVertical: tokens.spacing.lg },
  error: { color: tokens.color.error, fontSize: tokens.typography.size.sm },
  hintText: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.text.muted,
    marginBottom: tokens.spacing.sm,
  },
  reciterItem: {
    padding: tokens.spacing.md,
    backgroundColor: tokens.color.bg.page,
    borderRadius: tokens.radius.md,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.color.border.light,
  },
  reciterItemSelected: {
    backgroundColor: tokens.color.bg.tintSoft,
    borderColor: tokens.color.primary,
    borderWidth: 2,
  },
  reciterName: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.primary,
  },
  reciterNameSelected: {
    color: tokens.color.primary,
  },
  reciterStyle: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.text.muted,
    marginTop: 4,
  },
  duaTitle: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.primary,
    marginBottom: tokens.spacing.sm,
  },
  duaArabic: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.color.text.primary,
    lineHeight: 24,
    marginBottom: tokens.spacing.sm,
  },
  duaEnglish: {
    fontSize: tokens.typography.size.sm,
    color: tokens.color.text.secondary,
    lineHeight: 20,
    marginBottom: tokens.spacing.sm,
  },
  duaTransliteration: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.text.muted,
    fontStyle: 'italic',
    marginBottom: tokens.spacing.sm,
  },
  duaAttribution: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.text.muted,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    backgroundColor: tokens.color.bg.surface,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border.light,
  },
  ctaButtonText: {
    flex: 1,
    marginLeft: tokens.spacing.sm,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.primary,
  },
});
