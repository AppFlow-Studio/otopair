/**
 * AI Typing Indicator Component
 * Shows "Thinking" text with blink animation
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BrandColors, Spacing, FontFamily } from '@/constants/theme';

const AnimatedText = Animated.Text;

export function AITypingIndicator() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, {
          duration: 600,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: 600,
          easing: Easing.inOut(Easing.ease),
        })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <AnimatedText style={[styles.thinkingText, animatedStyle]}>
        Thinking
      </AnimatedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  thinkingText: {
    fontSize: 16,
    fontFamily: FontFamily.medium,
    color: BrandColors.secondary,
    letterSpacing: 0.3,
  },
});
