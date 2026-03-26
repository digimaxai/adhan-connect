import { router } from 'expo-router';
import { View } from 'react-native';
import { Appbar, Text } from 'react-native-paper';

export default function LocationScreen() {
  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Location Permissions" />
      </Appbar.Header>

      <View style={{ padding: 16 }}>
        <Text>Manage location access and travel mode options.</Text>
      </View>
    </>
  );
}
