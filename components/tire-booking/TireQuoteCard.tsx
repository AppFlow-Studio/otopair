/**
 * TireQuoteCard
 *
 * PURPOSE: Renders a single shop's tire quote. Layout follows spec §7 —
 *          shop name + trust signals, itemized rows (per-tire × qty + labor
 *          = total), and an availability banner at the bottom. Two variants:
 *          `primary` (large + gold "Best Match" accent) and `secondary`
 *          (muted, appears under "Other Options").
 */

import { CheckCircle2 } from "lucide-react-native";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { Text } from "@/components/shared-ui";
import type { TireQuote } from "@/constants/tireFlow";

interface Props {
  quote: TireQuote;
  variant: "primary" | "secondary";
  onBook: () => void;
}

const BEST_MATCH_ACCENT = "#C8972E";
const BOOK_BLUE = "#5299FE";

export function TireQuoteCard({ quote, variant, onBook }: Props) {
  const isPrimary = variant === "primary";
  const total = quote.total;

  return (
    <View style={[styles.card, isPrimary ? styles.cardPrimary : styles.cardSecondary]}>
      {isPrimary ? (
        <View style={styles.bestMatchTag}>
          <Text size="xs" weight="bold" color="#FFFFFF">
            BEST MATCH
          </Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <Text size={isPrimary ? "lg" : "md"} weight="bold" color="#1A1A1A" numberOfLines={1}>
          {quote.shopName}
        </Text>
        <View style={styles.metaRow}>
          <Text size="xs" color="#8E8E93">
            {quote.shopDistanceMi.toFixed(1)} mi · ★ {quote.shopRating.toFixed(1)}
          </Text>
          {quote.verifiedPartner ? (
            <View style={styles.verifiedRow}>
              <CheckCircle2 size={12} color="#10B981" />
              <Text size="xs" weight="medium" color="#10B981">
                Verified
              </Text>
            </View>
          ) : null}
        </View>
        <Text size="sm" weight="medium" color="#3C3C43" style={styles.brandLine}>
          {quote.tireBrand}
        </Text>
      </View>

      <View style={styles.itemBlock}>
        <ItemRow label="Tire (each)" value={`$${quote.perTirePrice.toFixed(2)}`} />
        <ItemRow label="Quantity" value={`× ${quote.quantity}`} />
        <ItemRow label="Installation" value={`$${quote.laborCost.toFixed(2)}`} />
        <View style={styles.totalRow}>
          <Text size="md" weight="bold" color="#1A1A1A">
            Total
          </Text>
          <Text size="md" weight="bold" color="#1A1A1A">
            ${total.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.availabilityBanner}>
        <Text size="sm" weight="semiBold" color="#2E7D32">
          Available: {quote.availability}
        </Text>
      </View>

      <TouchableOpacity style={styles.bookButton} onPress={onBook} activeOpacity={0.85}>
        <Text size="md" weight="semiBold" color="#FFFFFF">
          Get Quote
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ItemRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.itemRow}>
      <Text size="sm" weight="regular" color="#6B7280">
        {label}
      </Text>
      <Text size="sm" weight="medium" color="#1A1A1A">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  cardPrimary: {
    borderColor: BEST_MATCH_ACCENT,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cardSecondary: {
    opacity: 1,
  },
  bestMatchTag: {
    position: "absolute",
    top: -10,
    left: 16,
    backgroundColor: BEST_MATCH_ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  header: {
    marginBottom: 14,
    gap: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  brandLine: {
    marginTop: 6,
  },
  itemBlock: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 12,
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
  },
  availabilityBanner: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
  },
  bookButton: {
    marginTop: 14,
    height: 48,
    borderRadius: 12,
    backgroundColor: BOOK_BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
});
