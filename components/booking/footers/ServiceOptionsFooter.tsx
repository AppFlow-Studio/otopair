/**
 * ServiceOptionsFooter
 *
 * PURPOSE: Footer button for service options stage.
 *          Shows "Continue" when all required options are selected.
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

export interface ServiceOptionsFooterProps extends BottomSheetFooterProps {
  /** Bottom inset for safe area */
  bottomInset: number;
  /** Animated style for visibility */
  animatedStyle: { opacity: number; pointerEvents: "auto" | "none" };
  /** Whether all services with options have a selection made */
  allOptionsSelected: boolean;
  /** Called when user confirms options and continues */
  onContinue: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceOptionsFooter({
  bottomInset,
  animatedStyle,
  allOptionsSelected,
  onContinue,
  ...footerProps
}: ServiceOptionsFooterProps) {
  return (
    <BottomSheetFooter {...footerProps} bottomInset={bottomInset}>
      <Animated.View style={animatedStyle}>
        <View style={styles.container}>
          <PrimaryButton
            onPress={onContinue}
            style={[styles.button, !allOptionsSelected && styles.buttonDisabled]}
            disabled={!allOptionsSelected}
          >
            <Text size="md" weight="semiBold" color={BrandColors.white}>
              Continue
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
    paddingVertical: 0,
    backgroundColor: BrandColors.white,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  button: {
    borderRadius: BorderRadius["xl"],
    paddingVertical: Spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
