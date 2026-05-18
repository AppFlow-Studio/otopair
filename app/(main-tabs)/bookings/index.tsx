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
import { BookingCard, type Booking } from "@/components/bookings/BookingCard";
import { PendingQuoteCard } from "@/components/bookings/PendingQuoteCard";
import { QuoteListSheet, type QuoteListSheetRef } from "@/components/bookings/QuoteListSheet";
import { BookingDetailsSheet, type BookingDetailsSheetRef } from "@/components/bookings/BookingDetailsSheet";
import {
  QuoteRequestConfirmationSheet,
  type QuoteRequestConfirmationSheetRef,
} from "@/components/bookings/QuoteRequestConfirmationSheet";
import { ScrollDrivenGradientBackground, Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { CompletedBookingReviewCard } from "@/components/bookings/CompletedBookingReviewCard";
import { CustomerLateBanner } from "@/components/bookings/CustomerLateBanner";
import { LeaveReviewSheet, type LeaveReviewSheetRef } from "@/components/bookings/LeaveReviewSheet";
import { useBookingStore } from "@/stores/useBookingStore";
import { useBookingsBadgeStore } from "@/stores/useBookingsBadgeStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useRecHistoryFromConvex } from "@/hooks/useRecHistoryFromConvex";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, Car, Check, ChevronRight, ListFilter } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SegmentedControl from "@react-native-segmented-control/segmented-control";

// ============================================================================
// TYPES
// ============================================================================

type TabType = "bookings" | "quotes";
const TAB_ORDER: TabType[] = ["bookings", "quotes"];

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingsScreen() {
  const router = useRouter();
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
  const { userId } = useUserFromConvex();

  const { tab: tabParam, requestSubmitted: requestSubmittedParam } =
    useLocalSearchParams<{ tab?: string; requestSubmitted?: string }>();
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
  const confirmSheetRef = useRef<QuoteRequestConfirmationSheetRef>(null);
  const vehiclePickerRef = useRef<FloatingSheetRef>(null);


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

  // Active-rec count for the entry-point card. Scoped to the currently
  // filtered vehicle when one is selected, else the primary garaged car.
  const activeVin =
    filterVehicle?.vin ?? useVehicleStore.getState().getSelectedVehicle()?.vin;
  const { history: recHistory } = useRecHistoryFromConvex(activeVin);
  const activeRecCount = recHistory.filter(
    (r) =>
      r.status === "open" ||
      r.status === "acknowledged" ||
      (r.status === "dismissed" && r.dismissed_reason === "hidden_by_driver"),
  ).length;
  const matchesListFilter = useCallback(
    (b: Booking) => {
      if (!filterVehicle) return true;
      // Prefer VIN match — unambiguous, no name parsing. Both Convex and
      // local-synthesized bookings now carry the originating VIN so this
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

  // Cancel: soft-deletes by flipping `status` to "cancelled". Convex
  // mutation handles server-backed bookings (idempotent —
  // `api.bookings.cancelBooking`); the local Zustand action handles
  // synthesized tire quotes that never made it to Convex. The card
  // moves to History on next query refresh because `isHistory` matches
  // status "cancelled".
  //
  // Important: we discriminate by id prefix, NOT by store membership.
  // `useBookingsFromConvex` (mounted in `(main-tabs)/_layout.tsx`)
  // hydrates every Convex booking into the local store, so a store hit
  // doesn't tell us anything. Synthesized tire quotes use the
  // `tire_quote_*` id format from `synthesizeTireQuoteBooking`; real
  // Convex ids are base32 and never start with that prefix.
  const cancelLocalBooking = useBookingStore((s) => s.cancelBooking);
  const cancelConvexBooking = useMutation(api.bookings.cancelBooking);
  const handleCancelBooking = useCallback(
    (bookingId: string) => {
      const isLocalId = bookingId.startsWith("tire_quote_") || bookingId.startsWith("booking_");
      if (isLocalId) {
        cancelLocalBooking(bookingId);
      } else {
        void cancelConvexBooking({ bookingId: bookingId as Id<"bookings"> });
      }
    },
    [cancelConvexBooking, cancelLocalBooking],
  );

  const bookings = (
    activeTab === "bookings" ? upcomingBookings : quoteBookings
  ).filter(matchesListFilter);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const allBookings = [
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

  const quoteListSheetRef = useRef<QuoteListSheetRef>(null);
  const handleViewQuotes = (bookingId: string) => {
    quoteListSheetRef.current?.open(bookingId);
  };

  // ── Leave-a-review flow ──────────────────────────────────────────────────
  // `pendingReviewBookings` from the hook = completed bookings the user
  // hasn't reviewed in Convex. `dismissedReviewIds` is in-memory only —
  // when the user taps the X on the card, it hides for this session but
  // returns next launch (until they actually submit a review). Once a
  // review is submitted, `listReviewedBookingIdsForUser` re-runs and
  // the row is dropped permanently.
  const reviewSheetRef = useRef<LeaveReviewSheetRef>(null);
  const [dismissedReviewIds, setDismissedReviewIds] = useState<Set<string>>(
    () => new Set(),
  );
  const visibleReviewBookings = useMemo(
    () =>
      pendingReviewBookings
        .filter((b) => !dismissedReviewIds.has(b.id))
        .filter(matchesListFilter),
    [pendingReviewBookings, dismissedReviewIds, matchesListFilter],
  );
  const handleLeaveReview = useCallback((bookingId: string) => {
    const target = pendingReviewBookings.find((b) => b.id === bookingId);
    if (!target || !userId) return;
    reviewSheetRef.current?.open(target, String(userId));
  }, [pendingReviewBookings, userId]);
  const handleDismissReviewCard = useCallback((bookingId: string) => {
    setDismissedReviewIds((prev) => {
      const next = new Set(prev);
      next.add(bookingId);
      return next;
    });
  }, []);

  // Reschedule = cancel the current booking after confirmation, so the
  // driver can book a new slot fresh. We don't have in-place reschedule
  // yet, and surfacing "cancel" via the late-banner CTA matches the
  // current product spec.
  const handleReschedule = useCallback(
    (bookingId?: string) => {
      if (!bookingId) return;
      Alert.alert(
        "Reschedule appointment?",
        "This will cancel your current booking. You'll need to book a new time slot.",
        [
          { text: "Keep booking", style: "cancel" },
          {
            text: "Cancel & reschedule",
            style: "destructive",
            onPress: () => {
              const isLocalId = bookingId.startsWith("tire_quote_") || bookingId.startsWith("booking_");
              if (!isLocalId) {
                void cancelConvexBooking({ bookingId: bookingId as Id<"bookings"> });
              } else {
                cancelLocalBooking(bookingId);
              }
            },
          },
        ],
      );
    },
    [cancelConvexBooking],
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
                values={["Bookings", "Quotes"]}
                selectedIndex={TAB_ORDER.indexOf(activeTab)}
                onChange={(event) => {
                  setActiveTab(TAB_ORDER[event.nativeEvent.selectedSegmentIndex]);
                }}
                style={styles.segmentedControl}
              />
            </View>

            {/* Vehicle picker button — opens a bottom sheet with the
                user's cars. Only shown with 2+ cars. */}
            {allVehicles.length > 1 ? (
              <View style={styles.pickerRow}>
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
              </View>
            ) : null}

            {/* Mechanic-rec history entry point. Surfaces hidden + resolved
                recs so drivers can address what's still dragging their VHS. */}
            {activeTab === "bookings" ? (
              <Pressable
                onPress={() => router.push("/bookings/recommended")}
                style={({ pressed }) => [
                  styles.recHistoryCard,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text weight="semiBold" style={styles.recHistoryTitle}>
                  Recommended services
                </Text>
                {activeRecCount > 0 ? (
                  <View style={styles.recHistoryBadge}>
                    <Text weight="semiBold" style={styles.recHistoryBadgeText}>
                      {activeRecCount}
                    </Text>
                  </View>
                ) : null}
                <ChevronRight size={18} color="#C7C7CC" />
              </Pressable>
            ) : null}

            {/* Booking Content. The Bookings tab includes in-progress
                cards now — their per-card progress bar communicates
                status inline, replacing the old Live Tracker tab.
                Completed-but-unreviewed bookings get a "Leave a review"
                card pinned at the very top until the user reviews. */}
            <View style={styles.content}>
              <CustomerLateBanner onReschedule={(bookingId) => handleReschedule(String(bookingId))} />
              {activeTab === "bookings" && visibleReviewBookings.length > 0
                ? visibleReviewBookings.map((booking) => (
                    <CompletedBookingReviewCard
                      key={`review-${booking.id}`}
                      booking={booking}
                      onLeaveReview={handleLeaveReview}
                      onDismiss={handleDismissReviewCard}
                    />
                  ))
                : null}
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
              ) : activeTab === "bookings" && visibleReviewBookings.length > 0 ? (
                // Review cards are present — no empty state needed.
                null
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

    <LeaveReviewSheet ref={reviewSheetRef} />

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
    alignItems: "center",
  },
  segmentedWrapper: {
    marginHorizontal: 20,
  },
  segmentedControl: {
    height: 44,
  },
  // Vehicle picker button + sheet
  pickerRow: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  pickerButton: {
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
  scrollContent: {
    paddingBottom: 75,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  recHistoryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.06)",
  },
  recHistoryTitle: {
    flex: 1,
    fontSize: 14,
    color: "#141C24",
  },
  recHistoryBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },
  recHistoryBadgeText: {
    fontSize: 12,
    color: "#FFFFFF",
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
