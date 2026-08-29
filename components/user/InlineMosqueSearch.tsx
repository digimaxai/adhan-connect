import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { searchMosques, type MosqueSearchLocation, type MosqueSearchRow } from '../../lib/api/mosqueSearch';
import { AppButton } from '../ui/app-button';
import { AppCard } from '../ui/app-card';
import { AppText } from '../ui/app-text';
import { tokens } from '../../theme/tokens';

type InlineMosqueSearchProps = {
  userLocation: MosqueSearchLocation | null;
};

const RESULT_LIMIT = 5;
const SEARCH_DEBOUNCE_MS = 220;

export function InlineMosqueSearch({ userLocation }: InlineMosqueSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MosqueSearchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      searchMosques(query, userLocation)
        .then((rows) => { if (!cancelled) setResults(rows); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, SEARCH_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, userLocation]);

  const visibleResults = results.slice(0, RESULT_LIMIT);
  const showNoResults = !loading && results.length === 0;

  const openMosque = (mosque: MosqueSearchRow) => {
    router.push({
      pathname: '/(user)/mosque/[id]',
      params: { id: mosque.id, name: mosque.name, city: mosque.city ?? '', country: mosque.country ?? '' },
    } as any);
  };

  return (
    <AppCard style={{ gap: 12 }}>
      <View>
        <AppText variant="sectionTitle">Find your mosque</AppText>
        <AppText variant="caption" style={{ color: tokens.color.text.secondary, marginTop: 2 }}>
          Search by name, postcode, or area
        </AppText>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. East London Mosque, or SW1A"
        placeholderTextColor={tokens.color.text.muted}
        style={{
          backgroundColor: tokens.color.bg.subtle,
          borderRadius: tokens.radius.md,
          borderWidth: 1,
          borderColor: tokens.color.border.muted,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: tokens.typography.size.md,
          color: tokens.color.text.primary,
        }}
      />

      {loading ? (
        <AppText variant="caption" style={{ color: tokens.color.text.muted }}>
          Searching…
        </AppText>
      ) : null}

      {!loading && visibleResults.length > 0 && (
        <View style={{ gap: 8 }}>
          {visibleResults.map((mosque) => (
            <Pressable
              key={mosque.id}
              onPress={() => openMosque(mosque)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: tokens.radius.md,
                backgroundColor: pressed ? tokens.color.bg.subtle : 'transparent',
                borderWidth: 1,
                borderColor: tokens.color.border.subtle,
              })}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="body" numberOfLines={1}>
                  {mosque.name}
                </AppText>
                {mosque.city || mosque.country ? (
                  <AppText variant="caption" style={{ color: tokens.color.text.secondary }} numberOfLines={1}>
                    {[mosque.city, mosque.country].filter(Boolean).join(', ')}
                  </AppText>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={tokens.color.text.muted} />
            </Pressable>
          ))}
        </View>
      )}

      <Pressable onPress={() => router.push('/(user)/discover')} hitSlop={8}>
        <AppText variant="body" color={tokens.color.text.accent} style={{ fontWeight: '700' }}>
          See all mosques →
        </AppText>
      </Pressable>

      {showNoResults && (
        <View
          style={{
            marginTop: 4,
            gap: 10,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: tokens.color.border.subtle,
          }}
        >
          <AppText variant="body" style={{ fontWeight: '700' }}>
            Can&apos;t find your mosque?
          </AppText>
          <AppButton
            title="Invite your mosque"
            variant="secondary"
            onPress={() => router.push({ pathname: '/(user)/invite-mosque', params: { name: query } } as any)}
          />
          <AppButton
            title="Ask us to add it"
            variant="ghost"
            onPress={() => router.push({ pathname: '/(user)/request-mosque', params: { name: query } } as any)}
          />
        </View>
      )}
    </AppCard>
  );
}
