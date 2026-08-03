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
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { useMutation } from "convex/react";
import { ChevronDown, ChevronUp, Star } from "lucide-react-native";

import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { Text } from "@/components/shared-ui";
import { OfflineActionsNotice } from "@/components/connection/OfflineActionsNotice";
import { useConnection } from "@/hooks/useConnection";
import { isBookingActionAllowed } from "@/lib/connection/offlineBookingActions";
import { useToast } from "@/hooks/useToast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Booking } from "@/components/bookings/BookingCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Two heights — the sheet animates between them when the mechanic
// section toggles open. Module-scoped + memoized below so the array
// reference is stable per branch (passing `[N]` inline would
// retrigger FloatingSheet's enter animation on every render).
const COLLAPSED_SHEET_MIN_HEIGHT = 580;
const EXPANDED_SHEET_MIN_HEIGHT = 780;

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
  /** Open the sheet for a booking. `initialRating` (1–5) pre-selects
   *  that many stars instead of the default 5. Used by surfaces that
   *  let the user tap a star outside the sheet (e.g. the Review card
   *  on the past-service detail) and want the sheet to open already
   *  reflecting that tap. */
  open: (booking: Booking, userId: string, initialRating?: number) => void;
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
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    // Default to 5 stars — most reviews are positive and pre-filling
    // matches the "you're rating, drag down to lower" pattern.
    const [rating, setRating] = useState(5);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    // Mechanic review — opt-out. Defaults to expanded so the mechanic
    // section auto-renders with 5 stars whenever the booking has a
    // mechanic. User can collapse to skip the mechanic review. The
    // effect below re-syncs to `mechanicAvailable` whenever a new
    // booking opens the sheet.
    const [mechanicIncluded, setMechanicIncluded] = useState(true);
    const [mechanicRating, setMechanicRating] = useState(5);
    const [mechanicComment, setMechanicComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submitReview = useMutation(api.reviews.submit);
    const toast = useToast();
    // Offline gate: the sheet is often already open when the connection
    // drops. Convex would queue the mutation silently and post it on
    // reconnect — the user must never think a review landed while offline,
    // so Submit is replaced by the offline caption until we're back.
    const conn = useConnection();
    const reviewAllowed = isBookingActionAllowed("leaveReview", conn !== "offline");

    // One Animated.Value per star for the pop-on-tap micro-interaction.
    const starScales = useRef<Animated.Value[]>(
      [1, 2, 3, 4, 5].map(() => new Animated.Value(1)),
    ).current;
    const mechStarScales = useRef<Animated.Value[]>(
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

    const popMechStarsUpTo = useCallback(
      (n: number) => {
        mechStarScales.slice(0, n).forEach((anim, i) => {
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
      [mechStarScales],
    );

    useImperativeHandle(ref, () => ({
      open: (b, uid, initialRating) => {
        const startRating = initialRating != null
          ? Math.max(1, Math.min(5, Math.round(initialRating)))
          : 5;
        setBooking(b);
        setUserId(uid);
        setRating(startRating);
        setSelectedTags([]);
        // Opt-out: auto-expand the mechanic section whenever the booking
        // has a mechanic. The mechanicAvailable effect below double-checks
        // once `booking` propagates, but this initial set keeps the UI
        // from flashing collapsed on first paint.
        setMechanicIncluded(!!(b.mechanicId && b.mechanicName));
        setMechanicRating(5);
        setMechanicComment("");
        setError(null);
        sheetRef.current?.open();
        // Stagger the star fill on open for a small "ta-da". Animates
        // from 0 up to whatever the initial rating is.
        popStarsUpTo(startRating);
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

    const handleMechStarPress = useCallback(
      (n: number) => {
        setMechanicRating(n);
        popMechStarsUpTo(n);
      },
      [popMechStarsUpTo],
    );

    const toggleMechanic = useCallback(() => {
      setMechanicIncluded((prev) => {
        const next = !prev;
        if (next) popMechStarsUpTo(5);
        return next;
      });
    }, [popMechStarsUpTo]);

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
        // Bail out defensively for stale pre-Convex IDs that do not have a
        // real Convex shop_id.
        if (!booking.id || booking.id.startsWith("tire_quote_")) {
          throw new Error("This booking is not linked to Convex, so the review was skipped.");
        }
        if (!booking.shopId) {
          throw new Error("Missing shop on this booking — can't post a review.");
        }
        // Selected tags become the review comment so they make it to
        // the backend without a schema change.
        const finalShopComment = selectedTags.join(" · ");
        const includeMechanic = mechanicIncluded && !!booking.mechanicId;
        await submitReview({
          booking_id: booking.id as Id<"bookings">,
          user_id: userId as Id<"users">,
          shop_id: booking.shopId as Id<"shops">,
          shop_rating: rating,
          shop_comment: finalShopComment,
          mechanic_id: includeMechanic
            ? (booking.mechanicId as Id<"mechanics">)
            : undefined,
          mechanic_rating: includeMechanic ? mechanicRating : undefined,
          mechanic_comment: includeMechanic ? mechanicComment.trim() : undefined,
        });
        onSubmitted?.(booking.id);
        sheetRef.current?.close();
        toast.success("Thanks for the review", undefined, { icon: Star });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't submit review.");
      } finally {
        setSubmitting(false);
      }
    }, [
      booking,
      userId,
      rating,
      selectedTags,
      // Mechanic-side values were missing here — the closure was capturing
      // their initial-render values (mechanicComment: "", mechanicRating: 5,
      // mechanicIncluded: false at the time of writing) so the user's typed
      // comment never reached the backend. Add them so handleSubmit always
      // reads the live state.
      mechanicIncluded,
      mechanicRating,
      mechanicComment,
      submitReview,
      onSubmitted,
      toast,
    ]);

    const mechanicAvailable = !!(booking?.mechanicId && booking?.mechanicName);
    // Keep `mechanicIncluded` in sync with availability. Defaults to ON
    // when a mechanic is on the booking (opt-out), OFF when there isn't.
    // Re-runs each time a different booking opens the sheet.
    React.useEffect(() => {
      setMechanicIncluded(mechanicAvailable);
    }, [mechanicAvailable]);
    const mechanicFirstName = useMemo(() => {
      const name = booking?.mechanicName?.trim() ?? "";
      return name.length > 0 ? name.split(/\s+/)[0] : null;
    }, [booking]);
    const mechanicInitial = useMemo(() => {
      const name = booking?.mechanicName?.trim() ?? "";
      return name.length > 0 ? name.charAt(0).toUpperCase() : "?";
    }, [booking]);

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
    const snapHeights = useMemo(() => {
      // Same formula BookingDetailsSheet uses for its mid detent —
      // hard-cap around 640pt so the sheet sits low on the screen
      // with a clear floating gap above. Form content scrolls
      // inside the ScrollView when it doesn't all fit.
      const target = Math.max(
        screenHeight * 0.66,
        Math.min(screenHeight * 0.76, 640),
      );
      // Mechanic section expanded needs a little more room than
      // collapsed; bump the cap by 60pt so the mechanic stars +
      // note input land above the Submit pill without immediate
      // scrolling. Still capped well below the status bar.
      const expandedTarget = Math.max(
        screenHeight * 0.7,
        Math.min(screenHeight * 0.82, 700),
      );

      return [mechanicIncluded ? expandedTarget : target];
    }, [mechanicIncluded, screenHeight]);

    return (
      <FloatingSheet
        ref={sheetRef}
        snapHeights={snapHeights}
        onClose={handleClose}
        showBackdrop
      >
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 18 }]}
          showsVerticalScrollIndicator={false}
        >
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

          {mechanicAvailable ? (
            <View style={styles.mechanicSection}>
              <Pressable onPress={toggleMechanic} style={styles.mechanicToggle}>
                <View style={styles.mechanicAvatar}>
                  <Text size="md" weight="bold" color="#2F6DCC">
                    {mechanicInitial}
                  </Text>
                </View>
                <View style={styles.mechanicToggleText}>
                  <Text size="sm" weight="semiBold" color="#141C24">
                    Also review your mechanic
                  </Text>
                  <Text size="xs" weight="regular" color="#6B7280">
                    {mechanicFirstName} worked on this booking
                  </Text>
                </View>
                {mechanicIncluded ? (
                  <ChevronUp size={18} color="#6B7280" />
                ) : (
                  <ChevronDown size={18} color="#6B7280" />
                )}
              </Pressable>

              {mechanicIncluded ? (
                <View style={styles.mechanicBody}>
                  <View style={styles.mechStarsRow}>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const filled = mechanicRating >= n;
                      return (
                        <Pressable
                          key={n}
                          onPress={() => handleMechStarPress(n)}
                          hitSlop={6}
                          style={styles.starButton}
                        >
                          <Animated.View
                            style={{
                              transform: [{ scale: mechStarScales[n - 1] }],
                            }}
                          >
                            <Star
                              size={28}
                              color={filled ? "#F59E0B" : "#E5E7EB"}
                              fill={filled ? "#F59E0B" : "transparent"}
                              strokeWidth={1.5}
                            />
                          </Animated.View>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    value={mechanicComment}
                    onChangeText={setMechanicComment}
                    placeholder={`A note for ${mechanicFirstName ?? "your mechanic"} (optional)`}
                    placeholderTextColor="#9CA3AF"
                    multiline
                    maxLength={280}
                    style={styles.mechanicCommentInput}
                  />
                </View>
              ) : null}
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

          {reviewAllowed ? (
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
          ) : (
            <OfflineActionsNotice label="You'll need a connection to review" />
          )}

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
        </ScrollView>
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
  mechanicSection: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    overflow: "hidden",
  },
  mechanicToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  mechanicAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  mechanicToggleText: {
    flex: 1,
    gap: 2,
  },
  mechanicBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  mechStarsRow: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "center",
  },
  mechanicCommentInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 64,
    fontFamily: "Urbanist-Regular",
    fontSize: 14,
    color: "#141C24",
    textAlignVertical: "top",
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
