// app/(auth)/new-password.tsx
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Appbar, Button, HelperText, Text, TextInput } from 'react-native-paper';

export default function NewPassword() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onSubmit = async () => {
    setErr(null);
    if (!pw || pw.length < 8) return setErr('Password must be at least 8 characters.');
    if (pw !== pw2) return setErr('Passwords do not match.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setOk(true);
      setTimeout(() => router.replace('/(tabs)'), 800);
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
        <TextInput label="New password" secureTextEntry value={pw} onChangeText={setPw} autoCapitalize="none" />
        <TextInput label="Confirm password" secureTextEntry value={pw2} onChangeText={setPw2} autoCapitalize="none" />
        {!!err && <HelperText type="error" visible>{err}</HelperText>}
        {ok && <Text>Password updated. Redirecting…</Text>}
        <Button mode="contained" onPress={onSubmit} loading={loading} disabled={loading}>
          Update password
        </Button>
      </View>
    </View>
  );
}
