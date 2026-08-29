import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { getPendingAuthEmail, clearPendingAuthEmail } from '../../lib/authFlowState';
import * as Location from 'expo-location';

export default function SignUpStep2Screen() {
  const router = useRouter();
  const { session } = useAuth();

  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [autoDetectCity, setAutoDetectCity] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const email = getPendingAuthEmail();

  useEffect(() => {
    if (!session?.user?.id) {
      router.replace('/sign-up' as any);
      return;
    }
    requestLocationPermission();
  }, [session?.user?.id]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setLatitude(location.coords.latitude);
        setLongitude(location.coords.longitude);

        try {
          const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });

          if (reverseGeocode.length > 0) {
            const cityName = reverseGeocode[0].city || reverseGeocode[0].region || 'Unknown';
            setAutoDetectCity(cityName);
            setCity(cityName);
          }
        } catch {
          setAutoDetectCity('Location detected (city unknown)');
        }
      } else {
        setAutoDetectCity(null);
      }
    } catch {
      setAutoDetectCity(null);
    } finally {
      setDetectingLocation(false);
    }
  };

  const validateUsername = () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Enter a username');
      return false;
    }
    if (trimmed.length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setError('Username can only contain letters, numbers, dashes, and underscores');
      return false;
    }
    return true;
  };

  const validateCity = () => {
    const trimmed = city.trim();
    if (!trimmed) {
      setError('Select or enter a city');
      return false;
    }
    return true;
  };

  const submit = async () => {
    setError(null);
    if (!validateUsername() || !validateCity()) return;

    setBusy(true);
    try {
      const { error: usernameError } = await supabase
        .from('users')
        .update({
          username: username.trim().toLowerCase(),
          home_city: city.trim(),
          display_name: username.trim(),
          user_location: {
            type: 'home',
            city: city.trim(),
            latitude,
            longitude,
            auto_detected: autoDetectCity !== null,
            switched_at: null,
          },
          signup_completed_steps: {
            step1: true,
            step2: true,
            profile_complete: true,
          },
        })
        .eq('id', session!.user!.id);

      if (usernameError) {
        if (usernameError.message.includes('unique')) {
          setError('This username is already taken');
        } else {
          setError('Could not save profile. Please try again.');
        }
        setBusy(false);
        return;
      }

      clearPendingAuthEmail();
      router.replace('/role-entry' as any);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.subtitle}>Choose a username and your location</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="username-new"
            placeholder="e.g., sarah_uk"
            placeholderTextColor="#94A3B8"
            returnKeyType="next"
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            editable={!busy}
          />

          <Text style={styles.label}>Your City</Text>
          {detectingLocation ? (
            <View style={styles.detectingContainer}>
              <ActivityIndicator color="#0284C7" size="small" />
              <Text style={styles.detectingText}>Detecting your location...</Text>
            </View>
          ) : (
            <>
              {autoDetectCity && (
                <Text style={styles.detectedHint}>Detected: {autoDetectCity}</Text>
              )}
              <TextInput
                autoComplete="address-line2"
                placeholder="e.g., Manchester"
                placeholderTextColor="#94A3B8"
                returnKeyType="done"
                style={styles.input}
                value={city}
                onChangeText={setCity}
                editable={!busy}
              />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={busy || detectingLocation}
            onPress={submit}
            style={({ pressed }) => [
              styles.primaryButton,
              (busy || detectingLocation) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Complete signup</Text>
            )}
          </Pressable>

          <Pressable
            disabled={busy}
            onPress={() => {
              clearPendingAuthEmail();
              router.replace('/sign-in' as any);
            }}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>Back to sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { flexGrow: 1, padding: 16, paddingTop: 40, paddingBottom: 48 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: { color: '#0F172A', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#64748B', marginTop: 5, marginBottom: 18, lineHeight: 20 },
  label: { color: '#334155', fontWeight: '700', marginTop: 12, marginBottom: 7 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 16,
  },
  detectingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 13,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  detectingText: {
    marginLeft: 10,
    color: '#0369A1',
    fontSize: 14,
  },
  detectedHint: {
    color: '#0369A1',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  primaryButton: {
    minHeight: 48,
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.82 },
  error: {
    color: '#B91C1C',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
    lineHeight: 19,
  },
  textButton: { alignSelf: 'center', padding: 10, marginTop: 8 },
  textButtonLabel: { color: '#0284C7', fontWeight: '700', textAlign: 'center' },
});
