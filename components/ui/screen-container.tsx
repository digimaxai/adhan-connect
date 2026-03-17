import React from 'react';
import { Platform, ScrollView, ScrollViewProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';

type ScreenContainerProps = ScrollViewProps & {
  contentStyle?: StyleProp<ViewStyle>;
};

export function ScreenContainer({ children, contentStyle, ...props }: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        {...props}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Platform.OS === 'android' ? tokens.spacing.lg : tokens.spacing.sm },
          contentStyle,
        ]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.bg.app,
  },
  content: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing['3xl'],
    gap: tokens.spacing.lg,
  },
});
