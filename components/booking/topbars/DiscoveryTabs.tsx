/**
 * DiscoveryTabs
 *
 * PURPOSE: Service category tabs for discovery mode (bottom portion of TopBar)
 *
 * USED IN: TopBar (discovery mode)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";

// 2. Third-party libraries
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { SheetDrivenAnimation } from "@/constants/animations";
import { BorderRadius } from "@/constants/theme";
import type { ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// CONSTANTS
// ============================================================================

const SERVICE_TABS_HEIGHT = 70;

// ============================================================================
// TYPES
// ============================================================================

export interface DiscoveryTabsProps {
  /** Called when a service category tab is selected */
  onServiceSelect?: (service: ServiceCategory) => void;
  /** Currently selected service category */
  selectedService?: ServiceCategory | null;
  /** Animated index from bottom sheet */
  sheetAnimatedIndex?: SharedValue<number>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DiscoveryTabs({ onServiceSelect, selectedService, sheetAnimatedIndex }: DiscoveryTabsProps) {
  const getServiceCategories = useBookingStore((state) => state.getServiceCategories);
  const serviceCategories = getServiceCategories();

  // Animation for service tabs (sheet-driven: fade out when expanded)
  const serviceTabsAnimatedStyle = useAnimatedStyle(() => {
    if (!sheetAnimatedIndex) {
      return { opacity: 1, height: SERVICE_TABS_HEIGHT };
    }

    const opacity = SheetDrivenAnimation.fadeOut(sheetAnimatedIndex.value);
    const height = SheetDrivenAnimation.heightCollapse(sheetAnimatedIndex.value, SERVICE_TABS_HEIGHT);

    return { opacity, height, overflow: "hidden" };
  }, [sheetAnimatedIndex]);

  return (
    <Animated.View style={serviceTabsAnimatedStyle}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceTabs}>
        {serviceCategories.map((service) => {
          const isSelected = selectedService === service.key;
          return (
            <TouchableOpacity
              key={service.key}
              style={[styles.serviceTab, isSelected && styles.serviceTabSelected]}
              onPress={() => onServiceSelect?.(service.key)}
              activeOpacity={0.7}
            >
              <Text
                size="xs"
                weight={isSelected ? "semiBold" : "regular"}
                color={isSelected ? BrandColors.white : BrandColors.primary}
                center
              >
                {service.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  serviceTabs: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  serviceTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: "transparent",
  },
  serviceTabSelected: {
    backgroundColor: BrandColors.primary,
  },
});
