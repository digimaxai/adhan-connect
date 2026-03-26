import { persistentStorage } from './persistentStorage';

type RoleEntrySelectionRequirementListener = (userId: string | null, required: boolean) => void;

const listeners = new Set<RoleEntrySelectionRequirementListener>();

function storageKey(userId: string | null) {
  return `staff_entry_selection_required:${userId ?? 'anonymous'}`;
}

function notifyListeners(userId: string | null, required: boolean) {
  for (const listener of listeners) {
    listener(userId, required);
  }
}

export async function isRoleEntrySelectionRequired(userId: string | null): Promise<boolean> {
  return (await persistentStorage.getItem(storageKey(userId))) === '1';
}

export async function requireRoleEntrySelection(userId: string | null) {
  await persistentStorage.setItem(storageKey(userId), '1');
  notifyListeners(userId, true);
}

export async function clearRoleEntrySelectionRequirement(userId: string | null) {
  await persistentStorage.removeItem(storageKey(userId));
  notifyListeners(userId, false);
}

export function subscribeRoleEntrySelectionRequirement(listener: RoleEntrySelectionRequirementListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
