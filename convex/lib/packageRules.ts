/**
 * lib/packageRules.ts — Curated rules for detecting service-impacting packages.
 *
 * Each rule maps a make + a regex (matched against VDB option strings, trim names,
 * or installed-equipment entries) to a normalized package code with:
 *   - canonical label
 *   - which of the 23 services it affects
 *   - confidence weight (0–1)
 *
 * Rules whose `services_affected` doesn't intersect the 23 services are filtered out
 * by assessAvailablePackages — we only care about packages that change parts.
 *
 * See docs/PACKAGE_AWARE_PARTS.md.
 */

export interface PackageRule {
  /** Make this rule applies to. "*" = any make. */
  make: string;
  /** Regex matched (case-insensitive) against VDB option/equipment/trim strings. */
  pattern: RegExp;
  /** Normalized code stored on vehicle_configs.packages_available[].code. */
  code: string;
  /** Human-readable label for UI. */
  label: string;
  /** Service slugs (from seed_services_catalog) this package affects. */
  services_affected: string[];
  /** Confidence weight if matched. VDB explicit hits will scale this up; trim-name inference scales it down. */
  base_confidence: number;
  /**
   * When true, this rule is skipped if the vehicle matches a halo-variant rule
   * (lib/haloVariantRules.ts) with hardwareStandard=true. Use for "sport-line"
   * package codes whose hardware is already baseline on the halo trim — e.g.
   * m_sport on an M3, amg_line on an AMG GT, audi_s_line on an RS4. Without
   * this gate the same brakes/rotors get double-counted and quoting upsells
   * parts the customer already has.
   */
  redundant_when_halo?: boolean;
}

/**
 * Service slugs as they actually appear in services.slug for the running DB.
 * Mirrors `convex/seeds/seedServices.ts` (the seed currently loaded). Other
 * seeds in this repo (seed.ts, seed_services_catalog.ts) use hyphenated slugs
 * — if you switch which seed is loaded, update this list to match.
 *
 * If a slug here doesn't appear in services.slug at runtime, the rule has no
 * effect (filtered out by ruleAffectsKnownService in assessAvailablePackages).
 *
 * NOTE: `part_fitments.service_type` is written by the enrichment pipeline
 * using PART_FIELD_MAP.serviceSlug which currently uses HYPHENATED slugs (see
 * convex/vehicleEnrichment/v3pipeline.ts). That shape mismatch is handled at
 * read time by services.ts:listBookableForVehicle's fitment fallback —
 * eventually those should be standardized too.
 */
export const KNOWN_SERVICE_SLUGS = [
  "oil_change",
  "filter_replacement",
  "spark_plugs",
  "timing_belt",
  "battery_replacement",
  "battery_test",
  "coolant_flush",
  "transmission_service",
  "brake_pad_replacement",
  "rotor_replacement",
  "brake_fluid_flush",
  "tire_rotation",
  "tire_balance",
  "wheel_alignment",
  "tire_replacement",
  "state_inspection",
  "emissions_test",
  "diagnostic_scan",
  "check_engine_light",
  "pre_purchase_inspection",
  "power_steering_flush",
  "differential_service",
  "fuel_system_cleaning",
] as const;

export type ServiceSlug = (typeof KNOWN_SERVICE_SLUGS)[number];

/**
 * Initial rules table. Expand as we encounter packages in the wild.
 *
 * Naming convention for codes: snake_case, make-prefixed where ambiguous.
 * Order doesn't matter; assessAvailablePackages dedupes by code.
 */
// Only brake-upgrade rules. All other package detection (M Sport, AMG Line,
// S line, Track Handling, Cold Weather, Tow, HD Battery, Off-Road, Summer
// Performance Tires, etc.) intentionally removed — multi-element packages
// produced noisy "you have package X" questions for hardware the user can't
// easily verify. Brakes are the one axis where the user-question payoff is
// real (CCB pads/rotors cost ~10× steel; mechanic needs to know before
// quoting). Re-introduce other rules only when there's a concrete booking
// flow consuming the answer.
export const PACKAGE_RULES: PackageRule[] = [
  {
    make: "*",
    pattern: /\bCarbon[\s-]?Ceramic\b/i,
    code: "carbon_ceramic_brakes",
    label: "Carbon Ceramic Brakes",
    services_affected: ["brake_pad_replacement", "rotor_replacement"],
    base_confidence: 0.95,
  },
  {
    make: "*",
    // Catches: "M Performance Brake Package", "AMG Performance Brake",
    // "M Sport Brakes", "Sport Brake Package", "Performance Brake Package",
    // "Track Brake Package", "Big Brake Kit (BBK)". The leading qualifier
    // word is required so generic "Brakes" alone doesn't trigger.
    pattern: /\b(M\s*Performance|AMG\s+Performance|M\s*Sport|Sport|Performance|Track|Big)\s+Brake/i,
    code: "performance_brake_package",
    label: "Performance Brake Package",
    services_affected: ["brake_pad_replacement", "rotor_replacement"],
    base_confidence: 0.9,
    redundant_when_halo: true,
  },
  {
    make: "*",
    pattern: /\bPCCB\b/i,
    code: "pccb",
    label: "Porsche Ceramic Composite Brakes (PCCB)",
    services_affected: ["brake_pad_replacement", "rotor_replacement"],
    base_confidence: 0.95,
  },
  {
    make: "*",
    pattern: /\bPSCB\b|\bSurface[\s-]Coated\s+(Brake|Disc|Rotor)/i,
    code: "pscb",
    label: "Porsche Surface Coated Brakes (PSCB)",
    services_affected: ["brake_pad_replacement", "rotor_replacement"],
    base_confidence: 0.95,
  },
];

// Trim-name inference removed — was producing false positives like flagging
// "M Sport (inferred from trim)" on M-cars whose hardware is already baseline.
// Detection now relies solely on explicit VDB option-string matches via
// PACKAGE_RULES + assessAvailablePackages.
