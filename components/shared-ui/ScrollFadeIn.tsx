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
  
  // Animation values
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(translateYAmount);

  // Check visibility and animate accordingly
  const checkVisibility = () => {
    if (!viewRef.current) return;
    
    viewRef.current.measureInWindow((x, y, width, height) => {
      if (y === undefined) return;
      
      // Element is visible when it's 70% up the screen
      const isVisible = y < SCREEN_HEIGHT * 0.70 && y > -height;
      
      // Only animate if visibility state changed
      if (isVisible && !isCurrentlyVisible.current) {
        // Fade in
        isCurrentlyVisible.current = true;
        opacity.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
        translateY.value = withTiming(0, { duration, easing: Easing.out(Easing.cubic) });
      } else if (!isVisible && isCurrentlyVisible.current) {
        // Fade out (reset for next time)
        isCurrentlyVisible.current = false;
        opacity.value = withTiming(0, { duration: duration * 0.5, easing: Easing.in(Easing.cubic) });
        translateY.value = withTiming(translateYAmount, { duration: duration * 0.5, easing: Easing.in(Easing.cubic) });
      }
    });
  };

  // Initial visibility check
  useEffect(() => {
    const timer = setTimeout(checkVisibility, 50);
    return () => clearTimeout(timer);
  }, []);

  // Set up scroll listener using an interval
  useEffect(() => {
    const interval = setInterval(() => {
      const currentScroll = scrollY.value;
      // Check if scroll has changed
      if (Math.abs(currentScroll - lastScrollCheck.current) > 20) {
        lastScrollCheck.current = currentScroll;
        checkVisibility();
      }
    }, 80);
    
    return () => clearInterval(interval);
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
