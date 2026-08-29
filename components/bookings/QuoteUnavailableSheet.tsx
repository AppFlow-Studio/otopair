import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { Button, Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import {
  getQuoteUnavailableCopy,
  type QuoteUnavailableReason,
} from "@/utils/quoteAvailability";
import { BorderRadius, BrandColors, SemanticColors, Spacing } from "@/constants/theme";

export function QuoteUnavailableSheet({
  visible,
  reason,
  onDismiss,
  renderInModal = true,
}: {
  visible: boolean;
  reason: QuoteUnavailableReason;
  onDismiss: () => void;
  renderInModal?: boolean;
}) {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const copy = getQuoteUnavailableCopy(reason);

  useEffect(() => {
    if (visible) sheetRef.current?.open();
  }, [visible]);

  if (!visible) return null;

  return (
    <FloatingSheet
      ref={sheetRef}
      snapHeights={[270]}
      showBackdrop
      renderInModal={renderInModal}
      onClose={onDismiss}
    >
      <View style={styles.content}>
        <Text size="lg" weight="bold" color={SemanticColors.textPrimary} center>
          {copy.title}
        </Text>
        <Text size="sm" weight="regular" color={SemanticColors.textMuted} center style={styles.message}>
          {copy.message}
        </Text>
        <Button
          style={styles.button}
          onPress={() => sheetRef.current?.close()}
          fullWidth
          backgroundColor={BrandColors.secondary}
          borderRadius={BorderRadius.lg}
          accessibilityLabel={copy.actionLabel}
        >
          {copy.actionLabel}
        </Button>
      </View>
    </FloatingSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingBottom: Spacing.lg,
  },
  message: {
    marginTop: Spacing.sm,
    lineHeight: 21,
  },
  button: {
    marginTop: Spacing.xl,
  },
});
