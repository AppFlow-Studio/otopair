/**
 * MechanicSelectionContent
 *
 * PURPOSE: Displays the mechanic selection UI with search, service chips, and mechanic cards
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * PROPS:
 *   - onSelectMechanic (() => void): Called when user selects a mechanic and proceeds [optional]
 *
 * EXAMPLE:
 *   <MechanicSelectionContent onSelectMechanic={handleMechanicSelected} />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ChevronLeft, Search } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BorderRadius, FontFamily } from "@/constants/theme";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";

// 5. Flow-specific components (booking folder)
import { DiscardServiceModal } from "./DiscardServiceModal";
import { MechanicCard } from "./MechanicCard";
import { ServiceChip } from "./ServiceChip";

// ============================================================================
// TYPES
// ============================================================================

export type MechanicFilterOption = "available_now" | "distance" | "rating";

interface MechanicSelectionContentProps {
  /** Called when user confirms mechanic selection */
  onSelectMechanic?: () => void;
  /** Called when user presses back button (for animated transitions) */
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
  // ═══════════════ STATE ═══════════════
  const [serviceToRemove, setServiceToRemove] = React.useState<string | null>(null);
  const [dontAskAgain, setDontAskAgain] = React.useState(false);

  // ═══════════════ BOOKING STORE ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const getSelectedServices = useBookingStore((state) => state.getSelectedServices);
  const prevBookingStage = useBookingStore((state) => state.prevBookingStage);

  const selectedServices = getSelectedServices();

  // ═══════════════ MECHANIC STORE ═══════════════
  const filters = useMechanicStore((state) => state.filters);
  const setFilters = useMechanicStore((state) => state.setFilters);
  const setSearchQuery = useMechanicStore((state) => state.setSearchQuery);
  const getFilteredMechanics = useMechanicStore((state) => state.getFilteredMechanics);

  const filteredMechanics = getFilteredMechanics();

  // ═══════════════ EFFECTS ═══════════════
  // Go back to service selection if all services are removed
  useEffect(() => {
    if (selectedServiceIds.length === 0) {
      prevBookingStage();
    }
  }, [selectedServiceIds.length, prevBookingStage]);

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
      // TODO: Set selected mechanic and proceed
      onSelectMechanic?.();
    },
    [onSelectMechanic]
  );

  const handleScheduleLater = useCallback((mechanicId: number) => {
    // TODO: Open date/time picker modal
    console.log("Schedule later for mechanic:", mechanicId);
  }, []);

  // Handle back button - use onBackPress if provided (for animation), otherwise prevBookingStage
  const handleBackPress = useCallback(() => {
    if (onBackPress) {
      onBackPress();
    } else {
      prevBookingStage();
    }
  }, [onBackPress, prevBookingStage]);

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
          value={filters.searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Scrollable Content */}
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Selected Services Chips */}
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

        {/* Mechanics List */}
        <View style={styles.mechanicsContainer}>
          {filteredMechanics.map((mechanic) => (
            <MechanicCard
              key={mechanic.id}
              mechanic={mechanic}
              onBookNow={handleBookNow}
              onScheduleLater={handleScheduleLater}
            />
          ))}
        </View>
      </BottomSheetScrollView>

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
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
  mechanicsContainer: {
    paddingHorizontal: Spacing.lg,
  },
});
