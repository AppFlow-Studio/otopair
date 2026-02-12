/**
 * useSmartcarData Hook
 *
 * Fetches the latest Smartcar health snapshots for a vehicle and derives
 * maintenance items + an overall health score for the UI.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx
 */

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MaintenanceItem, MaintenanceStatus } from "@/components/cars/MaintenanceTracker";

// ============================================================================
// CONSTANTS
// ============================================================================

// kPa to PSI conversion factor
const KPA_TO_PSI = 0.145038;

// Thresholds for maintenance item derivation
const OIL_OVERDUE_THRESHOLD = 0.20;
const OIL_DUE_SOON_THRESHOLD = 0.50;
const TIRE_LOW_PSI = 30;
const FUEL_LOW_THRESHOLD = 0.15;

// Health score weights (total = 1.0)
const WEIGHTS = {
  oilLife: 0.40,
  tirePressure: 0.35,
  fuel: 0.25,
};

// ============================================================================
// TYPES
// ============================================================================

export interface DoorStatus {
  type: string; // "frontLeft" | "frontRight" | "backLeft" | "backRight"
  status: string; // "OPEN" | "CLOSED" | "UNKNOWN"
}

export interface LockStatusData {
  isLocked: boolean;
  doors: DoorStatus[];
  windows: DoorStatus[];
  sunroof?: DoorStatus[];
  storage?: DoorStatus[];
  chargingPort?: DoorStatus[];
}

export interface ServiceRecord {
  serviceId: string | null;
  odometerDistance: number | null;
  serviceDate: string | null;
  serviceTasks: { taskId: string | null; taskDescription: string | null }[];
  serviceDetails: { type: string; value: string | null }[];
  serviceCost: { totalCost: number | null; currency: string | null } | null;
}

export interface SmartcarStats {
  oilLife: number | null; // 0.0–1.0
  fuel: {
    percentRemaining: number | null;
    range: number | null;
    amountRemaining: number | null;
  } | null;
  tirePressure: {
    frontLeft: number; // PSI
    frontRight: number;
    backLeft: number;
    backRight: number;
  } | null;
  location: {
    latitude: number;
    longitude: number;
  } | null;
  odometer: {
    distance: number;
    unit: string;
  } | null;
  lockStatus: LockStatusData | null;
  serviceHistory: ServiceRecord[] | null;
  isOnline: boolean | null;
  lastSyncedAt: number | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function kpaToPsi(kpa: number): number {
  return Math.round(kpa * KPA_TO_PSI * 10) / 10;
}

function deriveTirePressurePsi(raw: any): SmartcarStats["tirePressure"] {
  if (!raw) return null;
  return {
    frontLeft: kpaToPsi(raw.frontLeft ?? 0),
    frontRight: kpaToPsi(raw.frontRight ?? 0),
    backLeft: kpaToPsi(raw.backLeft ?? 0),
    backRight: kpaToPsi(raw.backRight ?? 0),
  };
}

function deriveMaintenanceItems(stats: SmartcarStats): MaintenanceItem[] {
  const items: MaintenanceItem[] = [];

  // Oil life
  if (stats.oilLife !== null) {
    const pct = Math.round(stats.oilLife * 100);
    let status: MaintenanceStatus = "on_time";
    if (stats.oilLife < OIL_OVERDUE_THRESHOLD) status = "overdue";
    else if (stats.oilLife < OIL_DUE_SOON_THRESHOLD) status = "due_soon";

    items.push({
      id: "smartcar-oil",
      serviceName: "Oil Change",
      description: `Oil life remaining: ${pct}%`,
      detail: `${pct}% remaining`,
      status,
    });
  }

  // Tire pressure
  if (stats.tirePressure) {
    const tires = stats.tirePressure;
    const allPsi = [tires.frontLeft, tires.frontRight, tires.backLeft, tires.backRight];
    const anyLow = allPsi.some((p) => p < TIRE_LOW_PSI);
    const minPsi = Math.min(...allPsi);

    items.push({
      id: "smartcar-tires",
      serviceName: "Tire Pressure",
      description: anyLow
        ? `Low tire detected (${minPsi} PSI)`
        : `All tires in range`,
      detail: anyLow ? `${minPsi} PSI low` : "OK",
      status: anyLow ? "due_soon" : "on_time",
    });
  }

  // Fuel level
  if (stats.fuel?.percentRemaining !== null && stats.fuel?.percentRemaining !== undefined) {
    const pct = Math.round(stats.fuel.percentRemaining * 100);
    const isLow = stats.fuel.percentRemaining < FUEL_LOW_THRESHOLD;

    items.push({
      id: "smartcar-fuel",
      serviceName: "Fuel Level",
      description: stats.fuel.range
        ? `${pct}% — ${Math.round(stats.fuel.range)} mi range`
        : `${pct}% remaining`,
      detail: `${pct}%`,
      status: isLow ? "due_soon" : "on_time",
    });
  }

  return items;
}

function computeHealthScore(stats: SmartcarStats): number {
  let totalWeight = 0;
  let weightedSum = 0;

  // Oil life contributes directly (0–1)
  if (stats.oilLife !== null) {
    weightedSum += stats.oilLife * WEIGHTS.oilLife;
    totalWeight += WEIGHTS.oilLife;
  }

  // Tire pressure: score based on how many tires are in range (30–36 PSI ideal)
  if (stats.tirePressure) {
    const tires = [
      stats.tirePressure.frontLeft,
      stats.tirePressure.frontRight,
      stats.tirePressure.backLeft,
      stats.tirePressure.backRight,
    ];
    const tireScore = tires.reduce((sum, psi) => {
      if (psi >= 30 && psi <= 36) return sum + 1;
      if (psi >= 26 && psi < 30) return sum + 0.5;
      return sum + 0.2;
    }, 0) / 4;
    weightedSum += tireScore * WEIGHTS.tirePressure;
    totalWeight += WEIGHTS.tirePressure;
  }

  // Fuel contributes directly
  if (stats.fuel?.percentRemaining !== null && stats.fuel?.percentRemaining !== undefined) {
    weightedSum += stats.fuel.percentRemaining * WEIGHTS.fuel;
    totalWeight += WEIGHTS.fuel;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100);
}

// ============================================================================
// HOOK
// ============================================================================

export function useSmartcarData(vehicleOwnerId: Id<"vehicle_owners"> | undefined) {
  const snapshots = useQuery(
    api.smartcar.getLatestSnapshots,
    vehicleOwnerId ? { vehicleOwnerId } : "skip"
  );

  const stats: SmartcarStats | null = useMemo(() => {
    if (!snapshots) return null;

    return {
      oilLife: snapshots.oilLife?.data?.lifeRemaining ?? null,
      fuel: snapshots.fuel?.data
        ? {
            percentRemaining: snapshots.fuel.data.percentRemaining ?? null,
            range: snapshots.fuel.data.range ?? null,
            amountRemaining: snapshots.fuel.data.amountRemaining ?? null,
          }
        : null,
      tirePressure: deriveTirePressurePsi(snapshots.tirePressure?.data),
      location: snapshots.location?.data
        ? {
            latitude: snapshots.location.data.latitude,
            longitude: snapshots.location.data.longitude,
          }
        : null,
      odometer: snapshots.odometer?.data
        ? {
            distance: Math.ceil(snapshots.odometer.data.distance),
            unit: snapshots.odometer.data.unit || "mi",
          }
        : null,
      lockStatus: snapshots.lockStatus?.data ?? null,
      serviceHistory: snapshots.serviceHistory?.data ?? null,
      isOnline: snapshots.onlineStatus?.data?.isOnline ?? null,
      lastSyncedAt: snapshots.lastSyncedAt,
    };
  }, [snapshots]);

  const maintenanceItems = useMemo(() => {
    if (!stats) return [];
    return deriveMaintenanceItems(stats);
  }, [stats]);

  const healthScore = useMemo(() => {
    if (!stats) return 0;
    return computeHealthScore(stats);
  }, [stats]);

  return {
    stats,
    maintenanceItems,
    healthScore,
    lastSyncedAt: snapshots?.lastSyncedAt ?? null,
    isConnected: snapshots?.isConnected ?? false,
    isLoading: snapshots === undefined,
  };
}
