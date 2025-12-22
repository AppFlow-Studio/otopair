/**
 * TopBar
 *
 * PURPOSE: Main top bar container with BlurView background. Renders different content
 *          based on the booking stage using the centralized transition hook.
 *          Uses custom Oto transitions for smooth stage changes.
 *
 * FLOW: discovery → service → mechanic → booking → confirmation
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * OWNER: Waleed Mansour
 */

import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { ArrowLeft, Settings2 } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandColors, GhostButton, Spacing, Text } from "@/components/shared-ui";
import { AnimationDuration } from "@/constants/animations";
import { SHOP_FILTER_OPTIONS } from "@/constants/filters";
import { BorderRadius, Shadows } from "@/constants/theme";
import { useBookingTransition } from "@/hooks/useBookingTransition";
import type { FilterOption, ServiceCategory } from "@/stores/types/store.types";
import { DiscoveryTabs, MechanicTabs, type MechanicFilterOption } from "./topbars";

// Re-export types for convenience
export type { FilterOption, ServiceCategory } from "@/stores/types/store.types";
export type { MechanicFilterOption } from "./topbars";

// ============================================================================
// TYPES
// ============================================================================

export interface TopBarProps {
  /** User's current location label */
  location: string;
  /** Number of mechanics available */
  mechanicsCount?: number;
  /** Text showing selected services (truncated) */
  selectedServicesText?: string;
  /** Shop/business name for booking details */
  shopName?: string;
  /** Called when a filter option is selected */
  onFilterSelect?: (filter: FilterOption) => void;
  /** Called when a service category tab is selected */
  onServiceSelect?: (service: ServiceCategory) => void;
  /** Currently selected service category */
  selectedService?: ServiceCategory | null;
  /** Called when a mechanic filter tab is selected */
  onMechanicFilterSelect?: (filter: MechanicFilterOption) => void;
  /** Currently selected mechanic filter */
  selectedMechanicFilter?: MechanicFilterOption;
  /** Animated index from bottom sheet */
  sheetAnimatedIndex?: SharedValue<number>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TopBar({
  location,
  mechanicsCount = 0,
  selectedServicesText = "",
  shopName = "",
  onFilterSelect,
  onServiceSelect,
  selectedService,
  onMechanicFilterSelect,
  selectedMechanicFilter,
  sheetAnimatedIndex,
}: TopBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ═══════════════ TRANSITION HOOK ═══════════════
  const { currentStage, topBarEntering, topBarExiting, crossfadeEntering, crossfadeExiting, goBack } =
    useBookingTransition();

  // Handle back navigation - routes back on service_selection/discovery, otherwise goes to previous booking stage
  const handleBackPress = useCallback(() => {
    // If on service_selection or discovery, do router back (exit booking flow)
    if (currentStage === "service_selection" || currentStage === "discovery") {
      if (router.canGoBack()) {
        router.back();
      } else {
        // If we can't go back (e.g. root of tab), force return to home
        router.replace("/(main-tabs)/home");
      }
    } else {
      // For all other stages, go to previous booking stage
      goBack();
    }
  }, [currentStage, router, goBack]);

  // Determine which mode we're in based on stage
  const isDiscoveryMode = currentStage === "discovery" || currentStage === "service_selection";
  const isMechanicMode = currentStage === "mechanic_selection";
  const isBookingDetailsMode = currentStage === "booking_details";
  const isPaymentMode = currentStage === "payment";
  const isConfirmationMode = currentStage === "confirmation";

  // Filter dropdown state (only for discovery mode)
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Animations for filter button (uses crossfade for subtle effect)
  const fadeIn = FadeIn.duration(AnimationDuration.standard);
  const fadeOut = FadeOut.duration(AnimationDuration.standard);

  // Filter handlers
  const handleFilterPress = () => setIsFilterOpen(true);
  const handleFilterDismiss = () => setIsFilterOpen(false);
  const handleFilterSelect = (option: FilterOption) => {
    setIsFilterOpen(false);
    onFilterSelect?.(option);
  };

  // Get current mode key for carousel-style transitions
  const getModeKey = () => {
    if (isConfirmationMode) return "confirmation";
    if (isPaymentMode) return "payment";
    if (isBookingDetailsMode) return "booking";
    if (isMechanicMode) return "mechanic";
    return "discovery";
  };

  const modeKey = getModeKey();

  // Center content data based on mode
  const centerData = {
    discovery: { label: "Your Location", value: location },
    mechanic: { label: `${mechanicsCount} Mechanics Near You`, value: selectedServicesText },
    booking: { label: "Book Appointment", value: shopName },
    payment: { label: shopName, value: "Review & Pay" },
    confirmation: { label: "Booking Complete", value: shopName || "Thank You!" },
  };

  return (
    <BlurView intensity={60} tint="light" style={styles.container}>
      <View style={styles.frostedOverlay} />

      {/* Top Row: Back, Center, Right */}
      <View style={[styles.topRow, { paddingTop: insets.top + Spacing.sm }]}>
        {/* Back Button - Screen Navigation */}
        <GhostButton
          onPress={handleBackPress}
          style={styles.iconButton}
          paddingHorizontal={Spacing.sm}
          paddingVertical={Spacing.sm}
        >
          <ArrowLeft size={24} color={BrandColors.primary} strokeWidth={2} />
        </GhostButton>

        {/* Center Content - Uses Oto top bar transitions */}
        <View style={styles.centerWrapper}>
          <Animated.View
            key={modeKey}
            entering={topBarEntering}
            exiting={topBarExiting}
            style={styles.centerContentAbsolute}
          >
            <Text size="xs" weight="regular" color={BrandColors.secondary} center>
              {centerData[modeKey].label}
            </Text>
            <Text size="md" weight="semiBold" color={BrandColors.primary} center numberOfLines={1}>
              {centerData[modeKey].value}
            </Text>
          </Animated.View>
        </View>

        {/* Right Side - Filter (crossfades) or Spacer */}
        {isDiscoveryMode ? (
          <Animated.View key="filter" entering={crossfadeEntering} exiting={crossfadeExiting}>
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

      {/* Bottom Tabs - Stage-specific with crossfade transitions */}
      {isDiscoveryMode && (
        <Animated.View entering={crossfadeEntering} exiting={crossfadeExiting}>
          <DiscoveryTabs
            onServiceSelect={onServiceSelect}
            selectedService={selectedService}
            sheetAnimatedIndex={sheetAnimatedIndex}
          />
        </Animated.View>
      )}
      {isMechanicMode && (
        <Animated.View entering={crossfadeEntering} exiting={crossfadeExiting}>
          <MechanicTabs
            onMechanicFilterSelect={onMechanicFilterSelect}
            selectedMechanicFilter={selectedMechanicFilter}
            sheetAnimatedIndex={sheetAnimatedIndex}
          />
        </Animated.View>
      )}
      {/* booking_details and confirmation modes have no tabs */}

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
    backgroundColor: "rgba(255, 255, 255, 0.5)",
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
    justifyContent: "center",
    minHeight: 40,
  },
  centerContentAbsolute: {
    position: "absolute",
    left: 0,
    right: 0,
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
