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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, Platform, StyleSheet, View, useWindowDimensions } from "react-native";

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

import { useAction, useMutation, useQueries, type RequestForQueries } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useStripe } from "@stripe/stripe-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { BookingConfirmStatus } from "@/components/booking/BookingConfirmStatus";
import { useCheckoutServiceGate, useCreateBookingConvex } from "@/hooks/useCreateBookingConvex";
import { useSlotHoldHeartbeat } from "@/hooks/useSlotHoldHeartbeat";
import { useToast } from "@/hooks/useToast";
import { CalendarClock } from "lucide-react-native";
import { calculateBookingConfirmLayout } from "@/lib/bookingConfirmSheet";
import { getBookingConfirmingCopy, isBookingRescheduleMode } from "@/lib/reschedule-flow";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { resolveBookingVehicleVin } from "@/utils/bookingVehicle";
import { displayTimeToHHMM } from "@/utils/timeSlotUtils";
import { readQuoteUnavailableReason } from "@/utils/quoteAvailability";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatBookingError, readBookingError } from "@/convex/lib/bookingErrors";

// Copy fade-in is gated to the same landing moment as the tire flow so
// the timing reads consistently across both surfaces.
const COPY_FADE_DELAY_MS = 2050;
const COPY_FADE_DURATION_MS = 600;

type AcceptQuoteArgs<ResponseTable extends "tire_quote_responses" | "rotor_quote_responses"> = {
  booking_id: Id<"bookings">;
  response_id: Id<ResponseTable>;
  quote_revision: number;
  scheduled_date: string;
  scheduled_time: string;
  mechanic_id?: Id<"mechanics">;
  hold_id?: Id<"slot_holds">;
  session_id?: string;
  /** The $20 deposit just authorized for this accept, so the server records
   *  it on the booking instead of the orphan reaper voiding it (#393). */
  preauthorized_payment?: {
    stripe_payment_intent_id: string;
    idempotency_key: string;
    hold_amount_cents: number;
    payment_origin?: "card" | "apple_pay" | "google_pay";
  };
};

const acceptTireQuoteWithHold = api.bookings.acceptTireQuote as FunctionReference<
  "mutation",
  "public",
  AcceptQuoteArgs<"tire_quote_responses">,
  Id<"bookings">
>;

const acceptRotorQuoteWithHold = api.bookings.acceptRotorQuote as FunctionReference<
  "mutation",
  "public",
  AcceptQuoteArgs<"rotor_quote_responses">,
  Id<"bookings">
>;

const GENERIC_ERROR = "Something went wrong. Please try again.";

const formatCents = (cents: unknown): string | null =>
  typeof cents === "number" && Number.isFinite(cents) ? `$${(cents / 100).toFixed(2)}` : null;

/** "$85.00" or "$85.00 – $150.00" from a PRICE_CHANGED payload's totals. */
function formatCentsRange(low: unknown, high: unknown): string | null {
  const lo = formatCents(low);
  const hi = formatCents(high);
  if (!lo || !hi) return lo ?? hi;
  return lo === hi ? lo : `${lo} – ${hi}`;
}

export default function BookingConfirmingScreen() {
  const router = useRouter();
  const {
    id,
    mode,
    bookingDbId,
    paymentMode,
    expectedStatus: expectedStatusParam,
    expectedScheduledDate: expectedDateParam,
    expectedScheduledTime: expectedTimeParam,
  } = useLocalSearchParams<{
    id: string;
    mode?: string;
    bookingDbId?: string;
    /** "wallet" when entering from an Apple Pay / Google Pay tap on the
     *  payment screen — sources the PM from `selectedWalletPm` instead of
     *  the saved-cards list and tags the payments row with the origin. */
    paymentMode?: string;
    /** Reschedule only (#403): the booking's status / date / time as the
     *  card showed them when the customer started rescheduling. Optional —
     *  when absent, the first value this screen loads is used. */
    expectedStatus?: string;
    expectedScheduledDate?: string;
    expectedScheduledTime?: string;
  }>();
  const sheetRef = useRef<FloatingSheetRef>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { createBookingConvex } = useCreateBookingConvex();
  const selectedMechanicId = useBookingStore((s) => s.selectedMechanicId);
  const selectedMechanicSlot = useBookingStore((s) => s.selectedMechanicSlot);
  const scheduledAppointment = useBookingStore((s) => s.scheduledAppointment);
  const bookingType = useBookingStore((s) => s.bookingType);
  const selectedVehicleVin = useBookingStore((s) => s.selectedVehicleVin);
  const quoteAcceptContext = useBookingStore((s) => s.quoteAcceptContext);
  const holdId = useBookingStore((s) => s.holdId);
  const holdSessionId = useBookingStore((s) => s.holdSessionId);
  const setQuoteAcceptContext = useBookingStore((s) => s.setQuoteAcceptContext);
  const setSlotHold = useBookingStore((s) => s.setSlotHold);
  const removeSelectedServices = useBookingStore((s) => s.removeSelectedServices);
  const setCheckoutPriceChange = useBookingStore((s) => s.setCheckoutPriceChange);
  const getMechanicById = useMechanicStore((s) => s.getMechanicById);
  const selectedPaymentMethodId = usePaymentStore((s) => s.selectedPaymentMethodId);
  const selectedWalletPm = usePaymentStore((s) => s.selectedWalletPm);
  const setSelectedWalletPm = usePaymentStore((s) => s.setSelectedWalletPm);
  const isWalletFlow = paymentMode === "wallet";
  const preauthorizePayment = useAction(api.payments_stripe.preauthorizePaymentForBooking);
  const cancelPreauthorizedPayment = useAction(api.payments_stripe.cancelPreauthorizedPaymentIntent);
  const customerRequestReschedule = useMutation(api.bookings.customerRequestReschedule);
  const rollbackFailedBookingCreation = useMutation(api.bookings.rollbackFailedBookingCreation);
  const acceptTireQuote = useMutation(acceptTireQuoteWithHold);
  const acceptRotorQuote = useMutation(acceptRotorQuoteWithHold);
  const releaseSlotHold = useMutation(api.slotHolds.releaseSlotHold);
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
  const bookingVehicleVin = resolveBookingVehicleVin(
    quoteAcceptContext?.vehicleVin,
    selectedVehicleVin,
  );
  const confirmingCopy = getBookingConfirmingCopy(isReschedule);
  const confirmLayout = calculateBookingConfirmLayout({
    width: windowWidth,
    height: windowHeight,
  });
  const isNewCheckout = !isReschedule && !quoteAcceptContext;

  // ── Hold heartbeat (#393) ─────────────────────────────────────────────
  // Review & Pay's heartbeat pauses while this screen is on top, so keep the
  // leased hold alive here until the commit starts (the commit consumes it).
  // A lease that lapsed is re-held silently; only a failed re-hold bounces
  // back to Review & Pay's "Session expired" prompt.
  const submittingRef = useRef(false);
  submittingRef.current = submitting;
  const handleHoldLost = useCallback(() => {
    if (navigatedRef.current || submittingRef.current) return;
    navigatedRef.current = true;
    router.replace({
      pathname: "/booking/mechanic/[id]/payment",
      params: { id, sessionExpired: "1" },
    });
  }, [router, id]);
  useSlotHoldHeartbeat(holdId, holdSessionId, {
    enabled: isNewCheckout && !submitting,
    onExpired: handleHoldLost,
  });

  // ── Live service gate (#404) ──────────────────────────────────────────
  // Same gate as Review & Pay: if the shop turns a cart service off while
  // the countdown runs, stop it and offer to drop the service. Loading or a
  // query error never blocks — the commit-time guard is the authority.
  const serviceGate = useCheckoutServiceGate(isNewCheckout);
  const handleRemoveBlockedServices = useCallback(() => {
    removeSelectedServices(serviceGate.blockedServiceIds);
    if (useBookingStore.getState().selectedServiceIds.length === 0) {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      router.replace("/(booking-flow)/choose-mechanic");
      return;
    }
    // Back to Review & Pay to see the new total before confirming again.
    sheetRef.current?.close();
  }, [removeSelectedServices, serviceGate.blockedServiceIds, router]);

  // ── Reschedule watch (#403) ───────────────────────────────────────────
  // The reschedule fires on a countdown; if the booking moves under it (shop
  // started the job, checked the car in, someone else rescheduled or
  // cancelled), stop the auto-fire and say why. useQueries so a query error
  // degrades to "not blocked" — the mutation's expected* guard still holds.
  const rescheduleQueries = useMemo(
    () =>
      isReschedule && bookingDbId
        ? {
            actions: {
              query: api.bookings.getCustomerBookingActions,
              args: { bookingId: bookingDbId as Id<"bookings"> },
            },
            booking: {
              query: api.bookings.getBookingByIdForCustomer,
              args: { bookingId: bookingDbId as Id<"bookings"> },
            },
          }
        : {},
    [isReschedule, bookingDbId],
  );
  const rescheduleResults = useQueries(rescheduleQueries as RequestForQueries);
  const rescheduleActions = rescheduleResults.actions as
    | {
        status: string;
        canReschedule: boolean;
        rescheduleBlockedReason: { code: string; message: string } | null;
      }
    | null
    | undefined
    | Error;
  const rescheduleBookingRow = rescheduleResults.booking as
    | { status: string; scheduledDate?: string; scheduledTime?: string }
    | null
    | undefined
    | Error;
  // What the customer was looking at when they started: route params when
  // the entry point passes them, else the first booking row this screen sees.
  const [rescheduleExpected, setRescheduleExpected] = useState<{
    status?: string;
    date?: string;
    time?: string;
  } | null>(() =>
    expectedStatusParam || expectedDateParam || expectedTimeParam
      ? {
          status: expectedStatusParam || undefined,
          date: expectedDateParam || undefined,
          time: expectedTimeParam || undefined,
        }
      : null,
  );
  useEffect(() => {
    if (rescheduleExpected || !rescheduleBookingRow || rescheduleBookingRow instanceof Error) return;
    setRescheduleExpected({
      status: rescheduleBookingRow.status,
      date: rescheduleBookingRow.scheduledDate,
      time: rescheduleBookingRow.scheduledTime,
    });
  }, [rescheduleExpected, rescheduleBookingRow]);

  const rescheduleLoading =
    isReschedule &&
    !!bookingDbId &&
    (rescheduleActions === undefined || rescheduleBookingRow === undefined);
  const rescheduleBlockMessage = useMemo((): string | null => {
    if (!isReschedule || !bookingDbId) return null;
    if (rescheduleBookingRow === null || rescheduleActions === null) {
      return "We couldn't find that booking. It may have been cancelled or removed.";
    }
    if (
      rescheduleActions &&
      !(rescheduleActions instanceof Error) &&
      rescheduleActions.canReschedule === false
    ) {
      return (
        rescheduleActions.rescheduleBlockedReason?.message ??
        "This booking can't be rescheduled here any more. Message the shop to change your appointment."
      );
    }
    if (
      rescheduleExpected &&
      rescheduleBookingRow &&
      !(rescheduleBookingRow instanceof Error) &&
      ((rescheduleExpected.status != null && rescheduleBookingRow.status !== rescheduleExpected.status) ||
        (rescheduleExpected.date != null &&
          rescheduleBookingRow.scheduledDate !== rescheduleExpected.date) ||
        (rescheduleExpected.time != null &&
          rescheduleBookingRow.scheduledTime !== rescheduleExpected.time))
    ) {
      return "This booking just changed. Take another look and try again.";
    }
    return null;
  }, [isReschedule, bookingDbId, rescheduleActions, rescheduleBookingRow, rescheduleExpected]);

  const handleBackToBookings = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace("/(main-tabs)/bookings");
  }, [router]);

  const confirmBlocker = useMemo(() => {
    if (rescheduleBlockMessage) {
      return {
        message: rescheduleBlockMessage,
        actionLabel: "Back to bookings",
        onAction: handleBackToBookings,
      };
    }
    if (serviceGate.blocked && serviceGate.message) {
      return {
        message: serviceGate.message,
        actionLabel:
          serviceGate.blockedServiceIds.length === 1
            ? "Remove it from this booking"
            : "Remove them from this booking",
        onAction: handleRemoveBlockedServices,
      };
    }
    return null;
  }, [
    rescheduleBlockMessage,
    handleBackToBookings,
    serviceGate.blocked,
    serviceGate.message,
    serviceGate.blockedServiceIds.length,
    handleRemoveBlockedServices,
  ]);
  // Read at fire time: the countdown can't commit past a blocker that
  // appeared after its last render.
  const blockedRef = useRef(false);
  blockedRef.current = confirmBlocker != null || rescheduleLoading;

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
    if (blockedRef.current) return;
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
          // Stale-view guard (#403): what the customer was looking at.
          ...(rescheduleExpected?.status ? { expectedStatus: rescheduleExpected.status } : {}),
          ...(rescheduleExpected?.date ? { expectedScheduledDate: rescheduleExpected.date } : {}),
          ...(rescheduleExpected?.time ? { expectedScheduledTime: rescheduleExpected.time } : {}),
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
        const code = readBookingError(err)?.code;
        const message = formatBookingError(
          err,
          "Couldn't request reschedule. Please try again in a moment.",
        );
        if (
          code === "JOB_ALREADY_STARTED" ||
          code === "VEHICLE_CHECKED_IN" ||
          code === "RESCHEDULE_LIMIT_REACHED"
        ) {
          // Only the shop can move it now — offer the conversation.
          Alert.alert("Can't reschedule here", message, [
            {
              text: "Message the shop",
              onPress: () =>
                router.replace({
                  pathname: "/(main-tabs)/bookings",
                  params: { bookingId: bookingDbId, openChat: "1" },
                }),
            },
            {
              text: "OK",
              style: "cancel",
              onPress: () => router.replace("/(main-tabs)/bookings"),
            },
          ]);
          return;
        }
        if (code === "SLOT_UNAVAILABLE" || code === "OUTSIDE_SHOP_HOURS" || code === "INVALID_TIME") {
          // The time is the problem, not the booking: back to the picker.
          toast.warning(message);
          if (router.canGoBack()) router.back();
          else router.replace({ pathname: "/(main-tabs)/bookings", params: { rescheduleError: message } });
          return;
        }
        // BOOKING_STATE_CHANGED / BOOKING_ALREADY_CANCELLED / anything else:
        // close and let the refreshed card show where the booking stands.
        router.replace({
          pathname: "/(main-tabs)/bookings",
          params: { rescheduleError: message },
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
    // Route a failed commit by code (#390 / #393 / #404) BEFORE falling back
    // to Review & Pay's generic error modal. The $20 PI is already voided.
    const routeCheckoutFailure = (
      err: unknown,
      conflict: ReturnType<typeof readBookingError>,
      message: string,
      failedShopId: string,
    ) => {
      const code = conflict?.code;
      if (quoteAcceptContext) {
        const quoteReason = readQuoteUnavailableReason(err);
        if (quoteReason) {
          setQuoteAcceptContext(null);
          router.replace({
            pathname: "/(main-tabs)/bookings",
            params: { tab: "quotes", quoteUnavailable: quoteReason },
          });
          return;
        }
        if (code === "SERVICE_NOT_OFFERED") {
          // The shop stopped offering the quoted service: back to the quotes.
          setQuoteAcceptContext(null);
          toast.warning(message);
          router.replace({ pathname: "/(main-tabs)/bookings", params: { tab: "quotes" } });
          return;
        }
      }
      if (code === "PRICE_CHANGED" && conflict) {
        const snapshot = useBookingStore.getState().checkoutPriceSnapshot;
        setCheckoutPriceChange({
          message,
          previousFormatted:
            snapshot?.formatted ??
            formatCentsRange(conflict.previousTotalLowCents, conflict.previousTotalHighCents),
          newFormatted: formatCentsRange(conflict.newTotalLowCents, conflict.newTotalHighCents),
        });
        router.replace({ pathname: "/booking/mechanic/[id]/payment", params: { id } });
        return;
      }
      if (code === "SERVICE_NOT_OFFERED" && conflict) {
        const dropIds = Array.isArray(conflict.serviceIds)
          ? conflict.serviceIds.map((sid) => String(sid))
          : [];
        if (dropIds.length > 0) removeSelectedServices(dropIds);
        if (useBookingStore.getState().selectedServiceIds.length === 0) {
          toast.warning(message);
          router.replace("/(booking-flow)/choose-mechanic");
          return;
        }
        router.replace({
          pathname: "/booking/mechanic/[id]/payment",
          params: { id, confirmError: message },
        });
        return;
      }
      if (
        code === "SLOT_UNAVAILABLE" ||
        code === "OUTSIDE_SHOP_HOURS" ||
        code === "SLOT_HOLD_EXPIRED" ||
        code === "CHECKOUT_EXPIRED"
      ) {
        // The time is gone (or this checkout ran out): pick a new one. The
        // next /confirming mount mints a fresh attempt id, so a
        // CHECKOUT_EXPIRED PaymentIntent is never retried.
        const { holdId: staleHoldId, holdSessionId: staleSession } = useBookingStore.getState();
        if (staleHoldId && staleSession) {
          releaseSlotHold({
            holdId: staleHoldId as Id<"slot_holds">,
            session_id: staleSession,
          }).catch(() => {});
        }
        setSlotHold(null);
        toast.warning(message);
        router.replace({
          pathname: "/(booking-flow)/pick-datetime",
          params: {
            shopId: failedShopId,
            ...(selectedMechanicId ? { mechanicId: selectedMechanicId } : {}),
          },
        });
        return;
      }
      router.replace({
        pathname: "/booking/mechanic/[id]/payment",
        params: { id, confirmError: message },
      });
    };
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

      let resultBookingId: Id<"bookings"> | null = null;
      if (quoteAcceptContext) {
        // Accepting an existing tire/rotor quote: the booking row already
        // exists (created when the customer requested the quote), so this
        // patches it in place instead of creating a new one — no rollback
        // path needed on failure, it just stays as it was.
        if (!scheduledAppointment) {
          throw new Error("Pick a date and time first.");
        }
        const scheduledTime =
          selectedMechanicSlot?.scheduledTime ?? displayTimeToHHMM(scheduledAppointment.time);
        const mechanicIdArg = selectedMechanicSlot?.mechanicId
          ? (selectedMechanicSlot.mechanicId as Id<"mechanics">)
          : undefined;
        // Link the $20 deposit to the booking in the accept itself, like
        // every other flow — otherwise the orphan reaper voids it (#393).
        const quoteOrigin: "card" | "apple_pay" | "google_pay" | undefined =
          paymentOrigin === "card" || paymentOrigin === "apple_pay" || paymentOrigin === "google_pay"
            ? paymentOrigin
            : undefined;
        const quotePreauth = {
          stripe_payment_intent_id: preauth.paymentIntentId,
          idempotency_key: preauth.idempotencyKey,
          hold_amount_cents: preauth.holdAmountCents,
          ...(quoteOrigin ? { payment_origin: quoteOrigin } : {}),
        };
        resultBookingId =
          quoteAcceptContext.quoteType === "rotor"
            ? await acceptRotorQuote({
                booking_id: quoteAcceptContext.bookingId,
                response_id: quoteAcceptContext.responseId as Id<"rotor_quote_responses">,
                quote_revision: quoteAcceptContext.revision,
                scheduled_date: scheduledAppointment.date,
                scheduled_time: scheduledTime,
                mechanic_id: mechanicIdArg,
                hold_id: holdId ? (holdId as Id<"slot_holds">) : undefined,
                session_id: holdSessionId ?? undefined,
                preauthorized_payment: quotePreauth,
              })
            : await acceptTireQuote({
                booking_id: quoteAcceptContext.bookingId,
                response_id: quoteAcceptContext.responseId as Id<"tire_quote_responses">,
                quote_revision: quoteAcceptContext.revision,
                scheduled_date: scheduledAppointment.date,
                scheduled_time: scheduledTime,
                mechanic_id: mechanicIdArg,
                hold_id: holdId ? (holdId as Id<"slot_holds">) : undefined,
                session_id: holdSessionId ?? undefined,
                preauthorized_payment: quotePreauth,
              });
      } else {
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
          resultBookingId = createdBookingId;
        }
      }

      if (navigatedRef.current) return;
      navigatedRef.current = true;
      if (quoteAcceptContext) setQuoteAcceptContext(null);
      router.replace({
        pathname: "/booking/mechanic/[id]/confirmation",
        params: resultBookingId
          ? {
              id,
              bookingDbId: resultBookingId,
              ...(bookingVehicleVin ? { bookingVehicleVin } : {}),
            }
          : { id },
      });
    } catch (err) {
      if (preauthorizedPaymentIntentId) {
        try {
          await cancelPreauthorizedPayment({ paymentIntentId: preauthorizedPaymentIntentId });
        } catch {
          // Best effort: Stripe will expire an uncaptured hold if cancel fails.
        }
      }
      const conflict = readBookingError(err);
      const message = formatBookingError(err, GENERIC_ERROR);
      if (createdBookingId) {
        try {
          await rollbackFailedBookingCreation({
            bookingId: createdBookingId,
            reason: message.slice(0, 500),
          });
        } catch {
          // Best effort: still show the original error so the user can retry.
        }
      }
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      routeCheckoutFailure(err, conflict, message, shopId);
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
    quoteAcceptContext,
    bookingVehicleVin,
    holdId,
    holdSessionId,
    setQuoteAcceptContext,
    acceptTireQuote,
    acceptRotorQuote,
    handleNextAction,
    router,
    id,
    rescheduleExpected,
    setCheckoutPriceChange,
    removeSelectedServices,
    releaseSlotHold,
    setSlotHold,
    toast,
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
          { top: confirmLayout.copyTop },
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
          blocker={confirmBlocker}
          loading={rescheduleLoading}
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
