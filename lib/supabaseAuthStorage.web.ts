import {
  navigatorLock,
  processLock,
  type LockFunc,
  type SupportedStorage,
} from '@supabase/supabase-js';

function getLocalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const supabaseAuthStorage: SupportedStorage = {
  getItem(key) {
    return getLocalStorage()?.getItem(key) ?? null;
  },
  setItem(key, value) {
    getLocalStorage()?.setItem(key, value);
  },
  removeItem(key) {
    getLocalStorage()?.removeItem(key);
  },
};

export const supabaseAuthLock: LockFunc =
  typeof globalThis.navigator !== 'undefined' && globalThis.navigator.locks
    ? navigatorLock
    : processLock;

// Callback routes exchange PKCE codes explicitly. Automatic URL handling can
// consume a recovery code before the reset screen proves that it was a
// password-recovery flow.
export const detectSupabaseSessionInUrl = false;
