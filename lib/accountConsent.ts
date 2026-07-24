import type { User } from '@supabase/supabase-js';
import { ACCOUNT_POLICY_VERSIONS } from './policies';

type ConsentMetadata = Record<string, unknown>;

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function hasCurrentAccountConsent(user: User | null | undefined) {
  const metadata = (user?.user_metadata ?? {}) as ConsentMetadata;
  return (
    metadata.terms_version === ACCOUNT_POLICY_VERSIONS.terms &&
    hasText(metadata.terms_accepted_at) &&
    metadata.privacy_version === ACCOUNT_POLICY_VERSIONS.privacy &&
    hasText(metadata.privacy_acknowledged_at) &&
    metadata.special_category_consent_version ===
      ACCOUNT_POLICY_VERSIONS.specialCategory &&
    hasText(metadata.special_category_consent_at) &&
    !hasText(metadata.special_category_consent_withdrawn_at) &&
    metadata.age_gate_version === ACCOUNT_POLICY_VERSIONS.ageGate &&
    hasText(metadata.age_16_or_over_confirmed_at)
  );
}

export function buildCurrentAccountConsentMetadata(
  source: 'account_completion' | 'email_signup' | 'social_auth'
) {
  const acceptedAt = new Date().toISOString();
  return {
    terms_version: ACCOUNT_POLICY_VERSIONS.terms,
    terms_accepted_at: acceptedAt,
    privacy_version: ACCOUNT_POLICY_VERSIONS.privacy,
    privacy_acknowledged_at: acceptedAt,
    special_category_consent_version:
      ACCOUNT_POLICY_VERSIONS.specialCategory,
    special_category_consent_at: acceptedAt,
    special_category_consent_withdrawn_at: null,
    age_gate_version: ACCOUNT_POLICY_VERSIONS.ageGate,
    age_16_or_over_confirmed_at: acceptedAt,
    consent_source: source,
  };
}
