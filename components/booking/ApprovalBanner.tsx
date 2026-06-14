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
import { ChevronRight, CreditCard, Wrench } from "lucide-react-native";
import { Text } from "@/components/shared-ui";
import {
  BrandColors,
  SemanticColors,
  SurfaceColors,
  CardShadow,
} from "@/constants/theme";
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

// The accent only tints the icon chip + a thin leading rail — the card
// itself stays clean white so it sits seamlessly with the rest of the
// booking detail. Reauth leans on the brand blue (it's a payment confirm,
// not an error); approval-pending uses a warm amber.
const REAUTH_ACCENT = BrandColors.secondary; // #5299FE
const APPROVAL_ACCENT = SemanticColors.warningAmber; // #D97706

export function ApprovalBanner({ bookingId, paymentApprovalState }: Props) {
  const router = useRouter();
  if (!paymentApprovalState || !PENDING_STATES.has(paymentApprovalState)) {
    return null;
  }
  const isReauth = paymentApprovalState === "reauth_required";
  const accent = isReauth ? REAUTH_ACCENT : APPROVAL_ACCENT;
  const Icon = isReauth ? CreditCard : Wrench;
  const title = TITLE_BY_STATE[paymentApprovalState] ?? "Approval needed";
  const body = BODY_BY_STATE[paymentApprovalState] ?? "Tap to review.";
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
      style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
    >
      <View style={[styles.rail, { backgroundColor: accent }]} />
      <View style={[styles.iconChip, { backgroundColor: `${accent}1F` }]}>
        <Icon size={20} color={accent} />
      </View>
      <View style={styles.copy}>
        <Text weight="semiBold" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <ChevronRight size={20} color={SemanticColors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SurfaceColors.cardSurface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 14,
    marginBottom: 12,
    overflow: "hidden",
    boxShadow: CardShadow.default,
  },
  bannerPressed: { opacity: 0.9 },
  rail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  copy: { flex: 1, marginRight: 8 },
  title: { color: BrandColors.primary, fontSize: 14 },
  body: { color: SemanticColors.textMuted, fontSize: 13, marginTop: 2 },
});
