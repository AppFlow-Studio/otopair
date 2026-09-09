/**
 * useServiceRecordUpload — pick a service record from the device and attach it
 * to a vehicle.
 *
 * Extracted from VehicleServiceHistory so the advisory "Mark as Done" flow can
 * offer the same upload without duplicating the picker → signed-URL → POST →
 * recordUpload sequence. One implementation means the two entry points cannot
 * drift on accepted file types, error handling, or the toast the user sees.
 */
import { useCallback, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/hooks/useToast";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/*",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export interface ServiceRecordUploadTarget {
  vehicleOwnerId: Id<"vehicle_owners"> | undefined;
  vin: string | undefined;
}

export interface ServiceRecordUploadResult {
  /** Opens the picker and uploads. Resolves 'uploaded' | 'cancelled' | 'failed'
   *  so the caller can decide what to show next. */
  pickAndUpload: () => Promise<"uploaded" | "cancelled" | "failed">;
  uploading: boolean;
  /** False when we have no vehicle to attach the document to. */
  canUpload: boolean;
}

export function useServiceRecordUpload(
  target: ServiceRecordUploadTarget,
  options?: { onUploaded?: () => void },
): ServiceRecordUploadResult {
  const generateUploadUrl = useMutation(api.vehicleDocuments.generateUploadUrl);
  const recordUpload = useMutation(api.vehicleDocuments.recordUpload);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const normalizedVin = target.vin?.toUpperCase().trim();
  const canUpload = !!target.vehicleOwnerId && !!normalizedVin;

  const pickAndUpload = useCallback(async () => {
    if (!canUpload || uploading) return "cancelled" as const;
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_TYPES,
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || result.assets.length === 0) return "cancelled" as const;

      const asset = result.assets[0];
      const uploadUrl = await generateUploadUrl({});
      const blob = await (await fetch(asset.uri)).blob();
      const postRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": asset.mimeType ?? "application/octet-stream" },
        body: blob,
      });
      if (!postRes.ok) throw new Error(`Upload failed: ${postRes.status}`);

      const { storageId } = (await postRes.json()) as { storageId: Id<"_storage"> };
      await recordUpload({
        storageId,
        vehicleOwnerId: target.vehicleOwnerId!,
        vin: normalizedVin!,
        mimeType: asset.mimeType ?? "application/octet-stream",
        filename: asset.name,
        sizeBytes: asset.size ?? 0,
      });
      options?.onUploaded?.();
      return "uploaded" as const;
    } catch {
      toast.error("Upload failed", "Something went wrong — please try again.");
      return "failed" as const;
    } finally {
      setUploading(false);
    }
    // toast/options are stable enough in practice; deps kept to the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUpload, uploading, generateUploadUrl, recordUpload, target.vehicleOwnerId, normalizedVin]);

  return { pickAndUpload, uploading, canUpload };
}
