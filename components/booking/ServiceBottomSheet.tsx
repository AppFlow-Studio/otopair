/**
 * ServiceBottomSheet
 *
 * PURPOSE: Main booking flow bottom sheet that displays different content
 *          based on the current booking stage. Uses custom Oto transitions
 *          for smooth stage-to-stage animations.
 *
 * FLOW: discovery → service_selection → mechanic_selection → booking_details → payment → confirmation
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - offsetY (number): Vertical offset to shift bottom sheet down (pixels) [optional]
 *   - onAnimatedIndexChange ((animatedIndex: SharedValue<number>) => void): Callback to expose animated index [optional]
 *   - mechanicFilter (MechanicFilterOption): Currently selected mechanic filter from TopBar [optional]
 *
 * EXAMPLE:
 *   <ServiceBottomSheet
 *     offsetY={35}
 *     onAnimatedIndexChange={(index) => setSheetAnimatedIndex(index)}
 *     mechanicFilter="available_now"
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import BottomSheet, { BottomSheetFooterProps } from "@gorhom/bottom-sheet";
import Animated, { SharedValue, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing } from "@/components/shared-ui";

// 4. Flow-specific components
import { ServiceSelectionFooter } from "./footers";
import { AddMoreServicesSheet, AddMoreServicesSheetRef } from "./sheets/AddMoreServicesSheet";
import { CollapsedContent } from "./sheets/CollapsedContent";
import { ConfirmationModal, ConfirmationModalRef } from "./sheets/ConfirmationModal";
import type { MechanicFilterOption } from "./sheets/MechanicSelectionContent";
import { MechanicSelectionContent } from "./sheets/MechanicSelectionContent";
import { ServiceSelectionContent } from "./sheets/ServiceSelectionContent";

// 5. Constants, hooks, types, stores
import { BorderRadius, Layout, Shadows } from "@/constants/theme";
import { useBookingTransition } from "@/hooks/useBookingTransition";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// TYPES
// ============================================================================

interface ServiceBottomSheetProps {
  /** Vertical offset to shift bottom sheet down (pixels) */
  offsetY?: number;
  /** Callback to expose animated index to parent */
  onAnimatedIndexChange?: (animatedIndex: SharedValue<number>) => void;
  /** Currently selected mechanic filter from TopBar */
  mechanicFilter?: MechanicFilterOption;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Snap points for different stages
const SNAP_POINTS_CONFIG = {
  // Discovery & Service Selection: collapsed (22%) and expanded (75%)
  discovery: { collapsed: 22, expanded: 75 },
  service_selection: { collapsed: 22, expanded: 75 },
  // Mechanic Selection: slightly taller
  mechanic_selection: { collapsed: 22, expanded: 80 },
  // Booking Details: full height
  booking_details: { collapsed: 22, expanded: 85 },
  // Payment: full height
  payment: { collapsed: 22, expanded: 85 },
  // Confirmation: centered
  confirmation: { collapsed: 22, expanded: 70 },
} as const;

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceBottomSheet({
  offsetY = 0,
  onAnimatedIndexChange,
  mechanicFilter = "available_now",
}: ServiceBottomSheetProps) {
  // ═══════════════ REFS ═══════════════
  const bottomSheetRef = useRef<BottomSheet>(null);
  const addMoreSheetRef = useRef<AddMoreServicesSheetRef>(null);
  const confirmationModalRef = useRef<ConfirmationModalRef>(null);
  const animatedIndex = useSharedValue(0);

  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();
  const { currentStage, sheetEntering, sheetExiting, goNext, reset } = useBookingTransition();

  // ═══════════════ STORE ═══════════════
  const setBookingStage = useBookingStore((state) => state.setBookingStage);
  // Call functions inside selector so Zustand tracks value changes
  const selectedCount = useBookingStore((state) => state.getSelectedServicesCount());
  const selectedTotal = useBookingStore((state) => state.getSelectedServicesTotal());

  // ═══════════════ COMPUTED ═══════════════
  const hasSelection = selectedCount > 0;
  const isServiceStage = currentStage === "discovery" || currentStage === "service_selection";

  // ═══════════════ EFFECTS ═══════════════
  // Expose animated index to parent
  useEffect(() => {
    onAnimatedIndexChange?.(animatedIndex);
  }, [animatedIndex, onAnimatedIndexChange]);

  // Expand sheet when stage changes (except discovery and confirmation)
  useEffect(() => {
    if (currentStage !== "discovery" && currentStage !== "confirmation" && bottomSheetRef.current) {
      bottomSheetRef.current.snapToIndex(1);
    }
  }, [currentStage]);

  // Open/close confirmation modal based on stage
  useEffect(() => {
    if (currentStage === "confirmation") {
      confirmationModalRef.current?.open();
    } else {
      confirmationModalRef.current?.close();
    }
  }, [currentStage]);

  // ═══════════════ COMPUTED VALUES ═══════════════
  const offsetPercent = (offsetY / SCREEN_HEIGHT) * 100;
  const stageConfig = SNAP_POINTS_CONFIG[currentStage] || SNAP_POINTS_CONFIG.discovery;

  const snapPoints = useMemo(
    () => [`${stageConfig.collapsed - offsetPercent}%`, `${stageConfig.expanded - offsetPercent}%`],
    [stageConfig, offsetPercent]
  );

  // ═══════════════ ANIMATED STYLES ═══════════════
  // Collapsed content visibility (show when index < 0.5)
  const collapsedStyle = useAnimatedStyle(() => ({
    opacity: animatedIndex.value < 0.5 ? 1 : 0,
    zIndex: animatedIndex.value < 0.5 ? 1 : 0,
    pointerEvents: animatedIndex.value < 0.5 ? "auto" : "none",
  }));

  // Expanded content visibility (show when index >= 0.5)
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: animatedIndex.value >= 0.5 ? 1 : 0,
    zIndex: animatedIndex.value >= 0.5 ? 1 : 0,
    pointerEvents: animatedIndex.value >= 0.5 ? "auto" : "none",
  }));

  // ═══════════════ HANDLERS ═══════════════
  // Service selection complete -> go to mechanic selection
  const handleServicesSelected = useCallback(() => {
    setBookingStage("mechanic_selection", "forward");
  }, [setBookingStage]);

  // Mechanic selection complete -> handled by MechanicSelectionContent via setBookingTypeAndProceed
  const handleMechanicSelected = useCallback(() => {
    // Navigation is handled internally by MechanicSelectionContent
  }, []);

  // Book again -> reset flow
  const handleBookAgain = useCallback(() => {
    reset();
    bottomSheetRef.current?.snapToIndex(0);
  }, [reset]);

  // ═══════════════ FOOTER ANIMATED STYLE ═══════════════
  // Hide footer when sheet is collapsed (index < 0.5)
  const footerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: animatedIndex.value >= 0.5 ? 1 : 0,
    pointerEvents: animatedIndex.value >= 0.5 ? "auto" : "none",
  }));

  // Bottom inset includes safe area + tab bar height
  const footerBottomInset = insets.bottom + Layout.tabBarHeight;

  // ═══════════════ FOOTER RENDERER ═══════════════
  // Using footerComponent so the sheet knows about the footer and adjusts scroll area automatically
  // Each stage has its own modular footer component
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => {
      // Service selection stage footer
      if (isServiceStage) {
        return (
          <ServiceSelectionFooter
            {...props}
            bottomInset={footerBottomInset}
            animatedStyle={footerAnimatedStyle}
            hasSelection={hasSelection}
            selectedCount={selectedCount}
            selectedTotal={selectedTotal}
            onConfirm={handleServicesSelected}
          />
        );
      }

      // booking_details and payment stages are handled by FullScreenBookingView
      // Confirmation stage uses a separate modal (no footer here)
      // Mechanic selection has no footer (buttons are in MechanicCard)
      return null;
    },
    [
      isServiceStage,
      footerBottomInset,
      footerAnimatedStyle,
      hasSelection,
      selectedCount,
      selectedTotal,
      handleServicesSelected,
    ]
  );

  // ═══════════════ CONTENT RENDERER ═══════════════
  const renderStageContent = () => {
    // Get unique key for the current stage to trigger transitions
    const stageKey = currentStage;

    switch (currentStage) {
      case "discovery":
      case "service_selection":
        return (
          <Animated.View key="service" entering={sheetEntering} exiting={sheetExiting} style={styles.contentWrapper}>
            <ServiceSelectionContent />
          </Animated.View>
        );

      case "mechanic_selection":
        return (
          <Animated.View key="mechanic" entering={sheetEntering} exiting={sheetExiting} style={styles.contentWrapper}>
            <MechanicSelectionContent onSelectMechanic={handleMechanicSelected} mechanicFilter={mechanicFilter} />
          </Animated.View>
        );

      // booking_details and payment stages are handled by FullScreenBookingView
      // Confirmation stage uses a separate detached modal (ConfirmationModal)
      case "booking_details":
      case "payment":
      case "confirmation":
      default:
        return null;
    }
  };

  // ═══════════════ RENDER ═══════════════
  return (
    <>
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
        footerComponent={renderFooter}
      >
        {/* Collapsed State - visibility based on animated position */}
        <Animated.View style={[styles.collapsedContent, styles.overlayContent, collapsedStyle]}>
          <CollapsedContent bookingStage={currentStage} />
        </Animated.View>

        {/* Expanded State - stage-based content with Oto transitions */}
        <View style={styles.expandedContainer}>
          <Animated.View style={[styles.expandedContent, expandedStyle]}>{renderStageContent()}</Animated.View>
        </View>
      </BottomSheet>

      {/* Add More Services Sheet - Rendered as sibling to stack on top */}
      <AddMoreServicesSheet ref={addMoreSheetRef} />

      {/* Confirmation Modal - Detached floating modal for booking success */}
      <ConfirmationModal
        ref={confirmationModalRef}
        onBackToHome={handleBookAgain}
        onAddToCalendar={() => {
          // TODO: Implement calendar integration
          console.log("Add to calendar");
        }}
      />
    </>
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
  overlayContent: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  collapsedContent: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  expandedContainer: {
    flex: 1,
  },
  expandedContent: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
});
