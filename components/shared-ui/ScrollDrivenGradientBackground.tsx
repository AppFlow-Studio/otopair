/**
 * ScrollDrivenGradientBackground
 *
 * PURPOSE: Reusable background wrapper that drives `AnimatedGradientBackground` transitions
 *          based on vertical scroll position. Exposes a reanimated `onScroll` handler via
 *          render-props so screens can attach it to an `Animated.ScrollView`.
 *
 * USED IN: components/payments/ActivityRewardsScreen.tsx (and any scroll-based screens)
 *
 * PROPS:
 *   - colors (string[], optional): Gradient colors passed to `AnimatedGradientBackground` (min 2)
 *   - gradientScrollIndices (number[], optional): Indices representing the sequence of 
 *       gradient "stops" while scrolling. These indices are represented in 
 *       AnimatedGradientBackground.tsx, under SHARED_GRADIENT_CONFIGS
 *   - scrollPerTransition (number, optional): Scroll distance (px) per stop transition, from
 *       one index of SHARED_GRADIENT_CONFIGS to the next index
 *   - scrollY (SharedValue<number>, optional): External scrollY shared value to sync with other animations.
 *       If provided, the component will use this instead of creating its own internal scroll tracking.
 *   - children ((scrollHandler) => React.ReactNode): Render prop that receives the scroll handler
 *
 * EXAMPLE:
 *   // Basic usage (internal scroll tracking)
 *   <ScrollDrivenGradientBackground colors={[BrandColors.secondary, BrandColors.secondary, '#f4f1f8']}>
 *     {(scrollHandler) => (
 *       <Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16}>
 *         ...
 *       </Animated.ScrollView>
 *     )}
 *   </ScrollDrivenGradientBackground>
 *
 *   // With external scrollY (syncs with other animations)
 *   const scrollY = useSharedValue(0);
 *   <ScrollDrivenGradientBackground scrollY={scrollY}>
 *     {(scrollHandler) => (
 *       <Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16}>
 *         ...
 *       </Animated.ScrollView>
 *     )}
 *   </ScrollDrivenGradientBackground>
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
  type ScrollHandlerProcessed,
  type SharedValue,
} from 'react-native-reanimated';
import { AnimatedGradientBackground } from './AnimatedGradientBackground';
import { BrandColors } from '@/constants/theme';

// Defaults match `ActivityRewardsScreen` so screens don't need to re-specify these.
const DEFAULT_COLORS: [string, string, string] = [BrandColors.secondary, BrandColors.secondary, '#f4f1f8'];
const DEFAULT_GRADIENT_SCROLL_INDICES = [0, 3, 6, 9];
const DEFAULT_SCROLL_PER_TRANSITION = 300;

type GradientIndices = { from: number; to: number };

export interface ScrollDrivenGradientBackgroundProps {
  /** Gradient colors passed to `AnimatedGradientBackground` (min 2). Defaults to Activity screen scheme. */
  colors?: string[];
  gradientScrollIndices?: number[];
  scrollPerTransition?: number;
  /** Optional external scrollY to sync with other animations. */
  scrollY?: SharedValue<number>;
  children: (scrollHandler: ScrollHandlerProcessed<Record<string, unknown>>) => React.ReactNode;
}

export function ScrollDrivenGradientBackground({
  colors = DEFAULT_COLORS,
  gradientScrollIndices = DEFAULT_GRADIENT_SCROLL_INDICES,
  scrollPerTransition = DEFAULT_SCROLL_PER_TRANSITION,
  scrollY: externalScrollY,
  children,
}: ScrollDrivenGradientBackgroundProps) {
  const bgProgress = useSharedValue(0);
  const internalScrollY = useSharedValue(0);
  const scrollY = externalScrollY ?? internalScrollY;
  const currentSegment = useSharedValue(0);

  const safeIndices = useMemo(() => {
    const filtered = (gradientScrollIndices ?? []).filter((n) => Number.isFinite(n));
    return filtered.length >= 2 ? filtered : DEFAULT_GRADIENT_SCROLL_INDICES;
  }, [gradientScrollIndices]);

  const [gradientIndices, setGradientIndices] = useState<GradientIndices>({
    from: safeIndices[0],
    to: safeIndices[1],
  });

  const updateGradientIndices = useCallback(
    (segmentIndex: number) => {
      const fromIdx = safeIndices[segmentIndex];
      const toIdx = safeIndices[segmentIndex + 1];
      setGradientIndices({ from: fromIdx, to: toIdx });
    },
    [safeIndices]
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const scrollOffset = event.contentOffset.y;
      scrollY.value = scrollOffset;

      const totalTransitions = safeIndices.length - 1;
      const maxScroll = totalTransitions * scrollPerTransition;

      const clampedScroll = Math.max(0, Math.min(scrollOffset, maxScroll));

      const segmentIndex = Math.min(
        Math.floor(clampedScroll / scrollPerTransition),
        totalTransitions - 1
      );

      const segmentStart = segmentIndex * scrollPerTransition;
      bgProgress.value = interpolate(
        clampedScroll,
        [segmentStart, segmentStart + scrollPerTransition],
        [0, 1],
        Extrapolation.CLAMP
      );

      if (segmentIndex !== currentSegment.value) {
        currentSegment.value = segmentIndex;
        runOnJS(updateGradientIndices)(segmentIndex);
      }
    },
  });

  return (
    <>
      <View style={StyleSheet.absoluteFill}>
        <AnimatedGradientBackground
          progress={bgProgress}
          fromIndex={gradientIndices.from}
          toIndex={gradientIndices.to}
          colors={colors}
        />
      </View>
      {children(scrollHandler)}
    </>
  );
}

