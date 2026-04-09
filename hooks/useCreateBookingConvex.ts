/**
 * useCreateBookingConvex
 *
 * Creates a booking via Convex api.bookings.createBatch, using data from stores.
 * Caches the result by optimistically updating the booking store (Convex reactivity
 * will also refresh useBookingsFromConvex).
 *
 * Falls back to local-only create when Convex data (userId, vin, timeSlotId) is missing.
 *
 * USED IN: Payment screen, confirmation flow
 */

import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUserFromConvex } from "./useUserFromConvex";
import { useVehicleOwnershipFromConvex } from "./useVehicleOwnershipFromConvex";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { displayTimeToHHMM } from "@/utils/timeSlotUtils";

export function useCreateBookingConvex() {
  const createBatch = useMutation(api.bookings.createBatch);
  const { userId } = useUserFromConvex();
  const { primaryVin } = useVehicleOwnershipFromConvex();
  const getMechanicById = useMechanicStore((s) => s.getMechanicById);
  const getShopById = useShopStore((s) => s.getShopById);

  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
  const selectedMechanicId = useBookingStore((s) => s.selectedMechanicId);
  const availableServices = useBookingStore((s) => s.availableServices);
  const selectedMechanicSlot = useBookingStore((s) => s.selectedMechanicSlot);
  const scheduledAppointment = useBookingStore((s) => s.scheduledAppointment);
  const createBooking = useBookingStore((s) => s.createBooking);

  // Resolve shopId: from selectedMechanicSlot or from selected mechanic's shop
  const effectiveShopId =
    selectedMechanicSlot?.shopId ?? (selectedMechanicId ? getMechanicById(selectedMechanicId)?.shopId : null);

  const scheduledDate = scheduledAppointment?.date;
  const scheduledTimeHHMM = scheduledAppointment?.time ? displayTimeToHHMM(scheduledAppointment.time) : null;

  // Slots for exact date+time (may be multiple mechanics); we'll pick the one matching selected mechanic
  const slotsForShopAndTime = useQuery(
    api.time_slots.getAvailableByShopAndDateTime,
    effectiveShopId && scheduledDate && scheduledTimeHHMM
      ? {
          shopId: effectiveShopId as Id<"shops">,
          date: scheduledDate,
          startTime: scheduledTimeHHMM,
        }
      : "skip",
  );

  const resolveTimeSlotId = useCallback(
    (mechanicId: string | null | undefined): Id<"time_slots"> | null => {
      if (selectedMechanicSlot?.timeSlotId) {
        return selectedMechanicSlot.timeSlotId as Id<"time_slots">;
      }
      const slots = slotsForShopAndTime;
      if (!slots || slots.length === 0) return null;
      const mechanicIdOpt = mechanicId ?? selectedMechanicId;
      if (mechanicIdOpt) {
        const forMechanic = slots.find((s) => s.mechanic_id === mechanicIdOpt);
        if (forMechanic) return forMechanic._id;
      }
      return slots[0]._id;
    },
    [selectedMechanicSlot?.timeSlotId, slotsForShopAndTime, selectedMechanicId],
  );

  const getSelectedVehicle = useVehicleStore((s) => s.getSelectedVehicle);

  const createBookingConvex = useCallback(
    async (mechanicId: string, bookingType: "book_now" | "schedule_later"): Promise<string[]> => {
      const shopId = effectiveShopId;
      const timeSlotId = resolveTimeSlotId(mechanicId);
      const vin = primaryVin ?? getSelectedVehicle()?.vin;

      if (!userId || !vin || !shopId || !timeSlotId || selectedServiceIds.length === 0) {
        const localId = createBooking(mechanicId, bookingType);
        return [localId];
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
      // DB values only: labor = rate × default_labor_hours, parts = default_parts_estimate (no fallbacks)
      const services = selectedServices.map((s) => {
        const hours = s.default_labor_hours ?? 0;
        const laborCost = laborRate * hours;
        const partsCost = s.default_parts_estimate ?? 0;
        return {
          service_id: s.id as Id<"services">,
          labor_cost: laborCost,
          parts_cost: partsCost,
          labor_hours: hours,
        };
      });

      const scheduledDateVal = scheduledAppointment?.date ?? new Date().toISOString().split("T")[0];
      const scheduledTimeVal = scheduledAppointment?.time ? displayTimeToHHMM(scheduledAppointment.time) : "09:00";

      const TAXES_AND_FEES = 5.0;
      // Service fee: 7% of service subtotal, $4.99 minimum, no cap
      // TODO: When subscriptions are wired, waive service fee for Preferred/Elite subscribers
      const SERVICE_FEE_RATE = 0.07;
      const SERVICE_FEE_MINIMUM = 4.99;
      const servicesSubtotal = services.reduce((sum, s) => sum + s.labor_cost + s.parts_cost, 0);
      const PLATFORM_FEE = servicesSubtotal > 0 ? Math.max(servicesSubtotal * SERVICE_FEE_RATE, SERVICE_FEE_MINIMUM) : 0;

      const bookingIds = await createBatch({
        user_id: userId,
        vin,
        shop_id: shopId as Id<"shops">,
        mechanic_id: mechanicId ? (mechanicId as Id<"mechanics">) : undefined,
        time_slot_id: timeSlotId,
        scheduled_date: scheduledDateVal,
        scheduled_time: scheduledTimeVal,
        services,
        taxes_and_fees: TAXES_AND_FEES,
        platform_fee: PLATFORM_FEE,
      });

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
      scheduledAppointment,
      getShopById,
      resolveTimeSlotId,
      createBatch,
      createBooking,
    ],
  );

  return { createBookingConvex };
}
