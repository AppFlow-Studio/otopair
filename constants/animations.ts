/**
 * animations.ts
 *
 * PURPOSE: Standardized animation configurations for consistent transitions across the app
 *
 * USED IN: Any component requiring animated transitions
 *
 * ANIMATIONS:
 *   - SlideTransition: Standard iOS-style push/pop navigation transitions
 *   - FadeTransition: Simple fade in/out transitions
 *   - ScaleTransition: Scale up/down transitions for modals
 *   - SheetDrivenAnimation: Interpolation configs for bottom sheet driven animations
 *
 * OWNER: Waleed Mansour
 */

import {
  FadeIn,
  FadeOut,
  interpolate,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";

// ============================================================================
// DURATION CONSTANTS
// ============================================================================

export const AnimationDuration = {
  /** Fast animations (150ms) - micro-interactions */
  fast: 150,
  /** Standard animations (250ms) - most transitions */
  standard: 250,
  /** Slow animations (350ms) - emphasis transitions */
  slow: 350,
} as const;

// ============================================================================
// SLIDE TRANSITIONS (iOS-style push/pop)
// ============================================================================

/**
 * Standard iOS-style slide transitions for navigation
 *
 * Forward: Old screen exits RIGHT, new screen enters from LEFT
 * Backward: Old screen exits LEFT, new screen enters from RIGHT
 *
 * @example
 * // In a component with forward/backward state:
 * const { entering, exiting } = isForward
 *   ? SlideTransition.forward
 *   : SlideTransition.backward;
 *
 * <Animated.View entering={entering} exiting={exiting}>
 *   {content}
 * </Animated.View>
 */
export const SlideTransition = {
  /** Forward navigation (e.g., navigating deeper into a flow) */
  forward: {
    entering: SlideInLeft.duration(AnimationDuration.standard),
    exiting: SlideOutRight.duration(AnimationDuration.standard),
  },
  /** Backward navigation (e.g., going back) */
  backward: {
    entering: SlideInRight.duration(AnimationDuration.standard),
    exiting: SlideOutLeft.duration(AnimationDuration.standard),
  },
} as const;

/**
 * Get slide transition based on direction
 *
 * @param isForward - true for forward navigation, false for backward
 * @returns { entering, exiting } animation configs
 *
 * @example
 * const { entering, exiting } = getSlideTransition(isForward);
 */
export function getSlideTransition(isForward: boolean) {
  return isForward ? SlideTransition.forward : SlideTransition.backward;
}

/**
 * Get slide transition or undefined (for skipping animation on first render)
 *
 * @param shouldAnimate - whether to animate (false on first render)
 * @param isForward - direction of navigation
 * @returns { entering, exiting } or { entering: undefined, exiting: undefined }
 *
 * @example
 * const { entering, exiting } = getSlideTransitionOrNone(animationKey > 0, isForward);
 */
export function getSlideTransitionOrNone(shouldAnimate: boolean, isForward: boolean) {
  if (!shouldAnimate) {
    return { entering: undefined, exiting: undefined };
  }
  return getSlideTransition(isForward);
}

// ============================================================================
// FADE TRANSITIONS
// ============================================================================

/**
 * Simple fade transitions for overlays, modals, etc.
 *
 * @example
 * <Animated.View entering={FadeTransition.in} exiting={FadeTransition.out}>
 *   {content}
 * </Animated.View>
 */
export const FadeTransition = {
  in: FadeIn.duration(AnimationDuration.standard),
  out: FadeOut.duration(AnimationDuration.standard),
  /** Fast fade for micro-interactions */
  inFast: FadeIn.duration(AnimationDuration.fast),
  outFast: FadeOut.duration(AnimationDuration.fast),
} as const;

// ============================================================================
// SCALE TRANSITIONS (for modals/popups)
// ============================================================================

/**
 * Scale transitions for modals and popups
 *
 * @example
 * <Animated.View entering={ScaleTransition.in} exiting={ScaleTransition.out}>
 *   <Modal />
 * </Animated.View>
 */
export const ScaleTransition = {
  in: ZoomIn.duration(AnimationDuration.standard),
  out: ZoomOut.duration(AnimationDuration.standard),
} as const;

// ============================================================================
// SHEET-DRIVEN ANIMATIONS (for bottom sheet interactions)
// ============================================================================

/**
 * Interpolation configs for animations driven by bottom sheet position.
 * Use with react-native-reanimated's interpolate() function.
 *
 * Input: sheet animated index (0 = collapsed, 1 = expanded)
 *
 * @example
 * const animatedStyle = useAnimatedStyle(() => {
 *   const opacity = SheetDrivenAnimation.fadeOut(sheetIndex.value);
 *   const height = SheetDrivenAnimation.heightCollapse(sheetIndex.value, 60);
 *   return { opacity, height };
 * });
 */
export const SheetDrivenAnimation = {
  /**
   * Fade out as sheet expands (0 → 0.25)
   * Content becomes invisible before height collapses
   */
  fadeOut: (value: number): number => {
    "worklet";
    return interpolate(value, [0, 0.25], [1, 0], "clamp");
  },

  /**
   * Collapse height after fade (0.25 → 0.5)
   * Height collapses after content is invisible to avoid clipping
   * @param value - sheet animated index value
   * @param fullHeight - the full height to collapse from
   */
  heightCollapse: (value: number, fullHeight: number): number => {
    "worklet";
    return interpolate(value, [0.25, 0.5], [fullHeight, 0], "clamp");
  },

  /**
   * Fade in as sheet expands (0.25 → 0.5)
   * Content fades in after space is created
   */
  fadeIn: (value: number): number => {
    "worklet";
    return interpolate(value, [0.25, 0.5], [0, 1], "clamp");
  },

  /**
   * Expand height before fade (0 → 0.25)
   * Height expands before content fades in
   * @param value - sheet animated index value
   * @param fullHeight - the full height to expand to
   */
  heightExpand: (value: number, fullHeight: number): number => {
    "worklet";
    return interpolate(value, [0, 0.25], [0, fullHeight], "clamp");
  },
} as const;
