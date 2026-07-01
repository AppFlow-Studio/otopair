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

import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useBookingLaborHours } from "./useBookingLaborHours";
import { useBookingPartsBreakdown } from "./useBookingPartsBreakdown";
import { positionFromOption } from "@/constants/serviceVariants";
import { useUserFromConvex } from "./useUserFromConvex";
import { useToast } from "./useToast";
import { useVehicleOwnershipFromConvex } from "./useVehicleOwnershipFromConvex";
import { computeBookingTax } from "@/lib/tax";
import { computePlatformFeeDollars } from "@/lib/platformFee";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { displayTimeToHHMM } from "@/utils/timeSlotUtils";

const isLegacyTimeSlotId = (value: string | null | undefined): value is Id<"time_slots"> =>
  Boolean(value && !value.startsWith("computed:"));

type PreauthorizedPayment = {
  stripePaymentIntentId: string;
  idempotencyKey: string;
  holdAmountCents: number;
  paymentOrigin?: "card" | "apple_pay" | "google_pay";
};

export function useCreateBookingConvex() {
  const createBatch = useMutation(api.bookings.createBatch);
  const confirmPreauthorizedBatch = useAction(api.bookings.confirmPreauthorizedBatch);
  const toast = useToast();
  const { userId } = useUserFromConvex();
  const { primaryVin } = useVehicleOwnershipFromConvex();
  const getMechanicById = useMechanicStore((s) => s.getMechanicById);
  const getShopById = useShopStore((s) => s.getShopById);

  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
  const selectedMechanicId = useBookingStore((s) => s.selectedMechanicId);
  const availableServices = useBookingStore((s) => s.availableServices);
  const selectedMechanicSlot = useBookingStore((s) => s.selectedMechanicSlot);
  const scheduledAppointment = useBookingStore((s) => s.scheduledAppointment);
  const sourceRecommendationId = useBookingStore((s) => s.sourceRecommendationId);
  const setSourceRecommendationId = useBookingStore((s) => s.setSourceRecommendationId);
  const selectedServiceOptions = useBookingStore((s) => s.selectedServiceOptions);
  const customerNotes = useBookingStore((s) => s.customerNotes);
  const selectedDiagnosticSystem = useBookingStore((s) => s.selectedDiagnosticSystem);

  // Resolve shopId: from selectedMechanicSlot or from selected mechanic's shop
  const effectiveShopId =
    selectedMechanicSlot?.shopId ?? (selectedMechanicId ? getMechanicById(selectedMechanicId)?.shopId : null);

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

  const getSelectedVehicle = useVehicleStore((s) => s.getSelectedVehicle);
  // Subscribe to selectedVehicleId so vehicleOwnershipId stays reactive when the
  // user switches cars mid-flow — `getSelectedVehicle` alone is a stable ref.
  const selectedVehicleId = useVehicleStore((s) => s.selectedVehicleId);
  const vehicleOwnershipId = useMemo(
    () => getSelectedVehicle()?.ownershipId,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedVehicleId, getSelectedVehicle],
  );

  // Mirror ReviewPayContent: prefer vehicle-specific `labor_times.book_hours`
  // over `services.default_labor_hours` so the booking row records the same
  // hours (and therefore the same labor $) the customer just agreed to.
  const { laborHours: laborHoursByService } = useBookingLaborHours(
    vehicleOwnershipId,
    selectedServiceIds,
  );
  const laborHoursMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of laborHoursByService) {
      map.set(String(row.serviceId), row.hours);
    }
    return map;
  }, [laborHoursByService]);

  // Same priced-parts source ReviewPayContent uses; falls back to defaults
  // for walk-in vehicles or mock svc_* ids via the hook's internal skip.
  const { breakdown: pricedPartsByService } = useBookingPartsBreakdown(
    vehicleOwnershipId,
    selectedServiceIds,
    selectedServiceOptions,
  );

  const pricedPartsTotalMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of pricedPartsByService) {
      if (row.partsTotal > 0) map.set(String(row.serviceId), row.partsTotal);
    }
    return map;
  }, [pricedPartsByService]);

  const createBookingConvex = useCallback(
    async (
      mechanicId: string | null | undefined,
      bookingType: "book_now" | "schedule_later",
      preauthorizedPayment?: PreauthorizedPayment,
    ): Promise<string[]> => {
      const shopId = effectiveShopId;
      const legacyTimeSlotId = resolveLegacyTimeSlotId(mechanicId);
      // Prefer the user's currently selected vehicle in the booking flow.
      // `primaryVin` is the user's default car and is only useful as a
      // fallback for entry points that don't explicitly switch cars
      // (e.g., AI chat). Otherwise picking BMW would still write the VW's
      // VIN whenever the VW is marked primary.
      const vin = getSelectedVehicle()?.vin ?? primaryVin;

      const missingFields = [
        !userId ? "user" : null,
        !vin ? "vehicle VIN" : null,
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
        const variantHours = laborHoursMap.get(String(s.id));
        const hours = typeof variantHours === "number" ? variantHours : (s.default_labor_hours ?? 0);
        const laborCost = laborRate * hours;
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
        };

        bookingIds = await (preauthorizedPayment
          ? confirmPreauthorizedBatch(createBatchPayload)
          : createBatch(createBatchPayload));
      } catch (err) {
        toast.error(
          "Couldn't submit booking.",
          "Try again.",
        );
        throw err;
      }

      // Clear the rec link so subsequent (unrelated) bookings don't reuse it.
      if (sourceRecommendationId) setSourceRecommendationId(null);

      // One appointment = one booking ID
      return bookingIds;
    },
    [
      userId,
      primaryVin,
      getSelectedVehicle,
      effectiveShopId,
      selectedServiceIds,
      availableServices,
      laborHoursMap,
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
