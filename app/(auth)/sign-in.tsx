import * as AppleAuthentication from 'expo-apple-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../lib/auth';
import {
  clearPendingAuthEmail,
  getPendingAuthEmail,
  setPendingAuthEmail,
} from '../../lib/authFlowState';
import { setGuestBrowsingEnabled } from '../../lib/guestAccess';
import { openAccountPolicy } from '../../lib/policies';
import {
  signInWithApple,
  signInWithGoogle,
  type SocialProvider,
} from '../../lib/socialAuth';

type Stage = 'email' | 'choice' | 'password';

const APPLE_AUTH_ENABLED =
  process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === 'true';
const GOOGLE_AUTH_ENABLED =
  process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true' &&
  (Platform.OS !== 'ios' || APPLE_AUTH_ENABLED);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function SignInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    reason?: string | string[];
  }>();
  const { signIn } = useAuth();

  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState(() => getPendingAuthEmail() ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyProvider, setBusyProvider] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const reason = firstParam(params.reason);
  const showApple = APPLE_AUTH_ENABLED && appleAvailable;
  const hasSocialProvider = GOOGLE_AUTH_ENABLED || showApple;

  useEffect(() => {
    let active = true;
    if (!APPLE_AUTH_ENABLED || Platform.OS !== 'ios') {
      setAppleAvailable(false);
      return () => {
        active = false;
      };
    }
    void AppleAuthentication.isAvailableAsync().then((available) => {
      if (active) setAppleAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  const continueWithEmail = () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setStage('choice');
  };

  const submitPassword = async () => {
    setError(null);
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    const result = await signIn(normalizedEmail, password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    clearPendingAuthEmail();
    router.replace('/auth-complete' as any);
  };

  const beginSocial = async (provider: SocialProvider) => {
    setError(null);
    clearPendingAuthEmail();
    setBusyProvider(provider);
    const result =
      provider === 'apple'
        ? await signInWithApple()
        : await signInWithGoogle();

    if (result.status === 'complete') {
      router.replace('/auth-complete' as any);
      return;
    }
    if (result.status === 'redirecting') return;

    setBusyProvider(null);
    if (result.status === 'error') setError(result.error);
  };

  const continueAsGuest = async () => {
    setBusy(true);
    clearPendingAuthEmail();
    await setGuestBrowsingEnabled(true);
    setBusy(false);
    router.replace('/listener-home' as any);
  };

  const changeEmail = () => {
    clearPendingAuthEmail();
    setPassword('');
    setError(null);
    setStage('email');
  };

  const openPolicy = async (kind: 'terms' | 'privacy') => {
    try {
      await openAccountPolicy(kind);
    } catch {
      Alert.alert('Could not open page', 'Please try again from maksums.com.');
    }
  };

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
          <>
              <Text style={styles.title}>
                {stage === 'email' ? 'Welcome to Adhan Connect' : 'Continue with email'}
              </Text>
              <Text style={styles.subtle}>
                {stage === 'email'
                  ? 'Sign in, create an account, or browse public mosque information.'
                  : normalizedEmail}
              </Text>

              {reason === 'required' && stage === 'email' ? (
                <View style={styles.notice}>
                  <Text style={styles.noticeText}>
                    Sign in to use that feature. Guest browsing remains available.
                  </Text>
                </View>
              ) : null}

              {stage === 'email' ? (
                <>
                  {showApple ? (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={
                        AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                      }
                      buttonStyle={
                        AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                      }
                      cornerRadius={12}
                      pointerEvents={busyProvider ? 'none' : 'auto'}
                      style={[
                        styles.appleButton,
                        busyProvider && styles.buttonDisabled,
                      ]}
                      onPress={() => beginSocial('apple')}
                    />
                  ) : null}

                  {GOOGLE_AUTH_ENABLED ? (
                    <Pressable
                      disabled={Boolean(busyProvider)}
                      onPress={() => beginSocial('google')}
                      style={({ pressed }) => [
                        styles.providerButton,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      {busyProvider === 'google' ? (
                        <ActivityIndicator color="#334155" />
                      ) : (
                        <Text style={styles.providerButtonText}>Continue with Google</Text>
                      )}
                    </Pressable>
                  ) : null}

                  {hasSocialProvider ? (
                    <>
                      <Text style={styles.providerNotice}>
                        Social sign-in creates or opens an account. New accounts
                        and accounts missing a current receipt complete a
                        one-time account step before personalised features.
                      </Text>
                      <View style={styles.policyLinksRow}>
                        <Pressable onPress={() => openPolicy('terms')}>
                          <Text style={styles.policyLink}>Terms of Service</Text>
                        </Pressable>
                        <Text style={styles.policySeparator}>·</Text>
                        <Pressable onPress={() => openPolicy('privacy')}>
                          <Text style={styles.policyLink}>Privacy Notice</Text>
                        </Pressable>
                      </View>
                      <View style={styles.dividerRow}>
                        <View style={styles.divider} />
                        <Text style={styles.dividerText}>or use email</Text>
                        <View style={styles.divider} />
                      </View>
                    </>
                  ) : null}

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
                    onSubmitEditing={continueWithEmail}
                  />

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <Pressable
                    onPress={continueWithEmail}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  </Pressable>

                  <Pressable
                    disabled={busy}
                    onPress={continueAsGuest}
                    style={styles.guestButton}
                  >
                    <Text style={styles.guestButtonText}>
                      {busy ? 'Opening guest mode…' : 'Browse as guest'}
                    </Text>
                    <Text style={styles.guestHelper}>
                      Browsing only. Following, attendance plans, account preferences
                      and live audio require sign-in.
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {stage === 'choice' ? (
                <>
                  <Text style={styles.choicePrompt}>What would you like to do?</Text>
                  <Pressable
                    onPress={() => {
                      setStage('password');
                      setError(null);
                    }}
                    style={({ pressed }) => [
                      styles.choiceButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.choiceTitle}>Sign in</Text>
                      <Text style={styles.choiceDetail}>
                        Use the password for an existing account
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setPendingAuthEmail(normalizedEmail);
                      router.push('/sign-up' as any);
                    }}
                    style={({ pressed }) => [
                      styles.choiceButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.choiceTitle}>Create account</Text>
                      <Text style={styles.choiceDetail}>
                        Set up a new account with this email
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>

                  <Pressable onPress={changeEmail} style={styles.textButton}>
                    <Text style={styles.textButtonLabel}>Use a different email</Text>
                  </Pressable>
                </>
              ) : null}

              {stage === 'password' ? (
                <>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="current-password"
                    placeholder="Your password"
                    secureTextEntry
                    returnKeyType="done"
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={submitPassword}
                  />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <Pressable
                    disabled={busy}
                    onPress={submitPassword}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      busy && styles.buttonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Sign in</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setPendingAuthEmail(normalizedEmail);
                      router.push('/reset' as any);
                    }}
                    style={styles.textButton}
                  >
                    <Text style={styles.textButtonLabel}>Forgot password?</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => {
                      setStage('choice');
                      setPassword('');
                      setError(null);
                    }}
                    style={styles.textButton}
                  >
                    <Text style={styles.secondaryTextButtonLabel}>Back</Text>
                  </Pressable>
                </>
              ) : null}
          </>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  // Keep the stable top-anchored layout used to avoid keyboard relayout flicker
  // in TestFlight. Do not vertically center this card.
  scrollContent: { flexGrow: 1, padding: 16, paddingTop: 80, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: { color: '#0F172A', fontSize: 24, fontWeight: '800' },
  subtle: { color: '#64748B', marginTop: 5, marginBottom: 18, lineHeight: 20 },
  label: { color: '#334155', fontWeight: '700', marginTop: 4, marginBottom: 7 },
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
  primaryButton: {
    minHeight: 48,
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.82 },
  providerButton: {
    height: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 10,
  },
  providerButtonText: { color: '#0F172A', fontSize: 15, fontWeight: '700' },
  appleButton: { width: '100%', height: 48, marginTop: 2 },
  providerNotice: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  policyLinksRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 7,
  },
  policyLink: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  policySeparator: { color: '#94A3B8' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 20,
  },
  divider: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  error: {
    color: '#B91C1C',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    lineHeight: 19,
  },
  notice: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
    marginBottom: 16,
  },
  noticeText: { color: '#1E3A8A', lineHeight: 19 },
  choicePrompt: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    backgroundColor: '#F8FAFC',
  },
  choiceTitle: { color: '#0F172A', fontWeight: '800', fontSize: 16 },
  choiceDetail: { color: '#64748B', fontSize: 13, lineHeight: 18, marginTop: 2 },
  chevron: { color: '#0284C7', fontSize: 28, fontWeight: '400' },
  textButton: { alignSelf: 'center', padding: 10, marginTop: 8 },
  textButtonLabel: { color: '#0284C7', fontWeight: '700' },
  secondaryTextButtonLabel: { color: '#64748B', fontWeight: '700' },
  guestButton: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
    paddingTop: 17,
    marginTop: 20,
  },
  guestButtonText: { color: '#0369A1', fontWeight: '800', fontSize: 15 },
  guestHelper: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 5,
    maxWidth: 330,
  },
});
