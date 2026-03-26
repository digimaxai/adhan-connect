import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Appbar, Button, HelperText, Text, TextInput } from 'react-native-paper';

type LinkStatus = 'checking' | 'ready' | 'error';

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

export default function NewPassword() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>('checking');

  useEffect(() => {
    let mounted = true;

    async function activateRecoverySession() {
      try {
        const candidates = Array.from(
          new Set(
            [await Linking.getInitialURL(), getBrowserUrl()].filter(
              (value): value is string => Boolean(value)
            )
          )
        );

        for (const candidate of candidates) {
          const params = getParams(candidate);
          const code = params.code;
          const rawType = (params.type || '') as
            | 'signup'
            | 'recovery'
            | 'magiclink'
            | 'email_change'
            | 'invite'
            | '';
          const type = rawType.toLowerCase();
          const tokenHash = params.token_hash || params.token;
          const accessToken = params.access_token;
          const refreshToken = params.refresh_token;

          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
            if (mounted) setLinkStatus('ready');
            return;
          }

          if ((type === 'recovery' || type === 'invite') && tokenHash) {
            const { error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: type as 'recovery' | 'invite',
            });
            if (error) throw error;
            if (mounted) setLinkStatus('ready');
            return;
          }

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
            if (mounted) setLinkStatus('ready');
            return;
          }
        }

        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (data.session) {
          setLinkStatus('ready');
          return;
        }

        setErr('This password reset link is invalid or expired. Request a new one.');
        setLinkStatus('error');
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? 'Failed to validate reset link.');
        setLinkStatus('error');
      }
    }

    activateRecoverySession();
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async () => {
    setErr(null);
    if (linkStatus !== 'ready') return;
    if (!pw || pw.length < 8) return setErr('Password must be at least 8 characters.');
    if (pw !== pw2) return setErr('Passwords do not match.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setOk(true);
      setTimeout(() => router.replace('/listener-home' as any), 800);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Set new password" />
      </Appbar.Header>

      <View style={{ padding: 16, gap: 12 }}>
        {linkStatus === 'checking' ? (
          <View style={{ paddingVertical: 12, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator />
            <Text>Validating reset link...</Text>
          </View>
        ) : null}
        <TextInput
          label="New password"
          secureTextEntry
          value={pw}
          onChangeText={setPw}
          autoCapitalize="none"
        />
        <TextInput
          label="Confirm password"
          secureTextEntry
          value={pw2}
          onChangeText={setPw2}
          autoCapitalize="none"
        />
        {!!err && <HelperText type="error" visible>{err}</HelperText>}
        {ok && <Text>Password updated. Redirecting...</Text>}
        <Button
          mode="contained"
          onPress={onSubmit}
          loading={loading}
          disabled={loading || linkStatus !== 'ready'}
        >
          Update password
        </Button>
      </View>
    </View>
  );
}
