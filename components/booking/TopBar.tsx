/**
 * TopBar
 *
 * PURPOSE: Main top bar container with BlurView background. Renders different content
 *          based on the booking stage mode.
 *
 * MODES:
 *   - discovery: Shows location, filter dropdown, and service tabs
 *   - mechanic_selection: Shows mechanics count, services summary, and filter tabs
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * OWNER: Waleed Mansour
 */

import { BlurView } from "expo-blur";
import React from "react";
import { StyleSheet, View } from "react-native";
import { SharedValue } from "react-native-reanimated";

import type { FilterOption, ServiceCategory } from "@/stores/types/store.types";
import { DiscoveryContent, MechanicSelectionContent, type MechanicFilterOption } from "./topbars";

// Re-export types for convenience
export type { FilterOption, ServiceCategory } from "@/stores/types/store.types";
export type { MechanicFilterOption } from "./topbars";

// ============================================================================
// TYPES
// ============================================================================

export type TopBarMode = "discovery" | "mechanic_selection";

interface BaseProps {
  /** Called when back button is tapped */
  onBackPress?: () => void;
}

export interface DiscoveryModeProps extends BaseProps {
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

export interface MechanicSelectionModeProps extends BaseProps {
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

export type TopBarProps = DiscoveryModeProps | MechanicSelectionModeProps;

// ============================================================================
// COMPONENT
// ============================================================================

export function TopBar(props: TopBarProps) {
  const isDiscoveryMode = props.mode !== "mechanic_selection";

  return (
    <BlurView intensity={85} tint="light" style={styles.container}>
      <View style={styles.frostedOverlay} />
      {isDiscoveryMode ? (
        <DiscoveryContent
          label={(props as DiscoveryModeProps).label}
          location={(props as DiscoveryModeProps).location}
          onBackPress={props.onBackPress}
          onFilterSelect={(props as DiscoveryModeProps).onFilterSelect}
          onServiceSelect={(props as DiscoveryModeProps).onServiceSelect}
          selectedService={(props as DiscoveryModeProps).selectedService}
          sheetAnimatedIndex={(props as DiscoveryModeProps).sheetAnimatedIndex}
        />
      ) : (
        <MechanicSelectionContent
          mechanicsCount={(props as MechanicSelectionModeProps).mechanicsCount}
          selectedServicesText={(props as MechanicSelectionModeProps).selectedServicesText}
          onBackPress={props.onBackPress}
          onMechanicFilterSelect={(props as MechanicSelectionModeProps).onMechanicFilterSelect}
          selectedMechanicFilter={(props as MechanicSelectionModeProps).selectedMechanicFilter}
        />
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
});
