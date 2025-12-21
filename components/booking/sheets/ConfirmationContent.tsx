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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius } from "@/constants/theme";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";

// ============================================================================
// CONSTANTS
// ============================================================================

// Tab bar offset - extra padding to ensure button is positioned above native tabs
const TAB_BAR_OFFSET = 120;

// ============================================================================
// TYPES
// ============================================================================

interface ConfirmationContentProps {
  /** Called when user wants to book another service */
  onBookAgain?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ConfirmationContent({ onBookAgain }: ConfirmationContentProps) {
  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();

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
                {mechanic.distanceMi} miles away
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

      {/* Actions */}
      <View style={[styles.actions, { bottom: TAB_BAR_OFFSET + insets.bottom }]}>
        <PrimaryButton onPress={onBookAgain} style={styles.button}>
          <Text size="md" weight="semiBold" color={BrandColors.white}>
            Book Another Service
          </Text>
        </PrimaryButton>
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
    paddingTop: Spacing.xl,
    alignItems: "center",
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
  actions: {
    position: "absolute",
    // Note: bottom is applied dynamically based on safe area insets and tab bar offset
    left: Spacing.lg,
    right: Spacing.lg,
  },
  button: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
});
