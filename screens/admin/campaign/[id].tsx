// app/campaign/[id].tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

type CampaignRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  raised?: number | null;
  goal?: number | null;
  mosque_name?: string | null;
};

const formatCurrency = (n?: number | null) => `£${(n ?? 0).toLocaleString()}`;

export default function CampaignDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [amount, setAmount] = useState<number>(10);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const { data } = await supabase
        .from('campaigns')
        .select('id,title,description,raised,goal, mosques(name)')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        setCampaign({
          id: data.id,
          title: data.title,
          description: data.description,
          raised: data.raised,
          goal: data.goal,
          mosque_name: (data as any).mosques?.name ?? null,
        });
      }
    };
    load();
  }, [id]);

  const pct = (() => {
    if (!campaign) return 0;
    const goal = campaign.goal && campaign.goal > 0 ? campaign.goal : 1;
    return Math.min(100, Math.round(((campaign.raised ?? 0) / goal) * 100));
  })();

  const donate = () => {
    Alert.alert('Thank you', `Donated ${formatCurrency(amount)} to ${campaign?.title ?? 'campaign'}`);
  };

  const preset = [5, 10, 20, 50];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.back}>{'<'}</Text>
          </Pressable>
          <Text style={styles.title}>Campaign</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={[styles.card, styles.shadow]}>
          <Text style={styles.campaignTitle}>{campaign?.title ?? 'Campaign'}</Text>
          <Text style={styles.subtle}>{campaign?.mosque_name ?? ''}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.meta}>{`${formatCurrency(campaign?.raised)} raised of ${formatCurrency(campaign?.goal)}`}</Text>
          {campaign?.description ? <Text style={styles.desc}>{campaign.description}</Text> : null}
        </View>

        <View style={[styles.card, styles.shadow]}>
          <Text style={styles.cardTitle}>Choose amount</Text>
          <View style={styles.pillRow}>
            {preset.map((v) => (
              <Pressable
                key={v}
                onPress={() => setAmount(v)}
                style={({ pressed }) => [
                  styles.amountPill,
                  amount === v && styles.amountPillActive,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.amountText, amount === v && styles.amountTextActive]}>{formatCurrency(v)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.meta}>Selected: {formatCurrency(amount)}</Text>
        </View>
      </ScrollView>
      <View style={styles.sticky}>
        <Pressable onPress={donate} style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.9 : 1 }]}>
          <Text style={styles.primaryText}>{`Donate ${formatCurrency(amount)}`}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F8F9' },
  body: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  back: { fontSize: 22, color: '#111111', fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', color: '#111111' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', marginTop: 8 },
  campaignTitle: { fontSize: 20, fontWeight: '800', color: '#111111' },
  subtle: { color: '#585858', marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 10, backgroundColor: '#E5E7EB', marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 10, backgroundColor: '#1E7BF6' },
  meta: { color: '#585858', fontSize: 13, marginTop: 8 },
  desc: { marginTop: 12, color: '#111111', fontSize: 14, lineHeight: 20 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111111', marginBottom: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amountPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  amountPillActive: { backgroundColor: '#E8F2FF', borderColor: '#1E7BF6' },
  amountText: { color: '#0F172A', fontWeight: '700', fontSize: 14 },
  amountTextActive: { color: '#1E7BF6' },
  sticky: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1E7BF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  shadow: { shadowColor: '#111111', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
});
