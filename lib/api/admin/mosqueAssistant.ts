import { resolveApiUrl } from '../apiBaseUrl';
import { supabase } from '../../supabase';
export async function mosqueAssistantRequest(query = '', body?: unknown) {
  const endpoint = resolveApiUrl(`/api/admin/mosque-assistant${query}`);
  if (!endpoint) throw new Error('The mosque assistant requires the admin server.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Sign in again to use the mosque assistant.');
  const response = await fetch(endpoint, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${data.session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Unable to reach the mosque assistant.');
  return payload;
}
