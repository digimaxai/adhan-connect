// app/(auth)/dev-redirect.tsx
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { View, Text, Pressable } from 'react-native';

export default function DevRedirect() {
  const url = Linking.createURL('/auth/callback');
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
        Add this exact URL in Supabase → Auth → URL Configuration → Additional Redirect URLs.
      </Text>
    </View>
  );
}