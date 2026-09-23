import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Tile = {
  icon: string;
  title: string;
  body: string;
  cta: string;
  route: '/(user)/mosque-admin-request' | '/(user)/invite-mosque' | '/(user)/request-mosque';
  accentBg: string;
  accentText: string;
};

const TILES: Tile[] = [
  {
    icon: '🕌',
    title: 'I manage or work here',
    body: "Start the registration now. We'll guide you through it and be in touch within 2 working days.",
    cta: 'Register your mosque',
    route: '/(user)/mosque-admin-request',
    accentBg: '#F0FDF4',
    accentText: '#15803D',
  },
  {
    icon: '✉️',
    title: 'I know who to contact',
    body: "Share the imam's or committee's details and we'll send them a personal introduction to Adhan Connect.",
    cta: 'Send an invitation',
    route: '/(user)/invite-mosque',
    accentBg: '#EFF6FF',
    accentText: '#1D4ED8',
  },
  {
    icon: '🔍',
    title: 'I just know the mosque name',
    body: 'Tell us the name and location and our team will research and reach out on your behalf.',
    cta: 'Ask us to contact them',
    route: '/(user)/request-mosque',
    accentBg: '#F8FAFC',
    accentText: '#475569',
  },
];

export default function MosqueOnboardingHub() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();

  const navigate = (tile: Tile) => {
    router.push({ pathname: tile.route, params: name ? { name } : {} } as any);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ paddingVertical: 12 }}><Text>← Back</Text></Pressable>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MOSQUE ONBOARDING</Text>
          <Text style={styles.title}>
            {name ? `Get "${name}" on Adhan Connect` : 'Get your mosque\non Adhan Connect'}
          </Text>
          <Text style={styles.subtitle}>
            Choose what best describes you and we'll take it from there.
          </Text>
        </View>

        <View style={styles.tiles}>
          {TILES.map((tile) => (
            <Pressable
              key={tile.route}
              accessibilityRole="button"
              onPress={() => navigate(tile)}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            >
              <View style={[styles.iconBox, { backgroundColor: tile.accentBg }]}>
                <Text style={styles.icon}>{tile.icon}</Text>
              </View>
              <View style={styles.tileCopy}>
                <Text style={styles.tileTitle}>{tile.title}</Text>
                <Text style={styles.tileBody}>{tile.body}</Text>
              </View>
              <View style={[styles.ctaBadge, { backgroundColor: tile.accentBg }]}>
                <Text style={[styles.ctaText, { color: tile.accentText }]}>{tile.cta} →</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={styles.footnote}>
          Adhan Connect is free for mosques. There is no sign-up fee or commitment.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  body: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },

  header: { gap: 6, paddingVertical: 18 },
  eyebrow: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.2 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '900', color: '#0F172A', letterSpacing: -0.7, marginTop: 4 },
  subtitle: { fontSize: 14, lineHeight: 21, color: '#64748B', fontWeight: '500', marginTop: 4 },

  tiles: { gap: 12, marginTop: 8 },
  tile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tilePressed: { opacity: 0.87, transform: [{ scale: 0.992 }] },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 24 },
  tileCopy: { gap: 5 },
  tileTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', lineHeight: 22 },
  tileBody: { fontSize: 13, lineHeight: 19, color: '#64748B', fontWeight: '500' },
  ctaBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  ctaText: { fontSize: 13, fontWeight: '800' },

  footnote: { marginTop: 24, fontSize: 12, color: '#94A3B8', textAlign: 'center', fontWeight: '500' },
});
