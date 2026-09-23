import type { SupabaseClient, User } from '@supabase/supabase-js';
import { ACCOUNT_POLICY_VERSIONS } from '../policies';

type ConsentAccessResult =
  | { granted: true }
  | { granted: false; response: Response };

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasExactCurrentMetadata(user: User) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
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

function consentResponse(
  status: 403 | 503,
  code: 'ACCOUNT_CONSENT_REQUIRED' | 'ACCOUNT_CONSENT_CONTROL_UNAVAILABLE'
) {
  return new Response(
    JSON.stringify({
      error:
        status === 403
          ? 'Complete account setup to continue.'
          : 'Account access is temporarily unavailable.',
      code,
    }),
    {
      status,
      headers: {
        'Cache-Control': 'no-store, private',
        'Content-Type': 'application/json; charset=utf-8',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}

/**
 * Authorizes signed-in product features only when both the Auth user metadata
 * and the immutable server receipt show the exact current policy state.
 * Account-rights endpoints intentionally do not use this gate.
 */
export async function requireCurrentAccountConsent(
  supabaseAdmin: SupabaseClient<any, any, any>,
  authUser: User
): Promise<ConsentAccessResult> {
  if (!hasExactCurrentMetadata(authUser)) {
    return {
      granted: false,
      response: consentResponse(403, 'ACCOUNT_CONSENT_REQUIRED'),
    };
  }

  type ConsentReceipt = {
    id: string;
    terms_accepted_at: string | null;
    privacy_acknowledged_at: string | null;
    special_category_consented_at: string | null;
    age_16_or_over_confirmed_at: string | null;
  };
  let data: ConsentReceipt | null = null;
  try {
    const result = await supabaseAdmin
      .from('account_consents')
      .select(
        'id, terms_accepted_at, privacy_acknowledged_at, special_category_consented_at, age_16_or_over_confirmed_at'
      )
      .eq('user_id', authUser.id)
      .eq('receipt_schema_version', 1)
      .eq('terms_version', ACCOUNT_POLICY_VERSIONS.terms)
      .eq('privacy_version', ACCOUNT_POLICY_VERSIONS.privacy)
      .eq(
        'special_category_consent_version',
        ACCOUNT_POLICY_VERSIONS.specialCategory
      )
      .eq('age_gate_version', ACCOUNT_POLICY_VERSIONS.ageGate)
      .is('special_category_withdrawn_at', null)
      .limit(1)
      .maybeSingle<ConsentReceipt>();
    if (result.error) {
      return {
        granted: false,
        response: consentResponse(
          503,
          'ACCOUNT_CONSENT_CONTROL_UNAVAILABLE'
        ),
      };
    }
    data = result.data;
  } catch {
    return {
      granted: false,
      response: consentResponse(
        503,
        'ACCOUNT_CONSENT_CONTROL_UNAVAILABLE'
      ),
    };
  }

  if (
    !data?.id ||
    !hasText(data.terms_accepted_at) ||
    !hasText(data.privacy_acknowledged_at) ||
    !hasText(data.special_category_consented_at) ||
    !hasText(data.age_16_or_over_confirmed_at)
  ) {
    return {
      granted: false,
      response: consentResponse(403, 'ACCOUNT_CONSENT_REQUIRED'),
    };
  }

  return { granted: true };
}
