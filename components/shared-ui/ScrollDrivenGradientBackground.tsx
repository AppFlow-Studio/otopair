/**
 * ScrollDrivenGradientBackground
 *
 * PURPOSE: Originally a scroll-driven gradient that swapped colors as the
 *          user scrolled. The transitions on every scroll frame made
 *          scrolling feel laggy on every screen that used this, so it's
 *          been collapsed into a STATIC blue→white gradient that the
 *          entire app shares. The render-prop signature is preserved
 *          (callers still receive a `scrollHandler` and a `scrollY`
 *          shared value) so existing usages compile unchanged — the
 *          handler just records scroll offset without driving anything,
 *          and `scrollY` remains available for parallax/header fades.
 *
 *          The `colors`, `gradientScrollIndices`, and
 *          `scrollPerTransition` props are accepted for backward
 *          compatibility but ignored.
 *
 * USED IN: 9+ screens — home, cars, bookings, settings, payments, etc.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useAnimatedScrollHandler,
  useSharedValue,
  type ScrollHandlerProcessed,
  type SharedValue,
} from 'react-native-reanimated';

// Single shared gradient used across the whole app. Saturated brand
// blue at top fading to near-white at the bottom — gives screens a
// consistent feel without paying the cost of recomputing gradient
// stops on every scroll frame.
const STATIC_GRADIENT: [string, string, string] = ['#86C2E8', '#B0D6F0', '#EAF2FA'];

export interface ScrollDrivenGradientBackgroundProps {
  /** Accepted for backward compat; ignored (the gradient is static now). */
  colors?: string[];
  /** Accepted for backward compat; ignored. */
  gradientScrollIndices?: number[];
  /** Accepted for backward compat; ignored. */
  scrollPerTransition?: number;
  /** Optional external scrollY to sync with other animations. */
  scrollY?: SharedValue<number>;
  children: (
    scrollHandler: ScrollHandlerProcessed<Record<string, unknown>>,
    scrollY: SharedValue<number>
  ) => React.ReactNode;
}

export function ScrollDrivenGradientBackground({
  scrollY: externalScrollY,
  children,
}: ScrollDrivenGradientBackgroundProps) {
  const internalScrollY = useSharedValue(0);
  const scrollY = externalScrollY ?? internalScrollY;

  // No-op handler — still records scroll offset so callers using
  // `scrollY` for header fades / parallax keep working, but no
  // per-frame gradient interpolation runs.
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return (
    <>
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={STATIC_GRADIENT}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children(scrollHandler, scrollY)}
    </>
  );
}
