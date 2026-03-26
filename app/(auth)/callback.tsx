// app/(auth)/callback.tsx
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { requireRoleEntrySelection } from '../../lib/roleEntrySession';

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

function getBrowserUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return window.location.href;
}

function buildCandidateUrls(initialUrl: string | null) {
  const urls = [initialUrl, getBrowserUrl()].filter((value): value is string => Boolean(value));
  return Array.from(new Set(urls));
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
      if (!mounted) return;
      setStatus('working');

      try {
        const candidateUrls = buildCandidateUrls(url);
        let debugSourceUrl: string | null = null;
        let debugSourceParams: Record<string, string | undefined> | null = null;
        let shouldRouteToPasswordSetup = false;
        let handled = false;

        for (const candidateUrl of candidateUrls) {
          const params = getParams(candidateUrl);
          if (!debugSourceUrl) {
            debugSourceUrl = candidateUrl;
            debugSourceParams = params;
          }

          const code = params.code;
          const token_hash = params.token_hash || params.token;
          const rawType = (params.type || '') as
            | 'signup'
            | 'recovery'
            | 'magiclink'
            | 'email_change'
            | 'invite'
            | '';
          const type = rawType.toLowerCase();
          shouldRouteToPasswordSetup = type === 'recovery' || type === 'invite';

          const access_token = params.access_token;
          const refresh_token = params.refresh_token;
          const error = params.error;
          const error_description = params.error_description;

          if (error || error_description) {
            throw new Error(
              error_description ||
                error ||
                'Link is invalid or has expired. Please request a new one.'
            );
          }

          if (code) {
            const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
            if (exErr) throw exErr;
            handled = true;
            debugSourceUrl = candidateUrl;
            debugSourceParams = params;
            break;
          }

          if (token_hash && type) {
            const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash, type: rawType as any });
            if (otpErr) throw otpErr;
            handled = true;
            debugSourceUrl = candidateUrl;
            debugSourceParams = params;
            break;
          }

          if (access_token && refresh_token) {
            const { error: sessErr } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (sessErr) throw sessErr;
            handled = true;
            debugSourceUrl = candidateUrl;
            debugSourceParams = params;
            break;
          }

          if (type === 'signup') {
            setDebugUrl(candidateUrl);
            setDebugParams(params);
            setStatus('done');
            router.replace('/sign-in' as any);
            return;
          }
        }

        setDebugUrl(debugSourceUrl);
        setDebugParams(debugSourceParams);

        if (!handled) {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            throw new Error('No auth code or token found in callback URL.');
          }
        }

        if (!mounted) return;
        setStatus('done');

        // Route based on recovery vs normal auth
        if (shouldRouteToPasswordSetup) {
          router.replace('/new-password' as any);
        } else {
          const { data: sessionData } = await supabase.auth.getSession();
          await requireRoleEntrySelection(sessionData.session?.user?.id ?? null);
          router.replace('/listener-home' as any);
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
