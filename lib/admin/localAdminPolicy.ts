import type { SupabaseClient } from '@supabase/supabase-js';

export type LocalAdminPolicyMosque = {
  mosqueId: string;
  mosqueName: string;
  allowMultiMosqueLocalAdmins: boolean;
};

export type LocalAdminPolicyDecision = {
  allowed: boolean;
  message: string | null;
  blockingMosques: LocalAdminPolicyMosque[];
};

type MosquePolicyRow = {
  id: string;
  name?: string | null;
  allow_multi_mosque_local_admins?: boolean | null;
};

function formatMosqueNameList(names: string[]) {
  if (!names.length) return 'another mosque';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function mapMosquePolicyRow(row: MosquePolicyRow): LocalAdminPolicyMosque {
  return {
    mosqueId: row.id,
    mosqueName: row.name?.trim() || 'Mosque',
    allowMultiMosqueLocalAdmins: !!row.allow_multi_mosque_local_admins,
  };
}

export function evaluateLocalAdminPolicy(
  targetMosque: LocalAdminPolicyMosque,
  assignedMosques: LocalAdminPolicyMosque[]
): LocalAdminPolicyDecision {
  const otherAssignments = assignedMosques.filter((mosque) => mosque.mosqueId !== targetMosque.mosqueId);
  if (!otherAssignments.length) {
    return { allowed: true, message: null, blockingMosques: [] };
  }

  if (!targetMosque.allowMultiMosqueLocalAdmins) {
    return {
      allowed: false,
      message: `${targetMosque.mosqueName} keeps local-admin access exclusive to this mosque. Remove the user's other mosque assignments before adding them here.`,
      blockingMosques: otherAssignments,
    };
  }

  const blockingMosques = otherAssignments.filter((mosque) => !mosque.allowMultiMosqueLocalAdmins);
  if (!blockingMosques.length) {
    return { allowed: true, message: null, blockingMosques: [] };
  }

  const blockingNames = formatMosqueNameList(
    blockingMosques
      .map((mosque) => mosque.mosqueName)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
  );

  return {
    allowed: false,
    message: `This user already manages ${blockingNames}, where cross-mosque local-admin access is inactive. Remove that assignment before adding another mosque.`,
    blockingMosques,
  };
}

export async function loadLocalAdminPolicyContext(
  client: SupabaseClient<any, any, any>,
  userId: string,
  targetMosqueId: string
) {
  const targetRes = await client
    .from('mosques')
    .select('id, name, allow_multi_mosque_local_admins')
    .eq('id', targetMosqueId)
    .maybeSingle<MosquePolicyRow>();

  if (targetRes.error || !targetRes.data) {
    return {
      targetMosque: null,
      assignedMosques: [] as LocalAdminPolicyMosque[],
      error: targetRes.error ?? new Error('Selected mosque could not be found.'),
    };
  }

  const assignmentRes = await client.from('mosque_admins').select('mosque_id').eq('user_id', userId);
  if (assignmentRes.error) {
    return {
      targetMosque: mapMosquePolicyRow(targetRes.data),
      assignedMosques: [] as LocalAdminPolicyMosque[],
      error: assignmentRes.error,
    };
  }

  const assignedIds = Array.from(
    new Set((assignmentRes.data ?? []).map((row: { mosque_id?: string | null }) => row.mosque_id).filter(Boolean))
  ) as string[];

  if (!assignedIds.length) {
    return {
      targetMosque: mapMosquePolicyRow(targetRes.data),
      assignedMosques: [] as LocalAdminPolicyMosque[],
      error: null,
    };
  }

  const assignedRes = await client
    .from('mosques')
    .select('id, name, allow_multi_mosque_local_admins')
    .in('id', assignedIds);

  if (assignedRes.error) {
    return {
      targetMosque: mapMosquePolicyRow(targetRes.data),
      assignedMosques: [] as LocalAdminPolicyMosque[],
      error: assignedRes.error,
    };
  }

  return {
    targetMosque: mapMosquePolicyRow(targetRes.data),
    assignedMosques: (assignedRes.data ?? []).map((row) => mapMosquePolicyRow(row as MosquePolicyRow)),
    error: null,
  };
}
