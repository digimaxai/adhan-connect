import React from 'react';
import { View, StyleSheet } from 'react-native';

type Props = {
  size?: number;
  backgroundColor?: string;
  iconColor?: string;
  accentColor?: string;
};

export function AppLogo({
  size = 32,
  backgroundColor = '#2DBE7E',
  iconColor = '#F7FFFB',
  accentColor = '#D8FFE8',
}: Props) {
  const radius = size / 2;
  const innerSize = size * 0.68;
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: radius, backgroundColor }]}>
      {/* Crescent */}
      <View
        style={[
          styles.crescentOuter,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: iconColor,
          },
        ]}
      />
      <View
        style={[
          styles.crescentInner,
          {
            width: innerSize * 0.7,
            height: innerSize * 0.7,
            borderRadius: (innerSize * 0.7) / 2,
            backgroundColor: backgroundColor,
          },
        ]}
      />

      {/* Waves */}
      <View
        style={[
          styles.wave,
          {
            borderColor: iconColor,
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: (size * 0.7) / 2,
          },
        ]}
      />
      <View
        style={[
          styles.wave,
          {
            borderColor: iconColor,
            width: size * 0.52,
            height: size * 0.52,
            borderRadius: (size * 0.52) / 2,
          },
        ]}
      />

      {/* Minaret + dome */}
      <View style={[styles.minaret, { backgroundColor: iconColor, width: size * 0.16, height: size * 0.44, bottom: size * 0.12 }]} />
      <View
        style={[
          styles.dome,
          {
            backgroundColor: iconColor,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: size * 0.14,
          },
        ]}
      />
      <View
        style={[
          styles.dot,
          {
            backgroundColor: accentColor,
            width: size * 0.08,
            height: size * 0.08,
            borderRadius: size * 0.04,
            bottom: size * 0.34,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  crescentOuter: {
    position: 'absolute',
    opacity: 0.9,
  },
  crescentInner: {
    position: 'absolute',
    top: '18%',
    right: '10%',
  },
  wave: {
    position: 'absolute',
    borderWidth: 1,
    opacity: 0.55,
  },
  minaret: {
    position: 'absolute',
    borderRadius: 999,
  },
  dome: {
    position: 'absolute',
    bottom: -2,
  },
  dot: {
    position: 'absolute',
  },
});

export default AppLogo;
