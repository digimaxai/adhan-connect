// lib/auth.tsx
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  signOutCurrentDeviceFailClosed,
  subscribeForcedLocalSignOut,
} from './authSessionCleanup';
import { hasCurrentAccountConsent } from './accountConsent';
import { ACCOUNT_POLICY_VERSIONS } from './policies';
import { supabase } from './supabase';
import { clearRoleEntrySelectionRequirement, requireRoleEntrySelection } from './roleEntrySession';
import { clearSessionAccessCache } from './sessionAccess';

const configuredWebRedirectUrl = () => {
  const webUrl = process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL_WEB?.trim();
  if (webUrl) return webUrl;
  const legacyUrl = process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL?.trim();
  return legacyUrl && /^https?:\/\//i.test(legacyUrl) ? legacyUrl : null;
};

const configuredNativeRedirectUrl = () => {
  const nativeUrl = process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL_NATIVE?.trim();
  if (nativeUrl) return nativeUrl;
  const legacyUrl = process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL?.trim();
  return legacyUrl && !/^https?:\/\//i.test(legacyUrl) ? legacyUrl : null;
};

const replaceCallbackPath = (url: string, path: string) =>
  url.replace(/\/callback(?=\/?(?:[?#]|$))/, `/${path}`);

export const getAuthRedirectUrl = () => {
  if (Platform.OS === 'web') {
    const configuredUrl = configuredWebRedirectUrl();
    if (configuredUrl) return configuredUrl;
    return typeof window !== 'undefined'
      ? `${window.location.origin}/callback`
      : 'http://localhost:8081/callback';
  }
  const configuredUrl = configuredNativeRedirectUrl();
  if (configuredUrl) return configuredUrl;
  return Linking.createURL('/callback', { scheme: 'adhanconnect' });
};

export const getPasswordResetRedirectUrl = () => {
  if (Platform.OS === 'web') {
    const configuredUrl = configuredWebRedirectUrl();
    if (configuredUrl) return replaceCallbackPath(configuredUrl, 'new-password');
    if (typeof window !== 'undefined') return `${window.location.origin}/new-password`;
    return 'http://localhost:8081/new-password';
  }
  const configuredUrl = configuredNativeRedirectUrl();
  if (configuredUrl) return replaceCallbackPath(configuredUrl, 'new-password');
  return Linking.createURL('/new-password', { scheme: 'adhanconnect' });
};

const deriveDisplayName = (raw?: string | null, fallbackEmail?: string | null) => {
  const trimmed = raw?.trim();
  if (trimmed) return trimmed;
  const emailLocal = fallbackEmail?.split('@')[0];
  if (emailLocal) return emailLocal;
  return 'User';
};

const resolveGlobalProfileRole = (value: unknown): AppUser['role'] => {
  return value === 'main_admin' ? 'main_admin' : 'user';
};

const describeAuthError = (message: string | null | undefined) => {
  const fallback = message?.trim() ?? '';
  if (/network request failed|failed to fetch|networkerror/i.test(fallback)) {
    return 'We could not reach the sign-in service. Check your connection and try again.';
  }
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(fallback)) {
    return 'Too many attempts were made. Please wait a moment and try again.';
  }
  return 'We could not sign you in with those details. Check them or reset your password.';
};

const describeSignUpError = (message: string | null | undefined) => {
  const fallback = message?.trim() ?? '';
  if (/network request failed|failed to fetch|networkerror/i.test(fallback)) {
    return 'We could not reach the sign-up service. Check your connection and try again.';
  }
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(fallback)) {
    return 'Too many attempts were made. Please wait a moment and try again.';
  }
  if (/password/i.test(fallback)) {
    return 'The password does not meet the security requirements. Please choose another password.';
  }
  if (/invalid.*email|email.*invalid/i.test(fallback)) {
    return 'Please check the email address and try again.';
  }
  return 'We could not create the account with those details. You can try signing in or resetting your password.';
};

const describePasswordResetError = (message: string | null | undefined) => {
  const fallback = message?.trim() ?? '';
  if (/network request failed|failed to fetch|networkerror/i.test(fallback)) {
    return 'We could not reach the sign-in service. Check your connection and try again.';
  }
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(fallback)) {
    return 'Too many attempts were made. Please wait a moment and try again.';
  }
  return 'We could not process that request right now. Please try again later.';
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : null);

/* ------------------------------------------------------------------
   Types
------------------------------------------------------------------- */
export type AppUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: 'user' | 'local_admin' | 'main_admin' | 'muezzin';
};

export type SignUpConsentInput = {
  terms: {
    accepted: true;
    version: string;
  };
  privacy: {
    acknowledged: true;
    version: string;
  };
  specialCategory: {
    granted: true;
    version: string;
  };
  age: {
    confirmedOver16: true;
    version: string;
  };
};

export const SIGN_UP_POLICY_VERSIONS = ACCOUNT_POLICY_VERSIONS;

const isValidPolicyVersion = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 64;
};

const matchesPolicyVersion = (value: unknown, expected: string): value is string =>
  isValidPolicyVersion(value) && value.trim() === expected;

const hasValidSignUpConsent = (
  consent: SignUpConsentInput | null | undefined
): consent is SignUpConsentInput =>
  consent?.terms?.accepted === true &&
  matchesPolicyVersion(consent.terms.version, SIGN_UP_POLICY_VERSIONS.terms) &&
  consent.privacy?.acknowledged === true &&
  matchesPolicyVersion(consent.privacy.version, SIGN_UP_POLICY_VERSIONS.privacy) &&
  consent.specialCategory?.granted === true &&
  matchesPolicyVersion(
    consent.specialCategory.version,
    SIGN_UP_POLICY_VERSIONS.specialCategory
  ) &&
  consent.age?.confirmedOver16 === true &&
  matchesPolicyVersion(consent.age.version, SIGN_UP_POLICY_VERSIONS.ageGate);

function buildFallbackUser(authUser: User): AppUser {
  return {
    id: authUser.id,
    email: authUser.email ?? null,
    display_name: deriveDisplayName(
      (authUser.user_metadata as any)?.display_name,
      authUser.email ?? null
    ),
    role: resolveGlobalProfileRole(
      // `user_metadata` is user-editable and must never grant authorization.
      (authUser.app_metadata as any)?.role ?? 'user'
    ),
  };
}

export type AuthContextType = {
  session: Session | null;
  user: AppUser | null;
  authUser: User | null; // 👈 direct Supabase Auth user
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    displayName: string | undefined,
    consent: SignUpConsentInput
  ) => Promise<{ error?: string; needsVerification?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
};

/* ------------------------------------------------------------------
   Context
------------------------------------------------------------------- */
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  authUser: null,
  loading: true,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => {},
  resetPassword: async () => ({}),
  refreshProfile: async () => {},
});

/* ------------------------------------------------------------------
   Provider
------------------------------------------------------------------- */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const redirectTo = useMemo(() => getAuthRedirectUrl(), []);
  const sessionHasCurrentAccountConsent = hasCurrentAccountConsent(
    session?.user
  );

  // Supabase should refresh native sessions only while the app is active.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const updateAutoRefresh = (state: AppStateStatus) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };

    updateAutoRefresh(AppState.currentState);
    const appStateSubscription = AppState.addEventListener('change', updateAutoRefresh);

    return () => {
      appStateSubscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  // Load session & subscribe to auth changes
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const nextSession = data.session ?? null;
        setSession(nextSession);
        setUser(nextSession?.user ? buildFallbackUser(nextSession.user) : null);
      } catch {
        if (!mounted) return;
        setSession(null);
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      const nextSession = sess ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ? buildFallbackUser(nextSession.user) : null);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(
    () =>
      subscribeForcedLocalSignOut(() => {
        setSession(null);
        setUser(null);
      }),
    []
  );

  // Keep profile synced with the current session user
  useEffect(() => {
    if (!session?.user) {
      setUser(null);
      return;
    }
    if (!sessionHasCurrentAccountConsent) {
      // Keep enough Auth identity for the account-completion screen, but do
      // not read or create the application profile before the user completes
      // the current account/consent step.
      setUser(buildFallbackUser(session.user));
      return;
    }
    void refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, sessionHasCurrentAccountConsent]);

  const refreshProfile = async () => {
    if (!session?.user) {
      setUser(null);
      return;
    }
    if (!hasCurrentAccountConsent(session.user)) {
      setUser(buildFallbackUser(session.user));
      return;
    }

    const userId = session.user.id;
    let hasReadableRow = false;
    let rowMissing = false;

    try {
      const { data: row, error } = await supabase
        .from('users')
        .select('id, email, display_name, role')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (row) {
        const authRole = resolveGlobalProfileRole((session.user.app_metadata as any)?.role ?? null);
        const effectiveRole = row.role === 'main_admin' ? 'main_admin' : authRole;
        hasReadableRow = true;
        setUser({
          id: row.id,
          email: row.email,
          display_name: row.display_name,
          role: effectiveRole,
        });
        return;
      }
      rowMissing = true;
    } catch {
      // ignore read errors and fall back to auth metadata without mutating roles
    }

    // fallback if no DB profile exists yet
    const fallback = buildFallbackUser(session.user as User);

    setUser(fallback);

    if (!hasReadableRow && rowMissing && fallback.role === 'user') {
      try {
        await supabase.from('users').upsert(
          {
            id: fallback.id,
            email: fallback.email,
            display_name: fallback.display_name,
            role: 'user',
          },
          { onConflict: 'id' }
        );
      } catch {
        // ignore profile sync errors
      }
    }
  };

  const signIn: AuthContextType['signIn'] = async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        return { error: describeAuthError(error.message) };
      }
      await requireRoleEntrySelection(data.user?.id ?? null);
      return {};
    } catch (error: unknown) {
      return { error: describeAuthError(errorMessage(error)) };
    }
  };

  const signUp: AuthContextType['signUp'] = async (email, password, displayName, consent) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedDisplay = deriveDisplayName(displayName, normalizedEmail);

    if (!hasValidSignUpConsent(consent)) {
      return {
        error: 'Please complete the age confirmation, accept the Terms, acknowledge the Privacy Policy, and provide the required consent.',
      };
    }

    const consentedAt = new Date().toISOString();

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            display_name: normalizedDisplay,
            terms_version: consent.terms.version.trim(),
            terms_accepted_at: consentedAt,
            privacy_version: consent.privacy.version.trim(),
            privacy_acknowledged_at: consentedAt,
            special_category_consent_version: consent.specialCategory.version.trim(),
            special_category_consent_at: consentedAt,
            special_category_consent_withdrawn_at: null,
            age_gate_version: consent.age.version.trim(),
            age_16_or_over_confirmed_at: consentedAt,
            consent_source: 'email_signup',
          },
          emailRedirectTo: redirectTo,
        },
      });
      if (error) return { error: describeSignUpError(error.message) };

      const needsVerification = !data.session;

      if (data.user && data.session) {
        await requireRoleEntrySelection(data.user.id);
        try {
          await supabase.from('users').upsert(
            {
              id: data.user.id,
              email: data.user.email,
              display_name: deriveDisplayName(
                displayName ?? (data.user.user_metadata as any)?.display_name,
                data.user.email
              ),
              role: 'user',
            },
            { onConflict: 'id' }
          );
        } catch {
          // ignore profile sync errors, user can proceed
        }
      }

      return { needsVerification };
    } catch (error: unknown) {
      return { error: describeSignUpError(errorMessage(error)) };
    }
  };

  const signOut = async () => {
    const activeUserId = session?.user?.id ?? null;
    try {
      await signOutCurrentDeviceFailClosed();
    } finally {
      await Promise.allSettled([
        clearSessionAccessCache(activeUserId),
        clearRoleEntrySelectionRequirement(activeUserId),
      ]);
      setUser(null);
      setSession(null);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetRedirectUrl(),
      });
      if (error) return { error: describePasswordResetError(error.message) };
      return {};
    } catch (error: unknown) {
      return { error: describePasswordResetError(errorMessage(error)) };
    }
  };

  const value: AuthContextType = {
    session,
    user,
    authUser: session?.user ?? null,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ------------------------------------------------------------------
   Hook
------------------------------------------------------------------- */
export const useAuth = () => useContext(AuthContext);
