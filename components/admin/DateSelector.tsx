import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppText } from '@/components/ui/app-text';
import { tokens } from '@/theme/tokens';

type Props = {
  date: Date;
  onChange: (d: Date) => void;
};

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
      <View style={styles.dateWrap}>
        <AppText variant="caption" style={styles.dateLabel}>
          Current date
        </AppText>
        <AppText variant="body" style={styles.dateText}>
          {formatted}
        </AppText>
      </View>
      <View style={styles.controlsRow}>
        <Pressable onPress={() => adjust(-1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
          <AppText variant="title" style={styles.arrowText}>
            {'<'}
          </AppText>
        </Pressable>
        <Pressable onPress={openPicker} style={({ pressed }) => [styles.calendarBtn, pressed && styles.pressed]}>
          <AppText variant="caption" style={styles.calendarText}>
            Pick Date
          </AppText>
        </Pressable>
        <Pressable onPress={() => adjust(1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
          <AppText variant="title" style={styles.arrowText}>
            {'>'}
          </AppText>
        </Pressable>
      </View>
      {showPicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={normalizeDate(tempDate ?? safeDate)}
          onChange={handlePickerChange}
          mode="date"
          display="default"
        />
      ) : null}
      {showPicker && Platform.OS === 'ios' ? (
        <Modal transparent animationType="fade" visible onRequestClose={handleCancel}>
          <Pressable style={styles.backdrop} onPress={handleCancel} />
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={normalizeDate(tempDate ?? safeDate)}
              onChange={handlePickerChange}
              mode="date"
              display="spinner"
              textColor="#0F172A"
              themeVariant="light"
              accentColor="#0EA5E9"
              style={styles.iosPicker}
            />
            <View style={styles.actions}>
              <Pressable onPress={handleCancel} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
                <AppText variant="body" style={styles.actionText}>
                  Cancel
                </AppText>
              </Pressable>
              <Pressable onPress={handleConfirm} style={({ pressed }) => [styles.actionBtnPrimary, pressed && styles.pressed]}>
                <AppText variant="body" style={[styles.actionText, styles.actionTextPrimary]}>
                  Done
                </AppText>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.xs,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  arrow: {
    flex: 0.8,
    minHeight: 44,
    borderRadius: tokens.radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    lineHeight: 22,
  },
  dateWrap: {
    minHeight: 68,
    paddingVertical: 12,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    justifyContent: 'center',
    gap: 2,
  },
  dateLabel: {
    color: tokens.color.text.secondary,
  },
  dateText: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: tokens.typography.weight.bold,
  },
  calendarBtn: {
    flex: 2.2,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.bg.tintSoft,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarText: {
    color: '#075985',
    fontWeight: tokens.typography.weight.extrabold,
    fontSize: 13,
    lineHeight: 15,
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  pickerWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '30%',
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  iosPicker: {
    height: 220,
    alignSelf: 'stretch',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spacing.sm,
    marginTop: 10,
  },
  actionBtn: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.md,
    backgroundColor: '#E2E8F0',
  },
  actionBtnPrimary: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.md,
    backgroundColor: '#0EA5E9',
  },
  actionText: {
    fontWeight: tokens.typography.weight.bold,
    color: '#0F172A',
  },
  actionTextPrimary: {
    color: '#FFFFFF',
  },
});

export default DateSelector;
