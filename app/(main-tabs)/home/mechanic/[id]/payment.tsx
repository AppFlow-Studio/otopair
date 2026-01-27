/**
 * Payment Screen (Review & Pay)
 *
 * PURPOSE: Full-screen page for reviewing booking and payment details.
 *          Shows mechanic info, appointment details, vehicle, detailed services breakdown,
 *          and inline payment options (Apple Pay, Google Pay, saved cards).
 *
 * FLOW: mechanic detail → booking-details → payment → confirmation
 *
 * ROUTE: /home/mechanic/[id]/payment
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useMemo } from "react";
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Expo & Third-party
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { Calendar, Car, ChevronRight, FileText, Info, Lock, Star } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { BookingPageHeader } from "@/components/booking/pages";

// 5. Constants, hooks, types, stores
import { BorderRadius, Shadows } from "@/constants/theme";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

// ============================================================================
// CONSTANTS
// ============================================================================

const PLATFORM_FEE = 4.79;
const TAXES_AND_FEES = 5.00;

// Labor rate per hour (for breakdown display)
const LABOR_RATE_PER_HOUR = 30.00;


// ============================================================================
// COMPONENT
// ============================================================================

export default function PaymentScreen() {
  // ═══════════════ HOOKS ═══════════════
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // ═══════════════ BOOKING STORE ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const availableServices = useBookingStore((state) => state.availableServices);
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
  const getFormattedAppointmentDate = useBookingStore((state) => state.getFormattedAppointmentDate);
  const getFormattedAppointmentTime = useBookingStore((state) => state.getFormattedAppointmentTime);
  const createBooking = useBookingStore((state) => state.createBooking);
  const bookingType = useBookingStore((state) => state.bookingType);
  const setBookingStage = useBookingStore((state) => state.setBookingStage);
  const skippedBookingDetails = useBookingStore((state) => state.skippedBookingDetails);

  // ═══════════════ MECHANIC STORE ═══════════════
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  // ═══════════════ VEHICLE STORE ═══════════════
  const getSelectedVehicle = useVehicleStore((state) => state.getSelectedVehicle);

  // ═══════════════ PAYMENT STORE ═══════════════
  const getSelectedPaymentMethod = usePaymentStore((state) => state.getSelectedPaymentMethod);
  const hasPaymentMethods = usePaymentStore((state) => state.hasPaymentMethods);

  // ═══════════════ COMPUTED ═══════════════
  const appointmentDate = getFormattedAppointmentDate();
  const appointmentTime = getFormattedAppointmentTime();
  const selectedVehicle = getSelectedVehicle();

  const mechanic = useMemo(() => {
    if (!selectedMechanicId) return null;
    return getMechanicById(selectedMechanicId);
  }, [selectedMechanicId, getMechanicById]);

  const selectedServices = useMemo(
    () => availableServices.filter((service) => selectedServiceIds.includes(service.id)),
    [availableServices, selectedServiceIds]
  );

  // Calculate detailed breakdown
  const breakdown = useMemo(() => {
    const servicesTotal = selectedServices.reduce((total, service) => total + service.price, 0);
    // Estimate labor as 60% of services total, parts as 40%
    const laborHours = Math.max(1, Math.round((servicesTotal * 0.6) / LABOR_RATE_PER_HOUR * 2) / 2);
    const laborCost = laborHours * LABOR_RATE_PER_HOUR;
    const partsCost = servicesTotal - laborCost;
    
    return {
      laborHours,
      laborCost: Math.max(0, laborCost),
      partsCost: Math.max(0, partsCost),
      taxesAndFees: TAXES_AND_FEES,
      platformFee: PLATFORM_FEE,
      subtotal: servicesTotal,
      total: servicesTotal + PLATFORM_FEE,
    };
  }, [selectedServices]);

  // Format vehicle display
  const vehicleDisplay = selectedVehicle
    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
    : "No vehicle selected";

  // Format appointment display
  const appointmentDisplay = appointmentDate && appointmentTime
    ? `${appointmentDate} · ${appointmentTime}`
    : "Not scheduled";

  // Payment method
  const selectedPaymentMethod = getSelectedPaymentMethod();
  const hasPayment = hasPaymentMethods();

  // ═══════════════ HANDLERS ═══════════════
  const handleBack = useCallback(() => {
    if (skippedBookingDetails) {
      setBookingStage("mechanic_selection", "backward");
    } else {
      setBookingStage("booking_details", "backward");
    }
    router.back();
  }, [router, skippedBookingDetails, setBookingStage]);

  const handleConfirmPayment = useCallback(() => {
    if (selectedMechanicId) {
      try {
        createBooking(selectedMechanicId, bookingType || "book_now");
        router.push(`/home/mechanic/${id}/confirmation`);
      } catch (error) {
        console.error("Failed to create booking:", error);
      }
    }
  }, [router, id, selectedMechanicId, createBooking, bookingType]);

  const handleApplePay = useCallback(() => {
    // Apple Pay integration would go here
    handleConfirmPayment();
  }, [handleConfirmPayment]);

  const handleGooglePay = useCallback(() => {
    // Google Pay integration would go here
    handleConfirmPayment();
  }, [handleConfirmPayment]);

  // ═══════════════ RENDER ═══════════════
  if (!mechanic) {
    return (
      <View style={styles.container}>
        <BookingPageHeader title="Review & Pay" onBack={handleBack} />
        <View style={styles.errorContainer}>
          <Text size="md" weight="medium" color="#6B7280" center>
            No mechanic selected
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <BookingPageHeader title="Review & Pay" onBack={handleBack} />

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Mechanic Card with Appointment Details */}
        <View style={styles.mechanicCard}>
          {/* Mechanic Info Row */}
          <View style={styles.mechanicRow}>
            <View style={styles.avatarWrapper}>
              {mechanic.photoUrl ? (
                <Image source={{ uri: mechanic.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text size="xl" weight="bold" color="#9CA3AF">
                    {mechanic.name.charAt(0)}
                  </Text>
                </View>
              )}
              {/* Rating Badge */}
              <View style={styles.ratingBadge}>
                <Star size={10} color="#FCD34D" fill="#FCD34D" />
                <Text size="xs" weight="bold" color={BrandColors.white}>
                  {mechanic.rating.toFixed(1)}
                </Text>
              </View>
            </View>

            <View style={styles.mechanicInfo}>
              <Text size="lg" weight="bold" color={BrandColors.primary}>
                {mechanic.name}
              </Text>
              <Text size="sm" weight="medium" color="#6B7280">
                Master Mechanic
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.cardDivider} />

          {/* Appointment Details */}
          <View style={styles.appointmentDetails}>
            <View style={styles.detailRow}>
              <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.detailLabel}>
                APPOINTMENT
              </Text>
              <View style={styles.detailContent}>
                <Calendar size={16} color="#6B7280" />
                <Text size="sm" weight="medium" color={BrandColors.primary}>
                  {appointmentDisplay}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.detailLabel}>
                VEHICLE
              </Text>
              <View style={styles.detailContent}>
                <Car size={16} color="#6B7280" />
                <Text size="sm" weight="medium" color={BrandColors.primary}>
                  {vehicleDisplay}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Service Breakdown Card */}
        <View style={styles.serviceCard}>
          <View style={styles.serviceHeader}>
            <Text size="md" weight="bold" color={BrandColors.primary}>
              Service Breakdown
            </Text>
            <FileText size={20} color="#9CA3AF" />
          </View>

          {/* Service Names */}
          {selectedServices.map((service) => (
            <View key={service.id} style={styles.serviceRow}>
              <Text size="sm" weight="medium" color={BrandColors.primary}>
                {service.name}
              </Text>
              <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                ${service.price.toFixed(2)}
              </Text>
            </View>
          ))}

          {/* Detailed Breakdown */}
          <View style={styles.breakdownSection}>
            {/* Labor */}
            <View style={styles.breakdownRow}>
              <Text size="sm" weight="regular" color="#6B7280">
                Labor ({breakdown.laborHours} hrs)
              </Text>
              <Text size="sm" weight="medium" color="#6B7280">
                ${breakdown.laborCost.toFixed(2)}
              </Text>
            </View>

            {/* Parts */}
            <View style={styles.breakdownRow}>
              <Text size="sm" weight="regular" color="#6B7280">
                Parts (Oil, Filter)
              </Text>
              <Text size="sm" weight="medium" color="#6B7280">
                ${breakdown.partsCost.toFixed(2)}
              </Text>
            </View>

            {/* Taxes & Fees */}
            <View style={styles.breakdownRow}>
              <Text size="sm" weight="regular" color="#6B7280">
                Taxes & Fees
              </Text>
              <Text size="sm" weight="medium" color="#6B7280">
                ${breakdown.taxesAndFees.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Platform Fee */}
          <View style={styles.serviceRow}>
            <View style={styles.feeRow}>
              <Text size="sm" weight="regular" color="#6B7280">
                Platform Fee
              </Text>
              <TouchableOpacity style={styles.infoButton} activeOpacity={0.7}>
                <Info size={14} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <Text size="sm" weight="medium" color="#6B7280">
              ${breakdown.platformFee.toFixed(2)}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.serviceDivider} />

          {/* Total */}
          <View style={styles.totalSection}>
            <View style={styles.totalLeft}>
              <Text size="md" weight="bold" color={BrandColors.primary}>
                Total
              </Text>
              <View style={styles.savingsBadge}>
                <Text size="xs" weight="semiBold" color={BrandColors.secondary}>
                  → Saved $25 vs Dealership
                </Text>
              </View>
            </View>
            <Text size="2xl" weight="bold" color={BrandColors.secondary}>
              ${breakdown.total.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Payment Options Section */}
        <View style={styles.paymentSection}>
          {/* Apple Pay Button */}
          <TouchableOpacity
            style={styles.applePayButton}
            onPress={handleApplePay}
            activeOpacity={0.8}
          >
            <View style={styles.payButtonContent}>
              <FontAwesome name="apple" size={20} color="#FFFFFF" />
              <Text size="md" weight="semiBold" color={BrandColors.white}>
                Pay
              </Text>
            </View>
          </TouchableOpacity>

          {/* Google Pay Button */}
          <TouchableOpacity
            style={styles.googlePayButton}
            onPress={handleGooglePay}
            activeOpacity={0.8}
          >
            <View style={styles.payButtonContent}>
              <FontAwesome name="google" size={18} color={BrandColors.primary} />
              <Text size="md" weight="semiBold" color={BrandColors.primary}>
                Pay
              </Text>
            </View>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.paymentDivider}>
            <View style={styles.paymentDividerLine} />
            <Text size="xs" weight="medium" color="#9CA3AF" style={styles.paymentDividerText}>
              OR PAY WITH
            </Text>
            <View style={styles.paymentDividerLine} />
          </View>

          {/* Saved Card */}
          {hasPayment && selectedPaymentMethod ? (
            <View style={styles.savedCardRow}>
              <View style={styles.cardBrandIcon}>
                <Text size="xs" weight="bold" color={BrandColors.secondary}>
                  {selectedPaymentMethod.brand.toUpperCase().slice(0, 4)}
                </Text>
              </View>
              <View style={styles.cardDetails}>
                <Text size="md" weight="medium" color={BrandColors.primary}>
                  {selectedPaymentMethod.brand.charAt(0).toUpperCase() + selectedPaymentMethod.brand.slice(1)} •••• {selectedPaymentMethod.last4}
                </Text>
                <Text size="sm" weight="regular" color="#6B7280">
                  Expires {String(selectedPaymentMethod.expMonth).padStart(2, "0")}/{String(selectedPaymentMethod.expYear).slice(-2)}
                </Text>
              </View>
              <ChevronRight size={20} color="#9CA3AF" />
            </View>
          ) : (
            <View style={styles.savedCardRow}>
              <View style={styles.cardBrandIcon}>
                <Text size="xs" weight="bold" color="#9CA3AF">
                  CARD
                </Text>
              </View>
              <View style={styles.cardDetails}>
                <Text size="md" weight="semiBold" color={BrandColors.secondary}>
                  Add payment method
                </Text>
              </View>
              <ChevronRight size={20} color="#9CA3AF" />
            </View>
          )}

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Lock size={14} color="#9CA3AF" />
            <Text size="xs" weight="medium" color="#9CA3AF">
              Secured & encrypted by Stripe
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirmPayment}
          activeOpacity={0.8}
        >
          <Text size="md" weight="bold" color={BrandColors.white}>
            Confirm Appointment
          </Text>
          <View style={styles.priceTag}>
            <Text size="sm" weight="bold" color={BrandColors.primary}>
              ${breakdown.total.toFixed(2)}
            </Text>
          </View>
        </TouchableOpacity>
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
    backgroundColor: "#F9FAFB",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Mechanic Card
  mechanicCard: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  mechanicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    position: "absolute",
    bottom: -4,
    left: -4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: BrandColors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: BrandColors.white,
  },
  mechanicInfo: {
    flex: 1,
    gap: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: Spacing.lg,
  },
  appointmentDetails: {
    gap: Spacing.md,
  },
  detailRow: {
    gap: Spacing.xs,
  },
  detailLabel: {
    letterSpacing: 0.5,
  },
  detailContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },

  // Service Card
  serviceCard: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  serviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  breakdownSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  feeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  infoButton: {
    padding: 2,
  },
  serviceDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: Spacing.md,
  },
  totalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLeft: {
    gap: Spacing.xs,
  },
  savingsBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },

  // Payment Section
  paymentSection: {
    gap: Spacing.md,
  },
  applePayButton: {
    backgroundColor: BrandColors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  googlePayButton: {
    backgroundColor: BrandColors.white,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  payButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  paymentDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  paymentDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  paymentDividerText: {
    letterSpacing: 0.5,
  },
  savedCardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardBrandIcon: {
    width: 48,
    height: 32,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  cardDetails: {
    flex: 1,
    gap: 2,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BrandColors.white,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    ...Shadows.lg,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BrandColors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
  },
  priceTag: {
    backgroundColor: BrandColors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
});
