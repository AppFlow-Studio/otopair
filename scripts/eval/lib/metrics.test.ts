// =============================================================================
// metrics.test.ts — vitest-style unit tests for the pure metric functions
// =============================================================================
//
// IMPORTANT: vitest may not be installed yet (Sprint 1 Day 3 ships the eval
// harness; vitest is being added separately). To run:
//   npm i -D vitest
//   npx vitest run scripts/eval/lib/metrics.test.ts
//
// All tests are deterministic — the metric functions are pure (no Date, no
// I/O, no randomness), so these snapshots are stable across runs.
// =============================================================================

import { describe, expect, it } from "vitest";

import {
  disclaimTagCorrectness,
  factMatchesAny,
  meanPrecisionAt3,
  meanRecallAt5,
  meanReciprocalRank,
  passRateWithConfidence,
  precisionAt3,
  recallAt5,
  reciprocalRank,
  refusalViolationRate,
  tierMisclassification,
  type PerQueryResult,
} from "./metrics";

// -- factMatchesAny ----------------------------------------------------------

describe("factMatchesAny", () => {
  it("returns true when any substring matches (case-insensitive)", () => {
    expect(
      factMatchesAny(
        { fact_text: "Engine oil capacity is 3.7 quarts with filter change" },
        ["3.7 quarts"],
      ),
    ).toBe(true);
  });

  it("returns false when no substring matches", () => {
    expect(
      factMatchesAny({ fact_text: "Coolant is 6.9 quarts" }, ["3.7 quarts"]),
    ).toBe(false);
  });

  it("returns false when expected list is empty (Cat F refusal entries)", () => {
    expect(factMatchesAny({ fact_text: "anything" }, [])).toBe(false);
  });

  it("normalizes whitespace and case", () => {
    expect(
      factMatchesAny(
        { fact_text: "Audi 2.0T (CAEB)  is rated for  91 AKI Premium Unleaded" },
        ["91 aki"],
      ),
    ).toBe(true);
  });

  it("skips empty needles", () => {
    expect(factMatchesAny({ fact_text: "hello world" }, [""])).toBe(false);
  });
});

// -- precision@3 -------------------------------------------------------------

describe("precisionAt3", () => {
  it("returns 0 when no candidates", () => {
    expect(precisionAt3([], ["3.7 quarts"])).toBe(0);
  });

  it("returns 1.0 when all top-3 match", () => {
    const facts = [
      { fact_text: "Oil capacity is 3.7 quarts" },
      { fact_text: "Total fill 3.7 quarts" },
      { fact_text: "Drain-and-refill 3.7 quarts" },
    ];
    expect(precisionAt3(facts, ["3.7 quarts"])).toBe(1);
  });

  it("returns 1/3 when only one of three match", () => {
    const facts = [
      { fact_text: "Oil capacity is 3.7 quarts" },
      { fact_text: "Coolant capacity is 6.9 quarts" },
      { fact_text: "Brake fluid DOT 4" },
    ];
    expect(precisionAt3(facts, ["3.7 quarts"])).toBeCloseTo(1 / 3, 10);
  });

  it("does NOT pad denominator below 3 (spec §4.2)", () => {
    const facts = [{ fact_text: "Oil capacity is 3.7 quarts" }];
    expect(precisionAt3(facts, ["3.7 quarts"])).toBe(1); // 1/1, not 1/3
  });

  it("denominator is min(3, |candidates|) with 2 candidates", () => {
    const facts = [
      { fact_text: "Oil capacity is 3.7 quarts" },
      { fact_text: "Unrelated coolant fact" },
    ];
    expect(precisionAt3(facts, ["3.7 quarts"])).toBe(0.5);
  });
});

// -- recall@5 ----------------------------------------------------------------

describe("recallAt5", () => {
  it("returns 1 when any of top-5 union facts match", () => {
    const facts = [
      { fact_text: "Coolant capacity is 6.9 quarts" },
      { fact_text: "Brake fluid DOT 4" },
      { fact_text: "Oil capacity is 3.7 quarts" },
      { fact_text: "Tire pressure 32 psi" },
      { fact_text: "Spark plug gap 0.043 in" },
    ];
    expect(recallAt5(facts, ["3.7 quarts"])).toBe(1);
  });

  it("returns 0 when no top-5 union fact matches", () => {
    const facts = [
      { fact_text: "Coolant capacity is 6.9 quarts" },
      { fact_text: "Brake fluid DOT 4" },
    ];
    expect(recallAt5(facts, ["3.7 quarts"])).toBe(0);
  });

  it("only inspects top 5 (6th match doesn't count)", () => {
    const facts = [
      { fact_text: "unrelated 1" },
      { fact_text: "unrelated 2" },
      { fact_text: "unrelated 3" },
      { fact_text: "unrelated 4" },
      { fact_text: "unrelated 5" },
      { fact_text: "Oil capacity is 3.7 quarts" }, // rank 6 — out of window
    ];
    expect(recallAt5(facts, ["3.7 quarts"])).toBe(0);
  });

  it("returns 0 when expected is empty", () => {
    expect(recallAt5([{ fact_text: "anything" }], [])).toBe(0);
  });
});

// -- reciprocalRank / MRR ----------------------------------------------------

describe("reciprocalRank", () => {
  it("returns 1 when match is at rank 1", () => {
    expect(
      reciprocalRank(
        [{ fact_text: "Oil capacity is 3.7 quarts" }, { fact_text: "other" }],
        ["3.7 quarts"],
      ),
    ).toBe(1);
  });

  it("returns 0.5 when match is at rank 2", () => {
    expect(
      reciprocalRank(
        [{ fact_text: "other" }, { fact_text: "Oil capacity is 3.7 quarts" }],
        ["3.7 quarts"],
      ),
    ).toBe(0.5);
  });

  it("returns 0 when no match", () => {
    expect(
      reciprocalRank([{ fact_text: "other" }], ["3.7 quarts"]),
    ).toBe(0);
  });
});

describe("meanReciprocalRank", () => {
  it("averages reciprocal ranks across queries, excluding Cat F", () => {
    const rows: PerQueryResult[] = [
      mkRow({ id: "1", cat: "A", firstHit: [{ fact_text: "3.7 quarts" }], expected: ["3.7 quarts"] }), // rr=1
      mkRow({ id: "2", cat: "B", firstHit: [{ fact_text: "junk" }, { fact_text: "3.7 quarts" }], expected: ["3.7 quarts"] }), // rr=0.5
      mkRow({ id: "3", cat: "F", firstHit: [], expected: [] }), // excluded
    ];
    // mean of (1, 0.5) = 0.75
    expect(meanReciprocalRank(rows)).toBeCloseTo(0.75, 10);
  });
});

// -- tier_misclassification --------------------------------------------------

describe("tierMisclassification", () => {
  it("flags T1->T3 (the loud failure)", () => {
    const rows: PerQueryResult[] = [
      mkRow({ id: "1", cat: "A", expectedTier: "T1", actualTier: "T3" }),
    ];
    const r = tierMisclassification(rows);
    expect(r.rate).toBe(1);
    expect(r.t1_to_t3).toBe(1);
    expect(r.t1_to_t2).toBe(0);
  });

  it("flags T2_HASH->T2_TEXT as t2_hash_to_struct sub-rate", () => {
    const rows: PerQueryResult[] = [
      mkRow({ id: "1", cat: "B", expectedTier: "T2_HASH", actualTier: "T2_TEXT" }),
    ];
    const r = tierMisclassification(rows);
    expect(r.t2_hash_to_struct).toBe(1);
  });

  it("flags T2_STRUCT->T2_TEXT", () => {
    const rows: PerQueryResult[] = [
      mkRow({ id: "1", cat: "C", expectedTier: "T2_STRUCT", actualTier: "T2_TEXT" }),
    ];
    expect(tierMisclassification(rows).t2_struct_to_text).toBe(1);
  });

  it("flags any T2_*->T3 as t2_to_t3", () => {
    const rows: PerQueryResult[] = [
      mkRow({ id: "1", cat: "B", expectedTier: "T2_HASH", actualTier: "T3" }),
      mkRow({ id: "2", cat: "C", expectedTier: "T2_STRUCT", actualTier: "T3" }),
    ];
    expect(tierMisclassification(rows).t2_to_t3).toBe(1); // 2/2
  });

  it("excludes Cat F from base rate", () => {
    const rows: PerQueryResult[] = [
      mkRow({ id: "1", cat: "A", expectedTier: "T1", actualTier: "T1" }),
      mkRow({ id: "2", cat: "F", expectedTier: "REFUSE", actualTier: "REFUSE" }),
    ];
    expect(tierMisclassification(rows).rate).toBe(0); // 0/1, Cat F excluded
  });
});

// -- disclaim_tag_correctness ------------------------------------------------

describe("disclaimTagCorrectness", () => {
  it("under_disclaim: expected=true, actual=false — the DIRECTIONAL failure", () => {
    const rows: PerQueryResult[] = [
      mkRow({ id: "1", cat: "I", expectedTag: true, actualTag: false }),
    ];
    const r = disclaimTagCorrectness(rows);
    expect(r.under_disclaim_rate).toBe(1);
    expect(r.over_disclaim_rate).toBe(0);
    expect(r.correctness).toBe(0);
  });

  it("over_disclaim: expected=false, actual=true", () => {
    const rows: PerQueryResult[] = [
      mkRow({ id: "1", cat: "H", expectedTag: false, actualTag: true }),
    ];
    const r = disclaimTagCorrectness(rows);
    expect(r.over_disclaim_rate).toBe(1);
    expect(r.under_disclaim_rate).toBe(0);
  });

  it("perfect correctness when all match", () => {
    const rows: PerQueryResult[] = [
      mkRow({ id: "1", cat: "A", expectedTag: false, actualTag: false }),
      mkRow({ id: "2", cat: "E", expectedTag: true, actualTag: true }),
    ];
    expect(disclaimTagCorrectness(rows).correctness).toBe(1);
  });

  it("excludes Cat F from denominators", () => {
    const rows: PerQueryResult[] = [
      mkRow({ id: "1", cat: "A", expectedTag: false, actualTag: false }),
      mkRow({ id: "2", cat: "F", expectedTag: false, actualTag: true }),
    ];
    // Cat F excluded => 1/1 = 1.0
    expect(disclaimTagCorrectness(rows).correctness).toBe(1);
  });
});

// -- refusalViolationRate ----------------------------------------------------

describe("refusalViolationRate", () => {
  it("returns 0 when no Cat F rows present", () => {
    const rows: PerQueryResult[] = [mkRow({ id: "1", cat: "A" })];
    expect(refusalViolationRate(rows)).toBe(0);
  });

  it("counts Cat F violation when cascade produces facts", () => {
    const rows: PerQueryResult[] = [
      mkRow({
        id: "1",
        cat: "F",
        expectedTier: "REFUSE",
        actualTier: "T2_HASH",
        firstHit: [{ fact_text: "should not exist" }],
      }),
    ];
    expect(refusalViolationRate(rows)).toBe(1);
  });

  it("Cat F with REFUSE+no-facts is clean", () => {
    const rows: PerQueryResult[] = [
      mkRow({ id: "1", cat: "F", expectedTier: "REFUSE", actualTier: "REFUSE", firstHit: [] }),
    ];
    expect(refusalViolationRate(rows)).toBe(0);
  });
});

// -- passRateWithConfidence (Wilson CI) --------------------------------------

describe("passRateWithConfidence", () => {
  it("rate=1.0 with N=10 has tight upper CI and lower bound < 1", () => {
    const r = passRateWithConfidence(10, 10);
    expect(r.rate).toBe(1);
    expect(r.ciHigh).toBeCloseTo(1, 5);
    expect(r.ciLow).toBeGreaterThan(0.6); // Wilson 95% lower for 10/10 ≈ 0.722
    expect(r.ciLow).toBeLessThan(1);
  });

  it("rate=0.5 N=10 is symmetric-ish around 0.5", () => {
    const r = passRateWithConfidence(5, 10);
    expect(r.rate).toBe(0.5);
    expect(r.ciLow).toBeLessThan(0.5);
    expect(r.ciHigh).toBeGreaterThan(0.5);
    expect(r.ciHigh - 0.5).toBeCloseTo(0.5 - r.ciLow, 1); // roughly symmetric
  });

  it("N=0 returns zeros", () => {
    expect(passRateWithConfidence(0, 0)).toEqual({ rate: 0, ciLow: 0, ciHigh: 0 });
  });

  it("rate=0.0 with N=10 has lower bound 0 and upper bound > 0", () => {
    const r = passRateWithConfidence(0, 10);
    expect(r.rate).toBe(0);
    expect(r.ciLow).toBe(0);
    expect(r.ciHigh).toBeGreaterThan(0);
    expect(r.ciHigh).toBeLessThan(0.4); // upper ≈ 0.278
  });
});

// -- meanPrecisionAt3 / meanRecallAt5 ----------------------------------------

describe("meanPrecisionAt3", () => {
  it("averages across non-F rows", () => {
    const rows: PerQueryResult[] = [
      mkRow({ id: "1", cat: "A", firstHit: [{ fact_text: "3.7 quarts" }], expected: ["3.7 quarts"] }), // p3=1
      mkRow({ id: "2", cat: "B", firstHit: [{ fact_text: "junk" }, { fact_text: "other" }, { fact_text: "third" }], expected: ["3.7 quarts"] }), // p3=0
      mkRow({ id: "3", cat: "F", firstHit: [], expected: [] }), // excluded
    ];
    expect(meanPrecisionAt3(rows)).toBe(0.5); // (1+0)/2
  });
});

describe("meanRecallAt5", () => {
  it("averages across non-F rows", () => {
    const rows: PerQueryResult[] = [
      mkRow({ id: "1", cat: "A", union: [{ fact_text: "3.7 quarts" }], expected: ["3.7 quarts"] }), // r5=1
      mkRow({ id: "2", cat: "B", union: [{ fact_text: "junk" }], expected: ["3.7 quarts"] }), // r5=0
    ];
    expect(meanRecallAt5(rows)).toBe(0.5);
  });
});

// -- Helpers -----------------------------------------------------------------

function mkRow(opts: {
  id: string;
  cat: PerQueryResult["category"];
  expectedTier?: PerQueryResult["expected_tier"];
  actualTier?: PerQueryResult["actual_tier"];
  firstHit?: PerQueryResult["first_hit_facts"];
  union?: PerQueryResult["union_facts"];
  expected?: string[];
  expectedTag?: boolean;
  actualTag?: boolean;
}): PerQueryResult {
  return {
    id: opts.id,
    category: opts.cat,
    expected_tier: opts.expectedTier ?? "T1",
    actual_tier: opts.actualTier ?? opts.expectedTier ?? "T1",
    first_hit_facts: opts.firstHit ?? [],
    union_facts: opts.union ?? opts.firstHit ?? [],
    expected_fact_substrings: opts.expected ?? [],
    expected_render_tag: opts.expectedTag ?? false,
    actual_render_tag: opts.actualTag ?? opts.expectedTag ?? false,
  };
}
