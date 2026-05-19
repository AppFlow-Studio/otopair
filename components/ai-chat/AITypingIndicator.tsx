/**
 * AITypingIndicator
 *
 * PURPOSE: Spinning starburst + rotating status text shown while Oto is
 *   processing. The text cycles through a curated list every ~1.8s with
 *   a soft fade between strings, giving the chat a richer "AI is doing
 *   something" feel than a silent spinner alone.
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (shown when isProcessing is true)
 *
 * PROPS: None
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { Text } from '@/components/shared-ui';
import { BrandColors, FontFamily, Spacing } from '@/constants/theme';

const SIZE = 28;
const NUM_SPOKES = 14;
const INNER_RADIUS = SIZE * 0.16;
const OUTER_RADIUS = SIZE * 0.46;
const STROKE_WIDTH = 1.6;

// Rotation period between status strings. 1800ms reads as deliberate
// (each phrase has time to land) without feeling sluggish.
const STATUS_INTERVAL_MS = 1800;
const STATUS_FADE_MS = 250;

// Status phrases — written to feel like Oto narrating its own work.
// Mix vehicle-focused, shop-focused, and "thinking" lines for variety.
const STATUSES = [
  "Pulling your vehicle's service history",
  "Checking what's been done recently",
  "Searching for highly-rated mechanics nearby",
  "Finding the best fit for your car",
  "Looking at recent shop availability",
  "Cross-checking your maintenance records",
  "Thinking through the best next step",
  "Lining up what you might need",
] as const;

export function AITypingIndicator() {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const textOpacity = useSharedValue(1);
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    // Continuous rotation — completes a full turn every ~2.4s.
    rotation.value = withRepeat(
      withTiming(360, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );
    // Gentle pulse — 1.0 → 1.12 → 1.0, ~1.6s per cycle.
    scale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  useEffect(() => {
    // Rotating status text: fade out → swap text → fade in. Repeats
    // every STATUS_INTERVAL_MS while the indicator is mounted.
    const interval = setInterval(() => {
      textOpacity.value = withSequence(
        withTiming(0, { duration: STATUS_FADE_MS, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: STATUS_FADE_MS, easing: Easing.in(Easing.ease) }),
      );
      // Swap the displayed string mid-fade so the user never sees both.
      setTimeout(() => {
        setStatusIndex((prev) => (prev + 1) % STATUSES.length);
      }, STATUS_FADE_MS);
    }, STATUS_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const burstStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.burst, burstStyle]}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {Array.from({ length: NUM_SPOKES }).map((_, i) => {
            const angle = (i / NUM_SPOKES) * Math.PI * 2;
            const lengthFactor = 0.88 + Math.sin(i * 1.3) * 0.12;
            const cx = SIZE / 2;
            const cy = SIZE / 2;
            const x1 = cx + Math.cos(angle) * INNER_RADIUS;
            const y1 = cy + Math.sin(angle) * INNER_RADIUS;
            const x2 = cx + Math.cos(angle) * OUTER_RADIUS * lengthFactor;
            const y2 = cy + Math.sin(angle) * OUTER_RADIUS * lengthFactor;
            return (
              <Line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={BrandColors.secondary}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.textWrap, textStyle]}>
        <Text style={styles.statusText} weight="medium" numberOfLines={1}>
          {STATUSES[statusIndex]}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  burst: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    color: "#000000",
    fontFamily: FontFamily.medium,
  },
});
