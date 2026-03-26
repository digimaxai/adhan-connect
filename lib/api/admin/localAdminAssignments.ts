import { resolveApiUrl, supportsServerApi } from '../apiBaseUrl';
import { supabase } from '../../supabaseClient';

type LocalAdminAssignmentPayload = {
  userId: string;
  mosqueId: string;
};

type LocalAdminAssignmentResponse = {
  userId: string;
  mosqueId: string;
  assigned?: boolean;
  removed?: boolean;
};

async function callLocalAdminAssignmentApi(
  method: 'POST' | 'DELETE',
  payload: LocalAdminAssignmentPayload
): Promise<LocalAdminAssignmentResponse> {
  if (!supportsServerApi()) {
    throw new Error('Local-admin assignment API is unavailable in this runtime.');
  }

  const endpoint = resolveApiUrl('/api/admin/local-admin-assignment');
  if (!endpoint) {
    throw new Error('Could not resolve the local-admin assignment endpoint.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Your session has expired. Refresh the page and sign in again.');
  }

  const response = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  const parsed = raw ? (JSON.parse(raw) as Partial<LocalAdminAssignmentResponse> & { error?: string }) : {};
  if (!response.ok) {
    throw new Error(parsed.error || 'The local-admin assignment request failed.');
  }

  return parsed as LocalAdminAssignmentResponse;
}

export async function assignLocalAdminMembership(payload: LocalAdminAssignmentPayload) {
  return callLocalAdminAssignmentApi('POST', payload);
}

export async function removeLocalAdminMembership(payload: LocalAdminAssignmentPayload) {
  return callLocalAdminAssignmentApi('DELETE', payload);
}
