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
import { Image, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { FontAwesome } from "@expo/vector-icons";
import {
  Calendar,
  Car,
  ChevronRight,
  FileText,
  Info,
  Lock,
  Star,
  Stethoscope,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { getPartsBreakdown } from "@/constants/services";
import { BorderRadius, Shadows, getSheetContentPadding } from "@/constants/theme";
import { useBookingPartsBreakdown } from "@/hooks/useBookingPartsBreakdown";
import { deriveDisclosedRange } from "@/lib/disclosedRange";
import { computeBookingTax } from "@/lib/tax";
import { computePlatformFeeDollars } from "@/lib/platformFee";
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

const DIAGNOSTIC_SYSTEM_LABELS: Record<string, string> = {
  brakes: "Brakes",
  tires_wheels: "Tires & Wheels",
  engine: "Engine",
  battery_electrical: "Battery & Electrical",
  not_sure: "Not sure — mechanic to inspect",
};

// Platform fee + tax math live in lib/platformFee.ts and lib/tax.ts —
// single source of truth shared with the Convex server side.
// TODO: When subscriptions are wired, waive service fee for Preferred/Elite subscribers

// "8:15 AM" + 45 min → "9:00 AM". Returns null if input can't be parsed.
function addMinutesToTimeLabel(label: string, minutes: number): string | null {
  const match = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  const total = hour * 60 + parseInt(match[2], 10) + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h24 = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
}

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
  const customerNotes = useBookingStore((state) => state.customerNotes);
  const setCustomerNotes = useBookingStore((state) => state.setCustomerNotes);
  const selectedDiagnosticSystem = useBookingStore((state) => state.selectedDiagnosticSystem);
  // Diagnostic bookings collect notes earlier (on the diagnostic options
  // sheet) so the Review & Pay notes input would be a duplicate. Matched by
  // service name because the catalog id is the Convex _id (varies per env).
  const isDiagnosticBooking = useMemo(
    () =>
      selectedServiceIds.some(
        (id) => availableServices.find((s) => s.id === id)?.name === "Diagnostic Scan",
      ),
    [selectedServiceIds, availableServices],
  );

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

  // Vehicle-aware OEM parts with real unit prices (from part_fitments + part_prices).
  // When this returns data we use the per-part totals as the parts subtotal; when
  // it doesn't (walk-in vehicle, unconfigured vehicle, missing price data) we fall
  // back to the service's flat `default_parts_estimate`.
  const { breakdown: pricedPartsByService } = useBookingPartsBreakdown(
    selectedVehicle?.ownershipId,
    selectedServiceIds,
  );

  // Map serviceId → priced parts row so per-line lookups are O(1) below.
  const pricedPartsMap = useMemo(() => {
    const map = new Map<string, (typeof pricedPartsByService)[number]>();
    for (const row of pricedPartsByService) {
      // The row only counts as "real" if it actually has parts with non-zero
      // pricing data — otherwise the service falls back to default_parts_estimate.
      const hasUsablePrices = row.parts.some((p) => p.has_price_data && p.line_total > 0);
      if (hasUsablePrices) map.set(String(row.serviceId), row);
    }
    return map;
  }, [pricedPartsByService]);

  // Per-service parts cost: real OEM-priced total when available, else the flat
  // `default_parts_estimate`. Used both for the service line total and to roll
  // up the parts subtotal that feeds tax + fees + grand total.
  const getServicePartsCost = useCallback(
    (service: (typeof selectedServices)[0]) => {
      const real = pricedPartsMap.get(String(service.id));
      if (real) return real.partsTotal;
      return service.default_parts_estimate ?? 0;
    },
    [pricedPartsMap],
  );

  // Calculate detailed breakdown (shop labor rate + per-service parts costs).
  const breakdown = useMemo(() => {
    const rate = laborRate ?? 0;
    const laborHours = selectedServices.reduce((sum, s) => sum + (s.default_labor_hours ?? 0), 0);
    const laborCost = Math.max(0, laborHours * rate);
    const partsCost = selectedServices.reduce((sum, s) => sum + getServicePartsCost(s), 0);
    const servicesTotal = laborCost + partsCost;
    const serviceFee = computePlatformFeeDollars(servicesTotal);
    const taxesAndFees = computeBookingTax({
      laborDollars: laborCost,
      partsDollars: partsCost,
      state: shop?.state,
      zip: shop?.zip,
    }).taxDollars;

    // Pre-Job Approval flow: customer sees a range, not a single price.
    // ±25% band around parts (labor variance is negligible); tax + fee
    // recomputed at both endpoints to respect tax brackets and the
    // platform-fee floor.
    const range = deriveDisclosedRange({
      laborCost,
      partsCost,
      state: shop?.state,
      zip: shop?.zip,
    });

    return {
      laborHours,
      laborCost,
      partsCost,
      taxesAndFees,
      platformFee: serviceFee,
      subtotal: servicesTotal,
      total: servicesTotal + taxesAndFees + serviceFee,
      rangeLow: range.lowDollars,
      rangeHigh: range.highDollars,
      rangeFormatted: range.formatted,
    };
  }, [selectedServices, laborRate, shop?.state, shop?.zip, getServicePartsCost]);

  // Per-service line total (labor + parts) so breakdown lines sum to subtotal
  const getServiceLineTotal = useCallback(
    (service: (typeof selectedServices)[0]) =>
      (laborRate ?? 0) * (service.default_labor_hours ?? 0) + getServicePartsCost(service),
    [laborRate, getServicePartsCost],
  );

  // Fallback parts breakdown for services without real OEM-priced data.
  // We split each unpriced service's default_parts_estimate among the SERVICE_PARTS
  // names so the line items still sum to that service's parts total.
  const fallbackPartsBreakdown = useMemo(() => {
    const unpricedNames: string[] = [];
    let unpricedTotal = 0;
    for (const service of selectedServices) {
      if (pricedPartsMap.has(String(service.id))) continue;
      unpricedNames.push(service.name);
      unpricedTotal += service.default_parts_estimate ?? 0;
    }
    return getPartsBreakdown(unpricedNames, unpricedTotal);
  }, [selectedServices, pricedPartsMap]);

  // Format vehicle display
  const vehicleDisplay = selectedVehicle
    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
    : "No vehicle selected";

  // Format appointment display with computed end time (start – end)
  const appointmentDisplay = useMemo(() => {
    if (!appointmentDate || !appointmentTime) return "Not scheduled";
    const totalMinutes = Math.max(0, Math.round((breakdown.laborHours ?? 0) * 60));
    const endLabel = addMinutesToTimeLabel(appointmentTime, totalMinutes);
    return endLabel
      ? `${appointmentDate} · ${appointmentTime} – ${endLabel}`
      : `${appointmentDate} · ${appointmentTime}`;
  }, [appointmentDate, appointmentTime, breakdown.laborHours]);

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

            {isDiagnosticBooking && selectedDiagnosticSystem && (
              <View style={styles.detailRow}>
                <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.detailLabel}>
                  DIAGNOSTIC FOCUS
                </Text>
                <View style={styles.detailContent}>
                  <Stethoscope size={16} color="#6B7280" />
                  <Text size="sm" weight="medium" color={BrandColors.primary}>
                    {DIAGNOSTIC_SYSTEM_LABELS[selectedDiagnosticSystem] ?? selectedDiagnosticSystem}
                  </Text>
                </View>
                {customerNotes.trim().length > 0 && (
                  <Text size="sm" weight="regular" color="#6B7280" style={styles.diagnosticNotes}>
                    “{customerNotes.trim()}”
                  </Text>
                )}
              </View>
            )}
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

            {/* Parts: real OEM parts per service (name × qty @ unit price) when
                priced data is available; otherwise the flat default_parts_estimate
                split across SERVICE_PARTS labels. */}
            {selectedServices.map((service) => {
              const priced = pricedPartsMap.get(String(service.id));
              if (!priced) return null;
              return priced.parts.map((part) => {
                const qtyLabel = part.quantity > 1 ? ` ×${part.quantity}` : "";
                const unitLabel =
                  part.quantity > 1 && part.unit_price > 0 ? ` @ $${part.unit_price.toFixed(2)}` : "";
                return (
                  <View key={`${service.id}-${part.part_id}`} style={styles.breakdownRow}>
                    <Text size="sm" weight="regular" color="#6B7280" style={styles.breakdownLabel}>
                      {part.name} (Part){qtyLabel}
                      {unitLabel}
                    </Text>
                    <Text size="sm" weight="medium" color="#6B7280">
                      ${part.line_total.toFixed(2)}
                    </Text>
                  </View>
                );
              });
            })}

            {fallbackPartsBreakdown.map((part, index) => (
              <View key={`fallback-${part.name}-${index}`} style={styles.breakdownRow}>
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

          {/* Estimated total — disclosed as a range. The customer agrees
              to the band when they book; as long as the mechanic's final
              set price lands inside it, no further consent is needed. */}
          <View style={styles.totalSection}>
            <View style={styles.totalLeft}>
              <Text size="md" weight="bold" color={BrandColors.primary}>
                Estimated total
              </Text>
              <View style={styles.savingsBadge}>
                <Text size="xs" weight="semiBold" color={BrandColors.secondary}>
                  → Saved $25 vs Dealership
                </Text>
              </View>
            </View>
            <Text size="2xl" weight="bold" color={BrandColors.secondary}>
              {breakdown.rangeFormatted}
            </Text>
          </View>
          <View style={styles.rangeExplainer}>
            <Info size={12} color="#9CA3AF" />
            <Text size="xs" weight="regular" color="#6B7280" style={styles.rangeExplainerText}>
              We&apos;ll place a $20 hold today. You&apos;ll only be charged
              the actual total after your mechanic inspects your car.
            </Text>
          </View>
        </View>

        {/* Notes for the mechanic — read on the schedule card before
            the job starts (e.g. "wheel lock is in the glovebox").
            Hidden for Diagnostic Scan bookings, which collect notes earlier
            on the diagnostic options screen. */}
        {!isDiagnosticBooking && (
          <View style={styles.notesSection}>
            <View style={styles.notesHeader}>
              <FileText size={18} color="#6B7280" />
              <Text size="md" weight="semiBold" color={BrandColors.primary}>
                Notes for the mechanic
              </Text>
            </View>
            <Text size="sm" weight="regular" color="#6B7280" style={styles.notesHelper}>
              Anything the mechanic should know before starting? (Optional)
            </Text>
            <TextInput
              value={customerNotes}
              onChangeText={setCustomerNotes}
              placeholder="e.g. wheel lock is in the glovebox, please use the rear gate to enter"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              maxLength={500}
              style={styles.notesInput}
              textAlignVertical="top"
            />
            <Text size="xs" weight="regular" color="#9CA3AF" style={styles.notesCounter}>
              {customerNotes.length}/500
            </Text>
          </View>
        )}

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
  diagnosticNotes: {
    marginTop: Spacing.xs,
    fontStyle: "italic",
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
    gap: Spacing.sm,
  },
  breakdownLabel: {
    flex: 1,
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
  rangeExplainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  rangeExplainerText: {
    flex: 1,
    lineHeight: 16,
  },

  // Notes Section
  notesSection: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  notesHelper: {
    marginBottom: Spacing.sm,
  },
  notesInput: {
    minHeight: 80,
    padding: Spacing.md,
    backgroundColor: "#F8FAFC",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    color: BrandColors.primary,
    fontSize: 14,
  },
  notesCounter: {
    marginTop: Spacing.xs,
    textAlign: "right",
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
