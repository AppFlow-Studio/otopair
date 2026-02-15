/**
 * VehicleStatsCard — Enhanced
 *
 * PURPOSE: Displays real-time Smartcar data in swipeable pages with rich visuals.
 *          Features are clearly labeled with comment headers for easy review.
 *
 * FEATURES:
 *   1. FUEL GAUGE — animated half-circle arc gauge with needle
 *   2. SWIPEABLE PAGES — 3 horizontal pages with dot indicators
 *   3. EXPANDABLE MAP — tap mini map for full-screen modal
 *   4. STAT SUMMARY BANNER — compact single-line overview above pages
 *   5. NEXT SERVICE PREDICTION — estimated miles/date until next oil change
 *   6. TRIP STATS — sparkline chart of daily miles driven
 *
 * USED IN: app/(main-tabs)/cars/index.tsx
 * OWNER: Ahmad Hamoudeh
 */

// ─── React & React Native ───────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Expo & Third-party ─────────────────────────────────────────────────────
import { BlurView } from "expo-blur";
import * as Location from "expo-location";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Droplet,
  Fuel,
  Gauge,
  Lock,
  MapPin,
  Navigation,
  RefreshCw,
  Shield,
  TrendingUp,
  Unlock,
  Wifi,
  WifiOff,
  X,
} from "lucide-react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

// ─── Shared UI ──────────────────────────────────────────────────────────────
import { Text } from "@/components/shared-ui";

// ─── Types ──────────────────────────────────────────────────────────────────
import type {
  SmartcarStats,
  LockStatusData,
  NextServicePrediction,
  TripStats,
} from "@/hooks/useSmartcarData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_WIDTH = SCREEN_WIDTH - 32; // 16px margin each side

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface VehicleStatsCardProps {
  stats: SmartcarStats;
  tripStats: TripStats;
  nextServicePrediction: NextServicePrediction | null;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// === FEATURE: FUEL GAUGE ===
// Animated half-circle arc gauge with sweeping needle, E/F labels, percentage
// ═══════════════════════════════════════════════════════════════════════════════

interface FuelGaugeProps {
  percentage: number; // 0–100
  range: number | null; // miles remaining
  animKey?: number; // change this value to replay the sweep animation
}

function FuelGauge({ percentage, range, animKey }: FuelGaugeProps) {
  const [animPct, setAnimPct] = useState(0);

  useEffect(() => {
    setAnimPct(0);
    const steps = 40;
    const stepMs = 1000 / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const t = 1 - Math.pow(1 - step / steps, 3); // ease-out cubic
      setAnimPct(t * percentage);
      if (step >= steps) clearInterval(interval);
    }, stepMs);
    return () => clearInterval(interval);
  }, [percentage, animKey]);

  const W = 200;
  const H = 120;
  const cx = W / 2;
  const cy = H - 10;
  const R = 80;
  const strokeW = 10;

  // Arc from 180° (left, E) to 0° (right, F) — top-half semicircle
  const startAngle = Math.PI; // E (left)
  const endAngle = 0; // F (right)

  // Build arc path (track)
  const arcPath = (from: number, to: number) => {
    const x1 = cx + R * Math.cos(from);
    const y1 = cy - R * Math.sin(from);
    const x2 = cx + R * Math.cos(to);
    const y2 = cy - R * Math.sin(to);
    const largeArc = Math.abs(from - to) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Needle angle: interpolate from 180° (0%) to 0° (100%)
  const needleAngle = Math.PI - (animPct / 100) * Math.PI;
  const needleLen = R - 15;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);

  // Fill arc to current percentage
  const fillAngle = Math.PI - (animPct / 100) * Math.PI;

  // Color based on percentage
  const getColor = (pct: number) => {
    if (pct >= 60) return "#34C759";
    if (pct >= 30) return "#FF9F0A";
    return "#FF3B30";
  };

  return (
    <View style={fuelStyles.container}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Track arc */}
        <Path
          d={arcPath(startAngle, endAngle)}
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
        />
        {/* Fill arc */}
        <Path
          d={arcPath(startAngle, fillAngle)}
          stroke={getColor(animPct)}
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
        />
        {/* Tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const angle = Math.PI - t * Math.PI;
          const inner = R + strokeW / 2 + 2;
          const outer = inner + 6;
          return (
            <Line
              key={i}
              x1={cx + inner * Math.cos(angle)}
              y1={cy - inner * Math.sin(angle)}
              x2={cx + outer * Math.cos(angle)}
              y2={cy - outer * Math.sin(angle)}
              stroke="rgba(0,0,0,0.15)"
              strokeWidth={1.5}
            />
          );
        })}
        {/* Needle */}
        <Line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#1a1a1a"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Needle hub */}
        <Circle cx={cx} cy={cy} r={4} fill="#1a1a1a" />
        {/* E label */}
        <SvgText x={cx - R - 16} y={cy + 4} fontSize={11} fill="rgba(0,0,0,0.4)" textAnchor="middle" fontWeight="600">
          E
        </SvgText>
        {/* F label */}
        <SvgText x={cx + R + 16} y={cy + 4} fontSize={11} fill="rgba(0,0,0,0.4)" textAnchor="middle" fontWeight="600">
          F
        </SvgText>
      </Svg>
      <View style={fuelStyles.labelContainer}>
        <Text weight="bold" size="xl" style={[fuelStyles.pctText, { color: getColor(percentage) }]}>
          {Math.round(animPct)}%
        </Text>
      </View>
    </View>
  );
}

const fuelStyles = StyleSheet.create({
  container: { alignItems: "center", paddingTop: 8 },
  labelContainer: { alignItems: "center", marginTop: -6 },
  pctText: { fontSize: 28, lineHeight: 32 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// === FEATURE: STAT RING (reused for oil life) ===
// ═══════════════════════════════════════════════════════════════════════════════

function StatRing({
  percentage,
  size = 52,
  strokeWidth = 6,
  color,
  trackColor = "rgba(255,255,255,0.12)",
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const [animPct, setAnimPct] = useState(0);

  useEffect(() => {
    setAnimPct(0);
    const steps = 30;
    const stepMs = 800 / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const t = 1 - Math.pow(1 - step / steps, 3);
      setAnimPct(t * percentage);
      if (step >= steps) clearInterval(interval);
    }, stepMs);
    return () => clearInterval(interval);
  }, [percentage]);

  const offset = circumference * (1 - animPct / 100);

  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getRingColor(pct: number): string {
  if (pct >= 60) return "#34C759";
  if (pct >= 30) return "#FF9F0A";
  return "#FF3B30";
}

function getTirePsiColor(psi: number): string {
  if (psi >= 30 && psi <= 36) return "#34C759";
  if (psi >= 26 && psi < 30) return "#FF9F0A";
  return "#FF3B30";
}

function formatTimestamp(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDoorLabel(type: string): string {
  const map: Record<string, string> = { frontLeft: "FL", frontRight: "FR", backLeft: "RL", backRight: "RR" };
  return map[type] || type;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIRE TILE
// ═══════════════════════════════════════════════════════════════════════════════

function TireTile({ label, psi }: { label: string; psi: number }) {
  const color = getTirePsiColor(psi);
  return (
    <View style={styles.tireTile}>
      <Text size="xs" style={styles.tireTileLabel}>{label}</Text>
      <Text weight="bold" size="sm" style={[styles.tireTileValue, { color }]}>{psi}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCK STATUS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function LockStatusSection({ lockStatus }: { lockStatus: LockStatusData }) {
  const isLocked = lockStatus.isLocked;
  const doors = lockStatus.doors || [];
  const windows = lockStatus.windows || [];
  const openDoors = doors.filter((d) => d.status === "OPEN");
  const openWindows = windows.filter((w) => w.status === "OPEN");
  const statusColor = isLocked ? "#34C759" : "#FF9F0A";
  const LockIcon = isLocked ? Lock : Unlock;

  return (
    <View style={styles.subsection}>
      <View style={styles.subsectionHeader}>
        <Shield size={12} color="rgba(0,0,0,0.4)" strokeWidth={2} />
        <Text size="xs" style={styles.tileLabel}>Security Status</Text>
      </View>
      <View style={styles.lockCard}>
        <View style={[styles.lockIconCircle, { backgroundColor: statusColor + "18" }]}>
          <LockIcon size={22} color={statusColor} strokeWidth={2} />
        </View>
        <View style={styles.lockInfo}>
          <Text weight="semiBold" size="md" style={{ color: statusColor }}>
            {isLocked ? "Locked" : "Unlocked"}
          </Text>
          {openDoors.length > 0 && (
            <Text size="xs" style={styles.lockDetail}>{openDoors.length} door{openDoors.length > 1 ? "s" : ""} open</Text>
          )}
          {openWindows.length > 0 && (
            <Text size="xs" style={styles.lockDetail}>{openWindows.length} window{openWindows.length > 1 ? "s" : ""} open</Text>
          )}
          {openDoors.length === 0 && openWindows.length === 0 && (
            <Text size="xs" style={styles.lockDetail}>All doors & windows closed</Text>
          )}
        </View>
      </View>
      {doors.length > 0 && (
        <View style={styles.doorGrid}>
          {doors.map((door) => (
            <View key={door.type} style={styles.doorChip}>
              <View style={[styles.doorDot, { backgroundColor: door.status === "CLOSED" ? "#34C759" : door.status === "OPEN" ? "#FF3B30" : "rgba(0,0,0,0.15)" }]} />
              <Text size="xs" style={styles.doorChipText}>{formatDoorLabel(door.type)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// === FEATURE: EXPANDABLE MAP ===
// Full-screen modal with address + directions when mini map is tapped
// ═══════════════════════════════════════════════════════════════════════════════

function ExpandableMapModal({
  visible,
  latitude,
  longitude,
  onClose,
}: {
  visible: boolean;
  latitude: number;
  longitude: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAddress(null);
    (async () => {
      try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (results.length > 0) {
          const r = results[0];
          const parts = [r.streetNumber, r.street, r.city, r.region].filter(Boolean);
          setAddress(parts.join(" ") || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      } catch {
        setAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }
    })();
  }, [visible, latitude, longitude]);

  const openDirections = () => {
    const url = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });
    Linking.openURL(url);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={mapModalStyles.container}>
        <MapView
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude,
            longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          showsUserLocation
          showsCompass
        >
          <Marker coordinate={{ latitude, longitude }} title="Your Vehicle" />
        </MapView>

        {/* Address bar at top */}
        <View style={[mapModalStyles.addressBar, { top: insets.top + 10 }]}>
          <BlurView intensity={80} tint="light" style={mapModalStyles.addressBlur}>
            <MapPin size={14} color="#007AFF" strokeWidth={2} />
            <Text weight="medium" size="sm" style={mapModalStyles.addressText} numberOfLines={2}>
              {address || "Loading address..."}
            </Text>
          </BlurView>
        </View>

        {/* Close button */}
        <Pressable style={[mapModalStyles.closeBtn, { top: insets.top + 10 }]} onPress={onClose}>
          <BlurView intensity={80} tint="light" style={mapModalStyles.closeBtnBlur}>
            <X size={18} color="#1a1a1a" strokeWidth={2} />
          </BlurView>
        </Pressable>

        {/* Directions button */}
        <Pressable style={[mapModalStyles.directionsBtn, { bottom: insets.bottom + 20 }]} onPress={openDirections}>
          <Navigation size={18} color="#FFFFFF" strokeWidth={2} />
          <Text weight="semiBold" size="md" color="#FFFFFF">Get Directions</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const mapModalStyles = StyleSheet.create({
  container: { flex: 1 },
  addressBar: { position: "absolute", left: 16, right: 60, zIndex: 10 },
  addressBlur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  addressText: { flex: 1, color: "#1a1a1a" },
  closeBtn: { position: "absolute", right: 16, zIndex: 10 },
  closeBtnBlur: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  directionsBtn: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#007AFF",
    zIndex: 10,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// === FEATURE: NEXT SERVICE PREDICTION ===
// Shows estimated miles and date until next oil change
// ═══════════════════════════════════════════════════════════════════════════════

function NextServiceSection({ prediction }: { prediction: NextServicePrediction }) {
  const statusColors: Record<string, string> = {
    good: "#34C759",
    soon: "#FF9F0A",
    urgent: "#FF3B30",
  };
  const color = statusColors[prediction.status] || "#34C759";

  const formattedDate = prediction.estimatedDate
    ? new Date(prediction.estimatedDate + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <View style={styles.subsection}>
      <View style={styles.subsectionHeader}>
        <Calendar size={12} color="rgba(0,0,0,0.4)" strokeWidth={2} />
        <Text size="xs" style={styles.tileLabel}>Next Service Prediction</Text>
      </View>
      <View style={[styles.predictionCard, { borderLeftColor: color }]}>
        <Text weight="bold" size="lg" style={{ color }}>
          ~{prediction.milesRemaining.toLocaleString()} mi
        </Text>
        <Text size="xs" style={styles.predictionSub}>until next oil change</Text>
        {formattedDate && (
          <Text size="xs" style={styles.predictionDate}>Estimated: {formattedDate}</Text>
        )}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// === FEATURE: SWIPEABLE PAGES — PAGE COMPONENTS ===
// ═══════════════════════════════════════════════════════════════════════════════

/** Page 1: Fuel Gauge + Mileage + Trip Stats */
function PageFuelAndTrips({
  stats,
  tripStats,
  animKey,
}: {
  stats: SmartcarStats;
  tripStats: TripStats;
  animKey: number;
}) {
  const hasFuel = stats.fuel?.percentRemaining != null;
  const fuelPct = hasFuel ? Math.round(stats.fuel!.percentRemaining! * 100) : 0;
  const milesLeft = stats.fuel?.range != null ? Math.round(stats.fuel.range) : null;
  const odometer = stats.odometer?.distance != null ? Math.ceil(stats.odometer.distance) : null;

  return (
    <View style={styles.pageContainer}>
      {/* Page label */}
      <View style={styles.pageLabel}>
        <Fuel size={12} color="rgba(0,0,0,0.4)" strokeWidth={2} />
        <Text size="xs" style={styles.pageLabelText}>Fuel & Driving</Text>
      </View>

      {/* === FEATURE: FUEL GAUGE + 3-column stat row === */}
      {hasFuel && (
        <View style={styles.fuelGaugeWrapper}>
          <FuelGauge percentage={fuelPct} range={stats.fuel?.range ?? null} animKey={animKey} />

          {/* 3-column stats row */}
          <View style={styles.fuelStatsRow}>
            {/* Mileage */}
            <View style={styles.fuelStatCol}>
              <Text weight="bold" size="md" style={styles.fuelStatValue}>
                {odometer != null ? odometer.toLocaleString() : "—"}
              </Text>
              <Text size="xs" style={styles.fuelStatLabel}>Odometer (mi)</Text>
            </View>

            <View style={styles.fuelStatDivider} />

            {/* Miles left in tank */}
            <View style={styles.fuelStatCol}>
              <Text weight="bold" size="md" style={styles.fuelStatValue}>
                {milesLeft != null ? milesLeft.toLocaleString() : "—"}
              </Text>
              <Text size="xs" style={styles.fuelStatLabel}>Miles Left</Text>
            </View>

            <View style={styles.fuelStatDivider} />

            {/* Miles driven today */}
            <View style={styles.fuelStatCol}>
              <Text weight="bold" size="md" style={styles.fuelStatValue}>
                {tripStats.todayMiles.toLocaleString()}
              </Text>
              <Text size="xs" style={styles.fuelStatLabel}>Today (mi)</Text>
            </View>
          </View>
        </View>
      )}

      {/* === FEATURE: TRIP STATS with bar chart === */}
      <View style={styles.tripContainer}>
        <View style={styles.subsectionHeader}>
          <TrendingUp size={12} color="rgba(0,0,0,0.4)" strokeWidth={2} />
          <Text size="xs" style={styles.tileLabel}>Trip Stats · 7 Days</Text>
        </View>

        {/* Week + Avg stats */}
        <View style={styles.tripRow}>
          <View style={styles.tripStatBox}>
            <Text weight="bold" size="xl" style={styles.tripStatValue}>{tripStats.weekMiles}</Text>
            <Text size="xs" style={styles.tripStatLabel}>This Week</Text>
          </View>
          <View style={styles.tripStatBox}>
            <Text weight="bold" size="xl" style={styles.tripStatValue}>
              {tripStats.avgDailyMiles.toLocaleString()}
            </Text>
            <Text size="xs" style={styles.tripStatLabel}>Avg / Day</Text>
          </View>
        </View>

        {/* Bar chart */}
        <WeekBarChart data={tripStats.sparklineData} />
      </View>
    </View>
  );
}

/** 7-day bar chart with fixed S M T W T F S layout, today highlighted green */
const WEEK_LABELS = ["S", "M", "T", "W", "T", "F", "S"]; // 0=Sun..6=Sat

function WeekBarChart({ data }: { data: number[] }) {
  const BAR_MAX_H = 60;
  const BAR_W = 36;
  const GAP = 8;

  // data[6] = today, data[5] = yesterday, etc.
  // Remap into a fixed Sun–Sat array so bars are always in calendar order.
  const todayDow = new Date().getDay(); // 0=Sun
  const weekBars: { value: number; dow: number; isToday: boolean }[] = WEEK_LABELS.map((_, dow) => {
    // How many days ago was this day-of-week?
    const daysAgo = ((todayDow - dow) % 7 + 7) % 7;
    // Only show data within the last 7 days (daysAgo 0–6)
    const dataIdx = 6 - daysAgo; // map into sparkline array
    return {
      value: dataIdx >= 0 && dataIdx < data.length ? data[dataIdx] : 0,
      dow,
      isToday: dow === todayDow,
    };
  });

  const maxVal = Math.max(...weekBars.map((b) => b.value), 1);

  return (
    <View style={barStyles.container}>
      <View style={barStyles.barsRow}>
        {weekBars.map((bar, i) => {
          const h = Math.max((bar.value / maxVal) * BAR_MAX_H, 4);
          return (
            <View key={i} style={[barStyles.barCol, { width: BAR_W, marginHorizontal: GAP / 2 }]}>
              <View
                style={[
                  barStyles.bar,
                  {
                    height: h,
                    backgroundColor: bar.isToday ? "#34C759" : "rgba(0,0,0,0.08)",
                    borderRadius: 4,
                  },
                ]}
              />
              <Text
                size="xs"
                weight={bar.isToday ? "semiBold" : "regular"}
                style={[barStyles.label, bar.isToday && barStyles.labelToday]}
              >
                {WEEK_LABELS[bar.dow]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: { marginTop: 12 },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  barCol: { alignItems: "center" },
  bar: { width: "100%" },
  label: { color: "rgba(0,0,0,0.35)", marginTop: 6, fontSize: 11 },
  labelToday: { color: "#34C759" },
});

/** Page 2: Tires + Oil + Next Service */
function PageTiresAndOil({
  stats,
  nextServicePrediction,
}: {
  stats: SmartcarStats;
  nextServicePrediction: NextServicePrediction | null;
}) {
  const oilPct = stats.oilLife !== null ? Math.round(stats.oilLife * 100) : null;
  const hasOil = oilPct !== null;
  const hasTires = stats.tirePressure !== null;

  return (
    <View style={styles.pageContainer}>
      {/* Page label */}
      <View style={styles.pageLabel}>
        <Gauge size={12} color="rgba(0,0,0,0.4)" strokeWidth={2} />
        <Text size="xs" style={styles.pageLabelText}>Health & Tires</Text>
      </View>

      {/* Oil life */}
      {hasOil && (
        <View style={styles.oilTile}>
          <View style={styles.oilTileRow}>
            <StatRing percentage={oilPct!} color={getRingColor(oilPct!)} size={56} />
            <View style={styles.oilTileInfo}>
              <Text weight="bold" size="xl" style={styles.oilValue}>{oilPct}%</Text>
              <View style={styles.oilLabelRow}>
                <Droplet size={12} color="rgba(0,0,0,0.4)" strokeWidth={2} />
                <Text size="xs" style={styles.tileLabel}>Oil Life Remaining</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Tires */}
      {hasTires && (
        <View style={styles.tireSection}>
          <View style={styles.subsectionHeader}>
            <Gauge size={12} color="rgba(0,0,0,0.4)" strokeWidth={2} />
            <Text size="xs" style={styles.tileLabel}>Tire Pressure (PSI)</Text>
          </View>
          <View style={styles.tireGrid}>
            <View style={styles.tireRow}>
              <TireTile label="FL" psi={stats.tirePressure!.frontLeft} />
              <TireTile label="FR" psi={stats.tirePressure!.frontRight} />
            </View>
            <View style={styles.tireRow}>
              <TireTile label="RL" psi={stats.tirePressure!.backLeft} />
              <TireTile label="RR" psi={stats.tirePressure!.backRight} />
            </View>
          </View>
        </View>
      )}

      {/* === FEATURE: NEXT SERVICE PREDICTION === */}
      {nextServicePrediction && <NextServiceSection prediction={nextServicePrediction} />}
    </View>
  );
}

/** Page 3: Location + Service History + Lock Status */
function PageLocationAndService({
  stats,
  onMapPress,
}: {
  stats: SmartcarStats;
  onMapPress: () => void;
}) {
  const hasLocation = stats.location !== null;
  const hasLock = stats.lockStatus !== null;

  return (
    <View style={styles.pageContainer}>
      {/* Page label */}
      <View style={styles.pageLabel}>
        <MapPin size={12} color="rgba(0,0,0,0.4)" strokeWidth={2} />
        <Text size="xs" style={styles.pageLabelText}>Location & Security</Text>
      </View>

      {/* === FEATURE: EXPANDABLE MAP === */}
      {hasLocation && (
        <View style={styles.subsection}>
          <View style={styles.subsectionHeader}>
            <MapPin size={12} color="rgba(0,0,0,0.4)" strokeWidth={2} />
            <Text size="xs" style={styles.tileLabel}>Vehicle Location</Text>
            <Text size="xs" style={styles.tapHint}>Tap to expand</Text>
          </View>
          <Pressable onPress={onMapPress} style={styles.mapContainer}>
            <MapView
              style={styles.miniMap}
              provider={PROVIDER_DEFAULT}
              region={{
                latitude: stats.location!.latitude,
                longitude: stats.location!.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              showsUserLocation={false}
              showsMyLocationButton={false}
              showsCompass={false}
              showsScale={false}
              toolbarEnabled={false}
              pointerEvents="none"
            >
              <Marker coordinate={{ latitude: stats.location!.latitude, longitude: stats.location!.longitude }} title="Your Vehicle" />
            </MapView>
          </Pressable>
        </View>
      )}

      {/* Lock status */}
      {hasLock && <LockStatusSection lockStatus={stats.lockStatus!} />}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOT INDICATORS
// ═══════════════════════════════════════════════════════════════════════════════

function DotIndicators({ count, activeIndex }: { count: number; activeIndex: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function VehicleStatsCard({
  stats,
  tripStats,
  nextServicePrediction,
  onRefresh,
  isRefreshing,
}: VehicleStatsCardProps) {
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [mapModalVisible, setMapModalVisible] = useState(false);

  // Counter that increments after each refresh completes → replays fuel gauge animation
  const [fuelAnimKey, setFuelAnimKey] = useState(0);
  const wasRefreshingRef = useRef(false);
  useEffect(() => {
    if (wasRefreshingRef.current && !isRefreshing) {
      // Refresh just finished — bump the key to replay animation
      setFuelAnimKey((k) => k + 1);
    }
    wasRefreshingRef.current = !!isRefreshing;
  }, [isRefreshing]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActivePageIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const pages = [
    { key: "fuel-trips", component: <PageFuelAndTrips stats={stats} tripStats={tripStats} animKey={fuelAnimKey} /> },
    { key: "tires-oil", component: <PageTiresAndOil stats={stats} nextServicePrediction={nextServicePrediction} /> },
    { key: "location-service", component: <PageLocationAndService stats={stats} onMapPress={() => setMapModalVisible(true)} /> },
  ];

  return (
    <View style={styles.container}>
      <BlurView intensity={40} tint="light" style={styles.blurContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text weight="semiBold" size="md" style={styles.headerTitle}>Vehicle Stats</Text>
            {stats.isOnline !== null && (
              <View style={[styles.onlineBadge, { backgroundColor: stats.isOnline ? "#34C75920" : "rgba(0,0,0,0.06)" }]}>
                {stats.isOnline ? (
                  <Wifi size={10} color="#34C759" strokeWidth={2.5} />
                ) : (
                  <WifiOff size={10} color="rgba(0,0,0,0.3)" strokeWidth={2.5} />
                )}
                <Text size="xs" style={{ color: stats.isOnline ? "#34C759" : "rgba(0,0,0,0.3)", fontSize: 10 }}>
                  {stats.isOnline ? "Online" : "Offline"}
                </Text>
              </View>
            )}
          </View>
          {onRefresh && (
            <Pressable
              onPress={onRefresh}
              disabled={isRefreshing}
              style={({ pressed }) => [styles.refreshButton, pressed && styles.refreshPressed]}
              hitSlop={8}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="rgba(0,0,0,0.5)" />
              ) : (
                <RefreshCw size={16} color="rgba(0,0,0,0.5)" strokeWidth={2} />
              )}
            </Pressable>
          )}
        </View>

        {/* === FEATURE: SWIPEABLE PAGES === */}
        <FlatList
          data={pages}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => <View style={{ width: PAGE_WIDTH }}>{item.component}</View>}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={PAGE_WIDTH}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          style={styles.flatListStyle}
        />

        {/* Dot indicators */}
        <DotIndicators count={pages.length} activeIndex={activePageIndex} />

        {/* Last synced */}
        <View style={styles.syncedRow}>
          <View style={styles.syncedDot} />
          <Text size="xs" style={styles.syncedText}>
            Synced {formatTimestamp(stats.lastSyncedAt).toLowerCase()}
          </Text>
        </View>
      </BlurView>

      {/* === FEATURE: EXPANDABLE MAP === modal */}
      {stats.location && (
        <ExpandableMapModal
          visible={mapModalVisible}
          latitude={stats.location.latitude}
          longitude={stats.location.longitude}
          onClose={() => setMapModalVisible(false)}
        />
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    overflow: "hidden",
  },
  blurContainer: {
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: { color: "#1a1a1a" },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  refreshPressed: { opacity: 0.7 },

  // Swipeable pages
  flatListStyle: { flexGrow: 0 },
  pageContainer: { paddingHorizontal: 16, paddingBottom: 6 },
  pageLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  pageLabelText: { color: "rgba(0,0,0,0.35)", textTransform: "uppercase", fontSize: 10, letterSpacing: 0.5 },

  // Dots
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { backgroundColor: "#007AFF", width: 18, borderRadius: 4 },
  dotInactive: { backgroundColor: "rgba(0,0,0,0.15)" },

  // Fuel gauge wrapper
  fuelGaugeWrapper: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  // 3-column stat row under fuel gauge
  fuelStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    width: "100%",
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
    paddingTop: 12,
  },
  fuelStatCol: { flex: 1, alignItems: "center" },
  fuelStatValue: { color: "#1a1a1a", fontSize: 17 },
  fuelStatLabel: { color: "rgba(0,0,0,0.35)", marginTop: 3 },
  fuelStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: "rgba(0,0,0,0.1)",
  },

  // Trip stats
  tripContainer: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 16,
    padding: 14,
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 8,
  },
  tripStatBox: { alignItems: "center", minWidth: 60 },
  tripStatValue: { color: "#1a1a1a" },
  tripStatLabel: { color: "rgba(0,0,0,0.35)", marginTop: 2 },

  // Oil tile
  oilTile: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  oilTileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  oilTileInfo: { flex: 1 },
  oilValue: { color: "#1a1a1a", marginBottom: 2 },
  oilLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },

  // Tire section
  tireSection: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  tireGrid: { width: "100%", marginTop: 8, gap: 6 },
  tireRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  tireTile: {
    width: 70,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  tireTileLabel: { color: "rgba(0,0,0,0.35)", fontSize: 10, marginBottom: 2 },
  tireTileValue: { fontSize: 15 },

  // Subsections
  subsection: { marginTop: 10 },
  subsectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  sectionBadge: { marginLeft: "auto", color: "rgba(0,0,0,0.3)" },
  tileLabel: { color: "rgba(0,0,0,0.45)" },
  tapHint: { marginLeft: "auto", color: "#007AFF", fontSize: 10 },
  noDataText: { color: "rgba(0,0,0,0.3)", marginTop: 8 },

  // Lock Status
  lockCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  lockIconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  lockInfo: { flex: 1 },
  lockDetail: { color: "rgba(0,0,0,0.45)", marginTop: 2 },
  doorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  doorChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  doorDot: { width: 6, height: 6, borderRadius: 3 },
  doorChipText: { color: "rgba(0,0,0,0.5)", fontSize: 11 },

  // Location
  mapContainer: { borderRadius: 14, overflow: "hidden", height: 150 },
  miniMap: { flex: 1 },

  // Next service prediction
  predictionCard: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
  },
  predictionSub: { color: "rgba(0,0,0,0.45)", marginTop: 2 },
  predictionDate: { color: "rgba(0,0,0,0.35)", marginTop: 4 },

  // Synced
  syncedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  syncedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#34C759",
  },
  syncedText: { color: "rgba(0,0,0,0.35)" },
});
