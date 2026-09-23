import React, { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { getDefaultMosqueId, setDefaultMosqueId as persistDefaultMosqueId } from '../../lib/mosquePreferences';
import { supabase } from '../../lib/supabase';
import { ScreenContainer } from '../../components/ui/screen-container';
import { AppCard } from '../../components/ui/app-card';
import { AppText } from '../../components/ui/app-text';
import { AppButton } from '../../components/ui/app-button';

type FollowedMosque = { id: string; name: string; city: string | null };

export default function MyMosqueScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [mosques, setMosques] = useState<FollowedMosque[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const userId = session?.user.id;
      if (!userId) {
        if (active) { setMosques([]); setLoading(false); }
        return;
      }

      const [storedId, subscriptions] = await Promise.all([
        getDefaultMosqueId(userId).catch(() => null),
        supabase.from('subscriptions').select('mosque_id, mosques(id, name, city)').eq('user_id', userId).order('created_at').limit(20),
      ]);
      if (!active) return;
      if (subscriptions.error) {
        setError('Your mosques could not be loaded. Please try again.');
        setLoading(false);
        return;
      }

      const followed = (subscriptions.data ?? []).flatMap((row: any) => {
        const mosque = Array.isArray(row.mosques) ? row.mosques[0] : row.mosques;
        return mosque ? [{ id: mosque.id, name: mosque.name, city: mosque.city ?? null }] : [];
      });
      if (storedId && followed.some((mosque) => mosque.id === storedId)) {
        router.replace({ pathname: '/(user)/mosque/[id]', params: { id: storedId } });
        return;
      }

      setMosques(followed);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [router, session?.user.id]));

  const selectMosque = async (mosque: FollowedMosque) => {
    const userId = session?.user.id;
    if (!userId || savingId) return;
    setSavingId(mosque.id);
    setError(null);
    try {
      await persistDefaultMosqueId(userId, mosque.id, session?.access_token ?? null);
      router.replace({ pathname: '/(user)/mosque/[id]', params: { id: mosque.id } });
    } catch {
      setError('Your selection could not be saved. Please try again.');
      setSavingId(null);
    }
  };

  return (
    <ScreenContainer contentStyle={{ gap: 14 }}>
      <AppText variant="sectionTitle">My Mosque</AppText>
      {loading ? <ActivityIndicator /> : (
        <>
          {!!error && <AppText>{error}</AppText>}
          {mosques.length === 0 ? (
            <AppCard style={{ gap: 12 }}>
              <AppText>You haven’t chosen a mosque yet.</AppText>
              <AppText>Find and follow a mosque, then choose it as My Mosque.</AppText>
              <AppButton title="Find a mosque" onPress={() => router.replace('/(user)/discover')} />
            </AppCard>
          ) : (
            <>
              <AppText>{mosques.length === 1 ? 'Set your followed mosque as My Mosque.' : 'Choose which followed mosque should be My Mosque.'}</AppText>
              {mosques.map((mosque) => (
                <AppCard key={mosque.id} style={{ gap: 8 }}>
                  <AppText>{mosque.name}</AppText>
                  {!!mosque.city && <AppText variant="caption">{mosque.city}</AppText>}
                  <AppButton title={savingId === mosque.id ? 'Saving…' : 'Set as My Mosque'} disabled={!!savingId} onPress={() => { void selectMosque(mosque); }} />
                </AppCard>
              ))}
            </>
          )}
        </>
      )}
    </ScreenContainer>
  );
}
