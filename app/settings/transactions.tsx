/**
 * Past Services
 *
 * Single-page list of every completed booking, sorted by date desc.
 * Header shows a horizontal filter pill row when the user has more
 * than one car — first pill is `All cars`, the rest scope the list
 * to a single vehicle. In "All cars" mode every row gets a small
 * vehicle kicker so it's obvious which car each booking is for
 * without forcing a drilldown.
 *
 * Replaces the old two-step "pick a car → see its history" browser:
 * the default is now an informative full list, the filter is opt-in,
 * and the back button has only one level to handle.
 *
 * Visual: home-tab gradient backdrop (matches the rest of the
 * settings overlay destinations).
 *
 * USED IN: Settings → Past Services (My Garage section).
 */

import React, { useMemo, useState } from "react";
import {
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { Calendar, ChevronLeft, Wrench } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { BrandColors, SurfaceColors } from "@/constants/theme";
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";
import { useVehicleStore } from "@/stores/useVehicleStore";

const INK = "#0F172A";
const MUTED = "#6B7280";

// Android: LayoutAnimation needs an opt-in. No-op on iOS.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function fmtUSD(n: number | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}


// `carModel` in our booking rows is actually "Make Model Trim …" (e.g.
// "Volkswagen Tiguan 2.0T SE R-Line Black"). Pull out just the model
// for the filter pill so chips stay short.
//   "Volkswagen Tiguan 2.0T SE R-Line Black" → "Tiguan"
//   "Chevrolet Corvette"                     → "Corvette"
//   "Ford F-150 SuperCrew"                   → "F-150"
//   "Tesla Model 3"                          → "Model 3"
//   "BMW 7 Series 750i xDrive"               → "7 Series"
// Single-token strings pass through unchanged.
function extractModel(full: string): string {
  const tokens = full.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return full;
  // Tesla naming uses "Model X / 3 / Y / S" — keep the qualifier token.
  if (tokens[1].toLowerCase() === "model" && tokens[2]) {
    return `${tokens[1]} ${tokens[2]}`;
  }
  // BMW naming uses "<digit> Series" — keep the "Series" qualifier.
  if (/^\d+$/.test(tokens[1]) && tokens[2]?.toLowerCase() === "series") {
    return `${tokens[1]} ${tokens[2]}`;
  }
  return tokens[1];
}

// Sibling of `extractModel` that returns "YEAR MAKE MODEL" for the per-row
// kicker — trims the trim/sub-trim suffix that `carModel` carries so the
// eyebrow fits on one line.
//   "2024" + "Volkswagen Tiguan 2.0T SE R-Line Black" → "2024 Volkswagen Tiguan"
//   "2024" + "Tesla Model 3 Long Range"               → "2024 Tesla Model 3"
//   "2024" + "BMW 7 Series 750i xDrive"               → "2024 BMW 7 Series"
//   "2024" + "Land Rover Defender"                    → "2024 Land Rover Defender"
function extractYearMakeModel(year: string | undefined, carModel: string): string {
  const tokens = carModel.trim().split(/\s+/).filter(Boolean);
  const yr = (year ?? "").trim();
  if (tokens.length === 0) return yr;
  if (tokens.length === 1) return [yr, tokens[0]].filter(Boolean).join(" ");

  // Two-word makes — first two tokens are the make, take the next as the model.
  const firstTwo = `${tokens[0]} ${tokens[1]}`.toLowerCase();
  const isTwoWordMake =
    firstTwo === "land rover" ||
    firstTwo === "alfa romeo" ||
    firstTwo === "aston martin";
  if (isTwoWordMake) {
    const make = `${tokens[0]} ${tokens[1]}`;
    const model = tokens[2] ?? "";
    return [yr, make, model].filter(Boolean).join(" ");
  }

  const make = tokens[0];
  let model = tokens[1];
  // Tesla → keep the qualifier ("Model 3", "Model X", …).
  if (model.toLowerCase() === "model" && tokens[2]) {
    model = `Model ${tokens[2]}`;
  }
  // BMW → keep the "Series" qualifier ("7 Series", "3 Series", …).
  else if (/^\d+$/.test(model) && tokens[2]?.toLowerCase() === "series") {
    model = `${model} Series`;
  }
  return [yr, make, model].filter(Boolean).join(" ");
}

type CompletedBooking = ReturnType<typeof useMyBookingsWithDetails>["historyBookings"][number];

interface CarBucket {
  /** Stable key for grouping: year|model|vin so two cars with the
   *  same year+model but different VINs stay distinct. */
  key: string;
  /** Full label (e.g. "2024 Tiguan") — used for the row kicker. */
  label: string;
  /** Raw model — used as the filter pill title (e.g. "Tiguan",
   *  "F-150", "Model 3", "Grand Cherokee"). Falls back to the full
   *  label when the booking has no carModel. */
  model: string;
  /** Optional ownership match — used to swap the makeLogoUrl
   *  thumbnail for a real garage car photo when we have one. */
  vehicleId?: string;
  makeLogoUrl?: string;
  bookings: CompletedBooking[];
}

type FilterValue = "all" | string;

export default function PastServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { historyBookings } = useMyBookingsWithDetails();

  const vehicleIds = useVehicleStore((s) => s.vehicleIds);
  const vehicles = useVehicleStore((s) => s.vehicles);

  // "all" → show every car's bookings; otherwise = a bucket.key.
  const [filter, setFilter] = useState<FilterValue>("all");

  const completed = useMemo<CompletedBooking[]>(
    () => historyBookings.filter((b) => b.status === "completed"),
    [historyBookings],
  );

  // Bucket completed bookings by car. Identity comes from the booking
  // row itself (year + carModel + vin) so we always show every completed
  // booking — VIN-only joining against the garage store dropped any
  // booking whose VIN was empty or stale. When a bucket's VIN happens
  // to match a stored vehicle we borrow the vehicle's image for the
  // (currently unused) thumbnail; otherwise we use the booking's
  // makeLogoUrl. Buckets feed the filter pill row.
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
      const pillModel = model ? extractModel(model) : label;
      const vehicleId = vin ? vehicleByVin[vin] : undefined;
      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          key,
          label,
          model: pillModel,
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

  // Flat list, newest first. `date` is "YYYY-MM-DD" so lexicographic
  // sort doubles as chronological.
  const allBookings = useMemo(() => {
    const sorted = [...completed];
    sorted.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return sorted;
  }, [completed]);

  const visibleBookings = useMemo(() => {
    if (filter === "all") return allBookings;
    return allBookings.filter((b) => {
      const key = `${(b.carYear ?? "").trim()}|${(b.carModel ?? "").trim()}|${(b.vin ?? "").trim()}`;
      return key === filter;
    });
  }, [allBookings, filter]);

  const handleFilterChange = (next: FilterValue) => {
    if (next === filter) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilter(next);
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/home");
  };

  const showFilterRow = buckets.length > 1;
  const showVehicleKicker = filter === "all" && buckets.length > 1;

  return (
    <View style={styles.screen}>
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
            Past Services
          </Text>
          <Text size="md" color={MUTED} style={styles.heroSubtitle} center>
            {visibleBookings.length === 0
              ? filter === "all"
                ? "No services yet"
                : "No services for this car"
              : `${visibleBookings.length} completed service${visibleBookings.length === 1 ? "" : "s"}`}
          </Text>
        </View>

        {showFilterRow && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={styles.filterScroll}
          >
            <FilterPill
              label="All cars"
              count={allBookings.length}
              active={filter === "all"}
              onPress={() => handleFilterChange("all")}
            />
            {buckets.map((bucket) => (
              <FilterPill
                key={bucket.key}
                label={bucket.model}
                count={bucket.bookings.length}
                active={filter === bucket.key}
                onPress={() => handleFilterChange(bucket.key)}
              />
            ))}
          </ScrollView>
        )}

        {visibleBookings.length > 0 ? (
          <View style={styles.list}>
            {visibleBookings.map((b) => (
              <PastServiceRow
                key={b.id}
                booking={b}
                showVehicleKicker={showVehicleKicker}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            label="No past services yet"
            sub="Completed bookings will show up here."
          />
        )}
      </ScrollView>
    </View>
  );
}

interface FilterPillProps {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}

function FilterPill({ label, count, active, onPress }: FilterPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        active && styles.pillActive,
        pressed && styles.pillPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}, ${count} service${count === 1 ? "" : "s"}`}
    >
      <Text
        weight="semiBold"
        style={[styles.pillLabel, active && styles.pillLabelActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text style={[styles.pillCount, active && styles.pillCountActive]}>
        {count}
      </Text>
    </Pressable>
  );
}

interface RowProps {
  booking: CompletedBooking;
  showVehicleKicker: boolean;
}

function PastServiceRow({ booking, showVehicleKicker }: RowProps) {
  const kicker = useMemo(
    () =>
      extractYearMakeModel(booking.carYear, booking.carModel ?? "").toUpperCase(),
    [booking.carYear, booking.carModel],
  );

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
                <Wrench size={22} color={MUTED} strokeWidth={1.8} />
              )}
            </View>
            <View style={styles.rowText}>
              {showVehicleKicker && kicker.length > 0 ? (
                <Text style={styles.kicker} numberOfLines={1}>
                  {kicker}
                </Text>
              ) : null}
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
    backgroundColor: SurfaceColors.canvasWarm,
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

  // ── Filter pill row ──────────────────────────────────────────────
  filterScroll: {
    marginHorizontal: -20,
    marginBottom: 16,
  },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9999,
    backgroundColor: SurfaceColors.cardSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(15,23,42,0.08)",
  },
  pillActive: {
    backgroundColor: BrandColors.secondary,
    borderColor: "transparent",
  },
  pillPressed: {
    opacity: 0.85,
  },
  pillLabel: {
    fontSize: 13,
    color: INK,
  },
  pillLabelActive: {
    color: "#FFFFFF",
  },
  pillCount: {
    fontSize: 12,
    color: MUTED,
  },
  pillCountActive: {
    color: "rgba(255,255,255,0.85)",
  },

  // ── Bookings list ────────────────────────────────────────────────
  list: {
    // No `gap` — each row's `marginBottom` owns the spacing.
  },
  row: {
    // Flat editorial row — no card surface, no shadow. Rows sit
    // directly on the canvas separated by whitespace alone.
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
    marginBottom: 16,
  },
  rowPressed: {
    opacity: 0.85,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: SurfaceColors.cardSurface,
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
  kicker: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: MUTED,
    marginBottom: 2,
  },
  rowSubtitle: {
    marginTop: 2,
  },

  // ── Empty state ──────────────────────────────────────────────────
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
