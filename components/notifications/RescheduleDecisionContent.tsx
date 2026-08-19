/**
 * RescheduleDecisionContent
 *
 * Body of the Pending Customer Acceptance overlay. Renders the
 * before/after schedule comparison and the Accept / Decline actions.
 *
 * Hides the Decline button when `scheduleChangeMode === "forced_delay"`
 * because the backend rejects decline in that mode (the original slot
 * is no longer available).
 */

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useMutation, useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, MapPin, User as UserIcon, Wrench } from "lucide-react-native";

import { Button, GhostButton, Text } from "@/components/shared-ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BrandColors, BorderRadius, Spacing } from "@/constants/theme";

interface Props {
  bookingId: Id<"bookings">;
  onClose: () => void;
}

function formatDateLabel(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

function formatTimeLabel(hhmm?: string | null): string {
  if (!hhmm) return "—";
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function RescheduleDecisionContent({ bookingId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const booking = useQuery(api.bookings.getBookingByIdForCustomer, { bookingId });
  const approveMutation = useMutation(api.bookings.customerApproveReschedule);
  const declineMutation = useMutation(api.bookings.customerDeclineReschedule);

  const [submitting, setSubmitting] = useState<"accept" | "decline" | null>(
    null,
  );

  const isForcedDelay = booking?.scheduleChangeMode === "forced_delay";

  const headline = useMemo(() => {
    if (!booking) return "Reschedule requested";
    return isForcedDelay
      ? "Your booking is running behind"
      : "Reschedule requested";
  }, [booking, isForcedDelay]);

  const reasonCopy = useMemo(() => {
    if (!booking) return "";
    if (isForcedDelay) {
      return "Your mechanic is running behind on the job before yours. The shop has proposed a new time — the original slot is no longer available.";
    }
    return `${booking.shopName ?? "The shop"} has proposed a new time for your booking. Review the change and let them know if it works.`;
  }, [booking, isForcedDelay]);

  if (booking === undefined) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={BrandColors.primary} />
      </View>
    );
  }

  if (booking === null) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { paddingTop: insets.top + 80, paddingHorizontal: Spacing["2xl"] },
        ]}
      >
        <Text size="xl" weight="semiBold" color={BrandColors.primary}>
          This change is no longer available
        </Text>
        <Text size="md" color={BrandColors.primary} style={styles.center}>
          The booking may have been updated or cancelled.
        </Text>
        <Button onPress={onClose} variant="primary" size="lg">
          Close
        </Button>
      </View>
    );
  }

  // The proposal was already decided (accepted / declined / withdrawn / the
  // 24h offer lapsed) and the booking has moved on. Reachable when the customer
  // taps a stale push from the tray — show a resolved state instead of an
  // Accept/Decline that would only error.
  if (booking.status !== "pending_customer_acceptance") {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { paddingTop: insets.top + 80, paddingHorizontal: Spacing["2xl"] },
        ]}
      >
        <Text size="xl" weight="semiBold" color={BrandColors.primary}>
          This was already handled
        </Text>
        <Text size="md" color={BrandColors.primary} style={styles.center}>
          The reschedule has been resolved — your booking is set for{" "}
          {formatDateLabel(booking.scheduledDate)} at{" "}
          {formatTimeLabel(booking.scheduledTime)}.
        </Text>
        <Button onPress={onClose} variant="primary" size="lg">
          Close
        </Button>
      </View>
    );
  }

  const handleAccept = async () => {
    try {
      setSubmitting("accept");
      await approveMutation({ bookingId });
      onClose();
    } catch (err: any) {
      Alert.alert(
        "Couldn't accept",
        err?.message ?? "Please try again in a moment.",
      );
    } finally {
      setSubmitting(null);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      "Decline new time?",
      "Your booking will return to its original time.",
      [
        { text: "Keep new time", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            try {
              setSubmitting("decline");
              await declineMutation({ bookingId });
              onClose();
            } catch (err: any) {
              Alert.alert(
                "Couldn't decline",
                err?.message ?? "Please try again in a moment.",
              );
            } finally {
              setSubmitting(null);
            }
          },
        },
      ],
    );
  };

  const previousDateLabel = formatDateLabel(booking.previousScheduledDate);
  const previousTimeLabel = formatTimeLabel(booking.previousScheduledTime);
  const newDateLabel = formatDateLabel(booking.scheduledDate);
  const newTimeLabel = formatTimeLabel(booking.scheduledTime);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text size="2xl" weight="bold" color={BrandColors.primary}>
        {headline}
      </Text>
      <Text size="md" color={BrandColors.primary} style={styles.bodyText}>
        {reasonCopy}
      </Text>

      {/* Shop + service summary */}
      <View style={styles.summaryCard}>
        {booking.shopName ? (
          <View style={styles.summaryRow}>
            <MapPin size={18} color={BrandColors.primary} strokeWidth={2} />
            <Text size="md" weight="semiBold" color={BrandColors.primary}>
              {booking.shopName}
            </Text>
          </View>
        ) : null}
        {booking.mechanicName ? (
          <View style={styles.summaryRow}>
            <UserIcon size={18} color={BrandColors.primary} strokeWidth={2} />
            <Text size="md" color={BrandColors.primary}>
              {booking.mechanicName}
            </Text>
          </View>
        ) : null}
        {booking.serviceNames.length > 0 ? (
          <View style={styles.summaryRow}>
            <Wrench size={18} color={BrandColors.primary} strokeWidth={2} />
            <Text size="md" color={BrandColors.primary}>
              {booking.serviceNames.join(", ")}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Before / After comparison */}
      <View style={styles.comparison}>
        <View style={[styles.timeCard, styles.timeCardOriginal]}>
          <Text size="xs" weight="semiBold" color="#6B7280" style={styles.timeCardLabel}>
            ORIGINAL
          </Text>
          <View style={styles.timeCardRow}>
            <Calendar size={16} color="#6B7280" strokeWidth={2} />
            <Text
              size="md"
              color="#6B7280"
              style={styles.strikethrough}
            >
              {previousDateLabel}
            </Text>
          </View>
          <Text
            size="lg"
            weight="semiBold"
            color="#6B7280"
            style={[styles.strikethrough, styles.timeCardValue]}
          >
            {previousTimeLabel}
          </Text>
          {booking.previousMechanicName ? (
            <Text size="sm" color="#9CA3AF" style={styles.strikethrough}>
              with {booking.previousMechanicName}
            </Text>
          ) : null}
        </View>

        <View style={[styles.timeCard, styles.timeCardProposed]}>
          <Text
            size="xs"
            weight="semiBold"
            color={BrandColors.secondary}
            style={styles.timeCardLabel}
          >
            PROPOSED
          </Text>
          <View style={styles.timeCardRow}>
            <Calendar size={16} color={BrandColors.secondary} strokeWidth={2} />
            <Text size="md" weight="semiBold" color={BrandColors.primary}>
              {newDateLabel}
            </Text>
          </View>
          <Text
            size="lg"
            weight="bold"
            color={BrandColors.primary}
            style={styles.timeCardValue}
          >
            {newTimeLabel}
          </Text>
          {booking.mechanicName ? (
            <Text size="sm" color={BrandColors.primary}>
              with {booking.mechanicName}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          onPress={handleAccept}
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting === "accept"}
          disabled={submitting !== null}
        >
          Accept new time
        </Button>
        {!isForcedDelay ? (
          <GhostButton
            onPress={handleDecline}
            size="lg"
            fullWidth
            loading={submitting === "decline"}
            disabled={submitting !== null}
          >
            Decline
          </GhostButton>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    textAlign: "center",
  },
  bodyText: {
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: "#F7F9FC",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  comparison: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  timeCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  timeCardOriginal: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  timeCardProposed: {
    backgroundColor: "#EFF5FF",
    borderWidth: 1.5,
    borderColor: BrandColors.secondary,
  },
  timeCardLabel: {
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  timeCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  timeCardValue: {
    marginTop: Spacing.xs,
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
});

export default RescheduleDecisionContent;
