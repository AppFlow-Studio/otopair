/**
 * VehicleStatsCard
 *
 * PURPOSE: Displays real-time Smartcar data (oil life, fuel, tire pressure,
 *          lock status, location, service history) in a visually rich card.
 *          Tiles with no data are automatically hidden.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (below carousel, above MaintenanceTracker)
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

// 2. Expo & Third-party
import { BlurView } from "expo-blur";
import {
  Clock,
  DollarSign,
  Droplet,
  Fuel,
  Gauge,
  Lock,
  MapPin,
  RefreshCw,
  Shield,
  Unlock,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import Svg, { Circle } from "react-native-svg";

// 3. Shared UI
import { Text } from "@/components/shared-ui";

// 4. Types
import type { SmartcarStats, ServiceRecord, LockStatusData } from "@/hooks/useSmartcarData";

// ============================================================================
// TYPES
// ============================================================================

interface VehicleStatsCardProps {
  stats: SmartcarStats;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
}

// ============================================================================
// MINI RING COMPONENT
// ============================================================================

interface StatRingProps {
  percentage: number; // 0–100
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
}

function StatRing({
  percentage,
  size = 52,
  strokeWidth = 6,
  color,
  trackColor = "rgba(255,255,255,0.12)",
}: StatRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const [animatedPct, setAnimatedPct] = useState(0);

  useEffect(() => {
    setAnimatedPct(0);
    const steps = 30;
    const stepMs = 800 / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const t = 1 - Math.pow(1 - step / steps, 3);
      setAnimatedPct(t * percentage);
      if (step >= steps) clearInterval(interval);
    }, stepMs);
    return () => clearInterval(interval);
  }, [percentage]);

  const offset = circumference * (1 - animatedPct / 100);

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
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

// ============================================================================
// HELPERS
// ============================================================================

function getRingColor(pct: number): string {
  if (pct >= 60) return "#34C759"; // Green
  if (pct >= 30) return "#FF9F0A"; // Orange
  return "#FF3B30"; // Red
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
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatServiceDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown date";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ============================================================================
// LOCK STATUS SUB-COMPONENT
// ============================================================================

function LockStatusSection({ lockStatus }: { lockStatus: LockStatusData }) {
  const isLocked = lockStatus.isLocked;
  const doors = lockStatus.doors || [];
  const windows = lockStatus.windows || [];

  const openDoors = doors.filter((d) => d.status === "OPEN");
  const openWindows = windows.filter((w) => w.status === "OPEN");

  const statusColor = isLocked ? "#34C759" : "#FF9F0A";
  const LockIcon = isLocked ? Lock : Unlock;

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Shield size={12} color="rgba(0,0,0,0.4)" strokeWidth={2} />
        <Text size="xs" style={styles.tileLabel}>
          Security Status
        </Text>
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
            <Text size="xs" style={styles.lockDetail}>
              {openDoors.length} door{openDoors.length > 1 ? "s" : ""} open
            </Text>
          )}
          {openWindows.length > 0 && (
            <Text size="xs" style={styles.lockDetail}>
              {openWindows.length} window{openWindows.length > 1 ? "s" : ""} open
            </Text>
          )}
          {openDoors.length === 0 && openWindows.length === 0 && (
            <Text size="xs" style={styles.lockDetail}>
              All doors & windows closed
            </Text>
          )}
        </View>
      </View>

      {/* Door status grid */}
      {doors.length > 0 && (
        <View style={styles.doorGrid}>
          {doors.map((door) => (
            <View key={door.type} style={styles.doorChip}>
              <View
                style={[
                  styles.doorDot,
                  {
                    backgroundColor:
                      door.status === "CLOSED"
                        ? "#34C759"
                        : door.status === "OPEN"
                          ? "#FF3B30"
                          : "rgba(0,0,0,0.15)",
                  },
                ]}
              />
              <Text size="xs" style={styles.doorChipText}>
                {formatDoorLabel(door.type)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function formatDoorLabel(type: string): string {
  const map: Record<string, string> = {
    frontLeft: "FL",
    frontRight: "FR",
    backLeft: "RL",
    backRight: "RR",
  };
  return map[type] || type;
}

// ============================================================================
// SERVICE HISTORY SUB-COMPONENT
// ============================================================================

function ServiceHistorySection({ records }: { records: ServiceRecord[] }) {
  // Sort by date descending (most recent first)
  const sorted = [...records].sort((a, b) => {
    if (!a.serviceDate) return 1;
    if (!b.serviceDate) return -1;
    return new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime();
  });

  const displayRecords = sorted.slice(0, 5); // show latest 5

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Wrench size={12} color="rgba(0,0,0,0.4)" strokeWidth={2} />
        <Text size="xs" style={styles.tileLabel}>
          Service History
        </Text>
        {sorted.length > 5 && (
          <Text size="xs" style={styles.sectionCountBadge}>
            +{sorted.length - 5} more
          </Text>
        )}
      </View>
      {displayRecords.map((record, idx) => (
        <ServiceRecordRow key={record.serviceId || idx} record={record} isLast={idx === displayRecords.length - 1} />
      ))}
      {displayRecords.length === 0 && (
        <Text size="sm" style={styles.noDataText}>
          No service records available
        </Text>
      )}
    </View>
  );
}

function ServiceRecordRow({ record, isLast }: { record: ServiceRecord; isLast: boolean }) {
  const tasks = (record.serviceTasks || [])
    .map((t) => t.taskDescription)
    .filter(Boolean);

  const description = tasks.length > 0 ? tasks.join(", ") : "Service performed";

  return (
    <View style={[styles.serviceRow, !isLast && styles.serviceRowBorder]}>
      <View style={styles.serviceRowIcon}>
        <Clock size={14} color="rgba(0,0,0,0.3)" strokeWidth={2} />
      </View>
      <View style={styles.serviceRowContent}>
        <Text weight="medium" size="sm" style={styles.serviceRowTitle} numberOfLines={2}>
          {description}
        </Text>
        <View style={styles.serviceRowMeta}>
          <Text size="xs" style={styles.serviceRowDate}>
            {formatServiceDate(record.serviceDate)}
          </Text>
          {record.odometerDistance != null && (
            <Text size="xs" style={styles.serviceRowMileage}>
              {Math.round(record.odometerDistance).toLocaleString()} mi
            </Text>
          )}
          {record.serviceCost?.totalCost != null && (
            <View style={styles.costBadge}>
              <DollarSign size={10} color="rgba(0,0,0,0.4)" strokeWidth={2} />
              <Text size="xs" style={styles.costText}>
                {record.serviceCost.totalCost.toFixed(0)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// TIRE TILE SUB-COMPONENT
// ============================================================================

function TireTile({ label, psi }: { label: string; psi: number }) {
  const color = getTirePsiColor(psi);
  return (
    <View style={styles.tireTile}>
      <Text size="xs" style={styles.tireTileLabel}>
        {label}
      </Text>
      <Text weight="bold" size="sm" style={[styles.tireTileValue, { color }]}>
        {psi}
      </Text>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function VehicleStatsCard({
  stats,
  onRefresh,
  isRefreshing,
}: VehicleStatsCardProps) {
  const oilPct =
    stats.oilLife !== null ? Math.round(stats.oilLife * 100) : null;
  const fuelPct =
    stats.fuel?.percentRemaining !== null &&
    stats.fuel?.percentRemaining !== undefined
      ? Math.round(stats.fuel.percentRemaining * 100)
      : null;

  // Determine which stat tiles to show (only those with data)
  const hasOil = oilPct !== null;
  const hasFuel = fuelPct !== null;
  const hasTires = stats.tirePressure !== null;
  const hasLock = stats.lockStatus !== null;
  const hasLocation = stats.location !== null;
  const hasServiceHistory =
    stats.serviceHistory !== null && stats.serviceHistory.length > 0;

  // If we have both oil and fuel, show them side-by-side. If only one, it takes full width.
  const showRingTiles = hasOil || hasFuel;

  return (
    <View style={styles.container}>
      <BlurView intensity={40} tint="light" style={styles.blurContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text weight="semiBold" size="md" style={styles.headerTitle}>
              Vehicle Stats
            </Text>
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
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.refreshPressed,
              ]}
              hitSlop={8}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="rgba(0,0,0,0.5)" />
              ) : (
                <RefreshCw
                  size={16}
                  color="rgba(0,0,0,0.5)"
                  strokeWidth={2}
                />
              )}
            </Pressable>
          )}
        </View>

        {/* Stat Tiles — only show tiles that have data */}
        {showRingTiles && (
          <View style={styles.grid}>
            {/* Oil Life — only if data exists */}
            {hasOil && (
              <View style={[styles.tile, !hasFuel && styles.tileWide]}>
                <View style={styles.tileRingRow}>
                  <StatRing
                    percentage={oilPct!}
                    color={getRingColor(oilPct!)}
                    size={52}
                  />
                </View>
                <Text weight="bold" size="lg" style={styles.tileValue}>
                  {oilPct}%
                </Text>
                <View style={styles.tileLabelRow}>
                  <Droplet
                    size={12}
                    color="rgba(0,0,0,0.4)"
                    strokeWidth={2}
                  />
                  <Text size="xs" style={styles.tileLabel}>
                    Oil Life
                  </Text>
                </View>
              </View>
            )}

            {/* Fuel Level — only if data exists */}
            {hasFuel && (
              <View style={[styles.tile, !hasOil && styles.tileWide]}>
                <View style={styles.tileRingRow}>
                  <StatRing
                    percentage={fuelPct!}
                    color={getRingColor(fuelPct!)}
                    size={52}
                  />
                </View>
                <Text weight="bold" size="lg" style={styles.tileValue}>
                  {fuelPct}%
                </Text>
                <View style={styles.tileLabelRow}>
                  <Fuel
                    size={12}
                    color="rgba(0,0,0,0.4)"
                    strokeWidth={2}
                  />
                  <Text size="xs" style={styles.tileLabel}>
                    {stats.fuel?.range
                      ? `${Math.round(stats.fuel.range)} mi`
                      : "Fuel"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Tire Pressure — only if data exists */}
        {hasTires && (
          <View style={[styles.tileWide, styles.tile, { marginTop: showRingTiles ? 10 : 0 }]}>
            <View style={styles.tileLabelRow}>
              <Gauge size={12} color="rgba(0,0,0,0.4)" strokeWidth={2} />
              <Text size="xs" style={styles.tileLabel}>
                Tire Pressure (PSI)
              </Text>
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

        {/* Lock Status — only if data exists */}
        {hasLock && <LockStatusSection lockStatus={stats.lockStatus!} />}

        {/* Location Mini Map — only if data exists */}
        {hasLocation && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <MapPin size={12} color="rgba(0,0,0,0.4)" strokeWidth={2} />
              <Text size="xs" style={styles.tileLabel}>
                Vehicle Location
              </Text>
            </View>
            <View style={styles.mapContainer}>
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
                <Marker
                  coordinate={{
                    latitude: stats.location!.latitude,
                    longitude: stats.location!.longitude,
                  }}
                  title="Your Vehicle"
                />
              </MapView>
            </View>
          </View>
        )}

        {/* Service History — only if data exists */}
        {hasServiceHistory && (
          <ServiceHistorySection records={stats.serviceHistory!} />
        )}

        {/* Last synced */}
        <Text size="xs" style={styles.syncedText}>
          Last synced: {formatTimestamp(stats.lastSyncedAt)}
        </Text>
      </BlurView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    overflow: "hidden",
  },
  blurContainer: {
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#1a1a1a",
  },
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
  refreshPressed: {
    opacity: 0.7,
  },

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tile: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
  },
  tileWide: {
    minWidth: "100%",
    flex: undefined,
  },
  tileRingRow: {
    marginBottom: 6,
  },
  tileValue: {
    color: "#1a1a1a",
    marginBottom: 2,
  },
  tileLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tileLabel: {
    color: "rgba(0,0,0,0.45)",
  },
  noDataText: {
    color: "rgba(0,0,0,0.3)",
    marginTop: 8,
  },

  // Tire Grid
  tireGrid: {
    width: "100%",
    marginTop: 8,
    gap: 6,
  },
  tireRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  tireTile: {
    width: 70,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  tireTileLabel: {
    color: "rgba(0,0,0,0.35)",
    fontSize: 10,
    marginBottom: 2,
  },
  tireTileValue: {
    fontSize: 15,
  },

  // Sections (lock, location, service history)
  sectionContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  sectionCountBadge: {
    marginLeft: "auto",
    color: "rgba(0,0,0,0.3)",
  },

  // Lock Status
  lockCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  lockIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  lockInfo: {
    flex: 1,
  },
  lockDetail: {
    color: "rgba(0,0,0,0.45)",
    marginTop: 2,
  },
  doorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  doorChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  doorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  doorChipText: {
    color: "rgba(0,0,0,0.5)",
    fontSize: 11,
  },

  // Location
  mapContainer: {
    borderRadius: 14,
    overflow: "hidden",
    height: 150,
  },
  miniMap: {
    flex: 1,
  },

  // Service History
  serviceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    gap: 10,
  },
  serviceRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  serviceRowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.04)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  serviceRowContent: {
    flex: 1,
  },
  serviceRowTitle: {
    color: "#1a1a1a",
  },
  serviceRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  serviceRowDate: {
    color: "rgba(0,0,0,0.4)",
  },
  serviceRowMileage: {
    color: "rgba(0,0,0,0.3)",
  },
  costBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  costText: {
    color: "rgba(0,0,0,0.4)",
  },

  // Synced
  syncedText: {
    color: "rgba(0,0,0,0.3)",
    textAlign: "center",
    marginTop: 10,
  },
});
