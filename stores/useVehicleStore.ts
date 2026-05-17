/**
 * useVehicleStore
 *
 * PURPOSE: Manages user's vehicles and the currently selected vehicle for booking
 *
 * TABLES: Vehicles (future integration)
 *
 * RELATIONSHIPS:
 *   - Vehicle belongs to User
 *   - Booking references selected Vehicle
 *
 * OWNER: Waleed Mansour
 */

import { create } from "zustand";
import { ImageSourcePropType } from "react-native";

import { formatMake } from "@/utils/formatMake";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface Vehicle {
  /** Unique identifier */
  id: string;
  /** Model year */
  year: number;
  /** Vehicle make (e.g., "Toyota") */
  make: string;
  /** Vehicle model (e.g., "Camry") */
  model: string;
  /** Vehicle Identification Number (optional) */
  vin?: string;
  /** Current mileage (optional) */
  mileage?: number;
  /** Vehicle image source (optional) */
  imageSource?: ImageSourcePropType;
  /** Whether this is the default vehicle */
  isDefault?: boolean;
  /** Convex engine ID for car-specific service labor/parts (from vehicles.engine_id) */
  engineId?: string;
}

// ─────────────────────────────────────────────────────────────
// STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────

interface VehicleState {
  // ═══════════════ VEHICLE DATA ═══════════════
  /** All vehicles indexed by ID */
  vehicles: Record<string, Vehicle>;
  /** Ordered list of vehicle IDs */
  vehicleIds: string[];
  /** Currently selected vehicle ID for booking (null = none selected) */
  selectedVehicleId: string | null;

  // ═══════════════ ACTIONS ═══════════════
  /** Select a vehicle for booking */
  selectVehicle: (vehicleId: string | null) => void;
  /** Get a vehicle by ID */
  getVehicleById: (id: string) => Vehicle | undefined;
  /** Get the currently selected vehicle */
  getSelectedVehicle: () => Vehicle | undefined;
  /** Get all vehicles as an array */
  getAllVehicles: () => Vehicle[];
  /** Set a vehicle as default */
  setDefaultVehicle: (vehicleId: string) => void;
  /** Hydrate store from Convex vehicle ownership data (user's registered vehicles) */
  setVehiclesFromConvex: (data: ConvexVehicleOwnership[]) => void;
  /** Clear user-scoped vehicles on logout / account switch */
  clearVehicles: () => void;
}

/** Shape from api.vehicles.listVehiclesByUser (subset of fields we use) */
interface ConvexVehicleOwnership {
  vin: string;
  vehicle: { year?: number; metadata?: unknown; engine_id?: string; image_url?: string } | null;
  ownership?: { is_primary?: boolean; mileage?: number; nickname?: string };
}

// ─────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────
// Initial state is empty; vehicles come from Convex via setVehiclesFromConvex
// (useVehicleOwnershipFromConvex in main tabs layout).

export const useVehicleStore = create<VehicleState>()((set, get) => ({
  // ═══════════════ INITIAL STATE ═══════════════
  vehicles: {},
  vehicleIds: [],
  selectedVehicleId: null,

  // ═══════════════ ACTIONS ═══════════════
  selectVehicle: (vehicleId) => {
    set({ selectedVehicleId: vehicleId });
  },

  getVehicleById: (id) => {
    return get().vehicles[id];
  },

  getSelectedVehicle: () => {
    const { selectedVehicleId, vehicles } = get();
    if (!selectedVehicleId) return undefined;
    return vehicles[selectedVehicleId];
  },

  getAllVehicles: () => {
    const { vehicleIds, vehicles } = get();
    return vehicleIds.map((id) => vehicles[id]).filter(Boolean);
  },

  setDefaultVehicle: (vehicleId) => {
    set((state) => {
      const updatedVehicles = { ...state.vehicles };

      // Remove default from all vehicles
      Object.keys(updatedVehicles).forEach((id) => {
        updatedVehicles[id] = { ...updatedVehicles[id], isDefault: false };
      });

      // Set new default
      if (updatedVehicles[vehicleId]) {
        updatedVehicles[vehicleId] = { ...updatedVehicles[vehicleId], isDefault: true };
      }

      return { vehicles: updatedVehicles };
    });
  },

  setVehiclesFromConvex: (data) => {
    if (!data || data.length === 0) return;
    const vehiclesRecord: Record<string, Vehicle> = {};
    const ids: string[] = [];
    data.forEach((r) => {
      if (!r.vehicle) return;
      const vin = r.vin.toUpperCase().trim();
      const year = r.vehicle?.year ?? new Date().getFullYear();
      const meta = r.vehicle?.metadata as { make?: string; model?: string } | undefined;
      // Only surface cached image_url if it's from the new transparent-bg
      // endpoint. Stale white-bg URLs from the legacy `vehicle-media/v2`
      // endpoint are dropped so consumers fall back to a placeholder
      // until the cars screen re-fetches and overwrites them.
      const imageUrl = r.vehicle?.image_url;
      const isTransparent = typeof imageUrl === "string" && imageUrl.includes("/transparent/");
      const v: Vehicle = {
        id: vin,
        vin,
        year,
        make: meta?.make ? formatMake(meta.make) : "Vehicle",
        model: meta?.model ?? "",
        mileage: r.ownership?.mileage,
        isDefault: r.ownership?.is_primary ?? ids.length === 0,
        engineId: r.vehicle?.engine_id as string | undefined,
        imageSource: isTransparent ? { uri: imageUrl } : undefined,
      };
      vehiclesRecord[vin] = v;
      ids.push(vin);
    });
    const primary = data.find((r) => r.ownership?.is_primary) ?? data[0];
    const currentSelected = get().selectedVehicleId;
    // Only set selectedVehicleId if not already set (preserve user's selection during booking)
    const keepSelection = currentSelected != null && ids.includes(currentSelected);
    set({
      vehicles: vehiclesRecord,
      vehicleIds: ids,
      selectedVehicleId: keepSelection ? currentSelected : (primary ? primary.vin.toUpperCase().trim() : (ids[0] ?? null)),
    });
  },

  clearVehicles: () =>
    set({
      vehicles: {},
      vehicleIds: [],
      selectedVehicleId: null,
    }),
}));
