/**
 * BookingDetailsSheet
 *
 * PURPOSE: Flighty-style floating sheet with 3 snap points (peek / mid / full).
 *          Content crossfades between three distinct views based on the current
 *          detent index — peek shows a single status strip, mid shows the
 *          essentials + primary action, full shows timeline + all details.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * OWNER: Waleed Mansour
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as Calendar from "expo-calendar";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { ArrowRight, Bell, CalendarX, Car, Check, ChevronDown, ChevronRight, FileText, MessageCircle, Navigation, Phone, ReceiptText, User, Wrench, X } from "lucide-react-native";

import { openMapsForAddress, openPhone } from "@/utils/linking";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/shared-ui";
import { BorderRadius } from "@/constants/theme";
import { useToast } from "@/hooks/useToast";
import { buildBookingCalendarEvent, formatBookingReference } from "@/lib/booking-calendar";
import { useBookingStore } from "@/stores/useBookingStore";
import type { Booking } from "./BookingCard";
import { MechanicChatSheet, type MechanicChatSheetRef } from "./MechanicChatSheet";
import { RescheduleSheet, type RescheduleSheetRef } from "./RescheduleSheet";
import { ApprovalBanner } from "@/components/booking/ApprovalBanner";
import { PaymentBreakdown } from "@/components/booking/PaymentBreakdown";
import { ReceiptViewer } from "@/components/booking/ReceiptViewer";
import {
  FileDisputeSheet,
  type FileDisputeSheetRef,
} from "@/components/booking/FileDisputeSheet";
import { deriveDisclosedRange } from "@/lib/disclosedRange";

// ============================================================================
// CONSTANTS (sheet mechanics — frozen)
// ============================================================================

const { height: FALLBACK_SCREEN_HEIGHT } = Dimensions.get("window");

const SIDE_INSET_MAX = 10;
const CORNER_RADIUS = 46;
const FLOAT_BOTTOM = 12;

const FLING_VELOCITY = 550;
const DISMISS_OVERSHOOT = 80;

type BookingStatus = Booking["status"];

const STATUS_CONFIG: Record<BookingStatus, { label: string; bgColor: string; textColor: string }> = {
  pending_shop_acceptance: { label: "Awaiting shop", bgColor: "#fff6ee", textColor: "#f89829" },
  pending: { label: "Pending", bgColor: "#fff6ee", textColor: "#f89829" },
  pending_quote: { label: "Pending Quote", bgColor: "#FFF8ED", textColor: "#C8972E" },
  quotes_ready: { label: "Quotes Ready", bgColor: "#E3F0FF", textColor: "#2F6DCC" },
  pending_customer_acceptance: { label: "Action needed", bgColor: "#FFF6E5", textColor: "#C8972E" },
  confirmed: { label: "Confirmed", bgColor: "#e8f5e9", textColor: "#4CAF50" },
  in_progress: { label: "In Progress", bgColor: "#E0E7FF", textColor: "#4F46E5" },
  completed: { label: "Completed", bgColor: "#f0fcf5", textColor: "#60d17e" },
  cancelled: { label: "Cancelled", bgColor: "#FEE2E2", textColor: "#DC2626" },
  delayed: { label: "Delayed", bgColor: "#FEF3C7", textColor: "#D97706" },
  no_show: { label: "No-show", bgColor: "#FEE2E2", textColor: "#DC2626" },
};

// ============================================================================
// ACTIVITY-LOG TYPES (mirrors convex/booking_activity.ts ActivityEvent union)
// ============================================================================

type ActivityActor = {
  userId: Id<"users"> | null;
  label: string;
};

type ActivityEvent =
  | {
      type: "booking_created";
      at: number;
      actor: ActivityActor;
      data: {
        quotedSetPriceCents: number | null;
        quotedBreakdown: {
          parts_cents: number;
          labor_cents: number;
          tax_cents: number;
          service_fee_cents: number;
        } | null;
        disclosedRangeLowCents: number | null;
        disclosedRangeHighCents: number | null;
        pricedPartsSnapshot: Array<{
          part_name: string;
          oem_number: string;
          quantity: number;
          unit_price_cents: number;
          line_total_cents: number;
        }> | null;
        services: string[];
      };
    }
  | {
      type: "status_change";
      at: number;
      actor: ActivityActor;
      data: { from: string | null; to: string; reason: string | null };
    }
  | {
      type: "estimate_submitted";
      at: number;
      actor: ActivityActor;
      data: {
        cycle: string;
        approvalId: string;
        totalCents: number;
        partsSubtotalCents: number | null;
        laborCents: number | null;
        taxCents: number | null;
        serviceFeeCents: number | null;
        priorCeilingCents: number;
        partsSnapshot: Array<{
          part_name?: string;
          oem_number?: string;
          quantity?: number;
          cost?: number;
        }>;
        notes: string | null;
        slaExpiresAtMs: number | null;
        autoApprovedInRange: boolean;
      };
    }
  | {
      type: "estimate_decision";
      at: number;
      actor: ActivityActor;
      data: {
        cycle: string;
        approvalId: string;
        decision: string;
        totalCents: number;
        ceilingAfterDecisionCents: number | null;
      };
    }
  | {
      type: "part_edit";
      at: number;
      actor: ActivityActor;
      data: {
        editType:
          | "added"
          | "removed"
          | "price"
          | "quantity"
          | "supplied_by"
          | "swap"
          | "not_used";
        partKey: string;
        partName: string | null;
        oemNumber: string | null;
        oldValue: string | null;
        newValue: string | null;
      };
    };

// ============================================================================
// TYPES
// ============================================================================

export interface BookingDetailsSheetRef {
  open: (booking: Booking) => void;
  close: () => void;
}

interface BookingDetailsSheetProps {
  /** Header phrasing used in the mid view ("Upcoming", "In progress", etc.). */
  relativeTime?: string;
  // TODO(convex): expose mechanic rating
  mechanicRating?: number;
  // TODO(convex): expose shop address/hours/rating from shops table
  shopAddress?: string;
  shopPhone?: string;
  shopHoursLabel?: string;
  shopRating?: { score: number; count: number };
  // TODO(convex): service description + duration from services table
  serviceDescription?: string;
  serviceDurationMinutes?: number;
  // TODO(convex): vehicle mileage (vehicles table)
  vehicleMileage?: number;
  // TODO(convex): stage history (requested/confirmed/in_progress timestamps)
  statusHistory?: Array<{ stage: BookingStatus; timestamp: number }>;
  /** Fires after the sheet finishes closing. Lets parents track open
   *  state for things like hiding the tab bar / dimming the screen. */
  onClose?: () => void;
  /** Fires immediately after open() is called. Symmetric with onClose. */
  onOpen?: () => void;
}

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BookingDetailsSheet = forwardRef<BookingDetailsSheetRef, BookingDetailsSheetProps>(
  (props, ref) => {
    const {
      relativeTime = "Upcoming",
      mechanicRating,
      shopAddress,
      shopPhone,
      shopHoursLabel,
      shopRating,
      serviceDescription,
      serviceDurationMinutes,
      vehicleMileage,
      statusHistory,
      onOpen,
      onClose,
    } = props;

    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();
    const [booking, setBooking] = useState<Booking | null>(null);
    // 0 = mid (default on open), 1 = full. Peek snap is gone — drag below mid dismisses.
    const [detentJs, setDetentJs] = useState<0 | 1>(0);

    // Sheet height so that at full snap the sheet spans from below the status bar
    // all the way down to the screen bottom (full snap touches the edge).
    const FULL_HEIGHT = useMemo(
      () => screenHeight - Math.max(insets.top, 12) - 8,
      [insets.top, screenHeight],
    );

    const H_MED = useMemo(() => {
      const viewportHeight = screenHeight || FALLBACK_SCREEN_HEIGHT;
      const target = Math.max(
        viewportHeight * 0.66,
        Math.min(viewportHeight * 0.76, 640),
      );
      return Math.min(target, FULL_HEIGHT);
    }, [FULL_HEIGHT, screenHeight]);
    const H_FULL = FULL_HEIGHT;

    const sheetHeight = useSharedValue(0);
    const startHeight = useSharedValue(0);

    const rescheduleSheetRef = useRef<RescheduleSheetRef>(null);
    const chatSheetRef = useRef<MechanicChatSheetRef>(null);

    const handleRequestReschedule = useCallback(
      (bookingId: string, date: string, time: string) => {
        rescheduleSheetRef.current?.open(bookingId, { date, time });
      },
      [],
    );

    const handleOpenChat = useCallback(() => {
      if (!booking) return;
      chatSheetRef.current?.open({
        bookingId: booking.id,
        mechanicName: booking.mechanicName,
        shopName: booking.shopName,
        mechanicImage: booking.mechanicImage,
      });
    }, [booking]);

    // Live shop lookup — pulls address + phone so the Directions /
    // Contact buttons in the mid view work without each caller
    // pre-fetching the shop. Skipped when the booking has no shopId
    // (e.g., pending_quote rows before a shop accepts).
    const shopDoc = useQuery(
      api.shops.getById,
      booking?.shopId
        ? { id: booking.shopId as Id<"shops"> }
        : "skip",
    );

    const bookingDetail = useQuery(
      api.bookings.getBookingByIdForCustomer,
      booking?.id ? { bookingId: booking.id as Id<"bookings"> } : "skip",
    );

    // Granular event log (booking_created / status_change / estimate_submitted
    // / estimate_decision / part_edit) — surfaced below the StatusTimeline so
    // the customer can audit what they agreed to and why a charge changed.
    const activityLog = useQuery(
      (api as any).booking_activity.getBookingActivityLog,
      booking?.id ? { bookingId: booking.id as Id<"bookings"> } : "skip",
    ) as ActivityEvent[] | undefined;

    const liveStatusHistory = useMemo(() => {
      if (!bookingDetail?.statusHistory) return undefined;
      return bookingDetail.statusHistory.map((h: { status: string; changedAt: number }) => ({
        stage: h.status as BookingStatus,
        timestamp: h.changedAt,
      }));
    }, [bookingDetail?.statusHistory]);

    const liveMonitor = bookingDetail?.lateMonitor ?? null;
    const resolvedShopAddress = useMemo(() => {
      if (shopAddress) return shopAddress;
      if (!shopDoc) return undefined;
      const parts = [
        (shopDoc as any).address,
        (shopDoc as any).city,
        (shopDoc as any).state,
        (shopDoc as any).zip,
      ].filter((p) => typeof p === "string" && p.trim().length > 0);
      return parts.length > 0 ? parts.join(", ") : undefined;
    }, [shopAddress, shopDoc]);
    const resolvedShopPhone = shopPhone ?? ((shopDoc as any)?.phone ?? undefined);

    // Crossfade opacities for the two content layers (mid + full).
    const midOpacity = useSharedValue(1);
    const fullOpacity = useSharedValue(0);

    const open = useCallback((b: Booking) => {
      setBooking(b);
      setDetentJs(0);
      onOpen?.();
    }, [onOpen]);

    const close = useCallback(() => {
      sheetHeight.value = withTiming(0, { duration: 260 });
      setTimeout(() => {
        setBooking(null);
        onClose?.();
      }, 280);
    }, [sheetHeight, onClose]);

    const handleConfirmReschedule = useCallback(
      (bookingId: string, newDate: string, newTime: string) => {
        useBookingStore.getState().rescheduleBooking(bookingId, newDate, newTime);
        // Close the detail sheet so the updated booking is immediately visible in the list.
        close();
      },
      [close],
    );

    useImperativeHandle(ref, () => ({ open, close }));

    // Enter animation: grow from 0 straight to MID when booking is first set.
    useEffect(() => {
      if (booking) {
        sheetHeight.value = 0;
        midOpacity.value = 1;
        fullOpacity.value = 0;
        const id = requestAnimationFrame(() => {
          sheetHeight.value = withTiming(H_MED, { duration: 420 });
        });
        return () => cancelAnimationFrame(id);
      }
    }, [booking, H_MED, sheetHeight, midOpacity, fullOpacity]);

    // Derive detent index from sheetHeight and bump JS state on threshold cross.
    // Only two detents now: 0 = mid, 1 = full.
    useAnimatedReaction(
      () => sheetHeight.value,
      (current, previous) => {
        if (previous == null) return;
        const mid12 = (H_MED + H_FULL) / 2;
        const next = current < mid12 ? 0 : 1;
        const prev = previous < mid12 ? 0 : 1;
        if (next !== prev) {
          runOnJS(setDetentJs)(next as 0 | 1);
        }
      },
      [H_MED, H_FULL],
    );

    // Crossfade on detent change: fade-out current 150ms, fade-in new 150ms with 50ms overlap.
    useEffect(() => {
      const layers = [midOpacity, fullOpacity];
      layers.forEach((o, i) => {
        if (i === detentJs) {
          o.value = withDelay(50, withTiming(1, { duration: 150 }));
        } else {
          o.value = withTiming(0, { duration: 150 });
        }
      });
    }, [detentJs, midOpacity, fullOpacity]);

    // Pan gesture: drag handle up to grow, down to shrink/dismiss.
    const dragGesture = useMemo(
      () =>
        Gesture.Pan()
          .onBegin(() => {
            startHeight.value = sheetHeight.value;
          })
          .onUpdate((e) => {
            const next = startHeight.value - e.translationY;
            sheetHeight.value = Math.max(0, Math.min(H_FULL + 20, next));
          })
          .onEnd((e) => {
            const h = sheetHeight.value;
            const vUp = -e.velocityY;

            // Drag down fast near MED or drag below MED by overshoot → dismiss.
            if (vUp < -FLING_VELOCITY && h < H_MED + 40) {
              runOnJS(close)();
              return;
            }
            if (h < H_MED - DISMISS_OVERSHOOT) {
              runOnJS(close)();
              return;
            }

            // Snap targets: only MED and FULL.
            let target: number;
            if (vUp > FLING_VELOCITY) {
              target = H_FULL;
            } else if (vUp < -FLING_VELOCITY) {
              target = H_MED;
            } else {
              target = Math.abs(H_FULL - h) < Math.abs(H_MED - h) ? H_FULL : H_MED;
            }
            sheetHeight.value = withTiming(target, { duration: 280 });
          }),
      [H_FULL, H_MED, close, sheetHeight, startHeight],
    );

    const sheetAnimStyle = useAnimatedStyle(() => {
      const progress = interpolate(
        sheetHeight.value,
        [H_MED, H_FULL],
        [0, 1],
        Extrapolation.CLAMP,
      );
      const sideInset = interpolate(progress, [0, 1], [SIDE_INSET_MAX, 0], Extrapolation.CLAMP);
      const bottomInset = interpolate(
        progress,
        [0, 0.85, 1],
        [FLOAT_BOTTOM, FLOAT_BOTTOM, 0],
        Extrapolation.CLAMP,
      );
      const bottomRadius = interpolate(
        progress,
        [0.85, 1],
        [CORNER_RADIUS, 0],
        Extrapolation.CLAMP,
      );
      return {
        left: sideInset,
        right: sideInset,
        bottom: bottomInset,
        height: sheetHeight.value,
        borderBottomLeftRadius: bottomRadius,
        borderBottomRightRadius: bottomRadius,
      };
    });

    const innerAnimStyle = useAnimatedStyle(() => {
      const progress = interpolate(
        sheetHeight.value,
        [H_MED, H_FULL],
        [0, 1],
        Extrapolation.CLAMP,
      );
      const bottomRadius = interpolate(
        progress,
        [0.85, 1],
        [CORNER_RADIUS, 0],
        Extrapolation.CLAMP,
      );
      return {
        borderBottomLeftRadius: bottomRadius,
        borderBottomRightRadius: bottomRadius,
      };
    });

    const midAnimStyle = useAnimatedStyle(() => ({ opacity: midOpacity.value }));
    const fullAnimStyle = useAnimatedStyle(() => ({ opacity: fullOpacity.value }));

    // Backdrop blur fades in as the sheet opens, fades out on close.
    const backdropAnimStyle = useAnimatedStyle(() => {
      const opacity = interpolate(
        sheetHeight.value,
        [0, H_MED],
        [0, 1],
        Extrapolation.CLAMP,
      );
      return { opacity };
    });

    if (!booking) return null;

    const statusConfig = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;

    // Wrap in a native <Modal> so the sheet renders above the global
    // bottom tab bar (matches the membership-page bottom-sheet pattern).
    return (
      <Modal
        visible={!!booking}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={close}
      >
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {/* Blur backdrop — fades in as sheet opens, tap to dismiss */}
        <Animated.View style={[StyleSheet.absoluteFill, backdropAnimStyle]} pointerEvents="auto">
          <Pressable style={StyleSheet.absoluteFill} onPress={close}>
            <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.backdropTint} />
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.sheetShadow, sheetAnimStyle]}>
          <Animated.View style={[styles.sheetInner, innerAnimStyle]}>
            {/* Grabber always at top, drag-to-resize */}
            <GestureDetector gesture={dragGesture}>
              <View style={styles.dragRegion}>
                <View style={styles.handle} />
              </View>
            </GestureDetector>

            {/* Two stacked content layers, crossfaded on detent change */}
            <View style={styles.contentStack}>
              <Animated.View
                style={[styles.contentLayer, midAnimStyle]}
                pointerEvents={detentJs === 0 ? "auto" : "none"}
              >
                <MidContent
                  booking={booking}
                  mechanicRating={mechanicRating}
                  statusConfig={statusConfig}
                  shopAddress={resolvedShopAddress}
                  shopPhone={resolvedShopPhone}
                  onClose={close}
                  onOpenChat={handleOpenChat}
                />
              </Animated.View>

              <Animated.View
                style={[styles.contentLayer, fullAnimStyle]}
                pointerEvents={detentJs === 1 ? "auto" : "none"}
              >
                <FullContent
                  booking={booking}
                  bookingDetail={bookingDetail}
                  serviceDescription={serviceDescription}
                  serviceDurationMinutes={serviceDurationMinutes}
                  vehicleMileage={vehicleMileage}
                  shopAddress={resolvedShopAddress}
                  shopHoursLabel={shopHoursLabel}
                  shopRating={shopRating}
                  statusHistory={liveStatusHistory ?? statusHistory}
                  liveMonitor={liveMonitor}
                  activityLog={activityLog}
                  onClose={close}
                  onRequestReschedule={handleRequestReschedule}
                  bottomPadding={insets.bottom + 60}
                />
              </Animated.View>
            </View>
          </Animated.View>
        </Animated.View>

        {/* Reschedule picker — renders above the sheet when opened */}
        <RescheduleSheet ref={rescheduleSheetRef} onConfirm={handleConfirmReschedule} />

        {/* Chat thread with the mechanic */}
        <MechanicChatSheet ref={chatSheetRef} />
      </View>
      </Modal>
    );
  },
);

BookingDetailsSheet.displayName = "BookingDetailsSheet";

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function SheetHeader({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.headerRow}>
      <Text size="2xl" weight="bold" color="#1A1A1A">
        Booking Details
      </Text>
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <X size={22} color="#8E8E93" />
      </TouchableOpacity>
    </View>
  );
}

interface MidContentProps {
  booking: Booking;
  mechanicRating?: number;
  statusConfig: { label: string; bgColor: string; textColor: string };
  shopAddress?: string;
  shopPhone?: string;
  onClose: () => void;
  onOpenChat: () => void;
}

function MidContent({
  booking,
  mechanicRating,
  statusConfig,
  shopAddress,
  shopPhone,
  onClose,
  onOpenChat,
}: MidContentProps) {
  const primaryActionLabel = "Message Mechanic";

  const handlePrimary = useCallback(() => {
    onOpenChat();
  }, [onOpenChat]);

  const handleDirections = useCallback(() => {
    if (shopAddress) openMapsForAddress(shopAddress);
  }, [shopAddress]);

  const handleContact = useCallback(() => {
    if (shopPhone) openPhone(shopPhone);
  }, [shopPhone]);

  const directionsDisabled = !shopAddress;
  const contactDisabled = !shopPhone;

  return (
    <ScrollView
      style={styles.midScroll}
      contentContainerStyle={styles.midContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Top block — pushed to top */}
      <View>
        <SheetHeader onClose={onClose} />

        <View style={styles.midStatusBlock}>
          <Text size="xl" weight="semiBold" color="#1A1A1A" style={styles.midStatusLeft}>
            {booking.date && booking.time
              ? `${booking.date} · ${booking.time}`
              : booking.date || booking.time || "Time TBD"}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: statusConfig.bgColor }]}>
            <Text weight="semiBold" size="sm" color={statusConfig.textColor}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <MechanicCard booking={booking} mechanicRating={mechanicRating} onMessage={onOpenChat} />

        {/* Details card — Service + Vehicle at a glance */}
        <View style={styles.detailsCard}>
          <View style={styles.detailsRow}>
            <View style={styles.detailsIconBox}>
              <Wrench size={18} color="#5299FE" />
            </View>
            <View style={styles.detailsText}>
              <Text size="xs" weight="medium" color="#8E8E93">
                SERVICE
              </Text>
              <Text size="md" weight="semiBold" color="#1A1A1A">
                {(booking.services ?? []).join(" · ") || "Service"}
              </Text>
            </View>
          </View>

          <View style={styles.detailsDivider} />

          <View style={styles.detailsRow}>
            <View style={styles.detailsIconBox}>
              <Car size={18} color="#5299FE" />
            </View>
            <View style={styles.detailsText}>
              <Text size="xs" weight="medium" color="#8E8E93">
                VEHICLE
              </Text>
              <Text size="md" weight="semiBold" color="#1A1A1A" numberOfLines={1}>
                {titleCase(booking.carModel)}
                {booking.carYear ? ` · ${booking.carYear}` : ""}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom block — pushed to bottom */}
      <View style={styles.midBottomBlock}>
        {/* Directions + Contact — mirrors the Order Confirmation card */}
        <View style={styles.midActionRow}>
          <TouchableOpacity
            style={[styles.midActionButton, directionsDisabled && styles.midActionButtonDisabled]}
            onPress={handleDirections}
            disabled={directionsDisabled}
            activeOpacity={0.7}
          >
            <Navigation
              size={16}
              color={directionsDisabled ? "#9CA3AF" : "#1A1A1A"}
            />
            <Text
              size="sm"
              weight="medium"
              color={directionsDisabled ? "#9CA3AF" : "#1A1A1A"}
            >
              Directions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.midActionButton, contactDisabled && styles.midActionButtonDisabled]}
            onPress={handleContact}
            disabled={contactDisabled}
            activeOpacity={0.7}
          >
            <Phone
              size={16}
              color={contactDisabled ? "#9CA3AF" : "#1A1A1A"}
            />
            <Text
              size="sm"
              weight="medium"
              color={contactDisabled ? "#9CA3AF" : "#1A1A1A"}
            >
              Contact
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handlePrimary} activeOpacity={0.85}>
          <Text size="md" weight="semiBold" color="#FFFFFF">
            {primaryActionLabel}
          </Text>
        </TouchableOpacity>

        <Text size="xs" weight="regular" color="#8E8E93" center style={styles.midHint}>
          Swipe up for full details
        </Text>
      </View>
    </ScrollView>
  );
}

function MechanicCard({
  booking,
  mechanicRating,
  onMessage,
}: {
  booking: Booking;
  mechanicRating?: number;
  onMessage: () => void;
}) {
  const handleCall = useCallback(() => {
    // TODO: call shop when phone number is exposed on Booking
    console.log("TODO: call shop", booking.id); // eslint-disable-line no-console
  }, [booking.id]);

  return (
    <View style={styles.mechanicCard}>
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["rgba(255,255,255,0.7)", "rgba(255,255,255,0.55)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.mechanicCardInner}>
        <View style={styles.mechanicAvatar}>
          {booking.mechanicImage ? (
            <Image source={{ uri: booking.mechanicImage }} style={styles.mechanicAvatarImage} />
          ) : (
            <User size={22} color="#9CA3AF" />
          )}
        </View>
        <View style={styles.mechanicBody}>
          <Text size="md" weight="semiBold" color="#1A1A1A">
            {booking.shopName}
          </Text>
          {/* Server falls back to shopName for `mechanicName` when no
              mechanic is assigned (e.g. accepted tire quotes). Only render
              the second line when it's actually a separate person. */}
          {booking.mechanicName && booking.mechanicName !== booking.shopName ? (
            <Text size="xs" weight="regular" color="#8E8E93">
              {booking.mechanicName}
              {mechanicRating != null ? ` · ⭐ ${mechanicRating.toFixed(1)}` : ""}
            </Text>
          ) : mechanicRating != null ? (
            <Text size="xs" weight="regular" color="#8E8E93">
              ⭐ {mechanicRating.toFixed(1)}
            </Text>
          ) : null}
        </View>
        <View style={styles.mechanicActions}>
          <IconCircleButton onPress={handleCall} icon={<Phone size={16} color="#1A1A1A" />} />
          <IconCircleButton
            onPress={onMessage}
            icon={<MessageCircle size={16} color="#1A1A1A" />}
          />
        </View>
      </View>
    </View>
  );
}

function IconCircleButton({
  icon,
  onPress,
}: {
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.iconCircle} onPress={onPress} activeOpacity={0.7}>
      {icon}
    </TouchableOpacity>
  );
}

interface FullContentProps {
  booking: Booking;
  serviceDescription?: string;
  serviceDurationMinutes?: number;
  vehicleMileage?: number;
  shopAddress?: string;
  shopHoursLabel?: string;
  shopRating?: { score: number; count: number };
  statusHistory?: Array<{ stage: BookingStatus; timestamp: number }>;
  liveMonitor?: LateMonitor | null;
  activityLog?: ActivityEvent[];
  bookingDetail?: any;
  onClose: () => void;
  onRequestReschedule: (bookingId: string, date: string, time: string) => void;
  bottomPadding: number;
}

function FullContent({
  booking,
  bookingDetail,
  serviceDescription,
  serviceDurationMinutes,
  vehicleMileage,
  shopAddress,
  shopHoursLabel,
  shopRating,
  statusHistory,
  liveMonitor,
  activityLog,
  onClose,
  onRequestReschedule,
  bottomPadding,
}: FullContentProps) {
  const disputeSheetRef = useRef<FileDisputeSheetRef>(null);
  const toast = useToast();
  const handleCancel = useCallback(() => {
    Alert.alert(
      "Cancel booking?",
      "This action cannot be undone.",
      [
        { text: "Keep booking", style: "cancel" },
        {
          text: "Cancel booking",
          style: "destructive",
          onPress: () => {
            useBookingStore.getState().cancelBooking(booking.id);
            onClose();
            toast.success("Booking cancelled.", undefined, { icon: CalendarX });
          },
        },
      ],
      { cancelable: true },
    );
  }, [booking.id, onClose, toast]);

  const handleReschedule = useCallback(() => {
    // Pull the raw scheduledDate/scheduledTime from the local store so the
    // picker initializes on the booking's current slot.
    const local = useBookingStore.getState().getBookingById(booking.id);
    onRequestReschedule(booking.id, local?.scheduledDate ?? "", local?.scheduledTime ?? "");
  }, [booking.id, onRequestReschedule]);

  const handleAddToCalendar = useCallback(async () => {
    const date = bookingDetail?.scheduledDate;
    const time = bookingDetail?.scheduledTime ?? booking.time;
    if (!date || !time) {
      toast.warning("Booking details are still loading.");
      return;
    }

    const eventDetails = buildBookingCalendarEvent({
      shopName: booking.shopName,
      serviceNames: bookingDetail?.serviceNames ?? booking.services,
      date,
      time,
      location: shopAddress,
      mechanicName: booking.mechanicName,
      bookingReference: formatBookingReference(booking.id),
      vehicleDisplay: [booking.carYear, booking.carModel].filter(Boolean).join(" "),
      durationMinutes: serviceDurationMinutes,
    });
    if (!eventDetails) {
      toast.warning("Couldn't read the appointment time.");
      return;
    }

    try {
      await Calendar.createEventInCalendarAsync(
        eventDetails,
        Platform.OS === "android" ? { startNewActivityTask: false } : undefined,
      );
    } catch (error) {
      console.error("[booking-details] add-to-calendar failed", error);
      toast.error("Couldn't add to your calendar.");
    }
  }, [
    booking.carModel,
    booking.carYear,
    booking.id,
    booking.mechanicName,
    booking.services,
    booking.shopName,
    booking.time,
    bookingDetail?.scheduledDate,
    bookingDetail?.scheduledTime,
    bookingDetail?.serviceNames,
    serviceDurationMinutes,
    shopAddress,
    toast,
  ]);

  const primaryService = booking.services[0] ?? "Service";

  return (
    <View style={styles.fullContainer}>
      <SheetHeader onClose={onClose} />
      <ScrollView
        contentContainerStyle={[styles.fullScroll, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* APPROVAL BANNER — surfaces when an out-of-range estimate is
            waiting on the customer's decision. */}
        <ApprovalBanner
          bookingId={booking.id as any}
          paymentApprovalState={booking.paymentApprovalState}
        />

        {/* STATUS TIMELINE */}
        <View style={styles.section}>
          <SectionHeader label="Status" />
          <StatusTimeline currentStatus={booking.status} history={statusHistory} />
        </View>

        {/* ACTIVITY TIMELINE — granular event log: quote, estimates, your
            decisions, and any part changes the mechanic made. Each row is
            tap-to-expand for full breakdown. */}
        {activityLog && activityLog.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader label="Activity" />
            <ActivityTimeline events={activityLog} customerUserId={bookingDetail?.userId ?? null} />
          </View>
        ) : null}

        {/* ARRIVAL TRACKING */}
        {liveMonitor && (
          liveMonitor.pushEnqueuedAtMs ||
          liveMonitor.smsEnqueuedAtMs ||
          liveMonitor.frontdeskEnqueuedAtMs ||
          liveMonitor.customerAcknowledgedAtMs
        ) ? (
          <View style={styles.section}>
            <SectionHeader label="Arrival Tracking" />
            <ArrivalTrackingTimeline monitor={liveMonitor} />
          </View>
        ) : null}

        {/* SERVICE */}
        <View style={styles.section}>
          <SectionHeader label="Service" />
          <Text size="lg" weight="semiBold" color="#1A1A1A">
            {primaryService}
          </Text>
          {serviceDescription ? (
            <Text size="sm" weight="regular" color="#3C3C43" style={styles.serviceDescription}>
              {serviceDescription}
            </Text>
          ) : null}
          {serviceDurationMinutes != null ? (
            <Text size="xs" weight="regular" color="#8E8E93" style={styles.serviceDuration}>
              ⏱ ~{serviceDurationMinutes} minutes
            </Text>
          ) : null}
          {booking.services.length > 1 ? (
            <View style={styles.extraServices}>
              {booking.services.slice(1).map((s, i) => (
                <Text key={i} size="sm" weight="regular" color="#3C3C43">
                  · {s}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* VEHICLE */}
        <View style={styles.section}>
          <SectionHeader label="Vehicle" />
          <View style={styles.vehicleRow}>
            <View style={styles.vehicleThumb}>
              {booking.makeLogoUrl?.trim() ? (
                <Image
                  source={{ uri: booking.makeLogoUrl }}
                  style={styles.vehicleThumbImage}
                  resizeMode="contain"
                />
              ) : (
                <Image
                  source={require("@/assets/images/covered-car.png")}
                  style={{ width: 40, height: 26 }}
                  resizeMode="contain"
                />
              )}
            </View>
            <View style={styles.vehicleInfo}>
              <Text size="md" weight="semiBold" color="#1A1A1A">
                {titleCase(booking.carModel)}
              </Text>
              <Text size="xs" weight="regular" color="#8E8E93">
                {booking.carYear}
                {vehicleMileage != null ? ` · ${vehicleMileage.toLocaleString()} miles` : ""}
                {booking.licensePlate ? ` · ${booking.licensePlate}` : ""}
              </Text>
            </View>
          </View>
        </View>

        {/* SHOP */}
        <View style={styles.section}>
          <SectionHeader label="Shop" />
          <Text size="md" weight="semiBold" color="#1A1A1A">
            {booking.shopName}
          </Text>
          {shopAddress ? (
            <Text size="sm" weight="regular" color="#3C3C43" style={styles.shopLine}>
              {shopAddress}
            </Text>
          ) : null}
          {shopHoursLabel ? (
            <Text size="xs" weight="regular" color="#10B981" style={styles.shopLine}>
              {shopHoursLabel}
            </Text>
          ) : null}
          {shopRating ? (
            <Text size="xs" weight="regular" color="#8E8E93" style={styles.shopLine}>
              ⭐ {shopRating.score.toFixed(1)} ({shopRating.count.toLocaleString()} reviews)
            </Text>
          ) : null}
        </View>

        {/* PAYMENT */}
        <View style={styles.section}>
          <SectionHeader label="Payment" />
          {(() => {
            // Pre-Job Approval flow: render based on lifecycle stage.
            //   - captured → PaymentBreakdown (3-row lifecycle + itemized
            //     parts + dispute CTA)
            //   - mechanic submitted an in-range set price → collapse the
            //     band to that single number (the customer's contract is
            //     locked once it lands inside the disclosed range)
            //   - disclosed range present → show range pair
            //   - legacy → show singular total_cost
            const isCaptured = booking.paymentApprovalState === "captured";
            const hasRange =
              booking.disclosedRangeLowCents != null &&
              booking.disclosedRangeHighCents != null;
            const mechanicSetPriceCents = bookingDetail?.mechanicSetPriceCents ?? null;
            const isMechanicPriceInRange =
              mechanicSetPriceCents != null &&
              hasRange &&
              mechanicSetPriceCents >= (booking.disclosedRangeLowCents ?? 0) &&
              mechanicSetPriceCents <= (booking.disclosedRangeHighCents ?? Number.POSITIVE_INFINITY);
            if (isCaptured) {
              return (
                <>
                  <PaymentBreakdown
                    bookingId={booking.id}
                    paymentApprovalState={booking.paymentApprovalState}
                    holdAmountCents={bookingDetail?.holdAmountCents ?? null}
                    mechanicSetPriceCents={bookingDetail?.mechanicSetPriceCents ?? null}
                    finalCaptureAmountCents={
                      bookingDetail?.finalCaptureAmountCents ??
                      booking.finalCaptureAmountCents ??
                      null
                    }
                    finalPartsUsedAtCapture={bookingDetail?.finalPartsUsedAtCapture ?? null}
                    capturedAtMs={bookingDetail?.capturedAtMs ?? null}
                    onFileDispute={() => disputeSheetRef.current?.open(booking.id)}
                  />
                  <ReceiptViewer bookingId={booking.id} />
                </>
              );
            }
            if (isMechanicPriceInRange && mechanicSetPriceCents != null) {
              // Mechanic completed pre-job and submitted a price that
              // landed inside the disclosed range — that becomes the
              // single contract value the customer pays. If the set price
              // ever falls outside the range we keep the range here (it
              // needs the customer's explicit approval before collapsing).
              return (
                <View style={styles.paymentRow}>
                  <Text size="md" weight="regular" color="#1A1A1A">
                    Estimated total
                  </Text>
                  <Text size="md" weight="bold" color="#1A1A1A">
                    {formatCents(mechanicSetPriceCents)}
                  </Text>
                </View>
              );
            }
            if (hasRange) {
              // Single source of truth: recompute the customer-facing band
              // from labor/parts cost using the same helper Review & Pay
              // uses, so the "Estimated total" here matches the range the
              // customer saw at checkout. Snapshotted cents on the booking
              // row are ignored — old bookings stored a collapsed value
              // before booking_quotes.ts learned to fall back to ±25%.
              const laborCost = bookingDetail?.laborCost ?? null;
              const partsCost = bookingDetail?.partsCost ?? null;
              if (laborCost != null && partsCost != null) {
                const range = deriveDisclosedRange({
                  laborCost,
                  partsCost,
                  state: bookingDetail?.shopState ?? null,
                  zip: bookingDetail?.shopZip ?? null,
                });
                return (
                  <View style={styles.paymentRow}>
                    <Text size="md" weight="regular" color="#1A1A1A">
                      Estimated total
                    </Text>
                    <Text size="md" weight="bold" color="#1A1A1A">
                      {range.formatted}
                    </Text>
                  </View>
                );
              }
            }
            // Legacy fallback (no disclosed_range stored on the row yet).
            // Recompute the ±25% band from labor+parts so the customer
            // still sees a range until the mechanic submits a set price —
            // never collapse to a single `totalCost` here.
            const legacyLabor = bookingDetail?.laborCost ?? null;
            const legacyParts = bookingDetail?.partsCost ?? null;
            if (legacyLabor != null && legacyParts != null && (legacyLabor + legacyParts) > 0) {
              const range = deriveDisclosedRange({
                laborCost: legacyLabor,
                partsCost: legacyParts,
                state: bookingDetail?.shopState ?? null,
                zip: bookingDetail?.shopZip ?? null,
              });
              return (
                <View style={styles.paymentRow}>
                  <Text size="md" weight="regular" color="#1A1A1A">
                    Estimated total
                  </Text>
                  <Text size="md" weight="bold" color="#1A1A1A">
                    {range.formatted}
                  </Text>
                </View>
              );
            }
            return (
              <View style={styles.paymentRow}>
                <Text size="md" weight="regular" color="#1A1A1A">
                  Estimated total
                </Text>
                <Text size="md" weight="regular" color="#8E8E93" style={styles.paymentPending}>
                  Pending confirmation
                </Text>
              </View>
            );
          })()}
        </View>

        {/* Dispute sheet — rendered inline so it overlays this view. Opens
            from PaymentBreakdown's "Something wrong with this charge?" CTA. */}
        <FileDisputeSheet ref={disputeSheetRef} />

        {/* SECONDARY ACTIONS */}
        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.rescheduleButton} onPress={handleReschedule} activeOpacity={0.85}>
            <Text size="md" weight="semiBold" color="#FFFFFF">
              Reschedule
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={handleAddToCalendar}
            activeOpacity={0.7}
          >
            <Text size="md" weight="medium" color="#1A1A1A">
              Add to Calendar
            </Text>
          </TouchableOpacity>
        </View>

        {/* CANCEL */}
        <View style={styles.cancelWrapper}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.7}>
            <Text size="md" weight="medium" color="#FF3B30">
              Cancel Booking
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Text size="xs" weight="bold" color="#8E8E93" style={styles.sectionHeaderText}>
      {label.toUpperCase()}
    </Text>
  );
}

function formatShortTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface LateMonitor {
  pushEnqueuedAtMs: number | null;
  smsEnqueuedAtMs: number | null;
  frontdeskEnqueuedAtMs: number | null;
  customerAcknowledgedAtMs: number | null;
}

function ArrivalTrackingTimeline({ monitor }: { monitor: LateMonitor }) {
  const events: Array<{ ts: number; label: string; icon: "bell" | "car" }> = [];

  const notifTs =
    monitor.pushEnqueuedAtMs ?? monitor.smsEnqueuedAtMs ?? monitor.frontdeskEnqueuedAtMs;
  if (notifTs) events.push({ ts: notifTs, label: "Late notification sent", icon: "bell" });
  if (monitor.customerAcknowledgedAtMs)
    events.push({ ts: monitor.customerAcknowledgedAtMs, label: "On my way", icon: "car" });
  events.sort((a, b) => a.ts - b.ts);

  return (
    <View style={styles.timeline}>
      {events.map((event, idx) => {
        const isLast = idx === events.length - 1;
        const IconComponent = event.icon === "bell" ? Bell : Car;
        const iconColor = event.icon === "bell" ? "#D97706" : "#059669";
        const bgColor = event.icon === "bell" ? "#FFFBEB" : "#ECFDF5";

        return (
          <View key={idx} style={styles.timelineRow}>
            <View style={styles.timelineDotColumn}>
              <View style={[styles.arrivalDot, { backgroundColor: bgColor }]}>
                <IconComponent size={13} color={iconColor} strokeWidth={2.4} />
              </View>
              {!isLast ? <View style={styles.timelineLine} /> : null}
            </View>
            <View style={styles.timelineBody}>
              <Text size="sm" weight="semiBold" color="#1A1A1A">
                {event.label}
              </Text>
              <Text size="xs" weight="regular" color="#8E8E93">
                {formatShortTime(event.ts)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ============================================================================
// ACTIVITY TIMELINE — friendly, expandable event log for the customer
// ============================================================================

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function cycleAdjective(cycle: string): string {
  if (cycle === "pre_job") return "Initial";
  if (cycle === "mid_job") return "Mid-job";
  if (cycle === "post_job") return "Final";
  return cycle;
}

function statusFriendlyLabel(status: string | null | undefined): string {
  switch (status) {
    case "pending": return "Requested";
    case "pending_shop_acceptance": return "Awaiting shop";
    case "pending_customer_acceptance": return "Awaiting your approval";
    case "pending_quote": return "Awaiting quote";
    case "quotes_ready": return "Quotes ready";
    case "confirmed": return "Confirmed";
    case "vehicle_at_shop": return "Vehicle at shop";
    case "in_progress": return "In progress";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    case "no_show": return "No-show";
    case "delayed": return "Delayed";
    default: return status ?? "—";
  }
}

function activitySummary(ev: ActivityEvent, isCustomer: boolean): string {
  switch (ev.type) {
    case "booking_created": {
      // This sheet is rendered only in the customer app. Stay on the
      // agreed range until the mechanic confirms a set price — never
      // surface the system's quoted point to the customer (it's the
      // mechanic-facing target). `isCustomer` here means "did the customer
      // perform this event" and is unreliable for system-emitted
      // booking_created rows, so we don't gate on it.
      if (
        ev.data.disclosedRangeLowCents != null &&
        ev.data.disclosedRangeHighCents != null
      ) {
        return `Booking created — ${formatCents(ev.data.disclosedRangeLowCents)}–${formatCents(ev.data.disclosedRangeHighCents)}`;
      }
      return "Booking created";
    }
    case "status_change":
      return `${statusFriendlyLabel(ev.data.from)} → ${statusFriendlyLabel(ev.data.to)}`;
    case "estimate_submitted": {
      const adj = cycleAdjective(ev.data.cycle);
      const total = formatCents(ev.data.totalCents);
      if (ev.data.autoApprovedInRange) {
        return `${adj} estimate auto-approved within your agreed range — ${total}`;
      }
      return `Mechanic submitted ${adj.toLowerCase()} estimate — ${total}`;
    }
    case "estimate_decision": {
      const adj = cycleAdjective(ev.data.cycle).toLowerCase();
      switch (ev.data.decision) {
        case "approved":
          return isCustomer
            ? `You approved the ${adj} estimate`
            : `${ev.actor.label || "Customer"} approved the ${adj} estimate`;
        case "declined":
          return isCustomer
            ? `You declined the ${adj} estimate`
            : `${ev.actor.label || "Customer"} declined the ${adj} estimate`;
        case "withdrawn":
          return `Mechanic withdrew the ${adj} estimate`;
        case "sla_expired":
          return `${adj.charAt(0).toUpperCase() + adj.slice(1)} approval window expired`;
        case "auto_approved_within_range":
          return `${adj.charAt(0).toUpperCase() + adj.slice(1)} estimate auto-approved within range`;
        default:
          return `${adj} estimate · ${ev.data.decision}`;
      }
    }
    case "part_edit": {
      const noun = ev.data.partName || ev.data.oemNumber || "a part";
      switch (ev.data.editType) {
        case "added": return `Mechanic added ${noun}`;
        case "removed": return `Mechanic removed ${noun}`;
        case "price": return `Mechanic changed price of ${noun}`;
        case "quantity": return `Mechanic changed quantity of ${noun}`;
        case "supplied_by": return `Mechanic changed supplier of ${noun}`;
        case "swap": return `Mechanic swapped ${noun}`;
        case "not_used": return `Mechanic marked ${noun} as not used`;
        default: return `Mechanic adjusted ${noun}`;
      }
    }
  }
}

// Cohesive timeline palette: anchored on the brand blue for the primary
// "created" moment, with restrained semantic color (green/amber/red, drawn
// from the app's SemanticColors tokens) reserved only for events that
// genuinely carry weight. Everything routine stays a calm neutral so the
// timeline reads as one designed system, not a rainbow of alerts.
function activityIcon(ev: ActivityEvent): { Icon: any; bg: string; fg: string } {
  switch (ev.type) {
    case "booking_created":
      return { Icon: FileText, bg: "rgba(82,153,254,0.12)", fg: "#5299FE" };
    case "status_change":
      return { Icon: ArrowRight, bg: "#F2F2F7", fg: "#8E8E93" };
    case "estimate_submitted":
      return { Icon: ReceiptText, bg: "#FFFBEB", fg: "#D97706" };
    case "estimate_decision": {
      const d = ev.data.decision;
      if (d === "approved" || d === "auto_approved_within_range") {
        return { Icon: Check, bg: "#ECFDF5", fg: "#059669" };
      }
      return { Icon: X, bg: "#FEF2F2", fg: "#DC2626" };
    }
    case "part_edit":
      return { Icon: Wrench, bg: "#F2F2F7", fg: "#8E8E93" };
  }
}

function ActivityRow({
  event,
  isCustomer,
  isLast,
}: {
  event: ActivityEvent;
  isCustomer: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { Icon, bg, fg } = activityIcon(event);
  const summary = activitySummary(event, isCustomer);
  const hasDetail =
    event.type === "booking_created" ||
    event.type === "estimate_submitted" ||
    event.type === "estimate_decision" ||
    event.type === "part_edit";

  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineDotColumn}>
        <View style={[styles.arrivalDot, { backgroundColor: bg }]}>
          <Icon size={13} color={fg} strokeWidth={2.4} />
        </View>
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineBody}>
        <TouchableOpacity
          onPress={hasDetail ? () => setExpanded((v) => !v) : undefined}
          disabled={!hasDetail}
          activeOpacity={hasDetail ? 0.6 : 1}
        >
          <View style={styles.activityHeaderRow}>
            <View style={styles.activityHeaderText}>
              <Text size="sm" weight="semiBold" color="#1A1A1A">
                {summary}
              </Text>
              <Text size="xs" weight="regular" color="#8E8E93">
                {formatShortTime(event.at)}
              </Text>
            </View>
            {hasDetail ? (
              <View style={styles.activityChevron}>
                {expanded ? (
                  <ChevronDown size={14} color="#8E8E93" />
                ) : (
                  <ChevronRight size={14} color="#8E8E93" />
                )}
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        {expanded && event.type === "booking_created" ? (
          <View style={styles.activityDetail}>
            {event.data.services.length > 0 ? (
              <Text size="xs" weight="regular" color="#3C3C43">
                {event.data.services.join(" · ")}
              </Text>
            ) : null}
            {/* Quoted Parts/Labor/Tax+Fee breakdown is the mechanic-facing
                target; never render it in the customer app. The "Agreed
                range" line below is what the customer is contracted to. */}
            {event.data.disclosedRangeLowCents != null &&
            event.data.disclosedRangeHighCents != null ? (
              <Text size="xs" weight="regular" color="#8E8E93" style={styles.activityDetailLine}>
                Agreed range {formatCents(event.data.disclosedRangeLowCents)}–
                {formatCents(event.data.disclosedRangeHighCents)}
              </Text>
            ) : null}
            {event.data.pricedPartsSnapshot && event.data.pricedPartsSnapshot.length > 0 ? (
              <View style={styles.activityPartsList}>
                {event.data.pricedPartsSnapshot.map((p, i) => (
                  <Text key={`${p.oem_number}-${i}`} size="xs" weight="regular" color="#3C3C43">
                    • {p.quantity}× {p.part_name} @ {formatCents(p.unit_price_cents)} ={" "}
                    {formatCents(p.line_total_cents)}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {expanded && event.type === "estimate_submitted" ? (
          <View style={styles.activityDetail}>
            <Text size="xs" weight="regular" color="#3C3C43">
              Total {formatCents(event.data.totalCents)}
            </Text>
            {(event.data.partsSubtotalCents != null ||
              event.data.laborCents != null ||
              event.data.taxCents != null ||
              event.data.serviceFeeCents != null) ? (
              <Text size="xs" weight="regular" color="#3C3C43" style={styles.activityDetailLine}>
                Parts {formatCents(event.data.partsSubtotalCents)} · Labor{" "}
                {formatCents(event.data.laborCents)} · Tax {formatCents(event.data.taxCents)} · Fee{" "}
                {formatCents(event.data.serviceFeeCents)}
              </Text>
            ) : null}
            <Text size="xs" weight="regular" color="#8E8E93" style={styles.activityDetailLine}>
              Within agreed ceiling of {formatCents(event.data.priorCeilingCents)}
            </Text>
            {event.data.slaExpiresAtMs && !event.data.autoApprovedInRange ? (
              <Text size="xs" weight="regular" color="#D97706" style={styles.activityDetailLine}>
                Please respond by {formatShortTime(event.data.slaExpiresAtMs)}
              </Text>
            ) : null}
            {event.actor.label ? (
              <Text size="xs" weight="regular" color="#8E8E93" style={styles.activityDetailLine}>
                Submitted by {event.actor.label}
              </Text>
            ) : null}
            {event.data.notes ? (
              <Text size="xs" weight="regular" color="#3C3C43" style={styles.activityDetailLine}>
                “{event.data.notes}”
              </Text>
            ) : null}
          </View>
        ) : null}

        {expanded && event.type === "estimate_decision" ? (
          <View style={styles.activityDetail}>
            <Text size="xs" weight="regular" color="#3C3C43">
              At {formatCents(event.data.totalCents)}
            </Text>
            {event.data.ceilingAfterDecisionCents != null ? (
              <Text size="xs" weight="regular" color="#8E8E93" style={styles.activityDetailLine}>
                New ceiling {formatCents(event.data.ceilingAfterDecisionCents)}
              </Text>
            ) : null}
            {event.actor.label && event.actor.label !== "system" ? (
              <Text size="xs" weight="regular" color="#8E8E93" style={styles.activityDetailLine}>
                by {isCustomer && event.actor.userId ? "you" : event.actor.label}
              </Text>
            ) : null}
          </View>
        ) : null}

        {expanded && event.type === "part_edit" ? (
          <View style={styles.activityDetail}>
            {event.data.oldValue || event.data.newValue ? (
              <Text size="xs" weight="regular" color="#3C3C43">
                {event.data.oldValue ?? "—"} → {event.data.newValue ?? "—"}
              </Text>
            ) : null}
            {event.data.oemNumber ? (
              <Text size="xs" weight="regular" color="#8E8E93" style={styles.activityDetailLine}>
                OEM {event.data.oemNumber}
              </Text>
            ) : null}
            {event.actor.label ? (
              <Text size="xs" weight="regular" color="#8E8E93" style={styles.activityDetailLine}>
                by {event.actor.label}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ActivityTimeline({
  events,
  customerUserId,
}: {
  events: ActivityEvent[];
  customerUserId: string | null;
}) {
  return (
    <View style={styles.timeline}>
      {events.map((event, idx) => {
        const isCustomer =
          !!customerUserId &&
          event.actor.userId != null &&
          String(event.actor.userId) === String(customerUserId);
        return (
          <ActivityRow
            key={`${event.type}-${event.at}-${idx}`}
            event={event}
            isCustomer={isCustomer}
            isLast={idx === events.length - 1}
          />
        );
      })}
    </View>
  );
}

function StatusTimeline({
  currentStatus,
  history,
}: {
  currentStatus: BookingStatus;
  history?: Array<{ stage: BookingStatus; timestamp: number }>;
}) {
  const pulseOpacity = useSharedValue(0.35);
  useEffect(() => {
    pulseOpacity.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [pulseOpacity]);
  const pulseAnimStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  const stages: BookingStatus[] = ["pending", "confirmed", "in_progress", "completed"];
  const stageLabels: Partial<Record<BookingStatus, string>> = {
    pending_shop_acceptance: "Awaiting shop",
    pending: "Requested",
    pending_quote: "Awaiting Quote",
    pending_customer_acceptance: "Awaiting your approval",
    confirmed: "Confirmed",
    in_progress: "In Progress",
    completed: "Complete",
    cancelled: "Cancelled",
    delayed: "Delayed",
  };

  const currentIdx = stages.indexOf(currentStatus);
  const isCompletedStatus = currentStatus === "completed";

  function getTimestamp(stage: BookingStatus): string | null {
    if (!history) return null;
    const entry = history.find((h) => h.stage === stage);
    if (!entry) return null;
    return new Date(entry.timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <View style={styles.timeline}>
      {stages.map((stage, idx) => {
        const isCompleted = isCompletedStatus || currentIdx > idx;
        const isCurrent = !isCompletedStatus && currentIdx === idx;
        const isLast = idx === stages.length - 1;
        const timestamp = getTimestamp(stage);

        return (
          <View key={stage} style={styles.timelineRow}>
            <View style={styles.timelineDotColumn}>
              <View
                style={[
                  styles.timelineDot,
                  isCompleted && styles.timelineDotCompleted,
                  isCurrent && styles.timelineDotCurrent,
                ]}
              >
                {isCurrent ? (
                  <Animated.View style={[styles.timelinePulse, pulseAnimStyle]} />
                ) : null}
              </View>
              {!isLast ? (
                <View style={[styles.timelineLine, isCompleted && styles.timelineLineCompleted]} />
              ) : null}
            </View>
            <View style={styles.timelineBody}>
              <Text
                size="sm"
                weight={isCurrent ? "semiBold" : "medium"}
                color={isCompleted || isCurrent ? "#1A1A1A" : "#8E8E93"}
              >
                {stageLabels[stage] ?? ""}
              </Text>
              {timestamp ? (
                <Text size="xs" weight="regular" color="#8E8E93">
                  {timestamp}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  // Sheet chrome (unchanged)
  sheetShadow: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: CORNER_RADIUS,
    borderTopRightRadius: CORNER_RADIUS,
    borderBottomLeftRadius: CORNER_RADIUS,
    borderBottomRightRadius: CORNER_RADIUS,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetInner: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: CORNER_RADIUS,
    overflow: "hidden",
  },
  dragRegion: {
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },

  // Content stack + layers
  contentStack: {
    flex: 1,
    position: "relative",
  },
  contentLayer: {
    ...StyleSheet.absoluteFillObject,
  },

  // Shared header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },

  // Mid content
  midScroll: {
    flex: 1,
  },
  midContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  midBottomBlock: {
    marginTop: 8,
    gap: 0,
  },
  midActionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  midActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  midActionButtonDisabled: {
    backgroundColor: "#F9FAFB",
  },
  midStatusBlock: {
    marginTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  midStatusLeft: {
    flex: 1,
    gap: 4,
  },

  // Mechanic card (frosted)
  mechanicCard: {
    marginTop: 8,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  mechanicCardInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  mechanicAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  mechanicAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  mechanicBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  mechanicActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },

  // Details card (between mechanic card and primary button)
  detailsCard: {
    marginTop: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "#F9FAFB",
    paddingVertical: 8,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },
  detailsIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(82,153,254,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailsText: {
    flex: 1,
    gap: 2,
  },
  detailsDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.06)",
    marginHorizontal: 16,
  },

  // Primary button + hint
  primaryButton: {
    marginTop: 24,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },
  midHint: {
    marginTop: 12,
  },

  // Full content
  fullContainer: {
    flex: 1,
  },
  fullScroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  section: {
    marginTop: 24,
  },
  sectionHeaderText: {
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  serviceDescription: {
    marginTop: 6,
    lineHeight: 20,
  },
  serviceDuration: {
    marginTop: 6,
  },
  extraServices: {
    marginTop: 8,
    gap: 4,
  },

  // Timeline
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: "row",
    minHeight: 46,
  },
  timelineDotColumn: {
    width: 20,
    alignItems: "center",
    paddingTop: 4,
  },
  arrivalDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5E5EA",
    borderWidth: 2,
    borderColor: "#E5E5EA",
  },
  timelineDotCompleted: {
    backgroundColor: "#5299FE",
    borderColor: "#5299FE",
  },
  timelineDotCurrent: {
    backgroundColor: "#5299FE",
    borderColor: "rgba(82,153,254,0.3)",
    borderWidth: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  timelinePulse: {
    position: "absolute",
    top: -6,
    left: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(82,153,254,0.3)",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E5E5EA",
    marginVertical: 2,
  },
  timelineLineCompleted: {
    backgroundColor: "#5299FE",
  },
  timelineBody: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 14,
    gap: 2,
  },

  // Activity timeline (expandable rows)
  activityHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  activityHeaderText: {
    flex: 1,
    gap: 2,
  },
  activityChevron: {
    paddingTop: 2,
  },
  activityDetail: {
    marginTop: 6,
    paddingTop: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: "#E5E5EA",
  },
  activityDetailLine: {
    marginTop: 2,
  },
  activityPartsList: {
    marginTop: 4,
    gap: 2,
  },

  // Vehicle section
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  vehicleThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  vehicleThumbImage: {
    width: 48,
    height: 48,
  },
  vehicleInfo: {
    flex: 1,
    gap: 2,
  },

  // Shop section
  shopLine: {
    marginTop: 4,
  },

  // Payment
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentPending: {
    fontStyle: "italic",
  },

  // Secondary actions
  secondaryActions: {
    marginTop: 32,
    gap: 12,
  },
  outlineButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  rescheduleButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },

  // Cancel
  cancelWrapper: {
    marginTop: 24,
  },
  cancelButton: {
    height: 52,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
});
