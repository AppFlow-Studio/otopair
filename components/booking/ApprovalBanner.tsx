/**
 * ApprovalBanner — surfaces above booking detail when the mechanic has
 * submitted an out-of-range estimate and is waiting on the customer's
 * decision. Visual modeled on CustomerLateBanner (amber bg + border).
 *
 * Only renders when `payment_approval_state ∈ { pre_job_pending,
 * mid_job_pending, post_job_pending }`. Tap → routes to the full-screen
 * approve-estimate screen.
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
]);

const TITLE_BY_STATE: Record<string, string> = {
  pre_job_pending: "Your car requires more than we expected",
  mid_job_pending: "Update from your mechanic",
  post_job_pending: "Final breakdown — please confirm",
};

const BODY_BY_STATE: Record<string, string> = {
  pre_job_pending: "Tap to review your mechanic's updated estimate.",
  mid_job_pending: "Tap to review the additional scope your mechanic found.",
  post_job_pending: "Tap to review the final total before charge.",
};

export function ApprovalBanner({ bookingId, paymentApprovalState }: Props) {
  const router = useRouter();
  if (!paymentApprovalState || !PENDING_STATES.has(paymentApprovalState)) {
    return null;
  }
  const title = TITLE_BY_STATE[paymentApprovalState] ?? "Approval needed";
  const body = BODY_BY_STATE[paymentApprovalState] ?? "Tap to review.";
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/booking/approve-estimate/[id]",
          params: { id: String(bookingId) },
        } as any)
      }
      style={styles.banner}
    >
      <AlertTriangle size={20} color="#92400e" style={{ marginTop: 2 }} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text weight="semiBold" style={{ color: "#78350f", fontSize: 14 }}>
          {title}
        </Text>
        <Text style={{ color: "#92400e", fontSize: 13, marginTop: 2 }}>
          {body}
        </Text>
      </View>
      <Text weight="semiBold" style={{ color: "#92400e", fontSize: 13 }}>
        Review →
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fffbeb",
    borderColor: "#fcd34d",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
});
