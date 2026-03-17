import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

interface MosqueData {
  name: string;
  address: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
}

export default function MosqueOnboardingWizard() {
  const router = useRouter();
  const { session } = useAuth();
  const [step, setStep] = useState(1);
  const [mosqueData, setMosqueData] = useState<MosqueData>({
    name: '',
    address: '',
    city: '',
    country: '',
    timezone: 'Europe/London', // Default for UK
    contact_email: '',
    contact_phone: '',
    website: '',
  });
  const [loading, setLoading] = useState(false);

  const updateMosqueData = (field: keyof MosqueData, value: string | number) => {
    setMosqueData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep1 = () => {
    if (!mosqueData.name.trim() || !mosqueData.address.trim() || !mosqueData.city.trim() || !mosqueData.country.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreateMosque = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    setLoading(true);
    try {
      // Create mosque
      const { data: mosque, error: mosqueError } = await supabase
        .from('mosques')
        .insert([mosqueData])
        .select()
        .single();

      if (mosqueError) throw mosqueError;

      // Assign current user as local admin
      const { error: adminError } = await supabase
        .from('mosque_admins')
        .insert([{
          mosque_id: mosque.id,
          user_id: session.user.id,
          role: 'local_admin'
        }]);

      if (adminError) throw adminError;

      const continueRoute =
        Platform.OS === 'web'
          ? `/admin/mosques/${mosque.id}/prayer-times?onboarding=1`
          : `/(admin)/prayer-times?mosqueId=${mosque.id}&onboarding=1`;

      Alert.alert('Success', 'Mosque created successfully!', [
        { text: 'Continue Setup', onPress: () => router.replace(continueRoute as any) }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create mosque');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>Basic Mosque Information</Text>
      <TextInput
        style={styles.input}
        placeholder="Mosque Name *"
        value={mosqueData.name}
        onChangeText={(value) => updateMosqueData('name', value)}
      />
      <TextInput
        style={styles.input}
        placeholder="Street Address *"
        value={mosqueData.address}
        onChangeText={(value) => updateMosqueData('address', value)}
      />
      <TextInput
        style={styles.input}
        placeholder="City *"
        value={mosqueData.city}
        onChangeText={(value) => updateMosqueData('city', value)}
      />
      <TextInput
        style={styles.input}
        placeholder="Country *"
        value={mosqueData.country}
        onChangeText={(value) => updateMosqueData('country', value)}
      />
      <TextInput
        style={styles.input}
        placeholder="Timezone (e.g., Europe/London)"
        value={mosqueData.timezone}
        onChangeText={(value) => updateMosqueData('timezone', value)}
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>Contact Information</Text>
      <TextInput
        style={styles.input}
        placeholder="Contact Email"
        value={mosqueData.contact_email}
        onChangeText={(value) => updateMosqueData('contact_email', value)}
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Contact Phone"
        value={mosqueData.contact_phone}
        onChangeText={(value) => updateMosqueData('contact_phone', value)}
        keyboardType="phone-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="Website"
        value={mosqueData.website}
        onChangeText={(value) => updateMosqueData('website', value)}
      />
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>Review & Create</Text>
      <View style={styles.review}>
        <Text>Name: {mosqueData.name}</Text>
        <Text>Address: {mosqueData.address}, {mosqueData.city}, {mosqueData.country}</Text>
        <Text>Timezone: {mosqueData.timezone}</Text>
        {mosqueData.contact_email && <Text>Email: {mosqueData.contact_email}</Text>}
        {mosqueData.contact_phone && <Text>Phone: {mosqueData.contact_phone}</Text>}
        {mosqueData.website && <Text>Website: {mosqueData.website}</Text>}
      </View>
      <TouchableOpacity
        style={[styles.button, styles.primaryButton, loading && styles.disabledButton]}
        onPress={handleCreateMosque}
        disabled={loading}
      >
        <Text style={styles.primaryButtonText}>
          {loading ? 'Creating...' : 'Create Mosque'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Create New Mosque</Text>
        <Text style={styles.subtitle}>Step {step} of 3</Text>
      </View>

      <View style={styles.progress}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={[styles.progressStep, step >= s && styles.progressStepActive]} />
        ))}
      </View>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}

      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleBack}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        {step < 3 && (
          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#666' },
  progress: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },
  progressStep: { width: 30, height: 4, backgroundColor: '#ddd', marginHorizontal: 5, borderRadius: 2 },
  progressStepActive: { backgroundColor: '#007AFF' },
  step: { flex: 1 },
  stepTitle: { fontSize: 20, fontWeight: '600', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 15, marginBottom: 15, borderRadius: 8, fontSize: 16 },
  review: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 8, marginBottom: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  button: { paddingVertical: 15, paddingHorizontal: 30, borderRadius: 8, minWidth: 100 },
  primaryButton: { backgroundColor: '#007AFF' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondaryButton: { backgroundColor: '#f0f0f0' },
  secondaryButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  disabledButton: { opacity: 0.5 },
});
