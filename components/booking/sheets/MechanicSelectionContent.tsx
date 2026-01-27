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
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { Car, ChevronLeft, Search } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { AvailabilityModal } from "@/components/booking/modals";
// BookingFooter is now rendered by ServiceBottomSheet's footerComponent
import { DiscardServiceModal } from "./DiscardServiceModal";
import { ServiceChip } from "./ServiceChip";
import { ShopCard, type ShopWithMechanics, type SelectedSlotInfo, type SelectedServiceInfo } from "./ShopCard";

// 5. Constants, hooks, types, stores
import { MECHANIC_FILTER_OPTIONS, type MechanicFilterOption } from "@/constants/filters";
import { BorderRadius, FontFamily } from "@/constants/theme";
import { useBookingStore, type SelectedMechanicSlot } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import type { Mechanic, MechanicAvailabilitySlot } from "@/stores/types/store.types";

// ============================================================================
// CONSTANTS
// ============================================================================

const FOOTER_HEIGHT = 100; // Approximate footer height for padding

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
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Groups mechanics by their shopId and returns shop-centric data
 */
function groupMechanicsByShop(mechanics: Mechanic[]): ShopWithMechanics[] {
  const shopMap = new Map<number, ShopWithMechanics>();

  mechanics.forEach((mechanic) => {
    const existing = shopMap.get(mechanic.shopId);
    if (existing) {
      existing.mechanics.push(mechanic);
      // Update rating to highest
      if (mechanic.rating > existing.rating) {
        existing.rating = mechanic.rating;
      }
      // Update verified if any mechanic is verified
      if (mechanic.isVerified) {
        existing.isVerified = true;
      }
      // Update distance to closest
      if (mechanic.distanceMi < existing.distanceMi) {
        existing.distanceMi = mechanic.distanceMi;
      }
    } else {
      shopMap.set(mechanic.shopId, {
        shopId: mechanic.shopId,
        shopName: mechanic.shopName,
        rating: mechanic.rating,
        isVerified: mechanic.isVerified,
        distanceMi: mechanic.distanceMi,
        mechanics: [mechanic],
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
}: MechanicSelectionContentProps) {
  // ═══════════════ HOOKS ═══════════════
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ═══════════════ STATE ═══════════════
  const [serviceToRemove, setServiceToRemove] = React.useState<string | null>(null);
  const [dontAskAgain, setDontAskAgain] = React.useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = React.useState(false);
  const [availabilityMechanicId, setAvailabilityMechanicId] = React.useState<number | null>(null);
  const [availabilityShopId, setAvailabilityShopId] = React.useState<number | null>(null);

  // ═══════════════ BOOKING STORE ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const availableServices = useBookingStore((state) => state.availableServices);
  const prevBookingStage = useBookingStore((state) => state.prevBookingStage);
  const setBookingTypeAndProceed = useBookingStore((state) => state.setBookingTypeAndProceed);
  const setScheduledAppointment = useBookingStore((state) => state.setScheduledAppointment);
  const setBookingStage = useBookingStore((state) => state.setBookingStage);
  const setSkippedBookingDetails = useBookingStore((state) => state.setSkippedBookingDetails);
  const selectedMechanicSlot = useBookingStore((state) => state.selectedMechanicSlot);
  const setSelectedMechanicSlot = useBookingStore((state) => state.setSelectedMechanicSlot);
  const getSelectedServicesTotal = useBookingStore((state) => state.getSelectedServicesTotal);

  // Memoize selected services to prevent re-renders
  const selectedServices = useMemo(
    () => availableServices.filter((service) => selectedServiceIds.includes(service.id)),
    [availableServices, selectedServiceIds]
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

  // Memoize filtered mechanics to prevent re-renders on sheet collapse/expand
  const filteredMechanics = useMemo(() => {
    let filtered = mechanicIds.map((id) => mechanics[id]).filter(Boolean);

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (mechanic) => mechanic.name.toLowerCase().includes(query) || mechanic.shopName.toLowerCase().includes(query)
      );
    }

    // Apply filter type and sort
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
  }, [mechanics, mechanicIds, searchQuery, filterType]);

  // Group mechanics by shop
  const shopList = useMemo(() => {
    const shops = groupMechanicsByShop(filteredMechanics);
    
    // Sort shops based on filter type
    switch (filterType) {
      case "distance":
        return shops.sort((a, b) => a.distanceMi - b.distanceMi);
      case "rating":
        return shops.sort((a, b) => b.rating - a.rating);
      case "available_now":
      default:
        return shops;
    }
  }, [filteredMechanics, filterType]);

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
  const selectedServicesForCard: SelectedServiceInfo[] = useMemo(() => {
    return selectedServices.map((service) => ({
      id: service.id,
      name: service.name,
      price: service.price,
    }));
  }, [selectedServices]);

  // ═══════════════ EFFECTS ═══════════════
  // Go back to service selection if all services are removed
  useEffect(() => {
    if (selectedServiceIds.length === 0) {
      prevBookingStage();
    }
  }, [selectedServiceIds.length, prevBookingStage]);

  // Note: We intentionally do NOT clear selectedMechanicSlot on unmount
  // because the component unmounts when navigating to payment, and we need
  // to preserve the selection for when the user comes back from payment.
  // The slot is cleared by resetBookingFlow when the booking is completed or cancelled.

  // ═══════════════ HANDLERS ═══════════════
  const handleRemoveService = useCallback(
    (serviceId: string) => {
      if (dontAskAgain) {
        // Remove directly without confirmation
        toggleServiceSelection(serviceId);
      } else {
        // Show confirmation modal
        setServiceToRemove(serviceId);
      }
    },
    [dontAskAgain, toggleServiceSelection]
  );

  const handleConfirmRemove = useCallback(() => {
    if (serviceToRemove) {
      toggleServiceSelection(serviceToRemove);
      setServiceToRemove(null);
    }
  }, [serviceToRemove, toggleServiceSelection]);

  const handleCloseModal = useCallback(() => {
    setServiceToRemove(null);
  }, []);

  const handleDontAskAgain = useCallback(() => {
    setDontAskAgain(true);
    // Also confirm the current removal
    if (serviceToRemove) {
      toggleServiceSelection(serviceToRemove);
      setServiceToRemove(null);
    }
  }, [serviceToRemove, toggleServiceSelection]);

  // Handle slot selection from ShopCard
  const handleSelectSlot = useCallback(
    (shopId: number, mechanicId: number | null, slot: MechanicAvailabilitySlot) => {
      const shop = shopList.find((s) => s.shopId === shopId);
      if (!shop) return;

      const mechanic = mechanicId ? getMechanicById(mechanicId) : null;

      setSelectedMechanicSlot({
        shopId,
        shopName: shop.shopName,
        mechanicId,
        mechanicName: mechanic?.name || null,
        slot,
      });
    },
    [shopList, getMechanicById, setSelectedMechanicSlot]
  );

  // Handle shop details button
  const handleShopDetails = useCallback(
    (shopId: number) => {
      router.push(`/home/shop/${shopId}`);
    },
    [router]
  );

  // Handle "More" availability button - opens the calendar modal
  const handleMoreAvailability = useCallback(
    (shopId: number, mechanicId: number | null) => {
      // Pass both shopId and mechanicId to the modal
      // The modal will show all mechanics for the shop and allow switching
      setAvailabilityShopId(shopId);
      setAvailabilityMechanicId(mechanicId);
      setShowAvailabilityModal(true);
    },
    []
  );

  // Handle closing the availability modal
  const handleCloseAvailabilityModal = useCallback(() => {
    setShowAvailabilityModal(false);
    setAvailabilityMechanicId(null);
    setAvailabilityShopId(null);
  }, []);

  // Handle availability modal confirmation - updates the selected slot
  const handleAvailabilityConfirm = useCallback(
    (date: Date, time: string, confirmedMechanicId: number) => {
      // The AvailabilityModal already updates the selectedMechanicSlot in the store
      // This callback can be used for any additional actions if needed
    },
    []
  );

  // Handle book button from footer
  const handleBook = useCallback(() => {
    if (!selectedMechanicSlot) return;

    const { mechanicId, slot } = selectedMechanicSlot;

    // Convert slot to scheduled appointment format
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const dayNum = parseInt(slot.day, 10);

    // Construct date from slot day
    let targetDate = new Date(currentYear, currentMonth, dayNum);
    if (targetDate < now) {
      targetDate = new Date(currentYear, currentMonth + 1, dayNum);
    }

    const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
    const displayDate = `${targetDate.getDate()} ${months[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
    const isoDate = targetDate.toISOString().split("T")[0];

    // Use the first mechanic from the shop if "Any" was selected
    const effectiveMechanicId = mechanicId || shopList.find((s) => s.shopId === selectedMechanicSlot.shopId)?.mechanics[0]?.id;
    
    if (!effectiveMechanicId) return;

    // Set appointment in store
    setBookingTypeAndProceed("schedule_later", effectiveMechanicId);
    setScheduledAppointment({
      date: isoDate,
      time: slot.time,
      displayDate,
    });

    // Go directly to payment screen (skip booking details)
    setSkippedBookingDetails(true);
    setBookingStage("payment", "forward");

    onSelectMechanic?.();
    
    // Navigate to payment page
    router.push(`/home/mechanic/${effectiveMechanicId}/payment`);
  }, [selectedMechanicSlot, shopList, setBookingTypeAndProceed, setScheduledAppointment, setSkippedBookingDetails, setBookingStage, onSelectMechanic, router]);

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
      />
    ),
    [handleSelectSlot, handleShopDetails, handleMoreAvailability, selectedSlotInfo, selectedServicesForCard]
  );

  // ═══════════════ FILTER HANDLER ═══════════════
  const handleFilterSelect = useCallback(
    (filter: MechanicFilterOption) => {
      setFilters({ filterType: filter });
    },
    [setFilters]
  );

  return (
    <View style={styles.container}>
      {/* Header - Fixed at top */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={prevBookingStage} hitSlop={8}>
          <ChevronLeft size={24} color={BrandColors.primary} />
        </Pressable>
        <Text size="xl" weight="bold" color={BrandColors.primary}>
          Choose Mechanic
        </Text>
        {/* Car selection button */}
        <Pressable style={styles.carButton} onPress={onCarSelect} hitSlop={8}>
          <Car size={20} color={BrandColors.primary} />
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
        />
      </View>

      {/* Scrollable Content - Using FlatList for virtualization */}
      <BottomSheetFlatList
        data={shopList}
        keyExtractor={keyExtractor}
        renderItem={renderShopCard}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: FOOTER_HEIGHT + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={3}
        ListHeaderComponent={
          <View>
            {/* Selected Service Chips */}
            {selectedServices.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsContainer}
                contentContainerStyle={styles.chipsContent}
              >
                {selectedServices.map((service) => (
                  <ServiceChip key={service.id} service={service} onRemove={handleRemoveService} />
                ))}
              </ScrollView>
            )}

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

      {/* Discard Service Modal */}
      <DiscardServiceModal
        visible={serviceToRemove !== null}
        onClose={handleCloseModal}
        onConfirm={handleConfirmRemove}
        onDontAskAgain={handleDontAskAgain}
      />

      {/* Availability Calendar Modal */}
      <AvailabilityModal
        visible={showAvailabilityModal}
        mechanicId={availabilityMechanicId}
        shopId={availabilityShopId}
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
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
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
  chipsContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    maxHeight: 72,
  },
  chipsContent: {
    paddingVertical: Spacing.xs,
  },
});
