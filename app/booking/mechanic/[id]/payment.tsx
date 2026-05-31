/**
 * Payment Screen (Review & Pay)
 *
 * PURPOSE: Full-screen page for reviewing booking and payment details.
 *          Shows mechanic info, appointment details, vehicle, detailed services breakdown,
 *          and inline payment options (Apple Pay, Google Pay, saved cards).
 *
 * FLOW: mechanic detail → booking-details → payment → confirmation
 *
 * ROUTE: /booking/mechanic/[id]/payment
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, BackHandler, Image, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

// 2. Expo & Third-party
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { Calendar, Car, ChevronRight, FileText, Info, Lock, Star } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, ErrorOccurredModal, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { BookingPageHeader } from "@/components/booking/pages";

// 5. Constants, hooks, types, stores
import { getPartsBreakdown } from "@/constants/services";
import { BorderRadius, Shadows } from "@/constants/theme";
import { useBookingLaborHours } from "@/hooks/useBookingLaborHours";
import { useBookingPartsBreakdown } from "@/hooks/useBookingPartsBreakdown";
import { useCreateBookingConvex } from "@/hooks/useCreateBookingConvex";
import { deriveDisclosedRange } from "@/lib/disclosedRange";
import { computeBookingTax } from "@/lib/tax";
import { computePlatformFeeDollars } from "@/lib/platformFee";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

// ============================================================================
// CONSTANTS
// ============================================================================

// Platform fee + tax math live in lib/platformFee.ts and lib/tax.ts —
// single source of truth shared with the Convex server side, so what the
// customer sees here always matches what gets charged.
// TODO: When subscriptions are wired, waive service fee for Preferred/Elite subscribers

// ============================================================================
// COMPONENT
// ============================================================================

export default function PaymentScreen() {
  // ═══════════════ HOOKS ═══════════════
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, confirmError } = useLocalSearchParams<{ id: string; confirmError?: string }>();

  // ═══════════════ BOOKING STORE ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const availableServices = useBookingStore((state) => state.availableServices);
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
  const selectedMechanicSlot = useBookingStore((state) => state.selectedMechanicSlot);
  const getFormattedAppointmentDate = useBookingStore((state) => state.getFormattedAppointmentDate);
  const getFormattedAppointmentTime = useBookingStore((state) => state.getFormattedAppointmentTime);
  const customerNotes = useBookingStore((state) => state.customerNotes);
  const setCustomerNotes = useBookingStore((state) => state.setCustomerNotes);
  const { createBookingConvex } = useCreateBookingConvex();
  const bookingType = useBookingStore((state) => state.bookingType);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Pick up an error bounced back from the /confirming screen and surface
  // it in the existing error modal. Run once when the param shows up.
  useEffect(() => {
    if (confirmError) {
      setErrorMessage(confirmError);
      setErrorModalVisible(true);
      router.setParams({ confirmError: undefined });
    }
  }, [confirmError, router]);
  const setBookingStage = useBookingStore((state) => state.setBookingStage);
  const skippedBookingDetails = useBookingStore((state) => state.skippedBookingDetails);

  // ═══════════════ MECHANIC STORE ═══════════════
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  // ═══════════════ SHOP STORE (for shop-specific pricing) ═══════════════
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

  const mechanic = useMemo(() => {
    if (!selectedMechanicId) return null;
    return getMechanicById(selectedMechanicId);
  }, [selectedMechanicId, getMechanicById]);

  const selectedServices = useMemo(
    () => availableServices.filter((service) => selectedServiceIds.includes(service.id)),
    [availableServices, selectedServiceIds]
  );

  // Shop-specific only: labor_rate × default_labor_hours + default_parts_estimate (no default rate)
  const shop = useMemo(() => {
    const shopId = mechanic?.shopId ?? selectedMechanicSlot?.shopId;
    return shopId ? getShopById(shopId) : null;
  }, [mechanic?.shopId, selectedMechanicSlot?.shopId, getShopById]);
  const laborRate = shop?.labor_rate;
  const mechanicDisplayName = mechanic?.name ?? "Any available mechanic";
  const mechanicSubtitle =
    mechanic?.title ?? mechanic?.shopName ?? selectedMechanicSlot?.shopName ?? shop?.name ?? "Shop will assign a mechanic";

  // Real OEM parts (with per-unit prices) for the booking's vehicle. When this
  // hook returns data, partsCost uses the real per-service totals; otherwise we
  // fall back to `service.default_parts_estimate`. While `isPricedPartsLoading`
  // is true the breakdown shows a skeleton row instead of a stale labor-only
  // band — the band updates once the query lands.
  const { breakdown: pricedPartsByService, isLoading: isPricedPartsLoading } =
    useBookingPartsBreakdown(selectedVehicle?.ownershipId, selectedServiceIds);

  // Map serviceId → priced row so per-line lookups are O(1) below. Any service
  // with at least one fitment qualifies (parts without prices still render as
  // "Price TBD" rather than silently swapping in the synthetic fallback).
  const pricedPartsMap = useMemo(() => {
    const map = new Map<string, (typeof pricedPartsByService)[number]>();
    for (const row of pricedPartsByService) {
      if (row.parts.length > 0) map.set(String(row.serviceId), row);
    }
    return map;
  }, [pricedPartsByService]);

  // Per-service parts cost: priced total when we have any prices; otherwise
  // the flat default so totals never collapse to $0 just because price data
  // is incomplete.
  const getServicePartsCost = useCallback(
    (service: (typeof selectedServices)[0]) => {
      const real = pricedPartsMap.get(String(service.id));
      if (real && real.partsTotal > 0) return real.partsTotal;
      return service.default_parts_estimate ?? 0;
    },
    [pricedPartsMap]
  );

  // Vehicle-specific labor hours from `labor_times.book_hours` keyed by
  // vehicle_config_id + service_id. Falls back to `services.default_labor_hours`
  // for services with no per-vehicle row. Spark plugs on the CR-V drops from
  // 1.5hr (catalog default) to 0.5hr (book_hours) because the K24W9 is a
  // 4-cyl inline — much faster than a V6/V8 plug change.
  const { laborHours: laborHoursByService, isLoading: isLaborHoursLoading } =
    useBookingLaborHours(selectedVehicle?.ownershipId, selectedServiceIds);

  const laborHoursMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of laborHoursByService) {
      map.set(String(row.serviceId), row.hours);
    }
    return map;
  }, [laborHoursByService]);

  const getServiceLaborHours = useCallback(
    (service: (typeof selectedServices)[0]) => {
      const variant = laborHoursMap.get(String(service.id));
      if (typeof variant === "number") return variant;
      return service.default_labor_hours ?? 0;
    },
    [laborHoursMap]
  );

  // Calculate detailed breakdown — Pre-Job Approval flow: every variable
  // line renders as a band, not a single price. Parts vary ±25% (real
  // variance lives in part fitments + engine variant); labor is fixed.
  // Tax + platform fee recompute at both parts endpoints so brackets +
  // platform-fee floor are honored. Matches the server math in
  // convex/booking_quotes.ts and lib/disclosedRange.ts.
  const breakdown = useMemo(() => {
    const rate = laborRate ?? 0;
    const laborHours = selectedServices.reduce((sum, s) => sum + getServiceLaborHours(s), 0);
    const laborCost = laborHours * rate;
    const partsCost = selectedServices.reduce((sum, s) => sum + getServicePartsCost(s), 0);
    const servicesTotal = laborCost + partsCost;
    const serviceFee = computePlatformFeeDollars(servicesTotal);
    const taxesAndFees = computeBookingTax({
      laborDollars: laborCost,
      partsDollars: partsCost,
      state: shop?.state,
      zip: shop?.zip,
    }).taxDollars;

    const PARTS_BAND = 0.25;
    const partsLow = Math.max(0, partsCost * (1 - PARTS_BAND));
    const partsHigh = partsCost * (1 + PARTS_BAND);
    const taxLow = computeBookingTax({
      laborDollars: laborCost,
      partsDollars: partsLow,
      state: shop?.state,
      zip: shop?.zip,
    }).taxDollars;
    const taxHigh = computeBookingTax({
      laborDollars: laborCost,
      partsDollars: partsHigh,
      state: shop?.state,
      zip: shop?.zip,
    }).taxDollars;
    const feeLow = computePlatformFeeDollars(laborCost + partsLow);
    const feeHigh = computePlatformFeeDollars(laborCost + partsHigh);

    const range = deriveDisclosedRange({
      laborCost,
      partsCost,
      state: shop?.state,
      zip: shop?.zip,
    });

    return {
      laborHours,
      laborCost: Math.max(0, laborCost),
      partsCost: Math.max(0, partsCost),
      taxesAndFees,
      platformFee: serviceFee,
      subtotal: servicesTotal,
      total: servicesTotal + taxesAndFees + serviceFee,
      partsLow,
      partsHigh,
      taxLow,
      taxHigh,
      feeLow,
      feeHigh,
      rangeLow: range.lowDollars,
      rangeHigh: range.highDollars,
      rangeFormatted: range.formatted,
    };
  }, [selectedServices, laborRate, shop?.state, shop?.zip, getServicePartsCost, getServiceLaborHours]);

  // Stash the customer-facing range so BookingConfirmStatus can re-quote
  // the same band the customer just agreed to.
  const setDisclosedRangeFormatted = useBookingStore((s) => s.setDisclosedRangeFormatted);
  useEffect(() => {
    setDisclosedRangeFormatted(breakdown.rangeFormatted);
  }, [breakdown.rangeFormatted, setDisclosedRangeFormatted]);

  // Per-service line range (labor + parts ±25%) so summary rows show the
  // same band as the aggregate.
  const getServiceLineRange = useCallback(
    (service: (typeof selectedServices)[0]) => {
      const labor = (laborRate ?? 0) * getServiceLaborHours(service);
      const parts = getServicePartsCost(service);
      return {
        low: labor + parts * 0.75,
        high: labor + parts * 1.25,
      };
    },
    [laborRate, getServicePartsCost, getServiceLaborHours]
  );

  // Fallback parts breakdown for services without real OEM-priced data.
  // Splits each unpriced service's default_parts_estimate across SERVICE_PARTS
  // labels. Services with real fitments render their own lines below and are
  // skipped here so we never double-count.
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

  // Format appointment display
  const appointmentDisplay =
    appointmentDate && appointmentTime ? `${appointmentDate} · ${appointmentTime}` : "Not scheduled";

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
    if (!selectedMechanicId && !selectedMechanicSlot?.shopId) return;
    if (!hasPayment || !selectedPaymentMethod) {
      setErrorMessage("Add a payment method to confirm this booking.");
      setErrorModalVisible(true);
      return;
    }
    // Hand off to the confirming screen — it runs the mutation alongside
    // a minimum-display timer for the Lottie loading animation, then
    // routes forward to /confirmation (or back here with an error param).
    router.push(`/booking/mechanic/${id}/confirming`);
  }, [router, id, selectedMechanicId, selectedMechanicSlot?.shopId, hasPayment, selectedPaymentMethod]);

  const handleApplePay = useCallback(() => {
    // Apple Pay integration would go here
    handleConfirmPayment();
  }, [handleConfirmPayment]);

  const handleGooglePay = useCallback(() => {
    // Google Pay integration would go here
    handleConfirmPayment();
  }, [handleConfirmPayment]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") {
        return undefined;
      }

      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (errorModalVisible) {
          setErrorModalVisible(false);
          return true;
        }

        handleBack();
        return true;
      });

      return () => subscription.remove();
    }, [errorModalVisible, handleBack])
  );

  // ═══════════════ RENDER ═══════════════
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
              {mechanic?.photoUrl ? (
                <Image source={{ uri: mechanic.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text size="xl" weight="bold" color="#9CA3AF">
                    {mechanicDisplayName.charAt(0)}
                  </Text>
                </View>
              )}
              {/* Rating Badge */}
              {mechanic && (
                <View style={styles.ratingBadge}>
                  <Star size={10} color="#FCD34D" fill="#FCD34D" />
                  <Text size="xs" weight="bold" color={BrandColors.white}>
                    {mechanic.rating.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.mechanicInfo}>
              <Text size="lg" weight="bold" color={BrandColors.primary}>
                {mechanicDisplayName}
              </Text>
              <Text size="sm" weight="medium" color="#6B7280">
                {mechanicSubtitle}
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

          {/* Service names with line range (labor + parts ±25%) so the
              summary row shows the same band as the aggregate total. */}
          {selectedServices.map((service) => {
            const lineRange = getServiceLineRange(service);
            return (
              <View key={service.id} style={styles.serviceRow}>
                <Text size="sm" weight="medium" color={BrandColors.primary}>
                  {service.name}
                </Text>
                <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                  ${lineRange.low.toFixed(2)} – ${lineRange.high.toFixed(2)}
                </Text>
              </View>
            );
          })}

          {/* Detailed Breakdown */}
          <View style={styles.breakdownSection}>
            {/* Labor — uses per-vehicle book hours from `labor_times` when
                available; renders a skeleton while that query is in flight
                so the band doesn't snap from default to variant-aware value
                in front of the customer. */}
            {isLaborHoursLoading ? (
              <View style={styles.breakdownRow}>
                <View style={styles.skeletonLabel} />
                <View style={styles.skeletonValue} />
              </View>
            ) : (
              <View style={styles.breakdownRow}>
                <Text size="sm" weight="regular" color="#6B7280">
                  Labor ({breakdown.laborHours} hrs)
                </Text>
                <Text size="sm" weight="medium" color="#6B7280">
                  ${breakdown.laborCost.toFixed(2)}
                </Text>
              </View>
            )}

            {/* Parts: while the priced-parts query is in flight, render a
                skeleton row per service. When data lands, real OEM parts
                replace it (name × qty @ unit price). Parts without price
                data render with "Price TBD". Services with zero fitments
                fall through to the synthetic SERVICE_PARTS fallback below. */}
            {isPricedPartsLoading
              ? selectedServices.map((service) => (
                  <View key={`skeleton-${service.id}`} style={styles.breakdownRow}>
                    <View style={styles.skeletonLabel} />
                    <View style={styles.skeletonValue} />
                  </View>
                ))
              : selectedServices.flatMap((service) => {
                  const priced = pricedPartsMap.get(String(service.id));
                  if (!priced) return [];
                  return priced.parts.map((part) => {
                    const qtyLabel = part.quantity > 1 ? ` ×${part.quantity}` : "";
                    const hasPrice = part.has_price_data && part.line_total > 0;
                    const unitLabel =
                      hasPrice && part.quantity > 1 && part.unit_price > 0
                        ? ` @ ~$${part.unit_price.toFixed(2)}`
                        : "";
                    return (
                      <View key={`${service.id}-${part.part_id}`} style={styles.breakdownRow}>
                        <Text size="sm" weight="regular" color="#6B7280" style={styles.breakdownLabel}>
                          {part.name} (Part){qtyLabel}
                          {unitLabel}
                        </Text>
                        <Text size="sm" weight="medium" color="#6B7280">
                          {hasPrice ? `$${part.line_total.toFixed(2)}` : "Price TBD"}
                        </Text>
                      </View>
                    );
                  });
                })}

            {!isPricedPartsLoading &&
              fallbackPartsBreakdown.map((part, index) => (
                <View key={`fallback-${part.name}-${index}`} style={styles.breakdownRow}>
                  <Text size="sm" weight="regular" color="#6B7280">
                    {part.name} (Part)
                  </Text>
                  <Text size="sm" weight="medium" color="#6B7280">
                    ${(part.cost * 0.75).toFixed(2)} – ${(part.cost * 1.25).toFixed(2)}
                  </Text>
                </View>
              ))}

            {/* Taxes & Fees — recomputed at the parts endpoints. */}
            <View style={styles.breakdownRow}>
              <Text size="sm" weight="regular" color="#6B7280">
                Taxes & Fees
              </Text>
              <Text size="sm" weight="medium" color="#6B7280">
                ${breakdown.taxLow.toFixed(2)} – ${breakdown.taxHigh.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Otopair Service Fee — same band logic as tax. */}
          <View style={styles.serviceRow}>
            <View style={styles.feeRow}>
              <Text size="sm" weight="regular" color="#6B7280">
                Service Fee — 7%
              </Text>
              <TouchableOpacity style={styles.infoButton} activeOpacity={0.7}>
                <Info size={14} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <Text size="sm" weight="medium" color="#6B7280">
              ${breakdown.feeLow.toFixed(2)} – ${breakdown.feeHigh.toFixed(2)}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.serviceDivider} />

          {/* Estimated price range — Pre-Job Approval flow. Stacked layout
              gives the range string full card width so the dash + two
              prices read cleanly without clipping. */}
          <View style={styles.totalSection}>
            <View style={styles.totalHeader}>
              <Text size="md" weight="bold" color={BrandColors.primary}>
                Estimated price range
              </Text>
              <View style={styles.savingsBadge}>
                <Text size="xs" weight="semiBold" color={BrandColors.secondary}>
                  → Saved $25 vs Dealership
                </Text>
              </View>
            </View>
            <Text
              size="2xl"
              weight="bold"
              color={BrandColors.secondary}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {breakdown.rangeFormatted}
            </Text>
          </View>

          {/* $20 hold info block — surfaces the deposit mechanic and the
              "only charged after inspection" promise alongside the range,
              so the customer never wonders what hits their card today. */}
          <View style={styles.holdInfoBlock}>
            <Info size={14} color={BrandColors.secondary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                A $20 hold will be placed on your card today.
              </Text>
              <Text size="xs" weight="regular" color="#6B7280" style={styles.holdInfoBody}>
                The final amount within this range is only charged once your
                mechanic has inspected your car. If the work needed turns out
                to exceed this range, you&apos;ll be asked to approve the new
                total before any extra work begins.
              </Text>
            </View>
          </View>
        </View>

        {/* Notes for the mechanic — read on the schedule card before
            the job starts (e.g. "wheel lock is in the glovebox"). */}
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
            <TouchableOpacity
              style={styles.savedCardRow}
              onPress={() => router.push("/add-payment")}
              activeOpacity={0.8}
            >
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
            </TouchableOpacity>
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
          style={[
            styles.confirmButton,
            (isSubmitting || !hasPayment) && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirmPayment}
          activeOpacity={0.8}
          disabled={isSubmitting || !hasPayment}
        >
          {isSubmitting ? (
            <ActivityIndicator color={BrandColors.white} size="small" />
          ) : (
            <Text size="md" weight="bold" color={BrandColors.white}>
              Confirm Appointment
            </Text>
          )}
          <View style={styles.priceTag}>
            <Text
              size="sm"
              weight="bold"
              color={BrandColors.primary}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {breakdown.rangeFormatted}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <ErrorOccurredModal
        visible={errorModalVisible}
        title="Booking Failed"
        message={errorMessage}
        onClose={() => setErrorModalVisible(false)}
        onRetry={() => {
          setErrorModalVisible(false);
          handleConfirmPayment();
        }}
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
  breakdownLabel: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  skeletonLabel: {
    flex: 1,
    height: 12,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
    marginRight: Spacing.md,
  },
  skeletonValue: {
    width: 64,
    height: 12,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
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
    flexDirection: "column",
    gap: Spacing.sm,
  },
  totalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  // Retained for back-compat; new stacked layout uses `totalHeader`.
  totalLeft: {
    gap: Spacing.xs,
  },
  savingsBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  holdInfoBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0F7FF",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  holdInfoBody: {
    marginTop: 4,
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
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  priceTag: {
    backgroundColor: BrandColors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
});
