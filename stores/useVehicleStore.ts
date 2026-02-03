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
// MOCK DATA
// ─────────────────────────────────────────────────────────────

const MOCK_VEHICLES: Vehicle[] = [
  {
    id: "vehicle-1",
    year: 2022,
    make: "Toyota",
    model: "Camry",
    vin: "1HGBH41JXMN109186",
    mileage: 24500,
    isDefault: true,
  },
  {
    id: "vehicle-2",
    year: 2021,
    make: "BMW",
    model: "3 Series",
    vin: "WBA8E9C50GK123456",
    mileage: 18200,
    isDefault: false,
  },
  {
    id: "vehicle-3",
    year: 2020,
    make: "Honda",
    model: "Civic",
    vin: "2HGFC2F59LH567890",
    mileage: 35800,
    isDefault: false,
  },
];

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
  /** Hydrate store from Convex vehicle ownership data (replaces mock when present) */
  setVehiclesFromConvex: (data: ConvexVehicleOwnership[]) => void;
}

/** Shape from api.vehicles.listVehiclesByUser (subset of fields we use) */
interface ConvexVehicleOwnership {
  vin: string;
  vehicle: { year?: number; metadata?: unknown; engine_id?: string } | null;
  ownership?: { is_primary?: boolean; mileage?: number; nickname?: string };
}

// ─────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────

// Initialize vehicles record from mock data
const initialVehicles: Record<string, Vehicle> = {};
MOCK_VEHICLES.forEach((vehicle) => {
  initialVehicles[vehicle.id] = vehicle;
});

// Find default vehicle
const defaultVehicle = MOCK_VEHICLES.find((v) => v.isDefault);

export const useVehicleStore = create<VehicleState>()((set, get) => ({
  // ═══════════════ INITIAL STATE ═══════════════
  vehicles: initialVehicles,
  vehicleIds: MOCK_VEHICLES.map((v) => v.id),
  selectedVehicleId: defaultVehicle?.id ?? MOCK_VEHICLES[0]?.id ?? null,

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
      const v: Vehicle = {
        id: vin,
        vin,
        year,
        make: meta?.make ?? "Vehicle",
        model: meta?.model ?? "",
        mileage: r.ownership?.mileage,
        isDefault: r.ownership?.is_primary ?? ids.length === 0,
        engineId: r.vehicle?.engine_id as string | undefined,
      };
      vehiclesRecord[vin] = v;
      ids.push(vin);
    });
    const primary = data.find((r) => r.ownership?.is_primary) ?? data[0];
    set({
      vehicles: vehiclesRecord,
      vehicleIds: ids,
      selectedVehicleId: primary ? primary.vin.toUpperCase().trim() : (ids[0] ?? null),
    });
  },
}));
