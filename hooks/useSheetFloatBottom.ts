/**
 * useSheetFloatBottom — `floatBottomInset` for a FloatingSheet that should
 * rest `gap` dp above the bottom of the usable screen.
 *
 * The sheet renders in a native Modal, which Android draws edge to edge: a
 * flat inset rests the sheet `gap` above the glass, so the system navigation
 * bar covers its bottom row (#285, "Clear role" under back/home/recents).
 * Same rule as a screen footer — iOS keeps the flat gap, Android clears the
 * bar by it.
 */

import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { footerPaddingBottom } from "@/lib/footerSafeArea";

export function useSheetFloatBottom(gap = 12): number {
  const { bottom } = useSafeAreaInsets();
  return footerPaddingBottom({
    isAndroid: Platform.OS === "android",
    bottomInset: bottom,
    base: gap,
    gap,
  });
}
