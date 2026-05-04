/**
 * PendingQuoteCard
 *
 * PURPOSE: Card variant used in Upcoming + Quotes tabs for tire-quote
 *          bookings. Same visual skeleton, two modes:
 *
 *          status === "pending_quote"  (Upcoming tab)
 *            - Tag: Pending Quote (amber)
 *            - Footer: "Waiting for shops to respond"
 *            - Action: Switch toggle to move the booking to Quotes
 *
 *          status === "quotes_ready"   (Quotes tab)
 *            - Tag: Quotes Ready (blue)
 *            - Footer: "Quotes are in · pick the best fit"
 *            - Action: "View quotes" button that opens the quote list sheet
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx (Upcoming + Quotes lists)
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";

import { ArrowRight, Car } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { type Booking } from "@/components/bookings/BookingCard";
import { BookingProgressBar } from "@/components/bookings/BookingProgressBar";
import { getBookingStageView } from "@/utils/bookingStages";

// ============================================================================
// HELPERS
// ============================================================================

/** Parse "4 Premium All-Season · 225/45R18" back into its parts. */
function parseTireSpecs(notes: string | undefined): {
  quantity: string;
  tier: string;
  type: string;
  size: string;
} | null {
  if (!notes) return null;
  const [head, size = ""] = notes.split(" · ");
  const words = head.trim().split(/\s+/);
  if (words.length < 2) return null;
  const [count, tier, ...rest] = words;
  const quantityNum = parseInt(count, 10);
  if (Number.isNaN(quantityNum)) return null;
  return {
    quantity: `${quantityNum} ${quantityNum === 1 ? "tire" : "tires"}`,
    tier: tier ?? "",
    type: rest.join(" "),
    size: size || "—",
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

interface Props {
  booking: Booking;
  onPress?: (bookingId: string) => void;
  /** Open the quote list sheet. Called from the "View quotes" button. */
  onViewQuotes?: (bookingId: string) => void;
  /** Soft-deletes the booking by flipping its status to "cancelled".
   *  Triggered by the "Cancel Request" button. */
  onCancel?: (bookingId: string) => void;
}

export function PendingQuoteCard({
  booking,
  onPress,
  onViewQuotes,
  onCancel,
}: Props) {
  const vehicleLabel =
    booking.carModel && booking.carModel !== "Vehicle" ? booking.carModel : "Vehicle";
  const specs = parseTireSpecs(booking.notes);
  const isReady = booking.status === "quotes_ready";
  const stageView = getBookingStageView(booking.status, booking.liveStage);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress?.(booking.id)}
    >
      {/* Quote-stage progress bar — see utils/bookingStages.ts. */}
      <BookingProgressBar
        stages={stageView.stages}
        currentIndex={stageView.currentIndex}
      />

      {/* Header: vehicle + status tag */}
      <View style={styles.header}>
        <View style={styles.thumb}>
          {booking.makeLogoUrl ? (
            <Image source={{ uri: booking.makeLogoUrl }} style={styles.thumbImage} resizeMode="contain" />
          ) : (
            <Car size={30} color="#9CA3AF" />
          )}
        </View>
        <View style={styles.headerText}>
          {booking.carYear ? (
            <Text size="xs" weight="semiBold" color="#8E8E93" style={styles.year}>
              {booking.carYear}
            </Text>
          ) : null}
          <Text size="lg" weight="bold" color="#1A1A1A" numberOfLines={1}>
            {vehicleLabel}
          </Text>
        </View>
        <View style={[styles.tag, isReady ? styles.tagReady : styles.tagPending]}>
          <Text
            size="xs"
            weight="bold"
            color={isReady ? "#2F6DCC" : "#C8972E"}
          >
            {isReady ? "Quotes Ready" : "Pending Quote"}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Specs breakdown */}
      <View style={styles.specs}>
        {specs ? (
          <>
            <SpecRow label="Tire Size" value={specs.size} />
            <SpecRow label="Quality Tier" value={specs.tier} />
            <SpecRow label="Tire Type" value={specs.type} />
            <SpecRow label="Quantity" value={specs.quantity} />
          </>
        ) : (
          <Text size="md" weight="semiBold" color="#1A1A1A">
            {booking.notes || "Tire quote"}
          </Text>
        )}
      </View>

      {/* Mode-specific footer/action */}
      {isReady ? (
        <View style={styles.actionRow}>
          {onCancel && booking.status !== "cancelled" ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handleCancel();
              }}
              style={({ pressed }) => [styles.cancelOutlineButton, pressed && styles.viewButtonPressed]}
            >
              <Text size="sm" weight="semiBold" color="#DC2626">
                Cancel Request
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onViewQuotes?.(booking.id);
            }}
            style={({ pressed }) => [styles.viewButton, pressed && styles.viewButtonPressed]}
          >
            <Text size="sm" weight="semiBold" color="#FFFFFF">
              View quotes
            </Text>
            <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <Text size="xs" weight="regular" color="#8E8E93" style={styles.pendingFooter}>
            Waiting for shops to respond…
          </Text>
          {onCancel && booking.status !== "cancelled" ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handleCancel();
              }}
              style={({ pressed }) => [styles.cancelOutlineButton, pressed && styles.viewButtonPressed]}
            >
              <Text size="sm" weight="semiBold" color="#DC2626">
                Cancel Request
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Pressable>
  );

  function handleCancel() {
    Alert.alert(
      "Cancel Request",
      "Stop waiting for shop quotes? You can submit a new request later.",
      [
        { text: "Keep Waiting", style: "cancel" },
        {
          text: "Cancel Request",
          style: "destructive",
          onPress: () => onCancel?.(booking.id),
        },
      ],
    );
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.specRow}>
      <Text size="xs" weight="semiBold" color="#8E8E93" style={styles.specLabel}>
        {label.toUpperCase()}
      </Text>
      <Text size="md" weight="semiBold" color="#1A1A1A" style={styles.specValue}>
        {value}
      </Text>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.94,
  },


  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: {
    width: 64,
    height: 64,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  year: {
    letterSpacing: 1,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  tagPending: {
    backgroundColor: "#FFF8ED",
  },
  tagReady: {
    backgroundColor: "#E3F0FF",
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginVertical: 16,
  },

  // Specs
  specs: {
    gap: 12,
  },
  specRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  specLabel: {
    letterSpacing: 1,
  },
  specValue: {
    textAlign: "right",
  },

  // Action / status row at the bottom of the card
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  pendingFooter: {
    flex: 1,
  },
  viewButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#5299FE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cancelOutlineButton: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  viewButtonPressed: {
    opacity: 0.9,
  },
});
