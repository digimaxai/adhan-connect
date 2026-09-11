import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AppText } from '../ui/app-text';
export function Choice({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 8 }}>
    <AppText variant="caption">{label}</AppText>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ padding: 14, backgroundColor: '#F1F5F9', borderRadius: 10 }}>
      <AppText>{options.find((o) => o.value === value)?.label ?? 'Select an option'} {open ? '▴' : '▾'}</AppText>
    </Pressable>
    {open && options.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} onPress={() => { onChange(option.value); setOpen(false); }} style={{ padding: 14, borderRadius: 10, backgroundColor: option.value === value ? '#E0F2FE' : '#F8FAFC' }}><AppText>{option.label}</AppText></Pressable>)}
  </View>;
}
export function EnquiryField({ label, value, onChange, multiline = false, maxLength = 120, phone = false }: { label: string; value: string; onChange: (s: string) => void; multiline?: boolean; maxLength?: number; phone?: boolean }) {
  return <View style={{ gap: 6 }}><AppText variant="caption">{label}</AppText><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} maxLength={maxLength} multiline={multiline} keyboardType={phone ? 'phone-pad' : 'default'} style={{ padding: 14, backgroundColor: '#F1F5F9', borderRadius: 10, color: '#0F172A', fontSize: 16, minHeight: multiline ? 110 : 48, textAlignVertical: multiline ? 'top' : 'center' }} /></View>;
}
export function EnquiryError({ message }: { message: string | null }) { return message ? <AppText accessibilityRole="alert" style={{ color: '#B91C1C' }}>{message}</AppText> : null; }
