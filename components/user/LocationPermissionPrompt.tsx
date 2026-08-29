import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import { AppButton } from '../ui/app-button';
import { AppCard } from '../ui/app-card';
import { AppText } from '../ui/app-text';
import { tokens } from '../../theme/tokens';

type LocationPermissionPromptProps = {
  loading: boolean;
  onEnable: () => void;
  onSkip: () => void;
};

const BENEFITS = [
  'See nearby mosques the moment you open the app',
  'Get accurate prayer times calculated for exactly where you are',
  "Know the instant a nearby mosque's Adhan goes live",
];

export function LocationPermissionPrompt({ loading, onEnable, onSkip }: LocationPermissionPromptProps) {
  return (
    <AppCard style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: tokens.color.bg.tintSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="location" size={20} color={tokens.color.text.accent} />
        </View>
        <AppText variant="sectionTitle" style={{ flex: 1 }}>
          Find your mosque, faster
        </AppText>
      </View>

      <AppText variant="body" style={{ color: tokens.color.text.secondary, lineHeight: 20 }}>
        Turn on location and we&apos;ll show nearby mosques, calculate accurate prayer times for exactly where you are,
        and let you know the moment a nearby Adhan goes live.
      </AppText>

      <View style={{ gap: 8 }}>
        {BENEFITS.map((benefit) => (
          <View key={benefit} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={tokens.color.status.success}
              style={{ marginTop: 2 }}
            />
            <AppText variant="caption" style={{ flex: 1, color: tokens.color.text.secondary }}>
              {benefit}
            </AppText>
          </View>
        ))}
      </View>

      <View style={{ gap: 8, marginTop: 4 }}>
        <AppButton
          title={loading ? 'Enabling…' : 'Enable Location'}
          onPress={onEnable}
          disabled={loading}
        />
        <AppButton title="Not now" variant="ghost" onPress={onSkip} disabled={loading} />
      </View>

      <AppText variant="caption" style={{ textAlign: 'center', color: tokens.color.text.muted }}>
        You can change this anytime in Settings.
      </AppText>
    </AppCard>
  );
}
