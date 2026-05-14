/**
 * LeaveReviewSheet
 *
 * Bottom sheet for leaving a review on a completed booking. Five-star
 * rating + quick-feedback chips + submit. Calls
 * `reviews.submit`, which inserts the row and trips the
 * `listReviewedBookingIdsForUser` query — `useMyBookingsWithDetails`
 * then drops the booking out of the pendingReview bucket and the card
 * disappears from the Bookings tab.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 */

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { useMutation } from "convex/react";
import { Star } from "lucide-react-native";

import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { Text } from "@/components/shared-ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Booking } from "@/components/bookings/BookingCard";

const SHEET_HEIGHT = 540;
// Stable array reference — passing `[SHEET_HEIGHT]` inline causes
// FloatingSheet's enter-animation effect (which depends on `snaps`) to
// retrigger on every state change in this sheet, slamming the sheet to
// height 0 and animating back up. Keep it module-scoped.
const SNAP_HEIGHTS = [SHEET_HEIGHT];

const RATING_LABELS: Record<number, { text: string; color: string }> = {
  0: { text: "Tap a star to rate", color: "#9CA3AF" },
  1: { text: "Disappointing", color: "#DC2626" },
  2: { text: "Could be better", color: "#F97316" },
  3: { text: "Good", color: "#F59E0B" },
  4: { text: "Great service", color: "#10B981" },
  5: { text: "Amazing — best in town", color: "#10B981" },
};

const QUICK_TAGS = [
  "On time",
  "Fair price",
  "Friendly",
  "Clean shop",
  "Professional",
  "Great work",
];

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
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submitReview = useMutation(api.reviews.submit);

    // One Animated.Value per star for the pop-on-tap micro-interaction.
    const starScales = useRef<Animated.Value[]>(
      [1, 2, 3, 4, 5].map(() => new Animated.Value(1)),
    ).current;

    const popStarsUpTo = useCallback(
      (n: number) => {
        starScales.slice(0, n).forEach((anim, i) => {
          anim.stopAnimation();
          anim.setValue(0.85);
          Animated.spring(anim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 4,
            tension: 180,
            delay: i * 35,
          }).start();
        });
      },
      [starScales],
    );

    useImperativeHandle(ref, () => ({
      open: (b, uid) => {
        setBooking(b);
        setUserId(uid);
        setRating(5);
        setSelectedTags([]);
        setError(null);
        sheetRef.current?.open();
        // Stagger the default 5-star fill on open for a small "ta-da".
        popStarsUpTo(5);
      },
      close: () => sheetRef.current?.close(),
    }));

    const handleClose = useCallback(() => {
      onClose?.();
    }, [onClose]);

    const handleStarPress = useCallback(
      (n: number) => {
        setRating(n);
        popStarsUpTo(n);
      },
      [popStarsUpTo],
    );

    const toggleTag = useCallback((tag: string) => {
      setSelectedTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
      );
    }, []);

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
        // Selected tags become the review comment so they make it to
        // the backend without a schema change.
        const finalComment = selectedTags.join(" · ");
        await submitReview({
          booking_id: booking.id as Id<"bookings">,
          user_id: userId as Id<"users">,
          shop_id: booking.shopId as Id<"shops">,
          mechanic_id: booking.mechanicId
            ? (booking.mechanicId as Id<"mechanics">)
            : undefined,
          rating,
          comment: finalComment,
        });
        onSubmitted?.(booking.id);
        sheetRef.current?.close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't submit review.");
      } finally {
        setSubmitting(false);
      }
    }, [booking, userId, rating, selectedTags, submitReview, onSubmitted]);

    const summaryLine = useMemo(() => {
      if (!booking) return "";
      const services = booking.services?.[0] ?? "Service";
      const cost =
        typeof booking.totalCost === "number"
          ? ` · $${booking.totalCost.toFixed(2)}`
          : "";
      return `${services}${cost}`;
    }, [booking]);

    const shopInitial = useMemo(() => {
      const name = booking?.shopName?.trim() ?? "";
      return name.length > 0 ? name.charAt(0).toUpperCase() : "?";
    }, [booking]);

    const ratingLabel = RATING_LABELS[rating] ?? RATING_LABELS[0];
    const submitDisabled = submitting || rating < 1;

    return (
      <FloatingSheet
        ref={sheetRef}
        snapHeights={SNAP_HEIGHTS}
        onClose={handleClose}
        showBackdrop
      >
        <View style={styles.body}>
          <View style={styles.header}>
            <Text
              size="2xl"
              weight="bold"
              color="#141C24"
              style={styles.title}
            >
              How was your service?
            </Text>
            <Text
              size="sm"
              weight="regular"
              color="#6B7280"
              style={styles.subtitle}
            >
              Your feedback helps other car owners find great shops
            </Text>
          </View>

          {booking ? (
            <View style={styles.shopCard}>
              <View style={styles.shopAvatar}>
                <Text size="lg" weight="bold" color="#2F6DCC">
                  {shopInitial}
                </Text>
              </View>
              <View style={styles.shopMeta}>
                <Text
                  size="md"
                  weight="semiBold"
                  color="#141C24"
                  numberOfLines={1}
                >
                  {booking.shopName}
                </Text>
                <Text
                  size="sm"
                  weight="regular"
                  color="#6B7280"
                  numberOfLines={1}
                >
                  {summaryLine}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.ratingSection}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = rating >= n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => handleStarPress(n)}
                    hitSlop={8}
                    style={styles.starButton}
                  >
                    <Animated.View
                      style={{ transform: [{ scale: starScales[n - 1] }] }}
                    >
                      <Star
                        size={40}
                        color={filled ? "#F59E0B" : "#E5E7EB"}
                        fill={filled ? "#F59E0B" : "transparent"}
                        strokeWidth={1.5}
                      />
                    </Animated.View>
                  </Pressable>
                );
              })}
            </View>
            <Text
              size="sm"
              weight="semiBold"
              color={ratingLabel.color}
              style={styles.ratingLabel}
            >
              {ratingLabel.text}
            </Text>
          </View>

          {rating > 0 ? (
            <View style={styles.tagsRow}>
              {QUICK_TAGS.map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={({ pressed }) => [
                      styles.chip,
                      selected && styles.chipSelected,
                      pressed && !selected && styles.chipPressed,
                    ]}
                  >
                    <Text
                      size="sm"
                      weight="medium"
                      color={selected ? "#2F6DCC" : "#4B5563"}
                    >
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {error ? (
            <Text
              size="sm"
              weight="regular"
              color="#DC2626"
              style={styles.error}
            >
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitDisabled}
            style={({ pressed }) => [
              styles.submitButton,
              submitDisabled && styles.submitButtonDisabled,
              pressed && !submitDisabled && styles.submitButtonPressed,
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
            style={({ pressed }) => [
              styles.dismissButton,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text size="sm" weight="medium" color="#6B7280">
              Not now
            </Text>
          </Pressable>
        </View>
      </FloatingSheet>
    );
  },
);

LeaveReviewSheet.displayName = "LeaveReviewSheet";

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 18,
    gap: 18,
  },
  header: {
    alignItems: "center",
    gap: 4,
  },
  title: {
    textAlign: "center",
    letterSpacing: -0.4,
  },
  subtitle: {
    textAlign: "center",
    paddingHorizontal: 16,
  },
  shopCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  shopAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  shopMeta: {
    flex: 1,
    gap: 2,
  },
  ratingSection: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  starsRow: {
    flexDirection: "row",
    gap: 10,
  },
  starButton: {
    padding: 2,
  },
  ratingLabel: {
    minHeight: 18,
    letterSpacing: 0.3,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipSelected: {
    backgroundColor: "#EAF2FF",
    borderColor: "#5299FE",
  },
  chipPressed: {
    opacity: 0.7,
  },
  error: {
    textAlign: "center",
  },
  submitButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5299FE",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  dismissButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
});
