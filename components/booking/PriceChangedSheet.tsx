/**
 * PriceChangedSheet
 *
 * Shown on Review & Pay when the booking commit came back PRICE_CHANGED
 * (bug #390): the shop edited a price between the customer tapping Authorize
 * and the booking landing. The $20 hold was already voided by /confirming, so
 * nothing is charged; the customer decides whether to continue at the new
 * price (Review & Pay re-renders live, re-snapshots and re-opens /confirming)
 * or go back to their services.
 *
 * Same FloatingSheet shape as QuoteUnavailableSheet. The chosen action runs
 * after the close animation (onClose) so navigation never races the sheet.
 *
 * USED IN: app/booking/mechanic/[id]/payment.tsx
 */
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { Button, Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { BorderRadius, BrandColors, SemanticColors, Spacing } from "@/constants/theme";

type PendingAction = "continue" | "back" | null;

export function priceChangedHeadline(
  previousFormatted: string | null,
  newFormatted: string | null,
): string {
  if (previousFormatted && newFormatted && previousFormatted !== newFormatted) {
    return `The price changed from ${previousFormatted} to ${newFormatted}. Continue?`;
  }
  return "The price changed. Continue?";
}

export function PriceChangedSheet({
  visible,
  message,
  previousFormatted,
  newFormatted,
  onContinue,
  onBack,
  onDismiss,
}: {
  visible: boolean;
  /** The server's sentence naming what changed. */
  message: string;
  previousFormatted: string | null;
  newFormatted: string | null;
  /** Continue at the live price. */
  onContinue: () => void;
  /** Back to service selection. */
  onBack: () => void;
  /** Closed without choosing — stay on Review & Pay at the live price. */
  onDismiss: () => void;
}) {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const pendingRef = useRef<PendingAction>(null);

  useEffect(() => {
    if (visible) {
      pendingRef.current = null;
      sheetRef.current?.open();
    }
  }, [visible]);

  if (!visible) return null;

  const headline = priceChangedHeadline(previousFormatted, newFormatted);
  const choose = (action: Exclude<PendingAction, null>) => {
    pendingRef.current = action;
    sheetRef.current?.close();
  };
  const handleClose = () => {
    const action = pendingRef.current;
    pendingRef.current = null;
    if (action === "continue") onContinue();
    else if (action === "back") onBack();
    else onDismiss();
  };

  return (
    <FloatingSheet
      ref={sheetRef}
      snapHeights={[340]}
      showBackdrop
      renderInModal
      onClose={handleClose}
    >
      <View style={styles.content}>
        <Text size="xl" weight="extraBold" color={BrandColors.primary} center>
          {headline}
        </Text>
        {message ? (
          <Text size="sm" weight="regular" color={SemanticColors.textMuted} center style={styles.message}>
            {message}
          </Text>
        ) : null}
        <Text size="xs" weight="regular" color={SemanticColors.textMuted} center style={styles.note}>
          Your card wasn&apos;t charged.
        </Text>
        <Button
          style={styles.primary}
          onPress={() => choose("continue")}
          fullWidth
          backgroundColor={BrandColors.secondary}
          borderRadius={BorderRadius.lg}
          accessibilityLabel="Continue at the new price"
        >
          Continue
        </Button>
        <Button
          style={styles.secondary}
          onPress={() => choose("back")}
          fullWidth
          backgroundColor="#F3F4F6"
          textColor="#1A1A1A"
          borderRadius={BorderRadius.lg}
          accessibilityLabel="Back to services"
        >
          Back to services
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
  note: {
    marginTop: Spacing.xs,
  },
  primary: {
    marginTop: Spacing.lg,
  },
  secondary: {
    marginTop: Spacing.sm,
  },
});
