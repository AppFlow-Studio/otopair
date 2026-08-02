/**
 * Booking · Confirming route
 *
 * Loading screen shown after the user taps "Confirm Appointment" on the
 * Review & Pay screen. Mirrors the tire-quote requesting visual:
 *   - Lottie pin-drop on a radial OtoPair-blue gradient
 *   - Contextual copy that fades in after the pin lands
 *   - FloatingSheet hosting the appointment summary + an Uber-Eats-style
 *     Confirm-with-countdown button (8s auto-fire) and a Go back link
 *
 * The mutation is gated on the Confirm tap (or the 8s countdown firing).
 * On success the route forwards to /confirmation; on failure it bounces
 * back to /payment with an error param.
 *
 * USED IN: payment screen's `handleConfirmPayment` flow.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform, StyleSheet, View, useWindowDimensions, type DimensionValue } from "react-native";

import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import LottieView from "lottie-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAction, useMutation } from "convex/react";
import { useStripe } from "@stripe/stripe-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { BookingConfirmStatus } from "@/components/booking/BookingConfirmStatus";
import { useCreateBookingConvex } from "@/hooks/useCreateBookingConvex";
import { useToast } from "@/hooks/useToast";
import { CalendarClock } from "lucide-react-native";
import { calculateBookingConfirmLayout } from "@/lib/bookingConfirmSheet";
import { getBookingConfirmingCopy, isBookingRescheduleMode } from "@/lib/reschedule-flow";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { displayTimeToHHMM } from "@/utils/timeSlotUtils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Copy fade-in is gated to the same landing moment as the tire flow so
// the timing reads consistently across both surfaces.
const COPY_FADE_DELAY_MS = 2050;
const COPY_FADE_DURATION_MS = 600;

/** Strip the Convex error wrapper down to the human-readable message. */
function extractErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Something went wrong. Please try again.";
  const raw = err.message;
  const m = raw.match(/(?:Uncaught\s+)?Error:\s*([^\n]+)/i);
  if (m && m[1]) return m[1].trim();
  return raw
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/\[Request ID:[^\]]*\]\s*/gi, "")
    .replace(/\n\s*at\s+.*/g, "")
    .replace(/\n\s*Called by client.*/g, "")
    .trim() || "Something went wrong. Please try again.";
}

export default function BookingConfirmingScreen() {
  const router = useRouter();
  const { id, mode, bookingDbId, paymentMode } = useLocalSearchParams<{
    id: string;
    mode?: string;
    bookingDbId?: string;
    /** "wallet" when entering from an Apple Pay / Google Pay tap on the
     *  payment screen — sources the PM from `selectedWalletPm` instead of
     *  the saved-cards list and tags the payments row with the origin. */
    paymentMode?: string;
  }>();
  const sheetRef = useRef<FloatingSheetRef>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { createBookingConvex } = useCreateBookingConvex();
  const selectedMechanicId = useBookingStore((s) => s.selectedMechanicId);
  const selectedMechanicSlot = useBookingStore((s) => s.selectedMechanicSlot);
  const scheduledAppointment = useBookingStore((s) => s.scheduledAppointment);
  const bookingType = useBookingStore((s) => s.bookingType);
  const getMechanicById = useMechanicStore((s) => s.getMechanicById);
  const selectedPaymentMethodId = usePaymentStore((s) => s.selectedPaymentMethodId);
  const selectedWalletPm = usePaymentStore((s) => s.selectedWalletPm);
  const setSelectedWalletPm = usePaymentStore((s) => s.setSelectedWalletPm);
  const isWalletFlow = paymentMode === "wallet";
  const preauthorizePayment = useAction(api.payments_stripe.preauthorizePaymentForBooking);
  const cancelPreauthorizedPayment = useAction(api.payments_stripe.cancelPreauthorizedPaymentIntent);
  const customerRequestReschedule = useMutation(api.bookings.customerRequestReschedule);
  const rollbackFailedBookingCreation = useMutation(api.bookings.rollbackFailedBookingCreation);
  const toast = useToast();
  // The PaymentIntent is created + confirmed server-side. If 3DS is needed,
  // Stripe returns requires_action and the client *finishes* the challenge
  // via `handleNextAction(clientSecret)` — NOT `confirmPayment`, which
  // would error out on an already-confirmed PI.
  const { handleNextAction } = useStripe();
  const navigatedRef = useRef(false);
  const confirmationAttemptIdRef = useRef(`${Date.now()}:${Math.random().toString(36).slice(2)}`);
  const [submitting, setSubmitting] = useState(false);
  const isCompactLayout = windowHeight < 860;
  const isVeryCompactLayout = windowHeight < 760;
  const isReschedule = isBookingRescheduleMode(mode);
  const confirmingCopy = getBookingConfirmingCopy(isReschedule);
  const confirmLayout = calculateBookingConfirmLayout({
    width: windowWidth,
    height: windowHeight,
  });

  // Open the sheet on mount, same shape as the tire-quote requesting flow.
  // Wallet flow gets the same countdown sheet as the card flow so the user
  // sees the appointment summary + Confirm-with-countdown before the
  // booking lands. The sheet renders inline (renderInModal={false} below)
  // rather than inside a native <Modal>, because the wallet flow lands here
  // straight off the Apple/Google Pay sheet — and iOS won't present a Modal
  // while that one is still dismissing, which silently swallowed the open().
  useEffect(() => {
    sheetRef.current?.open();
  }, []);

  // Copy fade-in (after pin lands).
  const copyOpacity = useSharedValue(0);
  const copyAnimStyle = useAnimatedStyle(() => ({ opacity: copyOpacity.value }));
  useEffect(() => {
    copyOpacity.value = withDelay(
      COPY_FADE_DELAY_MS,
      withTiming(1, { duration: COPY_FADE_DURATION_MS }),
    );
  }, [copyOpacity]);

  const handleSheetClose = useCallback(() => {
    // Fires after the sheet finishes closing on Go back. Pop back to the
    // Review & Pay screen so the user can change something + retry.
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    if (router.canGoBack()) router.back();
    else router.replace(`/booking/mechanic/${id}/payment`);
  }, [router, id]);

  const handleGoBack = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") {
        return undefined;
      }

      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!submitting) {
          handleGoBack();
        }
        return true;
      });

      return () => subscription.remove();
    }, [handleGoBack, submitting])
  );

  const handleConfirm = useCallback(async () => {
    if (submitting || navigatedRef.current) return;
    if (isReschedule) {
      if (!bookingDbId) {
        navigatedRef.current = true;
        router.replace("/(main-tabs)/bookings");
        return;
      }
      if (!scheduledAppointment || !selectedMechanicSlot?.shopId) {
        navigatedRef.current = true;
        router.replace("/(main-tabs)/bookings");
        return;
      }
      setSubmitting(true);
      try {
        const scheduledTime =
          selectedMechanicSlot.scheduledTime ??
          displayTimeToHHMM(scheduledAppointment.time);
        await customerRequestReschedule({
          bookingId: bookingDbId as Id<"bookings">,
          newScheduledDate: scheduledAppointment.date,
          newScheduledTime: scheduledTime,
          ...(selectedMechanicSlot.mechanicId
            ? { newMechanicId: selectedMechanicSlot.mechanicId as Id<"mechanics"> }
            : {}),
        });
        if (navigatedRef.current) return;
        navigatedRef.current = true;
        toast.success("Appointment rescheduled", undefined, { icon: CalendarClock });
        router.replace({
          pathname: "/booking/mechanic/[id]/confirmation",
          params: {
            id,
            bookingDbId,
            mode: "reschedule",
          },
        });
      } catch (err) {
        if (navigatedRef.current) return;
        navigatedRef.current = true;
        router.replace({
          pathname: "/(main-tabs)/bookings",
          params: { rescheduleError: extractErrorMessage(err) },
        });
      }
      return;
    }
    const shopId =
      selectedMechanicSlot?.shopId ??
      (selectedMechanicId ? getMechanicById(selectedMechanicId)?.shopId : null);

    if (!shopId) {
      navigatedRef.current = true;
      router.replace({
        pathname: "/booking/mechanic/[id]/payment",
        params: { id, confirmError: "No shop selected." },
      });
      return;
    }
    // Pick the PM source. Wallet flow consumes the one-time PlatformPay
    // token stashed on the store; card flow uses the saved-card selection.
    const paymentMethodId = isWalletFlow
      ? selectedWalletPm?.id
      : selectedPaymentMethodId;
    if (!paymentMethodId) {
      navigatedRef.current = true;
      router.replace({
        pathname: "/booking/mechanic/[id]/payment",
        params: {
          id,
          confirmError: isWalletFlow
            ? "Wallet session expired. Please tap Apple Pay or Google Pay again."
            : "Add a payment method to confirm.",
        },
      });
      return;
    }
    const paymentOrigin = isWalletFlow ? selectedWalletPm?.type : "card";
    setSubmitting(true);
    let preauthorizedPaymentIntentId: string | null = null;
    let createdBookingId: Id<"bookings"> | null = null;
    try {
      const preauth = await preauthorizePayment({
        shopId: shopId as Id<"shops">,
        paymentMethodId,
        confirmationAttemptId: confirmationAttemptIdRef.current,
        ...(paymentOrigin ? { paymentOrigin } : {}),
      });
      preauthorizedPaymentIntentId = preauth.paymentIntentId;

      if (preauth.requiresAction) {
        const { error } = await handleNextAction(preauth.clientSecret);
        if (error) {
          throw new Error(error.message ?? "Card authorization failed.");
        }
      } else if (
        preauth.status !== "requires_capture" &&
        preauth.status !== "succeeded" &&
        preauth.status !== "processing"
      ) {
        throw new Error(`Card authorization failed (status: ${preauth.status}).`);
      }

      const bookingIds = await createBookingConvex(
        selectedMechanicId,
        bookingType || "book_now",
        {
          stripePaymentIntentId: preauth.paymentIntentId,
          idempotencyKey: preauth.idempotencyKey,
          holdAmountCents: preauth.holdAmountCents,
          ...(paymentOrigin ? { paymentOrigin } : {}),
        },
      );
      const newBookingId = bookingIds[0];
      if (typeof newBookingId === "string" && newBookingId.length > 10) {
        createdBookingId = newBookingId as Id<"bookings">;
      }

      if (navigatedRef.current) return;
      navigatedRef.current = true;
      router.replace({
        pathname: "/booking/mechanic/[id]/confirmation",
        params: newBookingId ? { id, bookingDbId: newBookingId } : { id },
      });
    } catch (err) {
      if (preauthorizedPaymentIntentId) {
        try {
          await cancelPreauthorizedPayment({ paymentIntentId: preauthorizedPaymentIntentId });
        } catch {
          // Best effort: Stripe will expire an uncaptured hold if cancel fails.
        }
      }
      if (createdBookingId) {
        try {
          await rollbackFailedBookingCreation({
            bookingId: createdBookingId,
            reason: extractErrorMessage(err).slice(0, 500),
          });
        } catch {
          // Best effort: still show the original error so the user can retry.
        }
      }
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      router.replace({
        pathname: "/booking/mechanic/[id]/payment",
        params: { id, confirmError: extractErrorMessage(err) },
      });
    } finally {
      // Wallet PMs are one-time tokens — release the slot whether the
      // booking succeeded or fell back to /payment, so a follow-up retry
      // must re-prompt the wallet sheet (Stripe will reject re-use).
      if (isWalletFlow) setSelectedWalletPm(null);
    }
  }, [
    submitting,
    selectedMechanicId,
    selectedMechanicSlot,
    selectedPaymentMethodId,
    selectedWalletPm,
    setSelectedWalletPm,
    isWalletFlow,
    getMechanicById,
    scheduledAppointment,
    isReschedule,
    bookingDbId,
    bookingType,
    createBookingConvex,
    preauthorizePayment,
    cancelPreauthorizedPayment,
    rollbackFailedBookingCreation,
    customerRequestReschedule,
    handleNextAction,
    router,
    id,
  ]);

  return (
    <View style={styles.screen}>
      <LottieView
        source={require("@/assets/animations/logo-loading-animation.json")}
        autoPlay
        loop={false}
        resizeMode="cover"
        style={[
          styles.lottie,
          {
            width: windowWidth,
            height: windowHeight,
            transform: [{ translateY: confirmLayout.lottieTranslateY }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.copyOverlay,
          isCompactLayout && styles.copyOverlayCompact,
          { top: confirmLayout.copyTopPercent as DimensionValue },
          copyAnimStyle,
        ]}
        pointerEvents="none"
      >
        <Text size={isVeryCompactLayout ? "sm" : "md"} weight="bold" color="#000000" center>
          {confirmingCopy.title}
        </Text>
        <Text
          size="xs"
          weight="regular"
          color="#000000"
          center
          style={[styles.copySub, isCompactLayout && styles.copySubCompact]}
        >
          {confirmingCopy.subtitle}
        </Text>
      </Animated.View>

      <FloatingSheet
        ref={sheetRef}
        snapHeights={[confirmLayout.sheetHeight]}
        onClose={handleSheetClose}
        cornerRadius={24}
        // Card flow: render inside the native <Modal> like the
        // rotor / tire quote-requesting screens do — that hides
        // the ghost-card white strip that shows through the
        // sheet's rounded bottom corners in inline mode.
        // Wallet flow: MUST stay inline. iOS won't present a
        // Modal while the Apple / Google Pay sheet is still
        // dismissing, and the open() call gets silently
        // swallowed — the user would see the loading screen
        // with no confirmation sheet.
        renderInModal={!isWalletFlow}
      >
        <BookingConfirmStatus
          onConfirm={handleConfirm}
          onGoBack={handleGoBack}
          mechanicId={id}
          title={confirmingCopy.sheetTitle}
          primaryCta={confirmingCopy.primaryCta}
          showPaymentSummary={confirmingCopy.showPaymentSummary}
        />
      </FloatingSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // Match the Lottie animation's radial-gradient bottom edge.
    // Lottie is translated upward (see `lottieTranslateY`) to lift
    // the pin to a better vertical position, which leaves the bottom
    // strip of the screen showing through — with a #FFFFFF backing
    // it read as a "second card underneath" the floating sheet. A
    // soft pale-blue matches the Lottie's edge so the strip blends
    // into the background instead of hard-edging as white.
    backgroundColor: "#E6EFFA",
  },
  lottie: {
    ...StyleSheet.absoluteFillObject,
  },
  copyOverlay: {
    position: "absolute",
    // Sits below the dropped pin (~30% from top) and above the sheet's
    // top edge — keeps the subcopy clear of the icon and the chrome.
    top: "37%",
    left: 24,
    right: 24,
    alignItems: "center",
    gap: 8,
  },
  copyOverlayCompact: {
    left: 20,
    right: 20,
    gap: 6,
  },
  copySub: {
    marginTop: 2,
  },
  copySubCompact: {
    marginTop: 0,
  },
});
