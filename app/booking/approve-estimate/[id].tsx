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

import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, AlertCircle } from "lucide-react-native";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Text } from "@/components/shared-ui";
import { BrandColors, SemanticColors, Spacing } from "@/constants/theme";
import { useOpenApprovalForBooking } from "@/hooks/useOpenApprovalForBooking";

function formatUsd(cents: number | undefined | null): string {
  const v = ((cents ?? 0) / 100).toFixed(2);
  return `$${v}`;
}

const HEADER_BY_CYCLE: Record<string, string> = {
  pre_job: "YOUR CAR REQUIRES MORE THAN WE EXPECTED",
  mid_job: "UPDATE FROM YOUR MECHANIC",
  post_job: "FINAL BREAKDOWN — PLEASE CONFIRM",
};

export default function ApproveEstimateScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const bookingId = params.id as Id<"bookings">;
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
  const rangeLow = approval.disclosed_range_low_cents ?? 0;
  const rangeHigh = approval.disclosed_range_high_cents ?? 0;

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + Spacing.lg,
        },
      ]}
    >
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <ChevronLeft size={24} color={BrandColors.primary} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.xl,
          paddingBottom: 140 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>{header}</Text>

        {rangeHigh > 0 && (
          <View style={{ marginTop: Spacing.xl }}>
            <Text style={styles.muted}>Your original estimate</Text>
            <Text style={styles.bodyBold}>
              {formatUsd(rangeLow)} – {formatUsd(rangeHigh)}
            </Text>
          </View>
        )}

        <View style={{ marginTop: Spacing.xl }}>
          <Text style={styles.muted}>Your mechanic's updated total</Text>
          <Text
            style={styles.h3}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatUsd(approval.mechanic_set_price_cents)}
          </Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>What changed</Text>
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

        {/* <View style={styles.divider} /> */}

        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Parts</Text>
            <Text style={styles.totalValue}>{formatUsd(breakdown.partsCents)}</Text>
          </View>
          {breakdown.laborCents > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Labor{breakdown.laborHours ? ` (${breakdown.laborHours} hrs)` : ""}
              </Text>
              <Text style={styles.totalValue}>{formatUsd(breakdown.laborCents)}</Text>
            </View>
          )}
          {breakdown.remainder > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax + service fee</Text>
              <Text style={styles.totalValue}>{formatUsd(breakdown.remainder)}</Text>
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

        <View style={styles.infoBanner}>
          <AlertCircle size={18} color={SemanticColors.primaryBlueDark} />
          <Text style={styles.infoText}>
            This will raise the hold on your card to{" "}
            {formatUsd(approval.mechanic_set_price_cents)}. You're only charged
            when work is complete.
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  backLabel: { color: BrandColors.primary, marginLeft: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  h1: {
    fontSize: 22,
    color: BrandColors.primary,
    fontWeight: "700",
    marginTop: Spacing.sm,
    letterSpacing: 0.3,
  },
  h3: {
    fontSize: 32,
    lineHeight: 42,
    color: BrandColors.primary,
    fontWeight: "700",
    marginTop: Spacing.xs,
    paddingTop: 4,
    includeFontPadding: true,
  },
  muted: { color: SemanticColors.textMuted, fontSize: 13 },
  bodyBold: {
    fontSize: 16,
    color: BrandColors.primary,
    fontWeight: "600",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: SemanticColors.border,
    marginVertical: Spacing.xl,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: BrandColors.primary,
    marginBottom: Spacing.md,
  },
  partRow: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
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
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: SemanticColors.primaryBlueLight,
    padding: Spacing.md,
    borderRadius: 10,
    marginTop: Spacing.xl,
  },
  infoText: { flex: 1, color: SemanticColors.primaryBlueDark, fontSize: 13 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDecline: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  btnDeclineText: { color: BrandColors.primary, fontSize: 16 },
  btnApprove: { backgroundColor: BrandColors.primary, flex: 1.4 },
  btnApproveText: { color: "#FFFFFF", fontSize: 16 },
  btnApproveStack: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: Spacing.sm,
  },
  btnApproveLabel: { color: "#FFFFFF", fontSize: 12, opacity: 0.85 },
  btnApproveAmount: { color: "#FFFFFF", fontSize: 18 },
});
