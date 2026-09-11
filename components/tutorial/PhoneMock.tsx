/**
 * PhoneMock — the device frame the tutorial's crops sit inside.
 *
 * FIXED SIZE, deliberately. Everything else on a tutorial step grows with
 * Dynamic Type; this does not. A device frame that scales stops reading as a
 * device and starts reading as a picture of one, and the crop inside it is
 * drawn to be legible at exactly this width.
 *
 * DECORATIVE. The whole subtree is hidden from the accessibility tree: every
 * word inside it is already said by the step's headline and body, so exposing
 * it would make a screen reader read the same content twice, once as prose and
 * once as a pile of orphaned labels.
 *
 * DESIGN: Figma `kI9Em7mHSzkgAwDCtCNJYi` → T1…T4 · Tutorial.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { BrandColors } from "@/constants/theme";

export const PHONE_WIDTH = 216;
export const PHONE_HEIGHT = 400;
const BEZEL = 8;

export const SCREEN_WIDTH = PHONE_WIDTH - BEZEL * 2;
export const SCREEN_HEIGHT = PHONE_HEIGHT - BEZEL * 2;

interface PhoneMockProps {
  children: React.ReactNode;
  /** Screen background. Crops that need a flat white (chat) override the
   *  default gradient-ish tint the rest of the app uses. */
  screenColor?: string;
  style?: ViewStyle;
}

export function PhoneMock({ children, screenColor = "#F2F6F9", style }: PhoneMockProps) {
  return (
    <View
      style={[styles.bezel, style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={[styles.screen, { backgroundColor: screenColor }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bezel: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    borderRadius: 32,
    backgroundColor: BrandColors.primary,
    padding: BEZEL,
    // Soft and low — the frame should sit on the page, not hover over it.
    shadowColor: "#141C24",
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  screen: {
    flex: 1,
    borderRadius: 26,
    overflow: "hidden",
  },
});
