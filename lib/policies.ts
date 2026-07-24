import * as Linking from 'expo-linking';

/**
 * Policy versions are deliberately stable receipt identifiers. Bump the
 * relevant value only when the published policy or consent wording changes.
 */
export const ACCOUNT_POLICY_VERSIONS = {
  terms: '2026-07-24',
  privacy: '2026-07-24',
  specialCategory: '2026-07-24',
  ageGate: '2026-07-24',
} as const;

export const ACCOUNT_POLICY_URLS = {
  terms: 'https://www.maksums.com/adhan-connect/terms',
  privacy: 'https://www.maksums.com/adhan-connect/privacy',
} as const;

export async function openAccountPolicy(kind: keyof typeof ACCOUNT_POLICY_URLS) {
  const url = ACCOUNT_POLICY_URLS[kind];
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    throw new Error('This policy page could not be opened on this device.');
  }
  await Linking.openURL(url);
}
