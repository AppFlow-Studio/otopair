/**
 * LeaveReviewSheet
 *
 * Bottom sheet for leaving a review on a completed booking. Two steps:
 *   1. Rate the mechanic who worked on the car (stars + optional note).
 *   2. Rate the shop (stars + quick-tag chips + a free-text experience note).
 * Bookings without a mechanic skip step 1 and open straight on the shop step.
 *
 * Submit calls `reviews.submit`, which inserts the row(s) and trips the
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
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { useMutation } from "convex/react";
import { ChevronLeft, Star } from "lucide-react-native";

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

type Step = "mechanic" | "shop";

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
   *  that many shop stars instead of the default 5. Used by surfaces that
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

    // Two-step flow: rate the mechanic (step 1) then the shop (step 2).
    // Bookings without a mechanic skip straight to the shop step.
    const [step, setStep] = useState<Step>("mechanic");
    // Mechanic review is opt-out — skipping step 1 drops the mechanic row.
    const [mechanicSkipped, setMechanicSkipped] = useState(false);
    const [mechanicRating, setMechanicRating] = useState(5);
    const [mechanicComment, setMechanicComment] = useState("");

    // Default to 5 stars — most reviews are positive and pre-filling
    // matches the "you're rating, drag down to lower" pattern.
    const [rating, setRating] = useState(5);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [shopComment, setShopComment] = useState("");

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
        const hasMechanic = !!(b.mechanicId && b.mechanicName);
        setBooking(b);
        setUserId(uid);
        setRating(startRating);
        setSelectedTags([]);
        setShopComment("");
        setMechanicSkipped(false);
        setMechanicRating(5);
        setMechanicComment("");
        // Mechanic-first: open on the mechanic step when one worked the
        // booking, otherwise go straight to the shop step.
        setStep(hasMechanic ? "mechanic" : "shop");
        setError(null);
        sheetRef.current?.open();
        // Pop whichever star row the opening step shows.
        if (hasMechanic) popMechStarsUpTo(5);
        else popStarsUpTo(startRating);
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

    const goToShopStep = useCallback(() => {
      setMechanicSkipped(false);
      setStep("shop");
      popStarsUpTo(rating);
    }, [popStarsUpTo, rating]);

    const skipMechanic = useCallback(() => {
      setMechanicSkipped(true);
      setStep("shop");
      popStarsUpTo(rating);
    }, [popStarsUpTo, rating]);

    const backToMechanicStep = useCallback(() => {
      setError(null);
      setStep("mechanic");
    }, []);

    const toggleTag = useCallback((tag: string) => {
      setSelectedTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
      );
    }, []);

    const handleSubmit = useCallback(async () => {
      if (!booking || !userId) return;
      if (rating < 1) {
        setError("Tap a star to rate the shop.");
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
        // Free-text experience + quick tags both land in shop_comment (no
        // schema change): the written note first, tag summary on a new line.
        const tagLine = selectedTags.join(" · ");
        const noteLine = shopComment.trim();
        const finalShopComment = [noteLine, tagLine].filter(Boolean).join("\n");
        const includeMechanic = !mechanicSkipped && !!booking.mechanicId;
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
        // Surface a clean line instead of the raw Convex stack. Our own
        // client-side throws above are already user-friendly; only the
        // server errors need translating.
        const raw = err instanceof Error ? err.message : "";
        const friendly = /already been reviewed/i.test(raw)
          ? "You've already reviewed this booking."
          : /\[CONVEX|Server Error|at handler/i.test(raw)
            ? "Couldn't submit your review. Please try again."
            : raw || "Couldn't submit review.";
        setError(friendly);
      } finally {
        setSubmitting(false);
      }
    }, [
      booking,
      userId,
      rating,
      selectedTags,
      shopComment,
      mechanicSkipped,
      mechanicRating,
      mechanicComment,
      submitReview,
      onSubmitted,
      toast,
    ]);

    const mechanicAvailable = !!(booking?.mechanicId && booking?.mechanicName);
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

    const shopRatingLabel = RATING_LABELS[rating] ?? RATING_LABELS[0];
    const mechanicRatingLabel = RATING_LABELS[mechanicRating] ?? RATING_LABELS[0];
    const submitDisabled = submitting || rating < 1;

    // On the mechanic step, render it; otherwise (or when there's no mechanic)
    // render the shop step. `showMechanicStep` gates the whole step 1 branch.
    const showMechanicStep = step === "mechanic" && mechanicAvailable;

    const snapHeights = useMemo(() => {
      // Two detents per step so the grabber can be dragged up to grow the
      // sheet (and back down): a snug resting height that hugs the step's
      // content, and a tall detent that expands toward full-screen. At the
      // tall detent FloatingSheet flattens the bottom corners and pins to the
      // edges. Keyboard-lift absorbs any typing overflow.
      const fit = (base: number) =>
        Math.max(screenHeight * 0.52, Math.min(screenHeight * 0.82, base));
      const resting = !mechanicAvailable
        ? fit(600)
        // Mechanic step hugs its content (~515pt). A taller detent here left
        // ~45pt of empty slack below "Skip" and pushed the whole (bottom-
        // anchored) sheet higher up the screen, so it rests lower now.
        : showMechanicStep
          ? fit(525)
          : fit(648);
      const expanded = Math.min(screenHeight - insets.top - 16, screenHeight * 0.94);
      // Keep the array strictly ascending — on very short screens the resting
      // height can already meet the cap, so fall back to a single detent.
      return expanded > resting + 24 ? [resting, expanded] : [resting];
    }, [screenHeight, insets.top, mechanicAvailable, showMechanicStep]);

    return (
      <FloatingSheet
        ref={sheetRef}
        snapHeights={snapHeights}
        onClose={handleClose}
        showBackdrop
        liftWithKeyboard
        floatBottomInset={12}
      >
        <View style={styles.body}>
          {/* Step indicator + back (only when a mechanic step exists) */}
          {mechanicAvailable ? (
            <View style={styles.stepBar}>
              {step === "shop" ? (
                <Pressable
                  onPress={backToMechanicStep}
                  style={styles.backButton}
                  hitSlop={8}
                >
                  <ChevronLeft size={18} color="#6B7280" />
                  <Text size="sm" weight="medium" color="#6B7280">
                    Back
                  </Text>
                </Pressable>
              ) : null}
              <Text size="xs" weight="semiBold" color="#9CA3AF">
                {showMechanicStep ? "Step 1 of 2" : "Step 2 of 2"}
              </Text>
            </View>
          ) : null}

          {showMechanicStep ? (
            // ── STEP 1 — mechanic ──────────────────────────────────────
            <>
              <View style={styles.header}>
                <Text size="2xl" weight="bold" color="#141C24" style={styles.title}>
                  How was your mechanic?
                </Text>
                <Text size="sm" weight="regular" color="#6B7280" style={styles.subtitle}>
                  {mechanicFirstName
                    ? `${mechanicFirstName} worked on your car`
                    : "Rate the mechanic who worked on your car"}
                </Text>
              </View>

              {booking ? (
                <View style={styles.shopCard}>
                  <View style={styles.shopAvatar}>
                    <Text size="lg" weight="bold" color="#2F6DCC">
                      {mechanicInitial}
                    </Text>
                  </View>
                  <View style={styles.shopMeta}>
                    <Text size="md" weight="semiBold" color="#141C24" numberOfLines={1}>
                      {booking.mechanicName}
                    </Text>
                    <Text size="sm" weight="regular" color="#6B7280" numberOfLines={1}>
                      {summaryLine}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.ratingSection}>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const filled = mechanicRating >= n;
                    return (
                      <Pressable
                        key={n}
                        onPress={() => handleMechStarPress(n)}
                        hitSlop={8}
                        style={styles.starButton}
                      >
                        <Animated.View
                          style={{ transform: [{ scale: mechStarScales[n - 1] }] }}
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
                  color={mechanicRatingLabel.color}
                  style={styles.ratingLabel}
                >
                  {mechanicRatingLabel.text}
                </Text>
              </View>

              <TextInput
                value={mechanicComment}
                onChangeText={setMechanicComment}
                placeholder={`Add a note for ${mechanicFirstName ?? "your mechanic"} (optional)`}
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={280}
                style={styles.commentInput}
              />

              <Pressable
                onPress={goToShopStep}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.submitButtonPressed,
                ]}
              >
                <Text size="md" weight="semiBold" color="#FFFFFF">
                  Next
                </Text>
              </Pressable>

              <Pressable
                onPress={skipMechanic}
                style={({ pressed }) => [
                  styles.dismissButton,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text size="sm" weight="medium" color="#6B7280">
                  Skip mechanic review
                </Text>
              </Pressable>
            </>
          ) : (
            // ── STEP 2 — shop ──────────────────────────────────────────
            <>
              <View style={styles.header}>
                <Text size="2xl" weight="bold" color="#141C24" style={styles.title}>
                  How was the shop?
                </Text>
                <Text size="sm" weight="regular" color="#6B7280" style={styles.subtitle}>
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
                    <Text size="md" weight="semiBold" color="#141C24" numberOfLines={1}>
                      {booking.shopName}
                    </Text>
                    <Text size="sm" weight="regular" color="#6B7280" numberOfLines={1}>
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
                  color={shopRatingLabel.color}
                  style={styles.ratingLabel}
                >
                  {shopRatingLabel.text}
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

              <TextInput
                value={shopComment}
                onChangeText={setShopComment}
                placeholder="Write about your experience at the shop (optional)"
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={500}
                style={[styles.commentInput, styles.shopCommentInput]}
              />

              {error ? (
                <Text size="sm" weight="regular" color="#DC2626" style={styles.error}>
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
            </>
          )}
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
    paddingBottom: 24,
    gap: 18,
  },
  stepBar: {
    height: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    left: 0,
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
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
  commentInput: {
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
  shopCommentInput: {
    minHeight: 88,
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
