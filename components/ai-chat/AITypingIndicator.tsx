/**
 * AITypingIndicator
 *
 * PURPOSE: Shows animated "Thinking" text while AI is processing a response
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (shown when isProcessing is true)
 *
 * PROPS: None
 *
 * EXAMPLE:
 *   {isProcessing && <AITypingIndicator />}
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

// 2. Expo & Third-party
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// 3. Constants, hooks, types
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
