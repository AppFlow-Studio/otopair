/**
 * VehicleServiceHistory — unified per-vehicle service history.
 *
 * The "carfax moment" surface on the Cars tab. Lists Otopair completed
 * bookings AND user-uploaded shop receipts (parsed by Reducto) for the
 * active VIN, merged into one descending-by-date list with type badges.
 *
 * Upload flow lives here too: tapping "Add Service History" opens the
 * DocumentPicker, then we (1) request a signed upload URL from Convex,
 * (2) POST the file bytes to that URL, (3) call `recordUpload` to persist
 * the storage_id + schedule the Reducto parse action.
 *
 * Imported document rows show their parse_status badge and route to
 * ParsedDocumentSheet on tap (built in a follow-up).
 */

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Receipt as ReceiptIcon,
} from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { useMutation } from "convex/react";
import { Image } from "expo-image";

import { Text } from "@/components/shared-ui";
import { useToast } from "@/hooks/useToast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";
import {
  useVehicleDocumentsFromConvex,
  type DocumentParseStatus,
  type DocumentReviewState,
  type VehicleDocumentRow,
} from "@/hooks/useVehicleDocumentsFromConvex";
import { moderateScale, scale } from "@/utils/responsive";

import { ParsedDocumentSheet } from "@/components/receipts/ParsedDocumentSheet";
import { ReceiptSheet } from "@/components/receipts/ReceiptSheet";

// ───────────────────────────────────────────────────────────────────────────
// Types — unified row model
// ───────────────────────────────────────────────────────────────────────────

interface BookingRow {
  kind: "booking";
  id: string;
  bookingId: Id<"bookings">;
  dateMs: number;
  title: string;
  subtitle: string;
  totalCents?: number;
}

interface DocRow {
  kind: "doc";
  id: string;
  documentId: Id<"vehicle_documents">;
  dateMs: number;
  title: string;
  subtitle: string;
  parseStatus: DocumentParseStatus;
  reviewState: DocumentReviewState | null;
  totalCents?: number;
  /** Signed storage URL — used as the row icon for image uploads. */
  thumbnailUrl: string | null;
  /** True when the original upload was an image; otherwise (PDF / docx) the
   *  row falls back to a clean receipt tile. */
  isImage: boolean;
}

type UnifiedRow = BookingRow | DocRow;

interface Props {
  vin: string | undefined;
  vehicleOwnerId?: Id<"vehicle_owners">;
  isDarkBg?: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// Formatters
// ───────────────────────────────────────────────────────────────────────────

function fmtDateFromMs(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtUSDCents(cents: number | undefined | null): string | null {
  if (cents == null) return null;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function parseIsoToMs(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

// ───────────────────────────────────────────────────────────────────────────
// Doc-row projection from extraction payload
// ───────────────────────────────────────────────────────────────────────────

interface ExtractionView {
  serviceDateMs: number | null;
  shopName: string | null;
  servicesSummary: string;
  totalCents: number | null;
}

function projectExtraction(row: VehicleDocumentRow): ExtractionView {
  const payload = row.extraction?.payload as Record<string, unknown> | null;
  if (!payload) {
    return {
      serviceDateMs: null,
      shopName: null,
      servicesSummary: "",
      totalCents: null,
    };
  }
  const serviceDate = typeof payload.service_date === "string" ? payload.service_date : null;
  const shopBlock = payload.shop as Record<string, unknown> | undefined;
  const shopName = typeof shopBlock?.name === "string" ? (shopBlock.name as string) : null;

  const lineItems = Array.isArray(payload.line_items)
    ? (payload.line_items as Array<Record<string, unknown>>)
    : [];
  const services = lineItems
    .filter((li) => li.kind === "service")
    .map((li) => String(li.description ?? ""))
    .filter((s) => s.length > 0);
  let summary = services.slice(0, 2).join(", ");
  if (services.length > 2) summary += ` +${services.length - 2} more`;
  if (!summary) {
    const concern = typeof payload.customer_concern === "string" ? payload.customer_concern : "";
    summary = concern || "Imported receipt";
  }

  const totalCents = typeof payload.total_cents === "number" ? payload.total_cents : null;

  return {
    serviceDateMs: parseIsoToMs(serviceDate),
    shopName,
    servicesSummary: summary,
    totalCents,
  };
}

// Human-friendly, on-brand status copy. The finished ("parsed") state
// shows NO pill — the receipt data itself is the confirmation, so a
// green "Imported" tag just added visual noise.

/** Row leading icon. Image uploads render as a true thumbnail; PDFs /
 *  other docs render the same clean brand-blue receipt tile the Otopair
 *  booking rows use, so the whole list reads as one system (no odd
 *  purple tile or shop-initial letter). */
function DocRowIcon({
  thumbnailUrl,
  isImage,
}: {
  thumbnailUrl: string | null;
  isImage: boolean;
}) {
  if (isImage && thumbnailUrl) {
    return (
      <Image
        source={{ uri: thumbnailUrl }}
        style={styles.thumbnailImage}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View style={styles.rowIcon}>
      <ReceiptIcon size={scale(18)} color="#5299FE" />
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────

export function VehicleServiceHistory({
  vin,
  vehicleOwnerId,
  isDarkBg = false,
}: Props) {
  const toast = useToast();
  const { historyBookings, isLoading: bookingsLoading } = useMyBookingsWithDetails();
  const { rows: docRows, isLoading: docsLoading } = useVehicleDocumentsFromConvex(vin);

  const generateUploadUrl = useMutation(api.vehicleDocuments.generateUploadUrl);
  const recordUpload = useMutation(api.vehicleDocuments.recordUpload);

  const [selectedBookingId, setSelectedBookingId] = useState<Id<"bookings"> | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<Id<"vehicle_documents"> | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);

  const normalizedVin = vin?.toUpperCase().trim();

  const bookingRows: BookingRow[] = useMemo(() => {
    if (!normalizedVin) return [];
    return historyBookings
      .filter(
        (b) =>
          b.status === "completed" &&
          b.vin?.toUpperCase().trim() === normalizedVin,
      )
      .map((b) => {
        const services = b.services.slice(0, 2).join(", ");
        const more = b.services.length > 2 ? ` +${b.services.length - 2} more` : "";
        const dateMs = parseIsoToMs(b.date) ?? 0;
        const subtitleBits = [
          fmtDateFromMs(dateMs),
          b.mechanicName,
          b.shopName ? `at ${b.shopName}` : null,
        ].filter(Boolean) as string[];
        return {
          kind: "booking" as const,
          id: `b:${b.id}`,
          bookingId: b.id as Id<"bookings">,
          dateMs,
          title: `${services}${more}`,
          subtitle: subtitleBits.join(" · "),
          totalCents:
            typeof b.totalCost === "number" ? Math.round(b.totalCost * 100) : undefined,
        };
      });
  }, [historyBookings, normalizedVin]);

  const importedRows: DocRow[] = useMemo(() => {
    return docRows
      .filter((r) => r.extraction?.review_state !== "rejected")
      .map((r) => {
        const view = projectExtraction(r);
        const dateMs = view.serviceDateMs ?? r.doc.uploaded_at ?? r.doc._creationTime;

        // Title prefers the shop name — most "carfax-y" thing to lead with.
        // Falls back to the services summary, then the cleaned-up filename
        // (extension stripped). Uses `||` not `??` so an empty extraction
        // (parse failed → shopName null, summary "") still lands on the
        // filename instead of rendering a blank title.
        const cleanName = (r.doc.original_filename ?? "Uploaded receipt").replace(
          /\.[^./]+$/,
          "",
        );
        const title = view.shopName || view.servicesSummary || cleanName;
        // Subtitle stacks date + the services summary (when we have one and
        // it's not redundant with the title).
        const subtitleParts: string[] = [fmtDateFromMs(dateMs)];
        if (view.servicesSummary && view.servicesSummary !== title) {
          subtitleParts.push(view.servicesSummary);
        }

        const isImage = r.doc.mime_type.startsWith("image/");

        return {
          kind: "doc" as const,
          id: `d:${r.doc._id}`,
          documentId: r.doc._id,
          dateMs,
          title,
          subtitle: subtitleParts.join(" · "),
          parseStatus: r.doc.parse_status,
          reviewState: r.extraction?.review_state ?? null,
          totalCents: view.totalCents ?? undefined,
          thumbnailUrl: isImage ? r.storage_url : null,
          isImage,
        };
      });
  }, [docRows]);

  const rows: UnifiedRow[] = useMemo(() => {
    return [...bookingRows, ...importedRows].sort((a, b) => b.dateMs - a.dateMs);
  }, [bookingRows, importedRows]);

  // Must run unconditionally — the early `return null` on isLoading below
  // would otherwise change hook order between renders.
  const selectedDocRow = useMemo(
    () => docRows.find((r) => r.doc._id === selectedDocId) ?? null,
    [docRows, selectedDocId],
  );

  const isLoading = bookingsLoading || docsLoading;
  if (isLoading) return null;

  const hasRows = rows.length > 0;
  const canUpload = !!vehicleOwnerId && !!normalizedVin;

  const handleUpload = async () => {
    if (!canUpload || uploading) return;
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "image/*",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || result.assets.length === 0) {
        setUploading(false);
        return;
      }
      const asset = result.assets[0];
      const uploadUrl = await generateUploadUrl({});
      const blob = await (await fetch(asset.uri)).blob();
      const postRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": asset.mimeType ?? "application/octet-stream",
        },
        body: blob,
      });
      if (!postRes.ok) {
        throw new Error(`Upload failed: ${postRes.status}`);
      }
      const { storageId } = (await postRes.json()) as { storageId: Id<"_storage"> };
      await recordUpload({
        storageId,
        vehicleOwnerId: vehicleOwnerId!,
        vin: normalizedVin!,
        mimeType: asset.mimeType ?? "application/octet-stream",
        filename: asset.name,
        sizeBytes: asset.size ?? 0,
      });
      // Expand so the new row is visible, and confirm receipt in plain
      // language — the row itself then shows "Reading receipt…" while it
      // extracts, so the user is never left wondering what happened.
      setExpanded(true);
      toast.success("Receipt added", "We're pulling out the details now.", { icon: ReceiptIcon });
    } catch {
      toast.error("Upload failed", "Something went wrong — please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDocPress = (documentId: Id<"vehicle_documents">) => {
    setSelectedDocId(documentId);
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={hasRows ? () => setExpanded((v) => !v) : undefined}
        disabled={!hasRows}
        style={styles.titleRow}
      >
        <View style={styles.titleLeft}>
          <Text
            weight="bold"
            color={isDarkBg ? "#FFFFFF" : "#0F172A"}
            style={styles.title}
          >
            Service History
          </Text>
          {hasRows && (
            <View style={styles.countBadge}>
              <Text weight="semiBold" size="xs" color="#5299FE">
                {rows.length}
              </Text>
            </View>
          )}
        </View>
        {hasRows &&
          (expanded ? (
            <ChevronDown size={scale(20)} color={isDarkBg ? "#FFFFFF" : "#0F172A"} />
          ) : (
            <ChevronRight size={scale(20)} color={isDarkBg ? "#FFFFFF" : "#0F172A"} />
          ))}
      </Pressable>

      {canUpload && (
        <Pressable
          onPress={handleUpload}
          disabled={uploading}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
            uploading && styles.addButtonDisabled,
          ]}
        >
          <Plus size={scale(18)} color="#5299FE" />
          <Text weight="semiBold" size="sm" color="#5299FE">
            {uploading ? "Uploading…" : "Upload Service History"}
          </Text>
        </Pressable>
      )}

      {/* Empty-state card removed per Ahmad — no point showing a "receipts
          will live here" placeholder when there's nothing yet. The list
          only appears once there's actual history to show. */}
      {hasRows && expanded ? (
        <View style={styles.list}>
          {rows.map((row) => {
            if (row.kind === "booking") {
              const total = fmtUSDCents(row.totalCents);
              return (
                <Pressable
                  key={row.id}
                  onPress={() => setSelectedBookingId(row.bookingId)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: "#F8FAFC" },
                  ]}
                >
                  <View style={styles.rowIcon}>
                    <ReceiptIcon size={scale(18)} color="#5299FE" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text weight="semiBold" size="sm" color="#0F172A" numberOfLines={1}>
                      {row.title}
                    </Text>
                    <Text
                      size="xs"
                      color="#9CA3AF"
                      style={{ marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {row.subtitle}
                    </Text>
                  </View>
                  {total && (
                    <Text weight="bold" size="sm" color="#0F172A">
                      {total}
                    </Text>
                  )}
                  <ChevronRight size={scale(16)} color="#C7C7CC" />
                </Pressable>
              );
            }

            const total = fmtUSDCents(row.totalCents);
            return (
              <Pressable
                key={row.id}
                onPress={() => handleDocPress(row.documentId)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: "#F8FAFC" },
                ]}
              >
                <DocRowIcon
                  thumbnailUrl={row.thumbnailUrl}
                  isImage={row.isImage}
                />

                <View style={{ flex: 1 }}>
                  <Text weight="semiBold" size="sm" color="#0F172A" numberOfLines={1}>
                    {row.title}
                  </Text>
                  <Text size="xs" color="#9CA3AF" numberOfLines={1} style={{ marginTop: 2 }}>
                    {row.subtitle}
                  </Text>
                </View>
                {/* Right side, no pill/tag chrome: a spinner while it reads,
                    a plain blue action label when it needs input, otherwise
                    the total. */}
                {row.parseStatus === "parsing" || row.parseStatus === "queued" ? (
                  <ActivityIndicator size="small" color="#5299FE" />
                ) : row.parseStatus === "needs_review" ? (
                  <Text weight="semiBold" size="sm" color="#5299FE">
                    Confirm
                  </Text>
                ) : row.parseStatus === "failed" ? (
                  <Text weight="semiBold" size="sm" color="#5299FE">
                    Add details
                  </Text>
                ) : total ? (
                  <Text weight="bold" size="sm" color="#0F172A">
                    {total}
                  </Text>
                ) : null}
                <ChevronRight size={scale(16)} color="#C7C7CC" />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <ReceiptSheet
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
      />
      <ParsedDocumentSheet
        row={selectedDocRow}
        onClose={() => setSelectedDocId(null)}
      />
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: scale(20),
    marginTop: scale(24),
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scale(12),
  },
  titleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  title: {
    fontSize: moderateScale(22),
  },
  countBadge: {
    minWidth: scale(24),
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: moderateScale(10),
    backgroundColor: "rgba(82,153,254,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
    paddingVertical: scale(14),
    borderRadius: moderateScale(14),
    borderWidth: 1.5,
    borderColor: "rgba(82, 153, 254, 0.25)",
    borderStyle: "dashed",
    backgroundColor: "rgba(82, 153, 254, 0.04)",
    marginBottom: scale(12),
  },
  addButtonPressed: {
    opacity: 0.7,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  list: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.05)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  rowIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(12),
    backgroundColor: "rgba(82,153,254,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailImage: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(10),
    backgroundColor: "#F1F5F9",
  },
});

export default VehicleServiceHistory;
