/**
 * geocodeAddress
 *
 * Forward-geocodes a postal address to {latitude, longitude} using
 * expo-location. Used as a fallback for shops whose Convex record is
 * missing lat/lng — without it, the map renders at (0, 0) and
 * client-side distance math returns thousands of miles.
 *
 * Caches results in-memory for the session and dedupes concurrent
 * lookups for the same address.
 */

import * as Location from "expo-location";

export interface Coords {
  latitude: number;
  longitude: number;
}

const cache = new Map<string, Coords | null>();
const inflight = new Map<string, Promise<Coords | null>>();

function normalize(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function geocodeAddress(address: string): Promise<Coords | null> {
  const key = normalize(address);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const results = await Location.geocodeAsync(address);
      const first = results[0];
      const coords: Coords | null = first
        ? { latitude: first.latitude, longitude: first.longitude }
        : null;
      cache.set(key, coords);
      return coords;
    } catch {
      cache.set(key, null);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
