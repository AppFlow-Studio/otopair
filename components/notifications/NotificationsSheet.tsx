/**
 * NotificationsSheet
 *
 * Bottom-up slide sheet showing the customer's pending notifications
 * from `notification_outbox`. Tapping a row in category
 * `booking_reschedule_proposed` / `booking_forced_delay_proposed`
 * marks it read and launches the RescheduleDecisionOverlay.
 *
 * Triggered globally by `useNotificationsSheetStore.open()` so any
 * tab's bell icon can open it.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { View as RNView } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import {
  Bell,
  Calendar,
  Car,
  ChevronRight,
  CircleCheck,
  Gauge,
  X,
} from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { BorderRadius, BrandColors, SemanticColors, Spacing } from "@/constants/theme";
import {
  useNotificationsFromConvex,
  type NotificationRow,
} from "@/hooks/useNotificationsFromConvex";
import { useNotificationsSheetStore } from "@/stores/useNotificationsSheetStore";
import { useRescheduleDecisionOverlayStore } from "@/stores/useRescheduleDecisionOverlayStore";
import { routeOtopairDeepLink } from "@/utils/linking";
import { NotificationActions } from "./NotificationActions";
import { notificationTitle } from "./notificationLabels";
import { getNotificationShape } from "./notificationShapes";
import { NOTIFICATION_TONES, getNotificationVisual } from "./notificationVisuals";

/** Filter tabs across the top of the sheet. */
type NotificationFilter = "all" | "unread";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_HEIGHT = Math.round(SCREEN_H * 0.78);

const SPRING_CONFIG = { damping: 24, stiffness: 180, mass: 1 } as const;

function relativeTime(createdAt: number): string {
  const diffMs = Date.now() - createdAt;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(createdAt).toLocaleDateString();
}

// Appointment date for the row meta line. Bookings store scheduled_date as an
// ISO-ish string; render it as M/D/YYYY, or null when absent/unparseable so the
// meta line just omits the date rather than showing "Invalid Date".
function formatMetaDate(scheduledDate?: string | null): string | null {
  if (!scheduledDate) return null;
  const d = new Date(scheduledDate);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function formatExpiry(expiresAt: number): string | null {
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) return "Expired — awaiting auto-revert";
  const minutes = Math.floor(remainingMs / 60000);
  if (minutes < 60) return `Expires in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `Expires in ${hours}h`;
}

export function NotificationsSheet() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isOpen = useNotificationsSheetStore((s) => s.isOpen);
  const closeStore = useNotificationsSheetStore((s) => s.close);
  const openDecision = useRescheduleDecisionOverlayStore((s) => s.open);

  const { notifications, markRead, resolve, isLoading } =
    useNotificationsFromConvex();

  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const progress = useSharedValue(0);
  const rowRefs = useRef<Map<string, RNView | null>>(new Map());

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setFilter("all");
      progress.value = 0;
      requestAnimationFrame(() => {
        progress.value = withSpring(1, SPRING_CONFIG);
      });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: 220 }, (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [SHEET_HEIGHT, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const handleClose = () => {
    closeStore();
  };

  const handleRowPress = (row: NotificationRow) => {
    const spec = getNotificationShape(row.category);
    if (spec.action === "reschedule_decision" && row.booking_id) {
      const node = rowRefs.current.get(String(row._id));
      const launch = (rect: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => {
        // Mark read first so the sheet's list refreshes; close the
        // sheet before opening the overlay so the modal stack doesn't
        // stutter on the open animation.
        markRead(row._id).catch(() => {});
        closeStore();
        // Defer the overlay open by one frame so the sheet's close
        // animation has started before we mount a second Modal.
        requestAnimationFrame(() => {
          openDecision(rect, row.booking_id as any);
        });
      };
      if (node && typeof (node as any).measureInWindow === "function") {
        (node as any).measureInWindow(
          (x: number, y: number, width: number, height: number) => {
            launch({ x, y, width, height });
          },
        );
      } else {
        launch({
          x: 16,
          y: SCREEN_H * 0.5,
          width: 56,
          height: 56,
        });
      }
      return;
    }

    // Generic deep-link path. Approval notifications (and any future
    // category set by convex/booking_approvals.ts or similar) ship a
    // `data.deepLink` string in their payload — route on it so taps
    // actually open the target screen instead of silently dismissing.
    const deepLink =
      typeof row.payload?.data?.deepLink === "string"
        ? row.payload.data.deepLink
        : null;
    markRead(row._id).catch(() => {});
    if (deepLink) {
      closeStore();
      requestAnimationFrame(() => {
        routeOtopairDeepLink(router, deepLink);
      });
      return;
    }

    // Fallback: booking-scoped notification with no deep link — open the
    // booking detail in the bookings tab so the user lands somewhere
    // actionable instead of nowhere.
    if (row.booking_id) {
      closeStore();
      requestAnimationFrame(() => {
        router.push({
          pathname: "/(main-tabs)/bookings",
          params: { bookingId: String(row.booking_id) },
        });
      });
    }
  };

  // Dismiss an informational notification — archives it from the feed.
  const handleDismiss = (row: NotificationRow) => {
    resolve(row._id).catch(() => {});
  };

  // "Mark all as read" — marks every unread row SEEN. Backend has no bulk
  // mutation (convex is owned by otopair-web), so fan out over the existing,
  // deployed markRead; the reactive query collapses the unread styling as each
  // patch lands.
  const unreadRows = notifications.filter((row) => row.read_at == null);
  const handleMarkAllRead = () => {
    if (unreadRows.length === 0) return;
    unreadRows.forEach((row) => {
      markRead(row._id).catch(() => {});
    });
  };

  // Feed slices behind the filter tabs.
  const visibleRows = filter === "unread" ? unreadRows : notifications;

  const filterTabs: { key: NotificationFilter; label: string; count?: number }[] =
    [
      { key: "all", label: "All", count: notifications.length },
      { key: "unread", label: "Unread", count: unreadRows.length },
    ];

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <BlurView
            intensity={30}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { height: SHEET_HEIGHT, paddingBottom: insets.bottom },
          sheetStyle,
        ]}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text size={28} weight="extraBold" color={BrandColors.primary}>
            Notifications
          </Text>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={styles.closeButton}
          >
            <X size={20} color={BrandColors.primary} strokeWidth={2.4} />
          </Pressable>
        </View>

        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterScrollContent}
          >
            {filterTabs.map((tab) => {
              const active = filter === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setFilter(tab.key)}
                  style={[styles.pill, active && styles.pillActive]}
                >
                  <Text
                    size="sm"
                    weight={active ? "bold" : "semiBold"}
                    color={active ? BrandColors.primary : SemanticColors.textMuted}
                  >
                    {tab.label}
                  </Text>
                  {typeof tab.count === "number" ? (
                    <View
                      style={[
                        styles.pillBadge,
                        active && styles.pillBadgeActive,
                      ]}
                    >
                      <Text
                        size="xs"
                        weight="bold"
                        color={active ? BrandColors.white : SemanticColors.textMuted}
                      >
                        {tab.count}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={handleMarkAllRead}
            disabled={unreadRows.length === 0}
            hitSlop={8}
            style={[
              styles.markAll,
              unreadRows.length === 0 && styles.markAllDisabled,
            ]}
          >
            <CircleCheck
              size={16}
              color={BrandColors.secondary}
              strokeWidth={2.2}
            />
            <Text size="sm" weight="semiBold" color={BrandColors.secondary}>
              Mark all as read
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
        >
          {!isLoading && visibleRows.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Bell size={28} color="#9CA3AF" strokeWidth={1.75} />
              </View>
              <Text
                size="lg"
                weight="semiBold"
                color={BrandColors.primary}
                style={styles.emptyTitle}
              >
                {filter === "unread"
                  ? "No unread notifications"
                  : "You're all caught up"}
              </Text>
              <Text size="md" color="#6B7280" style={styles.emptyBody}>
                Updates about your bookings — reschedules, reminders, and
                status changes — show up here.
              </Text>
            </View>
          ) : null}

          {visibleRows.map((row) => {
            const spec = getNotificationShape(row.category);
            const isReschedule = spec.action === "reschedule_decision";
            const isActionableRow = spec.shape === "actionable";
            // Inline decision buttons are wired for the families that resolve
            // with just a bookingId; other actionable rows stay tap-through.
            const inlineAction =
              isActionableRow &&
              (spec.action === "reschedule_decision" ||
                spec.action === "estimate_decision" ||
                spec.action === "on_my_way")
                ? spec.action
                : null;
            const isUnread = row.read_at == null;
            const title = notificationTitle(row.category, row.payload);
            const body = row.payload?.body ?? "";
            const expiryLabel =
              isReschedule && typeof row.rescheduleExpiresAt === "number"
                ? formatExpiry(row.rescheduleExpiresAt)
                : null;

            // Icon + colour tone driven by the notification type.
            const visual = getNotificationVisual(row.category);
            const tone = NOTIFICATION_TONES[visual.tone];
            const RowIcon = visual.Icon;

            // Top-right control: a chevron for tap-through actionable rows, a
            // dismiss X for acknowledge rows, nothing for rows that carry their
            // own inline decision buttons.
            const showChevron = isActionableRow && !inlineAction;
            const showDismiss = !isActionableRow;

            // Meta line — appointment date, vehicle, odometer — only the parts
            // this row actually references.
            const dateLabel = formatMetaDate(row.scheduledDate);
            const metaParts: {
              key: string;
              Icon: typeof RowIcon;
              label: string;
            }[] = [];
            if (dateLabel)
              metaParts.push({ key: "date", Icon: Calendar, label: dateLabel });
            if (row.vehicleYMMT)
              metaParts.push({ key: "veh", Icon: Car, label: row.vehicleYMMT });
            if (typeof row.mileage === "number")
              metaParts.push({
                key: "mi",
                Icon: Gauge,
                label: `${row.mileage.toLocaleString()} mi`,
              });

            return (
              <Pressable
                key={String(row._id)}
                ref={(node) => {
                  rowRefs.current.set(String(row._id), node as RNView | null);
                }}
                onPress={() => handleRowPress(row)}
                style={({ pressed }) => [
                  styles.row,
                  !isUnread && styles.rowRead,
                  pressed && styles.rowPressed,
                ]}
              >
                {isUnread ? <View style={styles.railDot} /> : null}

                <View
                  style={[styles.rowIcon, { backgroundColor: tone.tile }]}
                >
                  <RowIcon size={22} color={tone.icon} strokeWidth={2} />
                </View>

                <View style={styles.rowText}>
                  <View style={styles.titleRow}>
                    <Text
                      size="md"
                      weight={isUnread ? "bold" : "semiBold"}
                      color={BrandColors.primary}
                      style={styles.titleText}
                      numberOfLines={2}
                    >
                      {title}
                    </Text>
                    <View style={styles.topRight}>
                      <Text size="xs" color="#9AA4B2" style={styles.timeText}>
                        {relativeTime(row.created_at)}
                      </Text>
                      {showChevron ? (
                        <ChevronRight
                          size={16}
                          color="#C3CBD6"
                          strokeWidth={2.4}
                        />
                      ) : null}
                      {showDismiss ? (
                        <Pressable
                          onPress={() => handleDismiss(row)}
                          hitSlop={10}
                          style={styles.dismissButton}
                          accessibilityLabel="Dismiss notification"
                        >
                          <X size={15} color="#9AA4B2" strokeWidth={2.4} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  {body ? (
                    <Text
                      size="sm"
                      color="#4B5563"
                      style={styles.rowBody}
                      numberOfLines={2}
                    >
                      {body}
                    </Text>
                  ) : null}

                  {expiryLabel ? (
                    <Text
                      size="xs"
                      weight="semiBold"
                      color={SemanticColors.warningAmber}
                      style={styles.rowExpiry}
                    >
                      {expiryLabel}
                    </Text>
                  ) : null}

                  {metaParts.length > 0 ? (
                    <View style={styles.metaRow}>
                      {metaParts.map((part, i) => (
                        <React.Fragment key={part.key}>
                          {i > 0 ? <View style={styles.metaSep} /> : null}
                          <View style={styles.metaItem}>
                            <part.Icon
                              size={13}
                              color="#9AA4B2"
                              strokeWidth={2}
                            />
                            <Text
                              size="xs"
                              color={SemanticColors.textMuted}
                              numberOfLines={1}
                            >
                              {part.label}
                            </Text>
                          </View>
                        </React.Fragment>
                      ))}
                    </View>
                  ) : null}

                  {row.shopName ? (
                    <View
                      style={[styles.shopChip, { backgroundColor: tone.chipBg }]}
                    >
                      <Text size="xs" weight="semiBold" color={tone.chipText}>
                        {row.shopName}
                      </Text>
                    </View>
                  ) : null}

                  {inlineAction ? (
                    <NotificationActions
                      row={row}
                      action={inlineAction}
                      onResolve={() => resolve(row._id).catch(() => {})}
                      onOpenOverlay={() => handleRowPress(row)}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: BorderRadius["2xl"] ?? 24,
    borderTopRightRadius: BorderRadius["2xl"] ?? 24,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(20,28,36,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Filter bar ─────────────────────────────────────────────────────────
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  filterScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  pillActive: {
    backgroundColor: SemanticColors.primaryBlueLight,
    borderColor: SemanticColors.primaryBlueLightAlt,
  },
  pillBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  pillBadgeActive: {
    backgroundColor: BrandColors.secondary,
  },
  markAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
    paddingVertical: 4,
  },
  markAllDisabled: {
    opacity: 0.4,
  },

  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["2xl"],
    gap: Spacing.md,
  },
  empty: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    textAlign: "center",
  },
  emptyBody: {
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
    lineHeight: 20,
  },

  // ── Notification card ──────────────────────────────────────────────────
  row: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: "#EEF1F4",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  rowRead: {
    backgroundColor: "#F7F8FA",
    borderColor: "#F0F2F5",
    opacity: 0.9,
  },
  rowPressed: {
    opacity: 0.7,
  },
  railDot: {
    position: "absolute",
    left: -12,
    top: 34,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.secondary,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  titleText: {
    flex: 1,
    lineHeight: 20,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    marginTop: 1,
  },
  timeText: {
    // muted timestamp — colour set inline
  },
  dismissButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    marginTop: 3,
    lineHeight: 18,
  },
  rowExpiry: {
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#CBD2DB",
  },
  shopChip: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
});

export default NotificationsSheet;
