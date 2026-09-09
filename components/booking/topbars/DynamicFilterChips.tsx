/**
 * DynamicFilterChips
 *
 * PURPOSE: Displays dynamic filter chips from search bar (bottom portion of TopBar)
 *          These filters are removable and adjust based on search results
 *
 * USED IN: TopBar (discovery mode when filters are active)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { X } from "lucide-react-native";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { SheetDrivenAnimation } from "@/constants/animations";
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// CONSTANTS
// ============================================================================

const FILTER_CHIPS_HEIGHT = 50;

// ============================================================================
// TYPES
// ============================================================================

export interface DynamicFilterChipsProps {
  /** Array of active filter labels to display */
  filters: string[];
  /** Called when a filter chip is removed */
  onRemoveFilter?: (filter: string) => void;
  /** Animated index from bottom sheet */
  sheetAnimatedIndex?: SharedValue<number>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DynamicFilterChips({
  filters,
  onRemoveFilter,
  sheetAnimatedIndex,
}: DynamicFilterChipsProps) {
  // Animation for filter chips (sheet-driven: fade out when expanded)
  const filterChipsAnimatedStyle = useAnimatedStyle(() => {
    if (!sheetAnimatedIndex) {
      return { opacity: 1, height: FILTER_CHIPS_HEIGHT };
    }

    const opacity = SheetDrivenAnimation.fadeOut(sheetAnimatedIndex.value);
    const height = SheetDrivenAnimation.heightCollapse(sheetAnimatedIndex.value, FILTER_CHIPS_HEIGHT);

    return { opacity, height, overflow: "hidden" };
  }, [sheetAnimatedIndex]);

  // Don't render if no filters
  if (filters.length === 0) {
    return null;
  }

  return (
    <Animated.View style={filterChipsAnimatedStyle}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChips}
      >
        {filters.map((filter) => (
          <View key={filter} style={styles.filterChip}>
            <Text size="xs" weight="medium" color={BrandColors.white}>
              {filter}
            </Text>
            {onRemoveFilter && (
              <TouchableOpacity
                onPress={() => onRemoveFilter(filter)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.removeButton}
              >
                <X size={14} color={BrandColors.white} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  filterChips: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: BrandColors.primary,
    gap: Spacing.xs,
  },
  removeButton: {
    padding: 2,
  },
});
