// =============================================================================
// cascadeClient — typed wrapper around convex/oto/vehicleFactsKB:cascadeTier2
// =============================================================================
//
// Two modes:
//   1. live — POST to Convex's HTTP action endpoint at $OTO_EVAL_CONVEX_URL
//             with $OTO_EVAL_CONVEX_KEY as the bearer. The deployment must
//             have the `cascadeTier2` action exposed and the eval principal
//             must have read access on `vehicle_facts`.
//   2. mock — deterministic canned cascade results keyed by labeled-set id.
//             First-class. Without a live Convex deployment the harness must
//             still produce a complete report so it's developable offline
//             (Doc 3 §6 charter).
//
// The wrapper exposes ONE function — `runCascade(entry, mode)` — that returns
// the same shape regardless of mode. Tier 1 (which lives outside this file
// in `vehicleFacts.ts` / structured enrichment tables) and Tier 3 (which is
// a web_search dispatched at the chat.ts level) are NOT cascadeTier2's job;
// the harness's mock layer emulates them too so the labeled-set entries that
// expect T1, T3, or REFUSE still have something to assert against.
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
 * STUB: real Convex action POST. Shape per
 *   https://docs.convex.dev/http-api/#action-call
 *
 * Fully functional structurally — the wire format is correct — but does NOT
 * exercise Tier 1 (which is `api.oto.vehicleFacts.getVehicleFacts`, a query
 * routed by topic, not by hash). A complete live harness needs the outer
 * driver from `convex/oto/tools.ts::retrieve_vehicle_facts` exposed as an
 * action so this client can call it directly. Day 4 ticket: expose that
 * driver as `api.oto.evalHarness.runFullCascade` and switch this call over.
 *
 * For now this function calls cascadeTier2 only and reports T2_HASH / T2_STRUCT / T2_TEXT / NONE. T1
 * and T3 lookups will report NONE, which the harness treats as a miss; this
 * is acceptable for harness-shape work but NOT for the Wave 5.2 baseline
 * measurement. The baseline must run after the Day 4 driver-exposure ticket.
 */
async function runCascadeLive(
  entry: LabeledEntry,
  cfg: ConvexHttpConfig,
): Promise<CascadeResponse> {
  const endpoint = `${cfg.url.replace(/\/$/, "")}/api/action`;
  const body = {
    path: "oto/vehicleFactsKB:cascadeTier2",
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
    },
    format: "json",
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.authKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `cascadeTier2 HTTP ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  const raw = (await res.json()) as {
    status: string;
    value?: {
      tier: "T2_HASH" | "T2_STRUCT" | "T2_TEXT" | null;
      facts: Array<{
        fact_id: string;
        fact_text: string;
        render_disclaim_tag: boolean;
        source: string;
        verification_status: string;
      }>;
    };
    errorMessage?: string;
  };

  if (raw.status !== "success" || !raw.value) {
    throw new Error(
      `cascadeTier2 action returned ${raw.status}: ${raw.errorMessage ?? "(no message)"}`,
    );
  }

  const tier = raw.value.tier;
  const facts: ScoredFact[] = raw.value.facts.map((f) => ({
    fact_text: f.fact_text,
    render_disclaim_tag: f.render_disclaim_tag,
  }));

  const resolved_tier: ResolvedTier = tier === null ? "NONE" : tier;
  const actual_render_tag = facts.length > 0 ? !!facts[0].render_disclaim_tag : false;

  return {
    resolved_tier,
    first_hit_facts: facts,
    union_facts: facts,
    actual_render_tag,
    web_search_invoked: false,
    per_tier_counts: { [resolved_tier]: facts.length } as Partial<
      Record<ResolvedTier, number>
    >,
  };
}

// Trivial topic mapper for the live call. The real outer driver in
// `tools.ts::retrieve_vehicle_facts` does smarter topic routing; this stub
// passes "general" so the structural index doesn't over-filter. Day 4 will
// replace this when the full driver is exposed.
function deriveTopicForLive(_entry: LabeledEntry): string {
  return "general";
}
function deriveTopicAxisForLive(_entry: LabeledEntry): string {
  return "vehicle";
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
