type AuthFlowListener = (pending: boolean) => void;

let socialAuthCompletionPending = false;
let pendingAuthEmail: string | null = null;
const listeners = new Set<AuthFlowListener>();

function notify() {
  for (const listener of listeners) listener(socialAuthCompletionPending);
}

export function beginSocialAuthCompletion() {
  socialAuthCompletionPending = true;
  notify();
}

export function endSocialAuthCompletion() {
  socialAuthCompletionPending = false;
  notify();
}

export function isSocialAuthCompletionPending() {
  return socialAuthCompletionPending;
}

export function subscribeSocialAuthCompletion(listener: AuthFlowListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Short-lived, process-local handoff between auth screens. Email addresses
 * must not be placed in route query strings, where browser history, hosting
 * logs, analytics, or referrer headers could capture them. A full reload
 * intentionally clears this convenience value.
 */
export function setPendingAuthEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() ?? '';
  pendingAuthEmail =
    normalized && normalized.length <= 320 ? normalized : null;
}

export function getPendingAuthEmail() {
  return pendingAuthEmail;
}

export function clearPendingAuthEmail() {
  pendingAuthEmail = null;
}
