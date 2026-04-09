/**
 * Responsive Scaling Utility
 *
 * Provides scale(), verticalScale(), and moderateScale() functions
 * to make UI dimensions adapt to different screen sizes.
 *
 * Reference device: iPhone 14/15 (393 × 852 pt)
 * App is portrait-locked, so dimensions are computed once at module load.
 */

import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get("window");

const DESIGN_WIDTH = 393;
const DESIGN_HEIGHT = 852;

const widthRatio = SCREEN_WIDTH / DESIGN_WIDTH;
const heightRatio = SCREEN_HEIGHT / DESIGN_HEIGHT;

/**
 * Linear horizontal scale — use for widths, paddings, margins, icon sizes,
 * gaps, and any dimension that should scale proportionally with screen width.
 */
export function scale(size: number): number {
  return Math.round(size * widthRatio);
}

/**
 * Linear vertical scale — use for height-dependent values like
 * absolute top offsets, header heights, and vertical positioning.
 */
export function verticalScale(size: number): number {
  return Math.round(size * heightRatio);
}

/**
 * Dampened scale — use for font sizes and border radii so they
 * grow on larger screens but don't balloon on tablets.
 *
 * @param size   - The base size (designed at 393pt width)
 * @param factor - Dampening factor (0 = no scale, 1 = full scale). Default 0.5
 */
export function moderateScale(size: number, factor: number = 0.5): number {
  return Math.round(size + (scale(size) - size) * factor);
}

/** Returns true when running on a tablet-sized screen (≥768pt wide). */
export function isTablet(): boolean {
  return SCREEN_WIDTH >= 768;
}

/** Current screen width (portrait). */
export { SCREEN_WIDTH, SCREEN_HEIGHT };
