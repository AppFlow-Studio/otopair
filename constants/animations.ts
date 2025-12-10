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
 *
 * OWNER: Waleed Mansour
 */

import {
  FadeIn,
  FadeOut,
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
