/**
 * TopBar
 *
 * PURPOSE: Main top bar container with BlurView background. Renders different content
 *          based on the booking stage using the centralized transition hook.
 *
 * FLOW: discovery → service → mechanic → booking → confirmation
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - location (string): User's current location label
 *   - mechanicsCount (number): Number of mechanics available [optional]
 *   - selectedServicesText (string): Text showing selected services (truncated) [optional]
 *   - shopName (string): Shop/business name for booking details [optional]
 *   - onFilterSelect ((filter: FilterOption) => void): Called when filter selected [optional]
 *   - searchQuery (string): Current search query value [optional]
 *   - onSearchChange ((text: string) => void): Called when search query changes [optional]
 *   - onSearchSubmit (() => void): Called when search is submitted [optional]
 *   - activeFilters (string[]): Active filters from search bar (displayed as removable chips) [optional]
 *   - onRemoveFilter ((filter: string) => void): Called when a filter chip is removed [optional]
 *   - onMechanicFilterSelect ((filter: MechanicFilterOption) => void): Called when mechanic filter selected [optional]
 *   - selectedMechanicFilter (MechanicFilterOption): Currently selected mechanic filter [optional]
 *   - sheetAnimatedIndex (SharedValue<number>): Animated index from bottom sheet [optional]
 *
 * EXAMPLE:
 *   <TopBar
 *     location="New York, NY"
 *     searchQuery=""
 *     onSearchChange={(text) => setSearchQuery(text)}
 *     activeFilters={["Oil Change"]}
 *     onRemoveFilter={(filter) => console.log("Removed:", filter)}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useMemo, useState } from "react";
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
import { DynamicFilterChips, MechanicTabs, SearchBar, type MechanicFilterOption } from "./topbars";

// 5. Constants, hooks, types, stores
import { AnimationDuration } from "@/constants/animations";
import { SHOP_FILTER_OPTIONS } from "@/constants/filters";
import { BorderRadius } from "@/constants/theme";
import { useBookingTransition } from "@/hooks/useBookingTransition";
import type { FilterOption, ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";

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
  /** Current search query value */
  searchQuery?: string;
  /** Called when the search query changes */
  onSearchChange?: (text: string) => void;
  /** Called when search is submitted */
  onSearchSubmit?: () => void;
  /** Active filters from search bar (displayed as removable chips) */
  activeFilters?: string[];
  /** Called when a filter chip is removed */
  onRemoveFilter?: (filter: string) => void;
  /** Called when a mechanic filter tab is selected */
  onMechanicFilterSelect?: (filter: MechanicFilterOption) => void;
  /** Currently selected mechanic filter */
  selectedMechanicFilter?: MechanicFilterOption;
  /** Animated index from bottom sheet */
  sheetAnimatedIndex?: SharedValue<number>;
  /** Auto-focus the search bar on mount */
  autoFocusSearch?: boolean;
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
  searchQuery = "",
  onSearchChange,
  onSearchSubmit,
  activeFilters = [],
  onRemoveFilter,
  onMechanicFilterSelect,
  selectedMechanicFilter,
  sheetAnimatedIndex,
  autoFocusSearch = false,
}: TopBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ═══════════════ BOOKING STORE ═══════════════
  const selectedServiceCategory = useBookingStore((state) => state.selectedServiceCategory);
  const setSelectedServiceCategory = useBookingStore((state) => state.setSelectedServiceCategory);
  const getServiceCategories = useBookingStore((state) => state.getServiceCategories);

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

  // ═══════════════ CATEGORY FILTER CHIP ═══════════════
  // Get category label if a category is selected
  const categoryChipLabel = selectedServiceCategory
    ? getServiceCategories().find((cat) => cat.key === selectedServiceCategory)?.label
    : null;

  // Combine active filters with category chip
  const allFilters = categoryChipLabel ? [categoryChipLabel, ...activeFilters] : activeFilters;

  // Handle removing filters (including category)
  const handleRemoveFilterInternal = useCallback(
    (filter: string) => {
      if (filter === categoryChipLabel) {
        // Clear the category filter
        setSelectedServiceCategory(null);
      } else {
        // Pass to parent handler for other filters
        onRemoveFilter?.(filter);
      }
    },
    [categoryChipLabel, setSelectedServiceCategory, onRemoveFilter]
  );

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

      {/* Search Bar - Discovery mode */}
      {isDiscoveryMode && (
        <View style={styles.searchWrapper}>
          <Animated.View entering={crossfadeEntering} exiting={crossfadeExiting}>
            <SearchBar
              value={searchQuery}
              onChangeText={onSearchChange ?? (() => {})}
              onSubmit={onSearchSubmit}
              sheetAnimatedIndex={sheetAnimatedIndex}
              autoFocus={autoFocusSearch}
            />
          </Animated.View>
        </View>
      )}

      {/* Active Filter Chips - Discovery mode when filters are active (includes category chip) */}
      {isDiscoveryMode && allFilters.length > 0 && (
        <Animated.View entering={crossfadeEntering} exiting={crossfadeExiting}>
          <DynamicFilterChips
            filters={allFilters}
            onRemoveFilter={handleRemoveFilterInternal}
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
    // Note: overflow visible to allow SearchSuggestions dropdown to show
    overflow: "visible",
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
  searchWrapper: {
    position: "relative",
    zIndex: 100,
  },
});
