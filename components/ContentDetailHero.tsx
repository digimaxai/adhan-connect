import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageLoadEventData } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Dimensions, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MIN_HERO_HEIGHT = 200;
const MAX_HERO_HEIGHT = Dimensions.get('window').height * 0.55;
const DEFAULT_HERO_HEIGHT = 240;
const PLACEHOLDER_HEIGHT = 220;

export function ContentDetailHero({
  imageUrl,
  icon,
  title,
  onBack,
  shareTitle,
}: {
  imageUrl: string | null;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title?: string | null;
  onBack: () => void;
  shareTitle?: string | null;
}) {
  const [heroHeight, setHeroHeight] = useState(DEFAULT_HERO_HEIGHT);
  const insets = useSafeAreaInsets();

  const onShare = () => {
    if (!shareTitle) return;
    void Share.share({ message: shareTitle });
  };

  const onImageLoad = (event: ImageLoadEventData) => {
    const { width, height } = event.source;
    if (!width || !height) return;
    const naturalHeight = SCREEN_WIDTH * (height / width);
    setHeroHeight(Math.min(MAX_HERO_HEIGHT, Math.max(MIN_HERO_HEIGHT, naturalHeight)));
  };

  return (
    <View style={[styles.hero, { height: imageUrl ? heroHeight : PLACEHOLDER_HEIGHT }]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          onLoad={onImageLoad}
        />
      ) : (
        <LinearGradient
          colors={[tokens.color.reading.accent, tokens.color.reading.selectedText]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.placeholderContent}>
            <Ionicons name={icon} size={30} color="rgba(255,255,255,0.55)" />
            {title ? (
              <Text style={styles.placeholderTitle} numberOfLines={3}>
                {title}
              </Text>
            ) : null}
          </View>
        </LinearGradient>
      )}
      <LinearGradient
        colors={['rgba(15,23,42,0.6)', 'rgba(15,23,42,0)']}
        style={[styles.topScrim, { height: insets.top + 80 }]}
        pointerEvents="none"
      />
      <View style={[styles.heroOverlay, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <Pressable onPress={onBack} hitSlop={10} style={styles.heroBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        {shareTitle ? (
          <Pressable onPress={onShare} hitSlop={10} style={styles.heroBtn}>
            <Ionicons name="share-outline" size={20} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: tokens.color.reading.accent, overflow: 'hidden' },
  placeholderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  placeholderTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  heroBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15,23,42,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
