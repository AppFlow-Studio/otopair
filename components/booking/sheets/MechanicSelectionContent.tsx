/**
 * MechanicSelectionContent
 *
 * PURPOSE: Displays the mechanic selection UI with search, service chips, and mechanic cards
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { ChevronLeft, Search } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BorderRadius, FontFamily } from "@/constants/theme";
import { useBookingTransition } from "@/hooks/useBookingTransition";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";

// 5. Flow-specific components (booking folder)
import type { MechanicFilterOption } from "@/constants/filters";
import { DiscardServiceModal } from "./DiscardServiceModal";
import { MechanicCard } from "./MechanicCard";
import { ServiceChip } from "./ServiceChip";

// ============================================================================
// CONSTANTS
// ============================================================================

// Tab bar offset used for bottom padding to ensure content scrolls above native tabs
const TAB_BAR_OFFSET = 200;

// ============================================================================
// TYPES
// ============================================================================

// Re-export from central location
export type { MechanicFilterOption } from "@/constants/filters";

interface MechanicSelectionContentProps {
  /** Called when user confirms mechanic selection */
  onSelectMechanic?: () => void;
  /** Called when user presses back button */
  onBackPress?: () => void;
  /** Currently selected filter from TopBar */
  mechanicFilter?: MechanicFilterOption;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicSelectionContent({
  onSelectMechanic,
  onBackPress,
  mechanicFilter = "available_now",
}: MechanicSelectionContentProps) {
  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();

  // ═══════════════ STATE ═══════════════
  const [serviceToRemove, setServiceToRemove] = React.useState<string | null>(null);
  const [dontAskAgain, setDontAskAgain] = React.useState(false);

  // Calculate bottom padding to ensure content can scroll above native tab bar
  const scrollPaddingBottom = TAB_BAR_OFFSET + insets.bottom + 20;

  // ═══════════════ TRANSITION HOOK ═══════════════
  const { goBack } = useBookingTransition();

  // ═══════════════ BOOKING STORE ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const availableServices = useBookingStore((state) => state.availableServices);
  const setBookingTypeAndProceed = useBookingStore((state) => state.setBookingTypeAndProceed);

  // Memoize selected services to prevent re-renders
  const selectedServices = useMemo(
    () => availableServices.filter((service) => selectedServiceIds.includes(service.id)),
    [availableServices, selectedServiceIds]
  );

  // ═══════════════ MECHANIC STORE ═══════════════
  const searchQuery = useMechanicStore((state) => state.filters.searchQuery);
  const filterType = useMechanicStore((state) => state.filters.filterType);
  const setFilters = useMechanicStore((state) => state.setFilters);
  const setSearchQuery = useMechanicStore((state) => state.setSearchQuery);
  const mechanics = useMechanicStore((state) => state.mechanics);
  const mechanicIds = useMechanicStore((state) => state.mechanicIds);

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

  // ═══════════════ EFFECTS ═══════════════
  // Go back to service selection if all services are removed
  useEffect(() => {
    if (selectedServiceIds.length === 0) {
      goBack();
    }
  }, [selectedServiceIds.length, goBack]);

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

  const handleBookNow = useCallback(
    (mechanicId: number) => {
      // Set booking type to "book_now" and proceed to booking details
      setBookingTypeAndProceed("book_now", mechanicId);
      onSelectMechanic?.();
    },
    [setBookingTypeAndProceed, onSelectMechanic]
  );

  const handleScheduleLater = useCallback(
    (mechanicId: number) => {
      // Set booking type to "schedule_later" and proceed to booking details
      setBookingTypeAndProceed("schedule_later", mechanicId);
      onSelectMechanic?.();
    },
    [setBookingTypeAndProceed, onSelectMechanic]
  );

  // ═══════════════ FLATLIST HELPERS ═══════════════
  const keyExtractor = useCallback((item: (typeof filteredMechanics)[0]) => String(item.id), []);

  const renderMechanicCard = useCallback(
    ({ item }: { item: (typeof filteredMechanics)[0] }) => (
      <MechanicCard mechanic={item} onBookNow={handleBookNow} onScheduleLater={handleScheduleLater} />
    ),
    [handleBookNow, handleScheduleLater]
  );

  // Handle back button
  const handleBackPress = useCallback(() => {
    if (onBackPress) {
      onBackPress();
    } else {
      goBack();
    }
  }, [onBackPress, goBack]);

  // ═══════════════ SYNC FILTER FROM PROPS ═══════════════
  useEffect(() => {
    setFilters({ filterType: mechanicFilter });
  }, [mechanicFilter, setFilters]);

  return (
    <View style={styles.container}>
      {/* Header with Back Button - Fixed at top */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress} activeOpacity={0.7}>
          <ChevronLeft size={24} color={BrandColors.primary} />
        </TouchableOpacity>
        <Text size="xl" weight="bold" color={BrandColors.primary}>
          Choose Mechanic
        </Text>
        <View style={styles.headerSpacer} />
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
        data={filteredMechanics}
        keyExtractor={keyExtractor}
        renderItem={renderMechanicCard}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingBottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={3}
        ListHeaderComponent={
          selectedServices.length > 0 ? (
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
          ) : null
        }
      />

      {/* Discard Service Modal */}
      <DiscardServiceModal
        visible={serviceToRemove !== null}
        onClose={handleCloseModal}
        onConfirm={handleConfirmRemove}
        onDontAskAgain={handleDontAskAgain}
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
    // Note: paddingBottom is applied dynamically based on safe area insets
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
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -Spacing.sm,
  },
  headerSpacer: {
    width: 40,
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
  chipsContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    maxHeight: 72,
  },
  chipsContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
});
