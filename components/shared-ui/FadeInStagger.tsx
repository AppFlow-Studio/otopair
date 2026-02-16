/**
 * FadeInStagger
 * 
 * PURPOSE: Wraps children and applies a staggered fade-in animation to each child.
 *          Use this to create a "content appearing one-by-one" effect when
 *          navigating to a new page or when content loads.
 * 
 * USAGE:
 *   <FadeInStagger>
 *     <Card1 />
 *     <Card2 />
 *     <Card3 />
 *   </FadeInStagger>
 * 
 * CUSTOMIZATION:
 *   - staggerDelay: ms between each item (default: 60ms)
 *   - duration: animation duration per item (default: 300ms)
 *   - disabled: skip animation entirely
 *   - startIndex: which child index to start from (default: 0)
 */

import React, { Children, isValidElement, ReactNode, useEffect, useState } from 'react';
import { AccessibilityInfo, StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';

// ============================================================================
// CONFIG - Tweak these values to adjust the feel
// ============================================================================

const DEFAULT_CONFIG = {
  staggerDelay: 100,   // ms between each child fade-in
  duration: 800,       // ms for each fade animation
  translateY: 24,      // px - how far content lifts from (set to 0 for pure fade)
};

// ============================================================================
// TYPES
// ============================================================================

interface FadeInStaggerProps {
  children: ReactNode;
  /** Delay between each child animation in ms (default: 60) */
  staggerDelay?: number;
  /** Duration of each fade animation in ms (default: 300) */
  duration?: number;
  /** Disable all animations */
  disabled?: boolean;
  /** Starting index for stagger calculation (default: 0) */
  startIndex?: number;
  /** Use pure fade instead of fade + lift (default: false) */
  pureFade?: boolean;
  /** Container style */
  style?: StyleProp<ViewStyle>;
  /** Key to force re-animation (change this to replay animations) */
  animationKey?: string | number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FadeInStagger({
  children,
  staggerDelay = DEFAULT_CONFIG.staggerDelay,
  duration = DEFAULT_CONFIG.duration,
  disabled = false,
  startIndex = 0,
  pureFade = false,
  style,
  animationKey,
}: FadeInStaggerProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [mountKey, setMountKey] = useState(0);
  const isInitialMount = React.useRef(true);
  
  // Use focus state to trigger re-animation when screen becomes visible
  const isFocused = useIsFocused();

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => subscription.remove();
  }, []);

  // Increment mount key when screen becomes focused (but not on initial mount)
  // This forces a re-render of the animated children, triggering the entering animation
  useEffect(() => {
    if (isFocused && !isInitialMount.current) {
      setMountKey(prev => prev + 1);
    }
    isInitialMount.current = false;
  }, [isFocused]);

  // If disabled or reduce motion, render children without animation
  if (disabled || reduceMotion) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  // Use provided animationKey or our internal mountKey
  const effectiveKey = animationKey ?? mountKey;

  // Map children to add staggered entering animation
  const animatedChildren = Children.map(children, (child, index) => {
    if (!isValidElement(child)) return child;

    const delay = (startIndex + index) * staggerDelay;
    // Use springify() for smoother, more natural motion
    // Lower stiffness = slower, more gradual movement
    const entering = pureFade
      ? FadeIn.duration(duration).delay(delay)
      : FadeInDown.duration(duration).delay(delay).springify().damping(20).stiffness(50);

    return (
      <Animated.View key={`stagger-${effectiveKey}-${index}`} entering={entering}>
        {child}
      </Animated.View>
    );
  });

  return (
    <Animated.View key={`container-${effectiveKey}`} style={style}>
      {animatedChildren}
    </Animated.View>
  );
}

// ============================================================================
// INDIVIDUAL ITEM WRAPPER (for manual control)
// ============================================================================

interface FadeInItemProps {
  children: ReactNode;
  /** Index for stagger calculation */
  index: number;
  /** Delay between items in ms */
  staggerDelay?: number;
  /** Duration of fade animation in ms */
  duration?: number;
  /** Use pure fade instead of fade + lift */
  pureFade?: boolean;
  /** Container style */
  style?: StyleProp<ViewStyle>;
}

/**
 * Individual fade-in item - use when you need more control over which
 * items animate (e.g., in a FlatList renderItem or conditional rendering)
 */
export function FadeInItem({
  children,
  index,
  staggerDelay = DEFAULT_CONFIG.staggerDelay,
  duration = DEFAULT_CONFIG.duration,
  pureFade = false,
  style,
}: FadeInItemProps) {
  const delay = index * staggerDelay;
  const entering = pureFade
    ? FadeIn.duration(duration).delay(delay)
    : FadeInDown.duration(duration).delay(delay);

  return (
    <Animated.View style={style} entering={entering}>
      {children}
    </Animated.View>
  );
}

export { DEFAULT_CONFIG as FADE_IN_STAGGER_CONFIG };
