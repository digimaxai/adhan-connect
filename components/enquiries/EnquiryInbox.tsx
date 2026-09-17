import React, { useCallback, useRef, useState } from 'react';
import { BackButton } from '@/components/ui/back-button';
import { ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useAdminMosque } from '../../lib/hooks/useAdminMosque';
import { configureEnquiries, enabledEnquiryCategories, listEnquiries, MosqueEnquiry } from '../../lib/api/mosqueEnquiries';
import { ENQUIRY_CATEGORIES, ENQUIRY_STATUS_LABELS, enquiryCategory } from '../../lib/mosqueEnquiryCategories';
import { ScreenContainer } from '../ui/screen-container';
import { AppCard } from '../ui/app-card';
import { AppText } from '../ui/app-text';
import { AppButton } from '../ui/app-button';
import { Choice, EnquiryError } from './EnquiryFields';
export function EnquiryInbox({ admin = false }: { admin?: boolean }) {
  const router = useRouter(); const { session } = useAuth();
  const mosque = useAdminMosque({ enabled: admin }); const mosqueId = mosque.selectedMosque?.mosqueId;
  const [rows, setRows] = useState<MosqueEnquiry[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); const [status, setStatus] = useState('all'); const [archived, setArchived] = useState(false);
  const [settings, setSettings] = useState(false); const [categories, setCategories] = useState<string[]>([]); const [saving, setSaving] = useState(false);
  const version = useRef(0);
  const load = useCallback(async () => {
    const current = ++version.current; setLoading(true); setError(null);
    if (!session?.user.id || (admin && !mosqueId)) { setRows([]); setLoading(false); return; }
    try {
      const result = await listEnquiries(admin ? { mosqueId, archived } : { accountId: session.user.id });
      const options = admin && mosqueId ? await enabledEnquiryCategories(mosqueId) : [];
      if (current === version.current) { setRows(result); setCategories(options); }
    } catch { if (current === version.current) { setRows([]); setError('Could not load enquiries. Please retry.'); } }
    finally { if (current === version.current) setLoading(false); }
  }, [admin, mosqueId, session?.user.id, archived]);
  useFocusEffect(useCallback(() => { setRows([]); setSettings(false); void load(); return () => { version.current++; }; }, [load]));
  const save = async () => {
    if (!mosqueId || saving) return; setSaving(true); setError(null);
    try { await configureEnquiries(mosqueId, categories); setSettings(false); } catch { setError('Could not save contact options.'); } finally { setSaving(false); }
  };
  return <ScreenContainer contentStyle={{ gap: 14 }}>
    {!admin && <BackButton />}
    <AppText variant="sectionTitle">{admin ? 'Enquiries' : 'My enquiries'}</AppText>
    {admin && <AppText>{mosque.selectedMosque?.name ?? 'Select a mosque in your dashboard.'}</AppText>}
    <EnquiryError message={error ?? (admin ? mosque.error : null)} />
    {!session ? <AppButton title="Sign in" onPress={() => router.push('/(auth)/sign-in')} /> : <>
      <AppButton title="Refresh enquiries" variant="ghost" disabled={loading} onPress={() => { void load(); }} />
      {admin && mosqueId && <>
        <AppButton title={settings ? 'Close contact options' : 'Manage contact options'} variant="ghost" disabled={saving} onPress={() => setSettings(!settings)} />
        <AppButton title={archived ? 'Show active enquiries' : 'Show archived enquiries'} variant="ghost" onPress={() => setArchived(!archived)} />
      </>}
      {settings && <AppCard style={{ gap: 10 }}>
        <AppText variant="sectionTitle">What can people contact you about?</AppText>
        <AppText>Enable only services your mosque agrees to handle. All local admins can see these enquiries.</AppText>
        {ENQUIRY_CATEGORIES.map((c) => <Pressable key={c.id} accessibilityRole="checkbox" accessibilityState={{ checked: categories.includes(c.id), disabled: c.id === 'other' }} disabled={c.id === 'other' || saving} onPress={() => setCategories((old) => old.includes(c.id) ? old.filter((v) => v !== c.id) : [...old, c.id])} style={{ padding: 12, backgroundColor: '#F1F5F9', borderRadius: 10 }}><AppText>{categories.includes(c.id) ? '✓ ' : '○ '}{c.label}{c.optional ? ' — opt-in service' : ''}</AppText></Pressable>)}
        <AppButton title={saving ? 'Saving…' : 'Save contact options'} disabled={saving} onPress={save} />
      </AppCard>}
      <Choice label="Status" value={status} options={[{ value: 'all', label: 'All statuses' }, ...Object.entries(ENQUIRY_STATUS_LABELS).map(([value, label]) => ({ value, label: admin && value === 'waiting_for_listener' ? 'Waiting for listener' : label }))]} onChange={setStatus} />
      {(loading || (admin && mosque.loading)) ? <ActivityIndicator /> : rows.filter((e) => status === 'all' || e.status === status).length === 0 ? <AppText>No enquiries to show. {admin ? '' : 'Open a mosque page and choose Contact your mosque to submit one.'}</AppText> : rows.filter((e) => status === 'all' || e.status === status).map((e) => <Pressable key={e.id} accessibilityRole="button" onPress={() => router.push({ pathname: admin ? '/(admin)/enquiry-detail' : '/(user)/mosque-enquiry', params: { enquiryId: e.id } } as any)}>
        <AppCard style={{ gap: 6, borderColor: !admin && e.status === 'waiting_for_listener' ? '#0EA5E9' : undefined }}><AppText variant="sectionTitle">{admin ? e.contact_name : enquiryCategory(e.category)?.label}</AppText><AppText>{!admin ? `${e.mosques?.name ?? 'Mosque'} · ` : ''}{admin ? `${enquiryCategory(e.category)?.label} · ` : ''}{e.reason}</AppText><AppText variant="caption">{!admin && e.status === 'waiting_for_listener' ? 'Reply received · View response' : admin && e.status === 'waiting_for_listener' ? 'Waiting for listener' : ENQUIRY_STATUS_LABELS[e.status]} · {new Date(e.updated_at).toLocaleDateString()}</AppText></AppCard>
      </Pressable>)}
      {admin && <AppButton title="Previous conversations" variant="ghost" onPress={() => router.push('/(admin)/previous-conversations' as any)} />}
    </>}
  </ScreenContainer>;
}
