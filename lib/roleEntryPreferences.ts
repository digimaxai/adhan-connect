import { persistentStorage } from './persistentStorage';

export type StaffEntryMode = 'admin' | 'muezzin';

type PreferredStaffEntryListener = (userId: string | null, mode: StaffEntryMode | null) => void;

const listeners = new Set<PreferredStaffEntryListener>();

function storageKey(userId: string | null) {
  return `staff_entry_mode:${userId ?? 'anonymous'}`;
}

function normalizeEntryMode(value: string | null): StaffEntryMode | null {
  if (value === 'admin' || value === 'muezzin') return value;
  return null;
}

function notifyListeners(userId: string | null, mode: StaffEntryMode | null) {
  for (const listener of listeners) {
    listener(userId, mode);
  }
}

export async function getPreferredStaffEntry(userId: string | null): Promise<StaffEntryMode | null> {
  return normalizeEntryMode(await persistentStorage.getItem(storageKey(userId)));
}

export async function setPreferredStaffEntry(userId: string | null, mode: StaffEntryMode) {
  await persistentStorage.setItem(storageKey(userId), mode);
  notifyListeners(userId, mode);
}

export async function clearPreferredStaffEntry(userId: string | null) {
  await persistentStorage.removeItem(storageKey(userId));
  notifyListeners(userId, null);
}

export function subscribePreferredStaffEntry(listener: PreferredStaffEntryListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
