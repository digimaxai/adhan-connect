import { router } from 'expo-router';
import { View } from 'react-native';
import { Appbar, Text } from 'react-native-paper';

export default function ProfileScreen() {
  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Profile" />
      </Appbar.Header>

      <View style={{ padding: 16 }}>
        <Text>User profile details will go here.</Text>
      </View>
    </>
  );
}
