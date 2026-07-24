import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AccountConsentFields,
  EMPTY_ACCOUNT_CONSENT,
  hasAllAccountConsents,
  type AccountConsentState,
} from '../../components/auth/AccountConsentFields';
import { getAuthRedirectUrl, SIGN_UP_POLICY_VERSIONS, useAuth } from '../../lib/auth';
import {
  clearPendingAuthEmail,
  getPendingAuthEmail,
  setPendingAuthEmail,
} from '../../lib/authFlowState';
import { setGuestBrowsingEnabled } from '../../lib/guestAccess';
import { supabase } from '../../lib/supabase';

const RESEND_COOLDOWN_SECONDS = 60;

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState(() => getPendingAuthEmail() ?? '');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState<AccountConsentState>({
    ...EMPTY_ACCOUNT_CONSENT,
  });
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  const normalizedEmail = email.trim().toLowerCase();

  useEffect(() => {
    if (!verificationEmail || resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown, verificationEmail]);

  const updateConsent = (key: keyof AccountConsentState, next: boolean) => {
    setConsent((current) => ({ ...current, [key]: next }));
  };

  const validate = () => {
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return false;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return false;
    }
    if (!hasAllAccountConsents(consent)) {
      setError(
        'Provide the separate explicit consent to create an account, or continue browsing as a guest.'
      );
      return false;
    }
    return true;
  };

  const submit = async () => {
    setError(null);
    if (!validate()) return;

    setBusy(true);
    const result = await signUp(
      normalizedEmail,
      password,
      undefined,
      {
        terms: {
          accepted: true,
          version: SIGN_UP_POLICY_VERSIONS.terms,
        },
        privacy: {
          acknowledged: true,
          version: SIGN_UP_POLICY_VERSIONS.privacy,
        },
        specialCategory: {
          granted: true,
          version: SIGN_UP_POLICY_VERSIONS.specialCategory,
        },
        age: {
          confirmedOver16: true,
          version: SIGN_UP_POLICY_VERSIONS.ageGate,
        },
      }
    );
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsVerification) {
      setVerificationEmail(normalizedEmail);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      return;
    }
    clearPendingAuthEmail();
    router.replace('/auth-complete' as any);
  };

  const continueAsGuest = async () => {
    setBusy(true);
    clearPendingAuthEmail();
    await setGuestBrowsingEnabled(true);
    setBusy(false);
    router.replace('/listener-home' as any);
  };

  const resendConfirmation = async () => {
    if (!verificationEmail || resending || resendCooldown > 0) return;

    setResending(true);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setResendMessage(null);
    try {
      await supabase.auth.resend({
        type: 'signup',
        email: verificationEmail,
        options: { emailRedirectTo: getAuthRedirectUrl() },
      });
    } catch {
      // Keep this response neutral so the screen does not reveal auth state.
    } finally {
      setResending(false);
      setResendMessage(
        'If this account is waiting for verification, a new confirmation link will arrive shortly.'
      );
    }
  };

  const useDifferentEmail = () => {
    clearPendingAuthEmail();
    setVerificationEmail(null);
    setEmail('');
    setPassword('');
    setError(null);
    setResendMessage(null);
    setResendCooldown(0);
  };

  if (verificationEmail) {
    return (
      <ScrollView contentContainerStyle={styles.verificationScreen}>
        <View style={styles.card}>
          <View style={styles.mailIcon}>
            <Text style={styles.mailIconText}>✉</Text>
          </View>
          <Text style={[styles.title, { textAlign: 'center' }]}>Check your email</Text>
          <Text style={styles.verificationText}>
            {`We sent a confirmation link to ${verificationEmail}. Open it to finish signing in.`}
          </Text>
          <View style={styles.limitedNotice}>
            <Text style={styles.limitedNoticeTitle}>Your account is not signed in yet</Text>
            <Text style={styles.limitedNoticeText}>
              You can browse public mosque information as a guest while you wait.
              Following mosques, attendance plans, account preferences and live
              audio remain unavailable until you verify and sign in.
            </Text>
          </View>
          <Pressable
            disabled={busy}
            onPress={continueAsGuest}
            style={({ pressed }) => [
              styles.primaryButton,
              busy && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Continue as guest</Text>
            )}
          </Pressable>
          <Pressable
            disabled={busy || resending || resendCooldown > 0}
            onPress={resendConfirmation}
            style={({ pressed }) => [
              styles.secondaryButton,
              (busy || resending || resendCooldown > 0) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {resending ? (
              <ActivityIndicator color="#0369A1" />
            ) : (
              <Text style={styles.secondaryButtonText}>
                {resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : 'Resend confirmation email'}
              </Text>
            )}
          </Pressable>
          {resendMessage ? (
            <Text accessibilityLiveRegion="polite" style={styles.resendMessage}>
              {resendMessage}
            </Text>
          ) : null}
          <Pressable
            disabled={busy || resending}
            onPress={useDifferentEmail}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>Use a different email</Text>
          </Pressable>
          <Pressable
            disabled={busy || resending}
            onPress={() => {
              setPendingAuthEmail(verificationEmail);
              router.replace('/sign-in' as any);
            }}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>Back to sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtle}>
            Create one account for listener, muezzin and mosque-admin access.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            returnKeyType="next"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            returnKeyType="done"
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />

          <Text style={styles.sectionTitle}>Required account choices</Text>
          <Text style={styles.sectionHelper}>
            One separate consent is required for personalised religious features.
            It does not include marketing. You can continue browsing without an
            account.
          </Text>

          <AccountConsentFields
            value={consent}
            onChange={updateConsent}
            disabled={busy}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={busy || !hasAllAccountConsents(consent)}
            onPress={submit}
            style={({ pressed }) => [
              styles.primaryButton,
              (busy || !hasAllAccountConsents(consent)) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Create account</Text>
            )}
          </Pressable>

          <Pressable
            disabled={busy}
            onPress={() => {
              setPendingAuthEmail(normalizedEmail);
              router.replace('/sign-in' as any);
            }}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>Already have an account? Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { flexGrow: 1, padding: 16, paddingTop: 40, paddingBottom: 48 },
  verificationScreen: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 80,
    backgroundColor: '#F8FAFC',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: { color: '#0F172A', fontSize: 24, fontWeight: '800' },
  subtle: { color: '#64748B', marginTop: 5, marginBottom: 18, lineHeight: 20 },
  label: { color: '#334155', fontWeight: '700', marginTop: 12, marginBottom: 7 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 16,
  },
  sectionTitle: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 16,
    marginTop: 22,
  },
  sectionHelper: { color: '#64748B', fontSize: 12, lineHeight: 17, marginVertical: 7 },
  primaryButton: {
    minHeight: 48,
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonText: { color: '#0369A1', fontWeight: '800', fontSize: 14 },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.82 },
  error: {
    color: '#B91C1C',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
    lineHeight: 19,
  },
  textButton: { alignSelf: 'center', padding: 10, marginTop: 8 },
  textButtonLabel: { color: '#0284C7', fontWeight: '700', textAlign: 'center' },
  mailIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  mailIconText: { color: '#0369A1', fontSize: 25 },
  verificationText: {
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 10,
  },
  limitedNotice: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 18,
  },
  limitedNoticeTitle: { color: '#92400E', fontWeight: '800' },
  limitedNoticeText: { color: '#78350F', lineHeight: 19, marginTop: 4, fontSize: 13 },
  resendMessage: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 10,
  },
});
