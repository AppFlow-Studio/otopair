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

import { useEffect, useRef, useState } from "react";

const BASE_URL = "https://api.vehicledatabases.com/vehicle-images";
const TRIM_OPTIONS_URL = "https://api.vehicledatabases.com/ymm-specs/options/v3/trim";
const API_KEY = process.env.EXPO_PUBLIC_VEHICLE_DB_API_KEY ?? "";

/**
 * Fetch VDB's canonical trim strings for a year/make/model.
 *
 * Returns strings like "xDrive iPerformance 4dr All-Wheel Drive Sedan
 * Automatic" — these are the exact strings VDB's vehicle-images YMMT
 * endpoint expects in the URL path. NHTSA's trim catalog gives us
 * marketing names (e.g. "xDrive40i") which VDB rejects with 400. Use
 * this for the trim picker so the user is always picking a string
 * VDB recognizes.
 *
 * Empty array means VDB has no record for that YMM combination.
 */
export async function fetchVdbTrimsForYmm(
  year: number,
  make: string,
  model: string,
): Promise<string[]> {
  try {
    const makes = normalizeMakes(make);
    for (const m of makes) {
      const url = `${TRIM_OPTIONS_URL}/${year}/${encodeURIComponent(m)}/${encodeURIComponent(model)}`;
      console.log("[vdbTrims] GET", url);
      const response = await fetch(url, { headers: { "x-AuthKey": API_KEY } });
      console.log("[vdbTrims] status", response.status);
      if (!response.ok) {
        try {
          const errBody = await response.text();
          console.log("[vdbTrims] err body:", errBody.slice(0, 500));
        } catch {}
        continue;
      }
      const json = await response.json();
      console.log("[vdbTrims] raw:", JSON.stringify(json).slice(0, 500));
      if (json.status !== "success" || !Array.isArray(json.data)) continue;
      const trims = json.data.filter((t: unknown): t is string => typeof t === "string");
      if (trims.length > 0) return trims;
    }
    return [];
  } catch {
    return [];
  }
}

// ============================================================================
// VDB MODEL DISCOVERY — handles family/catalog naming mismatch
// ============================================================================

/**
 * Build a deduplicated, prioritized list of candidate model strings to
 * probe against VDB's catalog when NHTSA's model (family name, e.g.
 * "5 Series") doesn't match VDB's catalog (which indexes by specific
 * designation, e.g. "530").
 *
 * Candidates in priority order:
 *  1. NHTSA's model verbatim — works for the common case
 *  2. NHTSA's series verbatim — for BMW often "530i" / "530"
 *  3. Numeric/M/RS prefix extracted from series ("530" from "530i xDrive")
 *  4. Numeric/M/RS prefix extracted from trim ("530" from "530 Sedan")
 *
 * Blanks are skipped; case-insensitive dedup.
 */
export function extractModelCandidates(args: {
  /** NHTSA's raw Model field — often the specific designation
   *  (e.g. "530i") that VDB's catalog uses. Highest priority when
   *  present. */
  nhtsaModel?: string | null;
  /** Merged model (from VDB+NHTSA+AI norm). May be a family name
   *  ("5 Series") that doesn't match VDB's catalog. */
  model?: string | null;
  /** NHTSA's raw Series field (e.g. "5-Series"). */
  series?: string | null;
  /** NHTSA's raw Trim field. */
  nhtsaTrim?: string | null;
  /** Merged trim string — often contains the specific designation
   *  even when `model` doesn't (e.g. trim = "530i xDrive" while
   *  model = "5 Series"). Critical when the NHTSA raw fields are
   *  unavailable. */
  trim?: string | null;
}): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const s = (raw ?? "").trim();
    if (!s) return;
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(s);
  };

  add(args.nhtsaModel);
  add(args.model);
  add(args.series);
  // Extract leading model designation: numeric ("530"), M-series
  // ("M5"), or Audi RS ("RS5"). Captures the part before the first
  // suffix letter cluster (e.g. "530i" → "530", "M5 Comp" → "M5").
  const modelTokenRegex = /^(M\d+|RS\d+|[A-Z]?\d+)/i;
  const tryExtract = (raw: string | null | undefined) => {
    const s = (raw ?? "").trim();
    if (!s) return;
    const match = s.match(modelTokenRegex);
    if (match) add(match[1]);
  };
  // Extract from every text field we have. `add`'s dedupe handles
  // overlap when multiple sources resolve to the same token.
  tryExtract(args.nhtsaModel);
  tryExtract(args.series);
  tryExtract(args.nhtsaTrim);
  tryExtract(args.trim);

  return candidates;
}

// Module-level cache keyed by `${year}|${make-normalized}|${candidate}`.
// Stores `null` when a probe definitively returned no trims so we
// don't re-fetch known-empty combos within the session.
const VDB_MODEL_DISCOVERY_CACHE = new Map<string, { model: string; trims: string[] } | null>();

function discoveryCacheKey(year: number, make: string, candidate: string): string {
  return `${year}|${make.toLowerCase().trim()}|${candidate.toLowerCase().trim()}`;
}

// Tracks once-per-session whether the VDB account has access to the
// `ymm-specs` API. After the first 401, subsequent discovery calls
// skip the ymm-specs probe and go straight to direct vehicle-images
// probes, saving the failed round-trip and the noise in the logs.
let YMM_SPECS_UNAVAILABLE = false;

/**
 * Probe `fetchVdbTrimsForYmm` once and remember whether the API is
 * reachable. Returns `{ trims, accessible }` so the caller can
 * distinguish "no records" from "no access".
 */
async function probeYmmSpecsTrims(
  year: number,
  make: string,
  model: string,
): Promise<{ trims: string[]; accessible: boolean }> {
  if (YMM_SPECS_UNAVAILABLE) {
    return { trims: [], accessible: false };
  }
  try {
    const url = `${TRIM_OPTIONS_URL}/${year}/${encodeURIComponent(make)}/${encodeURIComponent(model)}`;
    const response = await fetch(url, { headers: { "x-AuthKey": API_KEY } });
    if (response.status === 401) {
      if (!YMM_SPECS_UNAVAILABLE) {
        console.warn(
          "[vdbDiscovery] ymm-specs API returned 401 — account doesn't have access. " +
            "Falling back to direct vehicle-images probes (less reliable). " +
            "Ask VDB to add the ymm-specs/options/v3 package for robust model discovery.",
        );
        YMM_SPECS_UNAVAILABLE = true;
      }
      return { trims: [], accessible: false };
    }
    if (!response.ok) return { trims: [], accessible: true };
    const json = await response.json();
    if (json.status !== "success" || !Array.isArray(json.data)) {
      return { trims: [], accessible: true };
    }
    const trims = json.data.filter((t: unknown): t is string => typeof t === "string");
    return { trims, accessible: true };
  } catch {
    return { trims: [], accessible: true };
  }
}

/**
 * Direct `vehicle-images` YMMT probe — falls back here when
 * `ymm-specs` is unavailable. Hits the full YMMT URL with a guess
 * trim and considers the probe a hit when VDB returns
 * `data.images.colors[]` non-empty.
 *
 * Returns the same shape as the ymm-specs path: a `trims: string[]`
 * with the trim that worked, so the caller can re-fetch colors
 * the same way.
 */
async function probeVehicleImagesYmmt(
  year: number,
  make: string,
  model: string,
  trims: string[],
): Promise<{ trims: string[] } | null> {
  for (const trim of trims) {
    if (!trim.trim()) continue;
    const url = `${BASE_URL}/${year}/${encodeURIComponent(make)}/${encodeURIComponent(model)}/${encodeURIComponent(trim)}`;
    console.log("[vdbDiscovery] direct probe", url);
    try {
      const response = await fetch(url, { headers: { "x-AuthKey": API_KEY } });
      if (!response.ok) continue;
      const json = await response.json();
      if (json.status !== "success") continue;
      const colorUrls: string[] = json.data?.images?.colors ?? [];
      const exteriorUrls: string[] = json.data?.images?.exterior ?? [];
      if (colorUrls.length > 0 || exteriorUrls.length > 0) {
        return { trims: [trim] };
      }
    } catch {
      // try next trim
    }
  }
  return null;
}

/**
 * Try each candidate model string against VDB's catalog. First tries
 * the `ymm-specs` trim-options endpoint (cleanest); when that's
 * unavailable (401) or returns empty, falls back to direct
 * `vehicle-images` YMMT probes with the caller's trim candidates.
 *
 * Returns the first candidate that yields data. `null` when nothing
 * matches.
 */
export async function discoverVdbModel(args: {
  year: number;
  make: string;
  candidates: string[];
  /** Trim strings to use for direct vehicle-images probes when
   *  ymm-specs is unavailable. Caller passes everything it has —
   *  NHTSA raw trim, merged trim, etc. */
  probeTrims?: string[];
}): Promise<{ model: string; trims: string[] } | null> {
  const { year, make, candidates, probeTrims = [] } = args;
  // Dedup + drop blanks for direct probes.
  const seenTrims = new Set<string>();
  const cleanProbeTrims = probeTrims
    .map((t) => t.trim())
    .filter((t) => {
      if (!t) return false;
      const k = t.toLowerCase();
      if (seenTrims.has(k)) return false;
      seenTrims.add(k);
      return true;
    });

  for (const candidate of candidates) {
    const key = discoveryCacheKey(year, make, candidate);
    if (VDB_MODEL_DISCOVERY_CACHE.has(key)) {
      const cached = VDB_MODEL_DISCOVERY_CACHE.get(key);
      if (cached) return cached;
      continue; // cached miss
    }

    // ── Path A: ymm-specs (preferred when accessible) ───────────────
    const { trims, accessible } = await probeYmmSpecsTrims(year, make, candidate);
    if (trims.length > 0) {
      const result = { model: candidate, trims };
      VDB_MODEL_DISCOVERY_CACHE.set(key, result);
      return result;
    }
    // ymm-specs returned non-empty access but no trims → genuine miss.
    if (accessible) {
      VDB_MODEL_DISCOVERY_CACHE.set(key, null);
      continue;
    }

    // ── Path B: direct vehicle-images probe (ymm-specs 401) ────────
    if (cleanProbeTrims.length === 0) {
      VDB_MODEL_DISCOVERY_CACHE.set(key, null);
      continue;
    }
    const direct = await probeVehicleImagesYmmt(
      year,
      make,
      candidate,
      cleanProbeTrims,
    );
    if (direct) {
      const result = { model: candidate, trims: direct.trims };
      VDB_MODEL_DISCOVERY_CACHE.set(key, result);
      return result;
    }
    VDB_MODEL_DISCOVERY_CACHE.set(key, null);
  }
  return null;
}

/**
 * React hook variant of `fetchVdbTrimsForYmm`. Returns the trim list
 * and a loading flag. Re-fetches when year/make/model change.
 */
export function useVdbTrims(
  year: number | undefined,
  make: string,
  model: string,
): { trims: string[]; isLoading: boolean } {
  const [trims, setTrims] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!year || !make || !model) {
      setTrims([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetchVdbTrimsForYmm(year, make, model).then((result) => {
      if (cancelled) return;
      setTrims(result);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [year, make, model]);

  return { trims, isLoading };
}

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
    console.log("[vehicleImage] inputs:", { make, model, year, vin, color, trim });
    const normalizedVin = (vin ?? "").toUpperCase().trim();
    const makes = normalizeMakes(make);

    // VDB only supports VIN and YMMT lookups, and YMMT requires the
    // verbose internal trim string (e.g. "Base 4dr Sedan Automatic")
    // which NHTSA doesn't expose — meaning manual-entry users have no
    // way to hit YMMT. We try YMMT anyway when the caller passes a
    // trim, since some flows (VIN-decoded vehicles) do have a usable
    // trim string.
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
      if (!response.ok) {
        try {
          const errBody = await response.text();
          console.log("[vehicleImage] err body:", errBody.slice(0, 500));
        } catch {}
        continue;
      }

      const json = await response.json();
      const exterior: string[] = json.data?.images?.exterior ?? [];
      const colorImages: string[] = json.data?.images?.colors ?? [];
      console.log("[vehicleImage] api status:", json.status, "exterior:", exterior.length, "colors:", colorImages.length);
      console.log("[vehicleImage] colors[] filenames:",
        colorImages.slice(0, 5).map((u) => u.split("/").pop()));
      console.log("[vehicleImage] exterior[] filenames:",
        exterior.slice(0, 5).map((u) => u.split("/").pop()));
      console.log("[vehicleImage] data.images keys:", Object.keys(json.data?.images ?? {}));
      console.log("[vehicleImage] raw data slice:", JSON.stringify(json.data ?? {}).slice(0, 1500));
      if (json.status !== "success") continue;

      // Validate the API returned the correct vehicle — VehicleDatabases
      // occasionally maps a VIN to the wrong make/model. If the response
      // make doesn't match what we expect, skip this result.
      //
      // Normalize separators so "Alfa_romeo" (VDB) and "ALFA ROMEO"
      // (NHTSA) compare equal — same logic as the YMMT validator in
      // `convex/vehicle_pipeline.ts`. Without this, multi-word makes
      // with underscores get falsely flagged as mismatched and we lose
      // the working VIN result.
      const normMake = (s: string) =>
        s.toLowerCase().replace(/[\s_-]+/g, " ").trim();
      const returnedMake = normMake(json.data?.make ?? "");
      const expectedMake = normMake(make);
      if (returnedMake && expectedMake && !returnedMake.includes(expectedMake) && !expectedMake.includes(returnedMake)) {
        console.warn("[vehicleImage] make mismatch — expected:", expectedMake, "got:", returnedMake, "skipping");
        continue;
      }

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
        console.log("[vehicleImage] color match for", color, "→", colorMatch ?? "(none)");
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
 *
 * Exported so the VDB-driven color picker
 * (`hooks/useVdbColorsForVin.ts`) can reverse-lookup a paint
 * filename to its family hex.
 */
export const COLOR_SYNONYMS: Record<string, string[]> = {
  black:             ["black", "phantom", "obsidian", "shadow", "onyx", "ebony", "raven"],
  "midnight-silver": ["midnight", "silver", "graphite", "platinum"],
  silver:            ["silver", "platinum", "graphite", "titanium", "mineral", "steel"],
  white:             ["white", "ivory", "pearl", "quartz", "atlas", "alpine", "snow", "cream", "frost"],
  gray:              ["gray", "grey", "graphite", "titanium", "mineral", "ash", "smoke", "cement", "slate", "carbon"],
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
 * React hook that fetches a vehicle image URL with input debouncing.
 *
 * Returns `{ url, isLoading }` so callers can crossfade between a
 * placeholder and the resolved image instead of just flipping on URL
 * presence. Debounce defaults to 400ms — short enough to feel real-time
 * as the user picks year/make/model/color, long enough to swallow
 * intermediate values when they change a selection twice in a row.
 *
 * Fires only when make + model + year are all present. The VDB API
 * returns generic/stale renders for partial inputs, so we'd rather
 * keep showing the placeholder until we have enough to look up.
 */
export function useVehicleImage(
  make: string,
  model: string,
  year?: number,
  vin?: string,
  color?: string,
  trim?: string,
  debounceMs: number = 400,
): { url: string | null; isLoading: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const hasVin = !!vin && vin.length === 17;
    const hasYmm = !!make && !!model && !!year;
    if (!hasVin && !hasYmm) {
      setUrl(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    let cancelled = false;
    timerRef.current = setTimeout(() => {
      fetchVehicleImageUrl(make, model, year, vin, color, trim)
        .then((result) => {
          if (cancelled) return;
          setUrl(result);
          setIsLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setUrl(null);
          setIsLoading(false);
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [make, model, year, vin, color, trim, debounceMs]);

  return { url, isLoading };
}

// ============================================================================
// VDB-driven dynamic color picker
// ============================================================================

/**
 * Swatch hex per color family id. Used by the dynamic picker when we
 * reverse-match a VDB marketing paint name (e.g. "Deep Black Pearl")
 * to a family and need a hex for the swatch dot.
 *
 * Keys MUST match `COLOR_SYNONYMS` keys.
 */
export const FAMILY_HEX: Record<string, string> = {
  black: "#1a1a1a",
  "midnight-silver": "#4A4A4A",
  silver: "#C0C0C0",
  white: "#FFFFFF",
  gray: "#808080",
  red: "#DC2626",
  blue: "#2563EB",
  green: "#16A34A",
  beige: "#D4B896",
  brown: "#8B4513",
};

/**
 * Reverse-match a stored color string (either a family id like
 * "red" or a VDB filename slug like "delmonico-red-pearl-coat")
 * back to a `COLOR_SYNONYMS` family id. Returns null when nothing
 * recognizable is present.
 *
 * Used by surfaces that key off color family (e.g. the cars-page
 * background gradient) so they keep working after the picker
 * switched to storing per-paint slugs instead of family ids.
 */
export function inferColorFamily(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const lower = stored.toLowerCase().trim();
  if (!lower) return null;
  // Exact family-id match first — handles vehicles saved before
  // the VDB picker swap (metadata.color = "red", "blue", etc.).
  if (lower in COLOR_SYNONYMS) return lower;
  // Otherwise fuzzy-match the slug against synonyms.
  for (const [id, synonyms] of Object.entries(COLOR_SYNONYMS)) {
    if (synonyms.some((kw) => lower.includes(kw))) return id;
  }
  return null;
}

/**
 * A picker option derived from one VDB `colors[]` image URL.
 *
 * - `id` is the URL's filename slug (lowercase, dash-separated). This
 *   is what gets stored as `vehicle.metadata.color` and what
 *   `findColorImage()` keyword-matches back to the same URL later.
 * - `label` is the title-cased marketing name (e.g. "Deep Black Pearl").
 * - `hex` is the closest family swatch color (or null if we couldn't
 *   infer one, in which case callers should skip the option).
 * - `imageUrl` is the original VDB render so callers can preview the
 *   actual car in that paint.
 */
export interface VdbColorOption {
  id: string;
  label: string;
  hex: string;
  imageUrl: string;
}

/**
 * Parse one VDB color image URL into a picker option, or null if the
 * filename doesn't contain any recognizable color word (e.g. it's an
 * encoded hash like "3231303031.jpg").
 */
export function parseVdbColorUrl(url: string): VdbColorOption | null {
  const filenameWithExt = url.split("/").pop() ?? "";
  const filename = filenameWithExt.replace(/\.[a-z0-9]+$/i, "");
  if (!filename) return null;

  const lower = filename.toLowerCase();

  // Reverse-lookup family by checking which synonym list matches.
  // First match wins — COLOR_SYNONYMS is ordered most-distinctive
  // first (black/silver before generic gray).
  let familyId: string | null = null;
  for (const [id, synonyms] of Object.entries(COLOR_SYNONYMS)) {
    if (synonyms.some((kw) => lower.includes(kw))) {
      familyId = id;
      break;
    }
  }

  // No family match → use a neutral gray swatch. Previously this
  // dropped the variant entirely, which lost otherwise-valid paints
  // whose marketing names used uncommon words (e.g. Acura's "Modern
  // Steel Metallic"). The live car-image preview shows the actual
  // paint when picked, so the swatch hex is just a hint — it's
  // fine for it to be approximate.
  const hex = (familyId && FAMILY_HEX[familyId]) || "#9CA3AF";

  // Title-case the slug for display. "deep-black-pearl" → "Deep Black Pearl".
  const label = filename
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  // Slug as id — `findColorImage()`'s keyword match still recovers
  // this URL later when we look up the rendered car image for the
  // user's pick.
  const id = lower.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return { id, label, hex, imageUrl: url };
}

/**
 * Fetch the list of paint variants VDB has for a vehicle.
 *
 * Tries VIN first (most reliable), falls back to YMMT when the
 * caller provides year+make+model+trim. Returns an empty array
 * if VDB has no record OR all returned filenames are unrecognizable.
 *
 * Deduplicates by display label so we don't show "Deep Black Pearl"
 * twice if VDB returns two angles of the same paint.
 */
/**
 * Build an ordered list of `(model, trim)` candidates to try against
 * VDB's `vehicle-images` YMMT endpoint. Built from the raw
 * `advanced-vin-decode` fields, which carry the model + style in a
 * different shape than the catalog expects:
 *   decode:  model="530i", trim_and_style="xDrive Sedan ..."
 *   catalog: model="530",  trim="i-xDrive Sedan ..."
 *
 * Each combo is one probe — first 200 wins. Order matters: verbatim
 * first (fast hit for simple cases like Honda Civic), then
 * progressively more aggressive transformations.
 */
export function buildVdbYmmtCombos(args: {
  model?: string | null;
  style?: string | null;
  trimAndStyle?: string | null;
}): Array<{ model: string; trim: string }> {
  const model = (args.model ?? "").trim();
  const style = (args.style ?? "").trim();
  const trimAndStyle = (args.trimAndStyle ?? "").trim();
  if (!model) return [];

  const combos: Array<{ model: string; trim: string }> = [];
  const seen = new Set<string>();
  const add = (m: string, t: string) => {
    if (!m || !t) return;
    const key = `${m.toLowerCase()}|${t.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    combos.push({ model: m, trim: t });
  };

  // Split trailing letters (e.g. "530i" → root "530", suffix "i").
  // For models with no trailing letters (e.g. "Camry"), root === model
  // and suffix === "".
  const match = model.match(/^(.*?)([A-Za-z]+)$/);
  const root = match && /\d/.test(match[1]) ? match[1] : model;
  const suffix = match && /\d/.test(match[1]) ? match[2] : "";

  // 1. Verbatim — works for catalogs that match the decode shape.
  if (trimAndStyle) add(model, trimAndStyle);
  // 2. Verbatim model + style-only trim — some catalogs drop the
  //    trim prefix.
  if (style) add(model, style);
  // 3. Strip suffix + prefix it onto trim — the BMW pattern.
  //    "530i" + "xDrive Sedan ..." → ("530", "i-xDrive Sedan ...")
  if (suffix && trimAndStyle) add(root, `${suffix}-${trimAndStyle}`);
  // 4. Strip suffix + verbatim trim — works for some German makes.
  if (suffix && trimAndStyle) add(root, trimAndStyle);
  // 5. Strip suffix + style only.
  if (suffix && style) add(root, style);

  return combos;
}

export async function fetchVdbColorsForVehicle(args: {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  /** NHTSA's raw `Model` field — often the specific designation
   *  ("530i") that VDB's catalog uses, even when our merged `model`
   *  has been overwritten to a family name like "5 Series". */
  nhtsaModel?: string;
  /** NHTSA's raw `Series` field. */
  nhtsaSeries?: string;
  /** NHTSA's raw `Trim` field. */
  nhtsaTrim?: string;
  /** VDB advanced-vin-decode model — used to build the YMMT combo
   *  matrix when the VIN URL has no record. */
  vdbDecodedModel?: string;
  vdbDecodedStyle?: string;
  vdbDecodedTrimAndStyle?: string;
}): Promise<VdbColorOption[]> {
  const {
    vin, year, make, model, trim,
    nhtsaModel, nhtsaSeries, nhtsaTrim,
    vdbDecodedModel, vdbDecodedStyle, vdbDecodedTrimAndStyle,
  } = args;
  console.log("[vdbColors] inputs:", { vin, year, make, model, trim, nhtsaModel, nhtsaSeries, nhtsaTrim, vdbDecodedModel, vdbDecodedStyle, vdbDecodedTrimAndStyle });
  const normalizedVin = (vin ?? "").toUpperCase().trim();
  const makes = make ? normalizeMakes(make) : [];

  const ymmtUrls =
    trim && year && make && model
      ? makes.map(
          (m) =>
            `${BASE_URL}/${year}/${encodeURIComponent(m)}/${encodeURIComponent(model)}/${encodeURIComponent(trim)}`,
        )
      : [];
  const urls: string[] =
    normalizedVin.length === 17
      ? [`${BASE_URL}/${normalizedVin}`, ...ymmtUrls]
      : ymmtUrls;

  // No initial URLs AND no discovery inputs → nothing to try.
  if (urls.length === 0 && !(year && make)) return [];

  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { "x-AuthKey": API_KEY } });
      if (!response.ok) continue;
      const json = await response.json();
      if (json.status !== "success") continue;

      // Same make-mismatch guard as fetchVehicleImageUrl — VDB
      // occasionally maps a VIN to the wrong make. Normalize
      // separators so "Alfa_romeo" matches "ALFA ROMEO".
      if (make) {
        const normMake = (s: string) =>
          s.toLowerCase().replace(/[\s_-]+/g, " ").trim();
        const returnedMake = normMake(json.data?.make ?? "");
        const expectedMake = normMake(make);
        if (
          returnedMake &&
          expectedMake &&
          !returnedMake.includes(expectedMake) &&
          !expectedMake.includes(returnedMake)
        ) {
          continue;
        }
      }

      const colorUrls: string[] = json.data?.images?.colors ?? [];
      if (colorUrls.length === 0) continue;

      const seenLabels = new Set<string>();
      const options: VdbColorOption[] = [];
      for (const colorUrl of colorUrls) {
        const parsed = parseVdbColorUrl(colorUrl);
        if (!parsed) continue;
        if (seenLabels.has(parsed.label)) continue;
        seenLabels.add(parsed.label);
        options.push(parsed);
      }
      if (options.length > 0) return options;
    } catch {
      // Try the next URL.
    }
  }

  // ── Discovery fallback A: VDB-decode combo matrix ─────────────────
  // The most direct path. `advanced-vin-decode` (which we DO have
  // access to, server-side) returns the model + style separately.
  // We construct candidate (model, trim) pairs and probe
  // `vehicle-images` directly until one returns 200. For BMW:
  //   decode: model="530i", trim_and_style="xDrive Sedan ..."
  //   catalog: model="530", trim="i-xDrive Sedan ..."
  // The combo matrix's "strip suffix + prefix to trim" entry
  // produces the working URL.
  if (year && make && vdbDecodedModel) {
    const combos = buildVdbYmmtCombos({
      model: vdbDecodedModel,
      style: vdbDecodedStyle,
      trimAndStyle: vdbDecodedTrimAndStyle,
    });
    console.log("[vdbColors] combo matrix:", combos);
    for (const combo of combos) {
      const url = `${BASE_URL}/${year}/${encodeURIComponent(make)}/${encodeURIComponent(combo.model)}/${encodeURIComponent(combo.trim)}`;
      console.log("[vdbColors] combo probe", url);
      try {
        const response = await fetch(url, { headers: { "x-AuthKey": API_KEY } });
        if (!response.ok) continue;
        const json = await response.json();
        if (json.status !== "success") continue;
        const colorUrls: string[] = json.data?.images?.colors ?? [];
        if (colorUrls.length === 0) continue;
        const seenLabels = new Set<string>();
        const options: VdbColorOption[] = [];
        for (const colorUrl of colorUrls) {
          const parsed = parseVdbColorUrl(colorUrl);
          if (!parsed) continue;
          if (seenLabels.has(parsed.label)) continue;
          seenLabels.add(parsed.label);
          options.push(parsed);
        }
        if (options.length > 0) {
          console.log(`[vdbColors] combo HIT → model="${combo.model}", trim="${combo.trim}"`);
          return options;
        }
      } catch {
        // try next combo
      }
    }
    console.log("[vdbColors] combo matrix exhausted — falling through to extractModelCandidates");
  }

  // ── Discovery fallback B: extractModelCandidates (ymm-specs path) ──
  // Kept as a secondary fallback. Useful when the user has the
  // ymm-specs API package OR for vehicles where we have NHTSA fields
  // but no VDB decode (unlikely combo).
  if (year && make) {
    const candidates = extractModelCandidates({
      nhtsaModel,
      model,
      series: nhtsaSeries,
      // Pass BOTH the NHTSA raw trim AND the merged trim. The merged
      // trim often contains the specific model designation ("530i
      // xDrive") even when the NHTSA raw fields are empty (which can
      // happen when the Convex backend hasn't deployed the new
      // return fields yet). Regex strips to "530" — the catalog key
      // VDB indexes BMWs by.
      nhtsaTrim,
      trim,
    });
    // Skip the original `model` since we already tried it.
    const discoveryCandidates = candidates.filter(
      (c) => c.toLowerCase() !== (model ?? "").toLowerCase(),
    );
    console.log("[vdbColors] discovery candidates:", discoveryCandidates);
    if (discoveryCandidates.length > 0) {
      const discovered = await discoverVdbModel({
        year,
        make,
        candidates: discoveryCandidates,
        // For accounts without ymm-specs access, discoverVdbModel
        // falls back to direct vehicle-images probes. Give it
        // every trim string we have so it has a chance to match
        // VDB's expected format.
        probeTrims: [trim ?? "", nhtsaTrim ?? ""].filter((t) => !!t),
      });
      if (discovered) {
        console.log(
          `[vdbColors] discovered VDB model "${discovered.model}" for ${year} ${make} (caller model "${model}"). First trim: "${discovered.trims[0]}"`,
        );
        // Re-enter the same fetch path with the discovered model +
        // its first trim. Recursion is shallow (won't re-discover —
        // the discovered candidate becomes the new `model`, won't be
        // re-filtered out next time).
        return fetchVdbColorsForVehicle({
          ...args,
          model: discovered.model,
          trim: discovered.trims[0],
        });
      } else {
        console.log("[vdbColors] discovery exhausted — no candidate matched VDB catalog");
      }
    }
  }

  return [];
}

// Module-level cache so the picker doesn't re-fetch on every render
// or when navigating back to the screen. Key is VIN (preferred) or
// year|make|model|trim. Survives across screens within a session.
const COLORS_CACHE = new Map<string, VdbColorOption[]>();

function cacheKey(args: {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
}): string {
  const vin = (args.vin ?? "").toUpperCase().trim();
  if (vin.length === 17) return `vin:${vin}`;
  return `ymmt:${args.year ?? ""}|${(args.make ?? "").toLowerCase()}|${(args.model ?? "").toLowerCase()}|${(args.trim ?? "").toLowerCase()}`;
}

/**
 * React hook that returns the VDB color options for a vehicle.
 *
 * - `colors` is the parsed picker list. Empty until the fetch resolves.
 * - `isLoading` is true while the request is in flight.
 * - `hasVdbData` is true once a fetch returns at least one usable
 *   option. Callers should fall back to their static palette when
 *   this stays false.
 */
export function useVdbColorsForVin(args: {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  /** NHTSA's raw `Model` field — highest-priority discovery candidate.
   *  For BMW VINs NHTSA often returns "530i" directly while merged
   *  `model` is "5 Series" (overwritten by VDB or AI norm). */
  nhtsaModel?: string;
  /** NHTSA's raw `Series` field. */
  nhtsaSeries?: string;
  /** NHTSA's raw `Trim` field. */
  nhtsaTrim?: string;
  /** VDB advanced-vin-decode fields — used to build the YMMT combo
   *  matrix for `vehicle-images` direct probes. */
  vdbDecodedModel?: string;
  vdbDecodedStyle?: string;
  vdbDecodedTrimAndStyle?: string;
}): { colors: VdbColorOption[]; isLoading: boolean; hasVdbData: boolean } {
  const key = cacheKey(args);
  const cached = COLORS_CACHE.get(key);

  const [colors, setColors] = useState<VdbColorOption[]>(cached ?? []);
  const [isLoading, setIsLoading] = useState(!cached);

  useEffect(() => {
    const k = cacheKey(args);
    const c = COLORS_CACHE.get(k);
    if (c) {
      setColors(c);
      setIsLoading(false);
      return;
    }

    // Skip fetch when we have nothing useful to look up with. Note:
    // even without explicit trim, we still fetch when year+make is
    // present because discovery can probe the catalog and supply its
    // own trim.
    const vin = (args.vin ?? "").toUpperCase().trim();
    const hasVin = vin.length === 17;
    const hasYmmt =
      !!args.year && !!args.make && !!args.model;
    if (!hasVin && !hasYmmt) {
      setColors([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetchVdbColorsForVehicle(args)
      .then((result) => {
        if (cancelled) return;
        COLORS_CACHE.set(k, result);
        setColors(result);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setColors([]);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.vin, args.year, args.make, args.model, args.trim, args.nhtsaModel, args.nhtsaSeries, args.nhtsaTrim, args.vdbDecodedModel, args.vdbDecodedStyle, args.vdbDecodedTrimAndStyle]);

  return { colors, isLoading, hasVdbData: colors.length > 0 };
}
