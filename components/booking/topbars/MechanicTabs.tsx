/**
 * MechanicTabs
 *
 * PURPOSE: Mechanic filter tabs for mechanic selection mode (bottom portion of TopBar)
 *
 * USED IN: TopBar (mechanic_selection mode)
 *
 * OWNER: Waleed Mansour
 */

import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";

import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { SheetDrivenAnimation } from "@/constants/animations";
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// CONSTANTS
// ============================================================================

// Match SERVICE_TABS_HEIGHT from DiscoveryTabs for consistent TopBar height
const MECHANIC_FILTERS_HEIGHT = 60;

// ============================================================================
// TYPES
// ============================================================================

export type MechanicFilterOption = "available_now" | "distance" | "rating";

interface MechanicFilterItem {
  id: MechanicFilterOption;
  label: string;
}

const MECHANIC_FILTERS: MechanicFilterItem[] = [
  { id: "available_now", label: "Available Now" },
  { id: "distance", label: "Distance" },
  { id: "rating", label: "Rating" },
];

export interface MechanicTabsProps {
  /** Called when a filter tab is selected */
  onMechanicFilterSelect?: (filter: MechanicFilterOption) => void;
  /** Currently selected filter option */
  selectedMechanicFilter?: MechanicFilterOption;
  /** Animated index from bottom sheet */
  sheetAnimatedIndex?: SharedValue<number>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicTabs({
  onMechanicFilterSelect,
  selectedMechanicFilter = "available_now",
  sheetAnimatedIndex,
}: MechanicTabsProps) {
  // Animation for mechanic filter tabs (sheet-driven: fade in when expanded)
  // Use same height as DiscoveryTabs (SERVICE_TABS_HEIGHT = 60) for consistent TopBar height
  const mechanicFiltersAnimatedStyle = useAnimatedStyle(() => {
    if (!sheetAnimatedIndex) {
      return { opacity: 1, height: MECHANIC_FILTERS_HEIGHT };
    }

    // Sheet animation: fade in when expanded (inverse of discovery's fade out)
    const opacity = SheetDrivenAnimation.fadeIn(sheetAnimatedIndex.value);
    const height = SheetDrivenAnimation.heightExpand(sheetAnimatedIndex.value, MECHANIC_FILTERS_HEIGHT);

    return { opacity, height, overflow: "hidden" };
  }, [sheetAnimatedIndex]);

  return (
    <Animated.View style={mechanicFiltersAnimatedStyle}>
      <View style={styles.mechanicFilters}>
        {MECHANIC_FILTERS.map((filter) => {
          const isSelected = selectedMechanicFilter === filter.id;
          return (
            <TouchableOpacity
              key={filter.id}
              style={[styles.mechanicFilterTab, isSelected && styles.mechanicFilterTabSelected]}
              onPress={() => onMechanicFilterSelect?.(filter.id)}
              activeOpacity={0.7}
            >
              <Text
                size="sm"
                weight={isSelected ? "semiBold" : "regular"}
                color={isSelected ? BrandColors.white : BrandColors.primary}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  mechanicFilters: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  mechanicFilterTab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: "transparent",
  },
  mechanicFilterTabSelected: {
    backgroundColor: BrandColors.primary,
  },
});
