import { router } from 'expo-router';
import { View } from 'react-native';
import { Appbar, Text } from 'react-native-paper';

export default function MixerScreen() {
  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Volume Mixer" />
      </Appbar.Header>

      <View style={{ padding: 16 }}>
        <Text>Adjust per-mosque Adhan volumes here.</Text>
      </View>
    </>
  );
}
