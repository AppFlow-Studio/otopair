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

// 1. React & React Native
import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { ArrowLeft, Settings2 } from "lucide-react-native";
import Animated, { FadeIn, FadeOut, SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, GhostButton, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { FilterDropdown } from "./shared";
import { DiscoveryTabs, MechanicTabs, type MechanicFilterOption } from "./topbars";

// 5. Constants, hooks, types, stores
import { AnimationDuration } from "@/constants/animations";
import { SHOP_FILTER_OPTIONS } from "@/constants/filters";
import { BorderRadius } from "@/constants/theme";
import { useBookingTransition } from "@/hooks/useBookingTransition";
import type { FilterOption, ServiceCategory } from "@/stores/types/store.types";

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
  const handleFilterSelect = (optionId: string) => {
    setIsFilterOpen(false);
    onFilterSelect?.(optionId as FilterOption);
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
      <View style={[styles.topRow, { paddingTop: insets.top + Spacing.xs }]}>
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

      {/* Filter Dropdown */}
      <FilterDropdown
        visible={isFilterOpen}
        options={SHOP_FILTER_OPTIONS}
        onSelect={handleFilterSelect}
        onDismiss={handleFilterDismiss}
      />
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
});
