export const tokens = {
  color: {
    bg: {
      app: '#F8F9FB',
      surface: '#FFFFFF',
      subtle: '#F9FAFB',
      inverse: '#0F172A',
      tintSoft: '#E0F2FE',
    },
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
      muted: '#94A3B8',
      inverse: '#FFFFFF',
      accent: '#0EA5E9',
    },
    border: {
      subtle: '#E6E8EB',
      muted: '#E2E8F0',
      transparent: 'transparent',
    },
    status: {
      live: '#F53B57',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#0097F7',
    },
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 36,
  },
  radius: {
    sm: 10,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },
  typography: {
    size: {
      xs: 12,
      sm: 13,
      md: 14,
      lg: 16,
      xl: 20,
    },
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
  },
  icon: {
    md: 22,
  },
  tabBar: {
    userHeightIos: 86,
    userHeightAndroid: 78,
    muezzinHeight: 82,
  },
  shadow: {
    card: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  },
} as const;

export type AppTokens = typeof tokens;
