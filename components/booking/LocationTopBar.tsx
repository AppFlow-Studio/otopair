/**
 * LocationTopBar
 *
 * PURPOSE: Displays a navigation bar with back button, location info, filter dropdown,
 *          and service category tabs. Supports two modes:
 *          - discovery: Shows location, filter dropdown, and service tabs
 *          - mechanic_selection: Shows mechanics count, services summary, and filter tabs
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * OWNER: Waleed Mansour
 */

import { BrandColors, GhostButton, Spacing, Text } from "@/components/shared-ui";
import { SheetDrivenAnimation } from "@/constants/animations";
import { BorderRadius, Shadows } from "@/constants/theme";
import type { FilterOption, ServiceCategory } from "@/stores/types/store.types";
import { BlurView } from "expo-blur";
import { ArrowLeft, Settings2 } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Re-export types for convenience
export type { FilterOption, ServiceCategory } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

export type TopBarMode = "discovery" | "mechanic_selection";
export type MechanicFilterOption = "available_now" | "distance" | "rating";

interface FilterOptionItem {
  id: FilterOption;
  label: string;
}

interface ServiceCategoryItem {
  id: ServiceCategory;
  label: string;
}

interface MechanicFilterItem {
  id: MechanicFilterOption;
  label: string;
}

const FILTER_OPTIONS: FilterOptionItem[] = [
  { id: "available_now", label: "Available Now" },
  { id: "top_rated", label: "Top Rated" },
  { id: "specialists", label: "Specialists" },
];

const SERVICE_CATEGORIES: ServiceCategoryItem[] = [
  { id: "basic_maintenance", label: "Basic\nMaintenance" },
  { id: "tires_wheels", label: "Tires &\nWheels" },
  { id: "brakes_suspension", label: "Brakes &\nSuspension" },
  { id: "system_diagnostics", label: "System\nDiagnostics" },
];

const MECHANIC_FILTERS: MechanicFilterItem[] = [
  { id: "available_now", label: "Available Now" },
  { id: "distance", label: "Distance" },
  { id: "rating", label: "Rating" },
];

// Height of service tabs section for animation
const SERVICE_TABS_HEIGHT = 60;

// ============================================================================
// DISCRIMINATED UNION PROPS
// ============================================================================

interface BaseProps {
  /** Called when back button is tapped */
  onBackPress?: () => void;
}

interface DiscoveryModeProps extends BaseProps {
  mode?: "discovery";
  /** Label text shown above the location */
  label?: string;
  /** The main location text to display */
  location: string;
  /** Called when a filter option is selected */
  onFilterSelect?: (filter: FilterOption) => void;
  /** Called when a service category tab is selected */
  onServiceSelect?: (service: ServiceCategory) => void;
  /** Currently selected service category (null = none selected) */
  selectedService?: ServiceCategory | null;
  /** Animated index from bottom sheet (0 = collapsed, 1 = expanded) */
  sheetAnimatedIndex?: SharedValue<number>;
}

interface MechanicSelectionModeProps extends BaseProps {
  mode: "mechanic_selection";
  /** Number of mechanics available */
  mechanicsCount: number;
  /** Text showing selected services (truncated) */
  selectedServicesText: string;
  /** Called when a mechanic filter tab is selected */
  onMechanicFilterSelect?: (filter: MechanicFilterOption) => void;
  /** Currently selected mechanic filter */
  selectedMechanicFilter?: MechanicFilterOption;
}

export type LocationTopBarProps = DiscoveryModeProps | MechanicSelectionModeProps;

// ============================================================================
// COMPONENT
// ============================================================================

export function LocationTopBar(props: LocationTopBarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const isDiscoveryMode = props.mode !== "mechanic_selection";

  // Animation for service tabs (only in discovery mode)
  const serviceTabsAnimatedStyle = useAnimatedStyle(() => {
    if (!isDiscoveryMode) {
      return { opacity: 1, height: SERVICE_TABS_HEIGHT };
    }

    const discoveryProps = props as DiscoveryModeProps;
    if (!discoveryProps.sheetAnimatedIndex) {
      return { opacity: 1, height: SERVICE_TABS_HEIGHT };
    }

    // Fade out first (0 → 0.25), then collapse height (0.25 → 0.5)
    const opacity = SheetDrivenAnimation.fadeOut(discoveryProps.sheetAnimatedIndex.value);
    const height = SheetDrivenAnimation.heightCollapse(discoveryProps.sheetAnimatedIndex.value, SERVICE_TABS_HEIGHT);

    return { opacity, height };
  }, [isDiscoveryMode, props]);

  const handleFilterPress = () => {
    setIsFilterOpen(true);
  };

  const handleOptionSelect = (option: FilterOption) => {
    setIsFilterOpen(false);
    if (isDiscoveryMode) {
      (props as DiscoveryModeProps).onFilterSelect?.(option);
    }
  };

  const handleDismiss = () => {
    setIsFilterOpen(false);
  };

  const handleServicePress = (service: ServiceCategory) => {
    if (isDiscoveryMode) {
      (props as DiscoveryModeProps).onServiceSelect?.(service);
    }
  };

  const handleMechanicFilterPress = (filter: MechanicFilterOption) => {
    if (!isDiscoveryMode) {
      (props as MechanicSelectionModeProps).onMechanicFilterSelect?.(filter);
    }
  };

  // Get props based on mode
  const discoveryProps = isDiscoveryMode ? (props as DiscoveryModeProps) : null;
  const mechanicProps = !isDiscoveryMode ? (props as MechanicSelectionModeProps) : null;

  return (
    <BlurView intensity={85} tint="light" style={styles.container}>
      <View style={styles.frostedOverlay} />

      {/* Top Row: Back, Center Content, Right Button */}
      <View style={[styles.topRow, { paddingTop: insets.top + Spacing.sm }]}>
        {/* Back Button */}
        <GhostButton
          onPress={props.onBackPress}
          style={styles.iconButton}
          paddingHorizontal={Spacing.sm}
          paddingVertical={Spacing.sm}
        >
          <ArrowLeft size={24} color={BrandColors.primary} strokeWidth={2} />
        </GhostButton>

        {/* Center Content - differs by mode */}
        <View style={styles.centerContent}>
          {isDiscoveryMode ? (
            <>
              <Text size="xs" weight="regular" color={BrandColors.secondary} center>
                {discoveryProps?.label ?? "Your Location"}
              </Text>
              <Text size="md" weight="semiBold" color={BrandColors.primary} center numberOfLines={1}>
                {discoveryProps?.location ?? "Set Location"}
              </Text>
            </>
          ) : (
            <>
              <Text size="xs" weight="regular" color={BrandColors.secondary} center>
                {mechanicProps?.mechanicsCount ?? 0} Mechanics Near You
              </Text>
              <Text size="md" weight="semiBold" color={BrandColors.primary} center numberOfLines={1}>
                {mechanicProps?.selectedServicesText ?? ""}
              </Text>
            </>
          )}
        </View>

        {/* Right Button - Filter (discovery) or Spacer (mechanic) */}
        {isDiscoveryMode ? (
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
                    {FILTER_OPTIONS.map((option, index) => (
                      <React.Fragment key={option.id}>
                        <Pressable style={styles.dropdownOption} onPress={() => handleOptionSelect(option.id)}>
                          <Text size="md" weight="medium" color={BrandColors.primary}>
                            {option.label}
                          </Text>
                        </Pressable>
                        {index < FILTER_OPTIONS.length - 1 && <View style={styles.divider} />}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              </Pressable>
            </Modal>
          </View>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>

      {/* Bottom Section - Service Tabs (discovery) or Mechanic Filters (mechanic) */}
      {isDiscoveryMode ? (
        <Animated.View style={serviceTabsAnimatedStyle}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceTabs}>
            {SERVICE_CATEGORIES.map((service) => {
              const isSelected = discoveryProps?.selectedService === service.id;
              return (
                <TouchableOpacity
                  key={service.id}
                  style={styles.serviceTab}
                  onPress={() => handleServicePress(service.id)}
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
      ) : (
        <View style={styles.mechanicFilters}>
          {MECHANIC_FILTERS.map((filter) => {
            const isSelected = mechanicProps?.selectedMechanicFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                style={[styles.mechanicFilterTab, isSelected && styles.mechanicFilterTabSelected]}
                onPress={() => handleMechanicFilterPress(filter.id)}
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
      )}
    </BlurView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  frostedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
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
  spacer: {
    width: 40, // Match back button width for centering
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
