/**
 * ConfirmationContent
 *
 * PURPOSE: Displays booking confirmation after successful booking
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * OWNER: Waleed Mansour
 */

import { Calendar, CheckCircle, Clock, MapPin } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius } from "@/constants/theme";
import { useDistanceUnit } from "@/hooks/useDistanceUnit";
import { formatProximityDistanceFromMiles } from "@/utils/geo";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";

// ============================================================================
// CONSTANTS
// ============================================================================

// Note: Footer button is now rendered by ServiceBottomSheet.footerComponent
// This ensures the BottomSheet knows about the footer and adjusts scroll area automatically

// ============================================================================
// COMPONENT
// ============================================================================

export function ConfirmationContent() {
  const distanceUnit = useDistanceUnit();
  // ═══════════════ STORE ═══════════════
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
  const bookingType = useBookingStore((state) => state.bookingType);
  const getSelectedServicesTotal = useBookingStore((state) => state.getSelectedServicesTotal);
  const getSelectedServicesCount = useBookingStore((state) => state.getSelectedServicesCount);
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  // ═══════════════ COMPUTED ═══════════════
  const mechanic = useMemo(() => {
    if (!selectedMechanicId) return null;
    return getMechanicById(selectedMechanicId);
  }, [selectedMechanicId, getMechanicById]);

  const totalPrice = getSelectedServicesTotal();
  const servicesCount = getSelectedServicesCount();
  const isScheduled = bookingType === "schedule_later";

  // Mock confirmation data
  const confirmationNumber = `OTO-${Date.now().toString(36).toUpperCase()}`;
  const estimatedTime = isScheduled ? "Scheduled appointment" : "Today, within 2 hours";

  return (
    <View style={styles.container}>
      {/* Header - Fixed at top */}
      <View style={styles.header}>
        <Text size="xl" weight="bold" color={BrandColors.primary}>
          Confirmation
        </Text>
      </View>

      {/* Success Icon */}
      <View style={styles.iconContainer}>
        <CheckCircle size={64} color="#10B981" strokeWidth={1.5} />
      </View>

      {/* Success Message */}
      <Text size="2xl" weight="bold" color={BrandColors.primary} center style={styles.title}>
        Booking Confirmed!
      </Text>
      <Text size="md" weight="regular" color="#6B7280" center style={styles.subtitle}>
        Your appointment has been successfully booked
      </Text>

      {/* Confirmation Number */}
      <View style={styles.confirmationBox}>
        <Text size="xs" weight="medium" color="#6B7280">
          Confirmation Number
        </Text>
        <Text size="lg" weight="bold" color={BrandColors.primary}>
          {confirmationNumber}
        </Text>
      </View>

      {/* Details Card */}
      <View style={styles.detailsCard}>
        {/* Mechanic/Shop */}
        {mechanic && (
          <View style={styles.detailRow}>
            <MapPin size={20} color={BrandColors.secondary} />
            <View style={styles.detailText}>
              <Text size="sm" weight="medium" color={BrandColors.primary}>
                {mechanic.shopName}
              </Text>
              <Text size="xs" weight="regular" color="#6B7280">
                {formatProximityDistanceFromMiles(mechanic.distanceMi, distanceUnit)} away
              </Text>
            </View>
          </View>
        )}

        {/* Time */}
        <View style={styles.detailRow}>
          <Clock size={20} color={BrandColors.secondary} />
          <View style={styles.detailText}>
            <Text size="sm" weight="medium" color={BrandColors.primary}>
              {estimatedTime}
            </Text>
            <Text size="xs" weight="regular" color="#6B7280">
              {isScheduled ? "You'll receive a reminder" : "Mechanic on the way"}
            </Text>
          </View>
        </View>

        {/* Services Summary */}
        <View style={styles.detailRow}>
          <Calendar size={20} color={BrandColors.secondary} />
          <View style={styles.detailText}>
            <Text size="sm" weight="medium" color={BrandColors.primary}>
              {servicesCount} Service{servicesCount > 1 ? "s" : ""} Selected
            </Text>
            <Text size="xs" weight="regular" color="#6B7280">
              Total: ${totalPrice}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    width: "100%",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    marginBottom: Spacing.xl,
  },
  confirmationBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  detailsCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: "100%",
    gap: Spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  detailText: {
    flex: 1,
    gap: 2,
  },
});
