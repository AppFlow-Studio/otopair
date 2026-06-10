/**
 * useVehicleDocumentsFromConvex
 *
 * Wraps `api.vehicleDocuments.listByVin` for the active vehicle's VIN.
 * Returns shop-receipt uploads + their latest Reducto extraction so the
 * Cars-tab Service History can interleave them with native Otopair bookings.
 *
 * USED IN: components/cars/VehicleServiceHistory.tsx
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type DocumentParseStatus =
  | "queued"
  | "parsing"
  | "parsed"
  | "needs_review"
  | "failed";

export type DocumentReviewState =
  | "auto_accepted"
  | "user_confirmed"
  | "pending_review"
  | "rejected";

export interface VehicleDocumentRow {
  doc: {
    _id: Id<"vehicle_documents">;
    _creationTime: number;
    original_filename: string;
    mime_type: string;
    uploaded_at: number;
    parsed_at?: number;
    parse_status: DocumentParseStatus;
    parse_error?: string;
    storage_id: Id<"_storage">;
  };
  extraction: {
    _id: Id<"vehicle_document_extractions">;
    payload: Record<string, unknown> | null;
    overall_confidence: number;
    review_state: DocumentReviewState;
    created_at: number;
  } | null;
}

export interface UseVehicleDocumentsResult {
  rows: VehicleDocumentRow[];
  isLoading: boolean;
}

export function useVehicleDocumentsFromConvex(
  vin: string | undefined | null,
): UseVehicleDocumentsResult {
  const data = useQuery(
    api.vehicleDocuments.listByVin,
    vin ? { vin } : "skip",
  );
  return {
    rows: (data ?? []) as VehicleDocumentRow[],
    isLoading: data === undefined,
  };
}
