// components/HeaderActions.tsx
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { IconButton } from 'react-native-paper';
import HeaderAvatar from './HeaderAvatar';

export default function HeaderActions() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <IconButton
        icon="cog"
        size={22}
        onPress={() => router.push('/settings')}
        accessibilityLabel="Settings"
        style={{ marginRight: -4 }}
      />
      <HeaderAvatar />
    </View>
  );
}
