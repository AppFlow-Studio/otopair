/**
 * MechanicSelectionContent
 *
 * PURPOSE: Top bar content for mechanic selection mode - mechanics count, services summary, filter tabs
 *
 * USED IN: TopBar (mechanic_selection mode)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { ArrowLeft } from "lucide-react-native";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, GhostButton, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { SheetDrivenAnimation } from "@/constants/animations";
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// CONSTANTS
// ============================================================================

const MECHANIC_FILTERS_HEIGHT = 52;

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

export interface MechanicSelectionContentProps {
  /** Number of available mechanics */
  mechanicsCount: number;
  /** Summary of selected services (e.g., "Oil Change, Brake Inspection") */
  selectedServicesText: string;
  /** Called when back button is tapped */
  onBackPress?: () => void;
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

export function MechanicSelectionContent({
  mechanicsCount,
  selectedServicesText,
  onBackPress,
  onMechanicFilterSelect,
  selectedMechanicFilter = "available_now",
  sheetAnimatedIndex,
}: MechanicSelectionContentProps) {
  const insets = useSafeAreaInsets();

  // Animation for mechanic filter tabs (sheet-driven: fade in when expanded)
  const mechanicFiltersAnimatedStyle = useAnimatedStyle(() => {
    if (!sheetAnimatedIndex) {
      return { opacity: 1, height: MECHANIC_FILTERS_HEIGHT };
    }

    // Sheet animation: fade in when expanded (inverse of discovery's fade out)
    const opacity = SheetDrivenAnimation.fadeIn(sheetAnimatedIndex.value);
    const height = SheetDrivenAnimation.heightExpand(sheetAnimatedIndex.value, MECHANIC_FILTERS_HEIGHT);

    return { opacity, height };
  }, [sheetAnimatedIndex]);

  return (
    <>
      {/* Top Row: Back, Mechanics Count + Services */}
      <View style={[styles.topRow, { paddingTop: insets.top + Spacing.sm }]}>
        {/* Back Button */}
        <GhostButton
          onPress={onBackPress}
          style={styles.iconButton}
          paddingHorizontal={Spacing.sm}
          paddingVertical={Spacing.sm}
        >
          <ArrowLeft size={24} color={BrandColors.primary} strokeWidth={2} />
        </GhostButton>

        {/* Center Content: Mechanics Count + Services */}
        <View style={styles.centerContent}>
          <Text size="xs" weight="regular" color={BrandColors.secondary} center>
            {mechanicsCount} Mechanics Near You
          </Text>
          <Text size="md" weight="semiBold" color={BrandColors.primary} center numberOfLines={1}>
            {selectedServicesText}
          </Text>
        </View>

        {/* Spacer to balance back button */}
        <View style={styles.spacer} />
      </View>

      {/* Mechanic Filter Tabs */}
      <Animated.View style={[styles.mechanicFilters, mechanicFiltersAnimatedStyle]}>
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
      </Animated.View>
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  iconButton: {
    borderRadius: BorderRadius.md,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
  },
  spacer: {
    width: 40,
  },
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
