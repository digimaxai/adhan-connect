import React, { useCallback, useRef, useState } from 'react';
import { BackButton } from '@/components/ui/back-button';
import { ActivityIndicator, Alert, Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { EnquiryReply, getEnquiry, manageEnquiry, MosqueEnquiry, submitEnquiryAction } from '../../lib/api/mosqueEnquiries';
import { enquiryCategory, ENQUIRY_STATUS_LABELS } from '../../lib/mosqueEnquiryCategories';
import { ScreenContainer } from '../ui/screen-container';
import { AppCard } from '../ui/app-card';
import { AppText } from '../ui/app-text';
import { AppButton } from '../ui/app-button';
import { EnquiryError, EnquiryField } from './EnquiryFields';
export function EnquiryDetail({ admin = false }: { admin?: boolean }) {
  const { enquiryId, submitted } = useLocalSearchParams<{ enquiryId: string; submitted?: string }>();
  const { session } = useAuth(); const router = useRouter();
  const [enquiry, setEnquiry] = useState<MosqueEnquiry | null>(null); const [replies, setReplies] = useState<EnquiryReply[]>([]);
  const [draft, setDraft] = useState(''); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const version = useRef(0); const inFlight = useRef(false); const replyId = useRef(randomUUID());
  const scope = useRef(''); scope.current = `${session?.user.id}:${enquiryId}:${admin}`;
  const load = useCallback(async () => {
    const current = ++version.current; setError(null);
    if (!session?.user.id || !enquiryId) { setEnquiry(null); setLoading(false); return; }
    try { const result = await getEnquiry(enquiryId, admin ? undefined : session.user.id); if (current === version.current) { setEnquiry(result.enquiry); setReplies(result.replies); } }
    catch { if (current === version.current) { setEnquiry(null); setError('This enquiry could not be loaded, or you no longer have access.'); } }
    finally { if (current === version.current) setLoading(false); }
  }, [enquiryId, session?.user.id, admin]);
  useFocusEffect(useCallback(() => { setEnquiry(null); setReplies([]); setLoading(true); setDraft(''); setConfirmation(null); replyId.current = randomUUID(); void load(); return () => { version.current++; }; }, [load]));
  const run = async (action: () => Promise<unknown>, leave = false) => {
    if (inFlight.current) return; const original = scope.current; inFlight.current = true; setBusy(true); setError(null); setConfirmation(null);
    try { await action(); if (scope.current !== original) return; if (leave) router.back(); else await load(); }
    catch (e: any) { if (scope.current === original) setError(e.message ?? 'Could not save. Please retry.'); }
    finally { inFlight.current = false; if (scope.current === original) setBusy(false); }
  };
  const remove = () => {
    const text = admin ? 'Archive this enquiry? You can restore it from Archived enquiries.' : 'Remove your copy of this enquiry? The mosque may retain its copy.';
    const perform = () => { void run(() => manageEnquiry(enquiryId, admin ? 'archive' : 'delete'), true); };
    if (Platform.OS === 'web') { if (window.confirm(text)) perform(); }
    else Alert.alert(admin ? 'Archive enquiry' : 'Delete enquiry', text, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: perform }]);
  };
  const send = () => { if (!draft.trim()) return; const original = scope.current; void run(async () => {
    await submitEnquiryAction({ action: 'reply', id: replyId.current, enquiry_id: enquiryId, body: draft.trim(), as_admin: admin }, session!.user.id);
    if (scope.current === original) { setDraft(''); replyId.current = randomUUID(); }
  }); };
  return <ScreenContainer contentStyle={{ gap: 14 }}>
    <BackButton />
    <AppText variant="sectionTitle">Enquiry details</AppText>
    {submitted === '1' && !admin && <AppText>Your enquiry has been received. This is a request, not a confirmed booking. Check My enquiries for replies.</AppText>}
    <EnquiryError message={error} />
    {!!confirmation && <AppCard style={{ gap: 4 }}><AppText>{confirmation}</AppText></AppCard>}
    <AppButton title="Refresh enquiry" variant="ghost" disabled={busy} onPress={() => { void load(); }} />
    {loading ? <ActivityIndicator /> : enquiry && <>
      <AppCard style={{ gap: 8 }}>
        <AppText>{enquiry.mosques?.name}</AppText>
        <AppText variant="sectionTitle">{enquiryCategory(enquiry.category)?.label ?? enquiry.category}</AppText><AppText>{enquiry.reason}</AppText>
        <AppText>{admin && enquiry.status === 'waiting_for_listener' ? 'Waiting for listener' : ENQUIRY_STATUS_LABELS[enquiry.status]}</AppText>
        <AppText variant="caption">Reference {enquiry.id.slice(0, 8).toUpperCase()} · {new Date(enquiry.created_at).toLocaleString()}</AppText>
        <AppText>{enquiry.contact_name}</AppText><AppText selectable>{enquiry.contact_email}{enquiry.email_verified ? ' · Account email confirmed' : ' · Email not confirmed'}</AppText>
        {!!enquiry.callback_phone && <AppText selectable>Callback requested: {enquiry.callback_phone}</AppText>}
        {!!enquiry.details && <AppText>{enquiry.details}</AppText>}
      </AppCard>
      {admin && <AppCard style={{ gap: 8 }}>
        <AppText>Contact details were supplied for this enquiry. Use the reply form to keep the response in its history.</AppText>
        {enquiry.status === 'in_progress'
          ? <AppText>Current status: In progress</AppText>
          : <AppButton title={enquiry.status === 'resolved' ? 'Reopen enquiry' : 'Mark in progress'} disabled={busy} onPress={() => { void run(async () => { await manageEnquiry(enquiryId, 'in_progress'); setConfirmation(enquiry.status === 'resolved' ? 'Enquiry reopened and marked as in progress.' : 'Enquiry marked as in progress.'); }); }} />}
        {enquiry.status !== 'resolved' && <AppButton title="Mark resolved" disabled={busy} variant="ghost" onPress={() => { void run(() => manageEnquiry(enquiryId, 'resolved')); }} />}
        {enquiry.archived_by_admin && <AppButton title="Restore to inbox" disabled={busy} onPress={() => { void run(() => manageEnquiry(enquiryId, 'restore')); }} />}
      </AppCard>}
      <AppText variant="sectionTitle">Replies</AppText>
      {replies.length === 0 && <AppText>No replies yet.</AppText>}
      {replies.map((r) => <AppCard key={r.id} style={{ gap: 8 }}><AppText variant="caption">{r.sender_type === 'admin' ? 'Mosque team' : enquiry.contact_name} · {new Date(r.created_at).toLocaleString()}</AppText><AppText>{r.body}</AppText></AppCard>)}
      {admin && enquiry.deleted_by_listener ? <AppText>The listener removed their copy of this enquiry. Further replies will not be sent to them.</AppText> : enquiry.status === 'resolved' ? <AppText>This enquiry is resolved. Contact the mosque with a new enquiry if you need further help.</AppText> : <AppCard style={{ gap: 10 }}>
        <EnquiryField label="Add a reply about this enquiry" value={draft} onChange={(s) => { setDraft(s); replyId.current = randomUUID(); }} multiline maxLength={2000} />
        <AppButton title={busy ? 'Saving…' : 'Submit reply'} disabled={busy || !draft.trim()} onPress={send} />
      </AppCard>}
      <AppButton title={admin ? 'Archive enquiry' : 'Delete my copy'} variant="ghost" disabled={busy} onPress={remove} />
      {!admin && <AppButton title="My enquiries" variant="ghost" onPress={() => router.replace('/(user)/mosque-enquiries' as any)} />}
    </>}
  </ScreenContainer>;
}
