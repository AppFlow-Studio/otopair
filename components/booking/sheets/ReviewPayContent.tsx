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
import { BrandColors, EstimatePill, FixedPriceBadge, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { getPartsBreakdown } from "@/constants/services";
import { BorderRadius, Shadows, getSheetContentPadding } from "@/constants/theme";
import { useBookingLaborHours } from "@/hooks/useBookingLaborHours";
import { useBookingPartsBreakdown } from "@/hooks/useBookingPartsBreakdown";
import { useBookingQuoteFallback } from "@/hooks/useBookingQuoteFallback";
import { useShopFixedPricesForServices } from "@/hooks/useShopFixedPricesForServices";
import { deriveDisclosedRange } from "@/lib/disclosedRange";
import { formatDurationForCar } from "@/lib/formatDuration";
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
  const selectedServiceOptions = useBookingStore((state) => state.selectedServiceOptions);
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
  const selectedMechanicSlot = useBookingStore((state) => state.selectedMechanicSlot);
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

  // Shop for pricing (shop labor rate only). The fallback to the time-slot's
  // shopId matters for "Any available mechanic" bookings: without it, the
  // fixed-price hook below receives undefined and every flat-rate service
  // re-renders as a range.
  const resolvedShopId = mechanic?.shopId ?? selectedMechanicSlot?.shopId;
  const shop = useMemo(() => {
    return resolvedShopId ? getShopById(resolvedShopId) : null;
  }, [resolvedShopId, getShopById]);
  const laborRate = shop?.labor_rate;
  const mechanicDisplayName = mechanic?.name ?? "Any available mechanic";
  const mechanicFirstName = mechanic?.name?.trim().split(/\s+/)[0] ?? "any available mechanic";
  const shopDisplayName =
    shop?.name ?? mechanic?.shopName ?? selectedMechanicSlot?.shopName ?? "Shop will assign a mechanic";

  // Get selected services
  const selectedServices = useMemo(
    () => availableServices.filter((service) => selectedServiceIds.includes(service.id)),
    [availableServices, selectedServiceIds],
  );

  // Vehicle-aware OEM parts with real unit prices (from part_fitments + part_prices).
  // When this returns data we use the per-part totals as the parts subtotal; when
  // it doesn't (walk-in vehicle, unconfigured vehicle, missing price data) we fall
  // back to the service's flat `default_parts_estimate`.
  const {
    breakdown: pricedPartsByService,
    isLoading: isPricedPartsLoading,
    hasRealData: hasRealPartsData,
  } = useBookingPartsBreakdown(
    selectedVehicle?.ownershipId,
    selectedServiceIds,
    selectedServiceOptions,
  );

  // TEMP: diagnose why priced parts aren't surfacing for the CR-V test booking.
  // Remove once the short-circuit (ownershipId / svc_* slugs) is fixed.
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[ReviewPay parts]", {
      ownershipId: selectedVehicle?.ownershipId,
      serviceIds: selectedServiceIds,
      services: selectedServices.map((s) => ({ id: s.id, name: s.name })),
      isPricedPartsLoading,
      pricedPartsByService,
    });
  }

  // Map serviceId → priced parts row so per-line lookups are O(1) below.
  // We include every service that has at least one fitment, even if individual
  // parts lack price data — those render as "Price TBD" instead of being
  // silently swapped for a synthetic SERVICE_PARTS fallback.
  const pricedPartsMap = useMemo(() => {
    const map = new Map<string, (typeof pricedPartsByService)[number]>();
    for (const row of pricedPartsByService) {
      if (row.winner !== null) map.set(String(row.serviceId), row);
    }
    return map;
  }, [pricedPartsByService]);

  // Per-service parts cost: priced total when we have any prices; otherwise
  // the flat `default_parts_estimate` so totals never collapse to $0 just
  // because price data is incomplete.
  const getServicePartsCost = useCallback(
    (service: (typeof selectedServices)[0]) => {
      const real = pricedPartsMap.get(String(service.id));
      if (real && real.partsTotal > 0) return real.partsTotal;
      return service.default_parts_estimate ?? 0;
    },
    [pricedPartsMap],
  );

  // Vehicle-specific labor hours from `labor_times.book_hours`; falls back to
  // `services.default_labor_hours` when there's no per-vehicle row.
  const {
    laborHours: laborHoursByService,
    isLoading: isLaborHoursLoading,
    hasFallback: hasLaborFallback,
  } = useBookingLaborHours(selectedVehicle?.ownershipId, selectedServiceIds);

  // Pricing v2 engine band + per-quote flags for the booking. Drives the
  // "Estimate" pill below when the engine refused a service or flagged any
  // line as tier_estimate / outside-band / etc.
  const quoteFallback = useBookingQuoteFallback(
    resolvedShopId,
    selectedVehicle?.ownershipId,
    selectedServiceIds,
  );

  const laborHoursMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of laborHoursByService) {
      map.set(String(row.serviceId), row.hours);
    }
    return map;
  }, [laborHoursByService]);

  // Per-(shop, service, tier) flat-price overrides. Server resolves the
  // tier from the vehicle so the hook only needs shop + ownership + service
  // ids. Hits replace the line's parts band and zero its labor contribution.
  const { map: fixedPriceMap, hasAnyFixed: hasAnyFixedPrice } =
    useShopFixedPricesForServices(
      resolvedShopId,
      selectedVehicle?.ownershipId,
      selectedServiceIds,
    );

  const getServiceLaborHours = useCallback(
    (service: (typeof selectedServices)[0]) => {
      const variant = laborHoursMap.get(String(service.id));
      if (typeof variant === "number") return variant;
      return service.default_labor_hours ?? 0;
    },
    [laborHoursMap],
  );

  // Calculate detailed breakdown (shop labor rate + per-service parts costs).
  const breakdown = useMemo(() => {
    const rate = laborRate ?? 0;
    const laborHours = selectedServices.reduce((sum, s) => sum + getServiceLaborHours(s), 0);
    const laborCost = Math.max(0, laborHours * rate);
    // Hours attributable to variable services only — drives the "Labor (X mins)"
    // label so the duration matches the displayed billable labor cost below.
    const variableLaborHours = selectedServices.reduce(
      (sum, s) =>
        fixedPriceMap.has(String(s.id)) ? sum : sum + getServiceLaborHours(s),
      0,
    );

    // Variable (banded) parts only — services that hit a flat price are
    // excluded from the ±25% band and contribute their flat amount on both
    // endpoints instead. Mirrors `computeDisclosedRange` (server).
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

    // Labor on flat-price lines is bundled into the flat price; subtract
    // those services' labor from the aggregate so it's not double-billed.
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

    // Pre-Job Approval flow: customer sees a range, not a single price.
    // ±25% band on banded parts; flat parts pin both endpoints; tax + fee
    // recomputed at both endpoints to respect tax brackets and the
    // platform-fee floor. When every line is flat, the range collapses to
    // a single point and `formatRange` renders just `$X`.
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

    // Per-row range components so each line ($parts, $tax, $fee) can show
    // the band the customer is actually agreeing to. Parts: ±25% on the
    // variable portion only; flat parts add a fixed amount on both ends.
    const PARTS_BAND = 0.25;
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

    return {
      laborHours,
      variableLaborHours,
      laborCost: billableLaborCost,
      partsCost,
      taxesAndFees,
      platformFee: serviceFee,
      subtotal: servicesTotal,
      total: servicesTotal + taxesAndFees + serviceFee,
      rangeLow: range.lowDollars,
      rangeHigh: range.highDollars,
      rangeFormatted: range.formatted,
      partsLow,
      partsHigh,
      taxLow,
      taxHigh,
      feeLow,
      feeHigh,
    };
  }, [selectedServices, laborRate, shop?.state, shop?.zip, getServicePartsCost, getServiceLaborHours, fixedPriceMap]);

  // Stash the customer-facing range in the booking store so the next screen
  // in the flow (BookingConfirmStatus) can quote the same band the customer
  // just agreed to without re-running the breakdown.
  const setDisclosedRangeFormatted = useBookingStore((s) => s.setDisclosedRangeFormatted);
  const setDisclosedRangeIsFixedPrice = useBookingStore((s) => s.setDisclosedRangeIsFixedPrice);
  const setDisclosedRangeIsEstimate = useBookingStore((s) => s.setDisclosedRangeIsEstimate);
  const isEstimateBadgeActive =
    quoteFallback.refused ||
    quoteFallback.flags.length > 0 ||
    hasLaborFallback ||
    (!isPricedPartsLoading && !hasRealPartsData);
  React.useEffect(() => {
    setDisclosedRangeFormatted(breakdown.rangeFormatted);
  }, [breakdown.rangeFormatted, setDisclosedRangeFormatted]);
  React.useEffect(() => {
    setDisclosedRangeIsFixedPrice(hasAnyFixedPrice);
  }, [hasAnyFixedPrice, setDisclosedRangeIsFixedPrice]);
  React.useEffect(() => {
    setDisclosedRangeIsEstimate(isEstimateBadgeActive);
  }, [isEstimateBadgeActive, setDisclosedRangeIsEstimate]);

  // Per-service line total — returns the labor+parts band so summary rows
  // can render the same ±25% parts variance that flows into the aggregate
  // estimated range. Labor is fixed (variance is negligible at this point).
  // Fixed-price hits pin both endpoints to the flat amount and zero labor.
  const getServiceLineRange = useCallback(
    (service: (typeof selectedServices)[0]) => {
      const flat = fixedPriceMap.get(String(service.id));
      if (flat != null) {
        return { low: flat, high: flat, isFixed: true as const };
      }
      const labor = (laborRate ?? 0) * getServiceLaborHours(service);
      const parts = getServicePartsCost(service);
      return {
        low: labor + parts * 0.75,
        high: labor + parts * 1.25,
        isFixed: false as const,
      };
    },
    [laborRate, getServicePartsCost, getServiceLaborHours, fixedPriceMap],
  );

  // Fallback parts breakdown for services without real OEM-priced data.
  // We split each unpriced service's default_parts_estimate among the SERVICE_PARTS
  // names so the line items still sum to that service's parts total.
  const fallbackPartsBreakdown = useMemo(() => {
    const unpricedNames: string[] = [];
    let unpricedTotal = 0;
    for (const service of selectedServices) {
      // Fixed-price services render their own "Parts — Fixed" row above —
      // skip them here so we don't double-count.
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
                {shopDisplayName}
              </Text>
              <Text size="sm" weight="medium" color="#6B7280">
                with {mechanicFirstName}
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
                    : `$${lineRange.low.toFixed(2)} – $${lineRange.high.toFixed(2)}`}
                </Text>
              </View>
            );
          })}

          {/* Detailed Breakdown */}
          <View style={styles.breakdownSection}>
            {/* Labor — variant-aware hours from `labor_times.book_hours`.
                Skeleton during the query so the band doesn't snap from
                default to variant-aware mid-render. */}
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
                skeleton row per service so the customer sees activity instead
                of a stale labor-only band. When data lands, real OEM parts
                replace the skeleton (name × qty @ unit price). Parts without
                price data render with "Price TBD". Services with zero fitments
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
                  // services (Brake Pads All-four) have `secondaryWinner` too —
                  // render both axles as separate part lines.
                  const parts = [priced.winner, priced.secondaryWinner].filter(
                    (p): p is NonNullable<typeof p> => p != null,
                  );
                  return parts.map((part) => {
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

            {/* Taxes & Fees — band recomputed at the parts endpoints. When
                every line is fixed-price the band collapses to a single
                value; render `$X` instead of the redundant `$X – $X`. */}
            <View style={styles.breakdownRow}>
              <Text size="sm" weight="regular" color="#6B7280">
                Taxes & Fees
              </Text>
              <Text size="sm" weight="medium" color="#6B7280">
                {breakdown.taxLow.toFixed(2) === breakdown.taxHigh.toFixed(2)
                  ? `$${breakdown.taxLow.toFixed(2)}`
                  : `$${breakdown.taxLow.toFixed(2)} – $${breakdown.taxHigh.toFixed(2)}`}
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
              {breakdown.feeLow.toFixed(2) === breakdown.feeHigh.toFixed(2)
                ? `$${breakdown.feeLow.toFixed(2)}`
                : `$${breakdown.feeLow.toFixed(2)} – $${breakdown.feeHigh.toFixed(2)}`}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.serviceDivider} />

          {/* Estimated total range — disclosed as a band. Stacked layout
              gives the range string the full card width so the dash + two
              prices read cleanly without clipping at "2xl" weight. */}
          <View style={styles.totalSection}>
            <View style={styles.totalHeader}>
              <Text size="md" weight="bold" color={BrandColors.primary}>
                {hasAnyFixedPrice && breakdown.rangeLow === breakdown.rangeHigh
                  ? "Estimated price"
                  : "Estimated price range"}
              </Text>
              <View style={styles.totalHeaderBadges}>
                {hasAnyFixedPrice && <FixedPriceBadge size="sm" />}
                {isEstimateBadgeActive && <EstimatePill size="sm" />}
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
              style={styles.totalRangeValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {breakdown.rangeFormatted}
            </Text>
          </View>
          <View style={styles.rangeExplainer}>
            <Info size={12} color="#9CA3AF" />
            <Text size="xs" weight="regular" color="#6B7280" style={styles.rangeExplainerText}>
              {isEstimateBadgeActive
                ? "Estimate — final price confirmed at booking. A $20 hold will be placed on your card today and only charged once your mechanic has inspected your car."
                : "A $20 hold will be placed on your card today. The final amount within this range is only charged once your mechanic has inspected your car."}
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
    bottom: -10,
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
    gap: Spacing.sm,
  },
  breakdownLabel: {
    flex: 1,
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
  totalRangeValue: {
    textAlign: "left",
  },
  // Retained for back-compat in case any external callers reference it.
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
