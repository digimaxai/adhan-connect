import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';

export function HapticTab(props: BottomTabBarButtonProps) {
  const selected = props.accessibilityState?.selected ?? false;
  const scale = useRef(new Animated.Value(selected ? 1 : 0.96)).current;
  const translateY = useRef(new Animated.Value(selected ? -1 : 0)).current;

  const animateTo = useCallback((nextScale: number, nextTranslateY: number) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: nextScale,
        damping: 16,
        stiffness: 260,
        mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: nextTranslateY,
        damping: 18,
        stiffness: 260,
        mass: 0.7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, translateY]);

  useEffect(() => {
    animateTo(selected ? 1 : 0.96, selected ? -1 : 0);
  }, [animateTo, selected]);

  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        animateTo(0.92, 0);
        if (Platform.OS === 'ios') {
          void Haptics.selectionAsync().catch(() => undefined);
        }
        props.onPressIn?.(ev);
      }}
      onPressOut={(ev) => {
        animateTo(selected ? 1 : 0.96, selected ? -1 : 0);
        props.onPressOut?.(ev);
      }}
    >
      <Animated.View
        style={[
          styles.content,
          { transform: [{ translateY }, { scale }] },
        ]}
      >
        {props.children}
      </Animated.View>
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
