/**
 * PaymentBreakdown — Pre-Job Approval receipt UI. Renders on the post-
 * completion booking detail (BookingDetailsSheet, Payment section).
 *
 * Three-row "lifecycle" header tells the customer what happened to their
 * hold at each stage: $20 placed at booking, raised to mechanic's confirmed
 * estimate, captured at the final amount. Below that, an itemized parts
 * list from `final_parts_used_at_capture` (snapshotted at capture time so
 * later edits don't mutate the receipt). A "Dispute" CTA renders only
 * within the 14-day window — beyond that, the booking is settled.
 */

import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "convex/react";
import { Flag } from "lucide-react-native";
import { Text } from "@/components/shared-ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const DISPUTE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type PaymentBreakdownPart = {
  part_name?: string;
  brand?: string | null;
  oem_number?: string;
  cost?: number;
  quantity?: number;
  not_used?: boolean;
  supplied_by?: string;
  verified_against_catalog_median_cents?: number;
};

type Props = {
  bookingId: Id<"bookings"> | string;
  paymentApprovalState: string | null | undefined;
  holdAmountCents: number | null | undefined;
  mechanicSetPriceCents: number | null | undefined;
  finalCaptureAmountCents: number | null | undefined;
  finalPartsUsedAtCapture: PaymentBreakdownPart[] | null | undefined;
  capturedAtMs: number | null | undefined;
  onFileDispute?: () => void;
};

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export function PaymentBreakdown({
  bookingId,
  paymentApprovalState,
  holdAmountCents,
  mechanicSetPriceCents,
  finalCaptureAmountCents,
  finalPartsUsedAtCapture,
  capturedAtMs,
  onFileDispute,
}: Props) {
  const isCaptured = paymentApprovalState === "captured";

  // Dispute state — present means the customer already filed. Skip query
  // until the booking is captured to avoid unnecessary reads on live
  // bookings.
  const dispute = useQuery(
    api.booking_disputes.getDisputeForBooking,
    isCaptured ? { bookingId: bookingId as Id<"bookings"> } : "skip",
  );

  const withinDisputeWindow = useMemo(() => {
    if (!isCaptured || capturedAtMs == null) return false;
    return Date.now() - capturedAtMs < DISPUTE_WINDOW_MS;
  }, [isCaptured, capturedAtMs]);

  const parts = (finalPartsUsedAtCapture ?? []).filter(
    (p) => !p.not_used && p.supplied_by !== "customer",
  );

  return (
    <View>
      {/* Lifecycle rows — "what happened to your hold" */}
      <View style={styles.lifecycleCard}>
        <LifecycleRow
          label="Hold placed at booking"
          value={formatCents(holdAmountCents ?? 2000)}
          subdued
        />
        <LifecycleRow
          label="Estimate confirmed"
          value={formatCents(mechanicSetPriceCents)}
          subdued={!isCaptured}
        />
        <LifecycleRow
          label="Final charged"
          value={formatCents(finalCaptureAmountCents)}
          emphasized={isCaptured}
          isLast
        />
      </View>

      {/* Itemized parts — only after capture; the list is meaningless
          before the final invoice is locked. */}
      {isCaptured && parts.length > 0 ? (
        <View style={styles.partsCard}>
          <Text size="xs" weight="bold" color="#8E8E93" style={styles.partsHeader}>
            PARTS USED
          </Text>
          {parts.map((p, idx) => (
            <PartRow key={`${p.oem_number ?? "part"}-${idx}`} part={p} />
          ))}
        </View>
      ) : null}

      {/* Dispute section — gate by window + existing dispute state. */}
      {isCaptured ? (
        dispute ? (
          <View style={styles.disputeStatus}>
            <Text size="sm" weight="semiBold" color="#1A1A1A">
              {disputeStatusLabel(dispute.status)}
            </Text>
            <Text size="xs" weight="regular" color="#6B7280" style={{ marginTop: 4 }}>
              Filed {formatRelative(dispute.filed_at_ms)}
              {dispute.resolved_at_ms
                ? ` · Resolved ${formatRelative(dispute.resolved_at_ms)}`
                : ""}
            </Text>
          </View>
        ) : withinDisputeWindow ? (
          <Pressable
            onPress={onFileDispute}
            style={styles.disputeButton}
            accessibilityRole="button"
          >
            <Flag size={16} color="#92400e" />
            <Text size="sm" weight="semiBold" color="#92400e" style={{ marginLeft: 8 }}>
              Something wrong with this charge?
            </Text>
          </Pressable>
        ) : null
      ) : null}
    </View>
  );
}

function LifecycleRow({
  label,
  value,
  subdued,
  emphasized,
  isLast,
}: {
  label: string;
  value: string;
  subdued?: boolean;
  emphasized?: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.lifecycleRow, isLast && styles.lifecycleRowLast]}>
      <Text
        size="sm"
        weight="regular"
        color={subdued ? "#8E8E93" : "#1A1A1A"}
      >
        {label}
      </Text>
      <Text
        size={emphasized ? "md" : "sm"}
        weight={emphasized ? "bold" : "semiBold"}
        color={subdued ? "#8E8E93" : "#1A1A1A"}
      >
        {value}
      </Text>
    </View>
  );
}

function PartRow({ part }: { part: PaymentBreakdownPart }) {
  const qty = Math.max(1, part.quantity ?? 1);
  const unitCents = Math.round((part.cost ?? 0) * 100);
  const lineCents = unitCents * qty;
  // Catalog-median check: green when the unit cost is at-or-below median,
  // no badge otherwise (red would feel accusatory on a settled receipt).
  const median = part.verified_against_catalog_median_cents;
  const atOrBelowMedian = median != null && unitCents <= median;

  return (
    <View style={styles.partRow}>
      <View style={styles.partLeft}>
        <Text size="sm" weight="semiBold" color="#1A1A1A">
          {part.part_name ?? "Part"}
        </Text>
        {part.oem_number ? (
          <Text size="xs" weight="regular" color="#8E8E93">
            {part.brand ? `${part.brand} · ` : ""}{part.oem_number}
          </Text>
        ) : null}
        <View style={styles.partMetaRow}>
          <Text size="xs" weight="regular" color="#6B7280">
            Qty {qty} · {formatCents(unitCents)} ea
          </Text>
          {atOrBelowMedian ? (
            <Text size="xs" weight="semiBold" color="#10B981" style={styles.medianBadge}>
              ✓ at market
            </Text>
          ) : null}
        </View>
      </View>
      <Text size="sm" weight="semiBold" color="#1A1A1A">
        {formatCents(lineCents)}
      </Text>
    </View>
  );
}

function disputeStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Dispute filed — under review";
    case "in_review":
      return "Dispute under review by Otopair";
    case "resolved_refund":
      return "Dispute resolved — refund issued";
    case "resolved_no_refund":
      return "Dispute resolved — no refund";
    case "withdrawn":
      return "Dispute withdrawn";
    default:
      return "Dispute status updated";
  }
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString();
}

const styles = StyleSheet.create({
  lifecycleCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  lifecycleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  lifecycleRowLast: {
    borderBottomWidth: 0,
  },
  partsCard: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  partsHeader: {
    marginBottom: 6,
  },
  partRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  partLeft: {
    flex: 1,
    paddingRight: 12,
  },
  partMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  medianBadge: {
    marginLeft: 8,
  },
  disputeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fffbeb",
    borderColor: "#fcd34d",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  disputeStatus: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
});
