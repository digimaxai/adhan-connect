/**
 * Shared profile fetching utility to consolidate duplicated queries
 * across coverRequests, muezzins, and schedule modules.
 */

import { supabase } from '@/lib/supabase';

export type ProfileLookup = {
  id: string;
  full_name?: string;
  display_name?: string;
  email?: string;
};

/**
 * Fetch profiles by user IDs and return full profile objects
 * Deduplicates input IDs to minimize queries
 */
export async function fetchProfiles(
  userIds: string[]
): Promise<Record<string, ProfileLookup>> {
  if (!userIds.length) return {};

  const uniqueIds = Array.from(new Set(userIds));
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, email')
    .in('id', uniqueIds);

  if (error && error.code !== 'PGRST116') {
    console.warn('[fetchProfiles]', error);
    return {};
  }

  const map: Record<string, ProfileLookup> = {};
  (data ?? []).forEach((row: any) => {
    map[row.id] = row;
  });
  return map;
}

/**
 * Fetch profiles by user IDs and return display name map
 * Returns display_name, falling back to full_name, then email, then ID
 */
export async function fetchProfileNames(
  userIds: string[]
): Promise<Record<string, string>> {
  if (!userIds.length) return {};

  const profiles = await fetchProfiles(userIds);
  const nameMap: Record<string, string> = {};

  Object.entries(profiles).forEach(([id, profile]) => {
    nameMap[id] = profile.display_name ?? profile.full_name ?? profile.email ?? id;
  });

  return nameMap;
}

/**
 * Get display name for a single profile
 */
export function displayNameForProfile(profile?: ProfileLookup | null): string {
  return profile?.display_name ?? profile?.full_name ?? profile?.email ?? 'User';
}
