/**
 * ConfirmationFooter
 *
 * PURPOSE: Footer button for confirmation stage
 *          Shows "Book Another Service" button
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
import Animated from "react-native-reanimated";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Constants
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

export interface ConfirmationFooterProps extends BottomSheetFooterProps {
  /** Bottom inset for safe area */
  bottomInset: number;
  /** Animated style for visibility */
  animatedStyle: { opacity: number; pointerEvents: "auto" | "none" };
  /** Called when user wants to book another service */
  onBookAgain: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ConfirmationFooter({
  bottomInset,
  animatedStyle,
  onBookAgain,
  ...footerProps
}: ConfirmationFooterProps) {
  return (
    <BottomSheetFooter {...footerProps} bottomInset={bottomInset}>
      <Animated.View style={animatedStyle}>
        <View style={styles.container}>
          <PrimaryButton onPress={onBookAgain} style={styles.button}>
            <Text size="md" weight="semiBold" color={BrandColors.white}>
              Book Another Service
            </Text>
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
    borderRadius: BorderRadius["xl"],
    paddingVertical: Spacing.lg,
  },
});

