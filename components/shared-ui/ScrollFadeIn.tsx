/**
 * ScrollFadeIn
 * 
 * PURPOSE: Wraps a child and fades it in when it scrolls into view.
 *          Fades out when scrolled out of view, fades back in when scrolled back.
 * 
 * USAGE:
 *   <ScrollFadeIn scrollY={scrollY}>
 *     <YourSection />
 *   </ScrollFadeIn>
 */

import React, { ReactNode, useRef, useEffect } from 'react';
import { Dimensions, StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  Easing,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// CONFIG
// ============================================================================

const DEFAULT_CONFIG = {
  translateY: 25,     // How far element lifts from
  duration: 500,      // Animation duration in ms
};

// ============================================================================
// TYPES
// ============================================================================

interface ScrollFadeInProps {
  children: ReactNode;
  /** Animated scroll Y value from parent ScrollView */
  scrollY: SharedValue<number>;
  /** How far the element lifts from in pixels (default: 25) */
  translateY?: number;
  /** Animation duration in ms (default: 500) */
  duration?: number;
  /** Container style */
  style?: StyleProp<ViewStyle>;
  /** Disable the animation */
  disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ScrollFadeIn({
  children,
  scrollY,
  translateY: translateYAmount = DEFAULT_CONFIG.translateY,
  duration = DEFAULT_CONFIG.duration,
  style,
  disabled = false,
}: ScrollFadeInProps) {
  const viewRef = useRef<View>(null);
  const lastScrollCheck = useRef(0);
  const isCurrentlyVisible = useRef(false);
  const initialCheckDone = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animation values
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(translateYAmount);

  const reveal = () => {
    isCurrentlyVisible.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    opacity.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration, easing: Easing.out(Easing.cubic) });
  };

  // On-load check: generous — show if 30%+ is already on screen
  const checkInitialVisibility = () => {
    if (isCurrentlyVisible.current || !viewRef.current) return;
    viewRef.current.measureInWindow((x, y, width, height) => {
      if (y === undefined || isCurrentlyVisible.current) return;
      const visibleHeight = Math.min(y + height, SCREEN_HEIGHT) - Math.max(y, 0);
      const visibleRatio = height > 0 ? visibleHeight / height : 0;
      if (visibleRatio >= 0.3) reveal();
    });
  };

  // Scroll check: stricter — element top must reach 70% of screen
  const checkScrollVisibility = () => {
    if (isCurrentlyVisible.current || !viewRef.current) return;
    viewRef.current.measureInWindow((x, y, width, height) => {
      if (y === undefined || isCurrentlyVisible.current) return;
      if (y < SCREEN_HEIGHT * 0.70 && y > -height) reveal();
    });
  };

  // Initial visibility checks — layout may not be ready on the first attempt
  useEffect(() => {
    const timers = [50, 200, 500].map((delay) => setTimeout(checkInitialVisibility, delay));
    return () => timers.forEach(clearTimeout);
  }, []);

  // Set up scroll listener using an interval
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const currentScroll = scrollY.value;
      if (Math.abs(currentScroll - lastScrollCheck.current) > 20) {
        lastScrollCheck.current = currentScroll;
        checkScrollVisibility();
      }
    }, 80);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [scrollY, translateYAmount, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (disabled) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View ref={viewRef} style={style}>
      <Animated.View style={animatedStyle}>
        {children}
      </Animated.View>
    </View>
  );
}

export { DEFAULT_CONFIG as SCROLL_FADE_IN_CONFIG };
