import React from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { tokens } from '../../theme/tokens';

type AppCardProps = ViewProps & {
  padded?: boolean;
  subtle?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppCard({ padded = true, subtle = false, style, ...props }: AppCardProps) {
  return (
    <View
      {...props}
      style={StyleSheet.flatten([
        styles.base,
        subtle ? styles.subtle : null,
        padded ? styles.padded : null,
        style,
      ])}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: tokens.color.bg.surface,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  padded: {
    padding: tokens.spacing.md,
  },
  subtle: {
    backgroundColor: tokens.color.bg.subtle,
  },
});
