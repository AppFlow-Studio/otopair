/**
 * CustomerLateBanner — shows at the top of My Bookings whenever the
 * shop has fired a `customer_late_push_reminder` or
 * `overrun_customer_resolution` for the current user.
 *
 * The late "…is waiting" card is a hero card: clock chip + shop title + handle
 * pill, the customer's name, the missed check-in line, and On my way /
 * Reschedule actions, with a full-bleed winding-road + map-pin illustration
 * bleeding off the right edge. The overrun "running long" card keeps the app's
 * compact alert-card language. Both self-clear from the feed once the customer
 * acts or the booking moves on.
 */

import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertTriangle,
  Calendar,
  Car,
  Clock,
  Navigation,
  User as UserIcon,
} from "lucide-react-native";
import { Text } from "@/components/shared-ui";
import {
  BrandColors,
  CardShadow,
  FontFamily,
  SemanticColors,
  SurfaceColors,
} from "@/constants/theme";

const LATE_CATEGORY = "customer_late_push_reminder";
const RESOLUTION_CATEGORY = "overrun_customer_resolution";

const ACCENT = SemanticColors.primaryBlue; // #2563EB
const RESOLUTION_ACCENT = SemanticColors.primaryBlue;
const ROAD_IMG = require("@/assets/images/waiting-road.png");

function formatTime12h(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

interface Props {
  onReschedule?: (bookingId: Id<"bookings">) => void;
}

function ResolutionHandlePill({ handle }: { handle: string | null }) {
  if (!handle) return null;
  return (
    <View style={styles.resHandlePill}>
      <Text style={styles.resHandlePillText}>{handle}</Text>
    </View>
  );
}

function ResolutionMetaRow({
  customerName,
  vehicleLabel,
}: {
  customerName: string | null;
  vehicleLabel: string | null;
}) {
  if (!customerName && !vehicleLabel) return null;
  return (
    <View style={styles.resMetaRow}>
      {customerName ? (
        <View style={styles.resMetaItem}>
          <UserIcon size={12} color={SemanticColors.textMuted} />
          <Text size="xs" style={styles.resMetaText}>
            {customerName}
          </Text>
        </View>
      ) : null}
      {vehicleLabel ? (
        <View style={styles.resMetaItem}>
          <Car size={12} color={SemanticColors.textMuted} />
          <Text size="xs" style={styles.resMetaText}>
            {vehicleLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function CustomerLateBanner({ onReschedule }: Props) {
  const notifications = useQuery(api.notifications.getMyNotifications, {}) as
    | Array<any>
    | undefined;
  const acknowledge = useMutation((api as any).bookings.acknowledgeCustomerLate);
  const resolve = useMutation(api.notifications.resolveNotification);

  // Hide a card the instant the customer taps an action, independent of how
  // fast (or whether) the server-side resolve round-trips. Without this, a slow
  // or silently-failing mutation leaves the card stuck on screen after "Got it"
  // / "Reschedule" — which is exactly the "doesn't close" bug. The reactive
  // feed still drops the row for good once `resolved_at` lands.
  const [dismissedIds, setDismissedIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const dismiss = React.useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const notDismissed = (n: any) => !dismissedIds.has(String(n._id));
  const lateRow =
    notifications?.find((n) => n.category === LATE_CATEGORY && notDismissed(n)) ?? null;
  const resolutionRow =
    notifications?.find((n) => n.category === RESOLUTION_CATEGORY && notDismissed(n)) ?? null;

  if (!lateRow && !resolutionRow) return null;

  return (
    <View style={styles.wrap}>
      {lateRow ? (
        <View style={styles.hero}>
          <Image
            source={ROAD_IMG}
            style={styles.heroArt}
            resizeMode="cover"
            pointerEvents="none"
          />
          <View style={styles.heroContent}>
            <View style={styles.heroHeader}>
              {/* <View style={styles.clockChip}>
                <Clock size={20} color={ACCENT} strokeWidth={2.4} />
              </View> */}
              <Text
                weight="bold"
                style={styles.heroTitle}
                numberOfLines={2}
              >
                {lateRow.shopName
                  ? `${lateRow.shopName} is waiting`
                  : "Shop is waiting"}
              </Text>
              {lateRow.shortHandle ? (
                <View style={styles.handlePill}>
                  <Text style={styles.handlePillText}>
                    {lateRow.shortHandle}
                  </Text>
                </View>
              ) : null}
            </View>

            {lateRow.customerName ? (
              <View style={styles.personRow}>
                <UserIcon size={16} color={ACCENT} strokeWidth={2.2} />
                <Text style={styles.personName} numberOfLines={1}>
                  {lateRow.customerName}
                </Text>
              </View>
            ) : null}

            {lateRow.vehicleYMMT ? (
              <View style={styles.carRow}>
                <Car size={16} color={ACCENT} strokeWidth={2.2} />
                <Text style={styles.carText} numberOfLines={1}>
                  {lateRow.vehicleYMMT}
                </Text>
              </View>
            ) : null}

            <Text style={styles.heroDesc}>
              Booking at{" "}
              {formatTime12h(lateRow.scheduledTime) || "the scheduled time"}{" "}
              hasn't checked in yet.
            </Text>

            <View style={styles.heroButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.heroBtn,
                  styles.heroBtnPrimary,
                  pressed && styles.pressed,
                ]}
                onPress={async () => {
                  if (!lateRow.booking_id) return;
                  // Acknowledge resolves the card server-side; the reactive
                  // feed then drops it and this banner unmounts.
                  await acknowledge({ bookingId: lateRow.booking_id });
                }}
              >
                <Navigation
                  size={11}
                  color={BrandColors.white}
                  fill={BrandColors.white}
                  strokeWidth={2}
                />
                <Text size="sm" weight="bold" style={styles.heroBtnPrimaryText}>
                  On my way
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.heroBtn,
                  styles.heroBtnOutline,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  if (lateRow.booking_id && onReschedule)
                    onReschedule(lateRow.booking_id);
                }}
              >
                <Calendar size={16} color={ACCENT} strokeWidth={2.2} />
                <Text
                  size="sm"
                  weight="semiBold"
                  style={styles.heroBtnOutlineText}
                >
                  Reschedule
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {resolutionRow ? (
        <View style={styles.resCard}>
          <View
            style={[styles.resRail, { backgroundColor: RESOLUTION_ACCENT }]}
          />
          <View
            style={[
              styles.resIconChip,
              { backgroundColor: `${RESOLUTION_ACCENT}1F` },
            ]}
          >
            <AlertTriangle size={20} color={RESOLUTION_ACCENT} />
          </View>
          <View style={styles.resBody}>
            <View style={styles.resTitleRow}>
              <Text weight="semiBold" style={styles.resTitle}>
                {resolutionRow.payload?.newEndTime
                  ? `Now finishing around ${formatTime12h(resolutionRow.payload.newEndTime)}`
                  : `Running ~${resolutionRow.payload?.extensionMinutes ?? 15} min behind`}
              </Text>
              <ResolutionHandlePill handle={resolutionRow.shortHandle} />
            </View>
            <ResolutionMetaRow
              customerName={resolutionRow.customerName}
              vehicleLabel={resolutionRow.vehicleLabel}
            />
            <Text style={styles.resDesc}>
              {resolutionRow.shopName
                ? `${resolutionRow.shopName} pushed the slot forward.`
                : "Shop pushed the slot forward."}{" "}
              Tap reschedule if the new time doesn't work.
            </Text>
            <View style={styles.resButtonRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.resBtn,
                  styles.resBtnPrimary,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  // Close immediately, then navigate. The banner clears for
                  // good server-side when the reschedule lands / booking moves.
                  dismiss(String(resolutionRow._id));
                  if (resolutionRow.booking_id && onReschedule)
                    onReschedule(resolutionRow.booking_id);
                }}
              >
                <Text size="sm" weight="bold" style={styles.resBtnPrimaryText}>
                  Reschedule
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.resBtn,
                  styles.resBtnOutline,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  // Hide now (optimistic) and archive the notification.
                  dismiss(String(resolutionRow._id));
                  void resolve({ notificationId: resolutionRow._id }).catch(() => {});
                }}
              >
                <Text
                  size="sm"
                  weight="semiBold"
                  style={styles.resBtnOutlineText}
                >
                  Got it
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 12 },
  pressed: { opacity: 0.85 },

  // ── Hero "…is waiting" card ────────────────────────────────────────────
  hero: {
    position: "relative",
    backgroundColor: SurfaceColors.cardSurface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    overflow: "hidden",
    boxShadow: CardShadow.default,
  },
  // Full-bleed background: the PNG's left half is transparent, so it scales to
  // cover the card (art anchored right, pin vertically centered) while the text
  // column on the left stays clear.
  heroArt: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  heroContent: {
    paddingVertical: 18,
    paddingLeft: 18,
    paddingRight: "30%",
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  clockChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SemanticColors.primaryBlueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    color: BrandColors.primary,
    fontSize: 16,
    lineHeight: 21,
    flex: 1,
  },
  // Small + muted so the shop name gets the space; reads as a quiet reference
  // code rather than a competing pill.
  handlePill: {
    backgroundColor: SemanticColors.surface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  handlePillText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
    color: SemanticColors.textMuted,
    letterSpacing: 0.2,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  personName: {
    color: SemanticColors.textSecondary,
    fontSize: 15,
    flexShrink: 1,
  },
  carRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  carText: {
    color: SemanticColors.textSecondary,
    fontSize: 15,
    flexShrink: 1,
  },
  heroDesc: {
    color: SemanticColors.textMuted,
    fontSize: 14,
    marginTop: 8,
    lineHeight: 19,
  },
  heroButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  heroBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  heroBtnPrimary: { backgroundColor: ACCENT },
  heroBtnPrimaryText: { color: BrandColors.white },
  heroBtnOutline: {
    backgroundColor: SurfaceColors.cardSurface,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  heroBtnOutlineText: { color: BrandColors.primary },

  // ── Overrun "running long" card (compact alert card) ───────────────────
  resCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: SurfaceColors.cardSurface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 14,
    overflow: "hidden",
    boxShadow: CardShadow.default,
  },
  resRail: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  resIconChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  resBody: { flex: 1 },
  resTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  resTitle: { color: BrandColors.primary, fontSize: 15, flexShrink: 1 },
  resMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  resMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  resMetaText: { color: SemanticColors.textMuted },
  resDesc: {
    color: SemanticColors.textSecondary,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  resButtonRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  resBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  resBtnPrimary: { backgroundColor: BrandColors.primary },
  resBtnPrimaryText: { color: BrandColors.white },
  resBtnOutline: {
    backgroundColor: SurfaceColors.cardSurface,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  resBtnOutlineText: { color: BrandColors.primary },
  resHandlePill: {
    borderWidth: 1,
    borderColor: SemanticColors.border,
    backgroundColor: SemanticColors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  resHandlePillText: {
    fontFamily: FontFamily.monoSemiBold,
    fontSize: 11,
    color: SemanticColors.textMuted,
    letterSpacing: 0.3,
  },
});
