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
 * Coverage: images run 2011–2025. VDB's ymm-specs endpoints go further —
 * 2026 returns a full model and trim list — but `vehicle-images` has no
 * record for those years by YMMT or by VIN, verified 2026-09-03 against the
 * live API. So a 2026 car resolves a working trim picker and no photograph;
 * the review screen falls back to a body silhouette rather than a blank.
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

// ──────────────────────────────────────────────────────────────
// VDB request throttle — cold loads fire ~15+ requests (colors +
// variants + image fetches, each with multi-URL fallbacks). VDB throttles
// bursts with 429s, which previously broke the image and aggregation on
// BMW. A simple concurrency cap (3 in-flight) + per-endpoint cooldown
// (~10s on 429) keeps us under the rate limit and short-circuits the
// cascade when we hit it.
// ──────────────────────────────────────────────────────────────
const VDB_MAX_CONCURRENT = 3;
const VDB_COOLDOWN_MS = 10_000;

let vdbInFlight = 0;
const vdbWaitQueue: Array<() => void> = [];
const vdbCooldownUntil = new Map<string, number>();

function vdbCooldownKey(url: string): string {
  // Group ALL calls to the same endpoint type under one cooldown.
  // VDB's rate limit is global per-account, not per-model, so cooling
  // `/vehicle-images/2026/BMW/530i` separately from `/vehicle-images/
  // 2026/BMW/530` doesn't help — they share the same limit. Coalesce
  // to just the top-level endpoint: `/vehicle-images`, `/ymm-specs`, etc.
  return url.replace(/^https?:\/\/[^/]+/, "").split("/").slice(0, 2).join("/");
}

function markVdbCooldown(url: string): void {
  const key = vdbCooldownKey(url);
  vdbCooldownUntil.set(key, Date.now() + VDB_COOLDOWN_MS);
  console.warn(`[vdbThrottle] 429 — cooling down ${key} for ${VDB_COOLDOWN_MS / 1000}s`);
}

function isVdbCoolingDown(url: string): boolean {
  const until = vdbCooldownUntil.get(vdbCooldownKey(url));
  return !!until && Date.now() < until;
}

/**
 * Throttled wrapper around `fetch` for VDB requests. Caps concurrent
 * in-flight calls at VDB_MAX_CONCURRENT (queues the rest) and handles the
 * cooldown window (just hit 429 in the last 10s).
 *
 * `background` is what separates the two callers, and it matters more than it
 * looks. A cooldown short-circuit DROPS the request — no retry, nothing to
 * await — so the caller sees "VDB has no image for this car" when the truth is
 * "we asked too fast". That is fine for the all-trims prefetch, which is a
 * nice-to-have and can simply not happen. It is wrong for the image the driver
 * is looking at right now.
 *
 * Ahmad, 2026-09-04: every car stopped showing an image. The prefetch fires one
 * request per trim the moment the trim list lands — ten or more for a GLE —
 * which trips VDB's rate limit, and the resulting global 10s cooldown then
 * short-circuited the FOREGROUND request too. The prefetch was denying service
 * to the screen it exists to speed up.
 */
async function vdbFetch(
  url: string,
  init?: RequestInit,
  opts?: { background?: boolean },
): Promise<Response> {
  if (isVdbCoolingDown(url)) {
    // Background work gives up; it will be re-tried the next time the screen
    // mounts, and nothing is waiting on it.
    if (opts?.background) {
      return new Response(null, { status: 429, statusText: "vdb-cooldown" });
    }
    // Foreground waits the window out rather than reporting a false negative.
    const until = vdbCooldownUntil.get(vdbCooldownKey(url)) ?? 0;
    const waitMs = Math.max(0, until - Date.now());
    if (waitMs > 0) {
      console.warn(`[vdbThrottle] foreground request waiting ${waitMs}ms for cooldown`);
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    }
  }
  if (vdbInFlight >= VDB_MAX_CONCURRENT) {
    await new Promise<void>((resolve) => vdbWaitQueue.push(resolve));
  }
  vdbInFlight++;
  try {
    const response = await fetch(url, init);
    if (response.status === 429) markVdbCooldown(url);
    return response;
  } finally {
    vdbInFlight--;
    const next = vdbWaitQueue.shift();
    if (next) next();
  }
}

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
/**
 * Build model-name variants to try against VDB's catalog. VDB indexes by
 * the manufacturer's preferred model name, which doesn't always match the
 * family-style name we get from decode — e.g. "GLE-Class" → catalog uses
 * "GLE". Variants are deduplicated and probed in order until one returns
 * trims.
 */
function normalizeModels(model: string): string[] {
  const m = model.trim();
  if (!m) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  add(m);
  // Strip common family-suffix words: Mercedes "GLE-Class" → "GLE",
  // BMW "5 Series" → "5", plus body-type tails some makes append.
  add(m.replace(/[-\s]?(Class|Series|Wagon|Hatchback|Sedan|Coupe|Convertible)$/i, ""));
  // Hyphen ↔ space — different makes use different separators.
  add(m.replace(/-/g, " "));
  add(m.replace(/\s+/g, "-"));
  return out;
}

const MODEL_OPTIONS_URL = "https://api.vehicledatabases.com/ymm-specs/options/v3/model";

// Session cache for canonical model lists keyed by `${year}|${make}`.
// One fetch per (year, make) is plenty since the same combination is
// re-queried during retries.
const VDB_MODELS_CACHE = new Map<string, string[]>();

/**
 * Fetch VDB's canonical model names for a year/make from
 * `ymm-specs/options/v3/model`. Used as a universal backstop when our
 * candidate model strings (decode/NHTSA/heuristic-stripped) don't match
 * the catalog — we fuzzy-match the caller's model against this list to
 * find the right canonical name.
 *
 * Returns `[]` on any failure (incl. 401 — endpoint may need to be
 * enabled by VDB on the account, same as trim-options was).
 */
export async function fetchVdbModelsForYmm(
  year: number,
  make: string,
  opts?: { background?: boolean },
): Promise<string[]> {
  const cacheKey = `${year}|${make.toLowerCase().trim()}`;
  const cached = VDB_MODELS_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;
  try {
    const makes = normalizeMakes(make);
    for (const mk of makes) {
      const url = `${MODEL_OPTIONS_URL}/${year}/${encodeURIComponent(mk)}`;
      console.log("[vdbModels] GET", url);
      const response = await vdbFetch(url, { headers: { "x-AuthKey": API_KEY } }, opts);
      console.log("[vdbModels] status", response.status);
      if (response.status === 401) {
        console.warn(
          "[vdbModels] 401 — VDB account doesn't have access to " +
            "ymm-specs/options/v3/model. Ask VDB to enable it for the " +
            "universal trim-resolver backstop.",
        );
        VDB_MODELS_CACHE.set(cacheKey, []);
        return [];
      }
      if (!response.ok) continue;
      const json = await response.json();
      if (json.status !== "success" || !Array.isArray(json.data)) continue;
      const models = json.data.filter((m: unknown): m is string => typeof m === "string");
      if (models.length > 0) {
        VDB_MODELS_CACHE.set(cacheKey, models);
        return models;
      }
    }
    VDB_MODELS_CACHE.set(cacheKey, []);
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

/**
 * From VDB's canonical trim list, pick the entry that best matches the
 * vehicle's actual trim. Scores each canonical trim by how many tokens
 * of the target trim(s) it contains, e.g. decoded "3.0T Prestige" →
 * VDB's "3.0T Prestige quattro 4dr All-Wheel Drive Sedan 8sp Automatic".
 * Falls back to the first canonical trim when nothing overlaps, so the
 * image still resolves (same body, possibly a different sub-trim).
 */
export function pickBestVdbTrim(
  canonicalTrims: string[],
  targets: Array<string | undefined>,
): string | undefined {
  if (canonicalTrims.length === 0) return undefined;
  // Keep dotted tokens together ("3.0t") so engine sizes match.
  const tokenize = (s: string) =>
    s.toLowerCase().split(/[^a-z0-9.]+/).filter((t) => t.length > 0);
  const targetTokens = new Set(
    targets.filter((t): t is string => !!t).flatMap(tokenize),
  );
  if (targetTokens.size === 0) return canonicalTrims[0];

  let best = canonicalTrims[0];
  let bestScore = -1;
  for (const trim of canonicalTrims) {
    const score = tokenize(trim).filter((t) => targetTokens.has(t)).length;
    // Higher overlap wins; tie → prefer the shorter (simpler) trim.
    if (score > bestScore || (score === bestScore && trim.length < best.length)) {
      best = trim;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : canonicalTrims[0];
}

// Module-level cache keyed by `${year}|${make-normalized}|${candidate}`.
// Stores `null` when a probe definitively returned no trims so we
// don't re-fetch known-empty combos within the session.
const VDB_MODEL_DISCOVERY_CACHE = new Map<string, { model: string; trims: string[] } | null>();

function discoveryCacheKey(year: number, make: string, candidate: string): string {
  return `${year}|${make.toLowerCase().trim()}|${candidate.toLowerCase().trim()}`;
}

/**
 * VDB's verbose trim strings for one of OUR trim names, treating that name as
 * VDB's model.
 *
 * Cached because the image call needs it per trim and the prefetch fires one
 * per variant — without the cache a five-trim GLE would hit the options
 * endpoint five times on every re-render, and VDB rate-limits hard enough that
 * the existing code already carries a concurrency cap and a cooldown.
 */
const VDB_VERBOSE_TRIM_CACHE = new Map<string, VdbModelTrims | null>();

export interface VdbModelTrims {
  /** The name VDB actually catalogs this variant under. */
  model: string;
  /** Its verbose trim strings. */
  trims: string[];
}

/**
 * Candidate VDB model names for one of OUR trim names.
 *
 * The vocabularies disagree on where AMG goes. Car API and MarketCheck put it
 * last — "GLE 53 AMG", "GLE 63 AMG S" — and VDB puts it first, with no
 * variant suffix: "AMG GLE 53", "AMG GLE 63". Probing our spelling returns
 * nothing, the YMMT URLs never get built, and the image falls back to the VIN
 * — which is the base trim. That is why 350/450/580 switched correctly and
 * both AMGs showed the 350.
 */
function vdbModelCandidates(ourTrim: string): string[] {
  const raw = ourTrim.trim().replace(/\s+/g, " ");
  const out = [raw];
  const amg = /\bAMG\b/i;
  if (amg.test(raw)) {
    const withoutAmg = raw.replace(amg, "").replace(/\s+/g, " ").trim();
    const fronted = `AMG ${withoutAmg}`;
    out.push(fronted);
    // "AMG GLE 63 S" → "AMG GLE 63". VDB drops the single-letter variant
    // suffix; the S survives in the verbose trim string instead.
    const noSuffix = fronted.replace(/\s+[A-Za-z]$/, "");
    if (noSuffix !== fronted) out.push(noSuffix);
  }
  return out;
}

/**
 * Resolve one of OUR trim names to the VDB model that catalogs it, plus that
 * model's verbose trim strings.
 *
 * Cached — including negative results — because the image call needs this per
 * trim and the prefetch fires one per variant. Uncached, a five-trim GLE would
 * hit the options endpoint on every render, and VDB rate-limits hard enough
 * that this file already carries a concurrency cap and a cooldown.
 */
async function vdbVerboseTrimsFor(
  year: number,
  make: string,
  ourTrim: string,
  opts?: { background?: boolean },
): Promise<VdbModelTrims | null> {
  const key = `${year}|${make.toLowerCase()}|${ourTrim.toLowerCase()}`;
  if (VDB_VERBOSE_TRIM_CACHE.has(key)) return VDB_VERBOSE_TRIM_CACHE.get(key)!;
  // Match against VDB's model list rather than probing each spelling blind.
  // Blind probing cost up to three requests per trim, and the prefetch fires
  // one per variant — a five-trim GLE burst past VDB's three-concurrent cap,
  // earned a 429 and a ten-second cooldown, and every trim then fell back to
  // the VIN image. Which is the bug this was meant to fix.
  //
  // `fetchVdbModelsForYmm` is cached per (year, make), so this is one shared
  // request for the whole picker, then a local match.
  const catalog = await fetchVdbModelsForYmm(year, make, opts);
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  let resolvedModel: string | null = null;
  for (const candidate of vdbModelCandidates(ourTrim)) {
    const target = norm(candidate);
    const hit = catalog.find((m) => norm(m) === target);
    if (hit) { resolvedModel = hit; break; }
  }
  const found = resolvedModel
    ? { model: resolvedModel, trims: await probeYmmSpecsTrims(year, make, resolvedModel, opts) }
    : null;
  VDB_VERBOSE_TRIM_CACHE.set(key, found && found.trims.length ? found : null);
  return VDB_VERBOSE_TRIM_CACHE.get(key)!;
}

/**
 * Probe VDB's `ymm-specs/options/v3/trim` endpoint for the canonical
 * trim list for a year/make/model. Returns `[]` on any failure (non-200,
 * malformed body, network error) — callers treat "no trims" the same
 * regardless of cause.
 */
async function probeYmmSpecsTrims(
  year: number,
  make: string,
  model: string,
  opts?: { background?: boolean },
): Promise<string[]> {
  try {
    const url = `${TRIM_OPTIONS_URL}/${year}/${encodeURIComponent(make)}/${encodeURIComponent(model)}`;
    const response = await vdbFetch(url, { headers: { "x-AuthKey": API_KEY } }, opts);
    if (!response.ok) return [];
    const json = await response.json();
    if (json.status !== "success" || !Array.isArray(json.data)) return [];
    return json.data.filter((t: unknown): t is string => typeof t === "string");
  } catch {
    return [];
  }
}

/**
 * Try each candidate model string against VDB's `ymm-specs/options/v3/trim`
 * endpoint and return the first one that yields a canonical trim list.
 * Caches both hits and misses for the session.
 *
 * Returns `null` when no candidate matches.
 */
export async function discoverVdbModel(args: {
  year: number;
  make: string;
  candidates: string[];
}): Promise<{ model: string; trims: string[] } | null> {
  const { year, make, candidates } = args;

  for (const candidate of candidates) {
    const key = discoveryCacheKey(year, make, candidate);
    if (VDB_MODEL_DISCOVERY_CACHE.has(key)) {
      const cached = VDB_MODEL_DISCOVERY_CACHE.get(key);
      if (cached) return cached;
      continue; // cached miss
    }

    const trims = await probeYmmSpecsTrims(year, make, candidate);
    if (trims.length > 0) {
      const result = { model: candidate, trims };
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
/**
 * A user-selectable variant: a (model, trim) pair. Each picker row in
 * the trim sheet is one of these — picking one drives BOTH the trim
 * label AND the catalog model used for image/colors lookups. Critical
 * because some makes split engine variants into separate top-level
 * models (Mercedes: `GLE 350`, `GLE 450`, `GLE 580` each have one trim).
 */
export type VdbVariant = { model: string; trim: string };

/**
 * Aggregate trims across every catalog model whose name shares a token
 * with the family hint. Handles VDB's per-make data split — Mercedes
 * GLE-Class has no family-level model, just `GLE 350` / `GLE 450` /
 * `GLE 580` etc. Each VdbVariant carries its source model so downstream
 * image/colors lookups use the right URL.
 *
 * Returns `[]` when the model-list endpoint is unavailable (logged 401)
 * or no model in the catalog matches the hint.
 */
async function aggregateVdbVariantsForFamily(
  year: number,
  make: string,
  familyHint: string,
): Promise<VdbVariant[]> {
  const allModels = await fetchVdbModelsForYmm(year, make);
  if (allModels.length === 0) return [];

  // Strip common family-suffix tokens that would match too broadly
  // (every Mercedes model contains "Class", which would lump GLE + GLS +
  // S + C together).
  const SUFFIX_TOKENS = new Set([
    "class", "series", "wagon", "sedan", "coupe", "hatchback", "convertible",
  ]);
  const tokenize = (s: string) =>
    s.toLowerCase().split(/[^a-z0-9.]+/).filter((t) => t.length > 0);
  const hintTokens = new Set(
    tokenize(familyHint).filter((t) => !SUFFIX_TOKENS.has(t)),
  );
  if (hintTokens.size === 0) return [];

  const matching = allModels.filter((m) => {
    const tokens = tokenize(m);
    return tokens.some((t) => hintTokens.has(t));
  });
  if (matching.length === 0) return [];

  // Fetch trims for each matching model in parallel; flatten into
  // (model, trim) pairs.
  const results = await Promise.all(
    matching.map(async (model) => {
      const trims = await probeYmmSpecsTrims(year, make, model);
      return trims.map((trim) => ({ model, trim }));
    }),
  );
  return results.flat();
}

/**
 * Resolve VDB's full variant list ({model, trim}[]) for a vehicle without
 * per-car heuristics. First probes every model candidate (VDB decode →
 * NHTSA → token/suffix-stripped) and picks the one returning the most
 * trims; in parallel runs the model-list aggregation for the family hint
 * (handles Mercedes-style splits). Returns whichever path produced more
 * variants.
 *
 * Each variant carries its source model so the caller can pass it to
 * `vehicle-images/{year}/{make}/{model}/{trim}` correctly.
 */
export async function resolveVdbVariantsForVehicle(args: {
  year: number;
  make: string;
  model: string;
  /** VDB advanced-vin-decode's own model (most likely catalog-shaped). */
  vdbDecodedModel?: string;
  /** NHTSA raw Model — often the catalog-specific name. */
  nhtsaModel?: string;
  /** NHTSA raw Series. */
  nhtsaSeries?: string;
  /** NHTSA raw Trim. */
  nhtsaTrim?: string;
  /** Merged trim (decode/normalized). */
  trim?: string;
}): Promise<VdbVariant[]> {
  const { year, make, model } = args;
  if (!year || !make || !model) return [];

  // Build candidate list, deduped, in priority order.
  const seen = new Set<string>();
  const candidates: string[] = [];
  const push = (s?: string | null) => {
    const t = (s ?? "").trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    candidates.push(t);
  };
  // 1. VDB's own decode model first — most likely to match the catalog.
  push(args.vdbDecodedModel);
  // 2. extractModelCandidates handles family → designation token strip
  //    (e.g. BMW "5 Series" + trim "530i" → "530").
  for (const c of extractModelCandidates({
    nhtsaModel: args.nhtsaModel,
    model,
    series: args.nhtsaSeries,
    nhtsaTrim: args.nhtsaTrim,
    trim: args.trim,
  })) {
    push(c);
  }
  // 3. Suffix-stripped variants (Mercedes "GLE-Class" → "GLE", separator
  //    swaps, BMW "5 Series" → "5", etc.).
  for (const v of normalizeModels(model)) push(v);

  // Path A: candidate iteration — pick the candidate returning the most
  // trims. Works for makes where one catalog model carries many trims
  // (Audi A6, Honda Civic, often BMW).
  let bestCandidate: { model: string; trims: string[] } | null = null;
  for (const candidate of candidates) {
    const discovered = await discoverVdbModel({ year, make, candidates: [candidate] });
    if (!discovered) continue;
    if (!bestCandidate || discovered.trims.length > bestCandidate.trims.length) {
      bestCandidate = discovered;
    }
    // Early-out at 4+ trims — clearly the family list, no need to keep
    // probing (saves the model-list fetch in the common case).
    if (bestCandidate.trims.length >= 4) {
      return bestCandidate.trims.map((trim) => ({ model: bestCandidate!.model, trim }));
    }
  }

  // Path B: aggregate across all catalog models matching the family
  // hint. Required for makes that split engine variants into separate
  // top-level models (Mercedes GLE → GLE 350 / GLE 450 / GLE 580 each
  // their own model).
  const aggregated = await aggregateVdbVariantsForFamily(year, make, model);

  // Pick whichever path produced more variants. Convert candidate trims
  // to variants under the winning model.
  const candidateVariants: VdbVariant[] = bestCandidate
    ? bestCandidate.trims.map((trim) => ({ model: bestCandidate!.model, trim }))
    : [];
  if (aggregated.length > candidateVariants.length) {
    console.log(
      `[vdbVariants] aggregation won (${aggregated.length} variants vs candidate ${candidateVariants.length}) for ${year} ${make} ${model}`,
    );
    return aggregated;
  }
  if (candidateVariants.length > 0) return candidateVariants;

  // Last-resort backstop: fuzzy-match the family hint against the full
  // catalog (e.g. exotic family names) and use just that one model.
  const canonicalModels = await fetchVdbModelsForYmm(year, make);
  if (canonicalModels.length === 0) return [];
  const matched = pickBestVdbTrim(canonicalModels, [
    args.vdbDecodedModel,
    args.nhtsaModel,
    model,
    args.trim,
  ]);
  if (!matched) return [];
  console.log(
    `[vdbVariants] both paths empty; matched "${model}" → "${matched}" via fuzzy fallback`,
  );
  const retry = await discoverVdbModel({ year, make, candidates: [matched] });
  if (!retry) return [];
  return retry.trims.map((trim) => ({ model: retry.model, trim }));
}

/**
 * React hook wrapper around `resolveVdbVariantsForVehicle`. Returns the
 * variant list ({model, trim}[]) and a loading flag; re-fetches when any
 * input signal changes.
 *
 * `extras` is optional so manual-entry callers (no VIN decode) can call
 * with just year/make/model.
 */
export function useVdbVariants(
  year: number | undefined,
  make: string,
  model: string,
  extras?: {
    vdbDecodedModel?: string;
    nhtsaModel?: string;
    nhtsaSeries?: string;
    nhtsaTrim?: string;
    trim?: string;
  },
): { variants: VdbVariant[]; isLoading: boolean } {
  const [variants, setVariants] = useState<VdbVariant[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const vdbDecodedModel = extras?.vdbDecodedModel;
  const nhtsaModel = extras?.nhtsaModel;
  const nhtsaSeries = extras?.nhtsaSeries;
  const nhtsaTrim = extras?.nhtsaTrim;
  const trim = extras?.trim;

  useEffect(() => {
    if (!year || !make || !model) {
      setVariants([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    resolveVdbVariantsForVehicle({
      year,
      make,
      model,
      vdbDecodedModel,
      nhtsaModel,
      nhtsaSeries,
      nhtsaTrim,
      trim,
    }).then((result) => {
      if (cancelled) return;
      setVariants(result);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [year, make, model, vdbDecodedModel, nhtsaModel, nhtsaSeries, nhtsaTrim, trim]);

  return { variants, isLoading };
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
    // VDB does not file variants as trims of a family — it files each one as
    // its own MODEL. There is no "GLE-Class" in its catalog at all; there is
    // "GLE 350", "GLE 450", "AMG GLE 63", each with its own verbose trim list
    // ("Base GLE 350 4dr All-Wheel Drive 4MATIC Automatic"). So our (model,
    // trim) pair maps to VDB's (trim-as-model, verbose-trim), and building the
    // URL as `{our model}/{our trim}` 400s every time — which is why the image
    // silently fell back to the VIN and looked identical for every trim.
    //
    // Our own trim already IS VDB's model name for these families, so try it
    // as the model and ask VDB for the verbose trim that goes with it. Falls
    // back to the naive pairing for makes where the family model does exist.
    const ymmtUrls: string[] = [];
    if (trim && year) {
      for (const m of makes) {
        const resolved = await vdbVerboseTrimsFor(year, m, trim);
        for (const v of resolved?.trims ?? []) {
          ymmtUrls.push(
            `${BASE_URL}/${year}/${encodeURIComponent(m)}/${encodeURIComponent(resolved!.model)}/${encodeURIComponent(v)}`,
          );
        }
        ymmtUrls.push(
          `${BASE_URL}/${year}/${encodeURIComponent(m)}/${encodeURIComponent(model)}/${encodeURIComponent(trim)}`,
        );
      }
    }
    // YMMT first when an explicit trim is provided, so the image reflects
    // the user's trim selection. VIN URL stays as fallback.
    const urls: string[] =
      normalizedVin.length === 17
        ? ymmtUrls.length > 0
          ? [...ymmtUrls, `${BASE_URL}/${normalizedVin}`]
          : [`${BASE_URL}/${normalizedVin}`]
        : ymmtUrls;

    for (const url of urls) {
      console.log("[vehicleImage] GET", url);
      // Header casing matches the working convex caller in
      // `convex/lib/vehicleDatabases.ts`. The API gateway has been
      // observed to 403 on lowercased "x-authkey" despite RFC saying
      // header names are case-insensitive — keep this capitalized.
      const response = await vdbFetch(url, { headers: { "x-AuthKey": API_KEY } });
      console.log("[vehicleImage] status", response.status, "ok?", response.ok);
      if (response.status === 429) {
        // Cooldown handles repeats — bail the URL loop so we don't try
        // the next URL (same global limit, same 429).
        break;
      }
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
  // NOTE: "platinum" intentionally NOT in the silver buckets — modern
  // Acura/Honda use it as a WHITE-family prefix ("Platinum White Pearl").
  // Real platinum-silver paints still match via "silver", "titanium",
  // "mineral", "steel", etc.
  "midnight-silver": ["midnight", "silver", "graphite"],
  silver:            ["silver", "graphite", "titanium", "mineral", "steel"],
  // NOTE: "pearl" is intentionally NOT here — it's a finish descriptor, not
  // a color, and appears on paints of every hue ("Crimson Pearl", "Dyno Blue
  // Pearl", "Crystal Black Pearl"). Listing it as white made those match
  // white-first (before red/blue/black) and show a white swatch. Real white
  // paints still match via "white"/"ivory"/"snow"/etc.
  white:             ["white", "ivory", "quartz", "atlas", "alpine", "snow", "cream", "frost"],
  gray:              ["gray", "grey", "graphite", "titanium", "mineral", "ash", "smoke", "cement", "slate", "carbon"],
  red:               ["red", "crimson", "ruby", "scarlet", "garnet", "rosso", "carmine", "cherry"],
  blue:              ["blue", "navy", "ocean", "azure", "sapphire", "indigo", "marine", "atlas", "storm", "sea", "abyss", "denim", "cobalt"],
  green:             ["green", "emerald", "jade", "forest", "moss", "olive", "lime", "british"],
  // Yellow / gold / sand marketing names ("Saharan Sun", "Solar Yellow",
  // "Golden Olive", "Amber Bronze") all land in beige — the classifier
  // hashes warm yellow-amber hues into the beige family too, and beige
  // has a tan/gold COLOR_GRADIENTS entry that reads as light gold. Red
  // is iterated first so genuine "Sunset Red" / "Amber Red" hit red,
  // not beige.
  beige:             ["beige", "sand", "tan", "khaki", "champagne", "wheat", "almond",
                      "sahara", "saharan", "sun", "solar", "gold", "golden",
                      "amber", "honey", "yellow", "mustard", "maize"],
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
  // Bump to force a re-fetch with the same inputs (e.g. a manual "Retry"
  // after a failed/empty lookup). Included in the effect deps below.
  reloadKey: number = 0,
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
  }, [make, model, year, vin, color, trim, debounceMs, reloadKey]);

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
 * Parse #RRGGBB → HSL ({ h: 0–360, s: 0–1, l: 0–1 }). Null if unparseable.
 */
function hexToHsl(
  hex: string | null | undefined,
): { h: number; s: number; l: number } | null {
  if (!hex) return null;
  const clean = hex.replace("#", "").trim();
  if (clean.length < 6) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s, l };
}

/**
 * Pick which CarSilhouette variant matches an NHTSA/VDB body class
 * string. Used by the add-vehicle-review loading skeleton so the
 * placeholder reads as the right shape (SUV/truck/sedan) while the
 * VDB image resolves.
 *
 * Pickup detection uses the literal word "pickup" rather than the
 * generic "truck" — "Truck-Tractor" (semi cab) shouldn't show the
 * consumer pickup silhouette. Wagons / Hatchbacks fall through to
 * the sedan default.
 */
export function pickSilhouetteVariant(
  body: string | null | undefined,
): "sedan" | "suv" | "truck" {
  if (!body) return "sedan";
  const lower = body.toLowerCase();
  if (lower.includes("pickup")) return "truck";
  if (
    lower.includes("sport utility") ||
    lower.includes("suv") ||
    lower.includes("crossover") ||
    lower.includes("multi-purpose") ||
    lower.includes("mpv") ||
    lower.includes("cuv")
  ) {
    return "suv";
  }
  return "sedan";
}

/**
 * Classify an arbitrary hex into a `FAMILY_HEX` / `COLOR_GRADIENTS`
 * family id by hue + saturation/lightness — NOT raw RGB distance, which
 * mis-buckets muted warm colors (a diluted red) as beige/brown.
 * Achromatic inputs map to black/gray/silver/white by lightness.
 */
export function classifyColorFamily(hex: string | null | undefined): string | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const { h, s, l } = hsl;

  // Achromatic — no meaningful hue. Bucket by lightness.
  if (s < 0.18) {
    if (l < 0.18) return "black";
    if (l < 0.42) return "gray";
    if (l < 0.72) return "silver";
    return "white";
  }

  // Chromatic — bucket by hue.
  if (h <= 18 || h >= 342) return "red"; // red
  if (h < 45) return l < 0.4 ? "brown" : "beige"; // orange/amber
  if (h < 70) return "beige"; // yellow
  if (h < 165) return "green"; // green
  if (h < 300) return "blue"; // cyan / blue / indigo (no purple family)
  return "red"; // magenta / pink
}

/**
 * Choose a paint-colour family from candidate swatches (e.g. what
 * `react-native-image-colors` returns), passed PROMINENT-FIRST.
 *
 * The rule is simply: THE MOST PROMINENT SWATCH IS THE CAR. Nothing about
 * saturation enters into it.
 *
 * This used to pick the most saturated swatch anywhere in the list, on the
 * reasoning — stated in its own docstring — that a vivid body should beat
 * neutral wheels and glass. That holds for a red car and inverts completely
 * for a neutral one: a white, silver, grey or black body has almost no
 * saturation, so ANY coloured accent outranks it.
 *
 * Ahmad, 2026-09-07: a white Silverado rendered on a pink background. Measured
 * against the actual VDB render for that VIN, the image is 43.7% black
 * backdrop, a cool grey-white body, and 173 saturated pixels out of 90,000 —
 * amber marker lights, the gold bowtie, and a FIVE-PIXEL dark red cluster at
 * hue 13. Those five pixels were elected the colour of the truck.
 *
 * Saturation cannot distinguish a body from a brake light; prominence can, and
 * a body always wins it. A coloured car's most prominent swatch is its paint,
 * so nothing is lost by dropping the saturation preference entirely — and an
 * accent can no longer win from any position.
 *
 * The one thing skipped is a pure BACKDROP: VDB renders sit on flat black or
 * flat white, and on some platforms that region is the most prominent thing in
 * the frame. Only near-absolute values are treated that way, so a genuinely
 * black car (l ≈ 0.08) still reads black.
 */
const BACKDROP_MIN_L = 0.06;
const BACKDROP_MAX_L = 0.96;

export function pickPaintFamilyFromSwatches(
  swatches: (string | null | undefined)[],
): string | null {
  const parsed = swatches
    .map((hex) => ({ hex, hsl: hexToHsl(hex) }))
    .filter(
      (x): x is { hex: string; hsl: { h: number; s: number; l: number } } =>
        !!x.hsl && !!x.hex,
    );
  if (parsed.length === 0) return null;

  const body =
    parsed.find(
      (x) =>
        x.hsl.l > BACKDROP_MIN_L &&
        x.hsl.l < BACKDROP_MAX_L &&
        // A flat backdrop is also colourless; a dark car is not required to be.
        !(x.hsl.s < 0.05 && (x.hsl.l < 0.1 || x.hsl.l > 0.93)),
    ) ?? parsed[0];

  return classifyColorFamily(body.hex);
}

/**
 * The paint family named by a VDB image URL, or null.
 *
 * VDB's per-colour renders carry the paint in the filename —
 * `.../colors/2023/mercedes-benz/amg-gle-63/<trim>/black.jpg`, or
 * `summit-white.jpg` — which is the manufacturer's own name for it and beats
 * anything sampling can infer. Its generic gallery shots do not
 * (`ext-3231303031.jpg`), and those return null so the caller falls through.
 *
 * Only the FILENAME is read, never the path: a path segment like
 * `work-truck-4x4-regular-cab` is model and trim wording, and matching colour
 * synonyms against it would invent paint colours out of body styles.
 */
export function colorFamilyFromImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const filename = (url.split("?")[0].split("/").pop() ?? "").replace(/\.[a-z0-9]+$/i, "");
  if (!filename) return null;
  return inferColorFamily(filename);
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
  /** Internal: set on the discovery re-entry so we never re-run the
   *  discovery fallbacks twice (guards against an infinite loop when a
   *  ymm-specs trim has no vehicle-images record). */
  __triedDiscovery?: boolean;
  /** Speculative warm-up rather than the image on screen. Yields to the
   *  rate-limit cooldown instead of waiting it out — see `vdbFetch`. */
  background?: boolean;
}): Promise<VdbColorOption[]> {
  const {
    vin, year, make, model, trim,
    nhtsaModel, nhtsaSeries, nhtsaTrim,
    vdbDecodedModel, vdbDecodedStyle, vdbDecodedTrimAndStyle,
    background,
  } = args;
  const fetchOpts = background ? { background: true } : undefined;
  console.log("[vdbColors] inputs:", { vin, year, make, model, trim, nhtsaModel, nhtsaSeries, nhtsaTrim, vdbDecodedModel, vdbDecodedStyle, vdbDecodedTrimAndStyle });
  const normalizedVin = (vin ?? "").toUpperCase().trim();
  const makes = make ? normalizeMakes(make) : [];

  // Same VDB quirk the image path hit: variants are MODELS in VDB's catalog,
  // not trims of a family. "GLE-Class" does not exist there — "GLE 350" does,
  // carrying its own verbose trim. Pairing our model with our trim 400s, the
  // loop falls through to the VIN URL, and the VIN URL always returns the base
  // trim's colours. That is why the picture never changed whichever trim was
  // picked: this function feeds the hero image whenever VDB has colours, and
  // it was resolving by VIN every time.
  const ymmtUrls: string[] = [];
  if (trim && year && make) {
    for (const m of makes) {
      const resolved = await vdbVerboseTrimsFor(year, m, trim, fetchOpts);
      for (const verbose of resolved?.trims ?? []) {
        ymmtUrls.push(
          `${BASE_URL}/${year}/${encodeURIComponent(m)}/${encodeURIComponent(resolved!.model)}/${encodeURIComponent(verbose)}`,
        );
      }
      if (model) {
        ymmtUrls.push(
          `${BASE_URL}/${year}/${encodeURIComponent(m)}/${encodeURIComponent(model)}/${encodeURIComponent(trim)}`,
        );
      }
    }
  }
  // When an explicit trim is provided, try the YMMT URLs FIRST so the
  // image/colors reflect the user's actual trim selection (the VIN URL
  // always returns the base trim regardless of `trim`). VIN URL stays as
  // a fallback for the rare car VDB indexes only by VIN.
  const urls: string[] =
    normalizedVin.length === 17
      ? ymmtUrls.length > 0
        ? [...ymmtUrls, `${BASE_URL}/${normalizedVin}`]
        : [`${BASE_URL}/${normalizedVin}`]
      : ymmtUrls;

  // No initial URLs AND no discovery inputs → nothing to try.
  if (urls.length === 0 && !(year && make)) return [];

  for (const url of urls) {
    try {
      const response = await vdbFetch(url, { headers: { "x-AuthKey": API_KEY } }, fetchOpts);
      // 429 means VDB rate-limited us — every other URL in this loop
      // hits the same global limit and will also 429. Bail and let the
      // caller render the placeholder until the cooldown expires.
      if (response.status === 429) break;
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
  if (year && make && vdbDecodedModel && !args.__triedDiscovery) {
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
        const response = await vdbFetch(url, { headers: { "x-AuthKey": API_KEY } }, fetchOpts);
        // Bail the entire combo matrix on 429 — same global limit applies
        // to every model/trim permutation. Caller falls through to model
        // discovery which is also gated by the cooldown.
        if (response.status === 429) break;
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
  if (year && make && !args.__triedDiscovery) {
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
    // Keep the current `model` in the candidate set. The initial YMMT
    // attempt above used the VIN-DECODED trim, but ymm-specs is keyed by
    // YMM (no trim) — so re-probing this model returns NEW info: its
    // canonical trim list. This is what recovers cars whose model name
    // is already correct but whose decoded trim VDB doesn't recognize
    // (e.g. Audi A6 "3.0T Prestige").
    const discoveryCandidates = candidates;
    console.log("[vdbColors] discovery candidates:", discoveryCandidates);
    if (discoveryCandidates.length > 0) {
      const discovered = await discoverVdbModel({
        year,
        make,
        candidates: discoveryCandidates,
      });
      if (discovered) {
        // Pick the canonical trim that best matches the vehicle's real
        // trim instead of blindly taking the first one — so an Audi A6
        // "3.0T Prestige" maps to VDB's "3.0T Prestige quattro ..."
        // rather than the base "2.0T Premium" variant.
        const bestTrim = pickBestVdbTrim(discovered.trims, [trim, nhtsaTrim]);
        console.log(
          `[vdbColors] discovered VDB model "${discovered.model}" for ${year} ${make} (caller model "${model}"). Picked trim "${bestTrim}" from ${discovered.trims.length} canonical trims`,
        );
        // Re-enter the same fetch path with the discovered model + the
        // matched canonical trim. __triedDiscovery guards re-entry from
        // looping back into discovery.
        return fetchVdbColorsForVehicle({
          ...args,
          model: discovered.model,
          trim: bestTrim,
          __triedDiscovery: true,
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
  const trim = (args.trim ?? "").toLowerCase().trim();
  // Include trim alongside VIN so switching trims forces a fresh fetch
  // — different trims return different color/image variants from VDB
  // even for the same VIN.
  if (vin.length === 17) {
    return trim ? `vin:${vin}|trim:${trim}` : `vin:${vin}`;
  }
  return `ymmt:${args.year ?? ""}|${(args.make ?? "").toLowerCase()}|${(args.model ?? "").toLowerCase()}|${trim}`;
}

/**
 * Warm the colour/image cache for every trim in the picker, in parallel.
 *
 * VDB has no "all trims" endpoint — `/vehicle-images/{year}/{make}/{model}/
 * {trim}` takes one trim at a time — so this is N requests, fired once while
 * the driver is still reading the screen. `useVdbColorsForVin` reads the same
 * `COLORS_CACHE`, so by the time they open the dropdown every entry is a cache
 * hit and switching is instant.
 *
 * Without it, each trim's first selection ran a full round trip and showed a
 * loading state — and because image resolution prefers the VIN, that spinner
 * usually resolved back to the picture already on screen. A wait for nothing.
 *
 * Deliberately best-effort: failures are swallowed per trim. A trim VDB does
 * not recognise (our names come from Car API / MarketCheck, whose vocabulary
 * differs) simply stays uncached and falls back to the VIN image, which is
 * what it did before.
 */
export function prefetchVdbColorsForTrims(
  base: Parameters<typeof fetchVdbColorsForVehicle>[0],
  trims: readonly string[],
): void {
  // SERIALLY, one trim at a time, and flagged background.
  //
  // This used to fire every trim at once. VDB caps us at 3 concurrent and
  // answers 429 beyond that, which arms a GLOBAL 10-second cooldown on
  // /vehicle-images — and the cooldown then short-circuited the foreground
  // request for the image actually on screen. Ten trims of warm-up were
  // costing the driver the one picture they were waiting for (Ahmad,
  // 2026-09-04: "no cars images are showing").
  //
  // Serial keeps at most one of the three slots busy, so the screen's own
  // request always has room, and `background: true` means that if we do trip
  // the limit anyway, the prefetch is what gets dropped rather than the
  // foreground fetch.
  void (async () => {
    for (const trim of trims) {
      if (!trim) continue;
      const args = { ...base, trim, background: true };
      const k = cacheKey({ ...base, trim });
      if (COLORS_CACHE.has(k)) continue;
      // Mark in-flight so two renders cannot both fire the same request.
      if (PREFETCH_INFLIGHT.has(k)) continue;
      PREFETCH_INFLIGHT.add(k);
      try {
        const result = await fetchVdbColorsForVehicle(args);
        if (result.length) COLORS_CACHE.set(k, result);
      } catch {
        // A warm-up that fails is a warm-up that did not happen.
      } finally {
        PREFETCH_INFLIGHT.delete(k);
      }
    }
  })();
}

const PREFETCH_INFLIGHT = new Set<string>();

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
