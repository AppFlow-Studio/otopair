/**
 * footerSafeArea.ts — Bottom padding for a screen-anchored footer.
 *
 * The two platforms need different rules at the bottom edge. iOS's home
 * indicator is a hint drawn OVER the app: a footer can sit a designed
 * distance from the physical screen bottom and still be pressable, so a
 * value tuned by eye is the right one and applying `insets.bottom` on top of
 * it only floats the footer higher than intended. Android's navigation bar
 * is a real system window — under edge-to-edge the app draws beneath it and
 * the OS takes every touch inside that strip — so a footer MUST clear
 * `insets.bottom` (~48dp with 3-button navigation, ~16-24dp with gesture
 * navigation) or it cannot be tapped at all.
 *
 * Pure and platform-flag-driven rather than reading `Platform` itself, so
 * the rule can be unit-tested without a native runtime.
 */

export interface FooterPaddingBottomInput {
  /** `Platform.OS === "android"`. */
  isAndroid: boolean;
  /** `useSafeAreaInsets().bottom`, in dp. */
  bottomInset: number;
  /** The designed distance from the screen bottom. Used as-is on iOS, and as
   *  a floor on Android. */
  base: number;
  /** Clearance between the footer and the Android system navigation bar. */
  gap: number;
}

/**
 * iOS (and anything that isn't Android): `base`, untouched.
 *
 * Android: `bottomInset + gap`, but never below `base` — a build that reports
 * no bottom inset (not edge-to-edge, or the inset hasn't measured yet) then
 * lands on exactly the iOS spacing instead of going flush with the edge.
 */
export function footerPaddingBottom({
  isAndroid,
  bottomInset,
  base,
  gap,
}: FooterPaddingBottomInput): number {
  if (!isAndroid) return base;
  return Math.max(bottomInset + gap, base);
}
