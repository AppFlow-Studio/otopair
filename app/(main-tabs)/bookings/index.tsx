/**
 * BookingsScreen
 *
 * PURPOSE: My Bookings screen – Live Tracker, Upcoming, and History from Convex.
 *
 * USED IN: app/(main-tabs)/bookings/_layout.tsx
 *
 * FEATURES:
 *   - Live Tracker: in_progress booking with progress and contact shop
 *   - Upcoming: pending/confirmed future bookings
 *   - History: completed/cancelled or past bookings with search
 *
 * OWNER: Waleed Mansour
 */
import { BookingCard, type Booking } from "@/components/bookings/BookingCard";
import { PendingQuoteCard } from "@/components/bookings/PendingQuoteCard";
import { QuoteListSheet, type QuoteListSheetRef } from "@/components/bookings/QuoteListSheet";
import { BookingDetailsSheet, type BookingDetailsSheetRef } from "@/components/bookings/BookingDetailsSheet";
import {
  QuoteRequestConfirmationSheet,
  type QuoteRequestConfirmationSheetRef,
} from "@/components/bookings/QuoteRequestConfirmationSheet";
import { ScrollDrivenGradientBackground, Text } from "@/components/shared-ui";
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";
import { useBookingStore } from "@/stores/useBookingStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, Search, SlidersHorizontal } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SegmentedControl from "@react-native-segmented-control/segmented-control";

// ============================================================================
// TYPES
// ============================================================================

type TabType = "liveTracker" | "upcoming" | "quotes" | "history";
const TAB_ORDER: TabType[] = ["liveTracker", "upcoming", "quotes", "history"];

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { liveBooking, upcomingBookings, quoteBookings, historyBookings, isLoading } = useMyBookingsWithDetails();

  const hasActiveService = !!liveBooking;
  const { tab: tabParam, requestSubmitted: requestSubmittedParam } =
    useLocalSearchParams<{ tab?: string; requestSubmitted?: string }>();
  const initialTab: TabType = TAB_ORDER.includes(tabParam as TabType)
    ? (tabParam as TabType)
    : hasActiveService
      ? "liveTracker"
      : "upcoming";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  // If we land on the screen again with a new `tab` param (e.g. from the
  // tire flow completing), switch to the requested tab.
  useEffect(() => {
    if (tabParam && TAB_ORDER.includes(tabParam as TabType)) {
      setActiveTab(tabParam as TabType);
    }
  }, [tabParam]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const detailsSheetRef = useRef<BookingDetailsSheetRef>(null);
  const confirmSheetRef = useRef<QuoteRequestConfirmationSheetRef>(null);

  // One-shot: when we arrive here with `requestSubmitted=1` (from the tire
  // "Requesting" screen's View button), auto-open the confirmation sheet
  // *after* the Expo Router tab/stack transition settles. Without the delay,
  // the Modal's slide-up overlaps the route transition and the user lands on
  // a screen that's already fully open.
  useEffect(() => {
    if (requestSubmittedParam !== "1") return;
    const timer = setTimeout(() => {
      confirmSheetRef.current?.open();
      // Strip the param AFTER opening so we don't re-trigger on re-renders.
      router.setParams({ requestSubmitted: undefined });
    }, 800);
    return () => clearTimeout(timer);
  }, [requestSubmittedParam, router]);

  const handleConfirmSheetViewBooking = useCallback(() => {
    confirmSheetRef.current?.close();
  }, []);

  const bookings =
    activeTab === "upcoming"
      ? upcomingBookings
      : activeTab === "quotes"
        ? quoteBookings
        : historyBookings;

  // Filter bookings based on search query (history tab)
  const filteredBookings = bookings.filter(
    (booking) =>
      booking.services.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
      booking.mechanicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.shopName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const allBookings = [
    ...(liveBooking ? [liveBooking] : []),
    ...upcomingBookings,
    ...quoteBookings,
    ...historyBookings,
  ];
  const handleViewDetails = (bookingId: string) => {
    const booking = allBookings.find((b) => b.id === bookingId);
    if (booking) {
      detailsSheetRef.current?.open(booking);
    }
  };

  const cancelBooking = useBookingStore((s) => s.cancelBooking);
  const toggleLiveTracker = useBookingStore((s) => s.toggleLiveTracker);
  const toggleQuotesReady = useBookingStore((s) => s.toggleQuotesReady);
  const handleCancelBooking = (bookingId: string) => {
    cancelBooking(bookingId);
  };
  const handleToggleLiveTracker = (bookingId: string) => {
    toggleLiveTracker(bookingId);
    // Zustand updates synchronously — read the new status to pick which tab to land on.
    const booking = useBookingStore.getState().getBookingById(bookingId);
    if (booking?.status === "in_progress") {
      setActiveTab("liveTracker");
    } else {
      setActiveTab("upcoming");
    }
  };

  const quoteListSheetRef = useRef<QuoteListSheetRef>(null);
  const handleToggleQuotesReady = (bookingId: string) => {
    toggleQuotesReady(bookingId);
    // Follow the card to its new tab — pending_quote → Quotes, and back.
    const booking = useBookingStore.getState().getBookingById(bookingId);
    setActiveTab(booking?.status === "quotes_ready" ? "quotes" : "upcoming");
  };
  const handleViewQuotes = (bookingId: string) => {
    quoteListSheetRef.current?.open(bookingId);
  };

  const handleReschedule = (bookingId?: string) => {
    console.log("Reschedule booking:", bookingId || "live");
  };

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
            contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text weight="bold" size="xl" color="#FFFFFF">
                My Bookings
              </Text>
            </View>

            {/* Tab Switcher */}
            <View style={styles.segmentedWrapper}>
              <SegmentedControl
                values={["Live Tracker", "Upcoming", "Quotes", "History"]}
                selectedIndex={TAB_ORDER.indexOf(activeTab)}
                onChange={(event) => {
                  setActiveTab(TAB_ORDER[event.nativeEvent.selectedSegmentIndex]);
                }}
                style={styles.segmentedControl}
              />
            </View>

            {/* Search Bar - Only for History */}
            {activeTab === "history" && (
              <View style={styles.searchRow}>
                <View style={styles.searchContainer}>
                  <Search size={18} color="#9CA3AF" strokeWidth={2} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search for past bookings..."
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  <Pressable style={styles.filterButton}>
                    <SlidersHorizontal size={18} color="#6B7280" strokeWidth={2} />
                  </Pressable>
                </View>
                <Pressable style={styles.calendarButton}>
                  <Calendar size={20} color="#6B7280" strokeWidth={2} />
                </Pressable>
              </View>
            )}

            {/* Booking Content */}
            <View style={styles.content}>
              {activeTab === "liveTracker" ? (
                // Live Tracker Content
                hasActiveService && liveBooking ? (
                  <BookingCard
                    booking={liveBooking}
                    variant="upcoming"
                    onViewDetails={handleViewDetails}
                    onCancelBooking={handleCancelBooking}
                    onReschedule={handleReschedule}
                    onToggleLiveTracker={handleToggleLiveTracker}
                  />
                ) : (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIconContainer}>
                      <Calendar size={48} color="#9CA3AF" strokeWidth={1.5} />
                    </View>
                    <Text weight="semiBold" size="lg" color="#374151" center>
                      No Active Service
                    </Text>
                    <Text weight="regular" size="sm" color="#6B7280" center style={styles.emptyText}>
                      You don't have any service in progress. Book a service to get started!
                    </Text>
                  </View>
                )
              ) : filteredBookings.length > 0 ? (
                // Upcoming or History Content. Pending-quote bookings in
                // Upcoming get a stripped-down card with only the car + tire
                // specs + Pending Quote tag; full BookingCard otherwise.
                filteredBookings.map((booking) =>
                  booking.status === "pending_quote" || booking.status === "quotes_ready" ? (
                    // Tire quote-stage bookings use the dedicated PendingQuoteCard
                    // in both Upcoming (pending_quote) and Quotes (quotes_ready)
                    // tabs. Status drives the tag + action inside the card.
                    <PendingQuoteCard
                      key={booking.id}
                      booking={booking}
                      onPress={handleViewDetails}
                      onToggleQuotesReady={handleToggleQuotesReady}
                      onViewQuotes={handleViewQuotes}
                    />
                  ) : (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      variant={activeTab === "history" ? "history" : "upcoming"}
                      onViewDetails={handleViewDetails}
                      onCancelBooking={handleCancelBooking}
                      onReschedule={handleReschedule}
                      onDownloadPdf={handleDownloadPdf}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleLiveTracker={handleToggleLiveTracker}
                    />
                  ),
                )
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Calendar size={48} color="#9CA3AF" strokeWidth={1.5} />
                  </View>
                  <Text weight="semiBold" size="lg" color="#374151" center>
                    {activeTab === "upcoming"
                      ? "No Upcoming Bookings"
                      : activeTab === "quotes"
                        ? "No Quotes Yet"
                        : "No Past Bookings"}
                  </Text>
                  <Text weight="regular" size="sm" color="#6B7280" center style={styles.emptyText}>
                    {activeTab === "upcoming"
                      ? "You don't have any upcoming appointments. Book a service to get started!"
                      : activeTab === "quotes"
                        ? "Shop responses will appear here once quotes come back for one of your Upcoming requests."
                        : "You haven't completed any bookings yet."}
                  </Text>
                </View>
              )}
            </View>
          </Animated.ScrollView>
        </View>
      )}
    </ScrollDrivenGradientBackground>

    <BookingDetailsSheet ref={detailsSheetRef} />

    <QuoteRequestConfirmationSheet
      ref={confirmSheetRef}
      onViewBooking={handleConfirmSheetViewBooking}
    />

    <QuoteListSheet ref={quoteListSheetRef} />
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
    alignItems: "center",
  },
  segmentedWrapper: {
    marginHorizontal: 20,
  },
  segmentedControl: {
    height: 44,
  },
  searchRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 16,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
    fontSize: 15,
    color: "#1F2937",
    fontFamily: "Urbanist-Regular",
  },
  filterButton: {
    padding: 4,
  },
  calendarButton: {
    width: 48,
    height: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 75,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
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
