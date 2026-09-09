/**
 * PendingQuoteCard
 *
 * PURPOSE: Card variant used in Upcoming + Quotes tabs for tire-quote
 *          bookings. Same visual skeleton, two modes:
 *
 *          status === "pending_quote"  (Upcoming tab)
 *            - Tag: Pending Quote (amber)
 *            - Action: Cancel Request
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

import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";

import { ArrowRight } from "lucide-react-native";
import Animated, { FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

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

/** Parse "Front pair · Standard brakes · 2 rotors · + Ceramic" — the rotor
 *  notes string assembled in `utils/bookingAdapter.ts`. Returns structured
 *  rows so the card surfaces the customer's selections instead of the raw
 *  string. */
function parseRotorSpecs(notes: string | undefined): {
  axle: string;
  brakeSystem: string;
  quantity: string;
  pads: string;
} | null {
  if (!notes) return null;
  const parts = notes.split(" · ").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  // First three segments are positional: axle · brake system · quantity.
  // Pads is appended as "+ <pad label>" when include_pads was true.
  const [axle, brakeSystem, quantity, ...rest] = parts;
  // Heuristic: only treat as a rotor notes string when the third segment
  // mentions "rotor" — keeps tire-notes from falsely matching.
  if (!/rotor/i.test(quantity)) return null;
  const padsRaw = rest.find((p) => p.startsWith("+ "));
  return {
    axle,
    brakeSystem,
    quantity,
    pads: padsRaw ? padsRaw.replace(/^\+\s*/, "") : "Not included",
  };
}

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
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
  onCancel?: (bookingId: string) => Promise<void> | void;
  /** Removes an expired quote request from the customer's list. */
  onDismiss?: (bookingId: string) => Promise<void> | void;
  isCheckingQuotes?: boolean;
}

export function PendingQuoteCard({
  booking,
  onPress,
  onViewQuotes,
  onCancel,
  onDismiss,
  isCheckingQuotes = false,
}: Props) {
  const vehicleLabel =
    booking.carModel && booking.carModel !== "Vehicle" ? booking.carModel : "Vehicle";
  const isRotor = booking.quoteType === "rotor";
  const tireSpecs = !isRotor ? parseTireSpecs(booking.notes) : null;
  const rotorSpecs = isRotor ? parseRotorSpecs(booking.notes) : null;
  const isPendingQuote = booking.status === "pending_quote";
  const isReady = booking.status === "quotes_ready";
  const isExpired = booking.status === "quote_expired";
  const stageView = getBookingStageView(booking.status, booking.liveStage);

  // Local "just cancelled" state. Mirrors BookingCard — see that file's
  // pattern for the rationale.
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const dim = useSharedValue(1);
  useEffect(() => {
    if (isCancelling) {
      dim.value = withTiming(0.45, { duration: 280 });
    }
  }, [isCancelling, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  return (
    <Animated.View
      style={dimStyle}
      exiting={FadeOut.duration(220)}
      layout={LinearTransition.duration(260)}
    >
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => {
        if (isCancelling || isExpired) return;
        onPress?.(booking.id);
      }}
    >
      {/* Quote-stage progress bar — see utils/bookingStages.ts. */}
      <BookingProgressBar
        stages={stageView.stages}
        currentIndex={stageView.currentIndex}
      />

      {/* Header: vehicle + status tag. Mirrors BookingCard's vehicle row —
          small contained image (no gray bg), full multi-line model name,
          license plate underneath. */}
      <View style={styles.header}>
        {booking.makeLogoUrl ? (
          <Image
            source={{ uri: booking.makeLogoUrl }}
            style={styles.carImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.carPlaceholder}>
            <Image
              source={require("@/assets/images/covered-car.png")}
              style={{ width: 32, height: 20 }}
              resizeMode="contain"
            />
          </View>
        )}
        <View style={styles.headerText}>
          <Text size="md" weight="bold" color="#1F2937">
            {titleCase(vehicleLabel)}
          </Text>
          {booking.licensePlate ? (
            <Text size="xs" weight="regular" color="#6B7280">
              {booking.licensePlate}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.tag,
            isCancelling
              ? styles.tagCancelled
              : isReady
                ? styles.tagReady
                : isExpired
                  ? styles.tagExpired
                : styles.tagPending,
          ]}
        >
          <Text
            size="xs"
            weight="bold"
            color={isCancelling ? "#DC2626" : isReady ? "#2F6DCC" : "#C8972E"}
          >
            {isCancelling
              ? "Cancelling..."
              : isReady
                ? "Quotes Ready"
                : isExpired
                  ? "Quote Expired"
                  : "Pending Quote"}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Specs breakdown */}
      <View style={styles.specs}>
        {rotorSpecs ? (
          <>
            <SpecRow label="Axle" value={rotorSpecs.axle} />
            <SpecRow label="Brake System" value={rotorSpecs.brakeSystem} />
            <SpecRow label="Pads" value={rotorSpecs.pads} />
            <SpecRow label="Quantity" value={rotorSpecs.quantity} />
          </>
        ) : tireSpecs ? (
          <>
            <SpecRow label="Tire Size" value={tireSpecs.size} />
            <SpecRow label="Quality Tier" value={tireSpecs.tier} />
            <SpecRow label="Tire Type" value={tireSpecs.type} />
            <SpecRow label="Quantity" value={tireSpecs.quantity} />
          </>
        ) : (
          <Text size="md" weight="semiBold" color="#1A1A1A">
            {booking.notes || (isRotor ? "Rotor quote" : "Tire quote")}
          </Text>
        )}
      </View>

      {/* Mode-specific footer/action */}
      {isExpired ? (
        <View style={styles.actionRow}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              void runDismiss(() => onDismiss?.(booking.id));
            }}
            disabled={isDismissing}
            accessibilityRole="button"
            accessibilityLabel="Dismiss expired quote request"
            style={({ pressed }) => [styles.viewButton, pressed && styles.viewButtonPressed]}
          >
            <Text size="sm" weight="semiBold" color="#FFFFFF">
              Dismiss
            </Text>
          </Pressable>
        </View>
      ) : isReady ? (
        <View style={styles.actionRow}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onViewQuotes?.(booking.id);
            }}
            disabled={isCheckingQuotes}
            accessibilityRole="button"
            accessibilityLabel="View quotes"
            style={({ pressed }) => [styles.viewButton, pressed && styles.viewButtonPressed]}
          >
            <Text size="sm" weight="semiBold" color="#FFFFFF">
              {isCheckingQuotes ? "Checking..." : "View quotes"}
            </Text>
            {isCheckingQuotes ? null : <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />}
          </Pressable>
          {onCancel && booking.status !== "cancelled" ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handleCancel();
              }}
              disabled={isCancelling}
              style={({ pressed }) => [styles.cancelOutlineButton, pressed && styles.viewButtonPressed]}
            >
              <Text size="sm" weight="semiBold" color="#DC2626">
                Cancel Request
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.actionRow}>
          {isPendingQuote ? null : (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                if (isCancelling) return;
                onPress?.(booking.id);
              }}
              disabled={isCancelling}
              style={({ pressed }) => [styles.viewButton, pressed && styles.viewButtonPressed]}
            >
              <Text size="sm" weight="semiBold" color="#FFFFFF">
                View Details
              </Text>
            </Pressable>
          )}
          {onCancel && booking.status !== "cancelled" ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handleCancel();
              }}
              disabled={isCancelling}
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
    </Animated.View>
  );

  function handleCancel() {
    if (isCancelling) return;
    Alert.alert(
      "Cancel Request",
      "Stop waiting for shop quotes? You can submit a new request later.",
      [
        { text: "Keep Waiting", style: "cancel" },
        {
          text: "Cancel Request",
          style: "destructive",
          onPress: () => {
            void runAction(() => onCancel?.(booking.id));
          },
        },
      ],
    );
  }

  async function runAction(action: () => Promise<void> | void | undefined) {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await action();
    } catch {
      // The mutation wrapper already presents the error toast. Keep the card
      // interactive so the customer can retry instead of leaving it dimmed.
    } finally {
      setIsCancelling(false);
    }
  }

  async function runDismiss(action: () => Promise<void> | void | undefined) {
    if (isDismissing) return;
    setIsDismissing(true);
    try {
      await action();
    } catch {
      // The mutation wrapper already presents the error toast.
      setIsDismissing(false);
    }
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


  // Header — matches BookingCard's vehicle row dimensions so the two
  // card types feel like one set on the My Bookings screen.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  carImage: {
    width: 50,
    height: 32,
  },
  carPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
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
  tagExpired: {
    // Light amber, matching the surface this card reverted to. The navy
    // variant's SemanticColors token went with the gradient.
    backgroundColor: "#FFF8ED",
  },
  tagCancelled: {
    backgroundColor: "#FEE2E2",
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
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#5299FE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cancelOutlineButton: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
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
