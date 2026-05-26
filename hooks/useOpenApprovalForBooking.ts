import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type OpenApproval = {
  _id: string;
  cycle: "pre_job" | "mid_job" | "post_job";
  mechanic_set_price_cents: number;
  prior_ceiling_cents: number;
  parts_snapshot: any[];
  labor_hours?: number;
  labor_rate_cents?: number;
  notes?: string;
  submitted_at_ms: number;
  sla_expires_at_ms?: number;
  disclosed_range_low_cents?: number;
  disclosed_range_high_cents?: number;
};

export function useOpenApprovalForBooking(
  bookingId: Id<"bookings"> | string | undefined | null,
): { approval: OpenApproval | null; isLoading: boolean } {
  const data = useQuery(
    api.booking_approvals.getOpenApprovalForBooking,
    bookingId
      ? { bookingId: bookingId as Id<"bookings"> }
      : "skip",
  ) as OpenApproval | null | undefined;
  return {
    approval: (data as OpenApproval | null) ?? null,
    isLoading: !!bookingId && data === undefined,
  };
}
