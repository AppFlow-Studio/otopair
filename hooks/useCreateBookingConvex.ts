/**
 * useCreateBookingConvex
 *
 * Creates a booking via Convex api.bookings.createBatch, using data from stores.
 * Caches the result by optimistically updating the booking store (Convex reactivity
 * will also refresh useBookingsFromConvex).
 *
 * Throws when Convex data is missing so appointment bookings never look
 * successful while only living in local state.
 *
 * USED IN: Payment screen, confirmation flow
 */

import { useAction, useMutation, useQueries, useQuery, type RequestForQueries } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useBookingLaborHours } from "./useBookingLaborHours";
import { useBookingPartsBreakdown } from "./useBookingPartsBreakdown";
import { useBookingQuoteFallback } from "./useBookingQuoteFallback";
import { positionFromOption } from "@/constants/serviceVariants";
import { useUserFromConvex } from "./useUserFromConvex";
import { useToast } from "./useToast";
import { computeBookingTax } from "@/lib/tax";
import { computePlatformFeeDollars } from "@/lib/platformFee";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { displayTimeToHHMM } from "@/utils/timeSlotUtils";
import { formatBookingError, readBookingError } from "@/convex/lib/bookingErrors";
import type { ServerCheckoutLine } from "@/convex/lib/checkoutPrice";
import { useShopFixedPricesForServices } from "./useShopFixedPricesForServices";

const isLegacyTimeSlotId = (value: string | null | undefined): value is Id<"time_slots"> =>
  Boolean(value && !value.startsWith("computed:"));

type PreauthorizedPayment = {
  stripePaymentIntentId: string;
  idempotencyKey: string;
  holdAmountCents: number;
  paymentOrigin?: "card" | "apple_pay" | "google_pay";
};

/**
 * Everything the checkout derives its per-line price from, read from the same
 * hooks Review & Pay renders. Shared by the create payload and the live price
 * check on the confirm sheet (#390) so the labor the payload sends as
 * `labor_cost` and the labor the snapshot/live check compare can't drift apart.
 * `enabled: false` skips every query (the hooks' own skip patterns).
 */
function useCheckoutPricingSources(enabled = true) {
  const getMechanicById = useMechanicStore((s) => s.getMechanicById);
  const getShopById = useShopStore((s) => s.getShopById);
  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
  const selectedVehicleVin = useBookingStore((s) => s.selectedVehicleVin);
  const selectedMechanicId = useBookingStore((s) => s.selectedMechanicId);
  const selectedMechanicSlot = useBookingStore((s) => s.selectedMechanicSlot);
  const selectedServiceOptions = useBookingStore((s) => s.selectedServiceOptions);

  // Resolve shopId: from selectedMechanicSlot or from selected mechanic's shop
  const effectiveShopId =
    selectedMechanicSlot?.shopId ?? (selectedMechanicId ? getMechanicById(selectedMechanicId)?.shopId : null);

  const bookingVehicle = useVehicleStore((s) =>
    selectedVehicleVin ? s.vehicles[selectedVehicleVin] : undefined,
  );
  const vehicleOwnershipId = enabled ? bookingVehicle?.ownershipId : undefined;
  const queryServiceIds = enabled ? selectedServiceIds : EMPTY_IDS;

  // Mirror ReviewPayContent: prefer vehicle-specific `labor_times.book_hours`
  // over `services.default_labor_hours` so the booking row records the same
  // hours (and therefore the same labor $) the customer just agreed to.
  const { laborHours: laborHoursByService, isLoading: isLaborHoursLoading } =
    useBookingLaborHours(vehicleOwnershipId, queryServiceIds);
  const laborHoursMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of laborHoursByService) {
      map.set(String(row.serviceId), row.hours);
    }
    return map;
  }, [laborHoursByService]);

  // Same priced-parts source ReviewPayContent uses; falls back to defaults
  // for walk-in vehicles or mock svc_* ids via the hook's internal skip.
  const { breakdown: pricedPartsByService, isLoading: isPricedPartsLoading } =
    useBookingPartsBreakdown(vehicleOwnershipId, queryServiceIds, selectedServiceOptions);

  const pricedPartsTotalMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of pricedPartsByService) {
      if (row.partsTotal > 0) map.set(String(row.serviceId), row.partsTotal);
    }
    return map;
  }, [pricedPartsByService]);

  // Per-service axle/position picks (per_axle services), so the engine scales
  // labor + parts to the same axles the customer picked on Review & Pay.
  const servicePositions = useMemo(() => {
    const rec: Record<string, "front" | "rear" | "both"> = {};
    for (const sid of selectedServiceIds) {
      const pos = positionFromOption(selectedServiceOptions[sid]);
      if (pos === "front" || pos === "rear" || pos === "both") {
        rec[String(sid)] = pos;
      }
    }
    return rec;
  }, [selectedServiceIds, selectedServiceOptions]);

  // Tier-aware labor from the Pricing v2 engine — the SAME source
  // ReviewPayContent renders and the SAME number the server bills. Submitting
  // this (instead of flat shop.labor_rate × hours) is what stops the server's
  // createBatch labor-cost guard from rejecting high-tier vehicles with
  // LABOR_COST_TIER_MISMATCH. Keyed service id → labor $; refused/absent lines
  // fall back to the flat computation below (which is exactly when the server
  // also skips its cost check, so the two never disagree in a rejecting way).
  const engineQuote = useBookingQuoteFallback(
    enabled ? effectiveShopId : null,
    vehicleOwnershipId,
    queryServiceIds,
    servicePositions,
  );
  const engineLaborCostMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const [sid, line] of engineQuote.byService) {
      if (!line.refused && line.laborCost != null) {
        map.set(String(sid), Math.max(0, line.laborCost));
      }
    }
    return map;
  }, [engineQuote.byService]);

  /** Hours + labor $ for one line: engine tier labor when it priced the line,
   *  else flat shop rate × (vehicle hours ?? default hours). */
  const laborFor = useCallback(
    (service: { id: string; default_labor_hours?: number | null }, laborRate: number) => {
      const variantHours = laborHoursMap.get(String(service.id));
      const hours = typeof variantHours === "number" ? variantHours : (service.default_labor_hours ?? 0);
      const engineLabor = engineLaborCostMap.get(String(service.id));
      return { hours, laborCost: engineLabor != null ? engineLabor : laborRate * hours };
    },
    [laborHoursMap, engineLaborCostMap],
  );

  return {
    effectiveShopId,
    getShopById,
    selectedServiceIds,
    selectedVehicleVin,
    selectedMechanicId,
    selectedMechanicSlot,
    selectedServiceOptions,
    bookingVehicle,
    vehicleOwnershipId: bookingVehicle?.ownershipId,
    laborFor,
    engineLaborCostMap,
    pricedPartsTotalMap,
    isLoading: isLaborHoursLoading || isPricedPartsLoading || engineQuote.isLoading,
  };
}

const EMPTY_IDS: string[] = [];

export function useCreateBookingConvex() {
  const createBatch = useMutation(api.bookings.createBatch);
  const confirmPreauthorizedBatch = useAction(api.bookings.confirmPreauthorizedBatch);
  const toast = useToast();
  const { userId } = useUserFromConvex();
  const {
    effectiveShopId,
    getShopById,
    selectedServiceIds,
    selectedVehicleVin,
    selectedMechanicId,
    selectedMechanicSlot,
    selectedServiceOptions,
    bookingVehicle,
    laborFor,
    pricedPartsTotalMap,
  } = useCheckoutPricingSources();

  const availableServices = useBookingStore((s) => s.availableServices);
  const scheduledAppointment = useBookingStore((s) => s.scheduledAppointment);
  const sourceRecommendationId = useBookingStore((s) => s.sourceRecommendationId);
  const setSourceRecommendationId = useBookingStore((s) => s.setSourceRecommendationId);
  const customerNotes = useBookingStore((s) => s.customerNotes);
  const selectedDiagnosticSystem = useBookingStore((s) => s.selectedDiagnosticSystem);

  const scheduledDate = scheduledAppointment?.date;
  const scheduledTimeHHMM = scheduledAppointment?.time ? displayTimeToHHMM(scheduledAppointment.time) : null;

  // Skip query for mock shop IDs (e.g. "1", "2") — only call Convex with real IDs
  const isConvexShopId = effectiveShopId != null && effectiveShopId.length > 10;

  // Slots for exact date+time (may be multiple mechanics); we'll pick the one matching selected mechanic
  const slotsForShopAndTime = useQuery(
    api.time_slots.getAvailableByShopAndDateTime,
    isConvexShopId && scheduledDate && scheduledTimeHHMM
      ? {
          shopId: effectiveShopId as Id<"shops">,
          date: scheduledDate,
          startTime: scheduledTimeHHMM,
        }
      : "skip",
  );

  const resolveLegacyTimeSlotId = useCallback(
    (mechanicId: string | null | undefined): Id<"time_slots"> | null => {
      const mechanicIdOpt = mechanicId ?? selectedMechanicId;
      if (!mechanicIdOpt) return null;

      if (isLegacyTimeSlotId(selectedMechanicSlot?.timeSlotId)) return selectedMechanicSlot.timeSlotId;

      const slots = slotsForShopAndTime;
      if (!slots || slots.length === 0) return null;
      const forMechanic = slots.find(
        (s: { _id: string; mechanic_id?: string | null }) => s.mechanic_id === mechanicIdOpt,
      );
      return isLegacyTimeSlotId(forMechanic?._id) ? forMechanic._id : null;
    },
    [selectedMechanicSlot?.timeSlotId, slotsForShopAndTime, selectedMechanicId],
  );

  const createBookingConvex = useCallback(
    async (
      mechanicId: string | null | undefined,
      bookingType: "book_now" | "schedule_later",
      preauthorizedPayment?: PreauthorizedPayment,
    ): Promise<string[]> => {
      const shopId = effectiveShopId;
      const legacyTimeSlotId = resolveLegacyTimeSlotId(mechanicId);
      // Services and vehicle are one checkout unit. Never substitute the live
      // main vehicle if it changes after the basket was created.
      const vin = selectedVehicleVin;
      if (!vin || !bookingVehicle) {
        throw new Error("This booking is no longer attached to a vehicle. Please reselect the services and try again.");
      }
      if (!userId) {
        throw new Error("Your account is still loading. Please try again.");
      }

      const missingFields = [
        !shopId ? "shop" : null,
        !scheduledAppointment?.date || !scheduledAppointment?.time ? "time slot" : null,
        selectedServiceIds.length === 0 ? "selected services" : null,
      ].filter((field): field is string => field != null);

      if (missingFields.length > 0) {
        throw new Error(
          `We couldn't create this booking because the ${missingFields.join(", ")} ${missingFields.length === 1 ? "is" : "are"} still loading. Please go back, reselect the appointment time, and try again.`,
        );
      }

      const selectedServices = availableServices.filter((s) => selectedServiceIds.includes(s.id));
      if (selectedServices.length === 0) {
        throw new Error("No services selected");
      }

      // Use only shop labor rate (no default)
      const shop = shopId ? getShopById(shopId) : null;
      const laborRate = shop?.labor_rate;
      if (!shop || laborRate == null || laborRate === undefined) {
        throw new Error("Shop labor rate is required to create a booking.");
      }
      // DB values mirror ReviewPayContent so the booking row stores exactly
      // what the customer was shown:
      //   labor = rate × (vehicle-specific hours ?? default_labor_hours)
      //   parts = priced_parts total (part_fitments × part_prices) ?? default_parts_estimate
      // Round 6: parts_cost is always the real AI / OEM number. When it
      // falls outside the engine band, the server's createBatch band-check
      // stamps `fallback_catch` on `service_quote_flags` — we flag, we
      // don't substitute.
      const services = selectedServices.map((s) => {
        // Tier-aware engine labor when available; flat rate only as the
        // refuse/unenrolled fallback (server skips its check there too).
        const { hours, laborCost } = laborFor(s, laborRate);
        const pricedParts = pricedPartsTotalMap.get(String(s.id));
        const partsCost = typeof pricedParts === "number" ? pricedParts : (s.default_parts_estimate ?? 0);
        return {
          service_id: s.id as Id<"services">,
          labor_cost: laborCost,
          parts_cost: partsCost,
          labor_hours: hours,
        };
      });

      // Sum of per-service labor minutes from the same `useBookingLaborHours`
      // source the Review & Pay screen renders. Sent to `createBatch` as
      // `displayed_labor_minutes` so the booking's `estimated_labor_minutes`
      // matches the duration the customer just agreed to — without this the
      // server falls back to `resolveBookingLaborMinutes`, which walks a
      // different path through `service_vehicle_specs` / `labor_times` and
      // can return e.g. 17 min for an oil change the customer saw as 42 min.
      const totalLaborMinutes = services.reduce(
        (sum, s) => sum + (s.labor_hours ?? 0),
        0,
      ) * 60;

      const scheduledDateVal = scheduledAppointment?.date ?? new Date().toISOString().split("T")[0];
      const scheduledTimeVal = scheduledAppointment?.time ? displayTimeToHHMM(scheduledAppointment.time) : "09:00";

      // Platform fee: system-level config in lib/platformFee.ts. Both the
      // client display path and the server-authoritative createBatch path
      // call the same helper, so the customer always sees what we charge.
      // TODO: When subscriptions are wired, waive service fee for Preferred/Elite subscribers
      const servicesSubtotal = services.reduce((sum, s) => sum + s.labor_cost + s.parts_cost, 0);
      const PLATFORM_FEE = computePlatformFeeDollars(servicesSubtotal);
      // Tax: client-side display value only. Convex `createBatch` will
      // recompute server-side using the same `computeBookingTax` util —
      // see convex/bookings.ts. If they disagree (e.g. client tampered
      // with shop data) the server value wins. We send this for the
      // optimistic UI and as a cross-check.
      const totalLabor = services.reduce((sum, s) => sum + s.labor_cost, 0);
      const totalParts = services.reduce((sum, s) => sum + s.parts_cost, 0);
      const TAXES_AND_FEES = computeBookingTax({
        laborDollars: totalLabor,
        partsDollars: totalParts,
        state: shop?.state,
        zip: shop?.zip,
      }).taxDollars;

      // Snapshot per-service option picks (e.g. Brake Pads → Front and rear)
      // so the booking row carries the labels forward to the mechanic's
      // schedule card without an extra service_options lookup.
      const selectedOptionsPayload = Object.entries(selectedServiceOptions)
        .filter(([sid]) => selectedServiceIds.includes(sid))
        .map(([sid, opt]) => ({
          service_id: sid as Id<"services">,
          option_id: opt.optionId as Id<"service_options">,
          option_label: opt.option_label ?? "",
          option_type: opt.option_type,
        }))
        .filter((o) => o.option_label.length > 0);

      // Axle/position picks per service (e.g. Brake Pads → "front"). Derived
      // from the same `selectedServiceOptions` row that drives labor_hours and
      // parts_cost_avg, so the booking snapshot freezes the same fitment the
      // customer saw on Review & Pay.
      const serviceVariantsPayload: Array<{ service_id: Id<"services">; position: string }> = [];
      for (const sid of selectedServiceIds) {
        const position = positionFromOption(selectedServiceOptions[sid]);
        if (!position) continue;
        serviceVariantsPayload.push({ service_id: sid as Id<"services">, position });
      }

      const trimmedNotes = customerNotes.trim();

      // Error toast surfaces here; the success "Booking submitted." toast
      // fires later from confirmation.tsx's Back-to-Home handler so it
      // lands on the home screen instead of expiring on /confirming.
      // The booking is in `pending_shop_acceptance` after this resolves,
      // NOT `confirmed` — the Trust-Moment "Booking confirmed" toast fires
      // separately via `useBookingStatusToasts` when the shop accepts.
      // Slot hold acquired on the pick-datetime screen for this checkout. The
      // server verifies it (active, unexpired, session + slot match), reuses
      // its pinned mechanic, and deletes it in the SAME mutation as the booking
      // insert. A missing/expired hold silently falls back to normal resolution
      // (the availability check is the backstop), so a stale id never blocks a
      // legitimate booking. Always send session_id alongside hold_id so the
      // server excludes this checkout's own hold from the availability check.
      const holdId = useBookingStore.getState().holdId;
      const holdSessionId = useBookingStore.getState().holdSessionId;
      // #390: the price Review & Pay rendered when the customer tapped
      // Authorize, captured there (payment.tsx) and sent verbatim — never
      // rebuilt here, or it would equal the live price and defeat the check.
      // No snapshot → omit, and the server books exactly as before.
      const priceSnapshot = useBookingStore.getState().checkoutPriceSnapshot;

      let bookingIds: string[];
      try {
        const createBatchPayload = {
          user_id: userId,
          vin,
          shop_id: shopId as Id<"shops">,
          mechanic_id: mechanicId ? (mechanicId as Id<"mechanics">) : undefined,
          ...(legacyTimeSlotId ? { time_slot_id: legacyTimeSlotId } : {}),
          scheduled_date: scheduledDateVal,
          scheduled_time: scheduledTimeVal,
          services,
          hold_id: holdId ? (holdId as Id<"slot_holds">) : undefined,
          session_id: holdSessionId ?? undefined,
          taxes_and_fees: TAXES_AND_FEES,
          platform_fee: PLATFORM_FEE,
          displayed_labor_minutes:
            totalLaborMinutes > 0 ? totalLaborMinutes : undefined,
          source_recommendation_id: sourceRecommendationId
            ? (sourceRecommendationId as Id<"job_recommendations">)
            : undefined,
          customer_notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
          diagnostic_system: selectedDiagnosticSystem ?? undefined,
          selected_service_options:
            selectedOptionsPayload.length > 0 ? selectedOptionsPayload : undefined,
          service_variants: serviceVariantsPayload.length > 0 ? serviceVariantsPayload : undefined,
          preauthorized_payment: preauthorizedPayment
            ? {
                stripe_payment_intent_id: preauthorizedPayment.stripePaymentIntentId,
                idempotency_key: preauthorizedPayment.idempotencyKey,
                hold_amount_cents: preauthorizedPayment.holdAmountCents,
                payment_origin: preauthorizedPayment.paymentOrigin,
              }
            : undefined,
          ...(priceSnapshot
            ? {
                expected_price: {
                  ...priceSnapshot.price,
                  lines: priceSnapshot.price.lines.map((line) => ({
                    ...line,
                    service_id: line.service_id as Id<"services">,
                  })),
                },
              }
            : {}),
        };

        bookingIds = await (preauthorizedPayment
          ? confirmPreauthorizedBatch(createBatchPayload)
          : createBatch(createBatchPayload));
      } catch (err) {
        // Typed conflicts (PRICE_CHANGED, SERVICE_NOT_OFFERED, SLOT_*, …) are
        // routed by the caller (confirming.tsx) into their own recovery UI —
        // a generic toast on top would contradict it. Untyped failures keep
        // the toast, with a readable sentence instead of a fixed "Try again".
        if (!readBookingError(err)) {
          toast.error("Couldn't submit booking.", formatBookingError(err, "Try again."));
        }
        throw err;
      }

      // Clear the rec link so subsequent (unrelated) bookings don't reuse it.
      if (sourceRecommendationId) setSourceRecommendationId(null);

      // The server already deleted the slot hold in the booking mutation; drop
      // the client-side copy so the countdown/resume logic stops tracking it.
      useBookingStore.getState().clearSlotHold();

      // One appointment = one booking ID
      return bookingIds;
    },
    [
      userId,
      selectedVehicleVin,
      bookingVehicle,
      effectiveShopId,
      selectedServiceIds,
      availableServices,
      laborFor,
      pricedPartsTotalMap,
      scheduledAppointment,
      getShopById,
      createBatch,
      confirmPreauthorizedBatch,
      sourceRecommendationId,
      setSourceRecommendationId,
      selectedServiceOptions,
      customerNotes,
      selectedDiagnosticSystem,
      toast,
      resolveLegacyTimeSlotId,
    ],
  );

  return { createBookingConvex };
}

// ============================================================================
// Live checkout checks shared by Review & Pay and the confirm sheet
// ============================================================================

const toCents = (dollars: number): number => Math.round(dollars * 100);

/**
 * The checkout's price per line RIGHT NOW, in the shape the server's
 * `diffCheckoutPrice` compares (#390): the shop's set price when it has one,
 * the labor this checkout would send, and the engine's labor. The confirm
 * sheet diffs the Authorize-time snapshot against this to pause the auto-fire
 * the moment a shop edit lands — the server re-checks at commit either way.
 * `lines` is null while any source is loading or when disabled.
 */
export function useCheckoutLivePriceLines(enabled: boolean): {
  lines: ServerCheckoutLine[] | null;
} {
  const {
    effectiveShopId,
    getShopById,
    selectedServiceIds,
    vehicleOwnershipId,
    laborFor,
    engineLaborCostMap,
    pricedPartsTotalMap,
    isLoading,
  } = useCheckoutPricingSources(enabled);
  const availableServices = useBookingStore((s) => s.availableServices);
  const fixedPrices = useShopFixedPricesForServices(
    enabled ? effectiveShopId : null,
    vehicleOwnershipId,
    selectedServiceIds,
  );
  const laborRate = effectiveShopId ? getShopById(effectiveShopId)?.labor_rate : undefined;

  const lines = useMemo(() => {
    if (!enabled || isLoading || fixedPrices.isLoading || laborRate == null) return null;
    const services = availableServices.filter((s) => selectedServiceIds.includes(s.id));
    return services.map((s): ServerCheckoutLine => {
      const { laborCost } = laborFor(s, laborRate);
      const shopPrice = fixedPrices.map.get(String(s.id));
      const engineLabor = engineLaborCostMap.get(String(s.id));
      const parts = pricedPartsTotalMap.get(String(s.id)) ?? s.default_parts_estimate ?? 0;
      return {
        serviceId: String(s.id),
        shopPrice: shopPrice
          ? { lowCents: toCents(shopPrice.lowDollars), highCents: toCents(shopPrice.highDollars) }
          : null,
        billedLaborCents: toCents(laborCost),
        billedPartsCents: toCents(parts),
        engineLaborCents: engineLabor != null ? toCents(engineLabor) : null,
        engineLowCents: null,
        engineHighCents: null,
      };
    });
  }, [
    enabled,
    isLoading,
    fixedPrices.isLoading,
    fixedPrices.map,
    laborRate,
    availableServices,
    selectedServiceIds,
    laborFor,
    engineLaborCostMap,
    pricedPartsTotalMap,
  ]);

  return { lines };
}

export type CheckoutServiceGate = {
  /** The shop can't book every service in the cart right now. */
  blocked: boolean;
  /** Server sentence for the banner (null when not blocked). */
  message: string | null;
  /** Cart service ids the shop won't book. */
  blockedServiceIds: string[];
  /** True only while the first answer is loading. */
  isLoading: boolean;
};

/**
 * Live Review & Pay / confirm gate (#404): can this shop book every service in
 * the cart right now? Same predicate as the commit-time SERVICE_NOT_OFFERED
 * guard, reactive to the shop's Settings → Services edits. Sends the same
 * `source_recommendation_id` + VIN the create payload does, so the
 * same-shop recommendation exemption matches the server. Uses `useQueries`
 * so a query error reads as "not blocked" instead of throwing the screen —
 * the server guard stays the authority.
 */
export function useCheckoutServiceGate(enabled: boolean): CheckoutServiceGate {
  const getMechanicById = useMechanicStore((s) => s.getMechanicById);
  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
  const selectedVehicleVin = useBookingStore((s) => s.selectedVehicleVin);
  const selectedMechanicId = useBookingStore((s) => s.selectedMechanicId);
  const selectedMechanicSlot = useBookingStore((s) => s.selectedMechanicSlot);
  const sourceRecommendationId = useBookingStore((s) => s.sourceRecommendationId);
  const shopId =
    selectedMechanicSlot?.shopId ??
    (selectedMechanicId ? getMechanicById(selectedMechanicId)?.shopId : null);
  const canQuery = enabled && !!shopId && selectedServiceIds.length > 0;

  const requests = useMemo(
    () =>
      canQuery
        ? {
            gate: {
              query: api.shop_services.validateCheckoutServices,
              args: {
                shop_id: String(shopId),
                service_ids: selectedServiceIds.map(String),
                ...(sourceRecommendationId
                  ? { source_recommendation_id: sourceRecommendationId }
                  : {}),
                ...(selectedVehicleVin ? { vin: selectedVehicleVin } : {}),
              },
            },
          }
        : {},
    [canQuery, shopId, selectedServiceIds, sourceRecommendationId, selectedVehicleVin],
  );
  const results = useQueries(requests as RequestForQueries);
  const result = canQuery ? results.gate : undefined;

  return useMemo((): CheckoutServiceGate => {
    if (!canQuery || result instanceof Error) {
      return { blocked: false, message: null, blockedServiceIds: [], isLoading: false };
    }
    if (result === undefined) {
      return { blocked: false, message: null, blockedServiceIds: [], isLoading: true };
    }
    const gate = result as {
      ok: boolean;
      blocked: { serviceId: string }[];
      message: string | null;
    };
    if (gate.ok) {
      return { blocked: false, message: null, blockedServiceIds: [], isLoading: false };
    }
    return {
      blocked: true,
      message: gate.message ?? "The shop no longer offers one of these services.",
      blockedServiceIds: gate.blocked.map((b) => String(b.serviceId)),
      isLoading: false,
    };
  }, [canQuery, result]);
}
