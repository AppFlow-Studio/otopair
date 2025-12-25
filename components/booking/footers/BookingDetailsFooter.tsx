/**
 * BookingDetailsFooter
 *
 * PURPOSE: Footer button for booking details stage
 *          Shows "Book Appointment" or "Schedule For Later" based on booking type
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetFooter, BottomSheetFooterProps } from "@gorhom/bottom-sheet";
import { ChevronRight } from "lucide-react-native";
import Animated from "react-native-reanimated";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Constants
import { BorderRadius } from "@/constants/theme";

// 5. Types
import type { BookingType } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

export interface BookingDetailsFooterProps extends BottomSheetFooterProps {
  /** Bottom inset for safe area */
  bottomInset: number;
  /** Animated style for visibility */
  animatedStyle: { opacity: number; pointerEvents: "auto" | "none" };
  /** Type of booking (book_now or schedule_later) */
  bookingType: BookingType;
  /** Whether an appointment slot has been selected */
  hasAppointment: boolean;
  /** Called when user proceeds to payment */
  onProceed: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BookingDetailsFooter({
  bottomInset,
  animatedStyle,
  bookingType,
  hasAppointment,
  onProceed,
  ...footerProps
}: BookingDetailsFooterProps) {
  const buttonText = bookingType === "schedule_later" ? "Schedule For Later" : "Book Appointment";
  // For "book_now", disable button if no appointment slot is selected
  // For "schedule_later", always enable the button
  const isDisabled = bookingType === "book_now" && !hasAppointment;

  return (
    <BottomSheetFooter {...footerProps} bottomInset={bottomInset}>
      <Animated.View style={animatedStyle}>
        <View style={styles.container}>
          <PrimaryButton
            style={[styles.button, isDisabled && styles.buttonDisabled]}
            onPress={onProceed}
            disabled={isDisabled}
          >
            <Text size="md" weight="semiBold" color={BrandColors.white}>
              {buttonText}
            </Text>
            <ChevronRight size={20} color={BrandColors.white} />
          </PrimaryButton>
        </View>
      </Animated.View>
    </BottomSheetFooter>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
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
  buttonDisabled: {
    opacity: 0.5,
  },
});



