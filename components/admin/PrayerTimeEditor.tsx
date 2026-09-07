import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { tokens } from '@/theme/tokens';

type TimePair = { adhan: string | null; iqama: string | null };

interface PrayerTimeEditorProps {
  prayerName: string;
  displayName: string;
  times: TimePair;
  isNotOffered: boolean;
  reason: string;
  onTimesChange: (times: TimePair) => void;
  onNotOfferedChange: (isNotOffered: boolean, reason: string) => void;
  onReasonChange: (reason: string) => void;
  isSavingReason?: boolean;
}

export function PrayerTimeEditor({
  prayerName,
  displayName,
  times,
  isNotOffered,
  reason,
  onTimesChange,
  onNotOfferedChange,
  onReasonChange,
  isSavingReason,
}: PrayerTimeEditorProps) {
  const [pickerState, setPickerState] = useState<'adhan' | 'iqama' | null>(null);
  const [tempValue, setTempValue] = useState<Date | null>(null);
  const [showReason, setShowReason] = useState(isNotOffered);

  const openTimePicker = (field: 'adhan' | 'iqama') => {
    setPickerState(field);
    const current = field === 'adhan' ? times.adhan : times.iqama;
    if (current) {
      const [h, m] = current.split(':').map((x) => parseInt(x, 10));
      const d = new Date();
      d.setHours(h, m, 0, 0);
      setTempValue(d);
    } else {
      setTempValue(new Date());
    }
  };

  const handleTimePicked = (_: any, selected?: Date) => {
    if (Platform.OS !== 'ios') setPickerState(null);
    if (!selected || !pickerState) return;

    const hh = selected.getHours().toString().padStart(2, '0');
    const mm = selected.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    onTimesChange({
      ...times,
      [pickerState]: timeStr,
    });
  };

  const handleNotOfferedToggle = (nowNotOffered: boolean) => {
    setShowReason(nowNotOffered);
    onNotOfferedChange(nowNotOffered, nowNotOffered ? reason : '');
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{displayName}</Text>
        {isNotOffered && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Not offered</Text>
          </View>
        )}
      </View>

      {!isNotOffered ? (
        <>
          {/* Adhan Time */}
          <View style={styles.row}>
            <Text style={styles.label}>Adhan</Text>
            <Pressable
              onPress={() => openTimePicker('adhan')}
              style={({ pressed }) => [
                styles.timeBtn,
                pressed && styles.timeBtnPressed,
              ]}
            >
              <Text style={styles.timeText}>
                {times.adhan ?? '--:--'}
              </Text>
            </Pressable>
          </View>

          {/* Iqama Time */}
          <View style={styles.row}>
            <Text style={styles.label}>Iqama</Text>
            <Pressable
              onPress={() => openTimePicker('iqama')}
              style={({ pressed }) => [
                styles.timeBtn,
                pressed && styles.timeBtnPressed,
              ]}
            >
              <Text style={styles.timeText}>
                {times.iqama ?? '--:--'}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.notOfferedPlaceholder}>
          <Ionicons
            name="checkmark-circle-outline"
            size={20}
            color={tokens.color.status.success}
          />
          <Text style={styles.notOfferedText}>
            Congregation not held at this location
          </Text>
        </View>
      )}

      {/* Not Offered Toggle */}
      <View style={styles.divider} />
      <Pressable
        onPress={() => handleNotOfferedToggle(!isNotOffered)}
        style={({ pressed }) => [
          styles.toggleRow,
          pressed && styles.toggleRowPressed,
        ]}
      >
        <Text style={styles.toggleLabel}>Mark as not offered</Text>
        <View
          style={[
            styles.checkbox,
            isNotOffered && styles.checkboxChecked,
          ]}
        >
          {isNotOffered && (
            <Ionicons
              name="checkmark"
              size={14}
              color={tokens.color.bg.surface}
              style={{ fontWeight: '700' }}
            />
          )}
        </View>
      </Pressable>

      {/* Reason Input (shown when not offered) */}
      {showReason && (
        <View style={styles.reasonSection}>
          <Text style={styles.reasonLabel}>
            Why is this prayer not offered? (visible to listeners)
          </Text>
          <TextInput
            multiline
            maxLength={500}
            placeholder="Explain briefly, e.g. Service held at sister location only"
            placeholderTextColor={tokens.color.text.muted}
            value={reason}
            onChangeText={onReasonChange}
            editable={!isSavingReason}
            style={styles.reasonInput}
          />
          <Text style={styles.charCount}>
            {reason.length}/500
          </Text>
          {reason.trim() && (
            <View style={styles.preview}>
              <Text style={styles.previewLabel}>
                Listeners will see:
              </Text>
              <Text style={styles.previewText}>
                “{reason}”
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Time Picker Modal */}
      {pickerState && tempValue ? (
        <DateTimePicker
          value={tempValue}
          mode="time"
          onChange={handleTimePicked}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EDEFF2',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  label: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },
  timeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    minWidth: 80,
    alignItems: 'center',
  },
  timeBtnPressed: {
    opacity: 0.8,
  },
  timeText: {
    fontWeight: '800',
    color: '#0F172A',
    fontSize: 14,
  },
  notOfferedPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  notOfferedText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  toggleRowPressed: {
    opacity: 0.7,
  },
  toggleLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  reasonSection: {
    paddingTop: 12,
    gap: 8,
  },
  reasonLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    color: '#0F172A',
    fontSize: 14,
    fontFamily: 'System',
  },
  charCount: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'right',
  },
  preview: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderLeftWidth: 3,
    borderLeftColor: '#0F172A',
    gap: 4,
  },
  previewLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  previewText: {
    color: '#0F172A',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
