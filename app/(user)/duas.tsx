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
import { useDailyTip } from '../../lib/hooks/useDailyTip';

interface Category {
  label: string;
  value: string;
  icon: string;
}

const CATEGORIES: Category[] = [
  { label: 'Adab', value: 'adab', icon: '🙏' },
  { label: 'Charity', value: 'charity', icon: '🤝' },
  { label: 'Knowledge', value: 'knowledge', icon: '📚' },
  { label: 'Gratitude', value: 'gratitude', icon: '✨' },
  { label: 'Ihsan', value: 'ihsan', icon: '💎' },
];

export default function DuasScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const { tip, loading, error, refetch } = useDailyTip(selectedCategory);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(selectedCategory === category ? undefined : category);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💭 Islamic Wisdom</Text>
        <Text style={styles.subtitle}>Daily guidance and inspiration</Text>
      </View>

      {/* Today's Tip */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💡 Today's Tip</Text>
        {loading ? (
          <ActivityIndicator color={tokens.color.primary} size="large" style={styles.loader} />
        ) : error ? (
          <Text style={styles.error}>Failed to load tip</Text>
        ) : tip ? (
          <View style={styles.card}>
            <View style={styles.tipHeader}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <View style={styles.tipMeta}>
                <Text style={styles.tipCategory}>{tip.category}</Text>
                <Text style={styles.tipTitle}>{tip.title}</Text>
              </View>
            </View>
            <Text style={styles.tipDescription}>{tip.description}</Text>
            {tip.reference && (
              <Text style={styles.tipReference}>📖 {tip.reference}</Text>
            )}
            <Pressable
              style={styles.refreshButton}
              onPress={() => refetch()}
            >
              <Ionicons name="refresh-outline" size={16} color={tokens.color.primary} />
              <Text style={styles.refreshButtonText}>Get another tip</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏷️ Browse by Category</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((category) => (
            <Pressable
              key={category.value}
              style={[
                styles.categoryButton,
                selectedCategory === category.value && styles.categoryButtonActive,
              ]}
              onPress={() => handleCategoryChange(category.value)}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  selectedCategory === category.value && styles.categoryLabelActive,
                ]}
              >
                {category.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Collection of Duas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📿 Collection of Duas</Text>

        <View style={[styles.card, styles.collectionCard]}>
          <Pressable style={styles.collectionItem}>
            <Ionicons name="arrow-forward-outline" size={20} color={tokens.color.primary} />
            <View style={styles.collectionItemText}>
              <Text style={styles.collectionItemTitle}>Morning Adhkar</Text>
              <Text style={styles.collectionItemSubtitle}>Protect yourself throughout the day</Text>
            </View>
          </Pressable>
        </View>

        <View style={[styles.card, styles.collectionCard]}>
          <Pressable style={styles.collectionItem}>
            <Ionicons name="arrow-forward-outline" size={20} color={tokens.color.primary} />
            <View style={styles.collectionItemText}>
              <Text style={styles.collectionItemTitle}>Evening Adhkar</Text>
              <Text style={styles.collectionItemSubtitle}>Seek forgiveness and protection at night</Text>
            </View>
          </Pressable>
        </View>

        <View style={[styles.card, styles.collectionCard]}>
          <Pressable style={styles.collectionItem}>
            <Ionicons name="arrow-forward-outline" size={20} color={tokens.color.primary} />
            <View style={styles.collectionItemText}>
              <Text style={styles.collectionItemTitle}>After Prayer Adhkar</Text>
              <Text style={styles.collectionItemSubtitle}>Glorify Allah after each prayer</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Learning Resources */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📖 Learn More</Text>
        <Pressable style={styles.resourceButton}>
          <Ionicons name="open-outline" size={20} color={tokens.color.secondary} />
          <Text style={styles.resourceButtonText}>Understanding the 99 Names of Allah</Text>
        </Pressable>
        <Pressable style={styles.resourceButton}>
          <Ionicons name="open-outline" size={20} color={tokens.color.secondary} />
          <Text style={styles.resourceButtonText}>The Five Pillars Explained</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.page },
  content: { padding: tokens.spacing.md, paddingBottom: 100 },
  header: { marginBottom: tokens.spacing.lg },
  title: {
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.extrabold,
    color: tokens.color.text.primary,
  },
  subtitle: {
    fontSize: tokens.typography.size.sm,
    color: tokens.color.text.muted,
    marginTop: tokens.spacing.xs,
  },
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
  loader: { marginVertical: tokens.spacing.lg },
  error: { color: tokens.color.error, fontSize: tokens.typography.size.sm },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.sm,
  },
  tipIcon: {
    fontSize: 28,
    marginRight: tokens.spacing.sm,
  },
  tipMeta: { flex: 1 },
  tipCategory: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.primary,
    fontWeight: tokens.typography.weight.bold,
    textTransform: 'uppercase',
  },
  tipTitle: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.primary,
    marginTop: tokens.spacing.xs,
  },
  tipDescription: {
    fontSize: tokens.typography.size.sm,
    color: tokens.color.text.secondary,
    lineHeight: 20,
    marginBottom: tokens.spacing.sm,
  },
  tipReference: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.text.muted,
    marginBottom: tokens.spacing.sm,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border.light,
  },
  refreshButtonText: {
    marginLeft: tokens.spacing.xs,
    fontSize: tokens.typography.size.sm,
    color: tokens.color.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  categoryButton: {
    flex: 0.47,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
    backgroundColor: tokens.color.bg.page,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryButtonActive: {
    backgroundColor: tokens.color.bg.tintSoft,
    borderColor: tokens.color.primary,
    borderWidth: 2,
  },
  categoryIcon: { fontSize: 24, marginBottom: 4 },
  categoryLabel: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.secondary,
  },
  categoryLabelActive: {
    color: tokens.color.primary,
  },
  collectionCard: { marginBottom: tokens.spacing.md },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
  },
  collectionItemText: { flex: 1, marginLeft: tokens.spacing.md },
  collectionItemTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.primary,
  },
  collectionItemSubtitle: {
    fontSize: tokens.typography.size.xs,
    color: tokens.color.text.muted,
    marginTop: tokens.spacing.xs,
  },
  resourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    backgroundColor: tokens.color.bg.surface,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border.light,
    marginBottom: tokens.spacing.sm,
  },
  resourceButtonText: {
    marginLeft: tokens.spacing.md,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.primary,
    flex: 1,
  },
});
