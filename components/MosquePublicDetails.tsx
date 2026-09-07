import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { safeSourceUrl } from '../lib/mosqueAssistant/core';

type Details = Partial<Record<'website' | 'contact_phone' | 'contact_email' | 'management_info' | 'services_info' | 'address_line1' | 'address_line2' | 'postcode', string | null>>;
/** Published values only. Draft scan tables are never accessible to this component. */
export default function MosquePublicDetails({ mosqueId }: { mosqueId: string | null }) {
  const [details, setDetails] = useState<Details | null>(null);
  useEffect(() => {
    let active = true; setDetails(null);
    if (mosqueId) void supabase.from('mosques').select('website,contact_phone,contact_email,management_info,services_info,address_line1,address_line2,postcode').eq('id', mosqueId).maybeSingle().then(({ data, error }) => {
      // Older deployments without the extension keep their existing mosque screen.
      if (active && !error) setDetails(data);
    });
    return () => { active = false; };
  }, [mosqueId]);
  if (!details || !Object.values(details).some(Boolean)) return null;
  const website = details.website ? safeSourceUrl(details.website) : null;
  const address = [details.address_line1, details.address_line2, details.postcode].filter(Boolean).join(', ');
  return <View style={styles.card}>
    <Text style={styles.title}>Mosque information</Text>
    {!!address && <Text selectable style={styles.text}>{address}</Text>}
    {!!details.contact_phone && <Text selectable style={styles.text}>Phone: {details.contact_phone}</Text>}
    {!!details.contact_email && <Text selectable style={styles.text}>Email: {details.contact_email}</Text>}
    {website && <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(website).catch(() => {}); }}><Text style={styles.link}>{website}</Text></Pressable>}
    {!!details.services_info && <><Text style={styles.heading}>Services</Text><Text selectable style={styles.text}>{details.services_info}</Text></>}
    {!!details.management_info && <><Text style={styles.heading}>Management</Text><Text selectable style={styles.text}>{details.management_info}</Text></>}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  heading: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 8 },
  text: { fontSize: 14, lineHeight: 21, color: '#475569' },
  link: { fontSize: 14, lineHeight: 21, color: '#0f766e', textDecorationLine: 'underline' },
});
