/**
 * ServiceBottomSheet
 *
 * PURPOSE: Simplified booking flow bottom sheet for service discovery
 *          and selection on the map screen. After mechanic selection,
 *          navigation continues to page-based booking flow.
 *
 * FLOW: discovery → service_selection → mechanic_selection → [navigates to pages]
 *
 * USED IN: app/(main-tabs)/home/map.tsx
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
import type { MechanicFilterOption } from "./sheets/MechanicSelectionContent";
import { MechanicSelectionContent } from "./sheets/MechanicSelectionContent";
import { ServiceSelectionContent } from "./sheets/ServiceSelectionContent";

// 5. Constants, hooks, types, stores
import { BorderRadius, Shadows } from "@/constants/theme";
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

// Snap points for different stages (simplified - only discovery, service, mechanic)
const SNAP_POINTS_CONFIG = {
  // Discovery & Service Selection: collapsed (22%) and expanded (75%)
  discovery: { collapsed: 22, expanded: 80 },
  service_selection: { collapsed: 22, expanded: 75 },
  // Mechanic Selection: slightly taller
  mechanic_selection: { collapsed: 22, expanded: 80 },
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
  const animatedIndex = useSharedValue(0);

  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();
  const { currentStage, sheetEntering, sheetExiting } = useBookingTransition();

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

  // Expand sheet when stage changes (except discovery)
  useEffect(() => {
    if (currentStage !== "discovery" && bottomSheetRef.current) {
      bottomSheetRef.current.snapToIndex(1);
    }
  }, [currentStage]);

  // ═══════════════ COMPUTED VALUES ═══════════════
  const offsetPercent = (offsetY / SCREEN_HEIGHT) * 90;

  // Get snap points config, fallback to discovery for stages handled by pages
  const stageConfig =
    currentStage === "discovery" || currentStage === "service_selection" || currentStage === "mechanic_selection"
      ? SNAP_POINTS_CONFIG[currentStage]
      : SNAP_POINTS_CONFIG.discovery;

  const snapPoints = useMemo(
    () => [`${stageConfig.collapsed - offsetPercent}%`, `${stageConfig.expanded - offsetPercent}%`],
    [stageConfig, offsetPercent]
  );

  // Initial index: expanded (1) for non-discovery stages, collapsed (0) for discovery
  const initialIndex = currentStage === "discovery" ? 0 : 1;

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

  // Mechanic selection complete -> navigation to pages is handled by MechanicSelectionContent
  const handleMechanicSelected = useCallback(() => {
    // Navigation is handled internally by MechanicSelectionContent
  }, []);

  // Book again -> reset flow
  // const handleBookAgain = useCallback(() => {
  //   reset();
  //   bottomSheetRef.current?.snapToIndex(0);
  // }, [reset]);

  // ═══════════════ FOOTER ANIMATED STYLE ═══════════════
  // Hide footer when sheet is collapsed (index < 0.5)
  const footerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: animatedIndex.value >= 0.5 ? 1 : 0,
    pointerEvents: animatedIndex.value >= 0.5 ? "auto" : "none",
  }));

  // Bottom inset includes safe area
  const footerBottomInset = insets.bottom;

  // ═══════════════ FOOTER RENDERER ═══════════════
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => {
      // Only show footer for service selection stage
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
    switch (currentStage) {
      case "discovery":
      case "service_selection":
        return (
          <Animated.View
            key="service"
            entering={sheetEntering}
            exiting={sheetExiting}
            style={styles.contentWrapper}
          >
            <ServiceSelectionContent />
          </Animated.View>
        );

      case "mechanic_selection":
        return (
          <Animated.View
            key="mechanic"
            entering={sheetEntering}
            exiting={sheetExiting}
            style={styles.contentWrapper}
          >
            <MechanicSelectionContent
              onSelectMechanic={handleMechanicSelected}
              mechanicFilter={mechanicFilter}
            />
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
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      index={initialIndex}
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
