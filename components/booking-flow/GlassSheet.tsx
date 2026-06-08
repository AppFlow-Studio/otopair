/**
 * GlassSheet — shared glassmorphism container for the booking flow.
 *
 * Frosted blue background with a soft top-curved sheet shape and a
 * pull handle. Used as the visual container for Screens 1 and 2 of
 * the new booking flow (sheet-over-map). The map shows through with
 * a faint tint via the gradient + optional BlurView.
 *
 * Spec: ~/Downloads/<figma frames> (mockups from Yassin).
 */

import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { BorderRadius } from "@/constants/theme";

interface GlassSheetProps {
  /** Visible content stacked on top of the glass surface. */
  children: React.ReactNode;
  /** When true (default), renders the small pull handle at the top. */
  showHandle?: boolean;
}

const GLASS_GRADIENT = ["#CFE0EB", "#DCE7EF", "#E8EEF3"] as const;

export function GlassSheet({ children, showHandle = true }: GlassSheetProps) {
  return (
    <View style={styles.root}>
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={32}
          tint="light"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <LinearGradient
        colors={GLASS_GRADIENT}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.gradient]}
        pointerEvents="none"
      />
      {showHandle ? (
        <View style={styles.handleRow} pointerEvents="none">
          <View style={styles.handle} />
        </View>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    overflow: "hidden",
    backgroundColor: "rgba(207, 224, 235, 0.85)",
  },
  gradient: {
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    opacity: 0.92,
  },
  handleRow: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(15, 23, 42, 0.18)",
  },
  content: {
    flex: 1,
  },
});
