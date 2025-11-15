// lib/auth.tsx
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

/* ------------------------------------------------------------------
   Types
------------------------------------------------------------------- */
export type AppUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: 'user' | 'local_admin' | 'main_admin';
};

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

 const redirectTo = useMemo(() => {
  const url = Linking.createURL('/callback');
  console.log('🔥 REDIRECT_TO:', url);
  return url;
}, []);


  // Load session & subscribe to auth changes
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setSession(sess ?? null);
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

    try {
      const { data: row, error } = await supabase
        .from('users')
        .select('id, email, display_name, role')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;

      if (row) {
        setUser({
          id: row.id,
          email: row.email,
          display_name: row.display_name,
          role: row.role,
        });
        return;
      }
    } catch {
      // fallback if no DB profile exists
      const u = session.user as User;
      setUser({
        id: u.id,
        email: u.email ?? null,
        display_name: (u.user_metadata as any)?.display_name ?? null,
        role:
          (u.user_metadata as any)?.role ??
          (u.app_metadata as any)?.role ??
          'user',
      });
    }
  };

  const signIn: AuthContextType['signIn'] = async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      await refreshProfile(); // ensure we have the user mirrored
      return {};
    } catch (e: any) {
      return { error: e?.message ?? 'Unknown error' };
    }
  };

  const signUp: AuthContextType['signUp'] = async (email, password, displayName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: displayName ? { display_name: displayName } : undefined,
          emailRedirectTo: redirectTo,
        },
      });
      if (error) return { error: error.message };

      const needsVerification = !data.session;

      if (data.user) {
        await supabase.from('users').upsert(
          {
            id: data.user.id,
            email: data.user.email,
            display_name: displayName ?? (data.user.user_metadata as any)?.display_name ?? null,
            role: 'user',
          },
          { onConflict: 'id' }
        );
      }

      return { needsVerification };
    } catch (e: any) {
      return { error: e?.message ?? 'Unknown error' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) return { error: error.message };
      return {};
    } catch (e: any) {
      return { error: e?.message ?? 'Unknown error' };
    }
  };

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user,
      authUser: session?.user ?? null,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshProfile,
    }),
    [session, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ------------------------------------------------------------------
   Hook
------------------------------------------------------------------- */
export const useAuth = () => useContext(AuthContext);


