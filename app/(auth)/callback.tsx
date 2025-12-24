// app/(auth)/callback.tsx
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

type Status = 'idle' | 'working' | 'done' | 'error';

function parseFragment(fragment: string | null | undefined) {
  const result: Record<string, string> = {};
  if (!fragment) return result;

  const parts = fragment.split('&');
  for (const part of parts) {
    const [rawKey, rawVal] = part.split('=');
    if (!rawKey) continue;
    const key = decodeURIComponent(rawKey);
    const val = rawVal ? decodeURIComponent(rawVal) : '';
    result[key] = val;
  }
  return result;
}

function getParams(url: string | null) {
  if (!url) return {};

  const parsed = Linking.parse(url);
  const qp = (parsed.queryParams ?? {}) as Record<string, string | undefined>;

  // Some Supabase flows put tokens in the URL fragment (#...)
  // e.g. exp://.../callback#access_token=...&refresh_token=...
  const hashIndex = url.indexOf('#');
  if (hashIndex !== -1) {
    const fragment = url.substring(hashIndex + 1);
    const fragParams = parseFragment(fragment);
    for (const [k, v] of Object.entries(fragParams)) {
      qp[k] = v;
    }
  }

  return qp;
}

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [debugUrl, setDebugUrl] = useState<string | null>(null);
  const [debugParams, setDebugParams] = useState<Record<string, string | undefined> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function handleUrl(url: string | null) {
      if (!mounted || !url) return;
      setStatus('working');
      setDebugUrl(url);

      try {
        const params = getParams(url);
        setDebugParams(params);

        const code = params.code; // PKCE / OAuth
        const token_hash = params.token_hash || params.token; // OTP links (incl. recovery)
        const rawType = (params.type || '') as
          | 'signup'
          | 'recovery'
          | 'magiclink'
          | 'email_change'
          | 'invite'
          | '';
        const type = rawType.toLowerCase();
        const isRecovery = type === 'recovery';

        const access_token = params.access_token;
        const refresh_token = params.refresh_token;
        // Some Supabase flows supply a short-lived recovery access token in the fragment; if present, prefer it.
        const otpAccessToken = params.access_token ?? params?.access_token;
        const otpRefreshToken = params.refresh_token ?? params?.refresh_token;

        const error = params.error;
        const error_description = params.error_description;

        // If Supabase sent an explicit error, surface that
        if (error || error_description) {
          throw new Error(
            error_description ||
              error ||
              'Link is invalid or has expired. Please request a new one.'
          );
        }

        // --- Primary token-based flows ---
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
        } else if (token_hash && type) {
          const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash, type: rawType as any });
          if (otpErr) throw otpErr;
        } else if ((access_token && refresh_token) || (otpAccessToken && otpRefreshToken)) {
          const { error: sessErr } = await supabase.auth.setSession({
            access_token: access_token ?? otpAccessToken!,
            refresh_token: refresh_token ?? otpRefreshToken!,
          });
          if (sessErr) throw sessErr;
        } else if (type === 'signup') {
          // Special case: email confirmed but no session tokens (email verified but not signed in)
          if (!mounted) return;
          setStatus('done');
          router.replace('/sign-in' as any);
          return;
        } else {
          // No error and no tokens -> unexpected URL
          throw new Error('No auth code or token found in callback URL.');
        }

        if (!mounted) return;
        setStatus('done');

        // Route based on recovery vs normal auth
        if (isRecovery) {
          router.replace('/new-password' as any);
        } else {
          router.replace('/(tabs)' as any);
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? 'Failed to complete sign-in.');
        setStatus('error');
      }
    }

    // Cold start
    Linking.getInitialURL().then(handleUrl);
    // Already-open app
    const sub = Linking.addEventListener('url', (evt) => handleUrl(evt.url));

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      {status !== 'error' ? (
        <>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 12 }}>
            {status === 'working' && 'Completing sign-in...'}
            {status === 'idle' && 'Waiting for callback...'}
            {status === 'done' && 'Signed in. Redirecting...'}
          </Text>
          {__DEV__ && (
            <View style={{ marginTop: 12 }}>
              <Text selectable style={{ fontSize: 12, color: '#0f172a' }}>
                Raw URL: {debugUrl ?? 'none'}
              </Text>
              <Text selectable style={{ fontSize: 12, color: '#0f172a', marginTop: 4 }}>
                Params: {JSON.stringify(debugParams ?? {})}
              </Text>
            </View>
          )}
        </>
      ) : (
        <Text style={{ color: 'red', textAlign: 'center' }}>{err}</Text>
      )}
    </View>
  );
}
