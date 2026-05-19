/**
 * useRecHistoryFromConvex
 *
 * Wraps api.jobRecommendations.getRecHistoryForVehicle to drive the
 * Bookings → Recommended services screen. Returns every rec for the active
 * VIN regardless of lifecycle (open, hidden, completed, expired, etc.).
 *
 * USED IN: app/(main-tabs)/bookings/recommended.tsx
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export interface RecHistoryItem {
  _id: string;
  service_id: string | null;
  service_name: string;
  urgency: "next_visit" | "within_3_months" | "soon";
  reason: string | null;
  shop_id: string;
  shop_name: string | null;
  mechanic_id: string;
  mechanic_name: string | null;
  created_at: number;
  updated_at: number;
  status: "open" | "acknowledged" | "completed" | "dismissed" | "expired";
  dismissed_reason:
    | "fixed"
    | "not_needed"
    | "mistake"
    | "completed_externally"
    | "completed_via_booking"
    | "hidden_by_driver"
    | null;
  completed_via_booking_id: string | null;
  resolved_at: number | null;
  acknowledged_at: number | null;
  scheduled_at: number | null;
  scheduled_mechanic_name?: string | null;
}

export function useRecHistoryFromConvex(vin: string | null | undefined) {
  const history = useQuery(
    (api as any).jobRecommendations.getRecHistoryForVehicle,
    vin ? { vin } : "skip",
  ) as RecHistoryItem[] | undefined;

  return {
    history: history ?? [],
    isLoading: vin != null && history === undefined,
  };
}
