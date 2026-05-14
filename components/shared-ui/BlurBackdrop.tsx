/**
 * BlurBackdrop
 *
 * PURPOSE: Drop-in backdrop component for @gorhom/bottom-sheet's
 *          `backdropComponent` prop. Renders the canonical dim+blur
 *          look used by the rest of the app's sheets (matches
 *          FloatingSheet's showBackdrop behavior: BlurView intensity
 *          28, tint dark, plus a faint rgba(0,0,0,0.18) tint).
 *
 * USAGE:
 *   <BottomSheetModal
 *     ref={...}
 *     snapPoints={...}
 *     backdropComponent={BlurBackdrop}
 *   />
 *
 * Use this instead of the bare `BottomSheetBackdrop` (which only dims
 * — no blur). Pressing the backdrop dismisses the sheet (via
 * `pressBehavior="close"`, the BottomSheet default).
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { BottomSheetBackdrop, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { BlurView } from "expo-blur";

export function BlurBackdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={1}
      // We render the dim + blur as backdrop CHILDREN so the library's
      // built-in fade controls the entire effect's opacity.
      style={[props.style, styles.backdrop]}
    >
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.tint} />
    </BottomSheetBackdrop>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "transparent",
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
});

export default BlurBackdrop;
