import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { notifyMosqueRequest } from '../../lib/api/mosqueRequestNotify';
import { AppButton } from '../../components/ui/app-button';
import { AppCard } from '../../components/ui/app-card';
import { AppText } from '../../components/ui/app-text';
import { ScreenContainer } from '../../components/ui/screen-container';
import { tokens } from '../../theme/tokens';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLES = [
  'Imam / Khatib',
  'Committee Secretary',
  'Trustee',
  'Administrator',
  'Mosque Manager',
  'Other',
];

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
  required,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  required?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" style={{ color: tokens.color.text.secondary }}>
        {label}
        {required ? <AppText variant="caption" style={{ color: tokens.color.status.danger }}> *</AppText> : null}
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

function RoleSelector({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (role: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" style={{ color: tokens.color.text.secondary }}>
        Your role at the mosque <AppText variant="caption" style={{ color: tokens.color.status.danger }}>*</AppText>
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ROLES.map((role) => {
          const active = selected === role;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => onSelect(role)}
              key={role}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: tokens.radius.md,
                borderWidth: 1,
                borderColor: active ? tokens.color.text.accent : tokens.color.border.muted,
                backgroundColor: active ? tokens.color.text.accent + '18' : tokens.color.bg.subtle,
              }}
            >
              <AppText
                variant="caption"
                style={{
                  color: active ? tokens.color.text.accent : tokens.color.text.secondary,
                  fontWeight: active ? '600' : '400',
                }}
              >
                {role}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function MosqueAdminRequestScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [yourName, setYourName] = useState('');
  const [yourRole, setYourRole] = useState('');
  const [mosqueName, setMosqueName] = useState(name ?? '');
  const [cityArea, setCityArea] = useState('');
  const [yourEmail, setYourEmail] = useState('');
  const [yourPhone, setYourPhone] = useState('');
  const [message, setMessage] = useState('');
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
            Sign in or create a free account to register your mosque with Adhan Connect.
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
          <AppText variant="sectionTitle">We'll be in touch</AppText>
          <AppText variant="body" style={{ color: tokens.color.text.secondary }}>
            Thank you — your request to list {mosqueName.trim()} has been received. Our team will
            contact you directly, usually within 2 working days.
          </AppText>
          <View style={{ gap: 8, marginTop: 4 }}>
            <AppButton title="Back to Discover" onPress={() => router.replace('/(user)/discover')} />
            <AppButton title="Back to Home" variant="ghost" onPress={() => router.replace('/(user)/listener-home')} />
          </View>
        </AppCard>
      </ScreenContainer>
    );
  }

  const canSubmit =
    yourName.trim().length >= 2 &&
    yourRole.length > 0 &&
    mosqueName.trim().length >= 2 &&
    cityArea.trim().length >= 2 &&
    EMAIL_PATTERN.test(yourEmail.trim()) &&
    !submitting;

  const handleSubmit = async () => {
    if (submitting) return;
    if (yourName.trim().length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (!yourRole) {
      setError('Please select your role at the mosque.');
      return;
    }
    if (mosqueName.trim().length < 2) {
      setError('Please enter the mosque name.');
      return;
    }
    if (cityArea.trim().length < 2) {
      setError('Please enter the city or area.');
      return;
    }
    if (!EMAIL_PATTERN.test(yourEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        id: randomUUID(),
        request_type: 'mosque_admin_self',
        mosque_name: mosqueName.trim(),
        area_description: cityArea.trim(),
        contact_name: yourName.trim(),
        contact_email: yourEmail.trim(),
        contact_phone: yourPhone.trim() || null,
        submitter_role_at_mosque: yourRole,
        note: message.trim() || null,
        submitted_by: userId,
      };
      const { error: insertError } = await supabase.from('mosque_add_requests').insert(payload);
      if (insertError) throw insertError;
      notifyMosqueRequest(payload.id, session?.access_token ?? '');
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer contentStyle={{ gap: 16 }}>
        <AppButton title="Back" variant="ghost" onPress={() => router.back()} />
      <View style={{ gap: 6 }}>
        <AppText variant="sectionTitle">Register your mosque</AppText>
        <AppText variant="body" style={{ color: tokens.color.text.secondary }}>
          You&apos;re in the right place. Tell us about yourself and your mosque and we&apos;ll be in touch
          to get you set up — usually within 2 working days.
        </AppText>
      </View>

      <AppCard style={{ gap: 6, padding: 14 }}>
        <AppText variant="caption" style={{ color: tokens.color.text.muted, fontWeight: '600', marginBottom: 4 }}>
          WHAT YOUR CONGREGATION GETS
        </AppText>
        {[
          'Daily prayer times published to followers',
          'Live adhan broadcasting to the Adhan Connect app',
          'Events, campaigns and announcements',
          'Staff rota and muezzin scheduling tools',
        ].map((item) => (
          <AppText key={item} variant="caption" style={{ color: tokens.color.text.secondary }}>
            {'✓  '}{item}
          </AppText>
        ))}
      </AppCard>

      <AppCard style={{ gap: 14 }}>
        <AppText variant="caption" style={{ color: tokens.color.text.muted, fontWeight: '600' }}>
          ABOUT YOU
        </AppText>
        <Field label="Your full name" value={yourName} onChangeText={setYourName} placeholder="e.g. Mohammed Ali" required />
        <RoleSelector selected={yourRole} onSelect={setYourRole} />
        <Field
          label="Your email"
          value={yourEmail}
          onChangeText={setYourEmail}
          placeholder="you@mosque.org"
          keyboardType="email-address"
          required
        />
        <Field
          label="Your phone number"
          value={yourPhone}
          onChangeText={setYourPhone}
          placeholder="Optional — speeds things up"
          keyboardType="phone-pad"
        />

        <AppText variant="caption" style={{ color: tokens.color.text.muted, fontWeight: '600', marginTop: 4 }}>
          ABOUT YOUR MOSQUE
        </AppText>
        <Field label="Mosque name" value={mosqueName} onChangeText={setMosqueName} placeholder="e.g. East London Mosque" required />
        <Field label="City or area" value={cityArea} onChangeText={setCityArea} placeholder="e.g. Whitechapel, London" required />
        <Field
          label="Anything you'd like us to know"
          value={message}
          onChangeText={setMessage}
          placeholder="Optional — e.g. congregation size, current challenges, special requirements"
        />

        {error ? (
          <AppText variant="caption" style={{ color: tokens.color.status.danger }}>
            {error}
          </AppText>
        ) : null}

        <AppButton title={submitting ? 'Sending…' : 'Request Onboarding'} onPress={handleSubmit} disabled={!canSubmit} />
      </AppCard>
    </ScreenContainer>
  );
}
