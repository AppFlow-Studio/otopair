/**
 * ReviewPayContent
 *
 * PURPOSE: Displays the Review & Pay screen after "Book Now" or "Schedule For Later"
 *          Shows mechanic info, appointment details, services breakdown,
 *          price lock guarantee, and ownership credit
 *          Appears before the confirmation screen
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * OWNER: Waleed Mansour
 * TICKET: OTO-146
 */

// 1. React & React Native
import React, { useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Calendar, Car, ChevronRight, CreditCard, FileText, Info, Lock, Star } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BorderRadius, Shadows, getSheetContentPadding } from "@/constants/theme";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

// 5. Local components
import { PaymentMethodModal } from "@/components/booking/modals/PaymentMethodModal";

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

const PLATFORM_FEE = 4.79;
const OWNERSHIP_CREDIT_CURRENT = 27;
const OWNERSHIP_CREDIT_GOAL = 50;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ReviewPayContent({ onChangeDatePress, isFullScreen = false }: ReviewPayContentProps) {
  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const contentPadding = getSheetContentPadding(true, insets.bottom);

  // ═══════════════ LOCAL STATE ═══════════════
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);

  // ═══════════════ BOOKING STORE ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const availableServices = useBookingStore((state) => state.availableServices);
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
  const getFormattedAppointmentDate = useBookingStore((state) => state.getFormattedAppointmentDate);
  const getFormattedAppointmentTime = useBookingStore((state) => state.getFormattedAppointmentTime);

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

  // Get selected mechanic
  const mechanic = useMemo(() => {
    if (!selectedMechanicId) return null;
    return getMechanicById(selectedMechanicId);
  }, [selectedMechanicId, getMechanicById]);

  // Get selected services
  const selectedServices = useMemo(
    () => availableServices.filter((service) => selectedServiceIds.includes(service.id)),
    [availableServices, selectedServiceIds]
  );

  // Compute totals
  const servicesTotal = useMemo(
    () => selectedServices.reduce((total, service) => total + service.price, 0),
    [selectedServices]
  );

  const totalPrice = servicesTotal + PLATFORM_FEE;

  // Format vehicle display
  const vehicleDisplay = selectedVehicle
    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
    : "No vehicle selected";

  // Format appointment display
  const appointmentDisplay =
    appointmentDate && appointmentTime ? `${appointmentDate} • ${appointmentTime}` : "Not scheduled";

  // Ownership credit progress
  const creditProgress = (OWNERSHIP_CREDIT_CURRENT / OWNERSHIP_CREDIT_GOAL) * 100;
  const creditPercentage = Math.round(creditProgress);

  // Payment method
  const selectedPaymentMethod = getSelectedPaymentMethod();
  const hasPayment = hasPaymentMethods();

  // ═══════════════ COMPUTED FOR MODAL ═══════════════
  const serviceSummary = useMemo(() => {
    if (selectedServices.length === 0) return "Service";
    if (selectedServices.length === 1) return selectedServices[0].name;
    return `${selectedServices[0].name} & ${selectedServices.length - 1} more`;
  }, [selectedServices]);

  // ═══════════════ HANDLERS ═══════════════
  const handleChangePaymentMethod = () => {
    setIsPaymentModalVisible(true);
  };

  const handleClosePaymentModal = () => {
    setIsPaymentModalVisible(false);
  };

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
                Master Mechanic
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.cardDivider} />

          {/* Appointment Details */}
          <View style={styles.appointmentDetails}>
            <TouchableOpacity 
              style={styles.detailRow} 
              onPress={onChangeDatePress}
              activeOpacity={0.7}
            >
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

          {/* Services */}
          {selectedServices.map((service) => (
            <View key={service.id} style={styles.serviceRow}>
              <Text size="sm" weight="regular" color={BrandColors.primary}>
                {service.name}
              </Text>
              <Text size="sm" weight="medium" color={BrandColors.primary}>
                ${service.price.toFixed(2)}
              </Text>
            </View>
          ))}

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
              ${PLATFORM_FEE.toFixed(2)}
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
              ${totalPrice.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Payment Method Card */}
        <TouchableOpacity 
          style={styles.paymentMethodCard} 
          onPress={handleChangePaymentMethod}
          activeOpacity={0.7}
        >
          <View style={styles.paymentMethodIcon}>
            <CreditCard size={20} color="#6B7280" />
          </View>
          <View style={styles.paymentMethodContent}>
            <Text size="sm" weight="medium" color="#6B7280">
              Payment Method
            </Text>
            {hasPayment && selectedPaymentMethod ? (
              <Text size="md" weight="semiBold" color={BrandColors.primary}>
                Via {selectedPaymentMethod.brand} ····{selectedPaymentMethod.last4}
              </Text>
            ) : (
              <Text size="md" weight="semiBold" color={BrandColors.secondary}>
                Add payment method
              </Text>
            )}
          </View>
          <ChevronRight size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Price Lock Guarantee */}
        <View style={styles.guaranteeCard}>
          <View style={styles.guaranteeIcon}>
            <Lock size={20} color="#10B981" />
          </View>
          <View style={styles.guaranteeContent}>
            <Text size="md" weight="bold" color={BrandColors.primary}>
              Price Lock Guarantee
            </Text>
            <Text size="sm" weight="regular" color="#6B7280">
              No hidden fees or surprises at the shop.
            </Text>
          </View>
        </View>

        {/* Ownership Credit Card */}
        <View style={styles.creditCard}>
          <View style={styles.creditContent}>
            <Text size="xs" weight="bold" color="rgba(255,255,255,0.7)" style={styles.creditLabel}>
              OWNERSHIP CREDIT
            </Text>
            <View style={styles.creditAmount}>
              <Text size="2xl" weight="bold" color={BrandColors.white}>
                ${OWNERSHIP_CREDIT_CURRENT}
              </Text>
              <Text size="lg" weight="medium" color="rgba(255,255,255,0.7)">
                {" "}
                / ${OWNERSHIP_CREDIT_GOAL}
              </Text>
            </View>
            <Text size="sm" weight="regular" color="rgba(255,255,255,0.8)">
              Earned towards next reward
            </Text>
          </View>

          {/* Circular Progress */}
          <View style={styles.progressWrapper}>
            <Svg width={56} height={56} viewBox="0 0 56 56">
              {/* Background Circle */}
              <Circle cx="28" cy="28" r="24" stroke="rgba(255,255,255,0.2)" strokeWidth="4" fill="transparent" />
              {/* Progress Circle */}
              <Circle
                cx="28"
                cy="28"
                r="24"
                stroke={BrandColors.white}
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - creditProgress / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 28 28)"
              />
            </Svg>
            <View style={styles.progressText}>
              <Text size="sm" weight="bold" color={BrandColors.white}>
                {creditPercentage}%
              </Text>
            </View>
          </View>
        </View>
      </ScrollComponent>

      {/* Payment Method Modal */}
      <PaymentMethodModal
        visible={isPaymentModalVisible}
        onClose={handleClosePaymentModal}
        totalAmount={totalPrice}
        serviceSummary={serviceSummary}
        mechanicName={mechanic?.name || "Mechanic"}
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

  // Payment Method Card
  paymentMethodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  paymentMethodIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentMethodContent: {
    flex: 1,
    gap: 2,
  },

  // Guarantee Card
  guaranteeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  guaranteeIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  guaranteeContent: {
    flex: 1,
    gap: 2,
  },

  // Credit Card
  creditCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  creditContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  creditLabel: {
    letterSpacing: 0.5,
  },
  creditAmount: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  progressWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  progressText: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
