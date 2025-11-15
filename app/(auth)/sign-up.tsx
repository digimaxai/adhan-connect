// app/(auth)/sign-up.tsx
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../lib/auth';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const validate = () => {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return false;
    }
    if (!password || password.length < 6) {
      Alert.alert('Weak password', 'Password should be at least 6 characters.');
      return false;
    }
    return true;
  };

  const onSubmit = async () => {
    if (!validate()) return;

    setBusy(true);
    const { error, needsVerification } = await signUp(
      email.trim(),
      password,
      displayName.trim() || undefined
    );
    setBusy(false);

    if (error) {
      Alert.alert('Sign up failed', error);
      return;
    }

    if (needsVerification) {
      Alert.alert(
        'Verify your email',
        'We’ve sent a confirmation link to your inbox. After verifying, please sign in.'
      );
      router.replace('/sign-in'); // group folders are stripped from the path
    } else {
      // if email confirmation is disabled in your project
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.card}>
        <Text style={s.title}>Create account</Text>
        <Text style={s.subtle}>Join Adhan Connect in seconds</Text>

        <Text style={s.label}>Name (optional)</Text>
        <TextInput
          placeholder="Your name"
          style={s.input}
          value={displayName}
          onChangeText={setDisplayName}
          returnKeyType="next"
        />

        <Text style={s.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          style={s.input}
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
        />

        <Text style={s.label}>Password</Text>
        <TextInput
          placeholder="Minimum 6 characters"
          secureTextEntry
          style={s.input}
          value={password}
          onChangeText={setPassword}
          returnKeyType="done"
        />

        <TouchableOpacity
          style={[s.button, busy && s.buttonDisabled]}
          onPress={onSubmit}
          disabled={busy}
        >
          <Text style={s.buttonText}>{busy ? 'Creating…' : 'Create Account'}</Text>
        </TouchableOpacity>

        <View style={s.row}>
          <Text style={s.subtleSmall}>Already have an account?</Text>
          <Link href="/sign-in" style={s.link}>
            Sign in
          </Link>
        </View>

        <Text style={s.terms}>
          By continuing, you agree to our Terms and acknowledge our Privacy Policy.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: { fontSize: 22, fontWeight: '800' },
  subtle: { color: '#64748B', marginTop: 4, marginBottom: 16 },
  subtleSmall: { color: '#64748B', marginLeft: 8 },
  label: { fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
  },
  button: {
    backgroundColor: '#10B981',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  link: { color: '#0EA5E9', fontWeight: '700', marginLeft: 6 },
  terms: {
    marginTop: 16,
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
});
