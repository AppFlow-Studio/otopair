/**
 * MechanicDetailTabs
 *
 * PURPOSE: Tab navigation component for the shop detail page.
 *          Renders as a horizontal pill segmented control — active
 *          tab fills with BrandColors.secondary and white text;
 *          inactive tabs are transparent with muted text.
 *
 * USED IN: app/(main-tabs)/home/shop/[id]/index.tsx
 *
 * PROPS:
 *   - activeTab: Currently active tab id
 *   - onTabChange: Called when a tab is selected
 *
 * OWNER: Temurbek Sayfutdinov (original) → Ahmad (redesign + MECHANICS rename)
 */

import React from "react";
import { ScrollView, Pressable, StyleSheet, View } from "react-native";

import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius, Shadows } from "@/constants/theme";

export type MechanicDetailTab =
  | "services"
  | "schedule"
  | "reviews"
  | "portfolio"
  | "mechanics";

interface MechanicDetailTabsProps {
  activeTab: MechanicDetailTab;
  onTabChange: (tab: MechanicDetailTab) => void;
}

const TABS: { id: MechanicDetailTab; label: string }[] = [
  { id: "services", label: "Services" },
  { id: "schedule", label: "Schedule" },
  { id: "reviews", label: "Reviews" },
  { id: "mechanics", label: "Mechanics" },
  { id: "portfolio", label: "Portfolio" },
];

export function MechanicDetailTabs({
  activeTab,
  onTabChange,
}: MechanicDetailTabsProps) {
  return (
    <View style={styles.outer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => onTabChange(tab.id)}
              style={({ pressed }) => [
                styles.pill,
                isActive && styles.pillActive,
                pressed && !isActive && styles.pillPressed,
              ]}
            >
              <Text
                size="sm"
                weight={isActive ? "semiBold" : "medium"}
                color={isActive ? "#FFFFFF" : "#475569"}
                style={styles.pillLabel}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: "transparent",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    alignItems: "center",
  },
  pill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pillActive: {
    backgroundColor: BrandColors.secondary,
    borderColor: BrandColors.secondary,
    ...Shadows.sm,
  },
  pillPressed: {
    opacity: 0.7,
  },
  pillLabel: {
    letterSpacing: 0.2,
  },
});
