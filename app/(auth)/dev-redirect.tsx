// app/(auth)/dev-redirect.tsx
import * as Clipboard from 'expo-clipboard';
import { View, Text, Pressable } from 'react-native';
import { getAuthRedirectUrl } from '../../lib/auth';

export default function DevRedirect() {
  const url = getAuthRedirectUrl();
  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text selectable style={{ fontSize: 16 }}>Current Expo Go redirect URL:</Text>
      <Text selectable style={{ fontSize: 14 }}>{url}</Text>
      <Pressable
        onPress={() => Clipboard.setStringAsync(url)}
        style={{ padding: 12, borderRadius: 8, backgroundColor: '#1A73E8' }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>Copy</Text>
      </Pressable>
      <Text style={{ opacity: 0.7 }}>
        Add this URL in Supabase {'>'} Auth {'>'} URL Configuration {'>'} Additional Redirect URLs (or set
        EXPO_PUBLIC_SUPABASE_REDIRECT_URL).
      </Text>
    </View>
  );
}
