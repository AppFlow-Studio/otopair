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

import { CollapsedContent, MechanicSelectionContent, ServiceSelectionContent } from "./sheets";

// ============================================================================
// TYPES
// ============================================================================

interface ServiceBottomSheetProps {
  /** Called when user confirms service selection and proceeds to mechanic selection */
  onSelectServices?: () => void;
  /** Called when user confirms mechanic selection and proceeds to payment */
  onSelectMechanic?: () => void;
  /** Vertical offset to shift bottom sheet down (pixels) */
  offsetY?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STAGE_ORDER: BookingStage[] = ["discovery", "service_selection", "mechanic_selection", "payment", "confirmation"];

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceBottomSheet({ onSelectServices, onSelectMechanic, offsetY = 0 }: ServiceBottomSheetProps) {
  // ═══════════════ STATE-EFFECT: Refs ═══════════════
  const bottomSheetRef = useRef<BottomSheet>(null);
  const animatedIndex = useSharedValue(0);
  const previousStageRef = useRef<BookingStage>("service_selection");

  // ═══════════════ STATE-EFFECT: Store Subscriptions ═══════════════
  const bookingStage = useBookingStore((state) => state.bookingStage);
  const setBookingStage = useBookingStore((state) => state.setBookingStage);
  const nextBookingStage = useBookingStore((state) => state.nextBookingStage);

  // ═══════════════ STATE-EFFECT: Direction Tracking ═══════════════
  const [isForward, setIsForward] = useState(true);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    // Only animate if stage actually changed from previous
    if (previousStageRef.current !== bookingStage) {
      const prevIndex = STAGE_ORDER.indexOf(previousStageRef.current);
      const currIndex = STAGE_ORDER.indexOf(bookingStage);
      setIsForward(currIndex > prevIndex);
      setShouldAnimate(true); // Enable animation for this and all future transitions
      previousStageRef.current = bookingStage;
    }
  }, [bookingStage]);

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
    // Move to payment stage
    nextBookingStage();
    onSelectMechanic?.();
  }, [nextBookingStage, onSelectMechanic]);

  // ═══════════════ RENDER: Stage Content ═══════════════
  const renderExpandedContent = () => {
    // Use standardized slide transitions
    const { entering, exiting } = getSlideTransitionOrNone(shouldAnimate, isForward);

    switch (bookingStage) {
      case "mechanic_selection":
        return (
          <Animated.View key="mechanic_selection" entering={entering} exiting={exiting} style={styles.stageContainer}>
            <MechanicSelectionContent onSelectMechanic={handleSelectMechanic} />
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
          <Animated.View key="service_selection" entering={entering} exiting={exiting} style={styles.stageContainer}>
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
      {/* Collapsed State - "Swipe up for service list" */}
      <Animated.View style={[styles.collapsedContent, collapsedStyle]}>
        <CollapsedContent />
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
