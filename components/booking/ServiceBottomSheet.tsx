/**
 * ServiceBottomSheet
 *
 * PURPOSE: Container for the booking flow bottom sheet that orchestrates different content stages
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * STAGES:
 *   - discovery: Collapsed "Swipe up" state
 *   - service_selection: Service selection UI
 *   - mechanic_selection: Mechanic selection UI
 *   - payment: Payment flow (TODO)
 *   - confirmation: Booking confirmation (TODO)
 *
 * OWNER: Waleed Mansour
 */

import BottomSheet from "@gorhom/bottom-sheet";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { BrandColors, Spacing } from "@/components/shared-ui";
import { getSlideTransitionOrNone } from "@/constants/animations";
import { BorderRadius, Shadows } from "@/constants/theme";
import { BookingStage } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";

import { BookingDetailsContent, CollapsedContent, MechanicSelectionContent, ServiceSelectionContent } from "./sheets";
import type { MechanicFilterOption } from "./topbars";

// ============================================================================
// TYPES
// ============================================================================

interface ServiceBottomSheetProps {
  /** Called when user confirms service selection and proceeds to mechanic selection */
  onSelectServices?: () => void;
  /** Called when user confirms mechanic selection and proceeds to payment */
  onSelectMechanic?: () => void;
  /** Called when user presses back in mechanic selection (for coordinated animation) */
  onMechanicBackPress?: () => void;
  /** Called when user confirms the booking */
  onConfirmBooking?: () => void;
  /** Called when user presses back in booking details (for coordinated animation) */
  onBookingDetailsBackPress?: () => void;
  /** Vertical offset to shift bottom sheet down (pixels) */
  offsetY?: number;
  /** Callback to expose the animated index for parent components */
  onAnimatedIndexChange?: (animatedIndex: Animated.SharedValue<number>) => void;
  /** Currently selected mechanic filter from TopBar */
  mechanicFilter?: MechanicFilterOption;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STAGE_ORDER: BookingStage[] = [
  "discovery",
  "service_selection",
  "mechanic_selection",
  "booking_details",
  "payment",
  "confirmation",
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceBottomSheet({
  onSelectServices,
  onSelectMechanic,
  onMechanicBackPress,
  onConfirmBooking,
  onBookingDetailsBackPress,
  offsetY = 0,
  onAnimatedIndexChange,
  mechanicFilter = "available_now",
}: ServiceBottomSheetProps) {
  // ═══════════════ STATE-EFFECT: Refs ═══════════════
  const bottomSheetRef = useRef<BottomSheet>(null);
  const animatedIndex = useSharedValue(0);

  // ═══════════════ STATE-EFFECT: Expose animated index to parent ═══════════════
  useEffect(() => {
    onAnimatedIndexChange?.(animatedIndex);
  }, [animatedIndex, onAnimatedIndexChange]);

  // ═══════════════ STATE-EFFECT: Store Subscriptions ═══════════════
  const bookingStage = useBookingStore((state) => state.bookingStage);
  const setBookingStage = useBookingStore((state) => state.setBookingStage);

  // ═══════════════ STATE-EFFECT: Direction Tracking ═══════════════
  // Track the rendered stage to detect changes and compute direction
  const [renderedStage, setRenderedStage] = useState<BookingStage>(bookingStage);
  const [isForward, setIsForward] = useState(true);

  // Compute direction synchronously when stage changes, then trigger re-render
  // Note: Sheet animations are inverted compared to TopBar, so we flip the direction
  if (renderedStage !== bookingStage) {
    const prevIndex = STAGE_ORDER.indexOf(renderedStage);
    const currIndex = STAGE_ORDER.indexOf(bookingStage);
    const newIsForward = currIndex < prevIndex; // Inverted for sheet

    // Schedule state updates (will batch and re-render with correct values)
    setRenderedStage(bookingStage);
    setIsForward(newIsForward);
  }

  // ═══════════════ STATE-EFFECT: Memoized Values ═══════════════
  const { height } = Dimensions.get("window");
  const offsetPercent = (offsetY / height) * 100;
  const snapPoints = useMemo(() => [`${22 - offsetPercent}%`, `${75 - offsetPercent}%`], [offsetPercent]);

  // ═══════════════ STATE-EFFECT: Animated Styles ═══════════════
  // Switch between collapsed and expanded at 0.5 threshold
  const collapsedStyle = useAnimatedStyle(() => ({
    opacity: animatedIndex.value < 0.5 ? 1 : 0,
    display: animatedIndex.value < 0.5 ? "flex" : "none",
  }));

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: animatedIndex.value >= 0.5 ? 1 : 0,
    display: animatedIndex.value >= 0.5 ? "flex" : "none",
  }));

  // ═══════════════ STATE-EFFECT: Handlers ═══════════════
  const handleSelectServices = useCallback(() => {
    // Move to mechanic selection stage
    setBookingStage("mechanic_selection");
    onSelectServices?.();
  }, [setBookingStage, onSelectServices]);

  const handleSelectMechanic = useCallback(() => {
    // Note: Stage transition is already handled by setBookingTypeAndProceed in MechanicSelectionContent
    // This callback is just for any additional parent logic
    onSelectMechanic?.();
  }, [onSelectMechanic]);

  // ═══════════════ RENDER: Stage Content ═══════════════
  const renderExpandedContent = () => {
    // Use standardized slide transitions - always animate
    const { entering } = getSlideTransitionOrNone(true, isForward);

    switch (bookingStage) {
      case "mechanic_selection":
        return (
          <Animated.View key="mechanic_selection" entering={entering} style={styles.stageContainer}>
            <MechanicSelectionContent
              onSelectMechanic={handleSelectMechanic}
              onBackPress={onMechanicBackPress}
              mechanicFilter={mechanicFilter}
            />
          </Animated.View>
        );
      case "booking_details":
        return (
          <Animated.View key="booking_details" entering={entering} style={styles.stageContainer}>
            <BookingDetailsContent onConfirmBooking={onConfirmBooking} onBackPress={onBookingDetailsBackPress} />
          </Animated.View>
        );
      case "payment":
        // TODO: PaymentContent
        return null;
      case "confirmation":
        // TODO: ConfirmationContent
        return null;
      case "discovery":
      case "service_selection":
      default:
        return (
          <Animated.View key="service_selection" entering={entering} style={styles.stageContainer}>
            <ServiceSelectionContent onSelectServices={handleSelectServices} />
          </Animated.View>
        );
    }
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      index={0}
      animatedIndex={animatedIndex}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      enableOverDrag={true}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handleContainer}
    >
      {/* Collapsed State - "Swipe up for service list" or "Swipe up to continue booking" */}
      <Animated.View style={[styles.collapsedContent, collapsedStyle]}>
        <CollapsedContent bookingStage={bookingStage} />
      </Animated.View>

      {/* Expanded State - Stage-specific content */}
      <Animated.View style={[styles.expandedContainer, expandedStyle]}>{renderExpandedContent()}</Animated.View>
    </BottomSheet>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: BrandColors.white,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    ...Shadows.lg,
  },
  handleContainer: {
    paddingVertical: Spacing.md,
  },
  handleIndicator: {
    backgroundColor: BrandColors.primary,
    width: 80,
    height: 5,
    borderRadius: BorderRadius.full,
  },
  collapsedContent: {
    // No padding - CollapsedContent handles its own
  },
  expandedContainer: {
    flex: 1,
    overflow: "hidden",
  },
  stageContainer: {
    flex: 1,
  },
});
