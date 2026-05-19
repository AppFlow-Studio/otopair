/**
 * BookingHistoryScreen
 *
 * PURPOSE: Past + cancelled bookings, lifted out of the main Bookings tab.
 *          History no longer lives in the bookings segmented control — per
 *          the Apr 30 redesign it sits under Settings → My Garage so the
 *          Bookings tab focuses on Live Tracker / Upcoming / Quotes only.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx (My Garage section).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, Car, Check, ChevronDown, ChevronLeft, Search, SlidersHorizontal } from "lucide-react-native";

import { BookingCard } from "@/components/bookings/BookingCard";
import {
  BookingDetailsSheet,
  type BookingDetailsSheetRef,
} from "@/components/bookings/BookingDetailsSheet";
import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";
import { useVehicleStore } from "@/stores/useVehicleStore";

export default function BookingHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { historyBookings } = useMyBookingsWithDetails();
  const { openBookingId } = useLocalSearchParams<{ openBookingId?: string }>();

  const [searchQuery, setSearchQuery] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const detailsSheetRef = useRef<BookingDetailsSheetRef>(null);
  const vehiclePickerRef = useRef<FloatingSheetRef>(null);
  const filterSheetRef = useRef<FloatingSheetRef>(null);
  const autoOpenedRef = useRef<string | null>(null);

  // Auto-open the details sheet when arriving with `openBookingId` (used by
  // the Recommended-services screen to deep-link the resolving booking).
  useEffect(() => {
    if (!openBookingId) return;
    if (autoOpenedRef.current === openBookingId) return;
    const booking = historyBookings.find((b) => b.id === openBookingId);
    if (!booking) return;
    autoOpenedRef.current = openBookingId;
    detailsSheetRef.current?.open(booking);
    router.setParams({ openBookingId: undefined });
  }, [openBookingId, historyBookings, router]);

  // Vehicle filter
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

  // Vehicle + search filter is shared between the visible list and the
  // hidden-cancelled count, so apply it once and split by status after.
  const matchesVehicleAndSearch = (b: typeof historyBookings[number]) => {
    if (filterVehicle) {
      // Prefer VIN match (unambiguous). Fall back to name+year prefix
      // match if either side lacks a VIN.
      if (filterVehicle.vin && b.vin) {
        if (b.vin.toUpperCase() !== filterVehicle.vin.toUpperCase()) return false;
      } else {
        const target = `${filterVehicle.make} ${filterVehicle.model}`.toLowerCase();
        const carModelLower = b.carModel.toLowerCase();
        if (carModelLower !== target && !carModelLower.startsWith(`${target} `)) {
          return false;
        }
        if (b.carYear !== String(filterVehicle.year)) return false;
      }
    }
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      b.services.some((s) => s.toLowerCase().includes(q)) ||
      b.mechanicName.toLowerCase().includes(q) ||
      b.shopName.toLowerCase().includes(q)
    );
  };
  const scoped = historyBookings.filter(matchesVehicleAndSearch);
  const filtered = showCancelled
    ? scoped
    : scoped.filter((b) => b.status !== "cancelled");

  const handleViewDetails = useCallback((bookingId: string) => {
    const booking = historyBookings.find((b) => b.id === bookingId);
    if (booking) detailsSheetRef.current?.open(booking);
  }, [historyBookings]);


  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/home");
  }, [router]);

  return (
    <>
      <View style={styles.screen}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={handleBack} hitSlop={12} style={styles.backButton}>
            <ChevronLeft size={26} color="#1A1A1A" />
          </Pressable>
          <Text size="md" weight="semiBold" color="#1A1A1A">
            Booking History
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Vehicle picker button — opens a bottom sheet for selection.
            Only visible with 2+ vehicles. */}
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
                  <Image
                    source={require("@/assets/images/covered-car.png")}
                    style={{ width: 26, height: 18 }}
                    resizeMode="contain"
                  />
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

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Search size={18} color="#9CA3AF" strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search past bookings..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Pressable
              style={styles.filterButton}
              onPress={() => filterSheetRef.current?.open()}
            >
              <SlidersHorizontal
                size={18}
                color={showCancelled ? "#5299FE" : "#6B7280"}
                strokeWidth={2}
              />
            </Pressable>
          </View>
        </View>


        {/* List */}
        <ScrollView
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length > 0 ? (
            filtered.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                variant="history"
                compact
                onViewDetails={handleViewDetails}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Calendar size={48} color="#9CA3AF" strokeWidth={1.5} />
              </View>
              <Text weight="semiBold" size="lg" color="#374151" center>
                No Past Bookings
              </Text>
              <Text
                weight="regular"
                size="sm"
                color="#6B7280"
                center
                style={styles.emptyText}
              >
                You haven&apos;t completed any bookings yet.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      <BookingDetailsSheet ref={detailsSheetRef} />

      {/* Filter sheet — accessed via the sliders icon in the search bar. */}
      <FloatingSheet ref={filterSheetRef} snapHeights={[200]} showBackdrop>
        <View style={styles.sheetContent}>
          <Text size="lg" weight="bold" color="#1A1A1A" style={styles.sheetTitle}>
            Filters
          </Text>
          <View style={styles.filterRow}>
            <View style={styles.filterRowText}>
              <Text size="md" weight="semiBold" color="#1F2937">
                Show cancelled
              </Text>
              <Text size="sm" weight="regular" color="#8E8E93">
                Include cancelled bookings in the list
              </Text>
            </View>
            <Switch
              value={showCancelled}
              onValueChange={setShowCancelled}
              trackColor={{ false: "#E5E7EB", true: "#5299FE" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </FloatingSheet>

      {/* Vehicle picker sheet — drives the filter button above. */}
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
                setFilterVehicleId(null);
                vehiclePickerRef.current?.close();
              }}
            >
              <View style={styles.vehicleRowIconBubble}>
                <Image
                  source={require("@/assets/images/covered-car.png")}
                  style={{ width: 30, height: 20 }}
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F5F7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 40,
  },
  headerSpacer: {
    width: 40,
  },
  pickerRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "#FFFFFF",
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F2F2F7",
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
  searchRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  filterRowText: {
    flex: 1,
    gap: 2,
    marginRight: 16,
  },
  listContent: {
    padding: 20,
    gap: 12,
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
