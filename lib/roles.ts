// lib/roles.ts
import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';
import { getMuezzinPrimaryMosque } from './liveAdhan';

export type RoleFlags = {
  loading: boolean;
  error?: string | null;

  // From public.users.role
  role: 'user' | 'local_admin' | 'main_admin' | null;

  isUser: boolean;
  isLocalAdmin: boolean;
  isMainAdmin: boolean;
  isAdmin: boolean;

  // From muezzins table
  isMuezzin: boolean;
};

export function useRoleFlags(): RoleFlags {
  const { session, user } = useAuth();
  const [state, setState] = useState<RoleFlags>({
    loading: true,
    error: null,
    role: user?.role ?? null,
    isUser: !user || user.role === 'user',
    isLocalAdmin: user?.role === 'local_admin',
    isMainAdmin: user?.role === 'main_admin',
    isAdmin: user?.role === 'local_admin' || user?.role === 'main_admin',
    isMuezzin: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!session?.user) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          role: null,
          isUser: true,
          isLocalAdmin: false,
          isMainAdmin: false,
          isAdmin: false,
          isMuezzin: false,
        }));
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const uid = session.user.id;

        // 1) get role from users table
        const { data: userRow, error: userErr } = await supabase
          .from('users')
          .select('role')
          .eq('id', uid)
          .maybeSingle();

        if (userErr) throw userErr;

        const role = (userRow?.role ?? 'user') as
          | 'user'
          | 'local_admin'
          | 'main_admin';

        // 2) check if user is an active muezzin
        const { data: mzRow, error: mzErr } = await supabase
          .from('muezzins')
          .select('id')
          .eq('user_id', uid)
          .eq('is_active', true)
          .maybeSingle();

        if (mzErr && mzErr.code !== 'PGRST116') {
          console.warn('muezzin lookup error', mzErr);
          throw mzErr;
        }

        let isMuezzin = !!mzRow;
        if (!isMuezzin) {
          try {
            const primary = await getMuezzinPrimaryMosque(supabase as any, uid);
            if (primary?.mosqueId) isMuezzin = true;
          } catch {
            // ignore
          }
        }
        // Hard fallback for known muezzin user if DB lookup fails
        const fallbackIds = ['5473fc3f-c9ff-4854-9de5-36e44e9ae0ab'];
        const fallbackEmails = ['fkarimboy2012@gmail.com'];
        const sessionEmail = (session?.user as any)?.email ?? null;
        if (!isMuezzin && (fallbackIds.includes(uid) || (sessionEmail && fallbackEmails.includes(sessionEmail)))) {
          isMuezzin = true;
        }

        if (cancelled) return;

        const isLocalAdmin = role === 'local_admin';
        const isMainAdmin = role === 'main_admin';
        const isAdmin = isLocalAdmin || isMainAdmin;
        const isUser = role === 'user';

        setState({
          loading: false,
          error: null,
          role,
          isUser,
          isLocalAdmin,
          isMainAdmin,
          isAdmin,
          isMuezzin,
        });
      } catch (e: any) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: e?.message ?? 'Failed to load roles',
        }));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  return state;
}
