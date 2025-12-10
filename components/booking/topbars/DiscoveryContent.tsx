/**
 * DiscoveryContent
 *
 * PURPOSE: Top bar content for discovery mode - location info, filter dropdown, service tabs
 *
 * USED IN: TopBar (discovery mode)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { ArrowLeft, Settings2 } from "lucide-react-native";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, GhostButton, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { SheetDrivenAnimation } from "@/constants/animations";
import { SHOP_FILTER_OPTIONS } from "@/constants/filters";
import { SERVICE_CATEGORIES } from "@/constants/services";
import { BorderRadius, Shadows } from "@/constants/theme";
import type { FilterOption, ServiceCategory } from "@/stores/types/store.types";

// ============================================================================
// CONSTANTS
// ============================================================================

const SERVICE_TABS_HEIGHT = 60;

// ============================================================================
// TYPES
// ============================================================================

export interface DiscoveryContentProps {
  /** Label text shown above location (default: "Your Location") */
  label?: string;
  /** The main location text to display */
  location: string;
  /** Called when back button is tapped */
  onBackPress?: () => void;
  /** Called when a filter option is selected from dropdown */
  onFilterSelect?: (filter: FilterOption) => void;
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

export function DiscoveryContent({
  label = "Your Location",
  location,
  onBackPress,
  onFilterSelect,
  onServiceSelect,
  selectedService,
  sheetAnimatedIndex,
}: DiscoveryContentProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const insets = useSafeAreaInsets();

  // Animation for service tabs
  const serviceTabsAnimatedStyle = useAnimatedStyle(() => {
    if (!sheetAnimatedIndex) {
      return { opacity: 1, height: SERVICE_TABS_HEIGHT };
    }

    const opacity = SheetDrivenAnimation.fadeOut(sheetAnimatedIndex.value);
    const height = SheetDrivenAnimation.heightCollapse(sheetAnimatedIndex.value, SERVICE_TABS_HEIGHT);

    return { opacity, height };
  }, [sheetAnimatedIndex]);

  const handleFilterPress = () => {
    setIsFilterOpen(true);
  };

  const handleOptionSelect = (option: FilterOption) => {
    setIsFilterOpen(false);
    onFilterSelect?.(option);
  };

  const handleDismiss = () => {
    setIsFilterOpen(false);
  };

  return (
    <>
      {/* Top Row: Back, Location, Filter */}
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

        {/* Center Location Info */}
        <View style={styles.centerContent}>
          <Text size="xs" weight="regular" color={BrandColors.secondary} center>
            {label}
          </Text>
          <Text size="md" weight="semiBold" color={BrandColors.primary} center numberOfLines={1}>
            {location}
          </Text>
        </View>

        {/* Filter Button */}
        <View>
          <GhostButton
            onPress={handleFilterPress}
            style={styles.iconButton}
            paddingHorizontal={Spacing.sm}
            paddingVertical={Spacing.sm}
          >
            <Settings2 size={24} color={isFilterOpen ? BrandColors.secondary : BrandColors.primary} strokeWidth={2} />
          </GhostButton>

          {/* Filter Dropdown Modal */}
          <Modal visible={isFilterOpen} transparent animationType="fade" onRequestClose={handleDismiss}>
            <Pressable style={styles.modalOverlay} onPress={handleDismiss}>
              <View style={styles.dropdownContainer}>
                <View style={styles.dropdown}>
                  {SHOP_FILTER_OPTIONS.map((option, index) => (
                    <React.Fragment key={option.id}>
                      <Pressable style={styles.dropdownOption} onPress={() => handleOptionSelect(option.id)}>
                        <Text size="md" weight="medium" color={BrandColors.primary}>
                          {option.label}
                        </Text>
                      </Pressable>
                      {index < SHOP_FILTER_OPTIONS.length - 1 && <View style={styles.divider} />}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            </Pressable>
          </Modal>
        </View>
      </View>

      {/* Service Category Tabs */}
      <Animated.View style={serviceTabsAnimatedStyle}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceTabs}>
          {SERVICE_CATEGORIES.map((service) => {
            const isSelected = selectedService === service.key;
            return (
              <TouchableOpacity
                key={service.key}
                style={styles.serviceTab}
                onPress={() => onServiceSelect?.(service.key)}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  dropdownContainer: {
    position: "absolute",
    top: "13%",
    right: Spacing.lg,
  },
  dropdown: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.xs,
    ...Shadows.lg,
  },
  dropdownOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#E8E8E8",
    marginHorizontal: Spacing.sm,
  },
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
