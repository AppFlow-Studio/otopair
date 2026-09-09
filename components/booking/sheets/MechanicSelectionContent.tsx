/**
 * MechanicSelectionContent
 *
 * PURPOSE: Displays the mechanic selection UI with search, service chips, and shop cards
 *          Now grouped by shop with mechanic avatars within each card
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { Car, ChevronLeft, Search } from "lucide-react-native";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";


// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { AvailabilityModal } from "@/components/booking/modals";
// BookingFooter is now rendered by ServiceBottomSheet's footerComponent
import {
  ShopCard,
  type ShopWithMechanics,
  type SelectedSlotInfo,
  type SelectedServiceInfo,
  type SlotWithBookingMeta,
} from "./ShopCard";

// 5. Constants, hooks, types, stores
import { MECHANIC_FILTER_OPTIONS, type MechanicFilterOption } from "@/constants/filters";
import { BorderRadius, FontFamily } from "@/constants/theme";
import { calculateDistanceMiles } from "@/utils/geo";
import { hhmmToDisplayTime } from "@/utils/timeSlotUtils";
import { useBookingLaborHours } from "@/hooks/useBookingLaborHours";
import { useBookingPartsBreakdown } from "@/hooks/useBookingPartsBreakdown";
import { useServiceVehicleSpecsForEngine } from "@/hooks/useServiceVehicleSpecsForEngine";
import { useBookingStore, type SelectedMechanicSlot } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import type { Mechanic } from "@/stores/types/store.types";

// ============================================================================
// CONSTANTS
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

// Re-export from central location
export type { MechanicFilterOption } from "@/constants/filters";

interface MechanicSelectionContentProps {
  /** Called when user confirms mechanic selection */
  onSelectMechanic?: () => void;
  /** Called when user taps the car icon to open car selection */
  onCarSelect?: () => void;
  /** Called when the mechanic search input gains focus */
  onSearchFocus?: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Groups mechanics by their shopId and returns shop-centric data.
 * Merges laborRate from shops map when available.
 */
function groupMechanicsByShop(
  mechanics: Mechanic[],
  shopMeta?: Map<string, { laborRate?: number; state?: string; zip?: string }>,
): ShopWithMechanics[] {
  const shopMap = new Map<string, ShopWithMechanics>();

  mechanics.forEach((mechanic) => {
    const existing = shopMap.get(mechanic.shopId);
    if (existing) {
      existing.mechanics.push(mechanic);
      // Shop rating is a single value per shop (aggregated from
      // `reviews` by `convex/reviews.ts:submit`) — don't recompute
      // from the max mechanic rating in the group.
      if (mechanic.isVerified) {
        existing.isVerified = true;
      }
      if (mechanic.distanceMi < existing.distanceMi) {
        existing.distanceMi = mechanic.distanceMi;
      }
    } else {
      const meta = shopMeta?.get(mechanic.shopId);
      shopMap.set(mechanic.shopId, {
        shopId: mechanic.shopId,
        shopName: mechanic.shopName,
        rating: mechanic.shopRating ?? 0,
        isVerified: mechanic.isVerified,
        distanceMi: mechanic.distanceMi,
        mechanics: [mechanic],
        laborRate: meta?.laborRate,
        state: meta?.state,
        zip: meta?.zip,
      });
    }
  });

  return Array.from(shopMap.values());
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicSelectionContent({
  onSelectMechanic,
  onCarSelect,
  onSearchFocus,
}: MechanicSelectionContentProps) {
  // ═══════════════ HOOKS ═══════════════
  const router = useRouter();

  // ═══════════════ STATE ═══════════════
  const [showAvailabilityModal, setShowAvailabilityModal] = React.useState(false);
  const [availabilityMechanicId, setAvailabilityMechanicId] = React.useState<string | null>(null);
  const [availabilityShopId, setAvailabilityShopId] = React.useState<string | null>(null);

  // ═══════════════ BOOKING STORE ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const availableServices = useBookingStore((state) => state.availableServices);
  const setBookingTypeAndProceed = useBookingStore((state) => state.setBookingTypeAndProceed);
  const setScheduledAppointment = useBookingStore((state) => state.setScheduledAppointment);
  const setBookingStage = useBookingStore((state) => state.setBookingStage);
  const setSkippedBookingDetails = useBookingStore((state) => state.setSkippedBookingDetails);
  const selectedMechanicSlot = useBookingStore((state) => state.selectedMechanicSlot);
  const setSelectedMechanicSlot = useBookingStore((state) => state.setSelectedMechanicSlot);
  const getSelectedServicesTotal = useBookingStore((state) => state.getSelectedServicesTotal);
  const selectedServiceOptions = useBookingStore((state) => state.selectedServiceOptions);
  const userLocation = useBookingStore((state) => state.userLocation);

  // Memoize selected services to prevent re-renders
  const selectedServices = useMemo(
    () => availableServices.filter((service) => selectedServiceIds.includes(service.id)),
    [availableServices, selectedServiceIds],
  );

  // Get service name for footer
  const serviceName = useMemo(() => {
    if (selectedServices.length === 0) return "";
    if (selectedServices.length === 1) return selectedServices[0].name;
    return `${selectedServices.length} Services`;
  }, [selectedServices]);

  // ═══════════════ MECHANIC STORE ═══════════════
  const searchQuery = useMechanicStore((state) => state.filters.searchQuery);
  const filterType = useMechanicStore((state) => state.filters.filterType);
  const setFilters = useMechanicStore((state) => state.setFilters);
  const setSearchQuery = useMechanicStore((state) => state.setSearchQuery);
  const mechanics = useMechanicStore((state) => state.mechanics);
  const mechanicIds = useMechanicStore((state) => state.mechanicIds);
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  // Selected vehicle for car-specific (engine-specific) labor/parts
  const selectedVehicle = useVehicleStore((state) => state.getSelectedVehicle());
  const engineId = selectedVehicle?.engineId;
  const engineSpecs = useServiceVehicleSpecsForEngine(engineId, selectedServiceIds);

  // Shop labor rates, state, zip for range computation and distance (Convex data)
  const shops = useShopStore((state) => state.shops);
  const getShopById = useShopStore((state) => state.getShopById);
  const shopMetaMap = useMemo(() => {
    const m = new Map<string, { laborRate?: number; state?: string; zip?: string }>();
    for (const id of Object.keys(shops)) {
      const shop = shops[id];
      if (!shop) continue;
      m.set(id, { laborRate: shop.labor_rate, state: shop.state, zip: shop.zip });
    }
    return m;
  }, [shops]);

  // Real per-vehicle labor hours (labor_times.book_hours) and OEM parts prices
  // — same data sources as Review & Pay (app/booking/mechanic/[id]/payment.tsx)
  // so the range on each shop card matches what the customer sees after they
  // tap through. Hooks gracefully skip on walk-in vehicles + mock service ids.
  const { breakdown: pricedPartsByService, isLoading: isPricedPartsLoading } =
    useBookingPartsBreakdown(
      selectedVehicle?.ownershipId,
      selectedServiceIds,
      selectedServiceOptions,
    );
  const { laborHours: laborHoursByService, isLoading: isLaborHoursLoading } =
    useBookingLaborHours(selectedVehicle?.ownershipId, selectedServiceIds);
  const isPriceLoading = isPricedPartsLoading || isLaborHoursLoading;

  const realLaborHoursMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of laborHoursByService) m.set(String(row.serviceId), row.hours);
    return m;
  }, [laborHoursByService]);

  const realPartsCostMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of pricedPartsByService) {
      if (row.winner !== null && row.partsTotal > 0) m.set(String(row.serviceId), row.partsTotal);
    }
    return m;
  }, [pricedPartsByService]);

  // Memoize filtered mechanics with distance from user to shop (Convex shop lat/lng + booking userLocation)
  const filteredMechanics = useMemo(() => {
    let filtered = mechanicIds.map((id) => mechanics[id]).filter(Boolean);

    // Enrich with distance from user to shop (mechanics don't have coords; use shop lat/lng from Convex)
    if (userLocation?.latitude != null && userLocation?.longitude != null) {
      filtered = filtered.map((m) => {
        const shop = getShopById(m.shopId);
        if (shop?.latitude != null && shop?.longitude != null) {
          const distanceMi = calculateDistanceMiles(
            userLocation.latitude,
            userLocation.longitude,
            shop.latitude,
            shop.longitude,
          );
          return { ...m, distanceMi };
        }
        return m;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (mechanic) => mechanic.name.toLowerCase().includes(query) || mechanic.shopName.toLowerCase().includes(query),
      );
    }

    // Apply filter type and sort (rating/distance from Convex and computed distance)
    switch (filterType) {
      case "available_now":
        filtered = filtered
          .filter((mechanic) => mechanic.isAvailable)
          .sort((a, b) => {
            const responseOrder = { Quick: 0, Normal: 1, Slow: 2 };
            return responseOrder[a.responseTime] - responseOrder[b.responseTime];
          });
        break;
      case "distance":
        filtered = [...filtered].sort((a, b) => a.distanceMi - b.distanceMi);
        break;
      case "rating":
        filtered = [...filtered].sort((a, b) => b.rating - a.rating);
        break;
    }

    return filtered;
  }, [mechanics, mechanicIds, searchQuery, filterType, userLocation, getShopById]);

  // Group mechanics by shop (with labor rates, state, zip for range computation)
  const shopList = useMemo(() => {
    const list = groupMechanicsByShop(filteredMechanics, shopMetaMap);

    // Sort shops based on filter type
    switch (filterType) {
      case "distance":
        return list.sort((a, b) => a.distanceMi - b.distanceMi);
      case "rating":
        return list.sort((a, b) => b.rating - a.rating);
      case "available_now":
      default:
        return list;
    }
  }, [filteredMechanics, filterType, shopMetaMap]);

  // Convert selectedMechanicSlot to SelectedSlotInfo for ShopCard
  const selectedSlotInfo: SelectedSlotInfo | null = useMemo(() => {
    if (!selectedMechanicSlot) return null;
    return {
      shopId: selectedMechanicSlot.shopId,
      mechanicId: selectedMechanicSlot.mechanicId,
      slot: selectedMechanicSlot.slot,
    };
  }, [selectedMechanicSlot]);

  // Create SelectedServiceInfo array for ShopCard
  // Priority for labor: real labor_times.book_hours → option-specific →
  //   engine-specific → service defaults
  // Priority for parts: real OEM parts total → option-specific →
  //   engine-specific → service defaults
  // Matches the precedence in payment.tsx so the card range == Review & Pay range.
  const selectedServicesForCard: SelectedServiceInfo[] = useMemo(() => {
    return selectedServices.map((service) => {
      const optionSel = selectedServiceOptions[service.id];
      const spec = engineSpecs[service.id];
      const realHours = realLaborHoursMap.get(String(service.id));
      const realParts = realPartsCostMap.get(String(service.id));
      const laborHours =
        realHours ?? optionSel?.labor_hours ?? spec?.labor_hours ?? service.default_labor_hours;
      const partsEstimate =
        realParts ?? optionSel?.parts_cost_avg ?? spec?.parts_cost_avg ?? service.default_parts_estimate;
      return {
        id: service.id,
        name: service.name,
        price: service.price,
        default_labor_hours: laborHours,
        default_parts_estimate: partsEstimate,
        state_fee: optionSel?.state_fee,
      };
    });
  }, [selectedServices, engineSpecs, selectedServiceOptions]);
  const selectedDurationMinutes = useMemo(() => {
    const minutes = selectedServicesForCard.reduce((total, service) => {
      return total + (service.default_labor_hours ?? 0) * 60;
    }, 0);
    return minutes > 0 ? Math.ceil(minutes) : undefined;
  }, [selectedServicesForCard]);

  // ═══════════════ EFFECTS ═══════════════
  // Go back — to service_options if any selected service has options, else service_selection
  const handleGoBack = useCallback(() => {
    const anyHasOptions = availableServices.some(
      (svc) => selectedServiceIds.includes(svc.id) && svc.has_options === true,
    );
    if (anyHasOptions) {
      setBookingStage("service_options", "backward");
    } else {
      setBookingStage("service_selection", "backward");
    }
  }, [availableServices, selectedServiceIds, setBookingStage]);

  // Go back to service selection if all services are removed
  useEffect(() => {
    if (selectedServiceIds.length === 0) {
      setBookingStage("service_selection", "backward");
    }
  }, [selectedServiceIds.length, setBookingStage]);

  // Note: We intentionally do NOT clear selectedMechanicSlot on unmount
  // because the component unmounts when navigating to payment, and we need
  // to preserve the selection for when the user comes back from payment.
  // The slot is cleared by resetBookingFlow when the booking is completed or cancelled.

  // ═══════════════ HANDLERS ═══════════════
  // Handle slot selection from ShopCard (slot may include Convex timeSlotId/scheduledDate/scheduledTime)
  const handleSelectSlot = useCallback(
    (shopId: string, mechanicId: string | null, slot: SlotWithBookingMeta) => {
      const shop = shopList.find((s) => s.shopId === shopId);
      if (!shop) return;

      const mechanic = mechanicId ? getMechanicById(mechanicId) : null;

      setSelectedMechanicSlot({
        shopId,
        shopName: shop.shopName,
        mechanicId,
        mechanicName: mechanic?.name || null,
        slot: { dayOfWeek: slot.dayOfWeek, day: slot.day, time: slot.time },
        timeSlotId: slot.timeSlotId,
        scheduledDate: slot.scheduledDate,
        scheduledTime: slot.scheduledTime,
      });
    },
    [shopList, getMechanicById, setSelectedMechanicSlot],
  );

  // Handle shop details button
  const handleShopDetails = useCallback(
    (shopId: string) => {
      router.push(`/booking/shop/${shopId}`);
    },
    [router],
  );

  // Mechanic chip changed on a card that already has a selected slot.
  // Refresh the store's mechanicId + mechanicName so the footer label
  // ("with {mechanic} at {shop}") matches the avatar the user just tapped.
  // The slot's timeSlotId is mechanic-specific in Convex, but the card
  // either keeps the slot highlighted (the new mechanic shares the same
  // day/time) or the user re-taps a slot — either way the booking flow
  // re-resolves through onSelectSlot before reaching /payment.
  const handleClearSelectedSlotForShop = useCallback(
    (shopId: string) => {
      if (!selectedMechanicSlot || selectedMechanicSlot.shopId !== shopId) return;
      setSelectedMechanicSlot(null);
      setScheduledAppointment(null);
    },
    [selectedMechanicSlot, setSelectedMechanicSlot, setScheduledAppointment],
  );

  // Handle "More" availability button - opens the calendar modal
  const handleMoreAvailability = useCallback((shopId: string, mechanicId: string | null) => {
    // Pass both shopId and mechanicId to the modal
    // The modal will show all mechanics for the shop and allow switching
    setAvailabilityShopId(shopId);
    setAvailabilityMechanicId(mechanicId);
    setShowAvailabilityModal(true);
  }, []);

  // Handle closing the availability modal
  const handleCloseAvailabilityModal = useCallback(() => {
    setShowAvailabilityModal(false);
    setAvailabilityMechanicId(null);
    setAvailabilityShopId(null);
  }, []);

  // Handle availability modal confirmation - updates the selected slot
  const handleAvailabilityConfirm = useCallback((date: Date, time: string, confirmedMechanicId: string | null) => {
    // The AvailabilityModal already updates the selectedMechanicSlot in the store
    // This callback can be used for any additional actions if needed
  }, []);

  // Handle book button from footer
  const handleBook = useCallback(() => {
    if (!selectedMechanicSlot) return;

    const { mechanicId, slot, scheduledDate, scheduledTime } = selectedMechanicSlot;

    // Use Convex slot date/time when present (from "Next Availability" integration)
    let isoDate: string;
    let displayDate: string;
    if (scheduledDate) {
      isoDate = scheduledDate;
      const [y, m, d] = scheduledDate.split("-").map(Number);
      const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
      displayDate = `${d} ${months[m - 1]} ${y}`;
    } else {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const dayNum = parseInt(slot.day, 10);
      // Compare against today *at midnight*, not `now`, so a same-day slot
      // doesn't get bumped to next month (local-midnight < now is always
      // true later in the day).
      const todayMidnight = new Date(currentYear, currentMonth, now.getDate());
      let targetDate = new Date(currentYear, currentMonth, dayNum);
      if (targetDate < todayMidnight) {
        targetDate = new Date(currentYear, currentMonth + 1, dayNum);
      }
      const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
      displayDate = `${targetDate.getDate()} ${months[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
      isoDate = targetDate.toISOString().split("T")[0];
    }

    const timeDisplay = scheduledTime ? hhmmToDisplayTime(scheduledTime) : slot.time;

    const effectiveMechanicId = mechanicId ?? null;
    const routeId = effectiveMechanicId ?? selectedMechanicSlot.shopId;

    if (!routeId) return;

    setBookingTypeAndProceed("schedule_later", effectiveMechanicId);
    setScheduledAppointment({
      date: isoDate,
      time: timeDisplay,
      displayDate,
    });

    // Go directly to payment screen (skip booking details)
    setSkippedBookingDetails(true);
    setBookingStage("payment", "forward");

    onSelectMechanic?.();

    // Navigate to payment page
    router.push(`/booking/mechanic/${routeId}/payment`);
  }, [
    selectedMechanicSlot,
    setBookingTypeAndProceed,
    setScheduledAppointment,
    setSkippedBookingDetails,
    setBookingStage,
    onSelectMechanic,
    router,
  ]);

  // ═══════════════ FLATLIST HELPERS ═══════════════
  const keyExtractor = useCallback((item: ShopWithMechanics) => String(item.shopId), []);

  const renderShopCard = useCallback(
    ({ item }: { item: ShopWithMechanics }) => (
      <ShopCard
        shop={item}
        onSelectSlot={handleSelectSlot}
        onShopDetails={handleShopDetails}
        onMoreAvailability={handleMoreAvailability}
        selectedSlot={selectedSlotInfo}
        selectedServices={selectedServicesForCard}
        isPriceLoading={isPriceLoading}
        vehicleOwnerId={selectedVehicle?.ownershipId ?? null}
        onClearSelectedSlotForShop={handleClearSelectedSlotForShop}
      />
    ),
    [
      handleSelectSlot,
      handleShopDetails,
      handleMoreAvailability,
      selectedSlotInfo,
      selectedServicesForCard,
      isPriceLoading,
      selectedVehicle?.ownershipId,
      handleClearSelectedSlotForShop,
    ],
  );

  // ═══════════════ FILTER HANDLER ═══════════════
  const handleFilterSelect = useCallback(
    (filter: MechanicFilterOption) => {
      setFilters({ filterType: filter });
    },
    [setFilters],
  );

  return (
    <View style={styles.container}>
      {/* Header - Fixed at top */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleGoBack} hitSlop={8}>
          <ChevronLeft size={24} color={BrandColors.primary} />
        </Pressable>
        <Text size="xl" weight="bold" color={BrandColors.primary}>
          Choose Mechanic
        </Text>
        {/* Car selection button — shows selected vehicle thumbnail when available */}
        <Pressable style={styles.carButton} onPress={onCarSelect} hitSlop={8}>
          {selectedVehicle?.imageSource ? (
            <Image source={selectedVehicle.imageSource} style={styles.carButtonImage} resizeMode="contain" />
          ) : (
            <Car size={28} color={BrandColors.primary} />
          )}
        </Pressable>
      </View>

      {/* Search Input - Fixed outside scroll view */}
      <View style={styles.searchContainer}>
        <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for mechanics..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={onSearchFocus}
        />
      </View>

      {/* Scrollable Content - Using FlatList for virtualization */}
      <BottomSheetFlatList
        data={shopList}
        keyExtractor={keyExtractor}
        renderItem={renderShopCard}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={3}
        enableFooterMarginAdjustment
        ListHeaderComponent={
          <View>
            {/* Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtersContainer}
              contentContainerStyle={styles.filtersContent}
            >
              {MECHANIC_FILTER_OPTIONS.map((option) => {
                const isSelected = filterType === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                    onPress={() => handleFilterSelect(option.id)}
                  >
                    <Text
                      size="sm"
                      weight={isSelected ? "bold" : "medium"}
                      color={isSelected ? BrandColors.white : "#6B7280"}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
      />

      {/* Footer is now handled by ServiceBottomSheet's footerComponent */}

      {/* Availability Calendar Modal */}
      <AvailabilityModal
        visible={showAvailabilityModal}
        mechanicId={availabilityMechanicId}
        shopId={availabilityShopId}
        durationMinutes={selectedDurationMinutes}
        onClose={handleCloseAvailabilityModal}
        onConfirm={handleAvailabilityConfirm}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 32,
  },
  carButton: {
    width: 56,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  carButtonImage: {
    width: 56,
    height: 40,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: BrandColors.primary,
  },
  filtersContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    maxHeight: 40,
  },
  filtersContent: {
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: "#F3F4F6",
    borderRadius: BorderRadius.full,
  },
  filterChipSelected: {
    backgroundColor: BrandColors.primary,
  },
});
