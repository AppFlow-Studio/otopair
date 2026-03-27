/**
 * Vehicle Image Fetcher
 *
 * Fetches vehicle images from the VehicleDatabases.com API.
 * Supports VIN-based lookups (preferred) and Year/Make/Model fallback.
 * Prefers color renders (no white background) over exterior images.
 * When a specific color is provided, matches that color first.
 *
 * Docs: https://vehicledatabases.com/vehicle-image-api
 */

import { useEffect, useState } from "react";

const BASE_URL = "https://api.vehicledatabases.com/vehicle-media/v2";
const API_KEY = process.env.EXPO_PUBLIC_VEHICLE_DB_API_KEY ?? "";

/**
 * Fetch a vehicle image URL, optionally matching the user's selected color.
 *
 * @param make  - Vehicle manufacturer (e.g. "Toyota")
 * @param model - Model name (e.g. "Corolla")
 * @param year  - Optional model year (e.g. 2024)
 * @param vin   - Optional 17-char VIN (used for more accurate lookup)
 * @param color - Optional color id (e.g. "black", "midnight-silver")
 * @returns     - Image URL string, or null if not found
 */
export async function fetchVehicleImageUrl(
  make: string,
  model: string,
  year?: number,
  vin?: string,
  color?: string
): Promise<string | null> {
  try {
    const normalizedVin = (vin ?? "").toUpperCase().trim();
    const makes = normalizeMakes(make);

    // Try VIN first, then each make variant with YMM
    const urls: string[] = normalizedVin.length === 17
      ? [`${BASE_URL}/${normalizedVin}`, ...makes.map((m) => `${BASE_URL}/${year}/${encodeURIComponent(m)}/${encodeURIComponent(model)}`)]
      : makes.map((m) => `${BASE_URL}/${year}/${encodeURIComponent(m)}/${encodeURIComponent(model)}`);

    for (const url of urls) {
      const response = await fetch(url, { headers: { "x-authkey": API_KEY } });
      if (!response.ok) continue;

      const json = await response.json();
      if (json.status !== "success") continue;

      // Color images have no white background — always preferred
      const colorImages: string[] = json.data?.images?.colors ?? [];

      // 1. Try color-specific match if user specified a color
      if (color) {
        const colorMatch = findColorImage(colorImages, color);
        if (colorMatch) return colorMatch;
      }

      // 2. Prefer any color image (no white background)
      if (colorImages.length > 0) return colorImages[0];

      // 3. Fall back to exterior (white background) only if no color images
      const exterior: string[] = json.data?.images?.exterior ?? [];
      const evoxFront = exterior.find(
        (u) => u.includes("3231303031") || u.includes("6130313031")
      );
      const isHashNaming = !exterior.some((u) => /ext-\d{10}\.jpg$/.test(u));
      const picked = evoxFront ?? ((isHashNaming && exterior[3]) || exterior[0]) ?? null;
      return picked;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Match a user-selected color id (e.g. "black") to an API color image URL
 * (e.g. ".../deep-black-pearl.jpg") using keyword matching.
 */
function findColorImage(colorUrls: string[], userColor: string): string | null {
  if (!userColor || !colorUrls.length) return null;

  const keywords = userColor.toLowerCase().split(/[-_\s]+/);

  // Try matching ALL keywords first (most specific, e.g. "midnight-silver" → both must match)
  const allMatch = colorUrls.find((url) => {
    const filename = url.split("/").pop()?.toLowerCase() ?? "";
    return keywords.every((kw) => filename.includes(kw));
  });
  if (allMatch) return allMatch;

  // Fall back to matching the primary keyword (e.g. "black" in "deep-black-pearl")
  const primary = keywords[0];
  return colorUrls.find((url) => {
    const filename = url.split("/").pop()?.toLowerCase() ?? "";
    return filename.includes(primary);
  }) ?? null;
}

/** Returns make name variants to try (handles "Volkswagen" ↔ "VW", etc.) */
function normalizeMakes(make: string): string[] {
  const m = make.trim();
  const lower = m.toLowerCase();
  if (lower === "volkswagen") return ["Volkswagen", "VW"];
  if (lower === "vw") return ["VW", "Volkswagen"];
  return [m];
}

/**
 * React hook that fetches and returns a vehicle image URL.
 * Returns null while loading or if no image is found.
 */
export function useVehicleImage(
  make: string,
  model: string,
  year?: number,
  vin?: string,
  color?: string
): string | null {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!make || !model) return;
    setImageUrl(null);
    fetchVehicleImageUrl(make, model, year, vin, color).then(setImageUrl);
  }, [make, model, year, vin, color]);

  return imageUrl;
}
