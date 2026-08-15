/**
 * BookingsScreen
 *
 * PURPOSE: My Bookings screen with two tabs:
 *   - Bookings: pending / confirmed / in_progress service bookings
 *   - Quotes:   pending_quote + quotes_ready tire-quote bookings
 *
 * Per the May 2 2026 redesign, the previous Live Tracker tab was
 * collapsed into Bookings — every card carries its own segmented
 * progress bar (`BookingProgressBar`) at the top showing where the
 * booking sits in its lifecycle, so users can glance-track without
 * jumping tabs. History (completed + cancelled) lives at
 * Settings → My Garage → Booking History.
 *
 * USED IN: app/(main-tabs)/bookings/_layout.tsx
 *
 * OWNER: Waleed Mansour
 */
import { ProfileInitialsButton } from "@/components/home/ProfileInitialsButton";
import { BookingCard, type Booking } from "@/components/bookings/BookingCard";
import { PendingQuoteCard } from "@/components/bookings/PendingQuoteCard";
import { QuoteListSheet, type QuoteListSheetRef } from "@/components/bookings/QuoteListSheet";
import {
  RotorQuoteListSheet,
  type RotorQuoteListSheetRef,
} from "@/components/bookings/RotorQuoteListSheet";
import { BookingDetailsSheet, type BookingDetailsSheetRef } from "@/components/bookings/BookingDetailsSheet";
import { AvailabilityModal } from "@/components/booking/modals/AvailabilityModal";
import { ScrollDrivenGradientBackground, Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";
import { CustomerLateBanner } from "@/components/bookings/CustomerLateBanner";
import { RecommendedServicesContent } from "@/components/bookings/RecommendedServicesContent";
import { useBookingStore } from "@/stores/useBookingStore";
import { useBookingsBadgeStore } from "@/stores/useBookingsBadgeStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { api } from "@/convex/_generated/api";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { formatFeeCents } from "@/constants/bookingActionPolicy";
import { useToast } from "@/hooks/useToast";
import type { Id } from "@/convex/_generated/dataModel";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { Calendar, CalendarX, Check, ChevronRight, ListFilter, Star } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, PixelRatio, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ============================================================================
// TYPES
// ============================================================================

type TabType = "bookings" | "quotes" | "recommended";
const TAB_ORDER: TabType[] = ["bookings", "quotes", "recommended"];
const TAB_LABELS: Record<TabType, string> = {
  bookings: "Bookings",
  quotes: "Quotes",
  recommended: "Recommended",
};
const TAB_LABEL_MAX_SIZE = 14;
const TAB_LABEL_MIN_SIZE = 11;
const TAB_LABEL_LONGEST = "Recommended";
const TAB_LABEL_WIDTH_RATIO = 0.62;
const BOTTOM_NAV_SCROLL_CLEARANCE = 96;

function getTabLabelSize(width: number, fontScale: number): number {
  if (width <= 0) return TAB_LABEL_MAX_SIZE;
  const segmentWidth = (width - 6) / TAB_ORDER.length;
  const availableWidth = segmentWidth - 4;
  const fittedSize =
    availableWidth / (TAB_LABEL_LONGEST.length * TAB_LABEL_WIDTH_RATIO * fontScale);
  return Math.min(Math.max(fittedSize, TAB_LABEL_MIN_SIZE), TAB_LABEL_MAX_SIZE);
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  // historyBookings is still imported because handleViewDetails opens the
  // details sheet for *any* booking id we know about (incl. ones a user
  // navigated back from after viewing in Settings → Booking History).
  // `upcomingBookings` already includes any in-progress booking (no
  // dedicated Live Tracker tab anymore). `historyBookings` is kept here
  // because the details sheet supports opening any booking by id —
  // including ones the user reached via Settings → Booking History.
  const {
    upcomingBookings,
    quoteBookings,
    pendingReviewBookings,
    historyBookings,
    isLoading,
  } = useMyBookingsWithDetails();
  const router = useRouter();

  const { tab: tabParam, bookingId: bookingIdParam, rescheduleError } = useLocalSearchParams<{
    tab?: string;
    bookingId?: string;
    rescheduleError?: string;
  }>();
  const initialTab: TabType = TAB_ORDER.includes(tabParam as TabType)
    ? (tabParam as TabType)
    : "bookings";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [segmentedWidth, setSegmentedWidth] = useState(0);
  const fontScale = PixelRatio.getFontScale();
  const tabLabelSize = useMemo(
    () => getTabLabelSize(segmentedWidth, fontScale),
    [segmentedWidth, fontScale],
  );
  // If we land on the screen again with a new `tab` param (e.g. from the
  // tire flow completing), switch to the requested tab.
  useEffect(() => {
    if (tabParam && TAB_ORDER.includes(tabParam as TabType)) {
      setActiveTab(tabParam as TabType);
    }
  }, [tabParam]);

  // Mark the Bookings tab as seen whenever it gains focus — clears the
  // red badge on the bottom-nav Bookings icon. (Tied to focus instead of
  // mount so the badge resets even when the screen is already mounted
  // and the user just taps the tab.)
  const markBookingsSeen = useBookingsBadgeStore((s) => s.markSeen);
  useFocusEffect(
    useCallback(() => {
      markBookingsSeen();
    }, [markBookingsSeen]),
  );
  const [refreshing, setRefreshing] = useState(false);
  const detailsSheetRef = useRef<BookingDetailsSheetRef>(null);
  const vehiclePickerRef = useRef<FloatingSheetRef>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);


  // ── Vehicle filter ───────────────────────────────────────────────────────
  // Lets users scope the upcoming/quotes lists to a single car when their
  // garage gets noisy. `null` means "All Vehicles".
  const vehiclesRecord = useVehicleStore((s) => s.vehicles);
  const vehicleIds = useVehicleStore((s) => s.vehicleIds);
  const allVehicles = useMemo(
    () => vehicleIds.map((id) => vehiclesRecord[id]).filter(Boolean),
    [vehicleIds, vehiclesRecord],
  );
  const [filterVehicleId, setListFilterVehicleId] = useState<string | null>(null);
  const filterVehicle = filterVehicleId
    ? allVehicles.find((v) => v.id === filterVehicleId)
    : null;

  const matchesListFilter = useCallback(
    (b: Booking) => {
      if (!filterVehicle) return true;
      // Prefer VIN match — unambiguous, no name parsing. Both Convex and
      // Convex-backed bookings carry the originating VIN, so this
      // is the authoritative comparison whenever both sides have one.
      if (filterVehicle.vin && b.vin) {
        return b.vin.toUpperCase() === filterVehicle.vin.toUpperCase();
      }
      // Fallback: name+year. Used only when the chip's vehicle has no
      // VIN (rare — pre-Convex local vehicles). Prefix match because
      // Convex's `vehicleDisplay` includes trim while the chip vehicle
      // does not.
      const target = `${filterVehicle.make} ${filterVehicle.model}`.toLowerCase();
      const targetYear = String(filterVehicle.year);
      const carModelLower = b.carModel.toLowerCase();
      const modelMatches =
        carModelLower === target || carModelLower.startsWith(`${target} `);
      return modelMatches && b.carYear === targetYear;
    },
    [filterVehicle],
  );

  // Cancel: soft-deletes by flipping `status` to "cancelled". Convex
  // mutation handles server-backed bookings (idempotent —
  // `api.bookings.cancelBooking`); the local Zustand action handles
  // stale local IDs from older app builds. The card
  // moves to History on next query refresh because `isHistory` matches
  // status "cancelled".
  //
  // Important: we discriminate by id prefix, NOT by store membership.
  // `useBookingsFromConvex` (mounted in `(main-tabs)/_layout.tsx`)
  // hydrates every Convex booking into the local store, so a store hit
  // doesn't tell us anything. Legacy tire quote rows used the
  // `tire_quote_*` id format; real
  // Convex ids are base32 and never start with that prefix.
  const cancelLocalBooking = useBookingStore((s) => s.cancelBooking);
  const toast = useToast();
  const cancelConvexBooking = useMutationWithToast(api.bookings.cancelBooking, {
    success: ({ result }) => ({
      title:
        result && result.feeCents > 0
          ? `Booking cancelled — ${formatFeeCents(result.feeCents)} fee charged.`
          : "Booking cancelled.",
    }),
    successIcon: CalendarX,
    error: (ctx) => ({
      title: ctx.error.message || "Couldn't cancel this booking. Try again.",
    }),
  });
  const requestPickupConvex = useMutationWithToast(
    api.bookings.requestCancellationAtShop,
    {
      success: "Pickup request sent. The shop will confirm.",
      error: (ctx) => ({
        title: ctx.error.message || "Couldn't send your request. Try again.",
      }),
    },
  );
  useEffect(() => {
    if (typeof rescheduleError === "string" && rescheduleError.length > 0) {
      toast.error("Couldn't request reschedule.", rescheduleError);
    }
  }, [rescheduleError, toast]);
  const handleCancelBooking = useCallback(
    (bookingId: string, feeAcknowledgedCents?: number) => {
      const isLocalId = bookingId.startsWith("tire_quote_") || bookingId.startsWith("booking_");
      if (isLocalId) {
        cancelLocalBooking(bookingId);
        toast.success("Booking cancelled.", undefined, { icon: CalendarX });
      } else {
        void cancelConvexBooking({
          bookingId: bookingId as Id<"bookings">,
          feeAcknowledgedCents,
        });
      }
    },
    [cancelConvexBooking, cancelLocalBooking, toast],
  );
  const handleRequestPickup = useCallback(
    (bookingId: string) => {
      if (bookingId.startsWith("tire_quote_") || bookingId.startsWith("booking_")) {
        return;
      }
      void requestPickupConvex({ bookingId: bookingId as Id<"bookings"> });
    },
    [requestPickupConvex],
  );

  const bookings = (
    activeTab === "bookings" ? upcomingBookings : quoteBookings
  ).filter(matchesListFilter);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const allBookings = useMemo(
    () => [
      ...upcomingBookings,
      ...quoteBookings,
      ...historyBookings,
    ],
    [historyBookings, quoteBookings, upcomingBookings],
  );
  const handleViewDetails = (bookingId: string) => {
    const booking = allBookings.find((b) => b.id === bookingId);
    if (booking) {
      detailsSheetRef.current?.open(booking);
    }
  };

  // "Message shop" (in_progress / contact-shop paths) opens the details sheet,
  // which owns the mechanic chat entry — one hop to the conversation.
  const handleMessageShop = useCallback(
    (bookingId: string) => {
      const booking = allBookings.find((b) => b.id === bookingId);
      if (booking) detailsSheetRef.current?.open(booking);
    },
    [allBookings],
  );

  // Deep-link from AI chat's BookingCard: `/bookings?bookingId=<id>` opens
  // the detail sheet for the matching booking. The ref guard prevents the
  // sheet from re-opening every time the bookings list refetches.
  const openedBookingIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!bookingIdParam || isLoading) return;
    if (openedBookingIdRef.current === bookingIdParam) return;
    const booking = allBookings.find((b) => b.id === bookingIdParam);
    if (booking) {
      openedBookingIdRef.current = bookingIdParam;
      detailsSheetRef.current?.open(booking);
    }
  }, [bookingIdParam, isLoading, allBookings]);

  const quoteListSheetRef = useRef<QuoteListSheetRef>(null);
  const rotorQuoteListSheetRef = useRef<RotorQuoteListSheetRef>(null);
  const handleViewQuotes = (bookingId: string) => {
    const booking = allBookings.find((b) => b.id === bookingId);
    if (booking?.quoteType === "rotor") {
      rotorQuoteListSheetRef.current?.open(bookingId);
    } else {
      quoteListSheetRef.current?.open(bookingId);
    }
  };

  // Count of completed bookings still awaiting a review (scoped to the
  // active vehicle filter). Drives the circular Star button beside the
  // vehicle picker; the actual list + LeaveReviewSheet live on
  // /bookings/pending-reviews.
  const pendingReviewCount = useMemo(
    () => pendingReviewBookings.filter(matchesListFilter).length,
    [pendingReviewBookings, matchesListFilter],
  );
  const showPendingReviewsButton = activeTab === "bookings" && pendingReviewCount > 0;

  const pendingReviewLabel =
    pendingReviewCount === 1
      ? "1 service needs your review"
      : `${pendingReviewCount} services need your review`;

  // Names the newest unreviewed booking so the row says what is waiting, not
  // just how many. Respects the active vehicle filter, same as the count.
  // Service labels match CompletedBookingReviewCard on the destination screen
  // so the row and the screen it opens cannot disagree.
  const pendingReviewSubtitle = useMemo(() => {
    const first = pendingReviewBookings.filter(matchesListFilter)[0];
    if (!first) return "";
    const service = first.services.join(", ") || "Service";
    const base = first.shopName ? `${service} · ${first.shopName}` : service;
    const others = pendingReviewCount - 1;
    return others > 0 ? `${base}  +${others} more` : base;
  }, [pendingReviewBookings, matchesListFilter, pendingReviewCount]);

  const handleReschedule = useCallback(
    (bookingId?: string) => {
      if (!bookingId) return;
      const booking = allBookings.find((b) => b.id === bookingId);
      const isLocalId = bookingId.startsWith("tire_quote_") || bookingId.startsWith("booking_");
      if (!booking || isLocalId || !booking.shopId) {
        toast.warning("This booking can't be rescheduled from here.");
        return;
      }
      if (booking.vin) {
        selectVehicle(booking.vin.toUpperCase());
      }
      setRescheduleBooking(booking);
    },
    [allBookings, selectVehicle, toast],
  );

  const handleCloseRescheduleModal = useCallback(() => {
    setRescheduleBooking(null);
  }, []);

  const handleConfirmRescheduleSlot = useCallback(
    (_date: Date, _time: string, mechanicId: string | null) => {
      if (!rescheduleBooking) return;
      const routeId = mechanicId ?? rescheduleBooking.mechanicId ?? rescheduleBooking.shopId;
      if (!routeId) {
        toast.warning("Choose a mechanic before rescheduling.");
        return;
      }
      router.push({
        pathname: "/booking/mechanic/[id]/confirming",
        params: {
          id: routeId,
          mode: "reschedule",
          bookingDbId: rescheduleBooking.id,
        },
      });
    },
    [rescheduleBooking, router, toast],
  );

  const handleDownloadPdf = (bookingId: string) => {
    console.log("Download PDF for booking:", bookingId);
  };

  const handleToggleFavorite = (bookingId: string) => {
    console.log("Toggle favorite for booking:", bookingId);
  };

  return (
  <>
    <ScrollDrivenGradientBackground colors={["#5BA3D9", "#8FC4E8", "#d9e8f5"]}>
      {(scrollHandler) => (
        <View style={styles.container}>
          {/* Full Page Scroll - same as home page */}
          <Animated.ScrollView
            style={styles.scrollView}
            contentContainerStyle={{
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + BOTTOM_NAV_SCROLL_CLEARANCE,
            }}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
          >
            {/* Header — profile button left, title centered, mirrored
                spacer right so the title stays optically centered. */}
            <View style={styles.header}>
              <View style={styles.headerSide}>
                <ProfileInitialsButton />
              </View>
              <View style={styles.headerCenter}>
                <Text weight="bold" size="xl" color="#FFFFFF">
                  My Bookings
                </Text>
              </View>
              <View style={styles.headerSide} />
            </View>

            {/* Tab Switcher */}
            <View style={styles.segmentedWrapper}>
              <View
                style={styles.segmentedControl}
                accessibilityRole="tablist"
                onLayout={(event) => setSegmentedWidth(event.nativeEvent.layout.width)}
              >
                {TAB_ORDER.map((tab) => {
                  const isSelected = activeTab === tab;
                  return (
                    <Pressable
                      key={tab}
                      onPress={() => setActiveTab(tab)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isSelected }}
                      style={({ pressed }) => [
                        styles.segmentButton,
                        isSelected && styles.segmentButtonActive,
                        pressed && !isSelected && styles.segmentButtonPressed,
                      ]}
                    >
                      <Text
                        size={tabLabelSize}
                        weight="semiBold"
                        color="#FFFFFF"
                        numberOfLines={1}
                        allowFontScaling={false}
                        lineHeight={1.05}
                        style={styles.segmentLabel}
                      >
                        {TAB_LABELS[tab]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Vehicle picker. */}
            {allVehicles.length > 1 ? (
              <View style={styles.pickerRow}>
                {allVehicles.length > 1 ? (
                  <Pressable
                    onPress={() => {
                      vehiclePickerRef.current?.open();
                    }}
                    style={({ pressed }) => [
                      styles.pickerButton,
                      pressed && styles.pickerButtonPressed,
                    ]}
                  >
                    <View style={styles.pickerSide}>
                      {filterVehicle?.imageSource ? (
                        <Image
                          source={filterVehicle.imageSource}
                          style={styles.pickerThumb}
                          resizeMode="contain"
                        />
                      ) : (
                        <Image
                          source={require("@/assets/images/covered-car.png")}
                          style={styles.pickerCoveredCar}
                          resizeMode="contain"
                        />
                      )}
                    </View>
                    <Text
                      size="md"
                      weight="semiBold"
                      color="#1F2937"
                      style={styles.pickerLabel}
                      numberOfLines={1}
                    >
                      {filterVehicle
                        ? `${filterVehicle.year} ${filterVehicle.model}`
                        : "All Vehicles"}
                    </Text>
                    <View style={styles.pickerSide}>
                      <ListFilter size={16} color="#8E8E93" />
                    </View>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* Pending-review prompt. This was a circular Star button in the
                row above with only a count badge — an unlabelled glyph that
                never said what was waiting. A full-width row on the booking
                cards' gutters names the service instead, which is what
                comparable order-history surfaces do (Thrive Market, Agoda).
                Destination is unchanged. */}
            {showPendingReviewsButton ? (
              <Pressable
                onPress={() => router.push("/bookings/pending-reviews")}
                accessibilityRole="button"
                accessibilityLabel={pendingReviewLabel}
                accessibilityHint="Opens your pending reviews"
                style={({ pressed }) => [
                  styles.reviewBanner,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={styles.reviewBannerIcon}>
                  <Star size={19} color="#E8A93B" fill="#E8A93B" />
                </View>
                <View style={styles.reviewBannerCopy}>
                  <Text weight="bold" color="#141C24" style={styles.reviewBannerTitle}>
                    {pendingReviewLabel}
                  </Text>
                  {pendingReviewSubtitle ? (
                    <Text
                      color="#6B7280"
                      numberOfLines={1}
                      style={styles.reviewBannerSubtitle}
                    >
                      {pendingReviewSubtitle}
                    </Text>
                  ) : null}
                </View>
                <ChevronRight size={18} color="#9CA3AF" strokeWidth={2} />
              </Pressable>
            ) : null}

            {/* Booking Content. The Bookings tab includes in-progress
                cards now — their per-card progress bar communicates
                status inline, replacing the old Live Tracker tab.
                Completed-but-unreviewed bookings live behind the review
                banner above — see /bookings/pending-reviews.
                The Recommended tab swaps the list for the mechanic-rec
                history view instead — same content as the standalone
                /bookings/recommended screen (kept for deep links). */}
            <View style={styles.content}>
              {activeTab === "recommended" ? (
                <RecommendedServicesContent />
              ) : (
                <>
                  <CustomerLateBanner onReschedule={(bookingId) => handleReschedule(String(bookingId))} />
                  {bookings.length > 0 ? (
                    bookings.map((booking) =>
                      booking.status === "pending_quote" || booking.status === "quotes_ready" ? (
                        <PendingQuoteCard
                          key={booking.id}
                          booking={booking}
                          onPress={handleViewDetails}
                          onViewQuotes={handleViewQuotes}
                          onCancel={handleCancelBooking}
                        />
                      ) : (
                        <BookingCard
                          key={booking.id}
                          booking={booking}
                          variant="upcoming"
                          onViewDetails={handleViewDetails}
                          onCancelBooking={handleCancelBooking}
                          onReschedule={handleReschedule}
                          onRequestPickup={handleRequestPickup}
                          onMessageShop={handleMessageShop}
                          onDownloadPdf={handleDownloadPdf}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ),
                    )
                  ) : (
                    <View style={styles.emptyState}>
                      <View style={styles.emptyIconContainer}>
                        <Calendar size={48} color="#9CA3AF" strokeWidth={1.5} />
                      </View>
                      <Text weight="semiBold" size="lg" color="#374151" center>
                        {activeTab === "bookings" ? "No Bookings Yet" : "No Quotes Yet"}
                      </Text>
                      <Text weight="regular" size="sm" color="#6B7280" center style={styles.emptyText}>
                        {activeTab === "bookings"
                          ? "You don't have any active appointments. Book a service to get started!"
                          : "Shop responses will appear here once quotes come back for one of your tire requests."}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </Animated.ScrollView>
        </View>
      )}
    </ScrollDrivenGradientBackground>

    <AvailabilityModal
      visible={rescheduleBooking !== null}
      mode="reschedule"
      mechanicId={rescheduleBooking?.mechanicId ?? null}
      shopId={rescheduleBooking?.shopId ?? null}
      onClose={handleCloseRescheduleModal}
      onConfirm={handleConfirmRescheduleSlot}
    />

    <BookingDetailsSheet ref={detailsSheetRef} />

    <QuoteListSheet ref={quoteListSheetRef} />

    <RotorQuoteListSheet ref={rotorQuoteListSheetRef} />

    {/* Vehicle picker sheet — drives the filter button above.
        showBackdrop dims + blurs the page behind it. */}
    <FloatingSheet
      ref={vehiclePickerRef}
      snapHeights={[Math.min(540, 200 + (allVehicles.length + 1) * 78)]}
      showBackdrop
    >
      <View style={styles.sheetContent}>
        <Text size="lg" weight="bold" color="#1A1A1A" style={styles.sheetTitle}>
          Choose a vehicle
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Pressable
            style={[styles.vehicleRow, filterVehicleId === null && styles.vehicleRowActive]}
            onPress={() => {
              setListFilterVehicleId(null);
              vehiclePickerRef.current?.close();
            }}
          >
            <View style={styles.vehicleRowSide}>
              <Image
                source={require("@/assets/images/covered-car.png")}
                style={styles.vehicleRowCoveredCar}
                resizeMode="contain"
              />
            </View>
            <View style={styles.vehicleRowText}>
              <Text size="md" weight="semiBold" color="#1F2937">
                All Vehicles
              </Text>
            </View>
            {filterVehicleId === null ? (
              <View style={styles.checkCircle}>
                <Check size={14} color="#FFFFFF" />
              </View>
            ) : null}
          </Pressable>

          {allVehicles.map((v) => {
            const active = v.id === filterVehicleId;
            return (
              <Pressable
                key={v.id}
                style={[styles.vehicleRow, active && styles.vehicleRowActive]}
                onPress={() => {
                  setListFilterVehicleId(v.id);
                  vehiclePickerRef.current?.close();
                }}
              >
                <View style={styles.vehicleRowSide}>
                  {v.imageSource ? (
                    <Image
                      source={v.imageSource}
                      style={styles.vehicleRowImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Image
                      source={require("@/assets/images/covered-car.png")}
                      style={styles.vehicleRowCoveredCar}
                      resizeMode="contain"
                    />
                  )}
                </View>
                <View style={styles.vehicleRowText}>
                  <Text size="md" weight="semiBold" color="#1F2937">
                    {v.year} {v.make} {v.model}
                  </Text>
                  {v.vin ? (
                    <Text size="xs" weight="regular" color="#8E8E93">
                      VIN · {v.vin}
                    </Text>
                  ) : null}
                </View>
                {active ? (
                  <View style={styles.checkCircle}>
                    <Check size={14} color="#FFFFFF" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </FloatingSheet>
  </>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: "#dde2ee",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  headerSide: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  segmentedWrapper: {
    marginHorizontal: 20,
  },
  segmentedControl: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    borderRadius: 8,
    backgroundColor: "#111111",
    overflow: "hidden",
  },
  segmentButton: {
    flex: 1,
    minWidth: 0,
    height: 38,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  segmentButtonActive: {
    backgroundColor: "#5F6063",
  },
  segmentButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  segmentLabel: {
    width: "100%",
    textAlign: "center",
    includeFontPadding: false,
  },
  // Vehicle picker button + sheet
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  pickerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pickerButtonPressed: {
    opacity: 0.92,
  },
  pickerSide: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerThumb: {
    width: 38,
    height: 28,
  },
  pickerCoveredCar: {
    width: 40,
    height: 28,
  },
  pickerLabel: {
    flex: 1,
    textAlign: "center",
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetTitle: {
    marginBottom: 14,
    textAlign: "center",
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    marginBottom: 10,
  },
  vehicleRowActive: {
    borderColor: "#5299FE",
    borderWidth: 2,
    backgroundColor: "#F5F9FF",
  },
  vehicleRowSide: {
    width: 56,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleRowImage: {
    width: 52,
    height: 40,
  },
  vehicleRowCoveredCar: {
    width: 56,
    height: 40,
  },
  vehicleRowText: {
    flex: 1,
    gap: 2,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  // Review banner — matches the booking cards' 20pt gutters so the two read
  // as one column.
  reviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 68,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    shadowColor: "#14273F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  reviewBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEF4DA",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewBannerCopy: {
    flex: 1,
  },
  reviewBannerTitle: {
    fontSize: 14.5,
    lineHeight: 19,
  },
  reviewBannerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyText: {
    marginTop: 8,
    lineHeight: 22,
  },
});
