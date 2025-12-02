import { Platform, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

export default function EventsScreen() {
  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={styles.h1}>Events</Text>
        <Text style={styles.subtle}>Upcoming classes, talks, and livestreams will appear here.</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.placeholder}>No events yet.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#F8FAFC' },
  h1: { fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  subtle: { color: '#64748B', marginTop: 6, fontSize: 13 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  placeholder: { color: '#94A3B8', marginTop: 8 },
});
