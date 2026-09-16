import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme/tokens';

/** The one back control used across the app: a round chevron, top-left. */
export function BackButton({ fallbackHref, onPress, tone = 'light' }: { fallbackHref?: string; onPress?: () => void; tone?: 'light' | 'dark' }) {
  const router = useRouter();
  const go = () => {
    if (onPress) return onPress();
    if (router.canGoBack()) router.back();
    else if (fallbackHref) router.replace(fallbackHref as any);
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={go} hitSlop={10} style={({ pressed }) => [styles.btn, tone === 'dark' && styles.btnDark, pressed && styles.pressed]}>
      <Ionicons name="chevron-back" size={22} color={tone === 'dark' ? '#FFFFFF' : tokens.color.text.primary} />
    </Pressable>
  );
}

export function ScreenHeader({ title, subtitle, right, fallbackHref, onBack }: { title: string; subtitle?: string | null; right?: React.ReactNode; fallbackHref?: string; onBack?: () => void }) {
  return (
    <View style={styles.row}>
      <BackButton fallbackHref={fallbackHref} onPress={onBack} />
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tokens.color.border.subtle },
  btnDark: { backgroundColor: 'rgba(15,23,42,0.45)', borderColor: 'transparent' },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  titles: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: tokens.color.text.primary },
  subtitle: { fontSize: 13, color: tokens.color.text.secondary, marginTop: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
