// lib/roles.ts
import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { fetchSessionAccess } from './sessionAccess';

export type RoleFlags = {
  loading: boolean;
  /**
   * True after access has settled for `resolvedUserId`. Failed checks settle
   * fail-closed with `error` populated and no staff capabilities. A disabled
   * hook is intentionally not ready.
   */
  ready: boolean;
  /**
   * The authenticated user whose access flags are represented by this value.
   * It remains null while a new session is resolving, which prevents flags
   * from the previous user being reused during an account switch.
   */
  resolvedUserId: string | null;
  error?: string | null;

  // From public.users.role
  role: 'user' | 'local_admin' | 'main_admin' | 'muezzin' | null;

  isUser: boolean;
  isLocalAdmin: boolean;
  isMainAdmin: boolean;
  isAdmin: boolean;

  // From muezzins table
  isMuezzin: boolean;
  /**
   * True when both staff workspaces are available (admin and muezzin).
   * Listener access is intentionally not counted as a staff role.
   */
  hasDualStaffAccess: boolean;
  /**
   * True when the account can choose between listener and at least one staff
   * workspace. Every authenticated account retains listener access.
   */
  hasMultipleWorkspaceAccess: boolean;
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

export type UseRoleFlagsOptions = {
  enabled?: boolean;
  /**
   * Changing this value forces a fresh authoritative access check. This is
   * used by the root access-error screen without weakening the fail-closed
   * behavior or falling back to cached roles.
   */
  refreshKey?: number;
};

type RoleResolutionState = {
  flags: RoleFlags;
  accessToken: string | null;
};

function noAccessRoleFlags({
  loading,
  ready,
  resolvedUserId = null,
  error = null,
  role = null,
}: {
  loading: boolean;
  ready: boolean;
  resolvedUserId?: string | null;
  error?: string | null;
  role?: RoleFlags['role'];
}): RoleFlags {
  return {
    loading,
    ready,
    resolvedUserId,
    error,
    role,
    isUser: true,
    isLocalAdmin: false,
    isMainAdmin: false,
    isAdmin: false,
    isMuezzin: false,
    hasDualStaffAccess: false,
    hasMultipleWorkspaceAccess: false,
    adminMosques: [],
    muezzinMosques: [],
    primaryAdminMosqueId: null,
    primaryMuezzinMosqueId: null,
  };
}

export function useRoleFlags(options: UseRoleFlagsOptions = {}): RoleFlags {
  const { session } = useAuth();
  const enabled = options.enabled ?? true;
  const refreshKey = options.refreshKey ?? 0;
  const sessionUserId = session?.user?.id ?? null;
  const sessionAccessToken = session?.access_token ?? null;
  const [resolution, setResolution] = useState<RoleResolutionState>(() => ({
    flags: noAccessRoleFlags({ loading: true, ready: false }),
    accessToken: null,
  }));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!enabled) {
        setResolution({
          flags: noAccessRoleFlags({ loading: false, ready: false }),
          accessToken: null,
        });
        return;
      }

      if (!sessionUserId) {
        setResolution({
          flags: noAccessRoleFlags({ loading: false, ready: true }),
          accessToken: null,
        });
        return;
      }

      setResolution({
        flags: noAccessRoleFlags({ loading: true, ready: false }),
        accessToken: sessionAccessToken,
      });

      try {
        const uid = sessionUserId;
        const access = await fetchSessionAccess({
          allowCachedFallback: false,
          session,
        });
        if (cancelled) return;

        const isMainAdmin = !!access.isMainAdmin;
        const isLocalAdmin = !!access.isLocalAdmin;
        const isMuezzin = !!access.isMuezzin;
        const isAdmin = isLocalAdmin || isMainAdmin;
        const hasDualStaffAccess = isAdmin && isMuezzin;
        const hasMultipleWorkspaceAccess = isAdmin || isMuezzin;
        const role =
          (access.effectiveRole as RoleFlags['role']) ??
          (isMainAdmin
            ? 'main_admin'
            : isLocalAdmin
              ? 'local_admin'
              : isMuezzin
                ? 'muezzin'
                : 'user');
        const isUser = role === 'user';
        const adminMosques = access.adminMosques ?? [];
        const muezzinMosques = access.muezzinMosques ?? [];

        setResolution({
          flags: {
            loading: false,
            ready: true,
            resolvedUserId: uid,
            error: null,
            role,
            isUser,
            isLocalAdmin,
            isMainAdmin,
            isAdmin,
            isMuezzin,
            hasDualStaffAccess,
            hasMultipleWorkspaceAccess,
            adminMosques,
            muezzinMosques,
            primaryAdminMosqueId: adminMosques[0]?.mosqueId ?? null,
            primaryMuezzinMosqueId: muezzinMosques[0]?.mosqueId ?? null,
          },
          accessToken: sessionAccessToken,
        });
      } catch (e: any) {
        if (cancelled) return;
        setResolution({
          flags: noAccessRoleFlags({
            loading: false,
            ready: true,
            resolvedUserId: sessionUserId,
            role: 'user',
            error: e?.message ?? 'Failed to resolve current session access.',
          }),
          accessToken: sessionAccessToken,
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey, session, sessionAccessToken, sessionUserId]);

  if (!enabled) {
    return noAccessRoleFlags({ loading: false, ready: false });
  }

  if (!sessionUserId) {
    return resolution.flags.resolvedUserId === null && resolution.flags.ready
      ? resolution.flags
      : noAccessRoleFlags({ loading: true, ready: false });
  }

  if (
    !resolution.flags.ready ||
    resolution.flags.resolvedUserId !== sessionUserId ||
    resolution.accessToken !== sessionAccessToken
  ) {
    return noAccessRoleFlags({ loading: true, ready: false });
  }

  return resolution.flags;
}
