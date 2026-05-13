/**
 * Vehicle Image Fetcher
 *
 * Fetches transparent-background vehicle images from the
 * VehicleDatabases.com "Vehicle Images" API.
 *
 * Endpoints (per https://vehicledatabases.com/vehicle-images-docs/):
 *   GET /vehicle-images/{vin}
 *   GET /vehicle-images/{year}/{make}/{model}/{trim}
 *
 * Coverage: 2011–2026.
 *
 * VIN is the most reliable lookup. The YMMT path *requires trim*
 * (the prior YMM endpoint is a different, white-background API). If a
 * caller doesn't have a trim, only VIN lookups will resolve.
 *
 * Response shape (both endpoints):
 *   { status, data: { year, make, model, trim, images: { exterior[], colors[] } } }
 *
 * Both `exterior` and `colors` are transparent-bg renders. We prefer
 * `colors[]` when the user has selected a paint color so the image
 * matches their car; otherwise we fall back to `exterior[]`.
 */

import { useEffect, useState } from "react";

const BASE_URL = "https://api.vehicledatabases.com/vehicle-images";
const API_KEY = process.env.EXPO_PUBLIC_VEHICLE_DB_API_KEY ?? "";

/**
 * Fetch a vehicle image URL, optionally matching the user's selected color.
 *
 * @param make  - Vehicle manufacturer (e.g. "Toyota")
 * @param model - Model name (e.g. "Corolla")
 * @param year  - Optional model year (e.g. 2024)
 * @param vin   - Optional 17-char VIN (preferred — most reliable)
 * @param color - Optional color id (e.g. "black", "midnight-silver")
 * @param trim  - Optional trim (required for YMMT lookups, e.g. "Base 4dr Sedan Automatic")
 * @returns     - Image URL string, or null if not found
 */
export async function fetchVehicleImageUrl(
  make: string,
  model: string,
  year?: number,
  vin?: string,
  color?: string,
  trim?: string,
): Promise<string | null> {
  try {
    const normalizedVin = (vin ?? "").toUpperCase().trim();
    const makes = normalizeMakes(make);

    // Try VIN first, then each make variant with full YMMT (only if trim
    // is available — the API requires it for the YMMT path).
    const ymmtUrls =
      trim && year
        ? makes.map(
            (m) =>
              `${BASE_URL}/${year}/${encodeURIComponent(m)}/${encodeURIComponent(model)}/${encodeURIComponent(trim)}`,
          )
        : [];
    const urls: string[] =
      normalizedVin.length === 17
        ? [`${BASE_URL}/${normalizedVin}`, ...ymmtUrls]
        : ymmtUrls;

    for (const url of urls) {
      console.log("[vehicleImage] GET", url);
      // Header casing matches the working convex caller in
      // `convex/lib/vehicleDatabases.ts`. The API gateway has been
      // observed to 403 on lowercased "x-authkey" despite RFC saying
      // header names are case-insensitive — keep this capitalized.
      const response = await fetch(url, { headers: { "x-AuthKey": API_KEY } });
      console.log("[vehicleImage] status", response.status, "ok?", response.ok);
      if (!response.ok) continue;

      const json = await response.json();
      const exterior: string[] = json.data?.images?.exterior ?? [];
      const colorImages: string[] = json.data?.images?.colors ?? [];
      console.log("[vehicleImage] api status:", json.status, "exterior:", exterior.length, "colors:", colorImages.length);
      if (json.status !== "success") continue;

      // EVOX front 3/4 angle preference for any exterior pick.
      const pickEvoxFront = () => {
        const evoxFront = exterior.find(
          (u) => u.includes("3231303031") || u.includes("6130313031"),
        );
        return evoxFront ?? exterior[0] ?? null;
      };

      // 1. Color-specific match if user picked a paint color
      if (color) {
        const colorMatch = findColorImage(colorImages, color);
        if (colorMatch) return colorMatch;
        // No color-matched image found. Prefer a neutral exterior render
        // over a wrong-colored one — landing on the cars page showing a
        // red car when the user picked blue is worse than showing a
        // generic transparent render where the background gradient
        // carries the color choice. Falls through to colorImages[0]
        // only if no exterior is available.
        const neutral = pickEvoxFront();
        if (neutral) return neutral;
      }

      // 2. Any color render (transparent bg) — only when user did NOT
      // pick a color, so any paint is fine.
      if (colorImages.length > 0) return colorImages[0];

      // 3. Fall back to exterior gallery (also transparent bg on this endpoint).
      const picked = pickEvoxFront();
      if (picked) return picked;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Marketing-name synonyms for each user-pickable color id. The
 * VehicleDatabases color URLs are named after manufacturer marketing
 * paint names (e.g. "Storm Sea Blue", "Quartz White", "Phantom Black
 * Pearl"), not generic color words, so we need a list of strings that
 * commonly appear in those names. Keys are color ids from the
 * add-vehicle picker; values are lowercase substrings to search the
 * URL's last path segment for.
 */
const COLOR_SYNONYMS: Record<string, string[]> = {
  black:             ["black", "phantom", "obsidian", "shadow", "onyx", "ebony", "raven"],
  "midnight-silver": ["midnight", "silver", "graphite", "platinum"],
  silver:            ["silver", "platinum", "graphite", "titanium", "mineral"],
  white:             ["white", "ivory", "pearl", "quartz", "atlas", "alpine", "snow", "cream"],
  gray:              ["gray", "grey", "graphite", "titanium", "mineral", "ash", "smoke", "cement"],
  red:               ["red", "crimson", "ruby", "scarlet", "garnet", "rosso", "carmine", "cherry"],
  blue:              ["blue", "navy", "ocean", "azure", "sapphire", "indigo", "marine", "atlas", "storm", "sea", "abyss", "denim", "cobalt"],
  green:             ["green", "emerald", "jade", "forest", "moss", "olive", "lime", "british"],
  beige:             ["beige", "sand", "tan", "khaki", "champagne", "wheat", "almond"],
  brown:             ["brown", "espresso", "cocoa", "mahogany", "walnut", "bronze", "copper", "russet"],
};

/**
 * Match a user-selected color id (e.g. "black") to an API color image URL
 * (e.g. ".../deep-black-pearl.jpg") using keyword + synonym matching.
 */
function findColorImage(colorUrls: string[], userColor: string): string | null {
  if (!userColor || !colorUrls.length) return null;

  const keywords = userColor.toLowerCase().split(/[-_\s]+/);
  const synonyms = COLOR_SYNONYMS[userColor.toLowerCase()] ?? keywords;

  // Try matching ALL keywords first (most specific, e.g. "midnight-silver"
  // → both literal words must appear in the filename).
  const allMatch = colorUrls.find((url) => {
    const filename = url.split("/").pop()?.toLowerCase() ?? "";
    return keywords.every((kw) => filename.includes(kw));
  });
  if (allMatch) return allMatch;

  // Fall back to ANY synonym — covers marketing-name paint colors like
  // Hyundai's "Storm Sea Blue" (matches "storm" or "sea") or Honda's
  // "Phantom Black Pearl" (matches "phantom").
  return colorUrls.find((url) => {
    const filename = url.split("/").pop()?.toLowerCase() ?? "";
    return synonyms.some((kw) => filename.includes(kw));
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
  color?: string,
  trim?: string,
): string | null {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!make || !model) return;
    setImageUrl(null);
    fetchVehicleImageUrl(make, model, year, vin, color, trim).then(setImageUrl);
  }, [make, model, year, vin, color, trim]);

  return imageUrl;
}
