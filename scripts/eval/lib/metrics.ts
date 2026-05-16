// =============================================================================
// Wave 5.1 / Wave 1.4 v3 — pure metric functions
// =============================================================================
//
// HARD CONSTRAINT (from Doc 3 §6 charter): every function in this file is
// pure. No I/O. No `Date.now()`. No randomness. No imports of `fs`, `http`,
// `convex`, or anything that has a clock. This is what makes the metric
// unit-tests in `metrics.test.ts` deterministic, and it's what lets us
// snapshot expected values without flake.
//
// Public surface:
//   • precisionAt3(facts, expectedSubstrings) -> number in [0,1]
//   • recallAt5(unionFacts, expectedSubstrings) -> number in [0,1]
//   • mrr(facts, expectedSubstrings) -> number in [0,1]
//   • tierMisclassification(rows) -> { rate, t1_to_t2, t1_to_t3, t2_hash_to_struct, t2_struct_to_text, t2_to_t3 }
//   • disclaimTagCorrectness(rows) -> { correctness, over_disclaim_rate, under_disclaim_rate }
//   • refusalViolationRate(rows) -> number
//   • aggregateByCategory(rows) -> Record<Category, Aggregate>
//   • passRateWithConfidence(passes, n) -> { rate, ciLow, ciHigh }   (Wilson CI)
// =============================================================================

// -- Shared types -------------------------------------------------------------

export type ExpectedTier =
  | "T1"
  | "T2_HASH"
  | "T2_STRUCT"
  | "T2_TEXT"
  | "T3"
  | "REFUSE";

export type ActualTier =
  | "T1"
  | "T2_HASH"
  | "T2_STRUCT"
  | "T2_TEXT"
  | "T3"
  | "REFUSE"
  | "NONE";

export type Category =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I";

/**
 * Minimal fact shape the metrics consume. The cascade returns Tier2FactRow but
 * we only need fact_text + render_disclaim_tag here.
 */
export interface ScoredFact {
  fact_text: string;
  render_disclaim_tag?: boolean;
}

/**
 * Per-query row that the harness produces. The aggregate functions consume
 * arrays of these.
 */
export interface PerQueryResult {
  id: string;
  category: Category;
  expected_tier: ExpectedTier;
  actual_tier: ActualTier;
  /** Top facts from the first-hit tier. */
  first_hit_facts: ScoredFact[];
  /** Union of facts across all tiers walked up to and including first-hit. */
  union_facts: ScoredFact[];
  expected_fact_substrings: string[];
  expected_render_tag: boolean;
  /**
   * Actual render-tag the renderer would show. By contract = the
   * `render_disclaim_tag` boolean on the FIRST fact of the first-hit tier (or
   * false if no fact and tier=REFUSE).
   */
  actual_render_tag: boolean;
  /**
   * True iff this query's expected tier is REFUSE AND the cascade still
   * produced retrieval candidates. Logged separately by refusalViolationRate.
   */
  refusal_violation?: boolean;
}

// -- Match predicate ----------------------------------------------------------

/**
 * A fact "matches" a labeled entry's expected substrings if the fact_text
 * contains any one of the expected substrings (case-insensitive, whitespace-
 * normalized). The labeled set lists multiple substrings per entry to absorb
 * synonym / phrasing drift in the cascade's returned facts. ANY one substring
 * hit counts the fact as relevant.
 *
 * If `expected` is empty (Cat F refusal entries), no fact can match — by
 * construction the relevance count is 0.
 */
export function factMatchesAny(
  fact: ScoredFact,
  expected: readonly string[],
): boolean {
  if (expected.length === 0) return false;
  const haystack = normalizeText(fact.fact_text);
  for (const needle of expected) {
    if (needle.length === 0) continue;
    if (haystack.includes(normalizeText(needle))) return true;
  }
  return false;
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// -- precision@3 --------------------------------------------------------------

/**
 * Among the top-3 facts from the first-hit tier, fraction that contain ANY
 * expected substring. Per spec §4.2: denominator is min(3, |candidates|), NOT
 * padded to 3. If fewer than 1 candidate, returns 0.
 */
export function precisionAt3(
  firstHitFacts: readonly ScoredFact[],
  expected: readonly string[],
): number {
  if (firstHitFacts.length === 0) return 0;
  const top = firstHitFacts.slice(0, 3);
  const denom = top.length; // min(3, |candidates|)
  let hits = 0;
  for (const f of top) {
    if (factMatchesAny(f, expected)) hits++;
  }
  return hits / denom;
}

// -- recall@5 -----------------------------------------------------------------

/**
 * Union of candidates across all traversed tiers up to and including first-
 * hit, capped at top 5. Per spec §4.3: numerator = relevant facts in union
 * top-5; denominator = labeled gold set size (we treat the labeled
 * `expected_fact_substrings` as a flat gold set; one alternate per entry
 * unless the labeler enumerated multiple).
 *
 * Implementation note: the labeled set provides a single conceptual gold
 * fact split into multiple substrings (all must conceptually appear in the
 * one right answer). For the starter set we treat the SET as the gold answer
 * — if any returned fact matches any substring, we count it as 1 unit of
 * coverage. Denominator is therefore 1, NOT len(expected). This matches the
 * spec's "Denominator is 1 unless `notes` lists alternates."
 */
export function recallAt5(
  unionFacts: readonly ScoredFact[],
  expected: readonly string[],
): number {
  if (expected.length === 0) return 0;
  const top = unionFacts.slice(0, 5);
  for (const f of top) {
    if (factMatchesAny(f, expected)) return 1;
  }
  return 0;
}

// -- MRR ----------------------------------------------------------------------

/**
 * Mean reciprocal rank over the first-hit tier's ranked list. Returns the
 * reciprocal-rank contribution for ONE query; the caller averages across
 * queries. If no fact matches, returns 0.
 */
export function reciprocalRank(
  firstHitFacts: readonly ScoredFact[],
  expected: readonly string[],
): number {
  if (firstHitFacts.length === 0 || expected.length === 0) return 0;
  for (let i = 0; i < firstHitFacts.length; i++) {
    if (factMatchesAny(firstHitFacts[i], expected)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

export function meanReciprocalRank(
  rows: readonly PerQueryResult[],
): number {
  const eligible = rows.filter((r) => r.category !== "F");
  if (eligible.length === 0) return 0;
  let sum = 0;
  for (const r of eligible) {
    sum += reciprocalRank(r.first_hit_facts, r.expected_fact_substrings);
  }
  return sum / eligible.length;
}

// -- Tier misclassification ---------------------------------------------------

export interface TierMisclassificationReport {
  /** Rate of queries (excluding Cat F) where actual_tier != expected_tier. */
  rate: number;
  /** Labeled T1 that first-hit on any T2_*. */
  t1_to_t2: number;
  /** Labeled T1 that first-hit on T3. The loud failure. */
  t1_to_t3: number;
  /** Labeled T2_HASH that first-hit on T2_STRUCT or T2_TEXT. */
  t2_hash_to_struct: number;
  /** Labeled T2_STRUCT that first-hit on T2_TEXT. */
  t2_struct_to_text: number;
  /** Any T2_* labeled query that escalated to T3. */
  t2_to_t3: number;
}

export function tierMisclassification(
  rows: readonly PerQueryResult[],
): TierMisclassificationReport {
  const eligible = rows.filter((r) => r.category !== "F");
  if (eligible.length === 0) {
    return {
      rate: 0,
      t1_to_t2: 0,
      t1_to_t3: 0,
      t2_hash_to_struct: 0,
      t2_struct_to_text: 0,
      t2_to_t3: 0,
    };
  }

  let mis = 0;
  let t1_to_t2 = 0;
  let t1_to_t3 = 0;
  let t2_hash_to_struct = 0;
  let t2_struct_to_text = 0;
  let t2_to_t3 = 0;

  for (const r of eligible) {
    const wrong = r.actual_tier !== r.expected_tier;
    if (wrong) mis++;

    if (r.expected_tier === "T1") {
      if (r.actual_tier.startsWith("T2_")) t1_to_t2++;
      if (r.actual_tier === "T3") t1_to_t3++;
    }
    if (r.expected_tier === "T2_HASH") {
      if (r.actual_tier === "T2_STRUCT" || r.actual_tier === "T2_TEXT") {
        t2_hash_to_struct++;
      }
    }
    if (r.expected_tier === "T2_STRUCT" && r.actual_tier === "T2_TEXT") {
      t2_struct_to_text++;
    }
    if (
      (r.expected_tier === "T2_HASH" ||
        r.expected_tier === "T2_STRUCT" ||
        r.expected_tier === "T2_TEXT") &&
      r.actual_tier === "T3"
    ) {
      t2_to_t3++;
    }
  }

  const n = eligible.length;
  return {
    rate: mis / n,
    t1_to_t2: t1_to_t2 / n,
    t1_to_t3: t1_to_t3 / n,
    t2_hash_to_struct: t2_hash_to_struct / n,
    t2_struct_to_text: t2_struct_to_text / n,
    t2_to_t3: t2_to_t3 / n,
  };
}

// -- disclaim_tag_correctness -------------------------------------------------

export interface DisclaimTagReport {
  /** Fraction of queries (excluding F) where actual_tag === expected_tag. */
  correctness: number;
  /** expected=false, actual=true. Hurts trust by tagging vetted answers. */
  over_disclaim_rate: number;
  /** expected=true, actual=false. THE DIRECTIONAL FAILURE per spec §4.6. */
  under_disclaim_rate: number;
}

/**
 * Per spec §4.6: every returned fact's `render_disclaim_tag` should match the
 * locked predicate `source === "web_search" && verification_status === "unverified"`.
 *
 * Practical signal at the query level: we compare the LEAD fact's
 * `render_disclaim_tag` (which is what the renderer will surface as the
 * bubble flag) against `expected_render_tag`. The locked predicate is
 * computed inside the cascade (vehicleFactsKB.ts:computeRenderDisclaimTag);
 * the harness consumes the boolean and trusts it — per ARCHITECTURE_v3
 * §F.5 we MUST NOT re-derive at the consumer.
 */
export function disclaimTagCorrectness(
  rows: readonly PerQueryResult[],
): DisclaimTagReport {
  const eligible = rows.filter((r) => r.category !== "F");
  if (eligible.length === 0) {
    return { correctness: 0, over_disclaim_rate: 0, under_disclaim_rate: 0 };
  }

  let correct = 0;
  let over = 0;
  let under = 0;

  for (const r of eligible) {
    if (r.actual_render_tag === r.expected_render_tag) correct++;
    if (r.actual_render_tag === true && r.expected_render_tag === false) over++;
    if (r.actual_render_tag === false && r.expected_render_tag === true) under++;
  }

  const n = eligible.length;
  return {
    correctness: correct / n,
    over_disclaim_rate: over / n,
    under_disclaim_rate: under / n,
  };
}

// -- Refusal violations -------------------------------------------------------

/**
 * Fraction of Cat F queries where the cascade produced retrieval candidates
 * at all. Cat F should always be REFUSE; any returned candidate counts as a
 * violation. If there are no Cat F rows, returns 0.
 */
export function refusalViolationRate(
  rows: readonly PerQueryResult[],
): number {
  const catF = rows.filter((r) => r.category === "F");
  if (catF.length === 0) return 0;
  let violations = 0;
  for (const r of catF) {
    // Either the harness pre-computed refusal_violation, or we derive it
    // from "actual_tier produced candidates."
    const hadCandidates =
      r.actual_tier !== "REFUSE" &&
      r.actual_tier !== "NONE" &&
      r.first_hit_facts.length > 0;
    if (r.refusal_violation === true || hadCandidates) violations++;
  }
  return violations / catF.length;
}

// -- Per-category aggregate ---------------------------------------------------

export interface CategoryAggregate {
  count: number;
  precision_at_3: number;
  recall_at_5: number;
  mrr: number;
  tier_misclass_rate: number;
  disclaim_tag_correctness: number;
}

export function aggregateByCategory(
  rows: readonly PerQueryResult[],
): Record<Category, CategoryAggregate | undefined> {
  const cats: Category[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
  const out: Record<Category, CategoryAggregate | undefined> = {
    A: undefined,
    B: undefined,
    C: undefined,
    D: undefined,
    E: undefined,
    F: undefined,
    G: undefined,
    H: undefined,
    I: undefined,
  };

  for (const cat of cats) {
    const sub = rows.filter((r) => r.category === cat);
    if (sub.length === 0) continue;

    if (cat === "F") {
      out[cat] = {
        count: sub.length,
        precision_at_3: 0,
        recall_at_5: 0,
        mrr: 0,
        tier_misclass_rate: refusalViolationRate(sub),
        disclaim_tag_correctness: 1, // F is always expected_tag=false
      };
      continue;
    }

    let p3Sum = 0;
    let r5Sum = 0;
    let rrSum = 0;
    let mis = 0;
    let tagCorrect = 0;
    for (const r of sub) {
      p3Sum += precisionAt3(r.first_hit_facts, r.expected_fact_substrings);
      r5Sum += recallAt5(r.union_facts, r.expected_fact_substrings);
      rrSum += reciprocalRank(r.first_hit_facts, r.expected_fact_substrings);
      if (r.actual_tier !== r.expected_tier) mis++;
      if (r.actual_render_tag === r.expected_render_tag) tagCorrect++;
    }
    out[cat] = {
      count: sub.length,
      precision_at_3: p3Sum / sub.length,
      recall_at_5: r5Sum / sub.length,
      mrr: rrSum / sub.length,
      tier_misclass_rate: mis / sub.length,
      disclaim_tag_correctness: tagCorrect / sub.length,
    };
  }

  return out;
}

// -- Top-level mean precision/recall ------------------------------------------

export function meanPrecisionAt3(rows: readonly PerQueryResult[]): number {
  const eligible = rows.filter((r) => r.category !== "F");
  if (eligible.length === 0) return 0;
  let sum = 0;
  for (const r of eligible) {
    sum += precisionAt3(r.first_hit_facts, r.expected_fact_substrings);
  }
  return sum / eligible.length;
}

export function meanRecallAt5(rows: readonly PerQueryResult[]): number {
  const eligible = rows.filter((r) => r.category !== "F");
  if (eligible.length === 0) return 0;
  let sum = 0;
  for (const r of eligible) {
    sum += recallAt5(r.union_facts, r.expected_fact_substrings);
  }
  return sum / eligible.length;
}

// -- Wilson 95% CI for pass-rate (N≥10 repeats, Doc 4 Wave 1.1) ---------------

/**
 * Wilson score interval — robust at small N (10–30) where Normal-approx is
 * skewed. Returns the [lo, hi] CI plus the point rate. z = 1.96 for 95% CI.
 *
 * Pure: no randomness, no clock. Deterministic given (passes, n).
 */
export function passRateWithConfidence(
  passes: number,
  n: number,
): { rate: number; ciLow: number; ciHigh: number } {
  if (n <= 0) return { rate: 0, ciLow: 0, ciHigh: 0 };
  const z = 1.96;
  const p = passes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return {
    rate: p,
    ciLow: Math.max(0, center - margin),
    ciHigh: Math.min(1, center + margin),
  };
}
