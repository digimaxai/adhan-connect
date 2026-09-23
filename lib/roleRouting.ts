import type { RoleFlags } from './roles';
import type { StaffEntryMode } from './roleEntryPreferences';

type RouteTarget = '/admin' | '/(admin)' | '/(muezzin)' | '/(user)' | '/listener-home' | '/role-entry';
type WorkspaceRoleFlags = Pick<
  RoleFlags,
  'isMainAdmin' | 'isLocalAdmin' | 'isAdmin' | 'isMuezzin'
>;

export function resolveRouteTargetHref(target: RouteTarget): string {
  if (target === '/(admin)') return '/admin-home';
  if (target === '/(muezzin)') return '/muezzin-home';
  return target;
}

function hasAdminWorkspace(roles: WorkspaceRoleFlags) {
  return roles.isAdmin || roles.isMainAdmin || roles.isLocalAdmin;
}

export function getAvailableWorkspaceModes(
  roles: WorkspaceRoleFlags
): StaffEntryMode[] {
  const modes: StaffEntryMode[] = ['listener'];
  if (hasAdminWorkspace(roles)) modes.push('admin');
  if (roles.isMuezzin) modes.push('muezzin');
  return modes;
}

/**
 * "Dual staff" means the account has both staff workspaces. Main-admin status
 * changes which admin route opens; it must not hide an active muezzin role.
 */
export function hasDualStaffAccess(roles: WorkspaceRoleFlags) {
  return hasAdminWorkspace(roles) && roles.isMuezzin;
}

export function hasMultipleWorkspaceAccess(roles: WorkspaceRoleFlags) {
  return getAvailableWorkspaceModes(roles).length > 1;
}

export function resolveRoleEntryTarget(
  roles: WorkspaceRoleFlags,
  preferredEntry: StaffEntryMode | null
): RouteTarget {
  const availableModes = getAvailableWorkspaceModes(roles);

  if (preferredEntry && availableModes.includes(preferredEntry)) {
    if (preferredEntry === 'listener') return '/listener-home';
    if (preferredEntry === 'muezzin') return '/(muezzin)';
    return roles.isMainAdmin ? '/admin' : '/(admin)';
  }

  if (availableModes.length > 1) return '/role-entry';
  return '/listener-home';
}
