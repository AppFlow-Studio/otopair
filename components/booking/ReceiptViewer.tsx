/**
 * ReceiptViewer
 *
 * Renders the invoice breakdown card + "View Receipt PDF" button in the
 * Payment section of BookingDetailsSheet for captured (or refunded)
 * bookings. Pairs with the server-generated PDF that Resend already mailed
 * to the customer the moment Stripe captured — opening the PDF here gives
 * mobile parity with whatever lives in their inbox.
 *
 * USED IN: components/bookings/BookingDetailsSheet.tsx (Payment section).
 */

import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { FileText } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  bookingId: Id<"bookings"> | string;
};

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const sign = cents < 0 ? "−" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function formatLabor(minutes: number): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatEmailedAt(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ReceiptViewer({ bookingId }: Props) {
  const receipt = useQuery(api.invoices.getReceiptForBooking, {
    bookingId: bookingId as Id<"bookings">,
  });
  const requestGeneration = useMutation(api.invoices.requestInvoiceGeneration);

  const handleOpen = useCallback(async () => {
    if (!receipt) return;
    if (!receipt.url) {
      // Auto-trigger generation if the webhook missed it. The mutation is
      // idempotent on the server (no-op if the storage id already exists).
      try {
        await requestGeneration({
          bookingId: bookingId as Id<"bookings">,
        });
        Alert.alert(
          "Generating receipt",
          "Your invoice PDF is being prepared. Try again in a few seconds.",
        );
      } catch {
        Alert.alert(
          "Receipt not ready",
          "We couldn't generate your receipt right now. Please try again later.",
        );
      }
      return;
    }
    await WebBrowser.openBrowserAsync(receipt.url);
  }, [receipt, requestGeneration, bookingId]);

  // Skip render until the query resolves. `null` means the booking isn't
  // captured yet — fall through silently; the existing PaymentBreakdown
  // already handles the pre-capture states.
  if (receipt === undefined) {
    return (
      <View style={styles.skeleton}>
        <ActivityIndicator size="small" color="#9CA3AF" />
      </View>
    );
  }
  if (receipt === null) return null;

  const { invoiceNumber, status, breakdown, emailedAtMs, url } = receipt;
  const isRefunded = status === "refunded";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text size="xs" weight="bold" color="#8E8E93" style={styles.headerLabel}>
            INVOICE
          </Text>
          <Text size="md" weight="semiBold" color="#1A1A1A">
            {invoiceNumber ?? "Pending"}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            isRefunded ? styles.statusPillRefunded : styles.statusPillPaid,
          ]}
        >
          <Text
            size="xs"
            weight="bold"
            color={isRefunded ? "#92400e" : "#166534"}
          >
            {isRefunded ? "REFUNDED" : "PAID"}
          </Text>
        </View>
      </View>

      <View style={styles.breakdown}>
        <BreakdownRow
          label={`Parts (${breakdown.parts.length})`}
          value={formatCents(breakdown.partsTotalCents)}
        />
        <BreakdownRow
          label={`Labor · ${formatLabor(breakdown.laborMinutes)}`}
          value={formatCents(breakdown.laborCents)}
        />
        <BreakdownRow
          label="Subtotal"
          value={formatCents(breakdown.subtotalCents)}
          subdued
        />
        {breakdown.taxCents > 0 ? (
          <BreakdownRow
            label="Tax"
            value={formatCents(breakdown.taxCents)}
            subdued
          />
        ) : null}
        {breakdown.platformFeeCents > 0 ? (
          <BreakdownRow
            label="Service fee"
            value={formatCents(breakdown.platformFeeCents)}
            subdued
          />
        ) : null}
        <View style={styles.divider} />
        <BreakdownRow
          label="Total charged"
          value={formatCents(breakdown.totalCents)}
          emphasized
        />
        {isRefunded && breakdown.refundedCents > 0 ? (
          <BreakdownRow
            label="Refunded"
            value={`−${formatCents(breakdown.refundedCents)}`}
            refunded
          />
        ) : null}
      </View>

      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.pdfButton,
          pressed && styles.pdfButtonPressed,
          !url && styles.pdfButtonDisabled,
        ]}
        accessibilityRole="button"
      >
        <FileText size={18} color="#FFFFFF" />
        <Text size="md" weight="semiBold" color="#FFFFFF" style={styles.pdfButtonLabel}>
          {url ? "View Receipt PDF" : "Generate Receipt PDF"}
        </Text>
      </Pressable>
      {emailedAtMs ? (
        <Text size="xs" weight="regular" color="#8E8E93" style={styles.emailedCaption}>
          Emailed to you on {formatEmailedAt(emailedAtMs)}
        </Text>
      ) : null}
    </View>
  );
}

function BreakdownRow({
  label,
  value,
  subdued,
  emphasized,
  refunded,
}: {
  label: string;
  value: string;
  subdued?: boolean;
  emphasized?: boolean;
  refunded?: boolean;
}) {
  const labelColor = refunded
    ? "#92400e"
    : subdued
      ? "#6B7280"
      : "#1A1A1A";
  const valueColor = refunded ? "#92400e" : "#1A1A1A";
  return (
    <View style={styles.row}>
      <Text
        size={emphasized ? "md" : "sm"}
        weight={emphasized || refunded ? "semiBold" : "regular"}
        color={labelColor}
      >
        {label}
      </Text>
      <Text
        size={emphasized ? "md" : "sm"}
        weight={emphasized || refunded ? "bold" : "semiBold"}
        color={valueColor}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  skeleton: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    gap: 2,
  },
  headerLabel: {
    letterSpacing: 0.6,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillPaid: {
    backgroundColor: "#dcfce7",
  },
  statusPillRefunded: {
    backgroundColor: "#fef3c7",
  },
  breakdown: {
    gap: 0,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },
  pdfButton: {
    marginTop: 14,
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  pdfButtonPressed: {
    opacity: 0.9,
  },
  pdfButtonDisabled: {
    backgroundColor: "#6B7280",
  },
  pdfButtonLabel: {
    marginLeft: 8,
  },
  emailedCaption: {
    marginTop: 8,
    textAlign: "center",
  },
});
