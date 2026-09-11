import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { notifyMosqueRequest } from '../../lib/api/mosqueRequestNotify';
import { AppButton } from '../../components/ui/app-button';
import { AppCard } from '../../components/ui/app-card';
import { AppText } from '../../components/ui/app-text';
import { ScreenContainer } from '../../components/ui/screen-container';
import { tokens } from '../../theme/tokens';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputStyle = {
  backgroundColor: tokens.color.bg.subtle,
  borderRadius: tokens.radius.md,
  borderWidth: 1,
  borderColor: tokens.color.border.muted,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: tokens.typography.size.md,
  color: tokens.color.text.primary,
} as const;

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" style={{ color: tokens.color.text.secondary }}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.text.muted}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        style={inputStyle}
      />
    </View>
  );
}

export default function InviteMosqueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [mosqueName, setMosqueName] = useState(params.name ?? '');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWebsite, setContactWebsite] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!userId) {
    return (
      <ScreenContainer contentStyle={{ gap: 16 }}>
        <AppButton title="Back" variant="ghost" onPress={() => router.back()} />
        <AppCard style={{ gap: 12 }}>
          <AppText variant="sectionTitle">Sign in to continue</AppText>
          <AppText variant="body" style={{ color: tokens.color.text.secondary }}>
            Sign in or create a free account to invite a mosque to join Adhan Connect.
          </AppText>
          <View style={{ gap: 8, marginTop: 4 }}>
            <AppButton title="Sign In" onPress={() => router.push('/(auth)/sign-in')} />
            <AppButton title="Create Account" variant="ghost" onPress={() => router.push('/(auth)/sign-up')} />
          </View>
        </AppCard>
      </ScreenContainer>
    );
  }

  if (submitted) {
    return (
      <ScreenContainer contentStyle={{ gap: 16 }}>
        <AppButton title="Back" variant="ghost" onPress={() => router.back()} />
        <AppCard style={{ gap: 12 }}>
          <AppText variant="sectionTitle">Invite sent</AppText>
          <AppText variant="body" style={{ color: tokens.color.text.secondary }}>
            Thank you — we&apos;ve logged your invite for {mosqueName.trim()}. Our team will reach out
            to them with an introduction to Adhan Connect and guide them through joining.
          </AppText>
          <View style={{ gap: 8, marginTop: 4 }}>
            <AppButton title="Back to Discover" onPress={() => router.replace('/(user)/discover')} />
            <AppButton title="Back to Home" variant="ghost" onPress={() => router.replace('/(user)/listener-home')} />
          </View>
        </AppCard>
      </ScreenContainer>
    );
  }

  const canSubmit = mosqueName.trim().length >= 2 && !submitting;

  const handleSubmit = async () => {
    if (submitting) return;
    if (mosqueName.trim().length < 2) {
      setError('Please enter the mosque name.');
      return;
    }
    if (contactEmail.trim() && !EMAIL_PATTERN.test(contactEmail.trim())) {
      setError('Please enter a valid contact email, or leave it blank.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        id: randomUUID(),
        request_type: 'invite_known_mosque',
        mosque_name: mosqueName.trim(),
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_website: contactWebsite.trim() || null,
        note: note.trim() || null,
        submitted_by: userId,
      };
      const { error: insertError } = await supabase.from('mosque_add_requests').insert(payload);
      if (insertError) throw insertError;
      notifyMosqueRequest(payload.id, session?.access_token ?? '');
      setSubmitted(true);
    } catch {
      setError('Something went wrong submitting your invite. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer contentStyle={{ gap: 16 }}>
        <AppButton title="Back" variant="ghost" onPress={() => router.back()} />
      <View style={{ gap: 6 }}>
        <AppText variant="sectionTitle">Invite a mosque</AppText>
        <AppText variant="body" style={{ color: tokens.color.text.secondary }}>
          Know the imam, secretary, or a committee member? Share their details and we&apos;ll send them
          a personal introduction — explaining what Adhan Connect offers and exactly how to get started.
        </AppText>
      </View>

      <AppCard style={{ gap: 6, padding: 14 }}>
        <AppText variant="caption" style={{ color: tokens.color.text.muted, fontWeight: '600', marginBottom: 4 }}>
          WHAT THEY'LL RECEIVE
        </AppText>
        {[
          'A friendly introduction to Adhan Connect from our team',
          'An overview of prayer times, live adhan and congregation tools',
          'Clear next steps and a direct contact to guide them through joining',
        ].map((item) => (
          <AppText key={item} variant="caption" style={{ color: tokens.color.text.secondary }}>
            {'✓  '}{item}
          </AppText>
        ))}
      </AppCard>

      <AppCard style={{ gap: 14 }}>
        <Field
          label="Mosque name *"
          value={mosqueName}
          onChangeText={setMosqueName}
          placeholder="e.g. East London Mosque"
        />
        <Field
          label="Contact person's name"
          value={contactName}
          onChangeText={setContactName}
          placeholder="e.g. Imam Abdullah, Brother Yusuf"
        />
        <Field
          label="Contact email"
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="e.g. info@mosque.org"
          keyboardType="email-address"
        />
        <Field
          label="Contact phone"
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="Optional"
          keyboardType="phone-pad"
        />
        <Field
          label="Mosque website"
          value={contactWebsite}
          onChangeText={setContactWebsite}
          placeholder="Optional"
        />
        <Field
          label="A personal note for our outreach"
          value={note}
          onChangeText={setNote}
          placeholder="Optional — e.g. how you know them, or why you think they'd benefit"
        />

        {error ? (
          <AppText variant="caption" style={{ color: tokens.color.status.danger }}>
            {error}
          </AppText>
        ) : null}

        <AppButton title={submitting ? 'Sending…' : 'Send Invite'} onPress={handleSubmit} disabled={!canSubmit} />
      </AppCard>
    </ScreenContainer>
  );
}
