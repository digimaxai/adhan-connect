import { resolveApiUrl, supportsServerApi } from '../apiBaseUrl';
import { supabase } from '../../supabaseClient';

type MuezzinAssignmentPayload = {
  userId: string;
  mosqueId: string;
};

type MuezzinAssignmentResponse = {
  userId: string;
  mosqueId: string;
  assigned?: boolean;
  removed?: boolean;
  reactivated?: boolean;
};

async function callMuezzinAssignmentApi(
  method: 'POST' | 'DELETE',
  payload: MuezzinAssignmentPayload
): Promise<MuezzinAssignmentResponse> {
  if (!supportsServerApi()) {
    throw new Error('Muezzin assignment API is unavailable in this runtime.');
  }

  const endpoint = resolveApiUrl('/api/admin/muezzin-assignment');
  if (!endpoint) {
    throw new Error('Could not resolve the muezzin assignment endpoint.');
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
  const parsed = raw ? (JSON.parse(raw) as Partial<MuezzinAssignmentResponse> & { error?: string }) : {};
  if (!response.ok) {
    throw new Error(parsed.error || 'The muezzin assignment request failed.');
  }

  return parsed as MuezzinAssignmentResponse;
}

export async function assignMuezzinMembership(payload: MuezzinAssignmentPayload) {
  return callMuezzinAssignmentApi('POST', payload);
}

export async function removeMuezzinMembership(payload: MuezzinAssignmentPayload) {
  return callMuezzinAssignmentApi('DELETE', payload);
}
