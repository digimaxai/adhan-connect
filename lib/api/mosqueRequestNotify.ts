import { resolveApiUrl, supportsServerApi } from './apiBaseUrl';

/**
 * Fire-and-forget: sends the admin notification email after a successful
 * mosque request insert. Never throws — failures are swallowed so they cannot
 * affect the user-facing success state.
 */
export function notifyMosqueRequest(requestId: string, accessToken: string): void {
  if (!supportsServerApi()) return;

  const url = resolveApiUrl('/api/notify-mosque-request');
  if (!url) return;

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ request_id: requestId }),
  }).catch(() => {
    // Best-effort — data is already in the DB.
  });
}
