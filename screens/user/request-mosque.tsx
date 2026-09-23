import { randomUUID } from 'expo-crypto';
import { BackButton } from '@/components/ui/back-button';
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
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
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
        style={inputStyle}
      />
    </View>
  );
}

export default function RequestMosqueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [mosqueName, setMosqueName] = useState(params.name ?? '');
  const [areaDescription, setAreaDescription] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!userId) {
    return (
      <ScreenContainer contentStyle={{ gap: 16 }}>
        <BackButton fallbackHref="/(user)/discover" />
        <AppCard style={{ gap: 12 }}>
          <AppText variant="sectionTitle">Sign in to continue</AppText>
          <AppText variant="body" style={{ color: tokens.color.text.secondary }}>
            Sign in or create a free account to ask our team to contact a mosque on your behalf.
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
          <AppText variant="sectionTitle">Request received</AppText>
          <AppText variant="body" style={{ color: tokens.color.text.secondary }}>
            We&apos;ve noted your request for {mosqueName.trim()}. Our team will research and reach
            out to them directly on behalf of Adhan Connect.
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
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        id: randomUUID(),
        request_type: 'request_new_mosque',
        mosque_name: mosqueName.trim(),
        area_description: areaDescription.trim() || null,
        note: note.trim() || null,
        submitted_by: userId,
      };
      const { error: insertError } = await supabase.from('mosque_add_requests').insert(payload);
      if (insertError) throw insertError;
      notifyMosqueRequest(payload.id, session?.access_token ?? '');
      setSubmitted(true);
    } catch {
      setError('Something went wrong submitting your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer contentStyle={{ gap: 16 }}>
        <BackButton fallbackHref="/(user)/discover" />
      <View style={{ gap: 6 }}>
        <AppText variant="sectionTitle">Ask us to contact a mosque</AppText>
        <AppText variant="body" style={{ color: tokens.color.text.secondary }}>
          Don&apos;t have their contact details? No problem — tell us the mosque name and location
          and our team will find them and reach out on your behalf.
        </AppText>
      </View>

      <AppCard style={{ gap: 6, padding: 14 }}>
        <AppText variant="caption" style={{ color: tokens.color.text.muted, fontWeight: '600', marginBottom: 4 }}>
          HOW IT WORKS
        </AppText>
        {[
          'You tell us what you know — name, location, and any helpful details',
          'Our team researches the mosque\'s contact information',
          'We reach out with a full introduction and onboarding invitation',
        ].map((item) => (
          <AppText key={item} variant="caption" style={{ color: tokens.color.text.secondary }}>
            {'→  '}{item}
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
          label="City or area *"
          value={areaDescription}
          onChangeText={setAreaDescription}
          placeholder="e.g. Whitechapel, London"
        />
        <Field
          label="Anything else that will help us find and approach them"
          value={note}
          onChangeText={setNote}
          placeholder="Optional — e.g. approximate address, website, or why you think they'd benefit"
        />

        {error ? (
          <AppText variant="caption" style={{ color: tokens.color.status.danger }}>
            {error}
          </AppText>
        ) : null}

        <AppButton title={submitting ? 'Sending…' : 'Send Request'} onPress={handleSubmit} disabled={!canSubmit} />
      </AppCard>
    </ScreenContainer>
  );
}
