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
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";
import { CustomerLateBanner } from "@/components/bookings/CustomerLateBanner";
import { RecommendedServicesContent } from "@/components/bookings/RecommendedServicesContent";
import { useBookingStore } from "@/stores/useBookingStore";
import { useBookingsBadgeStore } from "@/stores/useBookingsBadgeStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { api } from "@/convex/_generated/api";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { useToast } from "@/hooks/useToast";
import type { Id } from "@/convex/_generated/dataModel";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { Calendar, CalendarX, ChevronRight, Star } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SegmentedControl from "@react-native-segmented-control/segmented-control";

// ============================================================================
// TYPES
// ============================================================================

type TabType = "bookings" | "quotes" | "recommended";
const TAB_ORDER: TabType[] = ["bookings", "quotes", "recommended"];
const BOTTOM_NAV_SCROLL_CLEARANCE = 96;

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
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);


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
    success: "Booking cancelled.",
    successIcon: CalendarX,
    error: "Couldn't cancel this booking. Try again.",
  });
  useEffect(() => {
    if (typeof rescheduleError === "string" && rescheduleError.length > 0) {
      toast.error("Couldn't request reschedule.", rescheduleError);
    }
  }, [rescheduleError, toast]);
  const handleCancelBooking = useCallback(
    (bookingId: string) => {
      const isLocalId = bookingId.startsWith("tire_quote_") || bookingId.startsWith("booking_");
      if (isLocalId) {
        cancelLocalBooking(bookingId);
        toast.success("Booking cancelled.", undefined, { icon: CalendarX });
      } else {
        void cancelConvexBooking({ bookingId: bookingId as Id<"bookings"> });
      }
    },
    [cancelConvexBooking, cancelLocalBooking, toast],
  );

  const bookings = (
    activeTab === "bookings" ? upcomingBookings : quoteBookings
  );

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
  // active vehicle filter). Drives the review banner under the tab pill —
  // the actual list + LeaveReviewSheet live on /bookings/pending-reviews.
  const pendingReviewCount = useMemo(
    () => pendingReviewBookings.length,
    [pendingReviewBookings],
  );

  const pendingReviewLabel =
    pendingReviewCount === 1
      ? "1 service needs your review"
      : `${pendingReviewCount} services need your review`;

  // Names the newest unreviewed booking so the row says what it is rather
  // than just how many there are. `pendingReviewBookings` is already sorted
  // newest-first by the hook. Service labels match the destination screen's
  // (`CompletedBookingReviewCard`) so the row and the card it leads to
  // don't disagree.
  const pendingReviewSubtitle = useMemo(() => {
    const first = pendingReviewBookings[0];
    if (!first) return "";
    const service = first.services.join(", ") || "Service";
    const base = first.shopName ? `${service} · ${first.shopName}` : service;
    const others = pendingReviewCount - 1;
    return others > 0 ? `${base}  +${others} more` : base;
  }, [pendingReviewBookings, pendingReviewCount]);

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
              <SegmentedControl
                values={["Bookings", "Quotes", "Recommended"]}
                selectedIndex={TAB_ORDER.indexOf(activeTab)}
                onChange={(event) => {
                  setActiveTab(TAB_ORDER[event.nativeEvent.selectedSegmentIndex]);
                }}
                style={styles.segmentedControl}
              />
            </View>


            {/* Pending-review prompt — surfaces completed bookings still
                awaiting a star rating. This was a floating circular Star
                button with a count badge, left over from a row that also
                held the Recommended-services card; once Recommended moved
                into the tab pill (see TAB_ORDER) the icon was orphaned
                mid-screen with nothing to explain it. A full-width row
                states what is waiting and which service it belongs to,
                which is what every comparable order-history surface does
                (Thrive Market, Agoda) — an unlabelled glyph made the user
                guess. Destination is unchanged. */}
            {activeTab === "bookings" && pendingReviewCount > 0 ? (
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
                Completed-but-unreviewed bookings live behind the circular
                Star button above — see /bookings/pending-reviews.
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
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  // Review banner — matches the full-width row width of the booking cards
  // below it (20pt gutters) so the two read as one column.
  reviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginTop: 14,
    // Explicit: `content`'s paddingTop below resolves to ~2pt of visible
    // air against this row, so the banner would otherwise sit flush on the
    // first booking card.
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
