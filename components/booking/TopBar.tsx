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
 * ANIMATIONS:
 *   - Center content (location/mechanics info): Slides left/right on mode change
 *   - Filter icon: Fades in/out on mode change
 *   - Back button: Static (no animation)
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * OWNER: Waleed Mansour
 */

import { BlurView } from "expo-blur";
import { ArrowLeft, Settings2 } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandColors, GhostButton, Spacing, Text } from "@/components/shared-ui";
import { AnimationDuration, getSlideTransitionOrNone } from "@/constants/animations";
import { SHOP_FILTER_OPTIONS } from "@/constants/filters";
import { BorderRadius, Shadows } from "@/constants/theme";
import type { FilterOption, ServiceCategory } from "@/stores/types/store.types";
import { DiscoveryTabs, MechanicTabs, type MechanicFilterOption } from "./topbars";

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
  /** Animated index from bottom sheet (0 = collapsed, 1 = expanded) */
  sheetAnimatedIndex?: SharedValue<number>;
}

export type TopBarProps = DiscoveryModeProps | MechanicSelectionModeProps;

// ============================================================================
// COMPONENT
// ============================================================================

export function TopBar(props: TopBarProps) {
  const insets = useSafeAreaInsets();
  const isDiscoveryMode = props.mode !== "mechanic_selection";

  // Filter dropdown state (only for discovery mode)
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Track direction for slide animations
  const previousModeRef = useRef(isDiscoveryMode);
  const [isForward, setIsForward] = useState(true);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (previousModeRef.current !== isDiscoveryMode) {
      // Discovery → Mechanic = forward, Mechanic → Discovery = backward
      setIsForward(!isDiscoveryMode);
      setShouldAnimate(true);
      previousModeRef.current = isDiscoveryMode;
    }
  }, [isDiscoveryMode]);

  const { entering, exiting } = getSlideTransitionOrNone(shouldAnimate, isForward);
  const fadeIn = shouldAnimate ? FadeIn.duration(AnimationDuration.standard) : undefined;
  const fadeOut = shouldAnimate ? FadeOut.duration(AnimationDuration.standard) : undefined;

  // Filter handlers
  const handleFilterPress = () => setIsFilterOpen(true);
  const handleFilterDismiss = () => setIsFilterOpen(false);
  const handleFilterSelect = (option: FilterOption) => {
    setIsFilterOpen(false);
    (props as DiscoveryModeProps).onFilterSelect?.(option);
  };

  return (
    <BlurView intensity={85} tint="light" style={styles.container}>
      <View style={styles.frostedOverlay} />

      {/* Top Row: Back (static), Center (slides), Right (fades) */}
      <View style={[styles.topRow, { paddingTop: insets.top + Spacing.sm }]}>
        {/* Back Button - Static */}
        <GhostButton
          onPress={props.onBackPress}
          style={styles.iconButton}
          paddingHorizontal={Spacing.sm}
          paddingVertical={Spacing.sm}
        >
          <ArrowLeft size={24} color={BrandColors.primary} strokeWidth={2} />
        </GhostButton>

        {/* Center Content - Slides */}
        <View style={styles.centerWrapper}>
          {isDiscoveryMode ? (
            <Animated.View key="discovery-center" entering={entering} exiting={exiting} style={styles.centerContent}>
              <Text size="xs" weight="regular" color={BrandColors.secondary} center>
                {(props as DiscoveryModeProps).label ?? "Your Location"}
              </Text>
              <Text size="md" weight="semiBold" color={BrandColors.primary} center numberOfLines={1}>
                {(props as DiscoveryModeProps).location}
              </Text>
            </Animated.View>
          ) : (
            <Animated.View key="mechanic-center" entering={entering} exiting={exiting} style={styles.centerContent}>
              <Text size="xs" weight="regular" color={BrandColors.secondary} center>
                {(props as MechanicSelectionModeProps).mechanicsCount} Mechanics Near You
              </Text>
              <Text size="md" weight="semiBold" color={BrandColors.primary} center numberOfLines={1}>
                {(props as MechanicSelectionModeProps).selectedServicesText}
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Right Side - Filter (fades) or Spacer */}
        {isDiscoveryMode ? (
          <Animated.View key="filter" entering={fadeIn} exiting={fadeOut}>
            <GhostButton
              onPress={handleFilterPress}
              style={styles.iconButton}
              paddingHorizontal={Spacing.sm}
              paddingVertical={Spacing.sm}
            >
              <Settings2 size={24} color={isFilterOpen ? BrandColors.secondary : BrandColors.primary} strokeWidth={2} />
            </GhostButton>
          </Animated.View>
        ) : (
          <Animated.View key="spacer" entering={fadeIn} exiting={fadeOut} style={styles.spacer} />
        )}
      </View>

      {/* Bottom Tabs - Delegated to separate components */}
      {isDiscoveryMode ? (
        <DiscoveryTabs
          onServiceSelect={(props as DiscoveryModeProps).onServiceSelect}
          selectedService={(props as DiscoveryModeProps).selectedService}
          sheetAnimatedIndex={(props as DiscoveryModeProps).sheetAnimatedIndex}
        />
      ) : (
        <MechanicTabs
          onMechanicFilterSelect={(props as MechanicSelectionModeProps).onMechanicFilterSelect}
          selectedMechanicFilter={(props as MechanicSelectionModeProps).selectedMechanicFilter}
          sheetAnimatedIndex={(props as MechanicSelectionModeProps).sheetAnimatedIndex}
        />
      )}

      {/* Filter Dropdown Modal */}
      <Modal visible={isFilterOpen} transparent animationType="fade" onRequestClose={handleFilterDismiss}>
        <Pressable style={styles.modalOverlay} onPress={handleFilterDismiss}>
          <View style={styles.dropdownContainer}>
            <View style={styles.dropdown}>
              {SHOP_FILTER_OPTIONS.map((option, index) => (
                <React.Fragment key={option.id}>
                  <Pressable style={styles.dropdownOption} onPress={() => handleFilterSelect(option.id)}>
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
  centerWrapper: {
    flex: 1,
    overflow: "hidden",
  },
  centerContent: {
    alignItems: "center",
  },
  spacer: {
    width: 40,
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
});
