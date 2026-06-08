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
import { Calendar, Car, ChevronRight, FileText, Info, Star } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, ErrorOccurredModal, FixedPriceBadge, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { BookingPageHeader } from "@/components/booking/pages";
import { normalizeStripeBrand } from "@/components/payments/BrandedCardVisual";
import { BRAND_SVG } from "@/components/payments/brandSvg";
import ApplePay from "@/assets/images/APPLEPAY.svg";
import GooglePay from "@/assets/images/GOOGLEPAY.svg";

// 5. Constants, hooks, types, stores
import { getPartsBreakdown } from "@/constants/services";
import { BorderRadius, Shadows } from "@/constants/theme";
import { useBookingLaborHours } from "@/hooks/useBookingLaborHours";
import { useBookingPartsBreakdown } from "@/hooks/useBookingPartsBreakdown";
import { useCreateBookingConvex } from "@/hooks/useCreateBookingConvex";
import { useShopFixedPricesForServices } from "@/hooks/useShopFixedPricesForServices";
import { useWalletCheckout } from "@/hooks/useWalletCheckout";
import { deriveDisclosedRange, formatRange } from "@/lib/disclosedRange";
import { formatDurationForCar } from "@/lib/formatDuration";
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
  const selectedServiceOptions = useBookingStore((state) => state.selectedServiceOptions);
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
  // Subscribe to the data directly (not the helper functions) so this screen
  // re-renders whenever the saved-cards list or active selection changes —
  // e.g., right after AddPaymentScreen attaches a new card and pre-selects it.
  const paymentMethods = usePaymentStore((state) => state.paymentMethods);
  const selectedPaymentMethodId = usePaymentStore((state) => state.selectedPaymentMethodId);

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
  // Shop resolution falls back to the time-slot's shopId so "Any available
  // mechanic" bookings still resolve a shop — without this fallback the
  // fixed-price hook below receives undefined and every flat-rate service
  // re-renders as a range.
  const resolvedShopId = mechanic?.shopId ?? selectedMechanicSlot?.shopId;
  const shop = useMemo(() => {
    return resolvedShopId ? getShopById(resolvedShopId) : null;
  }, [resolvedShopId, getShopById]);
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
    useBookingPartsBreakdown(
      selectedVehicle?.ownershipId,
      selectedServiceIds,
      selectedServiceOptions,
    );

  // Map serviceId → priced row so per-line lookups are O(1) below. Any service
  // with at least one fitment qualifies (parts without prices still render as
  // "Price TBD" rather than silently swapping in the synthetic fallback).
  const pricedPartsMap = useMemo(() => {
    const map = new Map<string, (typeof pricedPartsByService)[number]>();
    for (const row of pricedPartsByService) {
      if (row.winner !== null) map.set(String(row.serviceId), row);
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

  // Per-(shop, service, tier) flat-price overrides — same hook the mechanic
  // selection footer + ShopCard call. Hits collapse the parts band and zero
  // labor for that line; mirrors `computeDisclosedRange` on the server so
  // the price the customer agrees to here is what `createBatch` will
  // snapshot onto the booking row.
  const { map: fixedPriceMap, hasAnyFixed: hasAnyFixedPrice } =
    useShopFixedPricesForServices(
      resolvedShopId,
      selectedVehicle?.ownershipId,
      selectedServiceIds,
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
    // Hours attributable to variable services only — drives the "Labor (X mins)"
    // label so the duration matches the displayed billableLaborCost below.
    const variableLaborHours = selectedServices.reduce(
      (sum, s) =>
        fixedPriceMap.has(String(s.id)) ? sum : sum + getServiceLaborHours(s),
      0,
    );

    // Split variable parts (banded) from fixed parts (pinned on both ends).
    // Mirrors computeDisclosedRange in convex/booking_quotes.ts so the
    // create call honors the same price the customer agrees to here.
    const variablePartsCost = selectedServices.reduce(
      (sum, s) =>
        fixedPriceMap.has(String(s.id))
          ? sum
          : sum + getServicePartsCost(s),
      0,
    );
    const fixedPartsTotal = selectedServices.reduce(
      (sum, s) => sum + (fixedPriceMap.get(String(s.id)) ?? 0),
      0,
    );
    const partsCost = variablePartsCost + fixedPartsTotal;

    // Labor on flat-price lines is bundled into the flat — subtract it from
    // the billable labor used for tax/fee/total math.
    const fixedLaborCost = selectedServices.reduce(
      (sum, s) =>
        fixedPriceMap.has(String(s.id))
          ? sum + rate * getServiceLaborHours(s)
          : sum,
      0,
    );
    const billableLaborCost = Math.max(0, laborCost - fixedLaborCost);

    const servicesTotal = billableLaborCost + partsCost;
    const serviceFee = computePlatformFeeDollars(servicesTotal);
    const taxesAndFees = computeBookingTax({
      laborDollars: billableLaborCost,
      partsDollars: partsCost,
      state: shop?.state,
      zip: shop?.zip,
    }).taxDollars;

    const PARTS_BAND = 0.08;
    const partsLow = Math.max(0, variablePartsCost * (1 - PARTS_BAND)) + fixedPartsTotal;
    const partsHigh = variablePartsCost * (1 + PARTS_BAND) + fixedPartsTotal;
    const taxLow = computeBookingTax({
      laborDollars: billableLaborCost,
      partsDollars: partsLow,
      state: shop?.state,
      zip: shop?.zip,
    }).taxDollars;
    const taxHigh = computeBookingTax({
      laborDollars: billableLaborCost,
      partsDollars: partsHigh,
      state: shop?.state,
      zip: shop?.zip,
    }).taxDollars;
    const feeLow = computePlatformFeeDollars(billableLaborCost + partsLow);
    const feeHigh = computePlatformFeeDollars(billableLaborCost + partsHigh);

    const fixedPriceLines = selectedServices
      .filter((s) => fixedPriceMap.has(String(s.id)))
      .map((s) => ({
        serviceId: String(s.id),
        laborCost: rate * getServiceLaborHours(s),
        partsFixed: fixedPriceMap.get(String(s.id)) ?? 0,
      }));
    const range = deriveDisclosedRange({
      laborCost,
      partsCost: variablePartsCost,
      state: shop?.state,
      zip: shop?.zip,
      fixedPriceLines,
    });

    return {
      laborHours,
      variableLaborHours,
      laborCost: billableLaborCost,
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
  }, [selectedServices, laborRate, shop?.state, shop?.zip, getServicePartsCost, getServiceLaborHours, fixedPriceMap]);

  // Stash the customer-facing range + fixed-price flag so BookingConfirmStatus
  // can re-quote the same band the customer just agreed to and decide
  // whether to render the "Fixed price" pill alongside it.
  const setDisclosedRangeFormatted = useBookingStore((s) => s.setDisclosedRangeFormatted);
  const setDisclosedRangeIsFixedPrice = useBookingStore((s) => s.setDisclosedRangeIsFixedPrice);
  useEffect(() => {
    setDisclosedRangeFormatted(breakdown.rangeFormatted);
  }, [breakdown.rangeFormatted, setDisclosedRangeFormatted]);
  useEffect(() => {
    setDisclosedRangeIsFixedPrice(hasAnyFixedPrice);
  }, [hasAnyFixedPrice, setDisclosedRangeIsFixedPrice]);

  // Per-service line range (labor + parts ±8%) so summary rows show the
  // same band as the aggregate. The 8% cap matches the disclosed-range
  // FALLBACK_BAND_RATIO — real source variance after MAD rejection sits
  // in this band, so a wider spread would overstate uncertainty.
  const getServiceLineRange = useCallback(
    (service: (typeof selectedServices)[0]) => {
      const flat = fixedPriceMap.get(String(service.id));
      if (flat != null) {
        return { low: flat, high: flat, isFixed: true as const };
      }
      const labor = (laborRate ?? 0) * getServiceLaborHours(service);
      const parts = getServicePartsCost(service);
      return {
        low: labor + parts * 0.92,
        high: labor + parts * 1.08,
        isFixed: false as const,
      };
    },
    [laborRate, getServicePartsCost, getServiceLaborHours, fixedPriceMap]
  );

  // Fallback parts breakdown for services without real OEM-priced data.
  // Splits each unpriced service's default_parts_estimate across SERVICE_PARTS
  // labels. Services with real fitments render their own lines below and are
  // skipped here so we never double-count.
  const fallbackPartsBreakdown = useMemo(() => {
    const unpricedNames: string[] = [];
    let unpricedTotal = 0;
    for (const service of selectedServices) {
      // Fixed-price services bundle parts into the flat amount — they
      // render their own "Parts — Fixed" row, so skip them here.
      if (fixedPriceMap.has(String(service.id))) continue;
      if (pricedPartsMap.has(String(service.id))) continue;
      unpricedNames.push(service.name);
      unpricedTotal += service.default_parts_estimate ?? 0;
    }
    return getPartsBreakdown(unpricedNames, unpricedTotal);
  }, [selectedServices, pricedPartsMap, fixedPriceMap]);

  // Format vehicle display
  const vehicleDisplay = selectedVehicle
    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
    : "No vehicle selected";

  // Format appointment display
  const appointmentDisplay =
    appointmentDate && appointmentTime ? `${appointmentDate} · ${appointmentTime}` : "Not scheduled";

  // Payment method — derived from the live store so add/delete propagate.
  const selectedPaymentMethod = useMemo(() => {
    if (selectedPaymentMethodId) {
      const match = paymentMethods.find((pm) => pm.id === selectedPaymentMethodId);
      if (match) return match;
    }
    return paymentMethods.find((pm) => pm.isDefault) ?? paymentMethods[0] ?? null;
  }, [paymentMethods, selectedPaymentMethodId]);
  const hasPayment = paymentMethods.length > 0;

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

  // Apple Pay / Google Pay handlers. The wallet sheet shows the $20 hold
  // (matches the "$20 hold placed today" disclosure on the screen). The
  // hook mints a one-time PM via PlatformPay, stashes it in
  // usePaymentStore.selectedWalletPm, and routes to /confirming with
  // paymentMode=wallet — the confirming screen then runs the same booking
  // creation + createPaymentIntentForBooking flow as a saved card.
  const {
    handleApplePay,
    handleGooglePay,
    applePaySupported,
    googlePaySupported,
    walletPending,
    walletError,
  } = useWalletCheckout({
    bookingMechanicId: id,
    totalCents: 2000,
    enabled:
      Boolean(selectedMechanicId || selectedMechanicSlot?.shopId) && !isSubmitting,
  });

  // Bubble wallet errors into the existing error modal so the customer
  // sees the same surface as other booking failures.
  useEffect(() => {
    if (walletError) {
      setErrorMessage(walletError);
      setErrorModalVisible(true);
    }
  }, [walletError]);

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
              summary row shows the same band as the aggregate total.
              Flat-price lines surface the labor duration inline with the
              service name and replace the dollar amount with "Fixed" —
              the customer's price contract is the flat rate, not the
              underlying parts+labor math. */}
          {selectedServices.map((service) => {
            const lineRange = getServiceLineRange(service);
            const lineDurationLabel = lineRange.isFixed
              ? formatDurationForCar(getServiceLaborHours(service))
              : null;
            return (
              <View key={service.id} style={styles.serviceRow}>
                <View style={styles.serviceNameWrap}>
                  <Text size="sm" weight="medium" color={BrandColors.primary}>
                    {service.name}
                  </Text>
                  {lineRange.isFixed && <FixedPriceBadge size="sm" />}
                  {lineDurationLabel ? (
                    <Text size="sm" weight="regular" color="#6B7280">
                      · {lineDurationLabel}
                    </Text>
                  ) : null}
                </View>
                <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                  {lineRange.isFixed
                    ? `$${lineRange.low.toFixed(2)}`
                    : formatRange(lineRange.low, lineRange.high)}
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
            ) : breakdown.variableLaborHours > 0 ? (
              <View style={styles.breakdownRow}>
                <Text size="sm" weight="regular" color="#6B7280">
                  {/* Time is the TOTAL mechanic-occupancy duration (variable +
                      fixed); cost is the variable portion only, since the
                      fixed lines' labor is already bundled into their flat
                      amount above. The visibility predicate stays on
                      `variableLaborHours` so all-fixed carts still hide this
                      row (cost would be $0). */}
                  Labor ({formatDurationForCar(breakdown.laborHours) ?? "0 mins"})
                </Text>
                <Text size="sm" weight="medium" color="#6B7280">
                  ${breakdown.laborCost.toFixed(2)}
                </Text>
              </View>
            ) : null}

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
                  // Flat-price services are represented by their summary row +
                  // FixedPriceBadge above; suppress them in the detailed
                  // breakdown so we don't double-show or invent dollar amounts
                  // that don't sum to the flat.
                  if (fixedPriceMap.has(String(service.id))) return [];
                  const priced = pricedPartsMap.get(String(service.id));
                  if (!priced || !priced.winner) return [];
                  // Single-axle services have just `winner`. Position="both"
                  // services (e.g. Brake Pads All-four) carry `secondaryWinner`
                  // for the rear axle — render both as separate part lines.
                  const parts = [priced.winner, priced.secondaryWinner].filter(
                    (p): p is NonNullable<typeof p> => p != null,
                  );
                  return parts.map((part) => {
                    const qtyLabel = part.quantity > 1 ? ` ×${part.quantity}` : "";
                    // Render the variance the algorithm actually observed —
                    // qty × kept-set min/max — instead of the single mean
                    // that gets quoted to the mechanic. When only one source
                    // priced the part (low === high), apply a synthetic ±8%
                    // band so the row still reads as a range, matching the
                    // disclosed-range FALLBACK_BAND_RATIO.
                    const hasPrice = part.has_price_data && part.line_total_high > 0;
                    const SINGLE_SOURCE_BAND = 0.08;
                    const singleSource = part.line_total_low === part.line_total_high;
                    const lineLow = singleSource
                      ? part.line_total_low * (1 - SINGLE_SOURCE_BAND)
                      : part.line_total_low;
                    const lineHigh = singleSource
                      ? part.line_total_high * (1 + SINGLE_SOURCE_BAND)
                      : part.line_total_high;
                    return (
                      <View key={`${service.id}-${part.part_id}`} style={styles.breakdownRow}>
                        <Text size="sm" weight="regular" color="#6B7280" style={styles.breakdownLabel}>
                          {part.name} (Part){qtyLabel}
                        </Text>
                        <Text size="sm" weight="medium" color="#6B7280">
                          {hasPrice ? formatRange(lineLow, lineHigh) : "Price TBD"}
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
                    {formatRange(part.cost * 0.92, part.cost * 1.08)}
                  </Text>
                </View>
              ))}

            {/* Taxes — recomputed at the parts endpoints. Service Fee
                renders on its own row below; this row is tax only. */}
            <View style={styles.breakdownRow}>
              <Text size="sm" weight="regular" color="#6B7280">
                Taxes
              </Text>
              <Text size="sm" weight="medium" color="#6B7280">
                {formatRange(breakdown.taxLow, breakdown.taxHigh)}
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
              {formatRange(breakdown.feeLow, breakdown.feeHigh)}
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
                {hasAnyFixedPrice && breakdown.rangeLow === breakdown.rangeHigh
                  ? "Estimated price"
                  : "Estimated price range"}
              </Text>
              <View style={styles.totalHeaderBadges}>
                {hasAnyFixedPrice && <FixedPriceBadge size="sm" />}
                <View style={styles.savingsBadge}>
                  <Text size="xs" weight="semiBold" color={BrandColors.secondary}>
                    → Saved $25 vs Dealership
                  </Text>
                </View>
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

      </ScrollView>

      {/* Footer CTA — wallet button on top (Apple Pay on iOS, Google Pay
          on Android), saved card row below. The wallet button is hidden
          on devices without wallet support (e.g., iOS simulator, Android
          without Google Play Services) instead of just disabled, so the
          surface doesn't suggest a path the user can't take. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xs }]}>
        {(Platform.OS === "ios" ? applePaySupported : googlePaySupported) ? (
          <TouchableOpacity
            style={[
              styles.walletButton,
              (isSubmitting || walletPending) && styles.confirmButtonDisabled,
            ]}
            onPress={Platform.OS === "android" ? handleGooglePay : handleApplePay}
            activeOpacity={0.85}
            disabled={isSubmitting || walletPending}
          >
            {isSubmitting || walletPending ? (
              <ActivityIndicator color={BrandColors.white} size="small" />
            ) : Platform.OS === "android" ? (
              <GooglePay width={76} height={30} />
            ) : (
              <ApplePay width={72} height={30} />
            )}
          </TouchableOpacity>
        ) : null}

        {hasPayment && selectedPaymentMethod ? (
          <TouchableOpacity
            style={styles.footerCardRow}
            onPress={handleConfirmPayment}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            <View style={styles.cardBrandIcon}>
              {(() => {
                const BrandSvg =
                  BRAND_SVG?.[normalizeStripeBrand(selectedPaymentMethod.brand)];
                return BrandSvg ? (
                  // The brand SVGs reserve viewBox space below the card
                  // for a drop shadow, so the glyph optically floats high
                  // in any fixed box. Nudge it down so it sits dead-center
                  // in the tile.
                  <BrandSvg
                    width={56}
                    height={36}
                    style={{ transform: [{ translateY: 3 }] }}
                  />
                ) : (
                  <Text size="xs" weight="bold" color={BrandColors.secondary}>
                    {selectedPaymentMethod.brand.toUpperCase().slice(0, 4)}
                  </Text>
                );
              })()}
            </View>
            <View style={styles.cardDetails}>
              <Text size="md" weight="semiBold" color={BrandColors.primary}>
                Pay with{" "}
                {selectedPaymentMethod.brand.charAt(0).toUpperCase() +
                  selectedPaymentMethod.brand.slice(1)}{" "}
                •••• {selectedPaymentMethod.last4}
              </Text>
              <Text size="xs" weight="regular" color="#6B7280">
                Expires {String(selectedPaymentMethod.expMonth).padStart(2, "0")}/
                {String(selectedPaymentMethod.expYear).slice(-2)}
              </Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.footerCardRow}
            onPress={() => router.push("/add-payment")}
            activeOpacity={0.85}
          >
            <View style={styles.cardBrandIcon}>
              <Text size="xs" weight="bold" color="#9CA3AF">
                CARD
              </Text>
            </View>
            <View style={styles.cardDetails}>
              <Text size="md" weight="semiBold" color={BrandColors.secondary}>
                Pay with card
              </Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
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
  serviceNameWrap: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
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
  totalHeaderBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
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

  cardBrandIcon: {
    width: 60,
    height: 40,
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

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BrandColors.white,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    ...Shadows.lg,
  },
  walletButton: {
    // Full-width CTA. The SVG holds ONLY the wallet mark (Apple/Google
    // logo + "Pay" paths); the wrapper provides the rounded black
    // surface, and the SVG's tight viewBox guarantees the mark renders
    // dead-center horizontally and vertically.
    width: "100%",
    height: 64,
    backgroundColor: "#000008",
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  confirmButtonLabel: {
    flexShrink: 1,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  priceTag: {
    backgroundColor: BrandColors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
    flexShrink: 0,
  },
  footerCardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
});
