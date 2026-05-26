/**
 * FullScreenBookingView
 *
 * PURPOSE: Full-screen view for booking stages that require more screen real estate:
 *          - booking_details (Booking details screen)
 *          - payment (Review & Pay screen)
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - onClose (() => void): Called when user closes the full-screen view [optional]
 *
 * EXAMPLE:
 *   <FullScreenBookingView onClose={() => console.log("Closed")} />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useRef } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { ArrowLeft, ChevronRight } from "lucide-react-native";
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Local components
import { AddMoreServicesSheet, AddMoreServicesSheetRef } from "./sheets/AddMoreServicesSheet";
import { BookingDetailsContent } from "./sheets/BookingDetailsContent";
import { ReviewPayContent } from "./sheets/ReviewPayContent";

// 5. Constants, hooks, types, stores
import { BorderRadius, Layout } from "@/constants/theme";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// TYPES
// ============================================================================

interface FullScreenBookingViewProps {
  /** Called when user closes the full-screen view (goes back to mechanic selection) */
  onClose?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FullScreenBookingView({ onClose }: FullScreenBookingViewProps) {
  // ═══════════════ REFS ═══════════════
  const addMoreSheetRef = useRef<AddMoreServicesSheetRef>(null);

  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();

  // ═══════════════ STORE ═══════════════
  const bookingStage = useBookingStore((state) => state.bookingStage);
  const transitionDirection = useBookingStore((state) => state.transitionDirection);
  const setBookingStage = useBookingStore((state) => state.setBookingStage);
  const prevBookingStage = useBookingStore((state) => state.prevBookingStage);
  const bookingType = useBookingStore((state) => state.bookingType);
  const scheduledAppointment = useBookingStore((state) => state.scheduledAppointment);
  const skippedBookingDetails = useBookingStore((state) => state.skippedBookingDetails);
  const setSkippedBookingDetails = useBookingStore((state) => state.setSkippedBookingDetails);
  const disclosedRangeFormatted = useBookingStore((state) => state.disclosedRangeFormatted);

  // ═══════════════ COMPUTED ═══════════════
  const isBookingDetailsStage = bookingStage === "booking_details";
  const isPaymentStage = bookingStage === "payment";

  // ═══════════════ ANIMATIONS ═══════════════
  const entering = transitionDirection === "forward" ? SlideInRight : SlideInLeft;
  const exiting = transitionDirection === "forward" ? SlideOutLeft : SlideOutRight;

  // ═══════════════ HANDLERS ═══════════════
  const handleBack = useCallback(() => {
    // If at booking details, go back to mechanic selection (bottom sheet)
    if (bookingStage === "booking_details") {
      prevBookingStage();
      onClose?.();
    } else if (bookingStage === "payment") {
      // If user came directly to payment (skipped booking details), go back to mechanic selection
      if (skippedBookingDetails) {
        setSkippedBookingDetails(false);
        setBookingStage("mechanic_selection", "backward");
        onClose?.();
      } else {
        // Otherwise, go to previous stage (booking_details)
        prevBookingStage();
      }
    } else {
      prevBookingStage();
    }
  }, [bookingStage, prevBookingStage, onClose, skippedBookingDetails, setSkippedBookingDetails, setBookingStage]);

  const handleProceedToPayment = useCallback(() => {
    setBookingStage("payment", "forward");
  }, [setBookingStage]);

  const handlePaymentConfirmed = useCallback(() => {
    setBookingStage("confirmation", "forward");
  }, [setBookingStage]);

  const handleAddMore = useCallback(() => {
    addMoreSheetRef.current?.open();
  }, []);

  // ═══════════════ TITLE ═══════════════
  const getTitle = () => {
    switch (bookingStage) {
      case "booking_details":
        return "Booking Details";
      case "payment":
        return "Review & Pay";
      default:
        return "";
    }
  };

  // ═══════════════ FOOTER CONTENT ═══════════════
  // Footer needs to be above the tab bar
  const footerBottomPadding = insets.bottom;

  const renderFooter = () => {
    if (isBookingDetailsStage) {
      const buttonText = bookingType === "schedule_later" ? "Schedule For Later" : "Book Appointment";
      const isDisabled = bookingType === "book_now" && !scheduledAppointment;

      return (
        <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
          <PrimaryButton
            style={[styles.button, isDisabled && styles.buttonDisabled]}
            onPress={handleProceedToPayment}
            disabled={isDisabled}
            fullWidth
          >
            <Text size="md" weight="semiBold" color={BrandColors.white}>
              {buttonText}
            </Text>
            <ChevronRight size={20} color={BrandColors.white} />
          </PrimaryButton>
        </View>
      );
    }

    if (isPaymentStage) {
      // Pre-Job Approval flow: at booking time we authorize a fixed $20
      // deposit, but the customer is agreeing to the disclosed price range.
      // The CTA shows the range so the band is in view at the action, with
      // the $20 hold qualifier directly below — no surprise at submit.
      return (
        <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
          <PrimaryButton style={styles.paymentButton} onPress={handlePaymentConfirmed} fullWidth>
            <Text size="md" weight="bold" color={BrandColors.white}>
              Confirm Appointment
            </Text>
            {disclosedRangeFormatted ? (
              <View style={styles.amountBadge}>
                <Text size="sm" weight="bold" color={BrandColors.primary} numberOfLines={1}>
                  {disclosedRangeFormatted}
                </Text>
              </View>
            ) : null}
          </PrimaryButton>
          <Text size="xs" weight="regular" color="#6B7280" style={styles.holdQualifier}>
            Only $20 is held now — the final amount within this range is
            charged after your mechanic inspects your car.
          </Text>
        </View>
      );
    }

    return null;
  };

  // ═══════════════ CONTENT ═══════════════
  const renderContent = () => {
    switch (bookingStage) {
      case "booking_details":
        return <BookingDetailsContent onAddMore={handleAddMore} isFullScreen />;
      case "payment":
        return <ReviewPayContent isFullScreen />;
      default:
        return null;
    }
  };

  // ═══════════════ RENDER ═══════════════
  return (
    <Animated.View
      style={[styles.container, { paddingTop: insets.top }]}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={24} color={BrandColors.primary} />
        </TouchableOpacity>
        <Text size="lg" weight="bold" color={BrandColors.primary} style={styles.headerTitle}>
          {getTitle()}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <Animated.View style={styles.content} key={bookingStage} entering={entering} exiting={exiting}>
        {renderContent()}
      </Animated.View>

      {/* Footer */}
      {renderFooter()}

      {/* Add More Services Sheet */}
      <AddMoreServicesSheet ref={addMoreSheetRef} />
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 32, // Same width as back button for centering
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: BrandColors.white,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  paymentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: BrandColors.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  amountBadge: {
    backgroundColor: BrandColors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  holdQualifier: {
    marginTop: Spacing.sm,
    textAlign: "center",
    lineHeight: 16,
  },
});
