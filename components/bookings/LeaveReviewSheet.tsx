/**
 * LeaveReviewSheet
 *
 * Bottom sheet for leaving a review on a completed booking. Five-star
 * rating + optional comment + submit. Calls `reviews.submit`, which
 * inserts the row and trips the `listReviewedBookingIdsForUser` query
 * — `useMyBookingsWithDetails` then drops the booking out of the
 * pendingReview bucket and the card disappears from the Bookings tab.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 */

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { useMutation } from "convex/react";
import { Star } from "lucide-react-native";

import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { Text } from "@/components/shared-ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Booking } from "@/components/bookings/BookingCard";

const SHEET_HEIGHT = 500;
// Stable array reference — passing `[SHEET_HEIGHT]` inline causes
// FloatingSheet's enter-animation effect (which depends on `snaps`) to
// retrigger on every state change in this sheet, slamming the sheet to
// height 0 and animating back up. Keep it module-scoped.
const SNAP_HEIGHTS = [SHEET_HEIGHT];

export interface LeaveReviewSheetRef {
  open: (booking: Booking, userId: string) => void;
  close: () => void;
}

interface Props {
  /** Fires after the sheet fully closes. */
  onClose?: () => void;
  /** Fires after a review submits successfully. */
  onSubmitted?: (bookingId: string) => void;
}

export const LeaveReviewSheet = forwardRef<LeaveReviewSheetRef, Props>(
  ({ onClose, onSubmitted }, ref) => {
    const sheetRef = React.useRef<FloatingSheetRef>(null);
    const [booking, setBooking] = useState<Booking | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    // Default to 5 stars — most reviews are positive and pre-filling
    // matches the "you're rating, drag down to lower" pattern.
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submitReview = useMutation(api.reviews.submit);

    useImperativeHandle(ref, () => ({
      open: (b, uid) => {
        setBooking(b);
        setUserId(uid);
        setRating(5);
        setComment("");
        setError(null);
        sheetRef.current?.open();
      },
      close: () => sheetRef.current?.close(),
    }));

    const handleClose = useCallback(() => {
      onClose?.();
    }, [onClose]);

    const handleSubmit = useCallback(async () => {
      if (!booking || !userId) return;
      if (rating < 1) {
        setError("Tap a star to rate the service.");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        // Bail out defensively for local-only synthesized bookings
        // that don't have a Convex shop_id yet.
        if (!booking.id || booking.id.startsWith("tire_quote_")) {
          throw new Error("Local-only booking — review write skipped.");
        }
        if (!booking.shopId) {
          throw new Error("Missing shop on this booking — can't post a review.");
        }
        await submitReview({
          booking_id: booking.id as Id<"bookings">,
          user_id: userId as Id<"users">,
          shop_id: booking.shopId as Id<"shops">,
          mechanic_id: booking.mechanicId
            ? (booking.mechanicId as Id<"mechanics">)
            : undefined,
          rating,
          comment: comment.trim(),
        });
        onSubmitted?.(booking.id);
        sheetRef.current?.close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't submit review.");
      } finally {
        setSubmitting(false);
      }
    }, [booking, userId, rating, comment, submitReview, onSubmitted]);

    const summaryLine = useMemo(() => {
      if (!booking) return "";
      const services = booking.services?.[0] ?? "Service";
      const cost = typeof booking.totalCost === "number"
        ? ` · $${booking.totalCost.toFixed(2)}`
        : "";
      return `${services}${cost}`;
    }, [booking]);

    return (
      <FloatingSheet
        ref={sheetRef}
        snapHeights={SNAP_HEIGHTS}
        onClose={handleClose}
        showBackdrop
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.body}
        >
          <Text size="xl" weight="bold" color="#1F2937" style={styles.title}>
            Rate your service
          </Text>

          {booking ? (
            <View style={styles.summary}>
              <Text size="md" weight="semiBold" color="#1F2937" numberOfLines={1}>
                {booking.shopName}
              </Text>
              <Text size="sm" weight="regular" color="#6B7280" numberOfLines={1}>
                {summaryLine}
              </Text>
            </View>
          ) : null}

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = rating >= n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setRating(n)}
                  hitSlop={6}
                  style={styles.starButton}
                >
                  <Star
                    size={36}
                    color={filled ? "#F59E0B" : "#D1D5DB"}
                    fill={filled ? "#F59E0B" : "transparent"}
                    strokeWidth={1.5}
                  />
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Tell us how it went (optional)"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
            style={styles.input}
          />

          {error ? (
            <Text size="sm" weight="regular" color="#DC2626" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting || rating < 1}
            style={({ pressed }) => [
              styles.submitButton,
              (rating < 1 || submitting) && styles.submitButtonDisabled,
              pressed && styles.submitButtonPressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text size="md" weight="semiBold" color="#FFFFFF">
                Submit Review
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => sheetRef.current?.close()}
            disabled={submitting}
            style={({ pressed }) => [styles.dismissButton, pressed && { opacity: 0.6 }]}
          >
            <Text size="md" weight="medium" color="#6B7280">
              Not now
            </Text>
          </Pressable>
        </KeyboardAvoidingView>
      </FloatingSheet>
    );
  },
);

LeaveReviewSheet.displayName = "LeaveReviewSheet";

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  title: {
    textAlign: "center",
  },
  summary: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    gap: 4,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  starButton: {
    padding: 4,
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#1F2937",
    textAlignVertical: "top",
  },
  error: {
    textAlign: "center",
  },
  submitButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  dismissButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
});
