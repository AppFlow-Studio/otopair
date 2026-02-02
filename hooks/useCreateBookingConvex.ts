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
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { displayTimeToHHMM } from "@/utils/timeSlotUtils";

export function useCreateBookingConvex() {
  const createBatch = useMutation(api.bookings.createBatch);
  const { userId } = useUserFromConvex();
  const { primaryVin } = useVehicleOwnershipFromConvex();

  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
  const availableServices = useBookingStore((s) => s.availableServices);
  const selectedMechanicSlot = useBookingStore((s) => s.selectedMechanicSlot);
  const scheduledAppointment = useBookingStore((s) => s.scheduledAppointment);
  const getSelectedServicesTotal = useBookingStore((s) => s.getSelectedServicesTotal);
  const setBookingsFromConvex = useBookingStore((s) => s.setBookingsFromConvex);
  const createBooking = useBookingStore((s) => s.createBooking);

  // Resolve time slot when we have shopId + date + time but no timeSlotId
  const shopId = selectedMechanicSlot?.shopId;
  const scheduledDate = scheduledAppointment?.date;
  const scheduledTimeHHMM = scheduledAppointment?.time ? displayTimeToHHMM(scheduledAppointment.time) : null;
  const slotsForShop = useQuery(
    api.time_slots.getAvailableByShopAndDateTime,
    shopId && scheduledDate && scheduledTimeHHMM
      ? { shopId: shopId as Id<"shops">, date: scheduledDate, startTime: scheduledTimeHHMM }
      : "skip",
  );

  const resolveTimeSlotId = useCallback((): Id<"time_slots"> | null => {
    if (selectedMechanicSlot?.timeSlotId) {
      return selectedMechanicSlot.timeSlotId as Id<"time_slots">;
    }
    const slots = slotsForShop;
    if (slots && slots.length > 0) {
      return slots[0]._id;
    }
    return null;
  }, [selectedMechanicSlot?.timeSlotId, slotsForShop]);

  const getSelectedVehicle = useVehicleStore((s) => s.getSelectedVehicle);

  const createBookingConvex = useCallback(
    async (mechanicId: string, bookingType: "book_now" | "schedule_later"): Promise<string[]> => {
      const timeSlotId = resolveTimeSlotId();
      const vin = primaryVin ?? getSelectedVehicle()?.vin;

      if (!userId || !vin || !shopId || !timeSlotId || selectedServiceIds.length === 0) {
        // Fallback to local-only
        const localId = createBooking(mechanicId, bookingType);
        return [localId];
      }

      const selectedServices = availableServices.filter((s) => selectedServiceIds.includes(s.id));
      if (selectedServices.length === 0) {
        throw new Error("No services selected");
      }

      const totalPrice = getSelectedServicesTotal();
      const laborRatio = 0.6;
      const laborTotal = totalPrice * laborRatio;
      const partsTotal = totalPrice * (1 - laborRatio);
      const perServiceLabor = laborTotal / selectedServices.length;
      const perServiceParts = partsTotal / selectedServices.length;

      const services = selectedServices.map((s) => ({
        service_id: s.id as Id<"services">,
        labor_cost: perServiceLabor,
        parts_cost: perServiceParts,
      }));

      const scheduledDateVal = scheduledAppointment?.date ?? new Date().toISOString().split("T")[0];
      const scheduledTimeVal = scheduledAppointment?.time ? displayTimeToHHMM(scheduledAppointment.time) : "09:00";

      const bookingIds = await createBatch({
        user_id: userId,
        vin,
        shop_id: shopId as Id<"shops">,
        mechanic_id: mechanicId ? (mechanicId as Id<"mechanics">) : undefined,
        time_slot_id: timeSlotId,
        scheduled_date: scheduledDateVal,
        scheduled_time: scheduledTimeVal,
        services,
      });

      return bookingIds;
    },
    [
      userId,
      primaryVin,
      getSelectedVehicle,
      shopId,
      selectedServiceIds,
      availableServices,
      scheduledAppointment,
      getSelectedServicesTotal,
      resolveTimeSlotId,
      createBatch,
      createBooking,
    ],
  );

  return { createBookingConvex };
}
