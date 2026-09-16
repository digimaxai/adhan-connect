import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContentDetailHero } from '../../../components/ContentDetailHero';
import { ContentDocumentsList } from '../../../components/ContentDocumentsList';
import { BackButton } from '@/components/ui/back-button';
import { getAttachmentPublicUrl, listContentAttachments, type ContentAttachment } from '../../../lib/api/admin/contentAttachments';
import { httpsUrl } from '../../../lib/serviceListings';
import { supabase } from '../../../lib/supabase';
import { tokens } from '@/theme/tokens';

type CampaignRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  end_at?: string | null;
  mosque_name?: string | null;
  donation_url?: string | null;
  status?: string | null;
};

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CampaignDetail({ adminPreview = false }: { adminPreview?: boolean } = {}) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [attachments, setAttachments] = useState<ContentAttachment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [openError, setOpenError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        let query = supabase.from('campaigns').select('id,title,description,donation_url,status,end_at,mosques(name)').eq('id', id);
        if (!adminPreview) query = query.eq('status', 'active').or(`end_at.is.null,end_at.gte.${localDate(new Date())}`);
        const [{ data, error: e }, { attachments: rows }] = await Promise.all([query.maybeSingle(), listContentAttachments('campaign', id)]);
        if (e) throw e;
        if (!alive) return;
        if (!data) setCampaign(null);
        else {
          const row = data as any;
          setCampaign({ id: row.id, title: row.title, description: row.description, end_at: row.end_at, donation_url: row.donation_url, status: row.status, mosque_name: row.mosques?.name ?? null });
        }
        setAttachments(rows ?? []);
      } catch {
        if (alive) setError('This appeal could not be loaded.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, adminPreview]);

  const cover = attachments.find((a) => a.kind === 'image') ?? null;
  const documents = attachments.filter((a) => a.kind === 'document');
  const donationUrl = httpsUrl(campaign?.donation_url || '');
  const host = donationUrl ? new URL(donationUrl).hostname.replace(/^www\./, '') : null;
  const ends = campaign?.end_at ? new Date(campaign.end_at) : null;
  const daysLeft = ends ? Math.ceil((ends.getTime() - Date.now()) / 86400000) : null;

  const donate = async () => {
    if (!donationUrl) return;
    try {
      setOpenError('');
      await Linking.openURL(donationUrl);
    } catch {
      setOpenError('Could not open the donation page. Please try again or visit the mosque’s website.');
    }
  };
  const share = () => {
    if (!campaign) return;
    void Share.share({ message: `${campaign.title}${campaign.mosque_name ? ` — ${campaign.mosque_name}` : ''}${donationUrl ? `\nDonate: ${donationUrl}` : ''}` });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator color="#E11D48" />
        </View>
      </SafeAreaView>
    );
  }
  if (!campaign) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.body}>
          <BackButton fallbackHref="/(user)/listener-home" />
          <View style={styles.card}>
            <Text style={styles.h2}>Appeal unavailable</Text>
            <Text style={styles.p}>{error || 'This appeal may be paused, ended, or no longer public.'}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ContentDetailHero imageUrl={cover ? getAttachmentPublicUrl(cover.storage_path) : null} icon="heart-outline" title={campaign.title} onBack={() => router.back()} shareTitle={null} />
        <View style={styles.body}>
          {adminPreview && (
            <View style={styles.previewBanner}>
              <Ionicons name="eye-outline" size={14} color="#B45309" />
              <Text style={styles.previewText}>Preview · {campaign.status === 'active' ? 'Active — visible to followers' : campaign.status === 'paused' ? 'Paused — hidden from followers' : 'Ended'}</Text>
            </View>
          )}
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Ionicons name="heart" size={12} color="#E11D48" />
              <Text style={styles.tagText}>Appeal</Text>
            </View>
            {daysLeft !== null && daysLeft >= 0 && (
              <View style={[styles.tag, styles.tagNeutral]}>
                <Ionicons name="time-outline" size={12} color="#475569" />
                <Text style={[styles.tagText, { color: '#475569' }]}>{daysLeft === 0 ? 'Ends today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</Text>
              </View>
            )}
          </View>
          <Text style={styles.h1}>{campaign.title ?? 'Appeal'}</Text>
          {campaign.mosque_name ? <Text style={styles.mosque}>{campaign.mosque_name}</Text> : null}
          {campaign.description ? <Text style={styles.p}>{campaign.description}</Text> : null}

          <View style={styles.howCard}>
            <View style={styles.howHead}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#155F4E" />
              <Text style={styles.howTitle}>How donating works</Text>
            </View>
            <Text style={styles.howText}>
              {host ? `Tapping Donate opens the mosque’s own secure page on ${host}. ` : 'The mosque has not added its donation page yet. '}
              The mosque handles amounts, receipts and Gift Aid. Adhan Connect never takes or holds any money.
            </Text>
          </View>

          <ContentDocumentsList documents={documents} />

          <Pressable onPress={share} style={styles.shareBtn}>
            <Ionicons name="share-social-outline" size={16} color="#0F172A" />
            <Text style={styles.shareText}>Share this appeal</Text>
          </Pressable>
          {!!openError && <Text style={styles.error}>{openError}</Text>}
        </View>
      </ScrollView>

      <View style={styles.sticky}>
        <Pressable accessibilityRole="button" onPress={donate} disabled={!donationUrl} style={({ pressed }) => [styles.primaryBtn, !donationUrl && styles.disabled, pressed && { opacity: 0.9 }]}>
          <Ionicons name="open-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>{donationUrl ? 'Donate on the mosque’s website' : 'Donation page not available'}</Text>
        </Pressable>
        {host ? <Text style={styles.hostNote}>Opens {host}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.app },
  scroll: { paddingBottom: 130 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 18, gap: 12, maxWidth: 780, width: '100%', alignSelf: 'center' },
  previewBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10 },
  previewText: { color: '#B45309', fontSize: 12, fontWeight: '700' },
  tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFE4E6', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagNeutral: { backgroundColor: '#F1F5F9' },
  tagText: { fontSize: 12, fontWeight: '800', color: '#BE123C' },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: tokens.color.text.primary },
  h2: { fontSize: 18, fontWeight: '800', color: tokens.color.text.primary },
  mosque: { fontSize: 14, color: tokens.color.text.secondary, marginTop: -6 },
  p: { fontSize: 15, lineHeight: 23, color: '#334155' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, gap: 8, borderWidth: 1, borderColor: tokens.color.border.subtle, marginTop: 12 },
  howCard: { backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: '#BBF7D0' },
  howHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  howTitle: { fontSize: 14, fontWeight: '800', color: '#155F4E' },
  howText: { fontSize: 13, lineHeight: 19, color: '#166534' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: tokens.color.border.muted },
  shareText: { fontWeight: '700', color: tokens.color.text.primary, fontSize: 14 },
  error: { color: tokens.color.status.danger, fontSize: 13, textAlign: 'center' },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 24, backgroundColor: 'rgba(248,249,251,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB', gap: 6 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E11D48', borderRadius: 14, paddingVertical: 15 },
  disabled: { backgroundColor: '#94A3B8' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  hostNote: { textAlign: 'center', fontSize: 12, color: tokens.color.text.secondary },
});
