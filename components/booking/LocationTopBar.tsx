/**
 * LocationTopBar
 *
 * PURPOSE: Displays a navigation bar with back button, location info, filter dropdown,
 *          and service category tabs for dual-filter functionality
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - label (string): Label text shown above location (default: "Your Location")
 *   - location (string): The main location text to display
 *   - onBackPress (() => void): Called when back button is tapped
 *   - onFilterSelect ((filter: FilterOption) => void): Called when a filter option is selected
 *   - onServiceSelect ((service: ServiceCategory) => void): Called when a service tab is selected
 *   - selectedService (ServiceCategory): Currently selected service category
 *
 * EXAMPLE:
 *   <LocationTopBar
 *     label="Your Location"
 *     location="San Francisco, CA"
 *     onBackPress={() => router.back()}
 *     onFilterSelect={(filter) => console.log(filter)}
 *     onServiceSelect={(service) => console.log(service)}
 *     selectedService="basic_maintenance"
 *   />
 *
 * OWNER: Waleed Mansour
 */

import { BrandColors, GhostButton, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius, Shadows } from "@/constants/theme";
import type { FilterOption, ServiceCategory } from "@/stores/types/store.types";
import { BlurView } from "expo-blur";
import { ArrowLeft, Settings2 } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Re-export types for convenience
export type { FilterOption, ServiceCategory } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

interface FilterOptionItem {
  id: FilterOption;
  label: string;
}

interface ServiceCategoryItem {
  id: ServiceCategory;
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

interface LocationTopBarProps {
  /** Label text shown above the location */
  label?: string;
  /** The main location text to display */
  location: string;
  /** Called when back button is tapped */
  onBackPress?: () => void;
  /** Called when a filter option is selected */
  onFilterSelect?: (filter: FilterOption) => void;
  /** Called when a service category tab is selected */
  onServiceSelect?: (service: ServiceCategory) => void;
  /** Currently selected service category (null = none selected) */
  selectedService?: ServiceCategory | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LocationTopBar({
  label = "Your Location",
  location,
  onBackPress,
  onFilterSelect,
  onServiceSelect,
  selectedService,
}: LocationTopBarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const insets = useSafeAreaInsets();

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

  const handleServicePress = (service: ServiceCategory) => {
    onServiceSelect?.(service);
  };

  return (
    <BlurView intensity={85} tint="light" style={styles.container}>
      <View style={styles.frostedOverlay} />
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
          <Text size="md" weight="semiBold" color={BrandColors.primary} center>
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
      </View>

      {/* Service Category Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceTabs}>
        {SERVICE_CATEGORIES.map((service) => {
          const isSelected = selectedService === service.id;
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
});
