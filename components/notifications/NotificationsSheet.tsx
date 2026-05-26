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
import { useRouter } from "expo-router";
import { Bell, Calendar, X } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { BorderRadius, BrandColors, Spacing } from "@/constants/theme";
import {
  useNotificationsFromConvex,
  type NotificationRow,
} from "@/hooks/useNotificationsFromConvex";
import { useNotificationsSheetStore } from "@/stores/useNotificationsSheetStore";
import { useRescheduleDecisionOverlayStore } from "@/stores/useRescheduleDecisionOverlayStore";
import { routeOtopairDeepLink } from "@/utils/linking";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_HEIGHT = Math.round(SCREEN_H * 0.78);

const SPRING_CONFIG = { damping: 24, stiffness: 180, mass: 1 } as const;

const RESCHEDULE_CATEGORIES = new Set([
  "booking_reschedule_proposed",
  "booking_forced_delay_proposed",
]);

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

  const { notifications, markRead, isLoading } = useNotificationsFromConvex();

  const [mounted, setMounted] = useState(false);
  const progress = useSharedValue(0);
  const rowRefs = useRef<Map<string, RNView | null>>(new Map());

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
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
    if (RESCHEDULE_CATEGORIES.has(row.category) && row.booking_id) {
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
          <Text size="xl" weight="bold" color={BrandColors.primary}>
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

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
        >
          {!isLoading && notifications.length === 0 ? (
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
                You're all caught up
              </Text>
              <Text size="md" color="#6B7280" style={styles.emptyBody}>
                When a shop proposes a change to one of your bookings,
                it'll show up here.
              </Text>
            </View>
          ) : null}

          {notifications.map((row) => {
            const isReschedule = RESCHEDULE_CATEGORIES.has(row.category);
            const isForced = row.category === "booking_forced_delay_proposed";
            const title = row.payload?.title ?? "Update";
            const body = row.payload?.body ?? "";
            const expiryLabel =
              isReschedule && typeof row.rescheduleExpiresAt === "number"
                ? formatExpiry(row.rescheduleExpiresAt)
                : null;
            return (
              <Pressable
                key={String(row._id)}
                ref={(node) => {
                  rowRefs.current.set(String(row._id), node as RNView | null);
                }}
                onPress={() => handleRowPress(row)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    isReschedule ? styles.rowIconAccent : null,
                  ]}
                >
                  {isReschedule ? (
                    <Calendar
                      size={20}
                      color={isForced ? "#C8972E" : BrandColors.secondary}
                      strokeWidth={2}
                    />
                  ) : (
                    <Bell
                      size={20}
                      color={BrandColors.primary}
                      strokeWidth={2}
                    />
                  )}
                </View>
                <View style={styles.rowText}>
                  <Text
                    size="md"
                    weight="semiBold"
                    color={BrandColors.primary}
                  >
                    {title}
                  </Text>
                  {body ? (
                    <Text size="sm" color="#4B5563" style={styles.rowBody}>
                      {body}
                    </Text>
                  ) : null}
                  {expiryLabel ? (
                    <Text
                      size="xs"
                      weight="semiBold"
                      color="#C8972E"
                      style={styles.rowTime}
                    >
                      {expiryLabel}
                    </Text>
                  ) : null}
                  <Text size="xs" color="#9CA3AF" style={styles.rowTime}>
                    {relativeTime(row.created_at)}
                  </Text>
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
    paddingBottom: Spacing.md,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(20,28,36,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["2xl"],
    gap: Spacing.sm,
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
  row: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.lg,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconAccent: {
    backgroundColor: "#EFF5FF",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowBody: {
    marginTop: 2,
    lineHeight: 18,
  },
  rowTime: {
    marginTop: Spacing.xs,
  },
});

export default NotificationsSheet;
