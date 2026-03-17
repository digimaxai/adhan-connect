import React from 'react';
import { StyleProp, StyleSheet, Text, TextProps, TextStyle } from 'react-native';
import { tokens } from '../../theme/tokens';

type AppTextVariant =
  | 'body'
  | 'caption'
  | 'label'
  | 'title'
  | 'sectionTitle'
  | 'hero'
  | 'heroSubtle'
  | 'inverse';

type AppTextProps = TextProps & {
  variant?: AppTextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
};

const variantStyles: Record<AppTextVariant, TextStyle> = {
  body: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.color.text.primary,
  },
  caption: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.color.text.secondary,
  },
  label: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.extrabold,
    color: tokens.color.text.accent,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.primary,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.extrabold,
    color: tokens.color.text.primary,
  },
  hero: {
    fontSize: 36,
    fontWeight: '900',
    color: tokens.color.text.inverse,
  },
  heroSubtle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: '#CBD5E1',
  },
  inverse: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.inverse,
  },
};

export function AppText({ variant = 'body', color, style, ...props }: AppTextProps) {
  return <Text {...props} style={StyleSheet.flatten([variantStyles[variant], color ? { color } : null, style])} />;
}
