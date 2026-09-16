import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContentDetailHero } from '../../../components/ContentDetailHero';
import { ContentDocumentsList } from '../../../components/ContentDocumentsList';
import {
  getAttachmentPublicUrl,
  listContentAttachments,
  type ContentAttachment,
} from '../../../lib/api/admin/contentAttachments';
import { httpsUrl } from '../../../lib/serviceListings';
import { supabase } from '../../../lib/supabase';

type CampaignRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  raised_cents?: number | null;
  goal_cents?: number | null;
  end_at?: string | null;
  mosque_name?: string | null;
  donation_url?: string | null;
  status?: string | null;
};

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CampaignDetail({ adminPreview = false }: { adminPreview?: boolean } = {}) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [attachments, setAttachments] = useState<ContentAttachment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        let query = supabase.from('campaigns').select('id,title,description,donation_url,status,end_at,mosques(name)').eq('id', id);
        if (!adminPreview) query = query.eq('status', 'active').or(`end_at.is.null,end_at.gte.${formatLocalDate(new Date())}`);
        const [{ data, error: loadError }, { attachments: rows }] = await Promise.all([
          query.maybeSingle(),
          listContentAttachments('campaign', id),
        ]);
        if (loadError) throw loadError;
        setCampaign(
          data
            ? {
                id: data.id,
                title: data.title,
                description: data.description,
                donation_url: data.donation_url,
                status: data.status,
                end_at: data.end_at,
                mosque_name: (data as any).mosques?.name ?? null,
              }
            : null
        );
        setAttachments(rows);
      } catch {
        setError('Unable to load this appeal. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, adminPreview]);

  const coverImage = attachments.find((item) => item.kind === 'image') ?? null;
  const documents = attachments.filter((item) => item.kind === 'document');

  const donationUrl = httpsUrl(campaign?.donation_url || '');
  const donate = async () => {
    if (!donationUrl) return;
    try { setError(''); await Linking.openURL(donationUrl); }
    catch { setError('Unable to open the donation page. Please try again.'); }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#1E7BF6" />
        </View>
      ) : campaign ? (
        <>
          <ScrollView contentContainerStyle={styles.scrollBody}>
            <ContentDetailHero
              imageUrl={coverImage ? getAttachmentPublicUrl(coverImage.storage_path) : null}
              icon="heart-outline"
              title={campaign.title}
              onBack={() => router.back()}
              shareTitle={campaign.title ? `${campaign.title}${campaign.mosque_name ? ` — ${campaign.mosque_name}` : ''}` : null}
            />
            <View style={styles.body}>
              <View style={[styles.card, styles.shadow]}>
                <Text style={styles.campaignTitle}>
                  {campaign.title ?? 'Campaign'}
                </Text>
                {campaign.mosque_name ? (
                  <Text style={styles.subtle}>{campaign.mosque_name}</Text>
                ) : null}
                {adminPreview && <Text style={styles.meta}>ADMIN PREVIEW · {campaign.status?.toUpperCase()}</Text>}
                {campaign.end_at ? (
                  <Text style={styles.meta}>
                    Ends{' '}
                    {new Date(campaign.end_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                ) : null}
                {campaign.description ? (
                  <Text style={styles.desc}>{campaign.description}</Text>
                ) : null}
              </View>

              <ContentDocumentsList documents={documents} />

              <View style={[styles.card, styles.shadow]}>
                <Text style={styles.cardTitle}>Donate directly to the mosque</Text>
                <Text style={styles.meta}>Your donation is completed with the mosque’s payment provider. The mosque handles amounts, receipts and any Gift Aid declaration.</Text>
                {donationUrl ? <Text style={styles.meta}>{new URL(donationUrl).hostname}</Text> : <Text style={styles.meta}>The mosque has not added a donation link yet.</Text>}
                {!!error && <Text accessibilityRole="alert" style={styles.meta}>{error}</Text>}
              </View>
            </View>
          </ScrollView>
          <View style={styles.sticky}>
            <Pressable
              onPress={() => void donate()}
              disabled={!donationUrl}
              style={({ pressed }) => [
                styles.primaryBtn,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={styles.primaryText}>
                {donationUrl ? 'Donate on mosque’s website ↗' : 'Donation link unavailable'}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.topBar}>
            <Ionicons name="chevron-back" size={24} color="#111111" onPress={() => router.back()} />
            <Text style={styles.title}>Campaign</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={[styles.card, styles.shadow]}>
            <Text style={styles.campaignTitle}>Campaign unavailable</Text>
            <Text style={styles.desc}>
              {error || 'This campaign may be paused, ended, or no longer public.'}
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F8F9' },
  scrollBody: { paddingBottom: 24 },
  body: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111111' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginTop: 14,
  },
  campaignTitle: { fontSize: 20, fontWeight: '800', color: '#111111' },
  subtle: { color: '#585858', marginTop: 4 },
  progressTrack: {
    height: 8,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#1E7BF6',
  },
  meta: { color: '#585858', fontSize: 13, marginTop: 8 },
  desc: {
    marginTop: 12,
    color: '#111111',
    fontSize: 14,
    lineHeight: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 12,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amountPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  amountPillActive: {
    backgroundColor: '#E8F2FF',
    borderColor: '#1E7BF6',
  },
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
  shadow: {
    shadowColor: '#111111',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});
