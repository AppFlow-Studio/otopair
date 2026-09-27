/**
 * Geometry for the detached ("floating card") bottom sheets.
 *
 * A detached @gorhom/bottom-sheet rests with its bottom edge `bottomInset`
 * above the bottom of its container and, with `enableDynamicSizing`, grows
 * upward to fit its content. Left uncapped it grows straight past the top of
 * the screen, because a detached sheet has no clipping mask: both
 * `BottomSheetContent` and `BottomSheetHostingContainer` switch to
 * `overflow: "visible"` when `detached` is set, and the scroll viewport is
 * sized from the TALLEST detent rather than the one the sheet rests at. Content
 * that does not fit is therefore drawn off the bottom of the screen instead of
 * being clipped and scrolled.
 *
 * Capping the growth with `maxDynamicContentSize` is what keeps the sheet
 * inside the safe area AND gives its scroll view a real scroll range.
 */

/** Gap between the sheet's edge and the safe area, so its rounded corners show. */
export const FLOATING_SHEET_GAP = 12;

export interface FloatingSheetLayoutInput {
  /** Window height in dp, e.g. from `useWindowDimensions()`. */
  windowHeight: number;
  /** Top safe-area inset in dp (status bar / notch). */
  safeAreaTop: number;
  /** Bottom safe-area inset in dp (nav bar / home indicator). */
  safeAreaBottom: number;
  gap?: number;
}

export interface FloatingSheetLayout {
  /** `bottomInset` — lifts the sheet clear of the system navigation bar. */
  bottomInset: number;
  /**
   * `maxDynamicContentSize` — tallest the sheet may grow, leaving the top
   * safe area plus `gap` free. `undefined` when it cannot be computed, which
   * leaves the library on its own default (the container height).
   */
  maxHeight: number | undefined;
}

export function calculateFloatingSheetLayout({
  windowHeight,
  safeAreaTop,
  safeAreaBottom,
  gap = FLOATING_SHEET_GAP,
}: FloatingSheetLayoutInput): FloatingSheetLayout {
  const top = Number.isFinite(safeAreaTop) ? Math.max(0, safeAreaTop) : 0;
  const bottom = Number.isFinite(safeAreaBottom)
    ? Math.max(0, safeAreaBottom)
    : 0;

  const bottomInset = bottom + gap;

  // The sheet's bottom edge sits at `windowHeight - bottomInset`, so capping
  // its height here puts its top edge at exactly `safeAreaTop + gap`.
  const maxHeight = windowHeight - top - gap - bottomInset;

  return {
    bottomInset,
    maxHeight:
      Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : undefined,
  };
}
