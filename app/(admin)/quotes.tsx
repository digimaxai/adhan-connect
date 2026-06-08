import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAdminMosque } from '../../lib/hooks/useAdminMosque';
import { supabase } from '../../lib/supabase';
import { tokens } from '../../theme/tokens';

type TabKey = 'planner' | 'library' | 'week';
type ContentType = 'quran' | 'dua' | 'reflection' | 'asma' | 'hadith' | 'custom';
type Frequency = 'daily' | 'weekly' | 'fridays';
type TargetPrayer = 'home' | 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'jumuah';

type Quote = {
  id: string;
  quote_date: string;
  text_en: string;
  text_ar: string | null;
  source: string | null;
};

type ReflectionItem = {
  id: string;
  mosque_id: string;
  content_type: ContentType;
  title: string;
  text_en: string;
  text_ar: string | null;
  transliteration: string | null;
  source: string | null;
  tags: string[];
  status: 'active' | 'archived';
};

type ScheduleRow = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  frequency: Frequency;
  target_prayers: TargetPrayer[];
  item_ids: string[];
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
};

type ItemDraft = {
  content_type: ContentType;
  title: string;
  text_en: string;
  text_ar: string;
  transliteration: string;
  source: string;
  tags: string;
};

type PlannerDraft = {
  title: string;
  startDate: string;
  endDate: string;
  frequency: Frequency;
  targetPrayers: TargetPrayer[];
  selectedItemIds: string[];
};

type GeneratedOccurrence = {
  date: string;
  targetPrayer: TargetPrayer;
  item: ReflectionItem;
};

const CONTENT_TYPES: { key: ContentType; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'reflection', label: 'Reflection', icon: 'sparkles-outline' },
  { key: 'quran', label: 'Quran', icon: 'book-outline' },
  { key: 'dua', label: 'Dua', icon: 'heart-outline' },
  { key: 'asma', label: 'Name', icon: 'flower-outline' },
  { key: 'hadith', label: 'Hadith', icon: 'library-outline' },
  { key: 'custom', label: 'Custom', icon: 'create-outline' },
];

const FREQUENCIES: { key: Frequency; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'fridays', label: 'Fridays' },
];

const TARGETS: { key: TargetPrayer; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'fajr', label: 'Fajr' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
  { key: 'jumuah', label: 'Jumuah' },
];

const emptyItemDraft: ItemDraft = {
  content_type: 'reflection',
  title: '',
  text_en: '',
  text_ar: '',
  transliteration: '',
  source: '',
  tags: '',
};

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateFromIso(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateLabel(iso: string) {
  const d = dateFromIso(iso);
  if (!d) return iso;
  const today = formatLocalDate(new Date());
  const tomorrow = formatLocalDate(addLocalDays(new Date(), 1));
  if (iso === today) return 'Today';
  if (iso === tomorrow) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

function nextNDays(n: number) {
  return Array.from({ length: n }, (_, index) => formatLocalDate(addLocalDays(new Date(), index)));
}

function parseTags(raw: string) {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function getPlannerDefaults(): PlannerDraft {
  const start = new Date();
  const end = addLocalDays(start, 13);
  return {
    title: 'Reflection plan',
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
    frequency: 'daily',
    targetPrayers: ['home'],
    selectedItemIds: [],
  };
}

function matchesFrequency(date: Date, start: Date, frequency: Frequency) {
  if (frequency === 'daily') return true;
  if (frequency === 'fridays') return date.getDay() === 5;
  const diffDays = Math.round((date.getTime() - start.getTime()) / 86400000);
  return diffDays % 7 === 0;
}

function generateOccurrences(draft: PlannerDraft, items: ReflectionItem[]) {
  const start = dateFromIso(draft.startDate);
  const end = dateFromIso(draft.endDate);
  const selected = draft.selectedItemIds
    .map((id) => items.find((item) => item.id === id))
    .filter(Boolean) as ReflectionItem[];
  if (!start || !end || end < start || selected.length === 0 || draft.targetPrayers.length === 0) return [];

  const occurrences: GeneratedOccurrence[] = [];
  let activeDateIndex = 0;
  for (let cursor = new Date(start); cursor <= end; cursor = addLocalDays(cursor, 1)) {
    if (!matchesFrequency(cursor, start, draft.frequency)) continue;
    const dateIso = formatLocalDate(cursor);
    draft.targetPrayers.forEach((targetPrayer, targetIndex) => {
      const item = selected[(activeDateIndex + targetIndex) % selected.length];
      occurrences.push({ date: dateIso, targetPrayer, item });
    });
    activeDateIndex += 1;
  }
  return occurrences;
}

function contentTypeLabel(type: ContentType) {
  return CONTENT_TYPES.find((item) => item.key === type)?.label ?? 'Reflection';
}

function frequencyLabel(frequency: Frequency) {
  return FREQUENCIES.find((item) => item.key === frequency)?.label ?? 'Daily';
}

function targetLabels(targets: TargetPrayer[]) {
  return targets
    .map((target) => TARGETS.find((item) => item.key === target)?.label ?? target)
    .join(', ');
}

function isMissingPlannerTable(error: any) {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    (message.includes('mosque_reflection_') &&
      (message.includes('does not exist') || message.includes('schema cache')))
  );
}

export default function QuotesScreen() {
  const router = useRouter();
  const { selectedMosque } = useAdminMosque();
  const mosqueId = selectedMosque?.mosqueId ?? null;

  const [tab, setTab] = useState<TabKey>('planner');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [items, setItems] = useState<ReflectionItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingQuote, setSavingQuote] = useState<string | null>(null);
  const [plannerUnavailable, setPlannerUnavailable] = useState(false);
  const [itemDraft, setItemDraft] = useState<ItemDraft>(emptyItemDraft);
  const [planner, setPlanner] = useState<PlannerDraft>(() => getPlannerDefaults());
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, Partial<Quote>>>({});

  const weekDays = useMemo(() => nextNDays(7), []);
  const activeItems = useMemo(() => items.filter((item) => item.status === 'active'), [items]);
  const preview = useMemo(() => generateOccurrences(planner, activeItems), [activeItems, planner]);
  const homePreview = useMemo(
    () => preview.filter((occurrence) => occurrence.targetPrayer === 'home'),
    [preview]
  );
  const previewByDate = useMemo(() => {
    const byDate = new Map<string, GeneratedOccurrence[]>();
    preview.slice(0, 60).forEach((occurrence) => {
      const existing = byDate.get(occurrence.date) ?? [];
      existing.push(occurrence);
      byDate.set(occurrence.date, existing);
    });
    return Array.from(byDate.entries());
  }, [preview]);

  const load = useCallback(async () => {
    if (!mosqueId) {
      setQuotes([]);
      setItems([]);
      setSchedules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const from = weekDays[0];
      const to = weekDays[weekDays.length - 1];
      const quotesRes = await supabase
        .from('mosque_daily_quotes')
        .select('id,quote_date,text_en,text_ar,source')
        .eq('mosque_id', mosqueId)
        .gte('quote_date', from)
        .lte('quote_date', to)
        .order('quote_date', { ascending: true });

      if (quotesRes.error) throw quotesRes.error;
      setQuotes((quotesRes.data ?? []) as Quote[]);

      const [itemsRes, schedulesRes] = await Promise.all([
        supabase
          .from('mosque_reflection_items')
          .select('id,mosque_id,content_type,title,text_en,text_ar,transliteration,source,tags,status')
          .eq('mosque_id', mosqueId)
          .order('created_at', { ascending: false }),
        supabase
          .from('mosque_reflection_schedules')
          .select('id,title,start_date,end_date,frequency,target_prayers,item_ids,status,published_at')
          .eq('mosque_id', mosqueId)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      if (itemsRes.error || schedulesRes.error) {
        const plannerError = itemsRes.error ?? schedulesRes.error;
        if (isMissingPlannerTable(plannerError)) {
          console.warn('[ReflectionPlanner] planner tables unavailable', plannerError?.message ?? plannerError);
          setPlannerUnavailable(true);
          setItems([]);
          setSchedules([]);
          setTab('week');
          return;
        }
        throw plannerError;
      }

      const loadedItems = (itemsRes.data ?? []) as ReflectionItem[];
      setPlannerUnavailable(false);
      setItems(loadedItems);
      setSchedules((schedulesRes.data ?? []) as ScheduleRow[]);
      setPlanner((current) => {
        if (current.selectedItemIds.length || loadedItems.length === 0) return current;
        return { ...current, selectedItemIds: loadedItems.filter((item) => item.status === 'active').slice(0, 5).map((item) => item.id) };
      });
    } catch (e: any) {
      console.warn('[ReflectionPlanner] load failed', e?.message ?? e);
      Alert.alert('Unable to load planner', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [mosqueId, weekDays]);

  useEffect(() => { void load(); }, [load]);

  const quoteForDate = (date: string) => quotes.find((quote) => quote.quote_date === date) ?? null;
  const quoteDraftFor = (date: string) => quoteDrafts[date] ?? {};
  const setQuoteDraft = (date: string, patch: Partial<Quote>) =>
    setQuoteDrafts((prev) => ({ ...prev, [date]: { ...prev[date], ...patch } }));

  const updateItemDraft = (patch: Partial<ItemDraft>) => {
    setItemDraft((current) => ({ ...current, ...patch }));
  };

  const updatePlanner = (patch: Partial<PlannerDraft>) => {
    setPlanner((current) => ({ ...current, ...patch }));
  };

  const toggleSelectedItem = (id: string) => {
    setPlanner((current) => {
      const exists = current.selectedItemIds.includes(id);
      return {
        ...current,
        selectedItemIds: exists
          ? current.selectedItemIds.filter((itemId) => itemId !== id)
          : [...current.selectedItemIds, id],
      };
    });
  };

  const toggleTarget = (target: TargetPrayer) => {
    setPlanner((current) => {
      const exists = current.targetPrayers.includes(target);
      const next = exists
        ? current.targetPrayers.filter((item) => item !== target)
        : [...current.targetPrayers, target];
      return { ...current, targetPrayers: next.length ? next : ['home'] };
    });
  };

  const saveLibraryItem = async () => {
    if (!mosqueId || savingItem) return;
    const title = itemDraft.title.trim();
    const textEn = itemDraft.text_en.trim();
    if (title.length < 2) {
      Alert.alert('Title needed', 'Add a short title for this library item.');
      return;
    }
    if (textEn.length < 5) {
      Alert.alert('Text needed', 'Add the English reflection text before saving.');
      return;
    }

    setSavingItem(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        mosque_id: mosqueId,
        content_type: itemDraft.content_type,
        title,
        text_en: textEn,
        text_ar: itemDraft.text_ar.trim() || null,
        transliteration: itemDraft.transliteration.trim() || null,
        source: itemDraft.source.trim() || null,
        tags: parseTags(itemDraft.tags),
        created_by: userData.user?.id ?? null,
        updated_by: userData.user?.id ?? null,
      };
      const { error } = await supabase.from('mosque_reflection_items').insert(payload);
      if (error) throw error;
      setItemDraft(emptyItemDraft);
      await load();
      setTab('planner');
    } catch (e: any) {
      Alert.alert('Could not save item', e?.message ?? 'Please try again.');
    } finally {
      setSavingItem(false);
    }
  };

  const archiveItem = async (item: ReflectionItem) => {
    Alert.alert('Archive item', `Archive "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          const { data: userData } = await supabase.auth.getUser();
          const { error } = await supabase
            .from('mosque_reflection_items')
            .update({ status: 'archived', updated_by: userData.user?.id ?? null })
            .eq('id', item.id);
          if (error) Alert.alert('Could not archive item', error.message);
          else await load();
        },
      },
    ]);
  };

  const saveManualQuote = async (date: string) => {
    if (!mosqueId) return;
    const existing = quoteForDate(date);
    const draft = quoteDraftFor(date);
    const text_en = (draft.text_en ?? existing?.text_en ?? '').trim();
    if (!text_en) {
      Alert.alert('Required', 'Please enter the quote text in English.');
      return;
    }
    if (text_en.length < 5) {
      Alert.alert('Too short', 'Please enter at least 5 characters for the quote.');
      return;
    }
    setSavingQuote(date);
    try {
      const payload = {
        mosque_id: mosqueId,
        quote_date: date,
        text_en,
        text_ar: (draft.text_ar ?? existing?.text_ar ?? '').trim() || null,
        source: (draft.source ?? existing?.source ?? '').trim() || null,
      };
      if (existing) {
        const { error } = await supabase
          .from('mosque_daily_quotes')
          .update({ text_en: payload.text_en, text_ar: payload.text_ar, source: payload.source })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('mosque_daily_quotes').insert(payload);
        if (error) throw error;
      }
      setQuoteDrafts((prev) => { const next = { ...prev }; delete next[date]; return next; });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save quote.');
    } finally {
      setSavingQuote(null);
    }
  };

  const removeManualQuote = async (date: string) => {
    const existing = quoteForDate(date);
    if (!existing) return;
    Alert.alert('Remove quote', `Remove the quote for ${formatDateLabel(date)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSavingQuote(date);
          try {
            const { error } = await supabase.from('mosque_daily_quotes').delete().eq('id', existing.id);
            if (error) throw error;
            setQuoteDrafts((prev) => { const next = { ...prev }; delete next[date]; return next; });
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not remove quote.');
          } finally {
            setSavingQuote(null);
          }
        },
      },
    ]);
  };

  const publishPlan = async () => {
    if (!mosqueId || publishing) return;
    const start = dateFromIso(planner.startDate);
    const end = dateFromIso(planner.endDate);
    if (!planner.title.trim()) {
      Alert.alert('Plan title needed', 'Add a short title for this plan.');
      return;
    }
    if (!start || !end || end < start) {
      Alert.alert('Check dates', 'Enter a valid start and end date in YYYY-MM-DD format.');
      return;
    }
    const daySpan = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    if (daySpan > 120) {
      Alert.alert('Range too long', 'For now, publish up to 120 days at a time.');
      return;
    }
    if (!planner.selectedItemIds.length) {
      Alert.alert('Select content', 'Choose at least one library item for this plan.');
      return;
    }
    if (!preview.length) {
      Alert.alert('No dates generated', 'Adjust the dates or frequency and preview again.');
      return;
    }

    const selectedItems = planner.selectedItemIds
      .map((id) => activeItems.find((item) => item.id === id))
      .filter(Boolean) as ReflectionItem[];
    const dailyPayload = homePreview.map((occurrence) => ({
      quote_date: occurrence.date,
      text_en: occurrence.item.text_en,
      text_ar: occurrence.item.text_ar,
      source: occurrence.item.source || occurrence.item.title,
    }));
    const occurrencePayload = preview.map((occurrence) => ({
      reflection_item_id: occurrence.item.id,
      occurrence_date: occurrence.date,
      target_prayer: occurrence.targetPrayer,
    }));

    setPublishing(true);
    try {
      const { error: publishError } = await supabase.rpc('publish_mosque_reflection_plan', {
        p_mosque_id: mosqueId,
        p_title: planner.title.trim(),
        p_start_date: planner.startDate,
        p_end_date: planner.endDate,
        p_frequency: planner.frequency,
        p_target_prayers: planner.targetPrayers,
        p_item_ids: selectedItems.map((item) => item.id),
        p_occurrences: occurrencePayload,
        p_daily_quotes: dailyPayload,
      });
      if (publishError) throw publishError;

      Alert.alert(
        'Plan published',
        dailyPayload.length
          ? `Published ${dailyPayload.length} home reflection day${dailyPayload.length === 1 ? '' : 's'}.`
          : 'Plan saved for prayer targets.'
      );
      setPlanner(getPlannerDefaults());
      await load();
      setTab('week');
    } catch (e: any) {
      Alert.alert('Could not publish plan', e?.message ?? 'Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  const renderPlanner = () => (
    <View style={styles.sectionStack}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Reflection Planner</Text>
            <Text style={styles.cardSub}>Build a batch from your mosque library.</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{preview.length} slots</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Plan title</Text>
        <TextInput
          style={styles.input}
          value={planner.title}
          onChangeText={(title) => updatePlanner({ title })}
          placeholder="e.g. Ramadan first ten days"
          placeholderTextColor="#94A3B8"
        />

        <View style={styles.dateGrid}>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>Start</Text>
            <TextInput
              style={styles.input}
              value={planner.startDate}
              onChangeText={(startDate) => updatePlanner({ startDate })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>End</Text>
            <TextInput
              style={styles.input}
              value={planner.endDate}
              onChangeText={(endDate) => updatePlanner({ endDate })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Frequency</Text>
        <View style={styles.chipRow}>
          {FREQUENCIES.map((frequency) => {
            const active = planner.frequency === frequency.key;
            return (
              <Pressable
                key={frequency.key}
                onPress={() => updatePlanner({ frequency: frequency.key })}
                style={({ pressed }) => [styles.choiceChip, active && styles.choiceChipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{frequency.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Targets</Text>
        <View style={styles.chipRow}>
          {TARGETS.map((target) => {
            const active = planner.targetPrayers.includes(target.key);
            return (
              <Pressable
                key={target.key}
                onPress={() => toggleTarget(target.key)}
                style={({ pressed }) => [styles.choiceChip, active && styles.choiceChipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{target.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Library Selection</Text>
            <Text style={styles.cardSub}>{planner.selectedItemIds.length} selected</Text>
          </View>
          <Pressable onPress={() => setTab('library')} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={15} color="#0369A1" />
            <Text style={styles.linkButtonText}>Add item</Text>
          </Pressable>
        </View>

        {activeItems.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyText}>Add reusable reflections to start planning.</Text>
          </View>
        ) : (
          <View style={styles.itemList}>
            {activeItems.map((item) => {
              const selected = planner.selectedItemIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggleSelectedItem(item.id)}
                  style={({ pressed }) => [
                    styles.itemRow,
                    selected && styles.itemRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.itemIcon}>
                    <Ionicons
                      name={CONTENT_TYPES.find((type) => type.key === item.content_type)?.icon ?? 'sparkles-outline'}
                      size={16}
                      color="#0369A1"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {contentTypeLabel(item.content_type)}{item.source ? ` - ${item.source}` : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={selected ? '#059669' : '#CBD5E1'}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Preview</Text>
            <Text style={styles.cardSub}>
              {frequencyLabel(planner.frequency)} - {targetLabels(planner.targetPrayers)}
            </Text>
          </View>
          <Pressable
            onPress={publishPlan}
            disabled={publishing || !preview.length}
            style={({ pressed }) => [
              styles.publishBtn,
              (publishing || !preview.length) && styles.publishBtnDisabled,
              pressed && styles.pressed,
            ]}
          >
            {publishing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.publishText}>Publish</Text>}
          </Pressable>
        </View>

        {previewByDate.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyText}>Select content and dates to preview a plan.</Text>
          </View>
        ) : (
          <View style={styles.previewList}>
            {previewByDate.map(([date, occurrences]) => (
              <View key={date} style={styles.previewRow}>
                <View style={styles.previewDate}>
                  <Text style={styles.previewDateText}>{formatDateLabel(date)}</Text>
                  <Text style={styles.previewDateSub}>{date}</Text>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  {occurrences.map((occurrence) => (
                    <View key={`${date}-${occurrence.targetPrayer}`} style={styles.previewItem}>
                      <Text style={styles.previewTarget}>{targetLabels([occurrence.targetPrayer])}</Text>
                      <Text style={styles.previewTitle} numberOfLines={1}>{occurrence.item.title}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
            {preview.length > 60 ? (
              <Text style={styles.moreText}>+{preview.length - 60} more generated slots</Text>
            ) : null}
          </View>
        )}
      </View>

      {schedules.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Plans</Text>
          <View style={styles.itemList}>
            {schedules.slice(0, 4).map((schedule) => (
              <View key={schedule.id} style={styles.scheduleRow}>
                <Text style={styles.itemTitle} numberOfLines={1}>{schedule.title}</Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {schedule.start_date} to {schedule.end_date} - {frequencyLabel(schedule.frequency)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderLibrary = () => (
    <View style={styles.sectionStack}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add Library Item</Text>
        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.chipRow}>
          {CONTENT_TYPES.map((type) => {
            const active = itemDraft.content_type === type.key;
            return (
              <Pressable
                key={type.key}
                onPress={() => updateItemDraft({ content_type: type.key })}
                style={({ pressed }) => [styles.choiceChip, active && styles.choiceChipActive, pressed && styles.pressed]}
              >
                <Ionicons name={type.icon} size={13} color={active ? '#0369A1' : '#64748B'} />
                <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{type.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput
          style={styles.input}
          value={itemDraft.title}
          onChangeText={(title) => updateItemDraft({ title })}
          placeholder="e.g. Patience in hardship"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.fieldLabel}>English text *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={itemDraft.text_en}
          onChangeText={(text_en) => updateItemDraft({ text_en })}
          placeholder="Write the reflection, translation, or reminder."
          placeholderTextColor="#94A3B8"
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.fieldLabel}>Arabic text</Text>
        <TextInput
          style={[styles.input, styles.textArea, styles.inputArabic]}
          value={itemDraft.text_ar}
          onChangeText={(text_ar) => updateItemDraft({ text_ar })}
          placeholder="Arabic text"
          placeholderTextColor="#94A3B8"
          multiline
          textAlign="right"
          textAlignVertical="top"
        />

        <Text style={styles.fieldLabel}>Source</Text>
        <TextInput
          style={styles.input}
          value={itemDraft.source}
          onChangeText={(source) => updateItemDraft({ source })}
          placeholder="e.g. Surah Al-Baqarah 2:286"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.fieldLabel}>Tags</Text>
        <TextInput
          style={styles.input}
          value={itemDraft.tags}
          onChangeText={(tags) => updateItemDraft({ tags })}
          placeholder="ramadan, patience, salah"
          placeholderTextColor="#94A3B8"
        />

        <Pressable
          onPress={saveLibraryItem}
          disabled={savingItem}
          style={({ pressed }) => [styles.saveBtn, savingItem && styles.saveBtnDisabled, pressed && styles.pressed]}
        >
          {savingItem ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>Save to Library</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mosque Library</Text>
        {items.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyText}>No library items yet.</Text>
          </View>
        ) : (
          <View style={styles.itemList}>
            {items.map((item) => (
              <View key={item.id} style={[styles.libraryCard, item.status === 'archived' && styles.archivedCard]}>
                <View style={styles.libraryHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.itemMeta}>{contentTypeLabel(item.content_type)}{item.source ? ` - ${item.source}` : ''}</Text>
                  </View>
                  {item.status === 'active' ? (
                    <Pressable onPress={() => archiveItem(item)} hitSlop={8}>
                      <Ionicons name="archive-outline" size={18} color="#EF4444" />
                    </Pressable>
                  ) : (
                    <Text style={styles.archivedText}>Archived</Text>
                  )}
                </View>
                {item.text_ar ? <Text style={styles.arabicPreview} numberOfLines={2}>{item.text_ar}</Text> : null}
                <Text style={styles.itemBody} numberOfLines={3}>{item.text_en}</Text>
                {item.tags.length ? (
                  <View style={styles.tagRow}>
                    {item.tags.slice(0, 4).map((tag) => (
                      <View key={tag} style={styles.tagChip}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const renderWeek = () => (
    <View style={styles.sectionStack}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>This Week</Text>
        <Text style={styles.cardSub}>Manual edits still write directly to the follower Daily Reflection card.</Text>
      </View>
      {weekDays.map((date) => {
        const existing = quoteForDate(date);
        const draft = quoteDraftFor(date);
        const isSaving = savingQuote === date;
        const isDirty = Object.keys(draft).length > 0;
        const displayText = draft.text_en ?? existing?.text_en ?? '';
        const displayAr = draft.text_ar ?? existing?.text_ar ?? '';
        const displaySource = draft.source ?? existing?.source ?? '';

        return (
          <View key={date} style={[styles.dayCard, existing && styles.dayCardSet]}>
            <View style={styles.dayHeader}>
              <View style={styles.dayLabelRow}>
                <Text style={styles.dayLabel}>{formatDateLabel(date)}</Text>
                <Text style={styles.dayDate}>{date}</Text>
              </View>
              {existing ? (
                <Pressable onPress={() => removeManualQuote(date)} hitSlop={8} disabled={isSaving}>
                  <Ionicons name="trash-outline" size={17} color="#EF4444" />
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.fieldLabel}>Quote (English) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. The best of you are those who learn the Quran and teach it."
              placeholderTextColor="#94A3B8"
              value={displayText}
              onChangeText={(v) => setQuoteDraft(date, { text_en: v })}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Arabic text</Text>
            <TextInput
              style={[styles.input, styles.inputArabic]}
              placeholder="Arabic text"
              placeholderTextColor="#94A3B8"
              value={displayAr}
              onChangeText={(v) => setQuoteDraft(date, { text_ar: v })}
              multiline
              textAlign="right"
            />

            <Text style={styles.fieldLabel}>Source</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Surah Al-Baqarah 2:286"
              placeholderTextColor="#94A3B8"
              value={displaySource}
              onChangeText={(v) => setQuoteDraft(date, { source: v })}
            />

            <Pressable
              onPress={() => saveManualQuote(date)}
              disabled={isSaving || (!isDirty && !!existing)}
              style={({ pressed }) => [
                styles.saveBtn,
                (isSaving || (!isDirty && !!existing)) && styles.saveBtnDisabled,
                pressed && styles.pressed,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>{existing ? (isDirty ? 'Save Changes' : 'Saved') : 'Save Quote'}</Text>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={tokens.color.text.primary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Reflection Planner</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{selectedMosque?.name ?? 'No mosque selected'}</Text>
        </View>
      </View>

      {!mosqueId ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No mosque selected. Return to admin home and select a mosque.</Text>
        </View>
      ) : loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={tokens.color.text.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.tabRow}>
            {[
              { key: 'planner' as TabKey, label: 'Planner' },
              { key: 'library' as TabKey, label: 'Library' },
              { key: 'week' as TabKey, label: 'Week' },
            ].map((tabDef) => {
              const active = tab === tabDef.key;
              const disabled = plannerUnavailable && tabDef.key !== 'week';
              return (
                <Pressable
                  key={tabDef.key}
                  onPress={() => { if (!disabled) setTab(tabDef.key); }}
                  style={({ pressed }) => [
                    styles.tabPill,
                    active && styles.tabPillActive,
                    disabled && styles.tabPillDisabled,
                    pressed && !disabled && styles.pressed,
                  ]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive, disabled && styles.tabTextDisabled]}>
                    {tabDef.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {plannerUnavailable ? (
            <View style={styles.warningCard}>
              <Ionicons name="information-circle-outline" size={18} color="#92400E" />
              <Text style={styles.warningText}>
                Reflection Planner tables are not available in this environment. Weekly manual quotes are still available.
              </Text>
            </View>
          ) : null}

          {tab === 'planner' && !plannerUnavailable ? renderPlanner() : null}
          {tab === 'library' && !plannerUnavailable ? renderLibrary() : null}
          {tab === 'week' ? renderWeek() : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.app },
  pressed: { opacity: 0.86 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: tokens.color.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border.subtle,
  },
  backBtn: { padding: 4 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: tokens.color.text.primary },
  headerSub: { fontSize: 13, color: tokens.color.text.secondary, marginTop: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: tokens.color.text.secondary, textAlign: 'center', lineHeight: 22 },
  body: { padding: 20, gap: 14, paddingBottom: 48 },
  sectionStack: { gap: 14 },

  tabRow: { flexDirection: 'row', gap: 8 },
  tabPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    backgroundColor: tokens.color.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  tabPillDisabled: { opacity: 0.45 },
  tabText: { color: tokens.color.text.secondary, fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: '#0369A1' },
  tabTextDisabled: { color: '#94A3B8' },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningText: { flex: 1, color: '#92400E', fontSize: 12, fontWeight: '700', lineHeight: 17 },

  card: {
    backgroundColor: tokens.color.bg.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: tokens.color.text.primary },
  cardSub: { color: tokens.color.text.secondary, fontSize: 12, marginTop: 2 },
  countPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F0FDF4' },
  countText: { color: '#047857', fontWeight: '800', fontSize: 12 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 0.5, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: tokens.color.border.muted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tokens.color.text.primary,
    backgroundColor: '#F8FAFC',
    minHeight: 42,
  },
  textArea: { minHeight: 92 },
  inputArabic: { fontWeight: '500', fontSize: 15 },
  dateGrid: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    backgroundColor: '#F8FAFC',
  },
  choiceChipActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  choiceText: { color: tokens.color.text.secondary, fontSize: 12, fontWeight: '800' },
  choiceTextActive: { color: '#0369A1' },

  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  linkButtonText: { color: '#0369A1', fontSize: 12, fontWeight: '800' },
  publishBtn: {
    minWidth: 86,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  publishBtnDisabled: { backgroundColor: '#CBD5E1' },
  publishText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  saveBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { backgroundColor: '#E2E8F0' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  emptyPanel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 14,
  },
  itemList: { gap: 8 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 10,
  },
  itemRowSelected: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { color: tokens.color.text.primary, fontSize: 14, fontWeight: '800' },
  itemMeta: { color: tokens.color.text.secondary, fontSize: 12, marginTop: 2 },
  itemBody: { color: '#334155', fontSize: 13, lineHeight: 19, marginTop: 8 },
  libraryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  archivedCard: { opacity: 0.56 },
  libraryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  archivedText: { color: '#94A3B8', fontSize: 11, fontWeight: '800' },
  arabicPreview: { color: '#92400E', fontSize: 16, lineHeight: 25, textAlign: 'right', marginTop: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tagChip: { borderRadius: 999, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { color: '#64748B', fontSize: 11, fontWeight: '700' },

  previewList: { gap: 10 },
  previewRow: { flexDirection: 'row', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  previewDate: { width: 86 },
  previewDateText: { color: '#0F172A', fontWeight: '900', fontSize: 13 },
  previewDateSub: { color: '#94A3B8', fontWeight: '700', fontSize: 11, marginTop: 2 },
  previewItem: {
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  previewTarget: { color: '#0369A1', fontSize: 11, fontWeight: '900' },
  previewTitle: { color: '#0F172A', fontSize: 13, fontWeight: '800', marginTop: 2 },
  moreText: { color: '#64748B', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  scheduleRow: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },

  dayCard: {
    backgroundColor: tokens.color.bg.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  dayCardSet: { borderColor: '#FDE68A', backgroundColor: '#FFFBF2' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  dayLabelRow: { gap: 4 },
  dayLabel: { fontSize: 15, fontWeight: '800', color: tokens.color.text.primary },
  dayDate: { fontSize: 11, color: tokens.color.text.muted, fontWeight: '600' },
});
