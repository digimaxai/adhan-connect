import { SUPABASE_AUTH_STORAGE_KEY, supabase } from './supabase';
import { supabaseAuthStorage } from './supabaseAuthStorage';

type ForcedLocalSignOutListener = () => void;

const forcedLocalSignOutListeners = new Set<ForcedLocalSignOutListener>();
const pkceVerifierStorageKey = `${SUPABASE_AUTH_STORAGE_KEY}-code-verifier`;

function notifyForcedLocalSignOut() {
  for (const listener of forcedLocalSignOutListeners) {
    try {
      listener();
    } catch {
      // One UI subscriber must not prevent the remaining session cleanup.
    }
  }
}

export function subscribeForcedLocalSignOut(
  listener: ForcedLocalSignOutListener
) {
  forcedLocalSignOutListeners.add(listener);
  return () => {
    forcedLocalSignOutListeners.delete(listener);
  };
}

/**
 * Removes every credential-equivalent value owned by the Supabase client.
 * This is the offline/error fallback when auth-js cannot complete its normal
 * local sign-out path.
 */
export async function forceClearLocalAuthSession() {
  const removals = await Promise.allSettled([
    supabaseAuthStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY),
    supabaseAuthStorage.removeItem(pkceVerifierStorageKey),
  ]);

  // The in-memory AuthProvider must close immediately even if protected
  // storage itself reports an operating-system failure.
  notifyForcedLocalSignOut();

  if (removals.some((result) => result.status === 'rejected')) {
    throw new Error('LOCAL_AUTH_SESSION_CLEAR_FAILED');
  }
}

export async function clearPendingPkceVerifier() {
  await supabaseAuthStorage.removeItem(pkceVerifierStorageKey);
}

/**
 * Signs out this device. A server/network error is not allowed to leave the
 * persisted local session or a pending PKCE verifier behind.
 */
export async function signOutCurrentDeviceFailClosed() {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (!error) {
      // auth-js removes the session itself. Explicitly remove any unfinished
      // PKCE verifier as well so a later callback cannot reuse sign-out state.
      await clearPendingPkceVerifier();
      return;
    }
  } catch {
    // Continue into forced local cleanup.
  }

  await forceClearLocalAuthSession();
}
