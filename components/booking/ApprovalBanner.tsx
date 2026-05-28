/**
 * ApprovalBanner — surfaces above booking detail when the mechanic has
 * submitted an out-of-range estimate and is waiting on the customer's
 * decision, OR when Stripe rejected the auth-increment and we need the
 * customer to confirm the new hold (`reauth_required`).
 *
 * Renders for `payment_approval_state ∈ { pre_job_pending, mid_job_pending,
 * post_job_pending, reauth_required }`. Tap → routes to the approve-estimate
 * screen; for reauth, passes `mode=reauth` so the screen branches to the
 * reauth view.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle } from "lucide-react-native";
import { Text } from "@/components/shared-ui";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  bookingId: Id<"bookings"> | string;
  paymentApprovalState: string | undefined;
};

const PENDING_STATES = new Set([
  "pre_job_pending",
  "mid_job_pending",
  "post_job_pending",
  "reauth_required",
]);

const TITLE_BY_STATE: Record<string, string> = {
  pre_job_pending: "Your car requires more than we expected",
  mid_job_pending: "Update from your mechanic",
  post_job_pending: "Final breakdown — please confirm",
  reauth_required: "Confirm new hold on your card",
};

const BODY_BY_STATE: Record<string, string> = {
  pre_job_pending: "Tap to review your mechanic's updated estimate.",
  mid_job_pending: "Tap to review the additional scope your mechanic found.",
  post_job_pending: "Tap to review the final total before charge.",
  reauth_required:
    "Your card needs to confirm the updated hold before work can start.",
};

// Reauth uses a red palette to signal that the booking is blocked until
// the customer acts; the amber palette stays for the approval-pending
// states (work continues to be schedulable in the meantime).
const REAUTH_COLORS = {
  bg: "#fef2f2",
  border: "#fca5a5",
  icon: "#b91c1c",
  title: "#7f1d1d",
  body: "#b91c1c",
} as const;

const APPROVAL_COLORS = {
  bg: "#fffbeb",
  border: "#fcd34d",
  icon: "#92400e",
  title: "#78350f",
  body: "#92400e",
} as const;

export function ApprovalBanner({ bookingId, paymentApprovalState }: Props) {
  const router = useRouter();
  if (!paymentApprovalState || !PENDING_STATES.has(paymentApprovalState)) {
    return null;
  }
  const isReauth = paymentApprovalState === "reauth_required";
  const palette = isReauth ? REAUTH_COLORS : APPROVAL_COLORS;
  const title = TITLE_BY_STATE[paymentApprovalState] ?? "Approval needed";
  const body = BODY_BY_STATE[paymentApprovalState] ?? "Tap to review.";
  const cta = isReauth ? "Confirm →" : "Review →";
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/booking/approve-estimate/[id]",
          params: isReauth
            ? { id: String(bookingId), mode: "reauth" }
            : { id: String(bookingId) },
        } as any)
      }
      style={[
        styles.banner,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      <AlertTriangle size={20} color={palette.icon} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text weight="semiBold" style={{ color: palette.title, fontSize: 14 }}>
          {title}
        </Text>
        <Text style={{ color: palette.body, fontSize: 13, marginTop: 2 }}>
          {body}
        </Text>
      </View>
      <Text weight="semiBold" style={{ color: palette.body, fontSize: 13 }}>
        {cta}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
});
