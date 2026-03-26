import type { RoleFlags } from './roles';
import type { StaffEntryMode } from './roleEntryPreferences';

type RouteTarget = '/admin' | '/(admin)' | '/(muezzin)' | '/(user)' | '/listener-home' | '/role-entry';

export function resolveRouteTargetHref(target: RouteTarget): string {
  if (target === '/(admin)') return '/admin-home';
  if (target === '/(muezzin)') return '/muezzin-home';
  return target;
}

export function hasDualStaffAccess(roles: Pick<RoleFlags, 'isMainAdmin' | 'isLocalAdmin' | 'isMuezzin'>) {
  return !roles.isMainAdmin && roles.isLocalAdmin && roles.isMuezzin;
}

export function resolveRoleEntryTarget(
  roles: Pick<RoleFlags, 'isMainAdmin' | 'isLocalAdmin' | 'isAdmin' | 'isMuezzin'>,
  preferredEntry: StaffEntryMode | null
): RouteTarget {
  if (roles.isMainAdmin) return '/admin';
  if (hasDualStaffAccess(roles)) {
    if (preferredEntry === 'muezzin') return '/(muezzin)';
    if (preferredEntry === 'admin') return '/(admin)';
    return '/role-entry';
  }
  if (roles.isAdmin || roles.isLocalAdmin) return '/(admin)';
  if (roles.isMuezzin) return '/(muezzin)';
  return '/listener-home';
}
