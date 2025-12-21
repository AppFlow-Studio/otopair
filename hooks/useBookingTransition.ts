/**
 * useBookingTransition
 *
 * PURPOSE: Centralized, reusable hook for managing booking flow transitions
 *          with direction stored in Zustand for reliable animations.
 *          Uses custom Oto transitions instead of iOS-style slides.
 *
 * FLOW: discovery → service → mechanic → booking → payment → confirmation
 *
 * USAGE:
 *   const {
 *     entering, exiting,          // For content transitions
 *     topBarEntering, topBarExiting,  // For top bar transitions
 *     sheetEntering, sheetExiting,    // For bottom sheet content
 *     goTo, goBack, goNext
 *   } = useBookingTransition();
 *
 * OWNER: Waleed Mansour
 */

import {
  getOtoCrossfade,
  getOtoTransition,
  getSheetContentTransition,
  getTopBarTransition,
} from "@/constants/animations";
import { BookingStage } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useCallback } from "react";

// ============================================================================
// STAGE CONFIGURATION
// ============================================================================

/**
 * Ordered stages for the booking flow.
 * The order determines forward/backward direction.
 */
export const BOOKING_STAGES: BookingStage[] = [
  "discovery",
  "service_selection",
  "mechanic_selection",
  "booking_details",
  "payment",
  "confirmation",
];

/** Stage index lookup for fast direction computation */
const STAGE_INDEX: Record<BookingStage, number> = BOOKING_STAGES.reduce(
  (acc, stage, index) => ({ ...acc, [stage]: index }),
  {} as Record<BookingStage, number>
);

// ============================================================================
// TYPES
// ============================================================================

export interface BookingTransitionResult {
  /** Current booking stage from store */
  currentStage: BookingStage;
  /** Whether the transition is forward (true) or backward (false) */
  isForward: boolean;

  // === Primary Oto Transitions ===
  /** Reanimated entering animation config (Oto style) */
  entering: ReturnType<typeof getOtoTransition>["entering"];
  /** Reanimated exiting animation config (Oto style) */
  exiting: ReturnType<typeof getOtoTransition>["exiting"];

  // === Top Bar Transitions ===
  /** Entering animation for top bar content */
  topBarEntering: ReturnType<typeof getTopBarTransition>["entering"];
  /** Exiting animation for top bar content */
  topBarExiting: ReturnType<typeof getTopBarTransition>["exiting"];

  // === Bottom Sheet Content Transitions ===
  /** Entering animation for bottom sheet content */
  sheetEntering: ReturnType<typeof getSheetContentTransition>["entering"];
  /** Exiting animation for bottom sheet content */
  sheetExiting: ReturnType<typeof getSheetContentTransition>["exiting"];

  // === Crossfade Transitions (subtle) ===
  /** Subtle crossfade entering */
  crossfadeEntering: ReturnType<typeof getOtoCrossfade>["entering"];
  /** Subtle crossfade exiting */
  crossfadeExiting: ReturnType<typeof getOtoCrossfade>["exiting"];

  // === Navigation Actions ===
  /** Navigate to a specific stage */
  goTo: (stage: BookingStage) => void;
  /** Go to the next stage in the flow */
  goNext: () => void;
  /** Go to the previous stage in the flow */
  goBack: () => void;
  /** Reset the booking flow to discovery stage */
  reset: () => void;

  // === Utilities ===
  /** Get stage index (useful for progress indicators) */
  getStageIndex: (stage: BookingStage) => number;
  /** Total number of stages */
  totalStages: number;
  /** Check if current stage is before another */
  isBefore: (stage: BookingStage) => boolean;
  /** Check if current stage is after another */
  isAfter: (stage: BookingStage) => boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useBookingTransition(): BookingTransitionResult {
  // ═══════════════ STORE ═══════════════
  const currentStage = useBookingStore((state) => state.bookingStage);
  const transitionDirection = useBookingStore((state) => state.transitionDirection);
  const setBookingStage = useBookingStore((state) => state.setBookingStage);
  const resetBookingFlow = useBookingStore((state) => state.resetBookingFlow);

  // ═══════════════ DIRECTION FROM STORE ═══════════════
  const isForward = transitionDirection === "forward";

  // ═══════════════ ANIMATION CONFIGS ═══════════════
  // Primary Oto transition (for general content)
  const otoTransition = getOtoTransition(isForward);

  // Top bar specific transition (horizontal movement)
  const topBarTransition = getTopBarTransition(isForward);

  // Bottom sheet content transition (vertical movement)
  const sheetTransition = getSheetContentTransition(isForward);

  // Crossfade transition (subtle, for less prominent elements)
  const crossfadeTransition = getOtoCrossfade(isForward);

  // ═══════════════ NAVIGATION ACTIONS ═══════════════
  const goTo = useCallback(
    (stage: BookingStage) => {
      const currentIndex = STAGE_INDEX[currentStage];
      const nextIndex = STAGE_INDEX[stage];
      const direction = nextIndex > currentIndex ? "forward" : "backward";
      setBookingStage(stage, direction);
    },
    [currentStage, setBookingStage]
  );

  const goNext = useCallback(() => {
    const currentIndex = STAGE_INDEX[currentStage];
    const nextIndex = Math.min(currentIndex + 1, BOOKING_STAGES.length - 1);
    setBookingStage(BOOKING_STAGES[nextIndex], "forward");
  }, [currentStage, setBookingStage]);

  const goBack = useCallback(() => {
    const currentIndex = STAGE_INDEX[currentStage];
    const prevIndex = Math.max(currentIndex - 1, 0);
    setBookingStage(BOOKING_STAGES[prevIndex], "backward");
  }, [currentStage, setBookingStage]);

  const reset = useCallback(() => {
    resetBookingFlow();
  }, [resetBookingFlow]);

  // ═══════════════ UTILITY FUNCTIONS ═══════════════
  const getStageIndex = useCallback((stage: BookingStage) => STAGE_INDEX[stage], []);

  const isBefore = useCallback((stage: BookingStage) => STAGE_INDEX[currentStage] < STAGE_INDEX[stage], [currentStage]);

  const isAfter = useCallback((stage: BookingStage) => STAGE_INDEX[currentStage] > STAGE_INDEX[stage], [currentStage]);

  return {
    currentStage,
    isForward,

    // Primary transitions
    entering: otoTransition.entering,
    exiting: otoTransition.exiting,

    // Top bar transitions
    topBarEntering: topBarTransition.entering,
    topBarExiting: topBarTransition.exiting,

    // Sheet content transitions
    sheetEntering: sheetTransition.entering,
    sheetExiting: sheetTransition.exiting,

    // Crossfade transitions
    crossfadeEntering: crossfadeTransition.entering,
    crossfadeExiting: crossfadeTransition.exiting,

    // Navigation
    goTo,
    goNext,
    goBack,
    reset,

    // Utilities
    getStageIndex,
    totalStages: BOOKING_STAGES.length,
    isBefore,
    isAfter,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the next stage in the booking flow
 */
export function getNextStage(currentStage: BookingStage): BookingStage | null {
  const currentIndex = STAGE_INDEX[currentStage];
  const nextIndex = currentIndex + 1;
  return nextIndex < BOOKING_STAGES.length ? BOOKING_STAGES[nextIndex] : null;
}

/**
 * Get the previous stage in the booking flow
 */
export function getPreviousStage(currentStage: BookingStage): BookingStage | null {
  const currentIndex = STAGE_INDEX[currentStage];
  const prevIndex = currentIndex - 1;
  return prevIndex >= 0 ? BOOKING_STAGES[prevIndex] : null;
}

/**
 * Check if a stage comes before another
 */
export function isStageBeforeAnother(stage: BookingStage, otherStage: BookingStage): boolean {
  return STAGE_INDEX[stage] < STAGE_INDEX[otherStage];
}

/**
 * Check if a stage comes after another
 */
export function isStageAfterAnother(stage: BookingStage, otherStage: BookingStage): boolean {
  return STAGE_INDEX[stage] > STAGE_INDEX[otherStage];
}
