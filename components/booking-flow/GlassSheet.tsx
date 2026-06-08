/**
 * GlassSheet — shared glassmorphism container for the booking flow.
 *
 * The visual primitive is split into two pieces so it can plug into
 * `@gorhom/bottom-sheet`'s slot APIs:
 *  - `GlassSheetBackground` → supplied as `backgroundComponent`
 *  - `GlassSheetHandle`     → supplied as `handleComponent`
 *
 * `GlassSheet` (default export) is a thin standalone wrapper that
 * stacks both with the same content, useful for any non-sheet
 * surface that still wants the frosted-blue look (e.g. tooltips,
 * Phase-3 floating chrome).
 *
 * Spec: ~/Downloads/<figma frames> Screens 1–2 (sheet-over-map).
 */

import React from "react";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { BorderRadius } from "@/constants/theme";

const GLASS_GRADIENT = ["#CFE0EB", "#DCE7EF", "#E8EEF3"] as const;

/**
 * Frosted-blue background. Plug into `BottomSheet` as
 * `backgroundComponent={GlassSheetBackground}`. The library passes
 * the animated `style` prop (and `pointerEvents`) — those forward
 * onto the container so the gradient + BlurView animate in sync
 * with snap transitions.
 */
export function GlassSheetBackground({ style, pointerEvents }: ViewProps) {
  return (
    <View style={[styles.background, style]} pointerEvents={pointerEvents}>
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
    </View>
  );
}

/**
 * Pull handle styled to match the glass tint. Plug into BottomSheet
 * as `handleComponent={GlassSheetHandle}`.
 */
export function GlassSheetHandle() {
  return (
    <View style={styles.handleRow} pointerEvents="none">
      <View style={styles.handle} />
    </View>
  );
}

interface GlassSheetProps {
  children: React.ReactNode;
  showHandle?: boolean;
}

/**
 * Standalone glass surface (non-bottom-sheet contexts). Stacks the
 * background + optional handle + children.
 */
export function GlassSheet({ children, showHandle = true }: GlassSheetProps) {
  return (
    <View style={styles.root}>
      <GlassSheetBackground style={StyleSheet.absoluteFill} />
      {showHandle ? <GlassSheetHandle /> : null}
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
  background: {
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
    paddingTop: 10,
    paddingBottom: 6,
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
