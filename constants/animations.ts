/**
 * animations.ts
 *
 * PURPOSE: Standardized animation configurations for consistent transitions across the app
 *
 * USED IN: Any component requiring animated transitions
 *
 * ANIMATIONS:
 *   - OtoTransition: Custom morphing transitions for booking flow stages
 *   - SlideTransition: Standard iOS-style push/pop navigation transitions (legacy)
 *   - FadeTransition: Simple fade in/out transitions
 *   - ScaleTransition: Scale up/down transitions for modals
 *   - SheetDrivenAnimation: Interpolation configs for bottom sheet driven animations
 *
 * OWNER: Waleed Mansour
 */

import {
  Easing,
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
  /** Oto transition (400ms) - stage transitions */
  otoTransition: 400,
} as const;

// ============================================================================
// SPRING CONFIGS
// ============================================================================

export const SpringConfig = {
  /** Snappy spring for quick interactions */
  snappy: {
    damping: 20,
    stiffness: 300,
    mass: 0.8,
  },
  /** Gentle spring for smoother transitions */
  gentle: {
    damping: 25,
    stiffness: 200,
    mass: 1,
  },
  /** Bouncy spring for playful animations */
  bouncy: {
    damping: 12,
    stiffness: 180,
    mass: 0.9,
  },
} as const;

// ============================================================================
// EASING PRESETS
// ============================================================================

export const OtoEasing = {
  /** Smooth ease out for entering elements */
  enter: Easing.bezier(0.0, 0.0, 0.2, 1.0),
  /** Quick ease in for exiting elements */
  exit: Easing.bezier(0.4, 0.0, 1.0, 1.0),
  /** Balanced easing for general use */
  standard: Easing.bezier(0.4, 0.0, 0.2, 1.0),
  /** Sharp easing for emphasis */
  sharp: Easing.bezier(0.4, 0.0, 0.6, 1.0),
} as const;

// ============================================================================
// OTO TRANSITIONS (Custom booking flow transitions)
// ============================================================================

/**
 * Custom Oto transitions for booking flow stages.
 * Replaces iOS-style slide transitions with a more fluid morphing effect.
 *
 * The transition uses:
 * - Fade + Scale for a "morph" effect
 * - Vertical slide for directional context
 * - Staggered timing for layered depth
 *
 * @example
 * const { entering, exiting } = isForward
 *   ? OtoTransition.forward
 *   : OtoTransition.backward;
 *
 * <Animated.View entering={entering} exiting={exiting}>
 *   {content}
 * </Animated.View>
 */
export const OtoTransition = {
  /**
   * Forward navigation: Content scales up + fades in from below
   * Exit: Current content scales down + fades out, moves up slightly
   */
  forward: {
    entering: FadeIn.duration(AnimationDuration.otoTransition)
      .easing(OtoEasing.enter)
      .withInitialValues({
        opacity: 0,
        transform: [{ scale: 0.92 }, { translateY: 24 }],
      })
      .withCallback((finished) => {
        "worklet";
        // Animation complete
      }),
    exiting: FadeOut.duration(AnimationDuration.otoTransition * 0.7)
      .easing(OtoEasing.exit)
      .withInitialValues({
        opacity: 1,
        transform: [{ scale: 1 }, { translateY: 0 }],
      }),
  },
  /**
   * Backward navigation: Content scales up + fades in from above
   * Exit: Current content scales down + fades out, moves down slightly
   */
  backward: {
    entering: FadeIn.duration(AnimationDuration.otoTransition)
      .easing(OtoEasing.enter)
      .withInitialValues({
        opacity: 0,
        transform: [{ scale: 0.92 }, { translateY: -24 }],
      }),
    exiting: FadeOut.duration(AnimationDuration.otoTransition * 0.7)
      .easing(OtoEasing.exit)
      .withInitialValues({
        opacity: 1,
        transform: [{ scale: 1 }, { translateY: 0 }],
      }),
  },
} as const;

/**
 * Get Oto transition based on direction
 *
 * @param isForward - true for forward navigation, false for backward
 * @returns { entering, exiting } animation configs
 *
 * @example
 * const { entering, exiting } = getOtoTransition(isForward);
 */
export function getOtoTransition(isForward: boolean) {
  return isForward ? OtoTransition.forward : OtoTransition.backward;
}

// ============================================================================
// OTO SPRING TRANSITIONS (Physics-based alternative)
// ============================================================================

/**
 * Spring-based transitions for a more natural, bouncy feel.
 * Use when you want elements to "settle" into place.
 */
export const OtoSpringTransition = {
  forward: {
    entering: FadeIn.duration(AnimationDuration.otoTransition)
      .springify()
      .damping(SpringConfig.gentle.damping)
      .stiffness(SpringConfig.gentle.stiffness)
      .mass(SpringConfig.gentle.mass)
      .withInitialValues({
        opacity: 0,
        transform: [{ scale: 0.88 }, { translateY: 30 }],
      }),
    exiting: FadeOut.duration(AnimationDuration.standard).easing(OtoEasing.exit),
  },
  backward: {
    entering: FadeIn.duration(AnimationDuration.otoTransition)
      .springify()
      .damping(SpringConfig.gentle.damping)
      .stiffness(SpringConfig.gentle.stiffness)
      .mass(SpringConfig.gentle.mass)
      .withInitialValues({
        opacity: 0,
        transform: [{ scale: 0.88 }, { translateY: -30 }],
      }),
    exiting: FadeOut.duration(AnimationDuration.standard).easing(OtoEasing.exit),
  },
} as const;

export function getOtoSpringTransition(isForward: boolean) {
  return isForward ? OtoSpringTransition.forward : OtoSpringTransition.backward;
}

// ============================================================================
// OTO CROSSFADE TRANSITIONS (Subtle crossfade with scale)
// ============================================================================

/**
 * Subtle crossfade transition with minimal scale.
 * Best for content where positional context is less important.
 */
export const OtoCrossfade = {
  forward: {
    entering: FadeIn.duration(AnimationDuration.slow)
      .easing(OtoEasing.enter)
      .withInitialValues({
        opacity: 0,
        transform: [{ scale: 0.96 }],
      }),
    exiting: FadeOut.duration(AnimationDuration.standard).easing(OtoEasing.exit),
  },
  backward: {
    entering: FadeIn.duration(AnimationDuration.slow)
      .easing(OtoEasing.enter)
      .withInitialValues({
        opacity: 0,
        transform: [{ scale: 0.96 }],
      }),
    exiting: FadeOut.duration(AnimationDuration.standard).easing(OtoEasing.exit),
  },
} as const;

export function getOtoCrossfade(isForward: boolean) {
  return isForward ? OtoCrossfade.forward : OtoCrossfade.backward;
}

// ============================================================================
// TOP BAR SPECIFIC TRANSITIONS
// ============================================================================

/**
 * Specialized transitions for top bar content.
 * Uses horizontal movement to match the visual flow.
 */
export const TopBarTransition = {
  forward: {
    entering: FadeIn.duration(AnimationDuration.standard)
      .easing(OtoEasing.enter)
      .withInitialValues({
        opacity: 0,
        transform: [{ translateX: 40 }, { scale: 0.95 }],
      }),
    exiting: FadeOut.duration(AnimationDuration.fast)
      .easing(OtoEasing.exit)
      .withInitialValues({
        opacity: 1,
        transform: [{ translateX: 0 }, { scale: 1 }],
      }),
  },
  backward: {
    entering: FadeIn.duration(AnimationDuration.standard)
      .easing(OtoEasing.enter)
      .withInitialValues({
        opacity: 0,
        transform: [{ translateX: -40 }, { scale: 0.95 }],
      }),
    exiting: FadeOut.duration(AnimationDuration.fast)
      .easing(OtoEasing.exit)
      .withInitialValues({
        opacity: 1,
        transform: [{ translateX: 0 }, { scale: 1 }],
      }),
  },
} as const;

export function getTopBarTransition(isForward: boolean) {
  return isForward ? TopBarTransition.forward : TopBarTransition.backward;
}

// ============================================================================
// BOTTOM SHEET CONTENT TRANSITIONS
// ============================================================================

/**
 * Transitions for bottom sheet content switching.
 * Uses vertical movement to match the sheet's natural direction.
 */
export const SheetContentTransition = {
  forward: {
    entering: FadeIn.duration(AnimationDuration.otoTransition)
      .delay(50) // Slight delay for stagger effect
      .easing(OtoEasing.enter)
      .withInitialValues({
        opacity: 0,
        transform: [{ translateY: 40 }, { scale: 0.94 }],
      }),
    exiting: FadeOut.duration(AnimationDuration.standard)
      .easing(OtoEasing.exit)
      .withInitialValues({
        opacity: 1,
        transform: [{ translateY: 0 }, { scale: 1 }],
      }),
  },
  backward: {
    entering: FadeIn.duration(AnimationDuration.otoTransition)
      .delay(50)
      .easing(OtoEasing.enter)
      .withInitialValues({
        opacity: 0,
        transform: [{ translateY: -40 }, { scale: 0.94 }],
      }),
    exiting: FadeOut.duration(AnimationDuration.standard)
      .easing(OtoEasing.exit)
      .withInitialValues({
        opacity: 1,
        transform: [{ translateY: 0 }, { scale: 1 }],
      }),
  },
} as const;

export function getSheetContentTransition(isForward: boolean) {
  return isForward ? SheetContentTransition.forward : SheetContentTransition.backward;
}

// ============================================================================
// SLIDE TRANSITIONS (iOS-style push/pop) - LEGACY
// ============================================================================

/**
 * Standard iOS-style slide transitions for navigation
 * @deprecated Use OtoTransition for booking flow
 */
export const SlideTransition = {
  forward: {
    entering: SlideInRight.duration(AnimationDuration.standard),
    exiting: SlideOutLeft.duration(AnimationDuration.standard),
  },
  backward: {
    entering: SlideInLeft.duration(AnimationDuration.standard),
    exiting: SlideOutRight.duration(AnimationDuration.standard),
  },
} as const;

/**
 * @deprecated Use getOtoTransition for booking flow
 */
export function getSlideTransition(isForward: boolean) {
  return isForward ? SlideTransition.forward : SlideTransition.backward;
}

// ============================================================================
// FADE TRANSITIONS
// ============================================================================

export const FadeTransition = {
  in: FadeIn.duration(AnimationDuration.standard),
  out: FadeOut.duration(AnimationDuration.standard),
  inFast: FadeIn.duration(AnimationDuration.fast),
  outFast: FadeOut.duration(AnimationDuration.fast),
} as const;

// ============================================================================
// SCALE TRANSITIONS (for modals/popups)
// ============================================================================

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
 */
export const SheetDrivenAnimation = {
  fadeOut: (value: number): number => {
    "worklet";
    return interpolate(value, [0, 0.25], [1, 0], "clamp");
  },

  heightCollapse: (value: number, fullHeight: number): number => {
    "worklet";
    return interpolate(value, [0.25, 0.5], [fullHeight, 0], "clamp");
  },

  fadeIn: (value: number): number => {
    "worklet";
    return interpolate(value, [0.25, 0.5], [0, 1], "clamp");
  },

  heightExpand: (value: number, fullHeight: number): number => {
    "worklet";
    return interpolate(value, [0, 0.25], [0, fullHeight], "clamp");
  },
} as const;

// ============================================================================
// STAGGER HELPERS
// ============================================================================

/**
 * Calculate stagger delay for list items
 * @param index - Item index in the list
 * @param baseDelay - Base delay between items (default 50ms)
 * @param maxDelay - Maximum total delay (default 300ms)
 */
export function getStaggerDelay(index: number, baseDelay = 50, maxDelay = 300): number {
  return Math.min(index * baseDelay, maxDelay);
}

/**
 * Create entering animation with stagger for list items
 */
export function getStaggeredEntering(index: number, isForward = true) {
  const delay = getStaggerDelay(index);
  const transition = isForward ? OtoTransition.forward : OtoTransition.backward;
  return transition.entering.delay(delay);
}
