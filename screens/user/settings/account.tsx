import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ACCOUNT_LEGAL_URLS,
  AccountApiError,
  clearDeletedAccountLocalData,
  deleteCurrentAccount,
  fetchAccountDeletionImpact,
  fetchAccountExport,
  saveOrShareAccountExport,
  withdrawCurrentAccountConsent,
  type AccountDeletionImpact,
} from '../../../lib/api/account';
import { hasCurrentAccountConsent } from '../../../lib/accountConsent';
import { useAuth } from '../../../lib/auth';
import { setGuestBrowsingEnabled } from '../../../lib/guestAccess';
import { linkSocialIdentity, type SocialProvider } from '../../../lib/socialAuth';
import { supabase } from '../../../lib/supabase';

const SOCIAL_LINKING_ENABLED =
  process.env.EXPO_PUBLIC_SOCIAL_LINKING_ENABLED === 'true';
const APPLE_AUTH_ENABLED =
  process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === 'true';
const GOOGLE_AUTH_ENABLED =
  process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true' &&
  (Platform.OS !== 'ios' || APPLE_AUTH_ENABLED);

function providerLinkingEnabled(provider: SocialProvider) {
  return (
    SOCIAL_LINKING_ENABLED &&
    (provider === 'google' ? GOOGLE_AUTH_ENABLED : APPLE_AUTH_ENABLED)
  );
}

function ActionButton({
  busy,
  danger,
  disabled,
  label,
  onPress,
}: {
  busy?: boolean;
  danger?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        danger ? styles.dangerButton : styles.primaryButton,
        (disabled || busy) && styles.disabled,
        pressed && !disabled && !busy && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={danger ? '#B91C1C' : '#FFFFFF'} />
      ) : (
        <Text
          style={danger ? styles.dangerButtonText : styles.primaryButtonText}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function Section({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function providerLabel(provider: string) {
  if (provider === 'email') return 'Email and password';
  if (provider === 'google') return 'Google';
  if (provider === 'apple') return 'Apple';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function errorMessage(error: unknown) {
  if (error instanceof AccountApiError) {
    return error.requestId
      ? `${error.message} Request ID: ${error.requestId}`
      : error.message;
  }
  return error instanceof Error
    ? error.message
    : 'The request could not be completed.';
}

export default function AccountScreen() {
  const { authUser, session, signOut, user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportNeedsReauthentication, setExportNeedsReauthentication] =
    useState(false);
  const [checkingImpact, setCheckingImpact] = useState(false);
  const [impact, setImpact] = useState<AccountDeletionImpact | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [reauthenticating, setReauthenticating] = useState(false);
  const [linkingProvider, setLinkingProvider] =
    useState<SocialProvider | null>(null);
  const [withdrawingConsent, setWithdrawingConsent] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const providers = useMemo(
    () =>
      Array.from(
        new Set(
          (authUser?.identities ?? [])
            .map((identity) => identity.provider?.toLowerCase())
            .filter((value): value is string => !!value)
        )
      ),
    [authUser?.identities]
  );
  const canPasswordReauthenticate =
    !!authUser?.email && providers.includes('email');
  const hasPersonalisedFeatureConsent =
    hasCurrentAccountConsent(authUser);

  const loadImpact = async (activeSession = session) => {
    setCheckingImpact(true);
    try {
      const nextImpact = await fetchAccountDeletionImpact(activeSession);
      setImpact(nextImpact);
      setConfirmation('');
    } catch (error) {
      Alert.alert('Could not review deletion', errorMessage(error));
    } finally {
      setCheckingImpact(false);
    }
  };

  const handleExport = async (activeSession = session) => {
    setExporting(true);
    try {
      const payload = await fetchAccountExport(activeSession);
      const result = await saveOrShareAccountExport(payload);
      setExportNeedsReauthentication(false);
      const manifest = payload.manifest as
        | { omissions?: unknown[] }
        | undefined;
      const omittedSections = Array.isArray(manifest?.omissions)
        ? manifest.omissions.length
        : 0;
      if (Platform.OS === 'web' || omittedSections > 0) {
        Alert.alert(
          Platform.OS === 'web' ? 'Download started' : 'Export prepared',
          omittedSections > 0
            ? `${result.filename} was prepared with ${omittedSections} unavailable or truncated section${omittedSections === 1 ? '' : 's'}. The file lists them; use the privacy request channel for a complete response.`
            : `${result.filename} was prepared.`
        );
      }
    } catch (error) {
      if (
        error instanceof AccountApiError &&
        error.code === 'RECENT_AUTH_REQUIRED'
      ) {
        setExportNeedsReauthentication(true);
        Alert.alert(
          'Sign in again',
          'For your privacy, verify a connected sign-in method before downloading account data.'
        );
        return;
      }
      Alert.alert('Could not export data', errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const handleExportReauthenticate = async () => {
    if (!authUser?.email || !password) {
      Alert.alert('Password required', 'Enter your current password first.');
      return;
    }
    setReauthenticating(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authUser.email,
        password,
      });
      if (error || data.user?.id !== authUser.id || !data.session) {
        throw new Error('The password could not be verified for this account.');
      }
      setPassword('');
      await handleExport(data.session);
    } catch (error) {
      Alert.alert('Sign-in check failed', errorMessage(error));
    } finally {
      setReauthenticating(false);
    }
  };

  const handleReauthenticate = async () => {
    if (!authUser?.email || !password) {
      Alert.alert('Password required', 'Enter your current password first.');
      return;
    }
    setReauthenticating(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authUser.email,
        password,
      });
      if (error || data.user?.id !== authUser.id) {
        throw new Error('The password could not be verified for this account.');
      }
      setPassword('');
      await loadImpact(data.session);
    } catch (error) {
      Alert.alert('Sign-in check failed', errorMessage(error));
    } finally {
      setReauthenticating(false);
    }
  };

  const handleDelete = () => {
    if (!impact || confirmation !== 'DELETE' || !authUser?.id) return;
    Alert.alert(
      'Permanently delete account?',
      'This removes your account and all attached listener and staff access. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteCurrentAccount(
                {
                  confirmation: 'DELETE',
                  impactFingerprint: impact.impactFingerprint,
                },
                session
              );
            } catch (error) {
              if (
                error instanceof AccountApiError &&
                error.impact
              ) {
                setImpact(error.impact);
                setConfirmation('');
              }
              Alert.alert('Account not deleted', errorMessage(error));
              setDeleting(false);
              return;
            }

            try {
              await clearDeletedAccountLocalData(authUser.id);
              router.replace('/sign-in' as any);
            } catch {
              router.replace('/sign-in' as any);
              Alert.alert(
                'Account deleted',
                'The server account was deleted, but this device could not clear every local preference safely. Close and reopen the app before using it again.'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleLinkProvider = async (provider: SocialProvider) => {
    setLinkingProvider(provider);
    try {
      const result = await linkSocialIdentity(provider);
      if (result.status === 'complete') {
        const { data } = await supabase.auth.getUser();
        if (data.user?.id !== authUser?.id) {
          throw new Error(
            'The provider did not return the original account. No roles were merged.'
          );
        }
        Alert.alert(
          'Provider connected',
          `${providerLabel(provider)} now signs in to this same account.`
        );
      } else if (result.status === 'error') {
        throw new Error(result.error);
      }
    } catch (error) {
      Alert.alert('Could not connect provider', errorMessage(error));
    } finally {
      setLinkingProvider(null);
    }
  };

  const handleWithdrawConsent = () => {
    Alert.alert(
      'Withdraw personalised-feature consent?',
      'Your account will remain, but account-based mosque follows, attendance intentions and staff features will be unavailable. You will be signed out and returned to guest mode. You can consent again later by signing in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw consent',
          style: 'destructive',
          onPress: async () => {
            setWithdrawingConsent(true);
            try {
              await withdrawCurrentAccountConsent(session);
            } catch (error) {
              Alert.alert('Consent not withdrawn', errorMessage(error));
              setWithdrawingConsent(false);
              return;
            }

            try {
              await signOut();
              await setGuestBrowsingEnabled(true);
              router.replace('/listener-home' as any);
            } catch {
              // The server-side withdrawal has already succeeded and remains
              // authoritative even if this device cannot finish local cleanup.
              router.replace('/sign-in' as any);
              Alert.alert(
                'Consent withdrawn',
                'Personalised account features are now restricted, but this device could not finish clearing local sign-in state. Close and reopen the app before signing in again.'
              );
            } finally {
              setWithdrawingConsent(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      await setGuestBrowsingEnabled(true);
      router.replace('/listener-home' as any);
    } catch {
      router.replace('/sign-in' as any);
      Alert.alert(
        'Signed out',
        'The account was closed on this device, but local cleanup could not be fully verified. Close and reopen the app before signing in again.'
      );
    } finally {
      setSigningOut(false);
    }
  };

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open page', 'Please try again from maksums.com.');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>Account & data</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Section title="Your account">
          <Text style={styles.primaryText}>
            {user?.display_name || authUser?.email?.split('@')[0] || 'Adhan Connect user'}
          </Text>
          <Text style={styles.secondaryText}>{authUser?.email ?? 'No email address'}</Text>
          <Text style={styles.idText}>
            Account ID: {authUser?.id ?? 'Unavailable'}
          </Text>
        </Section>

        <Section
          title="Sign-in methods"
          description="Connected providers must retain this exact account ID. Matching email addresses alone do not merge staff roles or account data."
        >
          {providers.length ? (
            providers.map((provider) => (
              <View key={provider} style={styles.providerRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#059669"
                />
                <Text style={styles.providerText}>{providerLabel(provider)}</Text>
                <Text style={styles.connectedText}>Connected</Text>
              </View>
            ))
          ) : (
            <Text style={styles.secondaryText}>No provider details are available.</Text>
          )}

          {(['google', 'apple'] as SocialProvider[])
            .filter(
              (provider) =>
                !providers.includes(provider) &&
                (provider !== 'apple' || Platform.OS === 'ios') &&
                providerLinkingEnabled(provider)
            )
            .map((provider) => (
              <Pressable
                key={provider}
                disabled={linkingProvider !== null}
                onPress={() => handleLinkProvider(provider)}
                style={styles.linkProviderButton}
              >
                <Text style={styles.linkProviderText}>
                  {`Connect ${providerLabel(provider)}`}
                </Text>
              </Pressable>
            ))}
        </Section>

        {hasPersonalisedFeatureConsent ? (
          <Section
            title="Personalised-feature consent"
            description="Your separate consent covers account links that may reveal religious belief, such as mosque follows, attendance intentions and mosque or staff roles. It is not marketing consent."
          >
            <ActionButton
              busy={withdrawingConsent}
              danger
              label="Withdraw this consent"
              onPress={handleWithdrawConsent}
            />
            <Text style={styles.footnote}>
              Withdrawal restricts these account features and does not affect
              processing that was lawful before withdrawal. You can still browse
              public information as a guest.
            </Text>
          </Section>
        ) : (
          <Section
            title="Personalised features are off"
            description="You can still download your data, review deletion, manage sign-in, or browse public information without granting special-category consent."
          >
            <Text style={styles.secondaryText}>
              Return to account setup only if you want to enable followed
              mosques, attendance intentions, or staff workspaces.
            </Text>
          </Section>
        )}

        <Section
          title="Download your data"
          description="Creates a versioned JSON file of account data this app can safely identify as yours. Other people’s identifiers and service secrets are redacted."
        >
          <ActionButton
            busy={exporting}
            label="Download or share my data"
            onPress={() => {
              void handleExport();
            }}
          />
          {exportNeedsReauthentication ? (
            <View style={styles.reauthBox}>
              <Text style={styles.primaryText}>Verify before downloading</Text>
              {canPasswordReauthenticate ? (
                <>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="current-password"
                    onChangeText={setPassword}
                    placeholder="Current password"
                    secureTextEntry
                    style={styles.input}
                    value={password}
                  />
                  <ActionButton
                    busy={reauthenticating || exporting}
                    label="Verify and download"
                    onPress={handleExportReauthenticate}
                  />
                </>
              ) : (
                <Text style={styles.secondaryText}>
                  Sign out and sign in again with a connected provider, then
                  return here to download your data.
                </Text>
              )}
            </View>
          ) : null}
          <Text style={styles.footnote}>
            Processor logs, backups, and support records may require a separate
            privacy request.
          </Text>
        </Section>

        <Section title="Privacy & legal">
          <Pressable
            onPress={() => openUrl(ACCOUNT_LEGAL_URLS.privacy)}
            style={styles.legalRow}
          >
            <Text style={styles.legalText}>Privacy notice</Text>
            <Ionicons name="open-outline" size={18} color="#64748B" />
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            onPress={() => openUrl(ACCOUNT_LEGAL_URLS.terms)}
            style={styles.legalRow}
          >
            <Text style={styles.legalText}>Terms of use</Text>
            <Ionicons name="open-outline" size={18} color="#64748B" />
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            onPress={() => openUrl(ACCOUNT_LEGAL_URLS.deleteAccount)}
            style={styles.legalRow}
          >
            <Text style={styles.legalText}>Account deletion information</Text>
            <Ionicons name="open-outline" size={18} color="#64748B" />
          </Pressable>
        </Section>

        <Section
          title="Session"
          description="Sign out without changing your account, consent choices, or staff roles."
        >
          <ActionButton
            busy={signingOut}
            danger
            label="Sign out"
            onPress={() => {
              void handleSignOut();
            }}
          />
        </Section>

        <Section
          title="Delete account"
          description="Deletion is impact-aware so an account cannot silently remove a mosque’s last administrator, active broadcast, rota duty, or unresolved cover request."
        >
          <ActionButton
            busy={checkingImpact}
            danger
            label={impact ? 'Refresh deletion review' : 'Review deletion impact'}
            onPress={loadImpact}
          />

          {impact ? (
            <View style={styles.impact}>
              <Text style={styles.footnote}>
                {`This deletion review expires at ${new Date(
                  impact.confirmationExpiresAt
                ).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}. Refresh it if the account changes or the time passes.`}
              </Text>
              {impact.releaseBlockers.map((message) => (
                <View key={message} style={styles.infoBox}>
                  <Text style={styles.infoText}>{message}</Text>
                </View>
              ))}

              {impact.blockers.map((issue) => (
                <View key={issue.code} style={styles.blockerBox}>
                  <Text style={styles.blockerTitle}>
                    {issue.count ? `${issue.count} × ` : ''}
                    {issue.code.replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.blockerText}>{issue.message}</Text>
                </View>
              ))}

              {impact.warnings.map((issue) => (
                <View key={issue.code} style={styles.warningBox}>
                  <Text style={styles.warningTitle}>
                    {issue.count ? `${issue.count} × ` : ''}
                    {issue.code.replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.warningText}>{issue.message}</Text>
                </View>
              ))}

              {impact.requiresRecentAuthentication ? (
                <View style={styles.reauthBox}>
                  <Text style={styles.primaryText}>Sign in again to continue</Text>
                  {canPasswordReauthenticate ? (
                    <>
                      <TextInput
                        autoCapitalize="none"
                        autoComplete="current-password"
                        onChangeText={setPassword}
                        placeholder="Current password"
                        secureTextEntry
                        style={styles.input}
                        value={password}
                      />
                      <ActionButton
                        busy={reauthenticating}
                        label="Verify password"
                        onPress={handleReauthenticate}
                      />
                    </>
                  ) : (
                    <Text style={styles.secondaryText}>
                      Sign out and sign in again with a connected provider, then
                      return to this page. Refreshing a session is not accepted
                      as reauthentication.
                    </Text>
                  )}
                </View>
              ) : null}

              {impact.canDelete ? (
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmText}>
                    Type DELETE to confirm that every role and account-linked
                    feature will be removed.
                  </Text>
                  <TextInput
                    autoCapitalize="characters"
                    onChangeText={setConfirmation}
                    placeholder="DELETE"
                    style={styles.input}
                    value={confirmation}
                  />
                  <ActionButton
                    busy={deleting}
                    danger
                    disabled={confirmation !== 'DELETE'}
                    label="Permanently delete my account"
                    onPress={handleDelete}
                  />
                </View>
              ) : (
                <Text style={styles.footnote}>
                  Nothing will be deleted while any safety or release check is
                  incomplete. You can also use the external deletion page above.
                </Text>
              )}
            </View>
          ) : null}
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 18,
    paddingBottom: 12,
  },
  headerButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  content: { padding: 18, paddingBottom: 56 },
  section: { marginBottom: 22 },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  description: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  primaryText: { color: '#0F172A', fontSize: 15, fontWeight: '700' },
  secondaryText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  idText: { color: '#94A3B8', fontSize: 11, marginTop: 10 },
  providerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
  },
  providerText: {
    color: '#0F172A',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 9,
  },
  connectedText: { color: '#059669', fontSize: 12, fontWeight: '700' },
  linkProviderButton: {
    alignItems: 'center',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },
  linkProviderText: { color: '#334155', fontSize: 13, fontWeight: '700' },
  actionButton: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryButton: { backgroundColor: '#0EA5E9' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  dangerButton: {
    backgroundColor: '#FFF7F7',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  dangerButtonText: { color: '#B91C1C', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
  footnote: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 10 },
  legalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  legalText: { color: '#0F172A', fontSize: 14, fontWeight: '700' },
  divider: { backgroundColor: '#E2E8F0', height: StyleSheet.hairlineWidth },
  impact: { marginTop: 16 },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    padding: 11,
  },
  infoText: { color: '#1E40AF', fontSize: 12, lineHeight: 18 },
  blockerBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    padding: 11,
  },
  blockerTitle: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  blockerText: { color: '#B91C1C', fontSize: 12, lineHeight: 18, marginTop: 3 },
  warningBox: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    padding: 11,
  },
  warningTitle: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  warningText: { color: '#92400E', fontSize: 12, lineHeight: 18, marginTop: 3 },
  reauthBox: {
    borderTopColor: '#E2E8F0',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    paddingTop: 14,
  },
  confirmBox: {
    borderTopColor: '#FECACA',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 14,
  },
  confirmText: { color: '#7F1D1D', fontSize: 13, lineHeight: 19 },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    borderWidth: 1,
    color: '#0F172A',
    fontSize: 15,
    marginBottom: 10,
    marginTop: 10,
    minHeight: 46,
    paddingHorizontal: 12,
  },
});
