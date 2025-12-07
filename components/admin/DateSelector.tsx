import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

type Props = {
  date: Date;
  onChange: (d: Date) => void;
};

export function DateSelector({ date, onChange }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  const adjust = (days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    onChange(next);
  };

  const formatted = date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handlePickerChange = (_: any, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (selected) onChange(selected);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => adjust(-1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
        <Text style={styles.arrowText}>◀</Text>
      </Pressable>
      <View style={styles.dateWrap}>
        <Text style={styles.dateText}>{formatted}</Text>
      </View>
      <Pressable onPress={() => adjust(1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
        <Text style={styles.arrowText}>▶</Text>
      </Pressable>
      <Pressable onPress={() => setShowPicker(true)} style={({ pressed }) => [styles.calendarBtn, pressed && styles.pressed]}>
        <Text style={styles.calendarText}>📅</Text>
      </Pressable>
      {showPicker ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowPicker(false)}>
          <Pressable style={styles.backdrop} onPress={() => setShowPicker(false)} />
          <View style={styles.pickerWrap}>
            <DateTimePicker value={date} onChange={handlePickerChange} mode="date" />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  arrowText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  dateWrap: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  dateText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  calendarBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  calendarText: { fontSize: 18 },
  pressed: { opacity: 0.8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  pickerWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '30%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
});

export default DateSelector;
