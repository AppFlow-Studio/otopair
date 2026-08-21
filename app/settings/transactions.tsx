/**
 * Service Record
 *
 * An instrument surface rather than a list of cards. The month is the readout —
 * large and bold, with a signal rule beneath it — and service rows sit quiet and
 * technical underneath. Vehicle scoping is the channel strip alone: always
 * visible, one tap, no sheet to open or dismiss.
 *
 * Sits on the shared Oto ambient gradient (constants/theme → OtoGradient), the
 * same ground as the AI-chat surface, so this screen belongs to the app rather
 * than being a one-off dark or flat panel.
 *
 * Type comes from ServiceLogFonts (constants/theme.ts) — roles, not families —
 * so the whole typographic system for these three surfaces swaps in one place.
 * Uses RN Text rather than shared-ui <Text> because these screens need weights
 * and tracking that component does not expose.
 *
 * Money appears per-row only. There are no month subtotals and no lifetime
 * total — the record is about what was done, not what it cost in aggregate.
 *
 * USED IN: Settings → Past Services (My Garage section).
 */

import React, { useMemo, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { Link } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";

import { OtoGradient, ServiceLogColors as C, ServiceLogFonts as F } from "@/constants/theme";
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";

const MONTHS_LONG = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];
const MONTHS_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/**
 * `Link.AppleZoom` only exists on iOS builds of expo-router, and only when the
 * paired `Link.AppleZoomTarget` is mounted on the destination — see
 * app/settings/past-service/[bookingId].tsx. Looked up optionally so Android
 * and older router versions fall through to a plain push.
 */
type AppleZoomRouterLink = typeof Link & {
  AppleZoom?: React.ComponentType<React.PropsWithChildren>;
};

const AppleZoom =
  Platform.OS === "ios" ? (Link as AppleZoomRouterLink).AppleZoom : undefined;

type CompletedBooking = ReturnType<
  typeof useMyBookingsWithDetails
>["historyBookings"][number];

type FilterValue = "all" | string;

interface Channel {
  /** year|model|vin — two cars sharing year+model stay distinct. */
  key: string;
  /** Strip label, uppercased ("TIGUAN", "7 SERIES"). */
  short: string;
  count: number;
}

/** Displayed money is what was captured, falling back to the pre-approval
 *  estimate on legacy rows that never went through Stripe. */
function amountOf(b: CompletedBooking): number | undefined {
  if (b.finalCaptureAmountCents != null) return b.finalCaptureAmountCents / 100;
  return b.totalCost;
}

/** Row figures carry no symbol — the readout above the group already
 *  establishes the unit, and the column reads cleaner without it. */
function fmtFigure(n: number | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtUSD(n: number | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "2026-06" → "JUNE 2026". Hermes ships a reduced Intl that throws on
 *  toLocaleDateString with an options bag, so this is built by hand. */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const name = MONTHS_LONG[Number(m) - 1];
  return name ? `${name} ${y}` : ym;
}

/** "2026-06-18" → "18 JUN". */
function shortDate(ymd: string): string {
  const [, m, d] = ymd.split("-");
  const mon = MONTHS_SHORT[Number(m) - 1];
  if (!mon || !d) return ymd;
  return `${Number(d)} ${mon}`;
}


// `carModel` carries "Make Model Trim …". Pull just the model for channel
// labels and row meta so the fixed mono column stays narrow.
//   "Volkswagen Tiguan 2.0T SE R-Line" → "Tiguan"
//   "Tesla Model 3 Long Range"         → "Model 3"
//   "BMW 7 Series 750i xDrive"         → "7 Series"
function extractModel(full: string): string {
  const tokens = full.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return full;
  if (tokens[1].toLowerCase() === "model" && tokens[2]) {
    return `${tokens[1]} ${tokens[2]}`;
  }
  if (/^\d+$/.test(tokens[1]) && tokens[2]?.toLowerCase() === "series") {
    return `${tokens[1]} ${tokens[2]}`;
  }
  return tokens[1];
}

// Sibling returning "YEAR MAKE MODEL" with the trim dropped.
function extractYearMakeModel(year: string | undefined, carModel: string): string {
  const tokens = carModel.trim().split(/\s+/).filter(Boolean);
  const yr = (year ?? "").trim();
  if (tokens.length === 0) return yr;
  if (tokens.length === 1) return [yr, tokens[0]].filter(Boolean).join(" ");

  const firstTwo = `${tokens[0]} ${tokens[1]}`.toLowerCase();
  const isTwoWordMake =
    firstTwo === "land rover" ||
    firstTwo === "alfa romeo" ||
    firstTwo === "aston martin";
  if (isTwoWordMake) {
    return [yr, `${tokens[0]} ${tokens[1]}`, tokens[2] ?? ""].filter(Boolean).join(" ");
  }

  const make = tokens[0];
  let model = tokens[1];
  if (model.toLowerCase() === "model" && tokens[2]) model = `Model ${tokens[2]}`;
  else if (/^\d+$/.test(model) && tokens[2]?.toLowerCase() === "series") {
    model = `${model} Series`;
  }
  return [yr, make, model].filter(Boolean).join(" ");
}

function channelKey(b: CompletedBooking): string {
  return `${(b.carYear ?? "").trim()}|${(b.carModel ?? "").trim()}|${(b.vin ?? "").trim()}`;
}


// ============================================================================
// SCREEN
// ============================================================================

export default function PastServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { historyBookings, isLoading } = useMyBookingsWithDetails();

  const [filter, setFilter] = useState<FilterValue>("all");

  const completed = useMemo(
    () => historyBookings.filter((b) => b.status === "completed"),
    [historyBookings],
  );

  /** Newest first. Sorted on scheduledDate, the only raw sortable date —
   *  `date` is display-formatted ("Tuesday, May 26") and has no year. */
  const allBookings = useMemo(() => {
    const sorted = [...completed];
    sorted.sort((a, b) => (b.scheduledDate ?? "").localeCompare(a.scheduledDate ?? ""));
    return sorted;
  }, [completed]);

  const channels = useMemo<Channel[]>(() => {
    const map = new Map<string, Channel>();
    for (const b of completed) {
      const key = channelKey(b);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      const model = (b.carModel ?? "").trim();
      const full = model ? extractYearMakeModel(b.carYear, model) : "Unknown vehicle";
      map.set(key, {
        key,
        short: (model ? extractModel(model) : full).toUpperCase(),
        count: 1,
      });
    }
    return Array.from(map.values());
  }, [completed]);

  const visibleBookings = useMemo(() => {
    if (filter === "all") return allBookings;
    return allBookings.filter((b) => channelKey(b) === filter);
  }, [allBookings, filter]);

  const monthGroups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; total: number; rows: CompletedBooking[] }
    >();
    for (const b of visibleBookings) {
      const ym = (b.scheduledDate ?? "").slice(0, 7);
      let g = map.get(ym);
      if (!g) {
        g = { key: ym || "unknown", label: ym ? monthLabel(ym) : "UNDATED", total: 0, rows: [] };
        map.set(ym, g);
      }
      g.rows.push(b);
      g.total += amountOf(b) ?? 0;
    }
    return Array.from(map.values());
  }, [visibleBookings]);


  const activeChannel = useMemo(
    () => (filter === "all" ? null : channels.find((c) => c.key === filter) ?? null),
    [filter, channels],
  );

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/home");
  };

  return (
    <View style={styles.screen}>
      {/* The global bar is style="auto", which resolves from the colour scheme
          rather than the backdrop — on this light gradient it renders light-on-
          light. Pin it dark for the life of this screen. */}
      <StatusBar style="dark" />
      <LinearGradient
        colors={[...OtoGradient.colors]}
        locations={[...OtoGradient.locations]}
        start={OtoGradient.start}
        end={OtoGradient.end}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEnabled={visibleBookings.length > 0}
        contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: insets.bottom + 40 }}
      >
        {/* ── masthead ─────────────────────────────────────────── */}
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <ArrowLeft size={24} color={C.ink} strokeWidth={2} />
        </Pressable>

        <View style={styles.masthead}>
          <RNText style={styles.title}>Service Record</RNText>
        </View>

        {/* ── channel selector ─────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.channels}
        >
          <ChannelTab label="ALL" active={filter === "all"} onPress={() => setFilter("all")} />
          {channels.map((c) => (
            <ChannelTab
              key={c.key}
              label={c.short}
              active={filter === c.key}
              onPress={() => setFilter(c.key)}
            />
          ))}
        </ScrollView>

        <View style={styles.topRule} />

        {/* ── readouts + rows ──────────────────────────────────── */}
        {/* isLoading first: the hook returns `rows ?? []` while the Convex
            query is in flight, so without this every user with history sees
            the empty state flash before their data lands. */}
        {isLoading ? (
          <View style={styles.notice}>
            <RNText style={styles.noticeLabel}>READING LOG…</RNText>
          </View>
        ) : visibleBookings.length > 0 ? (
          monthGroups.map((g) => (
            <View key={g.key}>
              <View style={styles.readout}>
                <RNText style={styles.readoutMonth}>{g.label}</RNText>
              </View>
              {g.rows.map((b, i) => (
                <Row key={b.id} booking={b} isFirst={i === 0} />
              ))}
            </View>
          ))
        ) : (
          <View style={styles.notice}>
            <RNText style={styles.noticeLabel}>NO RECORDS</RNText>
            <RNText style={styles.noticeSub}>
              {activeChannel
                ? "This vehicle has no completed services yet."
                : "Completed services are logged here."}
            </RNText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// PIECES
// ============================================================================

function ChannelTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      // The strip is deliberately dense — mono at 10pt is ~24pt tall — so the
      // target is extended with hitSlop rather than by adding padding.
      hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
      style={styles.channel}
    >
      <RNText style={[styles.channelLabel, active && styles.channelLabelActive]}>
        {label}
      </RNText>
      <View style={[styles.channelRule, active && styles.channelRuleActive]} />
    </Pressable>
  );
}

/**
 * Vehicle plate. Prefers the cached hero photo; falls back to a neutral glyph
 * so a list with mixed coverage still reads as one treatment.
 *
 * Landscape and `contain`, not a square with `cover`: VehicleDB heroes are wide
 * three-quarter shots, so a square crop decapitates every car. No background
 * either — the images ship on white and the rows sit below where the Oto
 * gradient has resolved to white, so the car floats cleanly instead of sitting
 * in a tinted box.
 */
function Plate({ imageUrl }: { imageUrl?: string }) {
  return (
    <View style={styles.plate}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.plateImage} resizeMode="contain" />
      ) : (
        <View style={styles.glyphWrap}>
          <View style={styles.glyphRoof} />
          <View style={styles.glyphBody} />
        </View>
      )}
    </View>
  );
}

function RowBody({
  service,
  meta,
  figure,
  imageUrl,
}: {
  service: string;
  meta: string;
  figure: string;
  imageUrl?: string;
}) {
  return (
    <View style={styles.row}>
      <Plate imageUrl={imageUrl} />
      <View style={styles.rowText}>
        <RNText numberOfLines={1} style={styles.rowService}>
          {service}
        </RNText>
        <RNText numberOfLines={2} style={styles.rowMeta}>
          {meta}
        </RNText>
      </View>
      <RNText style={styles.rowFigure}>{figure}</RNText>
    </View>
  );
}

/**
 * One completed service. Leads with the work performed; falls back to the
 * vehicle when `services` carries no resolvable names, in which case the meta
 * line drops the vehicle rather than printing it twice.
 */
function Row({ booking, isFirst }: { booking: CompletedBooking; isFirst: boolean }) {
  const vehicle = useMemo(
    () => extractYearMakeModel(booking.carYear, booking.carModel ?? ""),
    [booking.carYear, booking.carModel],
  );

  const { service, usedVehicle } = useMemo(() => {
    const clean = booking.services.filter(Boolean);
    if (clean.length === 1) return { service: clean[0], usedVehicle: false };
    if (clean.length > 1) {
      return { service: `${clean[0]} +${clean.length - 1}`, usedVehicle: false };
    }
    return { service: vehicle || "Service", usedVehicle: Boolean(vehicle) };
  }, [booking.services, vehicle]);

  const shortVehicle = useMemo(
    () => extractModel(booking.carModel ?? "").toUpperCase(),
    [booking.carModel],
  );

  const meta = useMemo(() => {
    const parts = [
      booking.scheduledDate ? shortDate(booking.scheduledDate) : "",
      usedVehicle ? "" : shortVehicle,
      (booking.shopName ?? "").toUpperCase(),
    ].filter(Boolean);
    return parts.join("  |  ");
  }, [booking.scheduledDate, booking.shopName, shortVehicle, usedVehicle]);

  const figure = fmtFigure(amountOf(booking));

  const spoken = useMemo(() => {
    const when = booking.scheduledDate ? shortDate(booking.scheduledDate) : "";
    return [
      service,
      fmtUSD(amountOf(booking)),
      when && `on ${when}`,
      !usedVehicle && vehicle && vehicle,
      booking.shopName && `at ${booking.shopName}`,
    ]
      .filter(Boolean)
      .join(", ");
  }, [service, vehicle, usedVehicle, booking]);

  // `makeLogoUrl` already resolves to the cached vehicle hero photo when one
  // exists, falling back to the brand mark — see utils/bookingAdapter.ts.
  const body = (
    <RowBody service={service} meta={meta} figure={figure} imageUrl={booking.makeLogoUrl} />
  );

  return (
    <View>
      {!isFirst ? <View style={styles.rowRule} /> : null}
      <Link
        href={{
          pathname: "/settings/past-service/[bookingId]",
          params: { bookingId: booking.id },
        }}
        asChild
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={spoken}
          style={({ pressed }) => (pressed ? styles.rowPressed : null)}
        >
          <View>
            {body}
            {/* Zoom source is an absolutely-positioned marker, never a wrapper —
                same shape as AppleZoomTarget on the detail screen. Wrapping the
                row content in it collapses the figure column. */}
            {AppleZoom ? (
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <AppleZoom>
                  <View style={styles.zoomSource} />
                </AppleZoom>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Link>
    </View>
  );
}


// ============================================================================
// STYLES
// ============================================================================

const G = 24;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // Matches the gradient's final stop, so overscroll past the bottom shows
    // white rather than a bare surface.
    backgroundColor: OtoGradient.colors[2],
  },

  // ── masthead ──────────────────────────────────────────────
  backBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: G,
    paddingVertical: 6,
  },
  backBtnPressed: {
    opacity: 0.6,
  },
  masthead: {
    paddingHorizontal: G,
    paddingTop: 6,
    paddingBottom: 18,
  },
  eyebrow: {
    fontFamily: F.micro,
    fontSize: 9,
    letterSpacing: 2,
    color: C.low,
  },
  title: {
    fontFamily: F.semi,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: C.ink,
    marginTop: 7,
  },
  records: {
    fontFamily: F.microRegular,
    fontSize: 9,
    letterSpacing: 1.6,
    color: C.mid,
    marginTop: 7,
  },

  // ── channel selector ──────────────────────────────────────
  channels: {
    paddingHorizontal: G,
    gap: 20,
  },
  channel: {
    alignItems: "center",
    gap: 7,
  },
  channelLabel: {
    fontFamily: F.microRegular,
    fontSize: 10,
    letterSpacing: 1.1,
    color: C.low,
  },
  channelLabelActive: {
    fontFamily: F.micro,
    color: C.ink,
  },
  channelRule: {
    height: 2,
    minWidth: 18,
    alignSelf: "stretch",
    backgroundColor: C.channelIdle,
  },
  channelRuleActive: {
    backgroundColor: C.accent,
  },
  topRule: {
    height: 1,
    marginHorizontal: G,
    marginTop: 18,
    backgroundColor: C.hairline,
  },

  // ── readout ───────────────────────────────────────────────
  readout: {
    paddingHorizontal: G,
    paddingTop: 24,
    // The rule used to carry 10pt of this gap; without it the month needs its
    // own breathing room or it collides with the first row.
    paddingBottom: 16,
  },
  /** The month is the readout now — the subtotal it replaced is gone. */
  readoutMonth: {
    fontFamily: F.display,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: C.ink,
  },

  // ── rows ──────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: G,
    paddingVertical: 11,
  },
  rowPressed: {
    opacity: 0.55,
  },
  rowRule: {
    height: 1,
    marginHorizontal: G,
    backgroundColor: C.hairline,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowService: {
    fontFamily: F.medium,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: -0.2,
    color: C.ink,
  },
  rowMeta: {
    fontFamily: F.microRegular,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.8,
    color: C.low,
  },
  rowFigure: {
    fontFamily: F.micro,
    fontSize: 13,
    letterSpacing: 0.2,
    color: C.ink,
  },
  zoomSource: {
    flex: 1,
    backgroundColor: "transparent",
  },

  // ── vehicle plate ─────────────────────────────────────────
  plate: {
    width: 52,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  plateImage: {
    width: "100%",
    height: "100%",
  },
  glyphWrap: {
    alignItems: "center",
  },
  glyphRoof: {
    width: 13,
    height: 5.5,
    borderRadius: 2.4,
    backgroundColor: C.glyph,
  },
  glyphBody: {
    width: 21,
    height: 7,
    borderRadius: 2.5,
    backgroundColor: C.glyph,
    marginTop: -0.5,
  },

  // ── notices ───────────────────────────────────────────────
  notice: {
    paddingHorizontal: G,
    paddingTop: 40,
  },
  noticeLabel: {
    fontFamily: F.micro,
    fontSize: 11,
    letterSpacing: 1.8,
    color: C.mid,
  },
  noticeSub: {
    fontFamily: F.regular,
    fontSize: 13,
    color: C.low,
    marginTop: 8,
  },

});
