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
import { Link } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
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

interface CarBucket {
  /** Stable key for grouping: year|model|vin so two cars with the
   *  same year+model but different VINs stay distinct. */
  key: string;
  /** Display label (e.g. "2024 Volkswagen Tiguan"). Derived from
   *  the booking itself, not the vehicle store, so a booking
   *  whose VIN doesn't match a current garage car still shows up
   *  with its correct label instead of getting dropped. */
  label: string;
  /** Optional ownership match — used to swap the makeLogoUrl
   *  thumbnail for a real garage car photo when we have one. */
  vehicleId?: string;
  /** Thumbnail URL — sourced from the booking's makeLogoUrl. */
  makeLogoUrl?: string;
  bookings: CompletedBooking[];
}

export default function PastServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { historyBookings } = useMyBookingsWithDetails();

  const vehicleIds = useVehicleStore((s) => s.vehicleIds);
  const vehicles = useVehicleStore((s) => s.vehicles);

  // Local navigation: null = vehicle picker, else = drilled into a
  // single car bucket's service history (keyed by the bucket key,
  // not vehicle id, since a booking's car may not match a stored
  // vehicle).
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);

  const completed = useMemo<CompletedBooking[]>(
    () => historyBookings.filter((b) => b.status === "completed"),
    [historyBookings],
  );

  // Bucket completed bookings by car. Identity comes from the
  // booking row itself (year + carModel + vin) so we always show
  // every completed booking — VIN-only joining against the
  // garage store dropped any booking whose VIN was empty or stale.
  // When a bucket's VIN happens to match a stored vehicle we
  // borrow the vehicle's image for the picker; otherwise we use
  // the booking's makeLogoUrl.
  const buckets = useMemo<CarBucket[]>(() => {
    const vehicleByVin: Record<string, string> = {};
    for (const id of vehicleIds) {
      const v = vehicles[id];
      if (v?.vin) vehicleByVin[v.vin] = id;
    }

    const map = new Map<string, CarBucket>();
    for (const b of completed) {
      const year = (b.carYear ?? "").trim();
      const model = (b.carModel ?? "").trim();
      const vin = (b.vin ?? "").trim();
      const key = `${year}|${model}|${vin}`;
      const label =
        [year, model].filter(Boolean).join(" ") || "Unknown vehicle";
      const vehicleId = vin ? vehicleByVin[vin] : undefined;
      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          key,
          label,
          vehicleId,
          makeLogoUrl: b.makeLogoUrl,
          bookings: [],
        };
        map.set(key, bucket);
      }
      bucket.bookings.push(b);
    }
    return Array.from(map.values());
  }, [completed, vehicleIds, vehicles]);

  const selectedBucket = useMemo<CarBucket | null>(() => {
    if (selectedBucketKey === null) return null;
    return buckets.find((b) => b.key === selectedBucketKey) ?? null;
  }, [buckets, selectedBucketKey]);

  const handleBack = () => {
    if (selectedBucketKey !== null) {
      setSelectedBucketKey(null);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/home");
  };

  const selectedBookings = selectedBucket?.bookings ?? [];

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
            {selectedBucket ? selectedBucket.label : "Past Services"}
          </Text>
          <Text size="md" color={MUTED} style={styles.heroSubtitle} center>
            {selectedBucket
              ? `${selectedBookings.length} completed service${selectedBookings.length === 1 ? "" : "s"}`
              : "Pick a car to see its history"}
          </Text>
        </View>

        {selectedBucket === null ? (
          <VehiclePicker
            buckets={buckets}
            vehicles={vehicles}
            onPick={setSelectedBucketKey}
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
  buckets: CarBucket[];
  vehicles: Record<string, ReturnType<typeof useVehicleStore.getState>["vehicles"][string]>;
  onPick: (key: string) => void;
}

function VehiclePicker({ buckets, vehicles, onPick }: VehiclePickerProps) {
  if (buckets.length === 0) {
    return (
      <EmptyState
        label="No past services yet"
        sub="Completed bookings will show up here grouped by car."
      />
    );
  }

  return (
    <View style={styles.vehicleList}>
      {buckets.map((bucket) => {
        const vehicle = bucket.vehicleId ? vehicles[bucket.vehicleId] : undefined;
        const count = bucket.bookings.length;
        const vinTail = bucket.key.split("|")[2];
        return (
          <Pressable
            key={bucket.key}
            style={({ pressed }) => [
              styles.vehicleCard,
              pressed && styles.vehicleCardPressed,
            ]}
            onPress={() => onPick(bucket.key)}
            accessibilityRole="button"
            accessibilityLabel={`${bucket.label}, ${count} services`}
          >
            <View style={styles.vehicleThumb}>
              {vehicle?.imageSource ? (
                <Image
                  source={vehicle.imageSource}
                  style={styles.vehicleThumbImage}
                  resizeMode="contain"
                />
              ) : bucket.makeLogoUrl ? (
                <Image
                  source={{ uri: bucket.makeLogoUrl }}
                  style={styles.vehicleThumbImage}
                  resizeMode="contain"
                />
              ) : (
                <CarSilhouette variant="suv" width={72} height={50} />
              )}
            </View>
            <View style={styles.vehicleText}>
              <Text weight="bold" size="md" color={INK} numberOfLines={1}>
                {bucket.label}
              </Text>
              <Text size="sm" color={MUTED} numberOfLines={1} style={styles.vehicleSub}>
                {count} service{count === 1 ? "" : "s"}
                {vinTail ? ` · VIN ${vinTail.slice(-6)}` : ""}
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
    const parts = [booking.shopName];
    if (services > 0) {
      parts.push(`${services} service${services === 1 ? "" : "s"}`);
    }
    parts.push(fmtUSD(booking.totalCost));
    return parts.join(" · ");
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
    marginTop: 24,
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
