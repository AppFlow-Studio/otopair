/**
 * useBookingsBadgeStore
 *
 * Tracks the timestamp of the last time the user opened the Bookings tab.
 * The bottom-nav badge counts bookings (regular + tire-quote) whose
 * `createdAt` is newer than this timestamp. Persisted via expo-secure-store
 * so the badge survives cold starts.
 *
 * On first ever launch (no persisted value) the store initializes
 * `lastSeenAt` to "now" so the user doesn't see a phantom badge for their
 * full pre-existing booking history.
 */

import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "bookings_last_seen_at_v1";

interface BookingsBadgeState {
  /** Epoch ms of the last visit to the Bookings tab. */
  lastSeenAt: number;
  /** True once the persisted value (or initial seed) has been loaded. */
  isHydrated: boolean;
  /** Pull the persisted value (or seed it on first launch). */
  hydrate: () => Promise<void>;
  /** Mark the Bookings tab as seen *now*. */
  markSeen: () => void;
}

export const useBookingsBadgeStore = create<BookingsBadgeState>((set, get) => ({
  lastSeenAt: 0,
  isHydrated: false,

  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      const parsed = raw ? Number(raw) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) {
        set({ lastSeenAt: parsed, isHydrated: true });
        return;
      }
      const now = Date.now();
      await SecureStore.setItemAsync(STORAGE_KEY, String(now));
      set({ lastSeenAt: now, isHydrated: true });
    } catch (err) {
      // Don't block the UI if secure storage is unavailable —
      // fall back to a session-only seed.
      console.warn("[useBookingsBadgeStore] hydrate failed", err);
      set({ lastSeenAt: Date.now(), isHydrated: true });
    }
  },

  markSeen: () => {
    const now = Date.now();
    set({ lastSeenAt: now });
    SecureStore.setItemAsync(STORAGE_KEY, String(now)).catch((err) => {
      console.warn("[useBookingsBadgeStore] markSeen persist failed", err);
    });
  },
}));
