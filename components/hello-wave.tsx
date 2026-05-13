import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export function HelloWave() {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotation, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(rotation, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      { iterations: 4 }
    ).start();
  }, [rotation]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '25deg'] });

  return (
    <Animated.Text style={{ fontSize: 28, lineHeight: 32, marginTop: -6, transform: [{ rotate }] }}>
      👋
    </Animated.Text>
  );
}
