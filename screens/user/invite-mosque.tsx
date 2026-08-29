import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
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
        <AppCard style={{ gap: 12 }}>
          <AppText variant="sectionTitle">Thanks!</AppText>
          <AppText variant="body" style={{ color: tokens.color.text.secondary }}>
            We&apos;ve received your invite for &quot;{mosqueName.trim()}&quot;. Our team will review it and follow
            up with them directly.
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
      const { error: insertError } = await supabase.from('mosque_add_requests').insert({
        request_type: 'invite_known_mosque',
        mosque_name: mosqueName.trim(),
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_website: contactWebsite.trim() || null,
        note: note.trim() || null,
        submitted_by: userId,
      });
      if (insertError) throw insertError;
      setSubmitted(true);
    } catch {
      setError('Something went wrong submitting your invite. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer contentStyle={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <AppText variant="sectionTitle">Invite your mosque</AppText>
        <AppText variant="body" style={{ color: tokens.color.text.secondary }}>
          Know the mosque&apos;s management or committee? Pass along their details and we&apos;ll reach out to invite
          them to join Adhan Connect.
        </AppText>
      </View>

      <AppCard style={{ gap: 14 }}>
        <Field label="Mosque name *" value={mosqueName} onChangeText={setMosqueName} placeholder="e.g. East London Mosque" />
        <Field label="Mosque contact name" value={contactName} onChangeText={setContactName} placeholder="e.g. Imam or committee member" />
        <Field label="Mosque contact email" value={contactEmail} onChangeText={setContactEmail} placeholder="contact@mosque.org" keyboardType="email-address" />
        <Field label="Mosque contact phone" value={contactPhone} onChangeText={setContactPhone} placeholder="Optional" keyboardType="phone-pad" />
        <Field label="Mosque website" value={contactWebsite} onChangeText={setContactWebsite} placeholder="Optional" />
        <Field label="Anything else that will help us?" value={note} onChangeText={setNote} placeholder="Optional note" />

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
