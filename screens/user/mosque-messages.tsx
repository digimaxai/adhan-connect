import React, { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { enabledEnquiryCategories, submitEnquiryAction } from '../../lib/api/mosqueEnquiries';
import { ENQUIRY_CATEGORIES, enquiryCategory } from '../../lib/mosqueEnquiryCategories';
import { ScreenContainer } from '../../components/ui/screen-container';
import { AppCard } from '../../components/ui/app-card';
import { AppText } from '../../components/ui/app-text';
import { AppButton } from '../../components/ui/app-button';
import { Choice, EnquiryError, EnquiryField } from '../../components/enquiries/EnquiryFields';

export default function ContactMosque() {
  const { mosqueId } = useLocalSearchParams<{ mosqueId: string }>();
  const router = useRouter(); const { session } = useAuth();
  const [name, setName] = useState(''); const [mosqueName, setMosqueName] = useState('your mosque');
  const [enabled, setEnabled] = useState<string[]>([]); const [category, setCategory] = useState('');
  const [reason, setReason] = useState(''); const [details, setDetails] = useState(''); const [phone, setPhone] = useState('');
  const [callback, setCallback] = useState('no'); const [review, setReview] = useState(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0); const requestId = useRef(randomUUID()); const inFlight = useRef(false);
  useEffect(() => {
    let active = true; setLoading(true); setError(null); setReview(false); setCategory(''); setReason(''); setDetails(''); setPhone(''); setCallback('no'); requestId.current = randomUUID();
    setName(session?.user.user_metadata?.display_name ?? session?.user.user_metadata?.full_name ?? '');
    if (!session || !mosqueId) { setLoading(false); return; }
    Promise.all([enabledEnquiryCategories(mosqueId), supabase.from('mosques').select('name').eq('id', mosqueId).single(), supabase.from('users').select('display_name').eq('id', session.user.id).maybeSingle()]).then(([categories, mosque, profile]) => {
      if (!active) return;
      if (mosque.error) throw mosque.error;
      setEnabled(categories); setMosqueName(mosque.data.name);
      if (profile.data?.display_name) setName(profile.data.display_name);
    }).catch((e) => { if (active) setError(e?.message ?? 'Could not load this mosque’s contact options. Please retry.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mosqueId, session?.user.id, reload]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = enquiryCategory(category);
  const validate = () => {
    if (!selected || !reason || !enabled.includes(category)) return 'Select a category and reason.';
    if (name.trim().length < 2) return 'Please confirm your name.';
    if (!session?.user.email || !session.user.email_confirmed_at) return 'Please confirm your account email before submitting.';
    if (callback === 'yes' && (!/^[+()0-9 .-]+$/.test(phone.trim()) || phone.replace(/\D/g, '').length < 7 || phone.trim().length > 40)) return 'Enter a telephone number for your callback request.';
    if (['other', 'feedback'].includes(category) && details.trim().length < 5) return 'Please add a short explanation.';
    return null;
  };
  const submit = async () => {
    if (inFlight.current) return; const issue = validate(); if (issue) { setError(issue); return; }
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const result = await submitEnquiryAction({ action: 'create', id: requestId.current, mosque_id: mosqueId, contact_name: name.trim(), category, reason, details: details.trim(), callback_phone: callback === 'yes' ? phone.trim() : null }, session!.user.id);
      router.replace({ pathname: '/(user)/mosque-enquiry', params: { enquiryId: result.id, submitted: '1' } } as any);
    } catch (e: any) { setError(e.message ?? 'Could not submit. Please retry.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <ScreenContainer contentStyle={{ gap: 16 }}>
    <AppButton title="Back" variant="ghost" style={{ alignSelf: 'flex-start', backgroundColor: '#E0F2FE' }} onPress={() => router.back()} />
    <AppText variant="sectionTitle">Contact {mosqueName}</AppText>
    {!session || session.user.is_anonymous ? <AppCard><AppText>Sign in to send and manage enquiries.</AppText><AppButton title="Sign in" onPress={() => router.push('/(auth)/sign-in')} /></AppCard> : loading ? <ActivityIndicator /> : <>
      <AppText>Choose what you need help with. Your mosque will respond when its team is available.</AppText>
      <AppButton title="My enquiries & replies" variant="secondary" onPress={() => router.push('/(user)/mosque-enquiries' as any)} />
      {enabled.length === 0 ? <AppButton title="Retry loading contact options" onPress={() => setReload((v) => v + 1)} /> : review ? <AppCard style={{ gap: 12 }}>
        <AppText variant="sectionTitle">Review your enquiry</AppText>
        <AppText>{selected?.label} — {reason}</AppText><AppText>{name.trim()} · {session.user.email}</AppText>
        {callback === 'yes' && <AppText>Callback requested: {phone}</AppText>}
        {!!details.trim() && <AppText>{details.trim()}</AppText>}
        <AppText>Your name, account email and any telephone number or details you provide will be shared with this mosque’s management team. Replies will appear in My enquiries.</AppText>
        <AppButton title={busy ? 'Submitting…' : 'Submit enquiry'} disabled={busy} onPress={submit} />
        <AppButton title="Edit details" variant="ghost" disabled={busy} onPress={() => { setReview(false); requestId.current = randomUUID(); }} />
      </AppCard> : <AppCard style={{ gap: 16 }}>
        <Choice label="What would you like help with?" value={category} options={ENQUIRY_CATEGORIES.filter((c) => enabled.includes(c.id)).map((c) => ({ value: c.id, label: c.label }))} onChange={(v) => { setCategory(v); setReason(''); setError(null); }} />
        {selected && <Choice label="More specifically?" value={reason} options={selected.reasons.map((v) => ({ value: v, label: v }))} onChange={setReason} />}
        {category === 'prayer_facilities' && <AppText>Prayer times and mosque information are also available on the mosque page.</AppText>}
        {category === 'funeral' && <AppText>For urgent funeral arrangements, use the mosque’s published telephone contact. This form is not monitored continuously.</AppText>}
        {category === 'practical_support' && <AppText>Use this form to ask how to access support. Please do not include financial documents or sensitive personal details.</AppText>}
        <EnquiryField label="Your name" value={name} onChange={setName} />
        <View style={{ gap: 4 }}><AppText variant="caption">Account email</AppText><AppText>{session.user.email}</AppText><AppText variant="caption">Replies stay in the app. We use your confirmed account email for notifications.</AppText></View>
        <Choice label="Would you like to request a telephone callback?" value={callback} options={[{ value: 'no', label: 'No — reply in the app' }, { value: 'yes', label: 'Yes — if the mosque can offer one' }]} onChange={setCallback} />
        {callback === 'yes' && <EnquiryField label="Telephone number" value={phone} onChange={setPhone} phone maxLength={40} />}
        <EnquiryField label={['other', 'feedback'].includes(category) ? 'Short explanation (required)' : 'Additional details (optional)'} value={details} onChange={setDetails} multiline maxLength={2000} />
        <AppText variant="caption">Please avoid sensitive personal information. Include a preferred date or class, if relevant. Submitting a request does not confirm a booking.</AppText>
        <AppButton title="Review enquiry" onPress={() => { const issue = validate(); setError(issue); if (!issue) setReview(true); }} />
      </AppCard>}
    </>}
    <EnquiryError message={error} />
  </ScreenContainer>;
}
