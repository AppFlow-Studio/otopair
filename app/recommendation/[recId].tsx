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

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { guardedRouter as router } from "@/lib/navigationLock";
import { ChevronLeft } from "lucide-react-native";
import { useMutation } from "convex/react";

import { Text } from "@/components/shared-ui";
import { api } from "@/convex/_generated/api";
import {
  useRecHistoryFromConvex,
  type RecHistoryItem,
} from "@/hooks/useRecHistoryFromConvex";
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

  // Screen lives at the root (sibling of the tab group) so the tab bar
  // doesn't render under it, and `router.back()` works from any caller.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/cars");
  };

  const activeVin = useVehicleStore((s) => s.getSelectedVehicle()?.vin);
  // History query covers every lifecycle state (open, hidden, completed,
  // expired) so the screen can be reached from both the tracker (open recs)
  // and the Bookings → Recommended history (hidden / resolved).
  const { history, isLoading } = useRecHistoryFromConvex(activeVin);

  const rec = useMemo(
    () => history.find((r: RecHistoryItem) => r._id === recId),
    [history, recId],
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading || !rec) {
    return (
      <View style={[styles.screen, styles.centerScreen, { paddingTop: insets.top }]}>
        <Pressable onPress={goBack} style={styles.backChip} hitSlop={12}>
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
  const isHidden =
    rec.status === "dismissed" && rec.dismissed_reason === "hidden_by_driver";
  const isClosed =
    rec.status === "completed" ||
    rec.status === "expired" ||
    (rec.status === "dismissed" && !isHidden);

  const handleBookThis = () => {
    const store = useBookingStore.getState();
    store.setSourceRecommendationId(rec._id);
    store.setPrefilledScheduledAt(null);
    // Pre-select the recommended service + seed the category signal so
    // the Select Services sheet opens on the right tab — mirrors the
    // MoreServicesSection entry point exactly.
    store.clearSelectedServices();
    if (rec.service_id) {
      store.toggleServiceSelection(String(rec.service_id));
      const svc = store.availableServices.find((s) => s.id === String(rec.service_id));
      if (svc?.category) store.setInitialServiceCategory(svc.category);
    }
    router.push("/(booking-flow)/select-services");
  };

  const handleConfirmDate = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await confirmScheduled({ recommendationId: rec._id });
      const store = useBookingStore.getState();
      store.setSourceRecommendationId(rec._id);
      if (typeof rec.scheduled_at === "number") {
        store.setPrefilledScheduledAt(rec.scheduled_at);
      }
      store.clearSelectedServices();
      if (rec.service_id) {
        store.toggleServiceSelection(String(rec.service_id));
        const svc = store.availableServices.find((s) => s.id === String(rec.service_id));
        if (svc?.category) store.setInitialServiceCategory(svc.category);
      }
      router.replace("/(booking-flow)/select-services");
    } finally {
      setSubmitting(false);
    }
  };

  const openDismissSheet = () => setConfirmOpen(true);

  const handleDismissConfirmed = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // No `reason` arg → backend defaults to `hidden_by_driver`, which keeps
      // the VHS penalty in place until the work is actually done.
      await dismissRec({ recommendationId: rec._id });
      setConfirmOpen(false);
      goBack();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backChip} hitSlop={12}>
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
        {isHidden ? (
          <View style={styles.hiddenBanner}>
            <Text weight="semiBold" style={styles.hiddenBannerTitle}>
              Hidden from your tracker
            </Text>
            <Text style={styles.hiddenBannerBody}>
              Your health score still reflects this until the service is done.
            </Text>
          </View>
        ) : null}

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
      {isClosed ? null : (
      <View style={[styles.footer, { paddingBottom: insets.bottom + scale(12) }]}>
        {isHidden ? (
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
        ) : hasScheduled ? (
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
              onPress={openDismissSheet}
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
              onPress={openDismissSheet}
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
      )}

      {confirmOpen ? (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Pressable
            style={styles.confirmBackdrop}
            onPress={() => (submitting ? null : setConfirmOpen(false))}
          />
          <View
            style={[
              styles.confirmCard,
              { paddingBottom: insets.bottom + scale(20) },
            ]}
          >
            <Text weight="bold" style={styles.confirmTitle}>
              Hide from your tracker?
            </Text>
            <Text style={styles.sheetBody}>
              Your health score will still reflect this until the service is
              done. You&apos;ll find it under Bookings → Recommended.
            </Text>
            <Pressable
              disabled={submitting}
              onPress={handleDismissConfirmed}
              style={({ pressed }) => [
                styles.primaryBtn,
                (pressed || submitting) && { opacity: 0.85 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text weight="semiBold" style={styles.primaryText}>
                  Hide
                </Text>
              )}
            </Pressable>
            <Pressable
              disabled={submitting}
              onPress={() => setConfirmOpen(false)}
              style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }]}
            >
              <Text weight="semiBold" style={styles.ghostText}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
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
  hiddenBanner: {
    backgroundColor: "#FFF8E1",
    borderRadius: moderateScale(12),
    paddingVertical: scale(12),
    paddingHorizontal: scale(14),
    marginBottom: scale(16),
    borderWidth: 0.5,
    borderColor: "#F1D58E",
  },
  hiddenBannerTitle: {
    fontSize: moderateScale(13),
    color: "#7A5A00",
  },
  hiddenBannerBody: {
    fontSize: moderateScale(12),
    color: "#7A5A00",
    marginTop: 2,
    lineHeight: moderateScale(16),
  },
  sheetBody: {
    fontSize: moderateScale(14),
    color: "#3F4A52",
    lineHeight: moderateScale(20),
    marginTop: scale(4),
    marginBottom: scale(16),
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  confirmCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    paddingHorizontal: scale(20),
    paddingTop: scale(20),
    gap: scale(8),
  },
  confirmTitle: {
    fontSize: moderateScale(18),
    color: "#141C24",
    marginBottom: scale(4),
  },
});
