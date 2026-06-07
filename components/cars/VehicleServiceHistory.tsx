/**
 * VehicleServiceHistory — per-vehicle list of Otopair completed bookings.
 *
 * Lives on the Cars tab below MaintenanceTracker. Filters the user's
 * full booking history down to one VIN, renders newest-first rows, and
 * presents the shared <ReceiptSheet /> on tap. Per Receipt Spec v4
 * §"Where invoices live" — this is the "CarFax moment" surface, anchored
 * to the active vehicle so a driver sees every Otopair receipt ever
 * filed against this car.
 *
 * Scope per current plan: Otopair completed bookings only. The imports
 * merge (gray-dot rows from `maintenance_records`) is deferred to a
 * follow-up; the existing `ServiceHistory.tsx` (which handles uploads)
 * stays untouched.
 */

import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronRight, Receipt as ReceiptIcon } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import type { Id } from "@/convex/_generated/dataModel";
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";
import { moderateScale, scale } from "@/utils/responsive";

import { ReceiptSheet } from "@/components/receipts/ReceiptSheet";

interface Props {
  vin: string | undefined;
  isDarkBg?: boolean;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtUSD(cents: number | undefined): string | null {
  if (cents == null) return null;
  return (cents / 1).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function VehicleServiceHistory({ vin, isDarkBg = false }: Props) {
  const { historyBookings, isLoading } = useMyBookingsWithDetails();
  const [selectedBookingId, setSelectedBookingId] = useState<Id<"bookings"> | null>(null);

  const rows = useMemo(() => {
    if (!vin) return [];
    return historyBookings.filter(
      (b) =>
        b.status === "completed" &&
        b.vin?.toUpperCase().trim() === vin.toUpperCase().trim(),
    );
  }, [historyBookings, vin]);

  if (isLoading) return null;

  return (
    <View style={styles.container}>
      <Text
        weight="bold"
        color={isDarkBg ? "#FFFFFF" : "#0F172A"}
        style={styles.title}
      >
        Service History
      </Text>

      {rows.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <ReceiptIcon size={scale(20)} color="#5299FE" />
          </View>
          <Text size="sm" color="#6B7280" center>
            No service history yet — your Otopair receipts will live here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((b) => {
            const services = b.services.slice(0, 2).join(", ");
            const more = b.services.length > 2 ? ` +${b.services.length - 2} more` : "";
            const total = fmtUSD(b.totalCost);
            return (
              <Pressable
                key={b.id}
                onPress={() => setSelectedBookingId(b.id as Id<"bookings">)}
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
                    {services}{more}
                  </Text>
                  <Text size="xs" color="#9CA3AF" style={{ marginTop: 2 }} numberOfLines={1}>
                    {fmtDate(b.date)}
                    {b.mechanicName ? ` · ${b.mechanicName}` : ""}
                    {b.shopName ? ` at ${b.shopName}` : ""}
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
          })}
        </View>
      )}

      <ReceiptSheet
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: scale(20),
    marginTop: scale(24),
  },
  title: {
    fontSize: moderateScale(22),
    marginBottom: scale(12),
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    paddingVertical: scale(22),
    paddingHorizontal: scale(20),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    gap: scale(10),
  },
  emptyIconWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(12),
    backgroundColor: "rgba(82,153,254,0.10)",
    alignItems: "center",
    justifyContent: "center",
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
});

export default VehicleServiceHistory;
