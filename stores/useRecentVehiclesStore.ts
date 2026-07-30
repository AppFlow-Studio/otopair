/**
 * useRecentVehiclesStore
 *
 * MRU list of VINs the user has activated on the Cars tab. Powers the
 * compact 3-thumbnail selector in `CarCarousel` (5+ cars mode) so it
 * surfaces the 3 vehicles the user was most recently on, not just the
 * first 3 in garage order.
 *
 * Persisted via expo-secure-store so the ordering survives cold starts.
 * Capped at 10 entries — the compact strip only reads the top 3, but a
 * small buffer means quick round-trips (e.g. Ford → Honda → Ford)
 * don't churn the ordering pathologically.
 *
 * Semantics: `recordView(vin)` moves `vin` to the front. Duplicate
 * writes (same vin activated twice in a row) coalesce. VINs are stored
 * case-normalized (uppercased + trimmed) so lookups across the app
 * agree regardless of how a store or hook cased the value.
 */

import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "recent_vehicle_vins_v1";
const MAX_ENTRIES = 10;

function normalizeVin(vin: string): string {
  return vin.trim().toUpperCase();
}

interface RecentVehiclesState {
  /** MRU list of normalized VINs, most recent first. */
  recentVins: string[];
  /** True once the persisted value has been loaded (or first-launch
   *  empty seed). */
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  /** Mark `vin` as the most recently viewed vehicle. */
  recordView: (vin: string | null | undefined) => void;
  /** Remove a VIN entirely — e.g. when the user deletes a vehicle. */
  forget: (vin: string) => void;
}

export const useRecentVehiclesStore = create<RecentVehiclesState>((set, get) => ({
  recentVins: [],
  isHydrated: false,

  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const cleaned = parsed
              .filter((v): v is string => typeof v === "string" && v.length > 0)
              .map(normalizeVin)
              .slice(0, MAX_ENTRIES);
            set({ recentVins: cleaned, isHydrated: true });
            return;
          }
        } catch {
          // Malformed payload — fall through to empty seed.
        }
      }
      set({ isHydrated: true });
    } catch (err) {
      console.warn("[useRecentVehiclesStore] hydrate failed", err);
      set({ isHydrated: true });
    }
  },

  recordView: (vin) => {
    if (!vin) return;
    const normalized = normalizeVin(vin);
    if (!normalized) return;
    const current = get().recentVins;
    if (current[0] === normalized) return; // dedupe consecutive writes
    const next = [
      normalized,
      ...current.filter((v) => v !== normalized),
    ].slice(0, MAX_ENTRIES);
    set({ recentVins: next });
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch((err) => {
      console.warn("[useRecentVehiclesStore] persist failed", err);
    });
  },

  forget: (vin) => {
    const normalized = normalizeVin(vin);
    if (!normalized) return;
    const current = get().recentVins;
    if (!current.includes(normalized)) return;
    const next = current.filter((v) => v !== normalized);
    set({ recentVins: next });
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch((err) => {
      console.warn("[useRecentVehiclesStore] persist (forget) failed", err);
    });
  },
}));
