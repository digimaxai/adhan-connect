import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

/**
 * Neutral hand-off route. RootNavigator owns the destination so a successful
 * auth method never assumes the listener role.
 */
export default function AuthCompleteScreen() {
  return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" color="#0284C7" />
      <Text style={styles.title}>Opening your workspace…</Text>
      <Text style={styles.helper}>Checking your account access and roles.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  title: { color: '#0F172A', fontWeight: '800', fontSize: 20, marginTop: 16 },
  helper: { color: '#64748B', marginTop: 6, textAlign: 'center' },
});
