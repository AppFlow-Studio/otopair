/**
 * ServiceSelectionFooter
 *
 * PURPOSE: Footer button for service selection stage
 *          Shows "Add X to Cart · $Y" when services selected, or "Select Service(s)" when empty
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

export interface ServiceSelectionFooterProps extends BottomSheetFooterProps {
  /** Bottom inset for safe area */
  bottomInset: number;
  /** Animated style for visibility */
  animatedStyle: { opacity: number; pointerEvents: "auto" | "none" };
  /** Whether any services are selected */
  hasSelection: boolean;
  /** Number of selected services */
  selectedCount: number;
  /** Total price of selected services */
  selectedTotal: number;
  /** Called when user confirms service selection */
  onConfirm: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceSelectionFooter({
  bottomInset,
  animatedStyle,
  hasSelection,
  selectedCount,
  selectedTotal,
  onConfirm,
  ...footerProps
}: ServiceSelectionFooterProps) {
  return (
    <BottomSheetFooter {...footerProps} bottomInset={bottomInset}>
      <Animated.View style={animatedStyle}>
        <View style={styles.container}>
          <PrimaryButton
            onPress={onConfirm}
            style={[styles.button, !hasSelection && styles.buttonDisabled]}
            disabled={!hasSelection}
          >
            <Text size="md" weight="semiBold" color={BrandColors.white}>
              {hasSelection ? `Add ${selectedCount} to Cart · $${selectedTotal}` : "Select Service(s)"}
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
  buttonDisabled: {
    opacity: 0.5,
  },
});




