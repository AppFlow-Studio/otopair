/**
 * CarSelectionContent
 *
 * PURPOSE: Vertical list for selecting which car to service.
 *          Shown when user taps the car icon in the ServiceBottomSheet header.
 *          Header "Select Vehicle", list of vehicles (tap to select), Add a vehicle.
 *          Confirm button is rendered as the sheet footer by ServiceBottomSheet.
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { X } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { CarSelectionCard } from "../CarSelectionCard";

// 5. Constants, hooks, types, stores
import { BorderRadius, Spacing } from "@/constants/theme";
import { useVehicleStore, type Vehicle } from "@/stores/useVehicleStore";

/** Sheet height shows this many rows; more than this → list becomes scrollable. Must match ServiceBottomSheet CAR_SELECTION_MAX_VISIBLE. */
const MAX_VISIBLE_ROWS = 5;

// ============================================================================
// TYPES
// ============================================================================

interface CarSelectionContentProps {
  /** Called when user closes the car selection (X button or after confirm) */
  onClose?: () => void;
  /** Called when user taps "Add a vehicle" (optional – e.g. navigate to add vehicle) */
  onAddVehicle?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CarSelectionContent({ onClose, onAddVehicle }: CarSelectionContentProps) {
  // ═══════════════ STORE ═══════════════
  const vehicles = useVehicleStore((state) => state.vehicles);
  const vehicleIds = useVehicleStore((state) => state.vehicleIds);
  const selectedVehicleId = useVehicleStore((state) => state.selectedVehicleId);
  const selectVehicle = useVehicleStore((state) => state.selectVehicle);

  // ═══════════════ COMPUTED ═══════════════
  const vehiclesList = vehicleIds.map((id) => vehicles[id]).filter((v): v is Vehicle => Boolean(v));

  // ═══════════════ HANDLERS ═══════════════
  const handleSelect = useCallback(
    (vehicle: Vehicle) => {
      selectVehicle(vehicle.id);
    },
    [selectVehicle]
  );

  // ═══════════════ RENDER ═══════════════
  return (
    <View style={styles.container}>
      {/* Close button */}
      <TouchableOpacity
        onPress={onClose}
        style={styles.closeButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={20} color={BrandColors.primary} />
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Text size="xl" weight="bold" color={BrandColors.primary}>
          Select Vehicle
        </Text>
        <Text size="sm" color="#6B7280" style={styles.subtitle}>
          {vehiclesList.length} vehicle{vehiclesList.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* List: maxed at 5 visible rows; more than 5 cars → scrollable */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={vehiclesList.length > MAX_VISIBLE_ROWS}
        scrollEnabled={vehiclesList.length > MAX_VISIBLE_ROWS}
        keyboardShouldPersistTaps="handled"
      >
        {vehiclesList.map((vehicle) => (
          <CarSelectionCard
            key={vehicle.id}
            variant="row"
            vehicle={vehicle}
            isSelected={vehicle.id === selectedVehicleId}
            onSelect={() => handleSelect(vehicle)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: Spacing.lg,
  },
  closeButton: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.lg,
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  header: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    paddingRight: 40,
  },
  subtitle: {
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: Spacing.lg,
  },
});
