import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { tokens } from '../../theme/tokens';
import { AppText } from './app-text';

type AppButtonVariant = 'primary' | 'secondary' | 'ghost';

type AppButtonProps = PressableProps & {
  title: string;
  variant?: AppButtonVariant;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  title,
  variant = 'primary',
  style,
  disabled,
  ...props
}: AppButtonProps) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        style,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <AppText variant="body" color={textColors[variant]} style={styles.label}>
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: tokens.typography.weight.extrabold,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.55,
  },
});

const variantStyles: Record<AppButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: tokens.color.status.info,
  },
  secondary: {
    backgroundColor: tokens.color.bg.tintSoft,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.color.border.muted,
  },
};

const textColors: Record<AppButtonVariant, string> = {
  primary: tokens.color.text.inverse,
  secondary: '#0369A1',
  ghost: tokens.color.text.primary,
};
