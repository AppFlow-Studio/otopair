/**
 * BookingFooter
 *
 * PURPOSE: Sticky footer for mechanic selection showing booking status and action button
 *
 * USED IN: components/booking/sheets/MechanicSelectionContent.tsx
 *
 * STATES:
 *   - No selection: Shows "Select time to continue" prompt
 *   - Time selected: Shows selected time, mechanic, shop, and "Book $XX" button
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { ArrowRight, ChevronRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BorderRadius, Shadows } from "@/constants/theme";
import type { MechanicAvailabilitySlot } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

interface BookingFooterProps {
  /** Name of the selected service(s) */
  serviceName: string;
  /** Whether a time slot is selected */
  hasSelection: boolean;
  /** Selected slot information */
  selectedSlot?: {
    day: string;
    dayOfWeek: string;
    time: string;
  } | null;
  /** Name of the shop */
  shopName?: string;
  /** Name of the mechanic (null = "Any") */
  mechanicName?: string | null;
  /** Total price for the booking */
  totalPrice: number;
  /** Called when "Book" button is pressed */
  onBook: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BookingFooter = memo(function BookingFooter({
  serviceName,
  hasSelection,
  selectedSlot,
  shopName,
  mechanicName,
  totalPrice,
  onBook,
}: BookingFooterProps) {
  const insets = useSafeAreaInsets();

  if (!hasSelection) {
    // No selection state - prompt to select time
    return (
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <View style={styles.noSelectionContent}>
          <View style={styles.serviceLabel}>
            <Text size="xs" weight="bold" color="#9CA3AF" style={styles.serviceLabelText}>
              SERVICE
            </Text>
            <Text size="sm" weight="bold" color={BrandColors.primary}>
              {serviceName.toUpperCase()}
            </Text>
          </View>
          <View style={styles.promptContainer}>
            <Text size="sm" weight="medium" color="#9CA3AF">
              Select time to continue
            </Text>
            <ChevronRight size={16} color="#9CA3AF" />
          </View>
        </View>
      </View>
    );
  }

  // Selection made state - show details and book button
  const displayMechanic = mechanicName || "Any mechanic";
  const displayDate = selectedSlot ? `${selectedSlot.dayOfWeek} ${selectedSlot.day} · ${selectedSlot.time}` : "";

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
      <View style={styles.selectionContent}>
        {/* Left side - booking details */}
        <View style={styles.detailsContainer}>
          <Text size="xs" weight="bold" color={BrandColors.secondary}>
            {serviceName.toUpperCase()}
          </Text>
          <Text size="sm" weight="bold" color={BrandColors.secondary}>
            {displayDate}
          </Text>
          <Text size="xs" weight="regular" color="#6B7280" numberOfLines={1}>
            with {displayMechanic} at {shopName}
          </Text>
        </View>

        {/* Right side - book button */}
        <TouchableOpacity
          style={styles.bookButton}
          onPress={onBook}
          activeOpacity={0.8}
        >
          <Text size="md" weight="bold" color={BrandColors.white}>
            Book ${totalPrice}
          </Text>
          <ArrowRight size={18} color={BrandColors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BrandColors.white,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.md,
  },
  noSelectionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  serviceLabel: {
    flex: 1,
  },
  serviceLabelText: {
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  promptContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  selectionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  detailsContainer: {
    flex: 1,
  },
  bookButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: BrandColors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
});
