/**
 * SettingsHeaderCard
 *
 * PURPOSE: One of the two side-by-side cards directly under the avatar
 *          on the Settings screen. Two visual variants:
 *
 *          - "plan"    — large title (e.g. "Standard"), subtitle below
 *                        ("Your plan"), small icon top-left.
 *          - "action"  — icon top-left, title + subtitle bottom-left
 *                        ("Invite friends" / "Earn $60 or more").
 *
 *          Pressable. Equal-width when laid out in a row with `flex: 1`
 *          on each instance.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/shared-ui";

interface SettingsHeaderCardProps {
  variant: "plan" | "action";
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
}

export function SettingsHeaderCard({
  variant,
  title,
  subtitle,
  icon,
  onPress,
}: SettingsHeaderCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.iconRow}>{icon}</View>
      <View style={variant === "plan" ? styles.planText : styles.actionText}>
        <Text weight="bold" size="lg" color="#FFFFFF">
          {title}
        </Text>
        <Text
          weight="regular"
          size="sm"
          color="rgba(255,255,255,0.55)"
          style={styles.subtitle}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    height: 140,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 16,
    justifyContent: "space-between",
  },
  cardPressed: {
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  planText: {
    // Plan card: copy sits at the bottom-left.
  },
  actionText: {
    // Action card: same — keeps both variants visually balanced.
  },
  subtitle: {
    marginTop: 2,
  },
});

export default SettingsHeaderCard;
