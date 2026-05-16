// =============================================================================
// cascadeClient — typed wrapper around convex/oto/evalHarness:runFullCascade
// =============================================================================
//
// Two modes:
//   1. live — POST to Convex's HTTP action endpoint at $OTO_EVAL_CONVEX_URL
//             with $OTO_EVAL_CONVEX_KEY as the bearer. The deployment must
//             have the `runFullCascade` action exposed (it lives in
//             convex/oto/evalHarness.ts) and the eval principal must have
//             read access on the enrichment-owned tables (vehicle_configs,
//             engines, transmissions, trim_specs) plus `vehicle_facts`.
//   2. mock — deterministic canned cascade results keyed by labeled-set id.
//             First-class. Without a live Convex deployment the harness must
//             still produce a complete report so it's developable offline
//             (Doc 3 §6 charter).
//
// The wrapper exposes ONE function — `runCascade(entry, mode)` — that returns
// the same shape regardless of mode. In live mode the call now exercises the
// FULL cascade walk: T1 (enrichment-table lookups via lookupT1 → engines /
// transmissions / trim_specs / vehicle_configs) → T2 (HASH → STRUCT → TEXT
// via cascadeTier2) → T3 (stubbed; gated behind `no_web_search`). The eval-
// baseline default is `no_web_search: true` so T3 reports `tier=null` with
// empty facts unless we explicitly turn it on (variable latency + API cost
// should not ride in baseline measurement — RAG_WAVE_5_1 §6).
// =============================================================================

import type {
  ActualTier,
  Category,
  ExpectedTier,
  ScoredFact,
} from "./metrics";

// -- Labeled-set entry shape (matches the JSONL fixture) ----------------------

export interface VehicleScope {
  make: string;
  model: string;
  year_min: number;
  year_max: number;
  chassis_code?: string;
  engine_code?: string;
  trim_or_engine?: string;
  vehicle_config_id?: string;
}

export interface LabeledEntry {
  id: string;
  query: string;
  vehicle_scope: VehicleScope;
  expected_source_tier: ExpectedTier;
  expected_render_tag: boolean;
  expected_fact_substrings: string[];
  category: Category;
  cross_tenant?: boolean;
  notes?: string;
  /**
   * Optional explicit topic override. When provided, the live cascade call
   * passes this as `topic` to `runFullCascade` (which routes T1 lookups via
   * `T1_TOPIC_MAP` in `convex/oto/evalHarness.ts` and feeds T2 STRUCT/TEXT).
   * When absent, falls back to `"general"` — which T1 cannot resolve, so
   * the cascade walks straight to T2. Set for cases that EXPECT a T1 hit.
   */
  topic?: string;
  /**
   * Optional explicit topic_axis override. When provided, passed verbatim
   * to `runFullCascade`. Must be one of the five axis literals the
   * `FullCascadeFactRow.topic_axis` type permits.
   */
  topic_axis?: "vehicle" | "trim" | "chassis" | "engine" | "model_year";
}

// -- Cascade response (matches vehicleFactsKB.ts Tier2Result + outer driver) --

export type ResolvedTier = ActualTier;

/**
 * The harness's view of a cascade response. The outer driver may walk T1 then
 * T2_HASH/STRUCT/TEXT then T3 — this wraps the full walk, not just
 * `cascadeTier2` (which is only the T2_* portion).
 */
export interface CascadeResponse {
  /** First-hit tier across the full walk, or "REFUSE" / "NONE". */
  resolved_tier: ResolvedTier;
  /** Top facts of the first-hit tier. */
  first_hit_facts: ScoredFact[];
  /** Union of all candidates traversed up to and including first-hit. */
  union_facts: ScoredFact[];
  /** What the renderer would show as the bubble's disclaim flag. */
  actual_render_tag: boolean;
  /** Diagnostic — was a web_search fired? (Tier 3 only.) */
  web_search_invoked: boolean;
  /** Tier breakdown for debugging. */
  per_tier_counts: Partial<Record<ResolvedTier, number>>;
}

export type CascadeMode = "live" | "mock";

// -- LIVE mode: Convex HTTP action call --------------------------------------

interface ConvexHttpConfig {
  url: string; // e.g. "https://my-deployment.convex.cloud"
  authKey: string; // bearer / admin key
}

function getConvexConfig(): ConvexHttpConfig | null {
  const url = process.env.OTO_EVAL_CONVEX_URL;
  const authKey = process.env.OTO_EVAL_CONVEX_KEY;
  if (!url || !authKey) return null;
  return { url, authKey };
}

/**
 * Live cascade: POST `oto/evalHarness:runFullCascade` to the Convex HTTP
 * action endpoint. This exercises the FULL T1 → T2 → T3 walk:
 *   • T1 — topic-routed lookup against enrichment-owned tables (engines,
 *     transmissions, trim_specs, vehicle_configs) via `lookupT1`. Requires
 *     the caller to pass a `topic` from `T1_TOPIC_MAP` (e.g., "oil_capacity",
 *     "tire_pressure_front"). If the caller passes "general" or another
 *     unmapped topic, T1 returns no rows and the cascade falls through.
 *   • T2 — HASH → STRUCT → TEXT via the existing `cascadeTier2` action.
 *   • T3 — stub. With `no_web_search: true` (eval-baseline default), this
 *     entry point reports `tier=null` with empty facts on all-tier-miss.
 *     With `no_web_search: false`, reports `tier=T3` with empty facts (real
 *     web_search wiring is Day 5+ work).
 *
 * The endpoint returns `FullCascadeResult` (see convex/oto/evalHarness.ts):
 *   { tier, facts, attempted_tiers }
 * We map onto the harness's `CascadeResponse` field-by-field:
 *   tier === null            → resolved_tier = "NONE"
 *   tier === "REFUSE"        → resolved_tier = "REFUSE"
 *   tier === "T1"|"T2_*"|"T3"→ resolved_tier = same literal
 * `facts` carries `render_disclaim_tag` per row (the locked F.5 predicate);
 * we pass through to `first_hit_facts` and reuse for `union_facts` since
 * `runFullCascade` returns only the first-hit tier's rows. `web_search_invoked`
 * is true iff `attempted_tiers` includes "T3" (i.e., we passed `no_web_search:
 * false` AND T1/T2 both missed). `per_tier_counts` is best-effort: we record
 * the count of the resolved tier; pre-tier counts are not surfaced by
 * `runFullCascade` (it short-circuits on first-hit) — the cascade is
 * monotonic-fail-forward so this stays accurate.
 */
async function runCascadeLive(
  entry: LabeledEntry,
  cfg: ConvexHttpConfig,
): Promise<CascadeResponse> {
  const endpoint = `${cfg.url.replace(/\/$/, "")}/api/action`;
  const body = {
    path: "oto/evalHarness:runFullCascade",
    args: {
      question_text: entry.query,
      topic: deriveTopicForLive(entry),
      topic_axis: deriveTopicAxisForLive(entry),
      ...(entry.vehicle_scope.vehicle_config_id !== undefined
        ? { vehicle_config_id: entry.vehicle_scope.vehicle_config_id }
        : {}),
      ...(entry.vehicle_scope.chassis_code !== undefined
        ? { chassis_code: entry.vehicle_scope.chassis_code }
        : {}),
      ...(entry.vehicle_scope.engine_code !== undefined
        ? { engine_code: entry.vehicle_scope.engine_code }
        : {}),
      limit: 5,
      no_web_search: true,
    },
    format: "json",
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${cfg.authKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `runFullCascade HTTP ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  const raw = (await res.json()) as {
    status: string;
    value?: {
      tier:
        | "T1"
        | "T2_HASH"
        | "T2_STRUCT"
        | "T2_TEXT"
        | "T3"
        | "REFUSE"
        | null;
      facts: Array<{
        fact_id: string;
        fact_text: string;
        topic: string;
        topic_axis: string;
        source: string;
        verification_status: string;
        confidence: number;
        cited_url: string | null;
        canonical_question_key: string | null;
        render_disclaim_tag: boolean;
        match_kind: string;
      }>;
      attempted_tiers: Array<"T1" | "T2_HASH" | "T2_STRUCT" | "T2_TEXT" | "T3">;
    };
    errorMessage?: string;
  };

  if (raw.status !== "success" || !raw.value) {
    throw new Error(
      `runFullCascade action returned ${raw.status}: ${raw.errorMessage ?? "(no message)"}`,
    );
  }

  const tier = raw.value.tier;
  const facts: ScoredFact[] = raw.value.facts.map((f) => ({
    fact_text: f.fact_text,
    render_disclaim_tag: f.render_disclaim_tag,
  }));

  // Map FullCascadeResult.tier → CascadeResponse.resolved_tier. The two
  // share every non-null literal verbatim; null collapses to "NONE" (the
  // harness's all-tier-miss sentinel).
  const resolved_tier: ResolvedTier = tier === null ? "NONE" : tier;
  const actual_render_tag =
    facts.length > 0 ? !!facts[0].render_disclaim_tag : false;
  const web_search_invoked = raw.value.attempted_tiers.includes("T3");

  return {
    resolved_tier,
    first_hit_facts: facts,
    union_facts: facts,
    actual_render_tag,
    web_search_invoked,
    per_tier_counts: { [resolved_tier]: facts.length } as Partial<
      Record<ResolvedTier, number>
    >,
  };
}

// Topic mapper for the live call. Honors an explicit `topic` on the labeled
// entry (e.g., "oil_capacity" for the d-001 case so T1 hits); falls back to
// "general" otherwise — which `T1_TOPIC_MAP` does not contain, so T1 is a
// no-op and the cascade walks straight to T2.
function deriveTopicForLive(entry: LabeledEntry): string {
  return entry.topic ?? "general";
}
function deriveTopicAxisForLive(entry: LabeledEntry): string {
  return entry.topic_axis ?? "vehicle";
}

// -- MOCK mode: canned, deterministic, per-entry-id --------------------------

/**
 * The mock cascade returns the labeled-set entry's expected outcome verbatim:
 *   • resolved_tier = expected_source_tier
 *   • first_hit_facts = one synthetic ScoredFact whose fact_text contains
 *     every expected substring concatenated, with `render_disclaim_tag` set
 *     from the locked predicate based on expected tier + Cat H/I semantics.
 *   • actual_render_tag = expected_render_tag.
 *
 * This means the mock harness scores 100% on every metric, which is exactly
 * what we want for harness-shape development: a non-100% score in mock mode
 * means the metric code is broken, not the cascade. To exercise FAILURE
 * modes (e.g. unit-testing the under_disclaim metric), see `metrics.test.ts`
 * which constructs PerQueryResult fixtures directly.
 *
 * Deterministic — no Date, no random, no I/O.
 */
function runCascadeMock(entry: LabeledEntry): CascadeResponse {
  // Cat F refusal: cascade produces no candidates by contract.
  if (entry.expected_source_tier === "REFUSE") {
    return {
      resolved_tier: "REFUSE",
      first_hit_facts: [],
      union_facts: [],
      actual_render_tag: false,
      web_search_invoked: false,
      per_tier_counts: { REFUSE: 0 },
    };
  }

  // Synthesize a fact that matches the labeled substrings. We concatenate
  // every expected substring into one fact_text so factMatchesAny() is
  // guaranteed to hit. Multiple identical facts to populate top-3.
  const factText =
    entry.expected_fact_substrings.length > 0
      ? entry.expected_fact_substrings.join(" — ")
      : "(no expected substrings; mock fact body)";

  // The locked predicate: render_disclaim_tag === (source === "web_search" && status === "unverified")
  // For the mock we just trust expected_render_tag (which is the labeled
  // value derived from the same predicate by the RAG Specialist).
  const synthetic: ScoredFact = {
    fact_text: factText,
    render_disclaim_tag: entry.expected_render_tag,
  };

  // For T1 / T3, the first-hit "facts" are conceptual — we emit one record
  // so precision@3 has something to score. Top-3 has the same fact replicated
  // is artificial; we keep top-1 only so MRR=1.0 and p@3=1.0 cleanly.
  const facts: ScoredFact[] = [synthetic];

  return {
    resolved_tier: entry.expected_source_tier,
    first_hit_facts: facts,
    union_facts: facts,
    actual_render_tag: entry.expected_render_tag,
    web_search_invoked: entry.expected_source_tier === "T3",
    per_tier_counts: { [entry.expected_source_tier]: facts.length } as Partial<
      Record<ResolvedTier, number>
    >,
  };
}

// -- Public entry -------------------------------------------------------------

export async function runCascade(
  entry: LabeledEntry,
  mode: CascadeMode,
): Promise<CascadeResponse> {
  if (mode === "mock") return runCascadeMock(entry);

  const cfg = getConvexConfig();
  if (!cfg) {
    throw new Error(
      "Live mode requires OTO_EVAL_CONVEX_URL and OTO_EVAL_CONVEX_KEY. " +
        "Set them or pass --mock.",
    );
  }
  return runCascadeLive(entry, cfg);
}
