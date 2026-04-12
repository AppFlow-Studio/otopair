/**
 * ReviewPayContent
 *
 * PURPOSE: Displays the Review & Pay screen after "Book Now" or "Schedule For Later"
 *          Shows mechanic info, appointment details, detailed services breakdown,
 *          and inline payment options (Apple Pay, Google Pay, saved cards).
 *          Appears before the confirmation screen
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * OWNER: Waleed Mansour
 * TICKET: OTO-146
 */

// 1. React & React Native
import React, { useCallback, useMemo } from "react";
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { FontAwesome } from "@expo/vector-icons";
import { Calendar, Car, ChevronRight, FileText, Info, Lock, Star } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { getPartsBreakdown } from "@/constants/services";
import { BorderRadius, Shadows, getSheetContentPadding } from "@/constants/theme";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

// ============================================================================
// TYPES
// ============================================================================

interface ReviewPayContentProps {
  /** Called when user wants to change date/time */
  onChangeDatePress?: () => void;
  /** Whether this is rendered in full-screen mode (outside bottom sheet) */
  isFullScreen?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Service fee: 7% of service subtotal, $4.99 minimum, no cap
// TODO: When subscriptions are wired, waive service fee for Preferred/Elite subscribers
const SERVICE_FEE_RATE = 0.07;
const SERVICE_FEE_MINIMUM = 4.99;
const TAXES_AND_FEES = 5.0;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ReviewPayContent({ onChangeDatePress, isFullScreen = false }: ReviewPayContentProps) {
  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const contentPadding = getSheetContentPadding(true, insets.bottom);

  // ═══════════════ BOOKING STORE ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const availableServices = useBookingStore((state) => state.availableServices);
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
  const getFormattedAppointmentDate = useBookingStore((state) => state.getFormattedAppointmentDate);
  const getFormattedAppointmentTime = useBookingStore((state) => state.getFormattedAppointmentTime);

  // ═══════════════ MECHANIC STORE ═══════════════
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  // ═══════════════ SHOP STORE ═══════════════
  const getShopById = useShopStore((state) => state.getShopById);

  // ═══════════════ VEHICLE STORE ═══════════════
  const getSelectedVehicle = useVehicleStore((state) => state.getSelectedVehicle);

  // ═══════════════ PAYMENT STORE ═══════════════
  const getSelectedPaymentMethod = usePaymentStore((state) => state.getSelectedPaymentMethod);
  const hasPaymentMethods = usePaymentStore((state) => state.hasPaymentMethods);

  // ═══════════════ COMPUTED ═══════════════
  const appointmentDate = getFormattedAppointmentDate();
  const appointmentTime = getFormattedAppointmentTime();
  const selectedVehicle = getSelectedVehicle();

  // Get selected mechanic
  const mechanic = useMemo(() => {
    if (!selectedMechanicId) return null;
    return getMechanicById(selectedMechanicId);
  }, [selectedMechanicId, getMechanicById]);

  // Shop for pricing (shop labor rate only)
  const shop = useMemo(() => (mechanic?.shopId ? getShopById(mechanic.shopId) : null), [mechanic?.shopId, getShopById]);
  const laborRate = shop?.labor_rate;

  // Get selected services
  const selectedServices = useMemo(
    () => availableServices.filter((service) => selectedServiceIds.includes(service.id)),
    [availableServices, selectedServiceIds],
  );

  // Calculate detailed breakdown (shop labor rate only; DB values only, no fallbacks)
  const breakdown = useMemo(() => {
    const rate = laborRate ?? 0;
    const servicesTotal = selectedServices.reduce(
      (total, service) => total + rate * (service.default_labor_hours ?? 0) + (service.default_parts_estimate ?? 0),
      0,
    );
    const laborHours = selectedServices.reduce((sum, s) => sum + (s.default_labor_hours ?? 0), 0);
    const laborCost = laborHours * rate;
    const partsCost = Math.max(0, servicesTotal - laborCost);
    const serviceFee = servicesTotal > 0 ? Math.max(servicesTotal * SERVICE_FEE_RATE, SERVICE_FEE_MINIMUM) : 0;

    return {
      laborHours,
      laborCost: Math.max(0, laborCost),
      partsCost,
      taxesAndFees: TAXES_AND_FEES,
      platformFee: serviceFee,
      subtotal: servicesTotal,
      total: servicesTotal + TAXES_AND_FEES + serviceFee,
    };
  }, [selectedServices, laborRate]);

  // Per-service line total (labor + parts) so breakdown lines sum to subtotal
  const getServiceLineTotal = useCallback(
    (service: (typeof selectedServices)[0]) =>
      (laborRate ?? 0) * (service.default_labor_hours ?? 0) + (service.default_parts_estimate ?? 0),
    [laborRate],
  );

  // Parts breakdown: each part listed and labelled as (Part)
  const partsBreakdown = useMemo(
    () =>
      getPartsBreakdown(
        selectedServices.map((s) => s.name),
        breakdown.partsCost,
      ),
    [selectedServices, breakdown.partsCost],
  );

  // Format vehicle display
  const vehicleDisplay = selectedVehicle
    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
    : "No vehicle selected";

  // Format appointment display
  const appointmentDisplay =
    appointmentDate && appointmentTime ? `${appointmentDate} · ${appointmentTime}` : "Not scheduled";

  // Payment method
  const selectedPaymentMethod = getSelectedPaymentMethod();
  const hasPayment = hasPaymentMethods();

  // ═══════════════ HANDLERS ═══════════════
  const handleApplePay = useCallback(() => {
    // Apple Pay integration would go here
    console.log("Apple Pay selected");
  }, []);

  const handleGooglePay = useCallback(() => {
    // Google Pay integration would go here
    console.log("Google Pay selected");
  }, []);

  // ═══════════════ RENDER ═══════════════
  if (!mechanic) {
    return (
      <View style={styles.container}>
        <Text size="md" weight="medium" color="#6B7280" center>
          No mechanic selected
        </Text>
      </View>
    );
  }

  // Choose the appropriate ScrollView component based on mode
  const ScrollComponent = isFullScreen ? ScrollView : BottomSheetScrollView;

  return (
    <View style={styles.container}>
      {/* Scrollable Content */}
      <ScrollComponent
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - Only show in bottom sheet mode, full-screen has its own header */}
        {!isFullScreen && (
          <View style={styles.header}>
            <Text size="xl" weight="bold" color={BrandColors.primary}>
              Review & Pay
            </Text>
          </View>
        )}

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
                {mechanic.title ?? mechanic.shopName}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.cardDivider} />

          {/* Appointment Details */}
          <View style={styles.appointmentDetails}>
            <TouchableOpacity style={styles.detailRow} onPress={onChangeDatePress} activeOpacity={0.7}>
              <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.detailLabel}>
                APPOINTMENT
              </Text>
              <View style={styles.detailContent}>
                <Calendar size={16} color="#6B7280" />
                <Text size="sm" weight="medium" color={BrandColors.primary}>
                  {appointmentDisplay}
                </Text>
              </View>
            </TouchableOpacity>

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

          {/* Service names with line total (labor + parts) so lines sum to subtotal */}
          {selectedServices.map((service) => (
            <View key={service.id} style={styles.serviceRow}>
              <Text size="sm" weight="medium" color={BrandColors.primary}>
                {service.name}
              </Text>
              <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                ${getServiceLineTotal(service).toFixed(2)}
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

            {/* Parts: each part listed and labelled as (Part) */}
            {partsBreakdown.map((part, index) => (
              <View key={`${part.name}-${index}`} style={styles.breakdownRow}>
                <Text size="sm" weight="regular" color="#6B7280">
                  {part.name} (Part)
                </Text>
                <Text size="sm" weight="medium" color="#6B7280">
                  ${part.cost.toFixed(2)}
                </Text>
              </View>
            ))}

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

          {/* Otopair Service Fee */}
          <View style={styles.serviceRow}>
            <View style={styles.feeRow}>
              <Text size="sm" weight="regular" color="#6B7280">
                Otopair Service Fee — 7%
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
          <TouchableOpacity style={styles.applePayButton} onPress={handleApplePay} activeOpacity={0.8}>
            <View style={styles.payButtonContent}>
              <FontAwesome name="apple" size={20} color="#FFFFFF" />
              <Text size="md" weight="semiBold" color={BrandColors.white}>
                Pay
              </Text>
            </View>
          </TouchableOpacity>

          {/* Google Pay Button */}
          <TouchableOpacity style={styles.googlePayButton} onPress={handleGooglePay} activeOpacity={0.8}>
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
                  {selectedPaymentMethod.brand.charAt(0).toUpperCase() + selectedPaymentMethod.brand.slice(1)} ••••{" "}
                  {selectedPaymentMethod.last4}
                </Text>
                <Text size="sm" weight="regular" color="#6B7280">
                  Expires {String(selectedPaymentMethod.expMonth).padStart(2, "0")}/
                  {String(selectedPaymentMethod.expYear).slice(-2)}
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
      </ScrollComponent>
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: BrandColors.white,
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
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
});
