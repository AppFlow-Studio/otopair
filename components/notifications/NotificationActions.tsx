/**
 * NotificationActions — inline decision buttons for actionable notifications.
 *
 * Renders the row's decision directly on the card so the user acts without
 * leaving the sheet. Covers the two decision families that resolve with just a
 * bookingId:
 *   - reschedule_decision → Accept / Decline (a forced-delay can't be declined,
 *     so it offers "More options" instead, which opens the full overlay).
 *   - estimate_decision   → Approve / Decline the out-of-range work.
 *
 * On success we call onResolve() to drop the card immediately; the booking
 * state change also auto-resolves it server-side, so the extra call is
 * idempotent insurance.
 */

import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useMutation } from "convex/react";

import { Text } from "@/components/shared-ui";
import { api } from "@/convex/_generated/api";
import { BorderRadius, BrandColors, Spacing } from "@/constants/theme";
import type { NotificationRow } from "@/hooks/useNotificationsFromConvex";
import type { NotificationAction } from "./notificationShapes";

interface Props {
  row: NotificationRow;
  action: NotificationAction;
  /** Archive the card once the decision succeeds. */
  onResolve: () => void;
  /** Open the full reschedule overlay (forced-delay "More options"). */
  onOpenOverlay: () => void;
}

export function NotificationActions({
  row,
  action,
  onResolve,
  onOpenOverlay,
}: Props) {
  const approveReschedule = useMutation(api.bookings.customerApproveReschedule);
  const declineReschedule = useMutation(api.bookings.customerDeclineReschedule);
  const applyApproval = useMutation(api.booking_approvals.applyApprovalDecision);
  const acknowledgeLate = useMutation(api.bookings.acknowledgeCustomerLate);

  const [pending, setPending] = useState<null | "primary" | "secondary">(null);
  const [error, setError] = useState<string | null>(null);

  const bookingId = row.booking_id;
  if (!bookingId) return null;

  const run = async (slot: "primary" | "secondary", fn: () => Promise<any>) => {
    if (pending) return;
    setPending(slot);
    setError(null);
    try {
      await fn();
      onResolve();
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
      setPending(null);
    }
  };

  const isForcedDelay = row.category === "booking_forced_delay_proposed";

  let primaryLabel: string;
  let onPrimary: () => void;
  let secondaryLabel: string;
  let onSecondary: () => void;
  let secondaryIsBusy = true; // does the secondary button run a mutation (show spinner)?

  if (action === "reschedule_decision") {
    primaryLabel = "Accept";
    onPrimary = () => run("primary", () => approveReschedule({ bookingId }));
    if (isForcedDelay) {
      secondaryLabel = "More options";
      onSecondary = onOpenOverlay;
      secondaryIsBusy = false;
    } else {
      secondaryLabel = "Decline";
      onSecondary = () => run("secondary", () => declineReschedule({ bookingId }));
    }
  } else if (action === "on_my_way") {
    // Shop is waiting on a late customer. "On my way" acknowledges — the
    // server also resolves the card, and onResolve() drops it locally.
    // "Reschedule" hands off to the parent (opens the bookings reschedule flow).
    primaryLabel = "On my way";
    onPrimary = () => run("primary", () => acknowledgeLate({ bookingId }));
    secondaryLabel = "Reschedule";
    onSecondary = onOpenOverlay;
    secondaryIsBusy = false;
  } else {
    // estimate_decision
    primaryLabel = "Approve";
    onPrimary = () =>
      run("primary", () => applyApproval({ bookingId, decision: "approved" }));
    secondaryLabel = "Decline";
    onSecondary = () =>
      run("secondary", () => applyApproval({ bookingId, decision: "declined" }));
  }

  const busy = pending != null;

  return (
    <View style={styles.wrap}>
      <View style={styles.buttonRow}>
        <Pressable
          onPress={onPrimary}
          disabled={busy}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            pressed && styles.pressed,
            busy && styles.dim,
          ]}
        >
          {pending === "primary" ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text size="sm" weight="bold" color="#FFFFFF">
              {primaryLabel}
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={onSecondary}
          disabled={busy}
          style={({ pressed }) => [
            styles.btn,
            styles.btnSecondary,
            pressed && styles.pressed,
            busy && styles.dim,
          ]}
        >
          {secondaryIsBusy && pending === "secondary" ? (
            <ActivityIndicator size="small" color={BrandColors.primary} />
          ) : (
            <Text size="sm" weight="semiBold" color={BrandColors.primary}>
              {secondaryLabel}
            </Text>
          )}
        </Pressable>
      </View>
      {error ? (
        <Text size="xs" color="#DC2626" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  btn: {
    flex: 1,
    height: 38,
    borderRadius: BorderRadius.md ?? 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: {
    backgroundColor: BrandColors.primary,
  },
  btnSecondary: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  pressed: {
    opacity: 0.7,
  },
  dim: {
    opacity: 0.5,
  },
  error: {
    marginTop: 2,
  },
});

export default NotificationActions;
