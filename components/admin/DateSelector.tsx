import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

type Props = {
  date: Date;
  onChange: (d: Date) => void;
};

// Defensive date handling to avoid blank pickers.
function normalizeDate(d?: Date | null) {
  if (!d) return new Date();
  const copy = new Date(d);
  return isNaN(copy.getTime()) ? new Date() : copy;
}

export function DateSelector({ date, onChange }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const safeDate = normalizeDate(date);

  const adjust = (days: number) => {
    const next = normalizeDate(safeDate);
    next.setDate(next.getDate() + days);
    onChange(next);
  };

  const formatted = safeDate.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const openPicker = () => {
    setTempDate(safeDate);
    setShowPicker(true);
  };

  const handlePickerChange = (_: any, selected?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowPicker(false);
      if (selected) {
        setTempDate(selected);
        onChange(selected);
      }
    } else if (selected) {
      setTempDate(selected);
    }
  };

  const handleCancel = () => {
    setShowPicker(false);
    setTempDate(null);
  };

  const handleConfirm = () => {
    if (tempDate) {
      onChange(tempDate);
    } else {
      onChange(safeDate);
    }
    setShowPicker(false);
    setTempDate(null);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => adjust(-1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
        <Text style={styles.arrowText}>{'<'}</Text>
      </Pressable>
      <View style={styles.dateWrap}>
        <Text style={styles.dateText}>{formatted}</Text>
      </View>
      <Pressable onPress={() => adjust(1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
        <Text style={styles.arrowText}>{'>'}</Text>
      </Pressable>
      <Pressable onPress={openPicker} style={({ pressed }) => [styles.calendarBtn, pressed && styles.pressed]}>
        <Text style={styles.calendarText}>Pick</Text>
      </Pressable>
      {showPicker ? (
        <Modal transparent animationType="fade" visible onRequestClose={handleCancel}>
          <Pressable style={styles.backdrop} onPress={handleCancel} />
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={normalizeDate(tempDate ?? safeDate)}
              onChange={handlePickerChange}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            />
            {Platform.OS === 'ios' ? (
              <View style={styles.actions}>
                <Pressable onPress={handleCancel} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
                  <Text style={styles.actionText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleConfirm} style={({ pressed }) => [styles.actionBtnPrimary, pressed && styles.pressed]}>
                  <Text style={[styles.actionText, styles.actionTextPrimary]}>Done</Text>
                </Pressable>
              </View>
            ) : null}
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
  calendarText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
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
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  actionBtnPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#0EA5E9',
  },
  actionText: { fontWeight: '700', color: '#0F172A' },
  actionTextPrimary: { color: '#FFFFFF' },
});

export default DateSelector;
