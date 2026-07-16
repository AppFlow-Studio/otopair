/**
 * Sane bounds for OEM service intervals. Enrichment output is noisy
 * (spark-plug values range 15k–105k across configs, prod leans on a
 * 100k default when scraping fails). Without a clamp, from-odometer
 * inference would nag a turbo every 15k or ignore a plug until 100k.
 * Low-confidence values (`!mechanic_verified && confidence < 0.75`)
 * snap to the conservative floor so unsure data errs toward "check
 * sooner." No schema additions.
 */

/**
 * Per-service `[floor, ceiling]` mileage bounds. Any stored interval
 * outside these snaps to the nearest bound before inference runs.
 * Values chosen conservatively — better to nudge slightly early than
 * miss a service on a low-confidence enrichment.
 *
 * Slugs match the v5 taxonomy in `constants/serviceTaxonomy.ts` so a
 * mechanic-authored write flowing through the same slug resolves
 * against the same guardrail.
 */
export const SERVICE_INTERVAL_BOUNDS_MI: Record<string, [number, number]> = {
  spark_plugs: [20_000, 100_000],
  timing_belt: [60_000, 120_000],
  transmission_service: [30_000, 100_000],
  coolant_flush: [30_000, 100_000],
  brake_fluid_flush: [15_000, 45_000],
  differential_service: [30_000, 60_000],
  serpentine_belt: [60_000, 100_000],
  power_steering_flush: [30_000, 100_000],
  fuel_system_cleaning: [30_000, 60_000],
  filter_replacement: [15_000, 45_000],
};

/**
 * Conservative industry defaults for services whose enrichment
 * failed entirely (no `interval_miles` on file). Used only as a
 * last resort — inference prefers the actual stored interval when
 * one exists. Slugs missing from this table return null → row
 * surfaces as anchorless.
 */
export const CONSERVATIVE_DEFAULTS_MI: Record<string, number> = {
  spark_plugs: 60_000,
  timing_belt: 90_000,
  transmission_service: 60_000,
  coolant_flush: 60_000,
  brake_fluid_flush: 30_000,
  serpentine_belt: 90_000,
  filter_replacement: 30_000,
};

interface SafeIntervalInput {
  slug: string;
  interval_miles: number | null | undefined;
  confidence?: number | null;
  mechanic_verified?: boolean;
}

/**
 * Bound an interval by the per-service floor / ceiling, weighted by
 * confidence. Returns null when we have nothing usable to work with —
 * the caller should treat that as "anchorless" and surface the row
 * inside a soft tier with the diagnostic-scan CTA per Behavior #6.
 */
export function safeInterval(input: SafeIntervalInput): number | null {
  const { slug, interval_miles, confidence, mechanic_verified } = input;
  const bounds = SERVICE_INTERVAL_BOUNDS_MI[slug];

  // No stored interval → try the conservative default. If none,
  // this service has no way to compute — row is anchorless.
  if (interval_miles == null || interval_miles <= 0) {
    return CONSERVATIVE_DEFAULTS_MI[slug] ?? null;
  }

  // Low-confidence path: snap to the floor if we have bounds; else
  // fall back to the conservative default; else return the raw value
  // (best effort — nothing safer available).
  const conf = confidence ?? 0;
  const trusted = mechanic_verified === true || conf >= 0.75;
  if (!trusted) {
    if (bounds) return bounds[0];
    return CONSERVATIVE_DEFAULTS_MI[slug] ?? interval_miles;
  }

  // Trusted path: clamp to bounds if we have them, otherwise let the
  // stored value through.
  if (!bounds) return interval_miles;
  const [floor, ceiling] = bounds;
  if (interval_miles < floor) return floor;
  if (interval_miles > ceiling) return ceiling;
  return interval_miles;
}
