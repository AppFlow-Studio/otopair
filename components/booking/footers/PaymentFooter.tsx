/**
 * PaymentFooter
 *
 * PURPOSE: Footer button for payment (Review & Pay) stage
 *          Shows "Pay" button with amount badge
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

// ============================================================================
// TYPES
// ============================================================================

export interface PaymentFooterProps extends BottomSheetFooterProps {
  /** Bottom inset for safe area */
  bottomInset: number;
  /** Animated style for visibility */
  animatedStyle: { opacity: number; pointerEvents: "auto" | "none" };
  /** Total amount to pay */
  totalAmount: number;
  /** Called when user confirms payment */
  onConfirm: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PaymentFooter({
  bottomInset,
  animatedStyle,
  totalAmount,
  onConfirm,
  ...footerProps
}: PaymentFooterProps) {
  return (
    <BottomSheetFooter {...footerProps} bottomInset={bottomInset}>
      <Animated.View style={animatedStyle}>
        <View style={styles.container}>
          <PrimaryButton style={styles.button} onPress={onConfirm}>
            <Text size="md" weight="semiBold" color={BrandColors.white}>
              Pay
            </Text>
            <View style={styles.amountBadge}>
              <Text size="sm" weight="bold" color={BrandColors.primary}>
                ${totalAmount}
              </Text>
            </View>
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
  amountBadge: {
    backgroundColor: BrandColors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
});



