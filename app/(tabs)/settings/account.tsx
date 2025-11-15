import { router } from 'expo-router';
import { View } from 'react-native';
import { Appbar, Text } from 'react-native-paper';

export default function AccountScreen() {
  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Account Settings" />
      </Appbar.Header>

      <View style={{ padding: 16 }}>
        <Text>Email, display name and account info will appear here.</Text>
      </View>
    </>
  );
}
