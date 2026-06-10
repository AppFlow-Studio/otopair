/**
 * Past Services
 *
 * Two-step browser: pick a car → see that car's completed bookings.
 * Replaces the flat "all past services" feed with a per-vehicle
 * drill-in so users with several cars don't have to scan a mixed
 * timeline. Search bar removed — the per-vehicle scope handles
 * scale better than free-text filtering did.
 *
 * Visual: same frosted-blue glass treatment as the booking flow
 * (GlassSheetBackground at absoluteFill behind the scroll).
 *
 * USED IN: Settings → Past Services (My Garage section).
 */

import React, { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { Calendar, ChevronLeft, ChevronRight, Wrench } from "lucide-react-native";

import { CarSilhouette } from "@/components/shared-ui/CarSilhouette";
import { Text } from "@/components/shared-ui";
import { GlassSheetBackground } from "@/components/booking-flow/GlassSheet";
import { ListSpacing } from "@/constants/theme";
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";
import { useVehicleStore } from "@/stores/useVehicleStore";

const INK = "#0F172A";
const MUTED = "#6B7280";

function fmtUSD(n: number | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

type CompletedBooking = ReturnType<typeof useMyBookingsWithDetails>["historyBookings"][number];

export default function PastServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { historyBookings } = useMyBookingsWithDetails();

  const vehicleIds = useVehicleStore((s) => s.vehicleIds);
  const vehicles = useVehicleStore((s) => s.vehicles);

  // Local navigation: null = vehicle picker, else = drilled into a
  // single car's service history.
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const completed = useMemo<CompletedBooking[]>(
    () => historyBookings.filter((b) => b.status === "completed"),
    [historyBookings],
  );

  // Per-vehicle bucket of completed bookings, keyed by vehicleId.
  // Bookings without a VIN — or with a VIN that doesn't match any
  // garage car — fall into an `unknown` bucket the picker hides.
  const bookingsByVehicleId = useMemo(() => {
    const byVin: Record<string, string> = {};
    for (const id of vehicleIds) {
      const v = vehicles[id];
      if (v?.vin) byVin[v.vin] = id;
    }
    const map: Record<string, CompletedBooking[]> = {};
    for (const b of completed) {
      const vid = b.vin ? byVin[b.vin] : undefined;
      if (!vid) continue;
      (map[vid] ??= []).push(b);
    }
    return map;
  }, [completed, vehicleIds, vehicles]);

  const handleBack = () => {
    if (selectedVehicleId !== null) {
      setSelectedVehicleId(null);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/home");
  };

  const selectedVehicle = selectedVehicleId ? vehicles[selectedVehicleId] : null;
  const selectedBookings = selectedVehicleId
    ? bookingsByVehicleId[selectedVehicleId] ?? []
    : [];

  return (
    <View style={styles.screen}>
      <GlassSheetBackground style={StyleSheet.absoluteFill} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
            <ChevronLeft size={26} color={INK} />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        <View style={styles.heroRow}>
          <Text weight="bold" color={INK} style={styles.heroTitle}>
            {selectedVehicle
              ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
              : "Past Services"}
          </Text>
          <Text size="md" color={MUTED} style={styles.heroSubtitle} center>
            {selectedVehicle
              ? `${selectedBookings.length} completed service${selectedBookings.length === 1 ? "" : "s"}`
              : "Pick a car to see its history"}
          </Text>
        </View>

        {selectedVehicleId === null ? (
          <VehiclePicker
            vehicleIds={vehicleIds}
            vehicles={vehicles}
            bookingsByVehicleId={bookingsByVehicleId}
            onPick={setSelectedVehicleId}
          />
        ) : selectedBookings.length > 0 ? (
          <View style={styles.list}>
            {selectedBookings.map((b) => (
              <PastServiceRow key={b.id} booking={b} />
            ))}
          </View>
        ) : (
          <EmptyState
            label="No services yet for this car"
            sub="When you complete a booking it'll show up here."
          />
        )}
      </ScrollView>
    </View>
  );
}

interface VehiclePickerProps {
  vehicleIds: string[];
  vehicles: Record<string, ReturnType<typeof useVehicleStore.getState>["vehicles"][string]>;
  bookingsByVehicleId: Record<string, CompletedBooking[]>;
  onPick: (id: string) => void;
}

function VehiclePicker({ vehicleIds, vehicles, bookingsByVehicleId, onPick }: VehiclePickerProps) {
  // Only surface cars that actually have completed services. The
  // user can pull more granular per-vehicle history from the Cars
  // tab if they want a car with no history.
  const visibleIds = useMemo(
    () => vehicleIds.filter((id) => (bookingsByVehicleId[id]?.length ?? 0) > 0),
    [vehicleIds, bookingsByVehicleId],
  );

  if (visibleIds.length === 0) {
    return (
      <EmptyState
        label="No past services yet"
        sub="Completed bookings will show up here grouped by car."
      />
    );
  }

  return (
    <View style={styles.vehicleList}>
      {visibleIds.map((id) => {
        const v = vehicles[id];
        if (!v) return null;
        const count = bookingsByVehicleId[id]?.length ?? 0;
        return (
          <Pressable
            key={id}
            style={({ pressed }) => [
              styles.vehicleCard,
              pressed && styles.vehicleCardPressed,
            ]}
            onPress={() => onPick(id)}
            accessibilityRole="button"
            accessibilityLabel={`${v.year} ${v.make} ${v.model}, ${count} services`}
          >
            <View style={styles.vehicleThumb}>
              {v.imageSource ? (
                <Image
                  source={v.imageSource}
                  style={styles.vehicleThumbImage}
                  resizeMode="contain"
                />
              ) : (
                <CarSilhouette variant="suv" width={72} height={50} />
              )}
            </View>
            <View style={styles.vehicleText}>
              <Text weight="bold" size="md" color={INK} numberOfLines={1}>
                {v.year} {v.make} {v.model}
              </Text>
              <Text size="sm" color={MUTED} numberOfLines={1} style={styles.vehicleSub}>
                {count} service{count === 1 ? "" : "s"}
                {v.vin ? ` · VIN ${v.vin.slice(-6)}` : ""}
              </Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" strokeWidth={2} />
          </Pressable>
        );
      })}
    </View>
  );
}

interface RowProps {
  booking: CompletedBooking;
}

function PastServiceRow({ booking }: RowProps) {
  const subtitle = useMemo(() => {
    const services = booking.services.length;
    const itemLabel = `${services} service${services === 1 ? "" : "s"}`;
    return `${booking.shopName} · ${itemLabel} · ${fmtUSD(booking.totalCost)}`;
  }, [booking.shopName, booking.services.length, booking.totalCost]);

  return (
    <Link
      href={{
        pathname: "/settings/past-service/[bookingId]",
        params: { bookingId: booking.id },
      }}
      asChild
    >
      <Pressable>
        {({ pressed }) => (
          <View style={[styles.row, pressed && styles.rowPressed]}>
            <View style={styles.thumb}>
              {booking.makeLogoUrl ? (
                <Image
                  source={{ uri: booking.makeLogoUrl }}
                  style={styles.thumbImage}
                  resizeMode="contain"
                />
              ) : (
                <Wrench size={22} color="#5299FE" strokeWidth={1.8} />
              )}
            </View>
            <View style={styles.rowText}>
              <Text weight="bold" size="md" color={INK} numberOfLines={1}>
                Completed {booking.date}
              </Text>
              <Text size="sm" color={MUTED} style={styles.rowSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Link.AppleZoom>
                <View style={styles.zoomSource} />
              </Link.AppleZoom>
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

interface EmptyStateProps {
  label: string;
  sub: string;
}

function EmptyState({ label, sub }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Calendar size={48} color="#9CA3AF" strokeWidth={1.5} />
      </View>
      <Text weight="semiBold" size="lg" color="#374151" center>
        {label}
      </Text>
      <Text size="sm" color={MUTED} center style={styles.emptyText}>
        {sub}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#CFE0EB",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    marginLeft: -16,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  heroRow: {
    alignItems: "center",
    marginTop: -10,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    textAlign: "center",
  },
  heroSubtitle: {
    marginTop: 6,
  },
  vehicleList: {
    gap: 12,
  },
  vehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
  },
  vehicleCardPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.75)",
  },
  vehicleThumb: {
    width: 80,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleThumbImage: {
    width: "100%",
    height: "100%",
  },
  vehicleText: {
    flex: 1,
    minWidth: 0,
  },
  vehicleSub: {
    marginTop: 2,
  },
  list: {
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: ListSpacing.rowVertical,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.65)",
    marginBottom: 10,
  },
  rowPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  zoomSource: {
    flex: 1,
    backgroundColor: "transparent",
  },
  thumbImage: {
    width: 56,
    height: 56,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowSubtitle: {
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyText: {
    marginTop: 8,
    lineHeight: 22,
  },
});
