/**
 * PaymentMethodBlock
 *
 * Presentational card showing which payment method backs a hold or charge —
 * a wallet (Apple / Google Pay) or a saved card — with an optional "Change"
 * affordance. Mirrors the Payment card grammar on the approve-estimate screen
 * so the two surfaces read the same.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CreditCard, Wallet } from "lucide-react-native";
import { Text } from "@/components/shared-ui";
import {
  BrandColors,
  SemanticColors,
  SurfaceColors,
  Spacing,
  CardShadow,
} from "@/constants/theme";

export type PaymentMethodKind = "card" | "apple_pay" | "google_pay";

interface PaymentMethodBlockProps {
  /** Resolved method backing the payment — drives the icon. */
  kind: PaymentMethodKind;
  /** Human label, e.g. "Visa •••• 4242" or "Apple Pay". */
  label: string;
  /** Section heading above the method row. */
  title?: string;
  /** Tapping "Change" — omit to render the block as read-only. */
  onChange?: () => void;
  /** Dims the "Change" link and blocks the press while a flow is in flight. */
  disabled?: boolean;
}

export function PaymentMethodBlock({
  kind,
  label,
  title = "Payment method",
  onChange,
  disabled,
}: PaymentMethodBlockProps) {
  const isWallet = kind === "apple_pay" || kind === "google_pay";

  return (
    <View style={styles.card}>
      <Text weight="semiBold" style={styles.title}>
        {title}
      </Text>
      <View style={styles.row}>
        <View style={styles.left}>
          {isWallet ? (
            <Wallet size={18} color={SemanticColors.textMuted} />
          ) : (
            <CreditCard size={18} color={SemanticColors.textMuted} />
          )}
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>
        {onChange ? (
          <Pressable onPress={onChange} disabled={disabled} hitSlop={8}>
            <Text
              weight="semiBold"
              style={[styles.change, disabled && { opacity: 0.5 }]}
            >
              Change
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SurfaceColors.cardSurface,
    borderRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.md,
    boxShadow: CardShadow.default,
  },
  title: {
    fontSize: 16,
    color: BrandColors.primary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: Spacing.md,
  },
  label: { color: BrandColors.primary, fontSize: 14, flexShrink: 1 },
  change: { color: SemanticColors.primaryBlue, fontSize: 14 },
});
