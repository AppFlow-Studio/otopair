/**
 * AvailabilitySlots
 *
 * PURPOSE: Displays a horizontal scrollable list of availability time slots
 *          with a "View All" button for accessing the full availability sheet
 *
 * USED IN: components/booking/sheets/BookingDetailsContent.tsx
 *
 * PROPS:
 *   - slots (AvailabilitySlot[]): Array of availability slots to display
 *   - selectedIndex (number | null): Currently selected slot index
 *   - onSlotSelect ((index: number) => void): Called when a slot is selected
 *   - onViewAll (() => void): Called when "View All" button is pressed
 *
 * EXAMPLE:
 *   <AvailabilitySlots
 *     slots={mechanic.nextAvailability}
 *     selectedIndex={selectedSlotIndex}
 *     onSlotSelect={setSelectedSlotIndex}
 *     onViewAll={handleViewAllAvailability}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { ChevronRight } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

export interface AvailabilitySlot {
  /** Day of week abbreviation (e.g., "Mon", "Tue") */
  dayOfWeek: string;
  /** Day of month (e.g., "15", "22") */
  day: string;
  /** Time string (e.g., "9:00 AM", "2:30 PM") */
  time: string;
}

export interface AvailabilitySlotsProps {
  /** Array of availability slots to display */
  slots: AvailabilitySlot[];
  /** Currently selected slot index */
  selectedIndex: number | null;
  /** Called when a slot is selected */
  onSlotSelect: (index: number) => void;
  /** Called when "View All" button is pressed */
  onViewAll: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AvailabilitySlots({
  slots,
  selectedIndex,
  onSlotSelect,
  onViewAll,
}: AvailabilitySlotsProps) {
  if (!slots || slots.length === 0) {
    return null;
  }

  return (
    <View style={styles.availabilitySection}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.availabilitySlotsContent}
      >
        {slots.map((slot, index) => {
          const isSelected = index === selectedIndex;
          return (
            <TouchableOpacity
              key={index}
              style={[styles.availabilitySlot, isSelected && styles.selectedSlot]}
              onPress={() => onSlotSelect(index)}
              activeOpacity={0.7}
            >
              <Text size="xs" weight="medium" color={isSelected ? BrandColors.primary : "#6B7280"}>
                {slot.dayOfWeek}
              </Text>
              <Text size="lg" weight="bold" color={isSelected ? BrandColors.primary : "#374151"}>
                {slot.day}
              </Text>
              <Text size="xs" weight="medium" color={isSelected ? BrandColors.primary : "#6B7280"}>
                {slot.time}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* View All Availability Button */}
      <TouchableOpacity style={styles.viewAllButton} activeOpacity={0.7} onPress={onViewAll}>
        <Text size="sm" weight="semiBold" color={BrandColors.primary}>
          View All Availability
        </Text>
        <ChevronRight size={18} color={BrandColors.primary} />
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  availabilitySection: {
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  availabilitySlotsContent: {
    gap: Spacing.sm,
  },
  availabilitySlot: {
    width: 80,
    alignItems: "center",
    paddingVertical: Spacing.md,
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  selectedSlot: {
    backgroundColor: "#F0F7FF",
    borderColor: BrandColors.secondary,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
    gap: 4,
  },
});



