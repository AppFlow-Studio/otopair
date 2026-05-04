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
import { useBookingStore } from "@/stores/useBookingStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, Car, Check, ChevronDown } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
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
  const { upcomingBookings, quoteBookings, historyBookings, isLoading } = useMyBookingsWithDetails();

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
  const [filterVehicleId, setFilterVehicleId] = useState<string | null>(null);
  const filterVehicle = filterVehicleId
    ? allVehicles.find((v) => v.id === filterVehicleId)
    : null;
  const matchesFilter = useCallback(
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
      const isSynthesized = bookingId.startsWith("tire_quote_");
      if (isSynthesized) {
        cancelLocalBooking(bookingId);
      } else {
        void cancelConvexBooking({ bookingId: bookingId as Id<"bookings"> });
      }
    },
    [cancelConvexBooking, cancelLocalBooking],
  );

  const bookings = (
    activeTab === "bookings" ? upcomingBookings : quoteBookings
  ).filter(matchesFilter);

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
                  onPress={() => vehiclePickerRef.current?.open()}
                  style={({ pressed }) => [
                    styles.pickerButton,
                    pressed && styles.pickerButtonPressed,
                  ]}
                >
                  {filterVehicle?.imageSource ? (
                    <Image
                      source={filterVehicle.imageSource}
                      style={styles.pickerThumb}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.pickerIconBubble}>
                      <Car size={16} color="#5299FE" strokeWidth={2} />
                    </View>
                  )}
                  <View style={styles.pickerLabelWrap}>
                    <Text size="xs" weight="semiBold" color="#8E8E93">
                      VEHICLE
                    </Text>
                    <Text size="md" weight="semiBold" color="#1F2937">
                      {filterVehicle
                        ? `${filterVehicle.year} ${filterVehicle.model}`
                        : "All Vehicles"}
                    </Text>
                  </View>
                  <ChevronDown size={18} color="#8E8E93" />
                </Pressable>
              </View>
            ) : null}

            {/* Booking Content. The Bookings tab includes in-progress
                cards now — their per-card progress bar communicates
                status inline, replacing the old Live Tracker tab. */}
            <View style={styles.content}>
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

    {/* Vehicle picker sheet — drives the filter button above. */}
    <FloatingSheet
      ref={vehiclePickerRef}
      snapHeights={[Math.min(540, 200 + (allVehicles.length + 1) * 78)]}
    >
      <View style={styles.sheetContent}>
        <Text size="lg" weight="bold" color="#1A1A1A" style={styles.sheetTitle}>
          Choose a vehicle
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Pressable
            style={[styles.vehicleRow, filterVehicleId === null && styles.vehicleRowActive]}
            onPress={() => {
              setFilterVehicleId(null);
              vehiclePickerRef.current?.close();
            }}
          >
            <View style={styles.vehicleRowIconBubble}>
              <Car size={18} color="#5299FE" strokeWidth={2} />
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
                  setFilterVehicleId(v.id);
                  vehiclePickerRef.current?.close();
                }}
              >
                <View style={styles.vehicleRowThumb}>
                  {v.imageSource ? (
                    <Image
                      source={v.imageSource}
                      style={styles.vehicleRowImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Car size={20} color="#9CA3AF" />
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
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  pickerButtonPressed: {
    opacity: 0.92,
  },
  pickerThumb: {
    width: 36,
    height: 28,
  },
  pickerIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerLabelWrap: {
    flex: 1,
    gap: 1,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetTitle: {
    marginBottom: 14,
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
  vehicleRowIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleRowThumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  vehicleRowImage: {
    width: 40,
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
