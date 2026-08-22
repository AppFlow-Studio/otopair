import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { CustomerInspectionSnapshot } from "@/lib/inspection-findings";

export type OpenApproval = {
  _id: string;
  cycle: "pre_job" | "mid_job" | "post_job";
  mechanic_set_price_cents: number;
  prior_ceiling_cents: number;
  parts_snapshot: any[];
  labor_hours?: number;
  labor_rate_cents?: number;
  notes?: string;
  /**
   * Mechanic's justification photos for the added scope, resolved to signed
   * URLs server-side. Always present from an up-to-date deploy (`[]` when the
   * mechanic attached none); optional here so the mobile client stays
   * backward-compatible with a deploy that predates the field.
   */
  scope_photos?: Array<{ storage_id: Id<"_storage">; url: string }>;
  inspection_snapshot?: CustomerInspectionSnapshot;
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
