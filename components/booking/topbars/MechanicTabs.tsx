/**
 * MechanicTabs
 *
 * PURPOSE: Mechanic filter tabs for mechanic selection mode (bottom portion of TopBar)
 *
 * USED IN: TopBar (mechanic_selection mode)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { SheetDrivenAnimation } from "@/constants/animations";
import { MECHANIC_FILTER_OPTIONS, type MechanicFilterOption } from "@/constants/filters";
import { BorderRadius } from "@/constants/theme";

// Re-export for convenience
export type { MechanicFilterOption } from "@/constants/filters";

// ============================================================================
// CONSTANTS
// ============================================================================

// Match SERVICE_TABS_HEIGHT from DiscoveryTabs for consistent TopBar height
const MECHANIC_FILTERS_HEIGHT = 60;

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
        {MECHANIC_FILTER_OPTIONS.map((filter) => {
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
