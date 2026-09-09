/**
 * RotorQuoteCard
 *
 * PURPOSE: Renders a single shop's rotor quote. Mirrors TireQuoteCard:
 *          shop header with trust signals, itemized rows (per-rotor price
 *          × quantity + labor = total), availability, primary Book CTA.
 *          Variants: `primary` (Best Match gold accent) and `secondary`.
 *
 * USED IN: components/bookings/RotorQuoteListSheet.tsx
 */

import { CalendarClock, CheckCircle2 } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";

import { Button, Text } from "@/components/shared-ui";
import { formatPadTypeLabel, type RotorQuote } from "@/constants/rotorFlow";
import { useDistanceUnit } from "@/hooks/useDistanceUnit";
import { formatProximityDistanceFromMiles } from "@/utils/geo";

interface Props {
  quote: RotorQuote;
  variant: "primary" | "secondary";
  onBook: () => void;
  onBookEarliest?: () => void;
}

const BEST_MATCH_ACCENT = "#C8972E";
const BOOK_BLUE = "#5299FE";

function formatMoney(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function RotorQuoteCard({ quote, variant, onBook, onBookEarliest }: Props) {
  const distanceUnit = useDistanceUnit();
  const isPrimary = variant === "primary";
  const perRotorLabel = `${formatMoney(quote.perRotorPrice)} × ${quote.quantity}`;
  const rotorsSubtotal = quote.perRotorPrice * quote.quantity;
  const padQuantity = quote.padQuantity ?? quote.quantity;
  const padSubtotal =
    quote.padPrice != null ? quote.padPrice * padQuantity : null;
  const padLabel = quote.padBrand?.trim() || formatPadTypeLabel(quote.padType);

  return (
    <View style={[styles.card, isPrimary ? styles.cardPrimary : styles.cardSecondary]}>
      {isPrimary ? (
        <View style={styles.bestMatchTag}>
          <Text size="xs" weight="bold" color="#FFFFFF">
            BEST MATCH
          </Text>
        </View>
      ) : null}

      {/* Shop header */}
      <View style={styles.header}>
        <Text size={isPrimary ? "lg" : "md"} weight="bold" color="#1A1A1A" numberOfLines={1}>
          {quote.shopName}
        </Text>
        <View style={styles.metaRow}>
          <Text size="xs" color="#8E8E93">
            {formatProximityDistanceFromMiles(quote.shopDistanceMi, distanceUnit)} · ★ {quote.shopRating.toFixed(1)}
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
          {quote.rotorBrand}
        </Text>
      </View>

      <View style={styles.itemBlock}>
        <ItemRow label={`Rotors (${perRotorLabel})`} value={formatMoney(rotorsSubtotal)} />
        {padSubtotal != null ? (
          <ItemRow
            label={padLabel ? `Pads (${padLabel})` : "Pads"}
            value={formatMoney(padSubtotal)}
          />
        ) : null}
        <ItemRow label="Installation & labor" value={formatMoney(quote.laborCost)} />
        <View style={styles.itemDivider} />
        <View style={styles.totalRow}>
          <Text size="md" weight="bold" color="#1A1A1A">
            Total
          </Text>
          <Text size="md" weight="bold" color="#1A1A1A">
            {formatMoney(quote.total)}
          </Text>
        </View>
      </View>

      {onBookEarliest ? (
        <View style={styles.availabilityRow}>
          <CalendarClock size={14} color="#6B7280" strokeWidth={2.2} />
          <Text size="xs" weight="medium" color="#6B7280">
            Earliest: {quote.availability}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {onBookEarliest ? (
          <Button
            style={styles.bookButton}
            onPress={onBookEarliest}
            fullWidth
            backgroundColor={BOOK_BLUE}
            borderRadius={12}
            accessibilityLabel="Book earliest time"
          >
            Book earliest time
          </Button>
        ) : null}
        <Button
          variant={onBookEarliest ? "secondary" : "primary"}
          style={[styles.bookButton, onBookEarliest ? styles.secondaryButton : null]}
          onPress={onBook}
          fullWidth
          backgroundColor={onBookEarliest ? "#FFFFFF" : BOOK_BLUE}
          textColor={onBookEarliest ? BOOK_BLUE : "#FFFFFF"}
          borderRadius={12}
          accessibilityLabel={onBookEarliest ? "Choose a different time" : "Choose time"}
        >
          {onBookEarliest ? "Choose a different time" : "Choose time"}
        </Button>
      </View>
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
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  availabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F8F9FA",
    alignSelf: "flex-start",
  },
  bookButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: BOOK_BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    marginTop: 14,
    gap: 10,
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BOOK_BLUE,
  },
});
