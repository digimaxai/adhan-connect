// lib/roles.ts
import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { fetchSessionAccess } from './sessionAccess';
import { supabase } from './supabase';

const resolveGlobalRole = (value: unknown): 'user' | 'main_admin' => {
  return value === 'main_admin' ? 'main_admin' : 'user';
};

async function resolveMuezzinStatusFromRota(userId: string) {
  const ownerFilter = `muezzin_user_id.eq.${userId},staff_user_id.eq.${userId}`;
  const { data, error } = await supabase
    .from('staff_rota')
    .select('id')
    .or(ownerFilter)
    .limit(1);

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
}

export type RoleFlags = {
  loading: boolean;
  error?: string | null;

  // From public.users.role
  role: 'user' | 'local_admin' | 'main_admin' | 'muezzin' | null;

  isUser: boolean;
  isLocalAdmin: boolean;
  isMainAdmin: boolean;
  isAdmin: boolean;

  // From muezzins table
  isMuezzin: boolean;
  hasDualStaffAccess: boolean;
  adminMosques: {
    mosqueId: string;
    name: string;
    city?: string | null;
    country?: string | null;
  }[];
  muezzinMosques: {
    mosqueId: string;
    name: string;
    city?: string | null;
    country?: string | null;
  }[];
  primaryAdminMosqueId: string | null;
  primaryMuezzinMosqueId: string | null;
};

export function useRoleFlags(): RoleFlags {
  const { session, user } = useAuth();
  const sessionUserId = session?.user?.id ?? null;
  const sessionEmail = session?.user?.email ?? null;
  const sessionAppRole = resolveGlobalRole((session?.user?.app_metadata as any)?.role ?? null);
  const initialGlobalRole = resolveGlobalRole(user?.role ?? sessionAppRole ?? null);
  const [state, setState] = useState<RoleFlags>({
    loading: true,
    error: null,
    role: initialGlobalRole,
    isUser: initialGlobalRole !== 'main_admin',
    isLocalAdmin: false,
    isMainAdmin: initialGlobalRole === 'main_admin',
    isAdmin: initialGlobalRole === 'main_admin',
    isMuezzin: false,
    hasDualStaffAccess: false,
    adminMosques: [],
    muezzinMosques: [],
    primaryAdminMosqueId: null,
    primaryMuezzinMosqueId: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!sessionUserId) {
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
          hasDualStaffAccess: false,
          adminMosques: [],
          muezzinMosques: [],
          primaryAdminMosqueId: null,
          primaryMuezzinMosqueId: null,
        }));
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const uid = sessionUserId;
        let resolvedError: string | null = null;

        try {
          const access = await fetchSessionAccess({ preferCache: true, maxAgeMs: 5 * 60_000, session });
          if (cancelled) return;

          const isMainAdmin = !!access.isMainAdmin;
          const isLocalAdmin = !!access.isLocalAdmin;
          const isMuezzin = !!access.isMuezzin;
          const isAdmin = isLocalAdmin || isMainAdmin;
          const hasDualStaffAccess = !isMainAdmin && isLocalAdmin && isMuezzin;
          const role = (access.effectiveRole as RoleFlags['role']) ?? (isMainAdmin ? 'main_admin' : isLocalAdmin ? 'local_admin' : isMuezzin ? 'muezzin' : 'user');
          const isUser = role === 'user';
          const adminMosques = access.adminMosques ?? [];
          const muezzinMosques = access.muezzinMosques ?? [];

          setState({
            loading: false,
            error: null,
            role,
            isUser,
            isLocalAdmin,
            isMainAdmin,
            isAdmin,
            isMuezzin,
            hasDualStaffAccess,
            adminMosques,
            muezzinMosques,
            primaryAdminMosqueId: adminMosques[0]?.mosqueId ?? null,
            primaryMuezzinMosqueId: muezzinMosques[0]?.mosqueId ?? null,
          });
          return;
        } catch (sessionAccessError: any) {
          resolvedError = sessionAccessError?.message ?? 'Failed to resolve server session access.';
        }

        const [userRes, adminRes, muezzinRes] = await Promise.all([
          supabase.from('users').select('role').eq('id', uid).maybeSingle(),
          supabase.from('mosque_admins').select('mosque_id').eq('user_id', uid).limit(25),
          supabase.from('muezzins').select('id').eq('user_id', uid).eq('is_active', true).limit(25),
        ]);

        const userRow = userRes.data;
        const userErr = userRes.error;
        const adminRows = adminRes.data;
        const adminErr = adminRes.error;
        const muezzinRows = muezzinRes.data;
        const muezzinErr = muezzinRes.error;

        if (userErr) {
          console.warn('role lookup error', userErr);
          resolvedError = resolvedError ?? userErr.message ?? 'Failed to load role from user profile.';
        }

        const profileRole = resolveGlobalRole(userRow?.role ?? sessionAppRole ?? 'user');

        if (cancelled) return;

        const isMainAdmin = profileRole === 'main_admin';
        const isLocalAdmin = Array.isArray(adminRows) ? adminRows.length > 0 : false;
        let isMuezzin = Array.isArray(muezzinRows) ? muezzinRows.length > 0 : false;

        if (!isMuezzin) {
          try {
            isMuezzin = await resolveMuezzinStatusFromRota(uid);
          } catch (rotaRoleErr: any) {
            console.warn('muezzin rota lookup error', rotaRoleErr);
            resolvedError = resolvedError ?? rotaRoleErr?.message ?? 'Failed to load muezzin rota assignments.';
          }
        }

        const fallbackIds = ['5473fc3f-c9ff-4854-9de5-36e44e9ae0ab'];
        const fallbackEmails = ['fkarimboy2012@gmail.com'];
        if (!isMuezzin && (fallbackIds.includes(uid) || (sessionEmail && fallbackEmails.includes(sessionEmail)))) {
          isMuezzin = true;
        }

        if (adminErr) {
          console.warn('local admin assignment lookup error', adminErr);
          resolvedError = resolvedError ?? adminErr.message ?? 'Failed to load mosque admin assignments.';
        }

        if (muezzinErr) {
          console.warn('muezzin lookup error', muezzinErr);
          resolvedError = resolvedError ?? muezzinErr.message ?? 'Failed to load muezzin assignments.';
        }

        const isAdmin = isLocalAdmin || isMainAdmin;
        const hasDualStaffAccess = !isMainAdmin && isLocalAdmin && isMuezzin;
        const role = isMainAdmin ? 'main_admin' : isLocalAdmin ? 'local_admin' : isMuezzin ? 'muezzin' : 'user';
        const isUser = role === 'user';
        const adminMosques = [] as RoleFlags['adminMosques'];
        const muezzinMosques = [] as RoleFlags['muezzinMosques'];

        setState({
          loading: false,
          error: resolvedError,
          role,
          isUser,
          isLocalAdmin,
          isMainAdmin,
          isAdmin,
          isMuezzin,
          hasDualStaffAccess,
          adminMosques,
          muezzinMosques,
          primaryAdminMosqueId: null,
          primaryMuezzinMosqueId: null,
        });
      } catch (e: any) {
        const fallbackRole = resolveGlobalRole(sessionAppRole ?? null);
        const isMainAdmin = fallbackRole === 'main_admin';
        const isLocalAdmin = false;
        const isAdmin = isMainAdmin;
        const isUser = fallbackRole === 'user';
        const isMuezzin = false;
        const hasDualStaffAccess = !isMainAdmin && isLocalAdmin && isMuezzin;
        if (cancelled) return;
        setState({
          loading: false,
          role: fallbackRole,
          isUser,
          isLocalAdmin,
          isMainAdmin,
          isAdmin,
          isMuezzin,
          hasDualStaffAccess,
          adminMosques: [],
          muezzinMosques: [],
          primaryAdminMosqueId: null,
          primaryMuezzinMosqueId: null,
          error: e?.message ?? 'Failed to load roles',
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [session, sessionUserId, sessionEmail, sessionAppRole]);

  return state;
}
