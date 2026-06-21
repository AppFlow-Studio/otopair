/**
 * Approve-Estimate Screen
 *
 * Full-screen prompt for the customer when a mechanic's submitted set
 * price is out of the disclosed range (pre-job), exceeds the prior
 * approved ceiling (mid-job), or exceeds the approved total at job
 * completion (post-job).
 *
 * Layout grounded in ReviewPayContent breakdown grammar. Pattern: header
 * → "what changed" parts list → totals → info banner → sticky
 * Decline / Approve footer.
 *
 * The header copy varies by cycle. The decline-confirm modal is inline
 * (Alert) — full FeedbackModal pattern is overkill for binary intent.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { useAction, useMutation, useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ShieldCheck,
  Wrench,
  CreditCard,
} from "lucide-react-native";
import {
  PlatformPay,
  PlatformPayError,
  useStripe,
  usePlatformPay,
} from "@stripe/stripe-react-native";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Text } from "@/components/shared-ui";
import {
  BrandColors,
  SemanticColors,
  Spacing,
  SurfaceColors,
  CardShadow,
} from "@/constants/theme";
import { useOpenApprovalForBooking } from "@/hooks/useOpenApprovalForBooking";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { useBookingStore } from "@/stores/useBookingStore";

function formatUsd(cents: number | undefined | null): string {
  const v = ((cents ?? 0) / 100).toFixed(2);
  return `$${v}`;
}

const HEADER_BY_CYCLE: Record<string, string> = {
  pre_job: "Your car needs a little more than expected",
  mid_job: "An update from your mechanic",
  post_job: "Your final breakdown",
};

const SUBTITLE_BY_CYCLE: Record<string, string> = {
  pre_job:
    "Your mechanic took a closer look and found additional work. Here's what changed — review and approve to keep things moving.",
  mid_job:
    "While working, your mechanic found additional scope. Review the updated total below and approve to continue.",
  post_job:
    "The work is done. Here's the final breakdown before your card is charged.",
};

/**
 * Top-level dispatcher. Decides whether the customer landed here to act on
 * an open over-range estimate (the original purpose) or to confirm a new
 * card hold after Stripe rejected the increment (`payment_approval_state ===
 * "reauth_required"`). The reauth path enters via:
 *   - Tap on the red `ApprovalBanner` rendered on the booking card.
 *   - Tap on a `booking_reauth_required` notification (deep link includes
 *     `mode=reauth`).
 * We trust the param when present, but also re-check live state so a stale
 * deep link can't render the wrong view.
 */
export default function ApproveEstimateScreen() {
  const params = useLocalSearchParams<{ id: string; mode?: string }>();
  const bookingId = params.id as Id<"bookings">;
  const booking = useQuery(api.bookings.getById, { id: bookingId });
  const liveState = (
    booking as { payment_approval_state?: string } | null | undefined
  )?.payment_approval_state;
  const isReauth = params.mode === "reauth" || liveState === "reauth_required";
  return isReauth ? (
    <ReauthView bookingId={bookingId} booking={booking} />
  ) : (
    <ApprovalDecisionView bookingId={bookingId} />
  );
}

function ApprovalDecisionView({ bookingId }: { bookingId: Id<"bookings"> }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { approval, isLoading } = useOpenApprovalForBooking(bookingId);
  const applyDecision = useMutation(api.booking_approvals.applyApprovalDecision);
  const [submitting, setSubmitting] = useState<"approved" | "declined" | null>(
    null,
  );

  const breakdown = useMemo(() => {
    if (!approval) return null;
    const parts = (approval.parts_snapshot ?? []) as any[];
    let partsCents = 0;
    for (const p of parts) {
      if (p?.not_used) continue;
      if (p?.supplied_by === "customer") continue;
      const qty = Math.max(0, p?.quantity ?? 1);
      partsCents += Math.round((p?.cost ?? 0) * qty * 100);
    }
    const laborHours = approval.labor_hours ?? 0;
    const laborRateCents = approval.labor_rate_cents ?? 0;
    const laborCents = Math.round(laborHours * laborRateCents);
    // Tax + service fee are not echoed back per-row from the server; the
    // total minus the visible labor + parts gives us the combined remainder.
    const total = approval.mechanic_set_price_cents;
    const remainder = Math.max(0, total - partsCents - laborCents);
    return { parts, partsCents, laborCents, laborHours, total, remainder };
  }, [approval]);

  const handleApprove = async () => {
    if (submitting) return;
    setSubmitting("approved");
    try {
      await applyDecision({ bookingId, decision: "approved" });
      router.back();
    } catch (err: any) {
      Alert.alert("Could not approve", err?.message ?? "Try again in a moment.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleDecline = () => {
    if (submitting) return;
    Alert.alert(
      "Decline updated estimate?",
      "Your mechanic will be notified and your vehicle will be returned to you. A $20 deposit will be captured to cover the inspection time.",
      [
        { text: "Keep reviewing", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setSubmitting("declined");
            try {
              await applyDecision({ bookingId, decision: "declined" });
              router.back();
            } catch (err: any) {
              Alert.alert(
                "Could not decline",
                err?.message ?? "Try again in a moment.",
              );
            } finally {
              setSubmitting(null);
            }
          },
        },
      ],
    );
  };

  if (isLoading || !approval || !breakdown) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={BrandColors.primary} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={{ color: SemanticColors.textMuted }}>
            {isLoading ? "Loading…" : "No estimate is waiting for your review."}
          </Text>
        </View>
      </View>
    );
  }

  const header = HEADER_BY_CYCLE[approval.cycle] ?? "Estimate update";
  const subtitle = SUBTITLE_BY_CYCLE[approval.cycle] ?? "";
  const rangeLow = approval.disclosed_range_low_cents ?? 0;
  const rangeHigh = approval.disclosed_range_high_cents ?? 0;
  const deltaCents = approval.mechanic_set_price_cents - rangeHigh;

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
        <ChevronLeft size={24} color={BrandColors.primary} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: 160 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.iconChip, styles.iconChipAmber]}>
            <Wrench size={24} color={SemanticColors.warningAmber} />
          </View>
          <Text weight="bold" style={styles.h1}>
            {header}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.card}>
          {rangeHigh > 0 && (
            <View style={styles.estimateRow}>
              <Text style={styles.cardMuted}>Original estimate</Text>
              <Text style={styles.estimateOriginal}>
                {formatUsd(rangeLow)} – {formatUsd(rangeHigh)}
              </Text>
            </View>
          )}
          <View style={styles.totalHero}>
            <Text style={styles.cardMuted}>Updated total</Text>
            <Text
              weight="bold"
              style={styles.totalHeroValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {formatUsd(approval.mechanic_set_price_cents)}
            </Text>
          </View>
          {deltaCents > 0 && (
            <View style={styles.deltaPill}>
              <Text weight="semiBold" style={styles.deltaPillText}>
                {formatUsd(deltaCents)} above your estimate
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text weight="semiBold" style={styles.sectionLabel}>
            What changed
          </Text>
          {breakdown.parts.map((p: any, idx: number) => {
            if (p?.not_used) return null;
            if (p?.supplied_by === "customer") return null;
            const qty = Math.max(0, p?.quantity ?? 1);
            const lineCents = Math.round((p?.cost ?? 0) * qty * 100);
            const isManual = p?.source === "manual";
            return (
              <View key={idx} style={styles.partRow}>
                <View style={{ flex: 1 }}>
                  <Text weight="semiBold" style={styles.partName}>
                    {p?.part_name ?? "Part"}
                  </Text>
                  {p?.oem_number ? (
                    <Text style={styles.partOem}>
                      {p?.brand ? `${p.brand} · ` : ""}
                      {p.oem_number}
                    </Text>
                  ) : null}
                  <Text style={styles.partOem}>
                    Qty {qty} · {formatUsd(Math.round((p?.cost ?? 0) * 100))} ea
                  </Text>
                  {isManual && p?.justification_text ? (
                    <Text style={styles.partJustification}>
                      “{p.justification_text}”
                    </Text>
                  ) : null}
                </View>
                <Text weight="semiBold" style={styles.partTotal}>
                  {formatUsd(lineCents)}
                </Text>
              </View>
            );
          })}

          {approval.notes ? (
            <View style={styles.noteBlock}>
              <Text weight="semiBold" style={styles.noteLabel}>
                Why the change
              </Text>
              <Text style={styles.noteText}>“{approval.notes}”</Text>
            </View>
          ) : null}

          <View style={styles.cardDivider} />

          <View style={styles.totalsBlock}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Parts</Text>
              <Text style={styles.totalValue}>
                {formatUsd(breakdown.partsCents)}
              </Text>
            </View>
            {breakdown.laborCents > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Labor
                  {breakdown.laborHours ? ` (${breakdown.laborHours} hrs)` : ""}
                </Text>
                <Text style={styles.totalValue}>
                  {formatUsd(breakdown.laborCents)}
                </Text>
              </View>
            )}
            {breakdown.remainder > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax + service fee</Text>
                <Text style={styles.totalValue}>
                  {formatUsd(breakdown.remainder)}
                </Text>
              </View>
            )}
            <View style={[styles.totalRow, { marginTop: Spacing.sm }]}>
              <Text
                weight="semiBold"
                style={styles.totalLabelBold}
                numberOfLines={1}
              >
                Updated total
              </Text>
              <Text
                weight="semiBold"
                style={[styles.totalLabelBold, styles.totalValueRight]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatUsd(approval.mechanic_set_price_cents)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoBanner}>
          <ShieldCheck
            size={18}
            color={SemanticColors.primaryBlue}
            style={{ marginTop: 1 }}
          />
          <Text style={styles.infoText}>
            Approving raises the hold on your card to{" "}
            {formatUsd(approval.mechanic_set_price_cents)}. You're only charged
            when the work is complete.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable
          onPress={handleDecline}
          disabled={submitting !== null}
          style={[styles.btn, styles.btnDecline, submitting && { opacity: 0.5 }]}
        >
          <Text weight="semiBold" style={styles.btnDeclineText}>
            {submitting === "declined" ? "Declining…" : "Decline"}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleApprove}
          disabled={submitting !== null}
          style={[styles.btn, styles.btnApprove, submitting && { opacity: 0.7 }]}
        >
          {submitting === "approved" ? (
            <Text weight="semiBold" style={styles.btnApproveText}>
              Approving…
            </Text>
          ) : (
            <View style={styles.btnApproveStack}>
              <Text weight="semiBold" style={styles.btnApproveLabel}>
                Approve
              </Text>
              <Text
                weight="bold"
                style={styles.btnApproveAmount}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatUsd(approval.mechanic_set_price_cents)}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/**
 * ReauthView — customer-side confirm-hold flow.
 *
 * Backend wrote `payment_approval_state = "reauth_required"` after Stripe's
 * `incrementAuthorization` was rejected (SCA challenge required, processor
 * refusal, or PM doesn't support incremental auth). The booking is parked
 * until the customer confirms a new hold at the running approved ceiling
 * (or attaches a new card).
 *
 * Flow:
 *   1. Confirm-hold → call `createPaymentIntentForBooking` with the saved
 *      PM. If `requiresAction`, drive `handleNextAction(clientSecret)` to
 *      run the 3DS sheet. Backend webhook clears `payment_approval_state`
 *      when the new PI lands in `requires_capture`.
 *   2. Use a different card → navigate to the existing `/add-payment`
 *      route. After the user saves, `usePaymentStore.selectPaymentMethod`
 *      pre-selects it; they tap Confirm-hold to retry with the new PM.
 *   3. Cancel booking → mirrors `BookingDetailsSheet` cancel (local store
 *      patch + back). Convex-side cancel is server-driven elsewhere; we
 *      intentionally don't duplicate that surface here.
 */
function ReauthView({
  bookingId,
  booking,
}: {
  bookingId: Id<"bookings">;
  booking: any;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { handleNextAction } = useStripe();
  const { createPlatformPayPaymentMethod } = usePlatformPay();
  // Reauth uses a dedicated action (NOT createPaymentIntentForBooking):
  // the public booking action short-circuits when a PI already exists for
  // the booking and just returns it — useless here because the existing
  // PI is the stale $20 deposit. `resumeReauthFromMobile` cancels the old
  // PI and creates a fresh one at the new approved ceiling, on-session,
  // so Stripe can surface 3DS via `requires_action` for `handleNextAction`.
  const resumeReauth = useAction(api.payments_stripe.resumeReauthFromMobile);
  const selectedPaymentMethodId = usePaymentStore(
    (s) => s.selectedPaymentMethodId,
  );
  const paymentMethods = usePaymentStore((s) => s.paymentMethods);
  // Originating payment method (card vs. wallet) for this booking. Wallets
  // can't silently reauth — we must re-prompt the customer for a fresh
  // PlatformPay token because the original one-time PM is no longer valid.
  const paymentOrigin = useQuery(
    api.payments_stripe.getPaymentOriginForBooking,
    { bookingId },
  );
  const isWalletOrigin =
    paymentOrigin === "apple_pay" || paymentOrigin === "google_pay";
  const [submitting, setSubmitting] = useState(false);

  const isBookingLoading = booking === undefined;
  // Prefer the approved ceiling (what backend will re-auth to). Fall back
  // to mechanic_set_price_cents for older bookings that haven't been
  // through the new approval cycle yet.
  const newHoldCents: number =
    booking?.running_approved_ceiling_cents ??
    booking?.mechanic_set_price_cents ??
    0;
  const stillReauth = booking?.payment_approval_state === "reauth_required";

  // Resolve which PM to charge. Prefer the user's current selection
  // (which `AddPaymentScreen` updates after a save), then default,
  // then the first saved card.
  const pmId = useMemo<string | null>(() => {
    if (selectedPaymentMethodId) return selectedPaymentMethodId;
    const def = paymentMethods.find((pm) => pm.isDefault);
    if (def) return def.id;
    return paymentMethods[0]?.id ?? null;
  }, [paymentMethods, selectedPaymentMethodId]);

  const handleConfirmHold = useCallback(async () => {
    if (submitting) return;
    let pmIdToCharge: string | null = null;
    let originForRow: "card" | "apple_pay" | "google_pay" | undefined;

    if (isWalletOrigin) {
      // Wallet origin → re-present the same wallet sheet to mint a fresh
      // one-time PM. The original wallet token is invalid for re-use; only
      // the user's biometric / device auth on a new sheet can produce a
      // valid PM. iOS shows Apple Pay; Android shows Google Pay.
      setSubmitting(true);
      try {
        const { paymentMethod, error } =
          paymentOrigin === "apple_pay"
            ? await createPlatformPayPaymentMethod({
                applePay: {
                  cartItems: [
                    {
                      paymentType: PlatformPay.PaymentType.Immediate,
                      label: "OtoPair booking",
                      amount: ((newHoldCents ?? 0) / 100).toFixed(2),
                    },
                  ],
                  merchantCountryCode: "US",
                  currencyCode: "USD",
                },
              })
            : await createPlatformPayPaymentMethod({
                googlePay: {
                  testEnv: __DEV__,
                  merchantCountryCode: "US",
                  currencyCode: "USD",
                  merchantName: "OtoPair",
                },
              });
        if (error) {
          if (error.code !== PlatformPayError.Canceled) {
            Alert.alert(
              "Couldn't confirm hold",
              error.message ?? "Wallet authorization failed.",
            );
          }
          setSubmitting(false);
          return;
        }
        if (!paymentMethod) {
          Alert.alert(
            "Couldn't confirm hold",
            "Wallet didn't return a payment method.",
          );
          setSubmitting(false);
          return;
        }
        pmIdToCharge = paymentMethod.id;
        originForRow = paymentOrigin;
      } catch (err: any) {
        Alert.alert(
          "Couldn't confirm hold",
          err?.message ?? "Wallet authorization failed.",
        );
        setSubmitting(false);
        return;
      }
    } else {
      // Card origin (or origin not yet recorded — legacy bookings).
      if (!pmId) {
        Alert.alert(
          "Add a card first",
          "You don't have a saved card. Tap 'Use a different card' to add one.",
        );
        return;
      }
      pmIdToCharge = pmId;
      originForRow = "card";
      setSubmitting(true);
    }

    try {
      const pi = await resumeReauth({
        bookingId,
        paymentMethodId: pmIdToCharge!,
        ...(originForRow ? { paymentOrigin: originForRow } : {}),
      });
      if (pi.requiresAction) {
        const { error } = await handleNextAction(pi.clientSecret);
        if (error) {
          throw new Error(
            error.message ?? "Card authorization failed.",
          );
        }
        // 3DS succeeded. The `amount_capturable_updated` webhook in
        // otopair-web/convex/http.ts clears `payment_approval_state` from
        // `reauth_required` once Stripe posts the event, so no explicit
        // server call is needed here.
      } else if (
        pi.status !== "requires_capture" &&
        pi.status !== "succeeded" &&
        pi.status !== "processing"
      ) {
        throw new Error(`Card authorization failed (status: ${pi.status}).`);
      }
      router.back();
    } catch (err: any) {
      Alert.alert(
        "Couldn't confirm hold",
        err?.message ?? "Try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    pmId,
    isWalletOrigin,
    paymentOrigin,
    newHoldCents,
    createPlatformPayPaymentMethod,
    resumeReauth,
    bookingId,
    handleNextAction,
    router,
  ]);

  const handleUseDifferentCard = useCallback(() => {
    if (submitting) return;
    router.push({ pathname: "/add-payment" } as any);
  }, [submitting, router]);

  const handleCancelBooking = useCallback(() => {
    if (submitting) return;
    Alert.alert(
      "Cancel booking?",
      "Your mechanic will be notified and the booking will be cancelled.",
      [
        { text: "Keep booking", style: "cancel" },
        {
          text: "Cancel booking",
          style: "destructive",
          onPress: () => {
            useBookingStore.getState().cancelBooking(String(bookingId));
            router.back();
          },
        },
      ],
    );
  }, [submitting, bookingId, router]);

  if (isBookingLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={BrandColors.primary} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={{ color: SemanticColors.textMuted }}>Loading…</Text>
        </View>
      </View>
    );
  }

  // State may have cleared in flight (background webhook resolved). Show a
  // calm confirmation rather than the scary "couldn't confirm" alert.
  if (!stillReauth) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={BrandColors.primary} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={{ color: SemanticColors.textMuted, textAlign: "center", paddingHorizontal: Spacing.xl }}>
            Your card hold is already confirmed. No action needed.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <ChevronLeft size={24} color={BrandColors.primary} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: 240 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.iconChip, styles.iconChipBlue]}>
            <CreditCard size={24} color={BrandColors.secondary} />
          </View>
          <Text weight="bold" style={styles.h1}>
            Confirm your card hold
          </Text>
          <Text style={styles.subtitle}>
            {isWalletOrigin
              ? paymentOrigin === "apple_pay"
                ? "We couldn't extend the hold on your Apple Pay automatically. Confirm below to re-authorize and keep your booking moving."
                : "We couldn't extend the hold on your Google Pay automatically. Confirm below to re-authorize and keep your booking moving."
              : "Your bank needs to verify the updated hold before work can begin. Confirm below — you may be asked to authenticate — or use a different card."}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardMuted}>New hold amount</Text>
          <Text
            weight="bold"
            style={styles.totalHeroValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatUsd(newHoldCents)}
          </Text>

          <View style={styles.cardDivider} />

          <View style={styles.nextRow}>
            <ShieldCheck
              size={18}
              color={SemanticColors.primaryBlue}
              style={{ marginTop: 1 }}
            />
            <Text style={styles.infoTextPlain}>
              We&apos;ll re-authorize {formatUsd(newHoldCents)} as a hold.
              You&apos;re only charged when the work is complete.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          styles.footerStack,
          { paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <Pressable
          onPress={handleConfirmHold}
          // paymentOrigin === undefined means the query is in flight —
          // disable so the user doesn't tap and fall through to the card
          // branch before the origin lands.
          disabled={submitting || paymentOrigin === undefined}
          style={[
            styles.btn,
            styles.btnApprove,
            styles.btnFull,
            (submitting || paymentOrigin === undefined) && { opacity: 0.7 },
          ]}
        >
          <View style={styles.btnApproveStack}>
            <Text weight="semiBold" style={styles.btnApproveLabel}>
              {submitting
                ? "Confirming…"
                : isWalletOrigin
                  ? paymentOrigin === "apple_pay"
                    ? "Confirm with Apple Pay"
                    : "Confirm with Google Pay"
                  : "Confirm hold of"}
            </Text>
            {!submitting && (
              <Text
                weight="bold"
                style={styles.btnApproveAmount}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatUsd(newHoldCents)}
              </Text>
            )}
          </View>
        </Pressable>

        <Pressable
          onPress={handleUseDifferentCard}
          disabled={submitting}
          style={[
            styles.btn,
            styles.btnSecondary,
            styles.btnFull,
            submitting && { opacity: 0.5 },
          ]}
        >
          <Text weight="semiBold" style={styles.btnSecondaryText}>
            Use a different card
          </Text>
        </Pressable>

        <Pressable
          onPress={handleCancelBooking}
          disabled={submitting}
          hitSlop={8}
          style={styles.tertiaryLinkWrap}
        >
          <Text weight="semiBold" style={styles.tertiaryLinkText}>
            Cancel booking
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SurfaceColors.canvas },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backLabel: { color: BrandColors.primary, marginLeft: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // ── Hero ──────────────────────────────────────────────────────────────
  hero: {
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  iconChip: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  iconChipAmber: { backgroundColor: "rgba(217,119,6,0.12)" },
  iconChipBlue: { backgroundColor: "rgba(82,153,254,0.12)" },
  h1: {
    fontSize: 24,
    lineHeight: 30,
    color: BrandColors.primary,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: SemanticColors.textMuted,
    textAlign: "center",
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },

  // ── Cards ─────────────────────────────────────────────────────────────
  card: {
    backgroundColor: SurfaceColors.cardSurface,
    borderRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.md,
    boxShadow: CardShadow.default,
  },
  cardMuted: { color: SemanticColors.textMuted, fontSize: 13 },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SemanticColors.border,
    marginVertical: Spacing.lg,
  },

  // ── Price summary ─────────────────────────────────────────────────────
  estimateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: Spacing.lg,
  },
  estimateOriginal: {
    fontSize: 15,
    color: SemanticColors.textMuted,
    textDecorationLine: "line-through",
  },
  totalHero: { alignItems: "flex-start" },
  totalHeroValue: {
    fontSize: 40,
    lineHeight: 48,
    color: BrandColors.primary,
    letterSpacing: -1,
    marginTop: 2,
  },
  deltaPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(217,119,6,0.12)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: Spacing.md,
  },
  deltaPillText: { color: SemanticColors.warningAmber, fontSize: 13 },

  // ── What changed ──────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 16,
    color: BrandColors.primary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.2,
  },
  partRow: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SemanticColors.border,
  },
  partName: { fontSize: 15, color: BrandColors.primary },
  partOem: { fontSize: 12, color: SemanticColors.textMuted, marginTop: 2 },
  partJustification: {
    fontSize: 12,
    color: SemanticColors.warningAmber,
    fontStyle: "italic",
    marginTop: 4,
  },
  partTotal: { fontSize: 15, color: BrandColors.primary, marginLeft: Spacing.md },
  noteBlock: {
    backgroundColor: SurfaceColors.canvas,
    borderRadius: 16,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  noteLabel: {
    fontSize: 13,
    color: SemanticColors.textMuted,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
    color: SemanticColors.textSecondary,
    fontStyle: "italic",
  },

  // ── Totals ────────────────────────────────────────────────────────────
  totalsBlock: { gap: Spacing.sm },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { color: SemanticColors.textSecondary },
  totalValue: { color: BrandColors.primary },
  totalLabelBold: { color: BrandColors.primary, fontSize: 16 },
  totalValueRight: {
    flexShrink: 1,
    marginLeft: Spacing.md,
    textAlign: "right",
  },

  // ── Info / next-step note ─────────────────────────────────────────────
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: SemanticColors.primaryBlueLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 16,
    marginTop: Spacing.xs,
  },
  infoText: {
    flex: 1,
    color: SemanticColors.primaryBlueDark,
    fontSize: 13,
    lineHeight: 18,
  },
  nextRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  infoTextPlain: {
    flex: 1,
    color: SemanticColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Footer + buttons ──────────────────────────────────────────────────
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: SurfaceColors.cardSurface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SemanticColors.border,
  },
  btn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDecline: { backgroundColor: "#F2F2F7" },
  btnDeclineText: { color: BrandColors.primary, fontSize: 16 },
  btnApprove: { backgroundColor: BrandColors.secondary, flex: 1.5 },
  btnApproveText: { color: "#FFFFFF", fontSize: 16 },
  btnApproveStack: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingHorizontal: Spacing.sm,
  },
  btnApproveLabel: { color: "#FFFFFF", fontSize: 12, opacity: 0.9 },
  btnApproveAmount: { color: "#FFFFFF", fontSize: 18 },
  // ── Reauth footer additions ───────────────────────────────────────────
  footerStack: { flexDirection: "column", gap: Spacing.sm },
  btnFull: { width: "100%", flex: 0 },
  btnSecondary: { backgroundColor: "#F2F2F7" },
  btnSecondaryText: { color: BrandColors.primary, fontSize: 15 },
  tertiaryLinkWrap: {
    paddingVertical: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  tertiaryLinkText: { color: SemanticColors.textMuted, fontSize: 14 },
});
