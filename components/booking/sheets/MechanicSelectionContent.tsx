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
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { ChevronLeft, Search } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BorderRadius } from "@/constants/theme";
import { useBookingStore } from "@/stores/useBookingStore";

// 5. Flow-specific components (booking folder)
import { DiscardServiceModal } from "./DiscardServiceModal";
import { MechanicCard, type MechanicData } from "./MechanicCard";
import { ServiceChip } from "./ServiceChip";

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_MECHANICS: MechanicData[] = [
  {
    id: 1,
    name: "John Rodriguez",
    shopName: "Premium Auto Care",
    rating: 4.8,
    isVerified: true,
    photoUrl: null,
    distanceMi: 0.8,
    services: ["Car Repair and Maintenance", "Diagnostics and Troubleshooting"],
    isAvailable: true,
    responseTime: "Quick",
    nextAvailability: [
      { dayOfWeek: "Wed", day: "10", time: "9:00 AM" },
      { dayOfWeek: "Fri", day: "12", time: "1:00 PM" },
      { dayOfWeek: "Sat", day: "13", time: "2:00 PM" },
    ],
  },
  {
    id: 2,
    name: "Mike Johnson",
    shopName: "Quick Fix Garage",
    rating: 4.8,
    isVerified: true,
    photoUrl: null,
    distanceMi: 2.1,
    services: ["Oil Changes", "Brake Service", "Tire Rotation"],
    isAvailable: true,
    responseTime: "Normal",
    nextAvailability: [
      { dayOfWeek: "Thu", day: "11", time: "10:00 AM" },
      { dayOfWeek: "Fri", day: "12", time: "3:00 PM" },
      { dayOfWeek: "Mon", day: "15", time: "9:00 AM" },
    ],
  },
  {
    id: 3,
    name: "Sarah Chen",
    shopName: "Elite Motors",
    rating: 4.9,
    isVerified: true,
    photoUrl: null,
    distanceMi: 3.5,
    services: ["Engine Diagnostics", "Transmission Repair", "AC Service"],
    isAvailable: false,
    responseTime: "Quick",
    nextAvailability: [
      { dayOfWeek: "Mon", day: "15", time: "11:00 AM" },
      { dayOfWeek: "Tue", day: "16", time: "2:00 PM" },
      { dayOfWeek: "Wed", day: "17", time: "10:00 AM" },
    ],
  },
];

// ============================================================================
// TYPES
// ============================================================================

interface MechanicSelectionContentProps {
  /** Called when user confirms mechanic selection */
  onSelectMechanic?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicSelectionContent({ onSelectMechanic }: MechanicSelectionContentProps) {
  // ═══════════════ STATE ═══════════════
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceToRemove, setServiceToRemove] = useState<string | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  // ═══════════════ STORE ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const getSelectedServices = useBookingStore((state) => state.getSelectedServices);
  const prevBookingStage = useBookingStore((state) => state.prevBookingStage);

  const selectedServices = getSelectedServices();

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

  // ═══════════════ FILTERED MECHANICS ═══════════════
  const filteredMechanics = MOCK_MECHANICS.filter((mechanic) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return mechanic.name.toLowerCase().includes(query) || mechanic.shopName.toLowerCase().includes(query);
  });

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={prevBookingStage} activeOpacity={0.7}>
          <ChevronLeft size={24} color={BrandColors.primary} />
        </TouchableOpacity>
        <Text size="xl" weight="bold" color={BrandColors.primary}>
          Choose Mechanic
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
        <BottomSheetTextInput
          style={styles.searchInput}
          placeholder="Search for mechanics..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

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
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredMechanics.map((mechanic) => (
          <MechanicCard
            key={mechanic.id}
            mechanic={mechanic}
            onBookNow={handleBookNow}
            onScheduleLater={handleScheduleLater}
          />
        ))}
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
    backgroundColor: "#F5F7FA",
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: BrandColors.primary,
    paddingVertical: Spacing.xs,
  },
  chipsContainer: {
    marginTop: Spacing.md,
    maxHeight: 72,
  },
  chipsContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  scrollView: {
    flex: 1,
    marginTop: Spacing.md,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
});
