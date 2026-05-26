/**
 * BrandedCardVisual
 *
 * Shared brand-themed credit card visual. Used by:
 *  - the carousel in ActivityRewardsScreen (display-only, saved cards)
 *  - the add-card screen (live preview that updates as the user types)
 *
 * Renders a LinearGradient card with brand-specific colors, the masked card
 * number, expiry, cardholder, and an optional DEFAULT pill.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Text } from "@/components/shared-ui";
import { BRAND_SVG } from "@/components/payments/brandSvg";

export type Brand =
  | "visa"
  | "mastercard"
  | "amex"
  | "discover"
  | "diners"
  | "jcb"
  | "unionpay"
  | "generic";

interface BrandTheme {
  colors: [string, string];
  text: string;
  chipBg: string;
}

const BRAND_THEMES: Record<Exclude<Brand, "generic">, BrandTheme> = {
  visa: {
    colors: ["#1a1f71", "#0d47a1"],
    text: "#ffffff",
    chipBg: "rgba(255,255,255,0.2)",
  },
  mastercard: {
    colors: ["#1a1a2e", "#16213e"],
    text: "#ffffff",
    chipBg: "rgba(255,255,255,0.2)",
  },
  amex: {
    colors: ["#006fcf", "#0080ef"],
    text: "#ffffff",
    chipBg: "rgba(255,255,255,0.2)",
  },
  discover: {
    colors: ["#ff6000", "#ff8533"],
    text: "#ffffff",
    chipBg: "rgba(255,255,255,0.25)",
  },
  diners: {
    colors: ["#004080", "#0060b0"],
    text: "#ffffff",
    chipBg: "rgba(255,255,255,0.2)",
  },
  jcb: {
    colors: ["#0b4ea2", "#1d6db8"],
    text: "#ffffff",
    chipBg: "rgba(255,255,255,0.2)",
  },
  unionpay: {
    colors: ["#e21836", "#00447c"],
    text: "#ffffff",
    chipBg: "rgba(255,255,255,0.2)",
  },
};

const GENERIC_THEME: BrandTheme = {
  colors: ["#e8e4de", "#d5d0c8"],
  text: "#3a3a3a",
  chipBg: "rgba(0,0,0,0.08)",
};

export function normalizeStripeBrand(raw: string | undefined | null): Brand {
  if (!raw) return "generic";
  const v = String(raw).toLowerCase().replace(/\s+/g, "");
  if (v === "visa") return "visa";
  if (v === "mastercard") return "mastercard";
  if (v === "amex" || v === "americanexpress") return "amex";
  if (v === "discover") return "discover";
  if (v === "diners" || v === "dinersclub") return "diners";
  if (v === "jcb") return "jcb";
  if (v === "unionpay" || v === "cup") return "unionpay";
  return "generic";
}

interface BrandedCardVisualProps {
  brand: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  cardholderName?: string;
  isDefault?: boolean;
}

export function BrandedCardVisual({
  brand,
  last4,
  expMonth,
  expYear,
  cardholderName,
  isDefault,
}: BrandedCardVisualProps) {
  const normalized = normalizeStripeBrand(brand);
  const theme: BrandTheme =
    normalized === "generic" ? GENERIC_THEME : BRAND_THEMES[normalized];
  const fg = theme.text;
  const fgSoft = `${fg}90`;
  const fgFaint = `${fg}50`;
  const BrandSvg = BRAND_SVG?.[normalized];

  const numberDisplay = last4
    ? `••••  ••••  ••••  ${last4}`
    : "••••  ••••  ••••  ••••";

  const expiryDisplay =
    expMonth != null && expYear != null
      ? `${String(expMonth).padStart(2, "0")}/${String(expYear).slice(-2)}`
      : "MM/YY";

  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={theme.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { shadowColor: theme.colors[0] }]}
      >
        <View style={styles.row}>
          {BrandSvg ? (
            <View style={styles.brandMark}>
              <BrandSvg width={76} height={56} />
            </View>
          ) : (
            <View style={styles.brandMark} />
          )}

          {isDefault ? (
            <View style={styles.defaultPill}>
              <Text size="xs" weight="bold" color="#FFFFFF">
                DEFAULT
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.numberWrap}>
          <Text
            size="xl"
            weight="bold"
            color={fg}
            style={styles.numberText}
          >
            {numberDisplay}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.bottomCol}>
            <Text style={[styles.metaLabel, { color: fgFaint }]}>
              CARDHOLDER
            </Text>
            <Text
              style={[styles.metaValue, { color: fgSoft }]}
              numberOfLines={1}
            >
              {cardholderName?.toUpperCase() || "————"}
            </Text>
          </View>

          <View style={[styles.bottomCol, styles.bottomColRight]}>
            <Text style={[styles.metaLabel, { color: fgFaint }]}>EXPIRES</Text>
            <Text
              style={[
                styles.expiryValue,
                { color: expMonth != null ? fg : fgFaint },
              ]}
            >
              {expiryDisplay}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: "100%",
    aspectRatio: 1.586,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    padding: 22,
    justifyContent: "space-between",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  defaultPill: {
    backgroundColor: "rgba(82,153,254,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  numberWrap: {
    marginVertical: 6,
  },
  numberText: {
    letterSpacing: 2,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  bottomCol: {
    flexShrink: 1,
  },
  bottomColRight: {
    alignItems: "flex-end",
  },
  metaLabel: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  expiryValue: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
  },
  brandMark: {
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
});

export default BrandedCardVisual;
