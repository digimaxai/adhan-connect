import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatJumuahTime, type JumuahSlot } from '../lib/jumuah';

type Props = {
  mosqueName: string;
  slots: JumuahSlot[];
  onPress: () => void;
};

export function HomeJumuahStrip({ mosqueName, slots, onPress }: Props) {
  if (!slots.length) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={`Opens Friday prayer details for ${mosqueName}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.heading}>
          <Ionicons name="calendar-outline" size={17} color="#047857" />
          <Text style={styles.title}>Friday Jumu’ah</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color="#047857" />
      </View>
      {slots.map((slot, index) => (
        <View key={slot.id} style={[styles.slot, index > 0 && styles.separator]}>
          {slots.length > 1 ? <Text style={styles.slotLabel}>{slot.label || `Congregation ${index + 1}`}</Text> : null}
          <View style={styles.times}>
            <View style={styles.timeGroup}>
              <Text style={styles.timeLabel}>PRAYER</Text>
              <Text style={styles.time}>{formatJumuahTime(slot.salah_at) || 'To be confirmed'}</Text>
            </View>
            {slot.khutbah_at ? <View style={styles.khutbah}>
              <Text style={styles.timeLabel}>KHUTBAH</Text>
              <Text style={styles.khutbahTime}>{formatJumuahTime(slot.khutbah_at)}</Text>
            </View> : null}
          </View>
          <View style={styles.venueRow}>
            <Ionicons name="location-outline" size={15} color="#047857" />
            <Text style={styles.venue}>{slot.venue?.trim() || 'Location to be confirmed'}</Text>
          </View>
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#F0FAF5', borderColor: '#CDE9DB', borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, gap: 7 },
  pressed: { opacity: 0.8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  title: { color: '#065F46', fontSize: 14, fontWeight: '700' },
  slot: { gap: 6 },
  separator: { borderTopWidth: 1, borderTopColor: '#CDE9DB', paddingTop: 8 },
  slotLabel: { color: '#047857', fontSize: 12, fontWeight: '600' },
  times: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  timeGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  timeLabel: { color: '#527466', fontSize: 10, letterSpacing: 0.3, fontWeight: '700' },
  time: { color: '#064E3B', fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  khutbah: { flexDirection: 'row', alignItems: 'baseline', gap: 6, borderLeftWidth: 1, borderLeftColor: '#CDE9DB', paddingLeft: 12 },
  khutbahTime: { color: '#325D4B', fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  venueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  venue: { flex: 1, color: '#325D4B', fontSize: 12, lineHeight: 17 },
});
