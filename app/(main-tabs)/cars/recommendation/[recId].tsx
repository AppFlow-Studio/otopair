/**
 * Recommendation detail — "Take Action" target.
 *
 * Renders the full picture behind a mechanic-recommended service (who/where,
 * reason, impact, projected health, recommended timing) so the driver can
 * make an informed call before booking.
 *
 * Footer adapts to the rec shape:
 *   - scheduled_at set  → Confirm Date / Dismiss
 *   - timeframe only    → Book This Service
 */

import React, { useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useMutation } from "convex/react";

import { Text } from "@/components/shared-ui";
import { api } from "@/convex/_generated/api";
import { useDriverRecommendationsFromConvex } from "@/hooks/useDriverRecommendationsFromConvex";
import type { DriverRecommendation } from "@/hooks/useMaintenanceData";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { scale, moderateScale } from "@/utils/responsive";

const SEVERITY_DOT: Record<"high" | "medium" | "low", string> = {
  high: "#EF4444",
  medium: "#F5C623",
  low: "#5299FE",
};

function urgencyTimeframeLabel(urgency: "next_visit" | "within_3_months" | "soon" | null) {
  switch (urgency) {
    case "next_visit":
      return "Service on your next visit";
    case "within_3_months":
      return "Within the next 3 months";
    case "soon":
      return "Service recommended soon";
    default:
      return "Recommended by your mechanic";
  }
}

function formatScheduledAt(ms: number) {
  const d = new Date(ms);
  const dateStr = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateStr} · ${timeStr}`;
}

export default function RecommendationDetailScreen() {
  const { recId } = useLocalSearchParams<{ recId: string }>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Hide the bottom tab bar so the sticky action footer doesn't compete
  // with it. Restored on unmount.
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({ tabBarStyle: { display: "none" } });
    }
    return () => {
      if (parent) parent.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  const activeVin = useVehicleStore((s) => s.getSelectedVehicle()?.vin);
  const { recommendations, isLoading } = useDriverRecommendationsFromConvex(activeVin);

  const rec = useMemo(
    () => recommendations.find((r: DriverRecommendation) => r._id === recId),
    [recommendations, recId],
  );

  // Backend mutations live in otopair-web/convex/jobRecommendations.ts:
  //   - dismissRecFromDriver({ recommendationId, reason })
  //   - confirmScheduledDateFromDriver({ recommendationId })
  // Cast through `any` until the otopair-web side lands; once `npx convex
  // dev` regenerates _generated, drop the cast.
  const dismissRec = useMutation(
    (api as any).jobRecommendations.dismissRecFromDriver,
  );
  const confirmScheduled = useMutation(
    (api as any).jobRecommendations.confirmScheduledDateFromDriver,
  );

  const [submitting, setSubmitting] = useState(false);

  if (isLoading || !rec) {
    return (
      <View style={[styles.screen, styles.centerScreen, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={styles.backChip} hitSlop={12}>
          <ChevronLeft size={moderateScale(22)} color="#141C24" />
        </Pressable>
        {isLoading ? (
          <ActivityIndicator color="#5299FE" />
        ) : (
          <Text style={styles.empty}>This recommendation is no longer available.</Text>
        )}
      </View>
    );
  }

  const hasScheduled = typeof rec.scheduled_at === "number";
  const mechanic = rec.mechanic_name ?? "your mechanic";
  const shop = rec.shop_name ?? null;

  const handleBookThis = () => {
    useBookingStore.getState().setSourceRecommendationId(rec._id);
    useBookingStore.getState().setPrefilledScheduledAt(null);
    router.push("/home/map");
  };

  const handleConfirmDate = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await confirmScheduled({ recommendationId: rec._id });
      useBookingStore.getState().setSourceRecommendationId(rec._id);
      if (typeof rec.scheduled_at === "number") {
        useBookingStore.getState().setPrefilledScheduledAt(rec.scheduled_at);
      }
      router.replace("/home/map");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await dismissRec({ recommendationId: rec._id, reason: "not_needed" });
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backChip} hitSlop={12}>
          <ChevronLeft size={moderateScale(22)} color="#141C24" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + scale(140) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title block */}
        <Text weight="bold" style={styles.title}>
          {rec.service_name}
        </Text>
        <Text style={styles.subtitle}>{urgencyTimeframeLabel(rec.urgency)}</Text>

        {/* Recommended by */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>RECOMMENDED BY</Text>
          <Text weight="semiBold" style={styles.cardPrimary}>
            {mechanic}
          </Text>
          {shop ? <Text style={styles.cardSecondary}>{shop}</Text> : null}
        </View>

        {/* Why */}
        {rec.reason ? (
          <View style={styles.section}>
            <Text weight="semiBold" style={styles.sectionTitle}>
              Why
            </Text>
            <Text style={styles.body}>{rec.reason}</Text>
          </View>
        ) : null}

        {/* Impact — derived from the rec's urgency (we don't have a per-rec
            impact list yet, so map urgency to a single severity row that
            keeps the section honest without inventing data). */}
        <View style={styles.section}>
          <Text weight="semiBold" style={styles.sectionTitle}>
            Impact
          </Text>
          <View style={styles.impactRow}>
            <View
              style={[
                styles.impactDot,
                {
                  backgroundColor:
                    rec.urgency === "next_visit"
                      ? SEVERITY_DOT.high
                      : rec.urgency === "within_3_months"
                        ? SEVERITY_DOT.medium
                        : SEVERITY_DOT.low,
                },
              ]}
            />
            <Text style={styles.impactLabel}>Vehicle health</Text>
            <Text style={styles.impactSeverity}>
              {rec.urgency === "next_visit"
                ? "High"
                : rec.urgency === "within_3_months"
                  ? "Medium"
                  : "Low"}
            </Text>
          </View>
        </View>

        {/* Recommended timing */}
        <View style={styles.section}>
          <Text weight="semiBold" style={styles.sectionTitle}>
            Recommended timing
          </Text>
          {hasScheduled && typeof rec.scheduled_at === "number" ? (
            <View style={styles.scheduledCard}>
              <Text weight="semiBold" style={styles.scheduledDate}>
                {formatScheduledAt(rec.scheduled_at)}
              </Text>
              {rec.scheduled_mechanic_name ? (
                <Text style={styles.cardSecondary}>
                  with {rec.scheduled_mechanic_name}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.body}>{urgencyTimeframeLabel(rec.urgency)}</Text>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + scale(12) }]}>
        {hasScheduled ? (
          <>
            <Pressable
              disabled={submitting}
              onPress={handleConfirmDate}
              style={({ pressed }) => [
                styles.primaryBtn,
                (pressed || submitting) && { opacity: 0.85 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text weight="semiBold" style={styles.primaryText}>
                  Confirm Date
                </Text>
              )}
            </Pressable>
            <Pressable
              disabled={submitting}
              onPress={handleDismiss}
              style={({ pressed }) => [
                styles.ghostBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text weight="semiBold" style={styles.ghostText}>
                Dismiss
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              disabled={submitting}
              onPress={handleBookThis}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text weight="semiBold" style={styles.primaryText}>
                Book This Service
              </Text>
            </Pressable>
            <Pressable
              disabled={submitting}
              onPress={handleDismiss}
              style={({ pressed }) => [
                styles.ghostBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text weight="semiBold" style={styles.ghostText}>
                Dismiss
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },
  centerScreen: {
    alignItems: "center",
    justifyContent: "center",
    gap: scale(16),
  },
  empty: {
    color: "#757c7d",
    fontSize: moderateScale(14),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(16),
    paddingTop: scale(8),
    paddingBottom: scale(4),
  },
  backChip: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(20),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.06)",
  },
  scrollContent: {
    paddingHorizontal: scale(20),
    paddingTop: scale(20),
  },
  title: {
    fontSize: moderateScale(26),
    color: "#141C24",
    lineHeight: moderateScale(32),
  },
  subtitle: {
    fontSize: moderateScale(14),
    color: "#5299FE",
    marginTop: scale(4),
    marginBottom: scale(20),
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    padding: scale(16),
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.06)",
    marginBottom: scale(24),
  },
  sectionLabel: {
    fontSize: moderateScale(11),
    color: "#829BAD",
    letterSpacing: 0.8,
    marginBottom: scale(6),
  },
  cardPrimary: {
    fontSize: moderateScale(16),
    color: "#141C24",
  },
  cardSecondary: {
    fontSize: moderateScale(13),
    color: "#757c7d",
    marginTop: scale(2),
  },
  section: {
    marginBottom: scale(24),
  },
  sectionTitle: {
    fontSize: moderateScale(15),
    color: "#141C24",
    marginBottom: scale(8),
  },
  body: {
    fontSize: moderateScale(14),
    color: "#3F4A52",
    lineHeight: moderateScale(20),
  },
  impactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(14),
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.06)",
    gap: scale(10),
  },
  impactDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: moderateScale(4),
  },
  impactLabel: {
    flex: 1,
    fontSize: moderateScale(14),
    color: "#141C24",
  },
  impactSeverity: {
    fontSize: moderateScale(13),
    color: "#757c7d",
  },
  scheduledCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(14),
    padding: scale(16),
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.06)",
  },
  scheduledDate: {
    fontSize: moderateScale(16),
    color: "#141C24",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: scale(20),
    paddingTop: scale(12),
    backgroundColor: "#F6F7F9",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
    gap: scale(8),
  },
  primaryBtn: {
    backgroundColor: "#141C24",
    paddingVertical: scale(15),
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: moderateScale(15),
  },
  ghostBtn: {
    paddingVertical: scale(12),
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: {
    color: "#757c7d",
    fontSize: moderateScale(14),
  },
});
