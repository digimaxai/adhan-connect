import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AccountConsentFields,
  EMPTY_ACCOUNT_CONSENT,
  hasAllAccountConsents,
  type AccountConsentState,
} from '../components/auth/AccountConsentFields';
import { buildCurrentAccountConsentMetadata } from '../lib/accountConsent';
import { useAuth } from '../lib/auth';
import { setGuestBrowsingEnabled } from '../lib/guestAccess';
import { requireRoleEntrySelection } from '../lib/roleEntrySession';
import { supabase } from '../lib/supabase';

export default function CompleteAccountScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [consent, setConsent] = useState<AccountConsentState>({
    ...EMPTY_ACCOUNT_CONSENT,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateConsent = (key: keyof AccountConsentState, next: boolean) => {
    setConsent((current) => ({ ...current, [key]: next }));
  };

  const continueToAccount = async () => {
    if (!session?.user.id || !hasAllAccountConsents(consent)) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: buildCurrentAccountConsentMetadata('account_completion'),
      });
      if (updateError || data.user?.id !== session.user.id) {
        throw new Error('ACCOUNT_COMPLETION_FAILED');
      }
      await requireRoleEntrySelection(session.user.id);
      router.replace('/auth-complete' as any);
    } catch {
      setError(
        'We could not save these account choices. No personalised account features were opened; please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const useGuestMode = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      await setGuestBrowsingEnabled(true);
      router.replace('/listener-home' as any);
    } catch {
      setError('We could not close the signed-in session. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.title}>Finish setting up your account</Text>
        <Text style={styles.intro}>
          This one-time step is required before account-based mosque, attendance
          or staff features can open. It also applies to older and invited
          accounts whose current policy receipt is missing.
        </Text>

        <AccountConsentFields
          value={consent}
          onChange={updateConsent}
          disabled={busy}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy || !hasAllAccountConsents(consent)}
          onPress={continueToAccount}
          style={({ pressed }) => [
            styles.primaryButton,
            (busy || !hasAllAccountConsents(consent)) && styles.disabled,
            pressed && !busy && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Continue to my account</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => router.push('/account' as any)}
          style={({ pressed }) => [
            styles.accountButton,
            busy && styles.disabled,
            pressed && !busy && styles.pressed,
          ]}
        >
          <Text style={styles.accountButtonText}>Account &amp; data options</Text>
        </Pressable>
        <Text style={styles.accountHelper}>
          Download your data, review deletion, or manage sign-in without
          consenting to personalised features.
        </Text>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={useGuestMode}
          style={styles.guestButton}
        >
          <Text style={styles.guestButtonText}>Use guest mode instead</Text>
        </Pressable>
        <Text style={styles.guestHelper}>
          Guest mode does not save follows, attendance intentions, account
          preferences or staff access.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flexGrow: 1, padding: 16, paddingTop: 64, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  title: { color: '#0F172A', fontSize: 23, fontWeight: '800' },
  intro: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
    marginTop: 8,
  },
  error: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    color: '#B91C1C',
    lineHeight: 19,
    marginTop: 14,
    padding: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0284C7',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  accountButton: {
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  accountButtonText: { color: '#0369A1', fontWeight: '800' },
  accountHelper: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    textAlign: 'center',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.82 },
  guestButton: { alignSelf: 'center', marginTop: 14, padding: 8 },
  guestButtonText: { color: '#0369A1', fontWeight: '800' },
  guestHelper: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
