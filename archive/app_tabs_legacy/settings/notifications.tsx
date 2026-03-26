import { router } from 'expo-router';
import { View } from 'react-native';
import { Appbar, Text } from 'react-native-paper';

export default function NotificationsScreen() {
  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Notifications" />
      </Appbar.Header>

      <View style={{ padding: 16 }}>
        <Text>Configure reminder and Adhan notification preferences.</Text>
      </View>
    </>
  );
}
