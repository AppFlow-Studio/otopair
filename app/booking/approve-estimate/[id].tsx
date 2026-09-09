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

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
  CircleCheck,
  FileCheck,
  FileX,
  Wallet,
  X,
} from "lucide-react-native";
import { useStripe } from "@stripe/stripe-react-native";
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
import { useConfirmHold } from "@/hooks/useConfirmHold";
import { PaymentMethodModal } from "@/components/booking/modals/PaymentMethodModal";
import { PaymentMethodBlock } from "@/components/booking/PaymentMethodBlock";
import { AppleIcon } from "@/components/icons/apple";
import { useOfflineGuard } from "@/hooks/useOfflineGuard";
import { useToast } from "@/hooks/useToast";
import { useBookingActions } from "@/hooks/useBookingActions";
import { buildCancelCopy } from "@/constants/bookingActionPolicy";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { buildInspectionFindingRows } from "@/lib/inspection-findings";
import {
  ReceiptContent,
  type ReceiptPayload,
} from "@/components/receipts/ReceiptContent";
import { ReceiptSkeleton } from "@/components/receipts/ReceiptSkeleton";

function formatUsd(cents: number | undefined | null): string {
  const v = ((cents ?? 0) / 100).toFixed(2);
  return `$${v}`;
}

/**
 * Appointment "when" line for the already-confirmed recap. `scheduledDate` is
 * an ISO-ish string; render it friendly (Mon, Aug 7) and append the raw time
 * slot when present. Falls back to the raw date string if it won't parse.
 */
function formatApptWhen(
  date: string | null | undefined,
  time: string | null | undefined,
): string | null {
  let d: string | null = null;
  if (date) {
    const parsed = new Date(date);
    d = Number.isNaN(parsed.getTime())
      ? date
      : parsed.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
  }
  const parts = [d, time].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Title-case a raw status like `in_progress` → `In Progress`. */
function statusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return status
    .split("_")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Collapse a mechanic-added service's parts down to the ones actually being
 * used and quoted.
 *
 * A catalog service (e.g. "Oil Change") seeds its parts from the OEM catalog,
 * which lists every fitment candidate — two drain-plug gaskets, two engine
 * oils — when only one of each goes on the job. Keep one row per part name,
 * preferring the candidate whose OEM number appears on the approval's quoted
 * parts (`quotedOemNumbers`); fall back to the first when the quote names none
 * of them. Insertion order is preserved so the list still reads top-down.
 */
function usedAndQuotedParts<
  T extends { part_name: string; oem_number: string | null; quantity: number },
>(parts: T[], quotedOemNumbers: Set<string>): T[] {
  const isQuoted = (oem: string | null) =>
    !!oem && quotedOemNumbers.has(oem.trim().toLowerCase());
  const byRole = new Map<string, T>();
  for (const part of parts) {
    const role = part.part_name.trim().toLowerCase().replace(/\s+/g, " ");
    const existing = byRole.get(role);
    if (!existing) {
      byRole.set(role, part);
    } else if (isQuoted(part.oem_number) && !isQuoted(existing.oem_number)) {
      byRole.set(role, part);
    }
  }
  return [...byRole.values()];
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

// Heading + intro for the "recommended service" card that sits under the
// Original Estimate Card. Keyed by the approval cycle so the pre-job estimate
// (work found during inspection) and the mid-job change (work found while
// running) each read in their own tense. post_job has no additions of its own,
// so it's absent — the card never renders there.
const ADDED_SERVICES_COPY: Record<string, { title: string; intro: string }> = {
  pre_job: {
    title: "Recommended by your mechanic",
    intro: "Found during inspection, before work begins.",
  },
  mid_job: {
    title: "What your mechanic found",
    intro: "Added after work started. This is what the extra cost is for.",
  },
};

/**
 * Top-level dispatcher. Routes to one of four views depending on where the job
 * is in the price-agreement lifecycle:
 *   - ReauthView — confirm a card hold after Stripe rejected the increment
 *     (`payment_approval_state === "reauth_required"`), pre- OR post-job.
 *     Enters via the `ApprovalBanner` or a `booking_reauth_required` push
 *     (deep link → `mode=reauth`).
 *   - CompletionReceiptView — the booking is `completed`: the price was agreed
 *     before the job, so the "final breakdown" is an informational receipt with
 *     no approve/decline.
 *   - SettlementPendingView — completed but `awaiting_settlement` (the agreed
 *     price couldn't be captured yet); a soft prompt into the reauth flow.
 *   - ApprovalDecisionView — an open pre/mid-job over-range estimate awaiting
 *     the customer's approve/decline (the original purpose).
 * We trust the `mode` param when present, but also re-check live state so a
 * stale deep link can't render the wrong view.
 */
export default function ApproveEstimateScreen() {
  const params = useLocalSearchParams<{
    id: string;
    mode?: string;
    // Set by the merged approve-and-hold flow so a mid-flow flip to
    // `reauth_required` doesn't yank the customer to the standalone ReauthView
    // — the approval screen confirms the hold inline instead.
    inlineHold?: string;
  }>();
  const bookingId = params.id as Id<"bookings">;
  const booking = useQuery(api.bookings.getById, { id: bookingId });
  const actions = useQuery(api.bookings.getCustomerBookingActions, {
    bookingId,
  });
  useOfflineGuard(booking);
  const liveState = (
    booking as { payment_approval_state?: string } | null | undefined
  )?.payment_approval_state;
  const isReauth =
    params.mode === "reauth" ||
    (liveState === "reauth_required" && params.inlineHold !== "1");

  // Reauth confirms a card hold — a pre-job hold increment, or, post-job, the
  // agreed price when it couldn't be captured on completion. It's the one
  // actionable payment step, so it always takes precedence.
  if (isReauth) {
    return <ReauthView bookingId={bookingId} booking={booking} />;
  }

  // Non-reauth paths must tell a completed booking (→ receipt) from an open
  // pre/mid-job estimate (→ approve/decline). Wait for both queries so we never
  // flash the wrong screen.
  if (booking === undefined || actions === undefined) {
    return <LoadingScreen />;
  }

  // A completed booking has nothing left to approve or decline — the price was
  // agreed before work began. Render the final breakdown as an informational
  // receipt, or a soft "payment pending" prompt while the charge is still being
  // settled. NEVER the approve/decline view (no post-job decision exists).
  const completion = actions?.completion ?? null;
  if (completion) {
    return completion.settlementState === "awaiting_settlement" ? (
      <SettlementPendingView
        bookingId={bookingId}
        shortfallCents={completion.settlementShortfallCents}
      />
    ) : (
      <CompletionReceiptView bookingId={bookingId} />
    );
  }

  return <ApprovalDecisionView bookingId={bookingId} booking={booking} />;
}

/** Shared minimal loading scaffold — back affordance + centered spinner copy. */
function LoadingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
        <ChevronLeft size={24} color={BrandColors.primary} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
      <View style={styles.center}>
        <Text style={{ color: SemanticColors.textMuted }}>Loading…</Text>
      </View>
    </View>
  );
}

/**
 * CompletionReceiptView — the post-completion "final breakdown", rendered as an
 * informational receipt. The price was agreed before the job (pre/mid-job
 * approvals), captured at completion, and there is nothing to approve or
 * decline here — the single action is a neutral dismiss. Line items come from
 * `api.bookings.getReceipt` (the same source as the emailed receipt); we do NOT
 * call `applyApprovalDecision` for a completed booking.
 */
function CompletionReceiptView({ bookingId }: { bookingId: Id<"bookings"> }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const receipt = useQuery(api.bookings.getReceipt, { bookingId });

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
        <ChevronLeft size={24} color={BrandColors.primary} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {receipt === undefined ? (
          <ReceiptSkeleton />
        ) : receipt === null ? (
          <View style={[styles.card, styles.center, { marginHorizontal: Spacing.lg }]}>
            <Text style={{ color: SemanticColors.textMuted, textAlign: "center" }}>
              We couldn&apos;t load your receipt right now. Head back and try
              again.
            </Text>
          </View>
        ) : (
          <ReceiptContent payload={receipt as ReceiptPayload} />
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          styles.footerStack,
          { paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.btn, styles.btnApprove, styles.btnFull]}
        >
          <Text weight="semiBold" style={styles.btnApproveText}>
            Done
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * SettlementPendingView — the completed-but-not-yet-captured case
 * (`settlement_state === "awaiting_settlement"`). We can't show a clean receipt
 * because the agreed price wasn't fully captured (usually the card needs a
 * fresh authorization). Soft prompt → routes into the reauth view (§4); the
 * reconciliation cron captures on its next tick once the hold is confirmed.
 */
function SettlementPendingView({
  bookingId,
  shortfallCents,
}: {
  bookingId: Id<"bookings">;
  shortfallCents: number;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
        <ChevronLeft size={24} color={BrandColors.primary} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: 200 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.iconChip, styles.iconChipBlue]}>
            <CreditCard size={24} color={BrandColors.secondary} />
          </View>
          <Text weight="bold" style={styles.h1}>
            Payment pending
          </Text>
          <Text style={styles.subtitle}>
            Your work is complete, but we couldn&apos;t finish charging your card
            for the agreed total
            {shortfallCents > 0 ? ` (${formatUsd(shortfallCents)} outstanding)` : ""}
            . Confirm your card to settle it.
          </Text>
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
          onPress={() => router.setParams({ mode: "reauth" })}
          style={[styles.btn, styles.btnApprove, styles.btnFull]}
        >
          <Text weight="semiBold" style={styles.btnApproveText}>
            Confirm your card
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.tertiaryLinkWrap}
        >
          <Text weight="semiBold" style={styles.tertiaryLinkText}>
            Not now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ApprovalDecisionView({
  bookingId,
  booking,
}: {
  bookingId: Id<"bookings">;
  booking: any;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { approval, isLoading } = useOpenApprovalForBooking(bookingId);
  const applyDecision = useMutation(api.booking_approvals.applyApprovalDecision);
  const approveAndAuthorizeHold = useAction(
    api.payments_stripe.approveAndAuthorizeHold,
  );
  const { handleNextAction } = useStripe();
  const toast = useToast();
  // `submitting` now only tracks the decline path; accept is driven by `phase`.
  const [submitting, setSubmitting] = useState<"declined" | null>(null);

  // Merged accept flow. Tapping "Accept & update hold" records the approval AND
  // places the new hold on the customer's chosen method in one on-session call
  // (`approveAndAuthorizeHold`) — no bounce to a separate reauth screen, and the
  // picked method (switched card / Apple Pay / Google Pay) is always the one
  // authorized. `useConfirmHold` resolves + mints that method.
  const {
    resolvePaymentMethod,
    methodKind,
    methodLabel,
    canConfirm,
    originLoading,
    applePaySupported,
    googlePaySupported,
  } = useConfirmHold(bookingId, booking);
  // Picker (Apple Pay / Google Pay / saved cards / add card). Choosing a wallet
  // sets `walletIntent` in the store, which `useConfirmHold` honors.
  const [pickerVisible, setPickerVisible] = useState(false);
  // Full-screen viewer for a tapped mechanic scope photo (null = closed).
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const setWalletIntent = usePaymentStore((s) => s.setWalletIntent);
  // Start from the booking's own payment method and don't leak the wallet
  // choice made here into other flows: clear any stale intent on entry, and
  // this screen's intent on exit.
  useEffect(() => {
    setWalletIntent(null);
    return () => setWalletIntent(null);
  }, [setWalletIntent]);
  const [phase, setPhase] = useState<"review" | "processing">("review");
  // Amount snapshotted at accept time — the open approval clears the moment
  // it's decided, so the processing view can't read it back off `approval`.
  const [acceptedCents, setAcceptedCents] = useState<number>(0);

  const isDeclining = submitting === "declined";
  const isProcessing = phase === "processing";
  const busy = isDeclining || isProcessing;

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
  const inspectionFindings = useMemo(
    () => buildInspectionFindingRows(approval?.inspection_snapshot),
    [approval?.inspection_snapshot],
  );
  /* The off-catalog work the mechanic added — before starting (pre-job) or
     while working (mid-job). The screen used to show a total and a delta and
     then jump to inspection findings, so the customer was asked to approve a
     number on trust — at the one moment trust is most expensive: not at the
     shop, car on a lift, declining awkward. Each row carries its `source` so we
     render only the additions for the cycle being approved. */
  // Typed, not `(api as any)`. The cast is what hid
  // `listMidJobAdditionsForCustomer` not existing on any deployment:
  // convex/react throws straight out of useQuery, nothing caught it, and
  // the screen — then the whole app, since the root error boundary's only
  // action is a no-op on iOS — went white. Typed, the compiler catches the
  // next rename instead of the customer.
  const addedServices = useQuery(
    api.customJobs.listAddedServicesForCustomer,
    { bookingId },
  ) as
    | Array<{
        _id: string;
        name: string;
        source: "pre_job" | "mid_job";
        complaint: string | null;
        estimated_minutes: number | null;
        parts: Array<{
          part_name: string;
          oem_number: string | null;
          quantity: number;
        }>;
      }>
    | undefined;

  const handleAccept = useCallback(
    async (amountCents: number, postJob: boolean) => {
      if (busy) return;
      setAcceptedCents(amountCents);
      setPhase("processing");

      // Post-job is a final capture, not a hold — keep the existing path, which
      // records the approval and lets the server finalize + charge.
      if (postJob) {
        try {
          await applyDecision({ bookingId, decision: "approved" });
          toast.success("Estimate approved", undefined, { icon: FileCheck });
          router.back();
        } catch (err: any) {
          setPhase("review");
          Alert.alert(
            "Could not approve",
            err?.message ?? "Try again in a moment.",
          );
        }
        return;
      }

      // Pre/mid-job: approve AND place the hold on the chosen method in one
      // on-session call.
      if (!canConfirm) {
        setPhase("review");
        Alert.alert(
          "Choose a payment method",
          "Tap 'Change' to pick Apple Pay, Google Pay, or a card first.",
        );
        return;
      }
      // Keep the dispatcher from swapping in the standalone ReauthView while the
      // booking is briefly `reauth_required` mid-authorization.
      router.setParams({ inlineHold: "1" });
      try {
        const resolved = await resolvePaymentMethod();
        if (resolved === "cancelled") {
          setPhase("review");
          return;
        }
        const pi = await approveAndAuthorizeHold({
          bookingId,
          paymentMethodId: resolved.paymentMethodId,
          paymentOrigin: resolved.paymentOrigin,
        });
        if (pi.requiresAction) {
          const { error } = await handleNextAction(pi.clientSecret);
          if (error) {
            throw new Error(error.message ?? "Card authorization failed.");
          }
          // 3DS done. The `amount_capturable_updated` webhook clears the state.
        } else if (
          pi.status !== "requires_capture" &&
          pi.status !== "succeeded" &&
          pi.status !== "processing"
        ) {
          throw new Error(`Card authorization failed (status: ${pi.status}).`);
        }
        toast.success("Estimate approved", undefined, { icon: FileCheck });
        router.back();
      } catch (err: any) {
        // The estimate IS approved; only the hold failed. Hand off to the reauth
        // screen (retry / change card / cancel) rather than stranding them.
        Alert.alert(
          "Couldn't confirm the hold",
          err?.message ?? "You can try again on the next screen.",
        );
        router.setParams({ mode: "reauth" });
      }
    },
    [
      busy,
      canConfirm,
      applyDecision,
      approveAndAuthorizeHold,
      resolvePaymentMethod,
      handleNextAction,
      bookingId,
      router,
      toast,
    ],
  );

  const handleChangePaymentMethod = useCallback(() => {
    if (busy) return;
    setPickerVisible(true);
  }, [busy]);

  const handleDecline = () => {
    if (busy) return;
    // Mid-job is an *added scope* confirmation: declining reverts only the
    // extra lines (`revertDeclinedMidJobWork`) — the mechanic keeps working on
    // what was already approved and the added work is never charged. No vehicle
    // return / inspection deposit (that's the pre-job "can't proceed" case).
    const isMidJob = approval?.cycle === "mid_job";
    Alert.alert(
      isMidJob ? "Decline the added work?" : "Decline updated estimate?",
      isMidJob
        ? "Your mechanic will keep going on the work you already approved — the added work just won't be included, and you won't be charged for it."
        : "Your mechanic will be notified and your vehicle will be returned to you. A $20 deposit will be captured to cover the inspection time.",
      [
        { text: "Keep reviewing", style: "cancel" },
        {
          text: isMidJob ? "Decline added work" : "Decline",
          style: "destructive",
          onPress: async () => {
            setSubmitting("declined");
            try {
              await applyDecision({ bookingId, decision: "declined" });
              toast.info(
                isMidJob ? "Added work declined" : "Estimate declined",
                undefined,
                { icon: FileX },
              );
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

  // Accepted — confirming the hold. The open approval clears the instant it's
  // decided, so we render this from `phase` (not `approval`) and keep the
  // customer here while the hold (and any 3DS sheet) resolves. No back
  // affordance: dropping out mid-authorization is what the reauth fallback and
  // its push are for, not an accidental swipe.
  if (isProcessing) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BrandColors.secondary} />
          <Text weight="semiBold" style={styles.processingTitle}>
            Authorizing your hold…
          </Text>
          <Text style={styles.processingSub}>
            Confirming {formatUsd(acceptedCents)} with your bank. You may be
            asked to verify.
          </Text>
        </View>
      </View>
    );
  }

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
  const scopePhotos = approval.scope_photos ?? [];
  const rangeLow = approval.disclosed_range_low_cents ?? 0;
  const rangeHigh = approval.disclosed_range_high_cents ?? 0;
  const deltaCents = approval.mechanic_set_price_cents - rangeHigh;
  // Post-job is the final breakdown: the card is charged, not held. Pre/mid-job
  // raise a hold. Copy on the payment card + accept button reflects which.
  const isPostJob = approval.cycle === "post_job";
  const isWalletMethod =
    methodKind === "apple_pay" || methodKind === "google_pay";

  // Recommended-service card: only the additions the mechanic added in THIS
  // cycle (pre-job's inspection finds on the pre-job estimate, mid-job's on the
  // mid-job change) — a prior cycle's already-approved work must not resurface.
  const addedCopy = ADDED_SERVICES_COPY[approval.cycle];
  const cycleAdditions = (addedServices ?? []).filter(
    (a) => a.source === approval.cycle,
  );
  // OEM numbers actually on the quote (the parts_snapshot behind the total),
  // minus declined and customer-supplied lines. Lets the "what your mechanic
  // found" card keep only the seeded candidate per role that's really quoted.
  const quotedOemNumbers = new Set(
    breakdown.parts
      .filter((p: any) => !p?.not_used && p?.supplied_by !== "customer")
      .map((p: any) =>
        p?.oem_number ? String(p.oem_number).trim().toLowerCase() : "",
      )
      .filter((s: string) => s.length > 0),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
        <ChevronLeft size={24} color={BrandColors.primary} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          // Just clears the floating button so "Decline this update" comes to
          // rest right above it at max scroll.
          paddingBottom: 78 + insets.bottom,
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

        {addedCopy && cycleAdditions.length > 0 ? (
          <View style={styles.card}>
            <Text weight="semiBold" style={styles.sectionLabel}>
              {addedCopy.title}
            </Text>
            <Text style={styles.inspectionIntro}>{addedCopy.intro}</Text>
            {cycleAdditions.map((item, index) => (
              <View
                key={item._id}
                style={[
                  styles.addedRow,
                  index > 0 && styles.addedRowBorder,
                ]}
              >
                <Text weight="semiBold" style={styles.addedName}>
                  {item.name}
                </Text>
                {/* The mechanic's own words. This is the sentence that makes
                    the number make sense, so it sits directly under the name. */}
                {item.complaint ? (
                  <Text style={styles.addedWhy}>{item.complaint}</Text>
                ) : null}
                {/* Named parts justify a figure better than any summary line.
                    Deduped to one row per role so the seeded OEM candidates
                    (two gaskets, two oils) don't read as extra parts. */}
                {usedAndQuotedParts(item.parts, quotedOemNumbers).map((part, partIndex) => (
                  <Text
                    key={`${item._id}-${partIndex}`}
                    style={styles.addedPart}
                  >
                    {part.part_name}
                    {part.quantity > 1 ? ` ×${part.quantity}` : ""}
                    {part.oem_number ? `  ${part.oem_number}` : ""}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

      

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

          {/* Mechanic's justification photos — the visual half of "why the
              change", so they sit with the reason text and above the price
              breakdown (see why before how much). */}
          {scopePhotos.length > 0 ? (
            <View style={styles.scopePhotos}>
              <Text weight="semiBold" style={styles.scopePhotosLabel}>
                Photos from your mechanic
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scopePhotoStrip}
              >
                {scopePhotos.map((p) => (
                  <Pressable
                    key={p.storage_id}
                    onPress={() => setLightboxUrl(p.url)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel="View mechanic photo"
                  >
                    <Image
                      source={{ uri: p.url }}
                      style={styles.scopeThumb}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
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
                  {breakdown.laborHours ? ` (${breakdown.laborHours.toFixed(2)} hrs)` : ""}
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
        
  {inspectionFindings.length > 0 ? (
          <View style={styles.card}>
            <Text weight="semiBold" style={styles.sectionLabel}>
              Inspection findings
            </Text>
            <Text style={styles.inspectionIntro}>
              Measurements recorded before work began.
            </Text>
            {inspectionFindings.map((section, sectionIndex) => (
              <View
                key={section.title}
                style={[
                  styles.inspectionGroup,
                  sectionIndex > 0 && styles.inspectionGroupBorder,
                ]}
              >
                <Text weight="semiBold" style={styles.inspectionGroupTitle}>
                  {section.title}
                </Text>
                <View style={styles.inspectionGrid}>
                  {section.values.map((row) => (
                    <View key={row.label} style={styles.inspectionCell}>
                      <Text style={styles.inspectionLabel}>{row.label}</Text>
                      <Text weight="semiBold" style={styles.inspectionValue}>
                        {row.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text weight="semiBold" style={styles.sectionLabel}>
            Payment
          </Text>

          <View style={styles.payRow}>
            <Text style={styles.payRowLabel}>
              {isPostJob ? "Final total" : "New hold on your card"}
            </Text>
            <Text weight="semiBold" style={styles.payRowValue}>
              {formatUsd(approval.mechanic_set_price_cents)}
            </Text>
          </View>

          <View style={[styles.payRow, styles.payRowBorder]}>
            <View style={styles.payCardLeft}>
              {methodKind === "apple_pay" ? (
                <AppleIcon size={18} color={SemanticColors.textMuted} />
              ) : isWalletMethod ? (
                <Wallet size={18} color={SemanticColors.textMuted} />
              ) : (
                <CreditCard size={18} color={SemanticColors.textMuted} />
              )}
              <Text style={styles.payCardLabel} numberOfLines={1}>
                {methodLabel}
              </Text>
            </View>
            {!isPostJob && (
              <Pressable
                onPress={handleChangePaymentMethod}
                disabled={busy}
                hitSlop={8}
              >
                <Text weight="semiBold" style={styles.changeCardLink}>
                  Change
                </Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.infoBanner, { marginTop: Spacing.md }]}>
            <ShieldCheck
              size={18}
              color={SemanticColors.primaryBlue}
              style={{ marginTop: 1 }}
            />
            <Text style={styles.infoText}>
              {isPostJob
                ? "Your card will be charged for the completed work."
                : "This is a hold, not a charge — you’re only charged when the work is complete."}
            </Text>
          </View>
        </View>

        {/* Decline lives at the very bottom, beneath the payment card, as a
            quiet text link — accepting is the primary path, declining is the
            deliberate exception. */}
        <Pressable
          onPress={handleDecline}
          disabled={busy}
          hitSlop={8}
          style={[styles.declineLinkWrap, busy && { opacity: 0.5 }]}
        >
          <Text weight="semiBold" style={styles.declineLinkText}>
            {isDeclining ? "Declining…" : "Decline this update"}
          </Text>
        </Pressable>
      </ScrollView>

      <View
        style={[
          styles.footer,
          styles.footerStack,
          styles.footerTransparent,
          { paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <Pressable
          onPress={() =>
            handleAccept(approval.mechanic_set_price_cents, isPostJob)
          }
          disabled={busy || (!isPostJob && originLoading)}
          style={[
            styles.btn,
            styles.btnApprove,
            styles.btnFull,
            (busy || (!isPostJob && originLoading)) && { opacity: 0.7 },
          ]}
        >
          <View style={styles.btnApproveRow}>
            <Text
              weight="semiBold"
              style={styles.btnApproveLabelInline}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {isPostJob ? "Accept & pay" : "Accept & update hold"}
            </Text>
            <View style={styles.btnApproveDivider} />
            <Text
              weight="bold"
              style={styles.btnApproveAmountInline}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatUsd(approval.mechanic_set_price_cents)}
            </Text>
          </View>
        </Pressable>
      </View>

      <PaymentMethodModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        totalAmount={approval.mechanic_set_price_cents / 100}
        serviceSummary={isPostJob ? "Final payment" : "Secure hold"}
        mechanicName="OtoPair"
        applePaySupported={applePaySupported}
        googlePaySupported={googlePaySupported}
        onAddCard={() => router.push({ pathname: "/add-payment" } as any)}
      />

      {/* Full-screen scope-photo viewer. Tap the backdrop or the close button
          to dismiss. Single image — the strip is short (≤4). */}
      <Modal
        visible={lightboxUrl !== null}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setLightboxUrl(null)}
      >
        <Pressable
          style={styles.lightboxBackdrop}
          onPress={() => setLightboxUrl(null)}
        >
          {lightboxUrl ? (
            <Image
              source={{ uri: lightboxUrl }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          ) : null}
          <View style={[styles.lightboxTopBar, { top: insets.top + Spacing.md }]}>
            <Pressable
              onPress={() => setLightboxUrl(null)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close photo"
              style={styles.lightboxClose}
            >
              <X size={20} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * Itemized breakdown behind the hold amount, returned by
 * `getReauthBreakdownForBooking`. Typed locally because the vendored mobile
 * Convex client surfaces query returns as `any` (same reason the sibling
 * `booking` prop is `any`).
 */
interface ReauthBreakdownPart {
  part_name: string;
  oem_number?: string;
  brand?: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  justification_text?: string;
}
interface ReauthBreakdown {
  source: "approved" | "quote";
  cycle: string | null;
  totalCents: number;
  partsCents: number;
  laborCents: number;
  taxCents: number;
  feeCents: number;
  laborHours: number | null;
  notes: string | null;
  parts: ReauthBreakdownPart[];
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
 *   3. Cancel booking → phase-gated via `useBookingActions` (same policy as
 *      the booking card / details sheet): free/late cancels go through
 *      `api.bookings.cancelBooking` with the fee disclosed, vehicle_at_shop
 *      through `requestCancellationAtShop`, and the link is hidden entirely
 *      when the booking can't be cancelled (e.g. a completed booking being
 *      settled). No local-only Zustand cancel — that never hit the server.
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
  // Reauth uses a dedicated action (NOT createPaymentIntentForBooking):
  // the public booking action short-circuits when a PI already exists for
  // the booking and just returns it — useless here because the existing
  // PI is the stale $20 deposit. `resumeReauthFromMobile` cancels the old
  // PI and creates a fresh one at the new approved ceiling, on-session,
  // so Stripe can surface 3DS via `requires_action` for `handleNextAction`.
  const resumeReauth = useAction(api.payments_stripe.resumeReauthFromMobile);

  // Resolve the method backing the new hold the same way the merged
  // approve-and-hold screen does: an explicit pick (wallet intent / a selected
  // saved card) wins over the booking's original origin, then any saved card.
  // `resolvePaymentMethod` mints (wallet) or resolves (card) the concrete PM to
  // hand to `resumeReauth`, so picking "Use a different card" actually takes
  // effect instead of re-authorizing the original method.
  const {
    newHoldCents,
    methodKind,
    methodLabel,
    canConfirm,
    originLoading,
    applePaySupported,
    googlePaySupported,
    resolvePaymentMethod,
  } = useConfirmHold(bookingId, booking);
  // Start from the booking's own method and don't leak the wallet choice made
  // here into other flows: clear any stale intent on entry, and on exit.
  const setWalletIntent = usePaymentStore((s) => s.setWalletIntent);
  useEffect(() => {
    setWalletIntent(null);
    return () => setWalletIntent(null);
  }, [setWalletIntent]);

  // Itemized breakdown of what makes up the hold — the approved estimate
  // that set the ceiling, or the booking's original quote as fallback.
  // `undefined` = loading, `null` = no source (legacy booking).
  const breakdown: ReauthBreakdown | null | undefined = useQuery(
    api.booking_approvals.getReauthBreakdownForBooking,
    { bookingId },
  );
  const [submitting, setSubmitting] = useState(false);
  // Payment picker (Apple Pay / Google Pay / saved cards / add card).
  const [pickerVisible, setPickerVisible] = useState(false);
  const toast = useToast();
  // Phase policy — same source of truth as the booking card / details sheet.
  // Drives whether "Cancel booking" shows here and what it does. A completed
  // booking has canCancel=false, so the link is hidden — you can't cancel a job
  // that's already done; the reauth here just settles the agreed price.
  const bookingActions = useBookingActions(
    String(bookingId),
    booking?.status ?? "confirmed",
  );
  const cancelBookingMut = useMutation(api.bookings.cancelBooking);
  const requestPickupMut = useMutation(api.bookings.requestCancellationAtShop);
  const isCompleted = booking?.status === "completed";

  const isBookingLoading = booking === undefined;
  const stillReauth = booking?.payment_approval_state === "reauth_required";

  // When the hold is already confirmed there's nothing to do here — pull the
  // enriched booking so we can show the appointment recap instead of a
  // dead-end message. Skipped while an action is still pending.
  const bookingInfo = useQuery(
    api.bookings.getBookingByIdForCustomer,
    stillReauth ? "skip" : { bookingId },
  );

  const handleConfirmHold = useCallback(async () => {
    if (submitting) return;
    if (!canConfirm) {
      Alert.alert(
        "Choose a payment method",
        "Tap 'Use a different card' to pick Apple Pay, Google Pay, or a card first.",
      );
      return;
    }
    setSubmitting(true);
    try {
      // Mint (wallet) or resolve (card) the concrete PM. Wallets re-present the
      // sheet; a cancelled sheet is a soft exit, not an error.
      const resolved = await resolvePaymentMethod();
      if (resolved === "cancelled") {
        setSubmitting(false);
        return;
      }
      const pi = await resumeReauth({
        bookingId,
        paymentMethodId: resolved.paymentMethodId,
        paymentOrigin: resolved.paymentOrigin,
      });
      if (pi.requiresAction) {
        const { error } = await handleNextAction(pi.clientSecret);
        if (error) {
          throw new Error(error.message ?? "Card authorization failed.");
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
    canConfirm,
    resolvePaymentMethod,
    resumeReauth,
    bookingId,
    handleNextAction,
    router,
  ]);

  // Open the picker (saved cards + wallets + add card) rather than jumping
  // straight to add-card — so a customer with a saved method can just pick it.
  const handleUseDifferentCard = useCallback(() => {
    if (submitting) return;
    setPickerVisible(true);
  }, [submitting]);

  const handleCancelBooking = useCallback(() => {
    if (submitting || !bookingActions.canCancel) return;
    const copy = buildCancelCopy(bookingActions);

    // vehicle_at_shop: not a self-cancel — request pickup so the shop releases
    // the car. This does NOT flip status; the front desk confirms.
    if (bookingActions.cancelKind === "request_shop") {
      Alert.alert(copy.title, copy.body, [
        { text: "Not now", style: "cancel" },
        {
          text: copy.confirmLabel,
          onPress: async () => {
            try {
              await requestPickupMut({ bookingId });
              toast.info("Pickup request sent. The shop will confirm.");
            } catch (err: any) {
              Alert.alert(
                "Couldn't send request",
                err?.message ?? "Try again in a moment.",
              );
            }
            router.back();
          },
        },
      ]);
      return;
    }

    // Free or late-fee cancel — the fee (when any) is disclosed in the body and
    // confirm label before we charge. The server recomputes and rejects if the
    // fee rose past what was acknowledged.
    Alert.alert(copy.title, copy.body, [
      { text: "Keep booking", style: "cancel" },
      {
        text: copy.confirmLabel,
        style: "destructive",
        onPress: async () => {
          try {
            await cancelBookingMut({
              bookingId,
              feeAcknowledgedCents: bookingActions.feeCentsIfCancelledNow,
            });
            toast.success("Booking cancelled.", undefined, { icon: FileX });
          } catch (err: any) {
            Alert.alert(
              "Couldn't cancel",
              err?.message ?? "Try again in a moment.",
            );
          }
          router.back();
        },
      },
    ]);
  }, [
    submitting,
    bookingActions,
    bookingId,
    cancelBookingMut,
    requestPickupMut,
    toast,
    router,
  ]);

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

  // State may have cleared in flight (background webhook resolved). No action
  // is needed — rather than a dead-end message, show a calm confirmation banner
  // over the booking's details so the tap still lands somewhere useful.
  if (!stillReauth) {
    const services = bookingInfo?.serviceNames ?? [];
    const whenLabel = formatApptWhen(
      bookingInfo?.scheduledDate,
      bookingInfo?.scheduledTime,
    );
    const details: { label: string; value: string }[] = [];
    if (bookingInfo?.vehicleDisplay)
      details.push({ label: "Vehicle", value: bookingInfo.vehicleDisplay });
    if (bookingInfo?.shopName)
      details.push({ label: "Shop", value: bookingInfo.shopName });
    if (bookingInfo?.mechanicName)
      details.push({ label: "Mechanic", value: bookingInfo.mechanicName });
    if (whenLabel) details.push({ label: "When", value: whenLabel });
    if (services.length > 0)
      details.push({ label: "Services", value: services.join(", ") });
    const status = statusLabel(bookingInfo?.status);
    if (status) details.push({ label: "Status", value: status });

    return (
      <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <ChevronLeft size={24} color={BrandColors.primary} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingBottom: Spacing["2xl"] + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.confirmedBanner}>
            <CircleCheck size={20} color={SemanticColors.successGreen} />
            <Text weight="semiBold" style={styles.confirmedBannerText}>
              Your card hold is already confirmed. No action needed.
            </Text>
          </View>

          {bookingInfo === undefined ? (
            <View
              style={[
                styles.card,
                { alignItems: "center", paddingVertical: Spacing["3xl"] },
              ]}
            >
              <Text style={{ color: SemanticColors.textMuted }}>
                Loading booking…
              </Text>
            </View>
          ) : bookingInfo === null || details.length === 0 ? null : (
            <View style={styles.card}>
              <Text weight="bold" style={styles.detailsTitle}>
                Booking details
              </Text>
              {details.map((d, i) => (
                <View
                  key={d.label}
                  style={[styles.detailRow, i > 0 && styles.detailRowBorder]}
                >
                  <Text style={styles.detailLabel}>{d.label}</Text>
                  <Text style={styles.detailValue}>{d.value}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
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
          // Clears the floating accept bar so the bottom links come to rest
          // just above it at max scroll.
          paddingBottom: 96 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.iconChip, styles.iconChipBlue]}>
            <CreditCard size={24} color={BrandColors.secondary} />
          </View>
          <Text weight="bold" style={styles.h1}>
            {isCompleted ? "Confirm your final payment" : "Confirm your card hold"}
          </Text>
          <Text style={styles.subtitle}>
            {isCompleted
              ? "Your work is complete, but we couldn't finish charging your card. Confirm below to settle the final amount — you may be asked to authenticate — or use a different card."
              : methodKind === "apple_pay"
                ? "We couldn't extend the hold on your Apple Pay automatically. Confirm below to re-authorize and keep your booking moving."
                : methodKind === "google_pay"
                  ? "We couldn't extend the hold on your Google Pay automatically. Confirm below to re-authorize and keep your booking moving."
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

        {breakdown ? (
          <View style={styles.card}>
            <Text weight="semiBold" style={styles.sectionLabel}>
              What&apos;s included
            </Text>
            {breakdown.parts.map((p, idx) => (
              <View key={idx} style={styles.partRow}>
                <View style={{ flex: 1 }}>
                  <Text weight="semiBold" style={styles.partName}>
                    {p.part_name}
                  </Text>
                  {p.oem_number ? (
                    <Text style={styles.partOem}>
                      {p.brand ? `${p.brand} · ` : ""}
                      {p.oem_number}
                    </Text>
                  ) : null}
                  <Text style={styles.partOem}>
                    Qty {p.quantity} · {formatUsd(p.unit_price_cents)} ea
                  </Text>
                  {p.justification_text ? (
                    <Text style={styles.partJustification}>
                      “{p.justification_text}”
                    </Text>
                  ) : null}
                </View>
                <Text weight="semiBold" style={styles.partTotal}>
                  {formatUsd(p.line_total_cents)}
                </Text>
              </View>
            ))}

            {breakdown.notes ? (
              <View style={styles.noteBlock}>
                <Text weight="semiBold" style={styles.noteLabel}>
                  Why the change
                </Text>
                <Text style={styles.noteText}>“{breakdown.notes}”</Text>
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
                    {breakdown.laborHours
                      ? ` (${breakdown.laborHours} hrs)`
                      : ""}
                  </Text>
                  <Text style={styles.totalValue}>
                    {formatUsd(breakdown.laborCents)}
                  </Text>
                </View>
              )}
              {breakdown.taxCents + breakdown.feeCents > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tax + service fee</Text>
                  <Text style={styles.totalValue}>
                    {formatUsd(breakdown.taxCents + breakdown.feeCents)}
                  </Text>
                </View>
              )}
              <View style={[styles.totalRow, { marginTop: Spacing.sm }]}>
                <Text
                  weight="semiBold"
                  style={styles.totalLabelBold}
                  numberOfLines={1}
                >
                  {breakdown.totalCents === newHoldCents
                    ? "Total"
                    : "Estimated total"}
                </Text>
                <Text
                  weight="semiBold"
                  style={[styles.totalLabelBold, styles.totalValueRight]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {formatUsd(breakdown.totalCents)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
        {/* Which card / wallet backs the hold — reflects the resolved / picked
            method. Read-only here; changing it lives in the bottom links below,
            matching "Use a different card". */}
        <PaymentMethodBlock
          kind={methodKind === "none" ? "card" : methodKind}
          label={methodLabel}
        />

        {/* Secondary actions demoted to quiet links beneath the payment block,
            mirroring the approve-estimate "Decline this update" treatment:
            confirming is the primary path (the floating bar), these are the
            deliberate exceptions. */}
        <Pressable
          onPress={handleUseDifferentCard}
          disabled={submitting}
          hitSlop={8}
          style={[styles.declineLinkWrap, submitting && { opacity: 0.5 }]}
        >
          <Text weight="semiBold" style={styles.declineLinkText}>
            Use a different card
          </Text>
        </Pressable>

        {bookingActions.canCancel && (
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
        )}
      </ScrollView>

      {/* Floating single accept bar — "Confirm hold │ $220.43" laid out inline
          over the canvas, matching the approve-estimate accept treatment. */}
      <View
        style={[
          styles.footer,
          styles.footerStack,
          styles.footerTransparent,
          { paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <Pressable
          onPress={handleConfirmHold}
          // originLoading = the booking's origin is still resolving; !canConfirm
          // = no usable method yet. Disable so a tap can't fall through before
          // the method the hold will ride on is known.
          disabled={submitting || originLoading || !canConfirm}
          style={[
            styles.btn,
            styles.btnApprove,
            styles.btnFull,
            (submitting || originLoading || !canConfirm) && { opacity: 0.7 },
          ]}
        >
          {submitting ? (
            <Text weight="semiBold" style={styles.btnApproveLabelInline}>
              Confirming…
            </Text>
          ) : (
            <View style={styles.btnApproveRow}>
              <Text
                weight="semiBold"
                style={styles.btnApproveLabelInline}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {methodKind === "apple_pay"
                  ? "Confirm with Apple Pay"
                  : methodKind === "google_pay"
                    ? "Confirm with Google Pay"
                    : isCompleted
                      ? "Confirm payment"
                      : "Confirm hold"}
              </Text>
              <View style={styles.btnApproveDivider} />
              <Text
                weight="bold"
                style={styles.btnApproveAmountInline}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatUsd(newHoldCents)}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <PaymentMethodModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        totalAmount={newHoldCents / 100}
        serviceSummary={isCompleted ? "Final payment" : "Secure hold"}
        mechanicName="OtoPair"
        applePaySupported={applePaySupported}
        googlePaySupported={googlePaySupported}
        onAddCard={() => router.push({ pathname: "/add-payment" } as any)}
      />
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

  // ── Already-confirmed recap (no-action state) ─────────────────────────
  confirmedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: SemanticColors.successGreenLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 16,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  confirmedBannerText: {
    flex: 1,
    color: SemanticColors.successGreen,
    fontSize: 14,
    lineHeight: 19,
  },
  detailsTitle: {
    fontSize: 16,
    color: BrandColors.primary,
    marginBottom: Spacing.xs,
  },
  detailRow: { paddingVertical: Spacing.md },
  detailRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SemanticColors.border,
  },
  detailLabel: {
    color: SemanticColors.textMuted,
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  detailValue: {
    color: BrandColors.primary,
    fontSize: 15,
    lineHeight: 20,
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

  // ── Mechanic scope photos ─────────────────────────────────────────────
  scopePhotos: { marginTop: Spacing.lg },
  scopePhotosLabel: {
    fontSize: 13,
    color: SemanticColors.textMuted,
    marginBottom: Spacing.sm,
  },
  scopePhotoStrip: { gap: Spacing.sm, paddingRight: Spacing.sm },
  scopeThumb: {
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxImage: { width: "100%", height: "100%" },
  lightboxTopBar: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    alignItems: "flex-end",
  },
  lightboxClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  // ── What the mechanic added mid-job ───────────────────────────────────
  addedRow: {
    paddingTop: Spacing.md,
  },
  addedRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SemanticColors.border,
    marginTop: Spacing.md,
  },
  addedName: {
    fontSize: 15,
    color: BrandColors.primary,
  },
  addedWhy: {
    fontSize: 13,
    lineHeight: 18,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  addedPart: {
    fontSize: 12,
    color: SemanticColors.textMuted,
    marginTop: 3,
  },

  // ── Totals ────────────────────────────────────────────────────────────
  inspectionIntro: {
    color: SemanticColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -2,
  },
  inspectionGroup: {
    paddingTop: Spacing.md,
  },
  inspectionGroupBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SemanticColors.border,
    marginTop: Spacing.md,
  },
  inspectionGroupTitle: {
    color: BrandColors.primary,
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  inspectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    rowGap: Spacing.sm,
  },
  inspectionCell: {
    width: "50%",
    paddingHorizontal: 4,
  },
  inspectionLabel: {
    color: SemanticColors.textMuted,
    fontSize: 12,
  },
  inspectionValue: {
    color: BrandColors.primary,
    fontSize: 15,
    marginTop: 2,
  },
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

  // ── Payment (merged hold) ─────────────────────────────────────────────
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  payRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SemanticColors.border,
    marginTop: Spacing.xs,
  },
  payRowLabel: { color: SemanticColors.textSecondary, fontSize: 14 },
  payRowValue: { color: BrandColors.primary, fontSize: 15 },
  payCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: Spacing.md,
  },
  payCardLabel: { color: BrandColors.primary, fontSize: 14, flexShrink: 1 },
  changeCardLink: { color: SemanticColors.primaryBlue, fontSize: 14 },

  // ── Authorizing (accept in flight) ────────────────────────────────────
  processingTitle: {
    fontSize: 18,
    color: BrandColors.primary,
    marginTop: Spacing.lg,
    letterSpacing: -0.2,
  },
  processingSub: {
    fontSize: 14,
    lineHeight: 20,
    color: SemanticColors.textMuted,
    textAlign: "center",
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
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
  // ApprovalDecisionView floats a single button over the canvas — no white bar
  // or divider behind it (matches the Review & Pay accept treatment).
  footerTransparent: {
    backgroundColor: "transparent",
    borderTopWidth: 0,
  },
  btn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  btnApprove: { backgroundColor: BrandColors.secondary, flex: 1.5 },
  btnApproveText: { color: "#FFFFFF", fontSize: 16 },
  // Single-bar accept: "Accept & update hold │ $495.74" laid out inline with a
  // hairline divider between label and price (Review & Pay grammar).
  btnApproveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  btnApproveDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: 2,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  btnApproveLabelInline: { color: "#FFFFFF", fontSize: 16, flexShrink: 1 },
  btnApproveAmountInline: { color: "#FFFFFF", fontSize: 16 },
  // Decline demoted to a quiet blue link at the foot of the scroll content.
  declineLinkWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  declineLinkText: {
    color: SemanticColors.primaryBlue,
    fontSize: 15,
    textDecorationLine: "underline",
  },
  // ── Reauth footer additions ───────────────────────────────────────────
  footerStack: { flexDirection: "column", gap: Spacing.sm },
  btnFull: { width: "100%", flex: 0 },
  tertiaryLinkWrap: {
    paddingVertical: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  tertiaryLinkText: { color: SemanticColors.textMuted, fontSize: 14 },
});
