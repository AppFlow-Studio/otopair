/**
 * DiscoveryTabs
 *
 * PURPOSE: Service category tabs for discovery mode (bottom portion of TopBar)
 *
 * USED IN: TopBar (discovery mode)
 *
 * OWNER: Waleed Mansour
 */

import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";

import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { SheetDrivenAnimation } from "@/constants/animations";
import type { ServiceCategory } from "@/stores/types/store.types";

// ============================================================================
// CONSTANTS
// ============================================================================

const SERVICE_TABS_HEIGHT = 60;

interface ServiceCategoryItem {
  id: ServiceCategory;
  label: string;
}

const SERVICE_CATEGORIES: ServiceCategoryItem[] = [
  { id: "basic_maintenance", label: "Basic\nMaintenance" },
  { id: "tires_wheels", label: "Tires &\nWheels" },
  { id: "brakes_suspension", label: "Brakes &\nSuspension" },
  { id: "system_diagnostics", label: "System\nDiagnostics" },
];

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
        {SERVICE_CATEGORIES.map((service) => {
          const isSelected = selectedService === service.id;
          return (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceTab}
              onPress={() => onServiceSelect?.(service.id)}
              activeOpacity={0.7}
            >
              <Text
                size="xs"
                weight={isSelected ? "semiBold" : "regular"}
                color={isSelected ? BrandColors.secondary : BrandColors.primary}
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
    gap: Spacing.xl,
  },
  serviceTab: {
    alignItems: "center",
    minWidth: 70,
  },
});
