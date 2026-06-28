// lib/auth.tsx
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { clearRoleEntrySelectionRequirement, requireRoleEntrySelection } from './roleEntrySession';
import { clearSessionAccessCache } from './sessionAccess';

export const getAuthRedirectUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL?.trim();
  // Prefer web-specific redirect when running on web; keep mobile deep link otherwise.
  if (Platform.OS === 'web') {
    if (envUrl) return envUrl;
    return typeof window !== 'undefined'
      ? `${window.location.origin}/callback`
      : 'http://localhost:8081/callback';
  }
  // Native/mobile: use env if provided, else fall back to app scheme.
  if (envUrl) return envUrl;
  return Linking.createURL('/callback', { scheme: 'adhanconnect' });
};

export const getPasswordResetRedirectUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL?.trim();
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') return `${window.location.origin}/new-password`;
    if (envUrl) return envUrl.replace(/\/callback$/, '/new-password');
    return 'http://localhost:8081/new-password';
  }
  if (envUrl) return envUrl.replace(/\/callback$/, '/new-password');
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
  const fallback = message?.trim() || 'Unknown error';
  if (/network request failed|failed to fetch|networkerror/i.test(fallback)) {
    return 'The phone could not reach Supabase. Check that the Android phone has working internet/DNS, then try again. Switching off Guest Wi-Fi, VPN, or Private DNS can help.';
  }
  return fallback;
};

/* ------------------------------------------------------------------
   Types
------------------------------------------------------------------- */
export type AppUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: 'user' | 'local_admin' | 'main_admin' | 'muezzin';
};

function buildFallbackUser(authUser: User): AppUser {
  return {
    id: authUser.id,
    email: authUser.email ?? null,
    display_name: deriveDisplayName(
      (authUser.user_metadata as any)?.display_name,
      authUser.email ?? null
    ),
    role: resolveGlobalProfileRole(
      (authUser.app_metadata as any)?.role ?? (authUser.user_metadata as any)?.role ?? 'user'
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
    displayName?: string
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
  // Load session & subscribe to auth changes
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const nextSession = data.session ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ? buildFallbackUser(nextSession.user) : null);
      setLoading(false);
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

  // Keep profile synced with the current session user
  useEffect(() => {
    if (!session?.user) {
      setUser(null);
      return;
    }
    void refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const refreshProfile = async () => {
    if (!session?.user) {
      setUser(null);
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
    const supabaseProjectRef = (() => {
      try {
        return new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').hostname.split('.')[0] ?? 'unknown';
      } catch {
        return 'unknown';
      }
    })();
    try {
      console.log('[auth] signIn attempt', {
        projectRef: supabaseProjectRef,
        emailDomain: normalizedEmail.split('@')[1] ?? 'unknown',
      });
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        console.log('[auth] signIn failed', {
          projectRef: supabaseProjectRef,
          message: error.message,
          status: error.status,
        });
        return { error: describeAuthError(error.message) };
      }
      await requireRoleEntrySelection(data.user?.id ?? null);
      console.log('[auth] signIn succeeded', {
        projectRef: supabaseProjectRef,
        userId: data.user?.id ?? null,
      });
      return {};
    } catch (e: any) {
      console.log('[auth] signIn exception', {
        projectRef: supabaseProjectRef,
        message: e?.message ?? 'Unknown error',
      });
      return { error: describeAuthError(e?.message) };
    }
  };

  const signUp: AuthContextType['signUp'] = async (email, password, displayName) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedDisplay = deriveDisplayName(displayName, normalizedEmail);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { display_name: normalizedDisplay },
          emailRedirectTo: redirectTo,
        },
      });
      if (error) return { error: error.message };

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
    } catch (e: any) {
      return { error: e?.message ?? 'Unknown error' };
    }
  };

  const signOut = async () => {
    await clearSessionAccessCache(session?.user?.id ?? null);
    await clearRoleEntrySelectionRequirement(session?.user?.id ?? null);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetRedirectUrl(),
      });
      if (error) return { error: error.message };
      return {};
    } catch (e: any) {
      return { error: e?.message ?? 'Unknown error' };
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
