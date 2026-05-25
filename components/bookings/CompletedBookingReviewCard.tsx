/**
 * CompletedBookingReviewCard
 *
 * Top-of-list card shown for completed bookings the user hasn't reviewed yet.
 * Mirrors Uber Eats' "rate your delivery" pattern: a celebratory summary with
 * a Leave Review CTA + a small X to dismiss for the session. Once the user
 * submits a review (`reviews` table row exists), `useMyBookingsWithDetails`
 * stops surfacing the card permanently.
 */

import React, { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { CheckCircle2, X, Star } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import type { Booking } from "@/components/bookings/BookingCard";

interface Props {
  booking: Booking;
  /** Open the review sheet for this booking. */
  onLeaveReview: (bookingId: string) => void;
  /** Dismiss the card for the current session (in-memory only — comes back
   *  next launch unless the user actually submits a review). Omit to hide
   *  the X (used on the dedicated Pending Reviews screen where dismiss
   *  doesn't apply). */
  onDismiss?: (bookingId: string) => void;
}

export function CompletedBookingReviewCard({ booking, onLeaveReview, onDismiss }: Props) {
  const [imgError, setImgError] = useState(false);
  const showShopImage = !!booking.mechanicImage && !imgError;

  return (
    <View style={styles.card}>
      {onDismiss ? (
        <Pressable
          onPress={() => onDismiss(booking.id)}
          hitSlop={10}
          style={styles.closeButton}
        >
          <X size={16} color="#9CA3AF" strokeWidth={2.2} />
        </Pressable>
      ) : null}

      <View style={styles.headerRow}>
        <View style={styles.checkBadge}>
          <CheckCircle2 size={20} color="#10B981" strokeWidth={2.2} />
        </View>
        <View style={styles.headerText}>
          <Text size="md" weight="bold" color="#1F2937">
            Service complete
          </Text>
          <Text size="sm" weight="regular" color="#6B7280">
            How did it go with {booking.shopName}?
          </Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        {showShopImage ? (
          <Image source={{ uri: booking.mechanicImage }} style={styles.shopImage} onError={() => setImgError(true)} />
        ) : (
          <View style={styles.shopPlaceholder}>
            <Text size="md" weight="bold" color="#6B7280">
              {(booking.shopName || "?").slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.summaryText}>
          <Text size="sm" weight="semiBold" color="#1F2937" numberOfLines={1}>
            {booking.services.join(", ") || "Service"}
          </Text>
          <Text size="xs" weight="regular" color="#6B7280" numberOfLines={1}>
            {booking.mechanicName} · {booking.carYear} {booking.carModel}
          </Text>
        </View>
        {typeof booking.totalCost === "number" ? (
          <Text size="sm" weight="bold" color="#1F2937">
            ${booking.totalCost.toFixed(2)}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => onLeaveReview(booking.id)}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Star size={16} color="#FFFFFF" fill="#FFFFFF" />
        <Text size="sm" weight="semiBold" color="#FFFFFF">
          Leave a Review
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    zIndex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingRight: 32,
  },
  checkBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
  },
  shopImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
  },
  shopPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cta: {
    marginTop: 14,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#5299FE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaPressed: {
    opacity: 0.9,
  },
});
