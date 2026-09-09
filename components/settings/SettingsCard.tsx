/**
 * SettingsCard
 *
 * PURPOSE: Translucent rounded container that hosts a stack of
 *          SettingsRow components on the dark Revolut-style Settings
 *          surface.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

interface SettingsCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function SettingsCard({ children, style }: SettingsCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
});

export default SettingsCard;
