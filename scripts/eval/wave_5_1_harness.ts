// =============================================================================
// Wave 5.1 — labeled retrieval eval harness (Sprint 1 Day 3)
// =============================================================================
//
// Run:
//   npx tsx scripts/eval/wave_5_1_harness.ts --mock
//   npx tsx scripts/eval/wave_5_1_harness.ts --live --repeats 10
//
// CLI args:
//   --mock                 use canned cascade results (default if no env)
//   --live                 hit the real Convex deployment
//   --repeats N            repeats per query (default 10, Wave 1.1 floor)
//   --fixture path/...     override path to the JSONL labeled set
//   --out path/...         override output directory (default scripts/eval/runs/)
//
// Env vars (live mode):
//   OTO_EVAL_CONVEX_URL    https://<deployment>.convex.cloud
//   OTO_EVAL_CONVEX_KEY    bearer token
//
// Outputs:
//   scripts/eval/runs/<ISO_TIMESTAMP>.json        full report
//   scripts/eval/runs/<ISO_TIMESTAMP>.txt         human-readable summary
//
// Doc 3 §6 charter: N≥10 repeats per case with statistical thresholds.
// cascadeTier2 is deterministic so the repeats here should produce identical
// results per case; the structural N≥10 invariant is preserved so the SAME
// harness can run Wave 1.4 boundary cases (LLM-judge) without re-plumbing.
// =============================================================================

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runCascade,
  type CascadeMode,
  type CascadeResponse,
  type LabeledEntry,
} from "./lib/cascadeClient";
import {
  aggregateByCategory,
  disclaimTagCorrectness,
  meanPrecisionAt3,
  meanRecallAt5,
  meanReciprocalRank,
  passRateWithConfidence,
  precisionAt3,
  recallAt5,
  reciprocalRank,
  refusalViolationRate,
  tierMisclassification,
  type Category,
  type PerQueryResult,
} from "./lib/metrics";

// -- CLI parsing --------------------------------------------------------------

interface CliArgs {
  mode: CascadeMode;
  repeats: number;
  fixture: string;
  outDir: string;
}

function parseArgs(argv: string[]): CliArgs {
  const here = path.dirname(fileURLToPath(import.meta.url));
  let mode: CascadeMode = "mock";
  let repeats = 10;
  let fixture = path.join(here, "fixtures", "wave_5_1_labeled_set.jsonl");
  let outDir = path.join(here, "runs");

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mock") mode = "mock";
    else if (a === "--live") mode = "live";
    else if (a === "--repeats") repeats = Number(argv[++i]);
    else if (a === "--fixture") fixture = argv[++i];
    else if (a === "--out") outDir = argv[++i];
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      printHelp();
      process.exit(1);
    }
  }

  if (!Number.isFinite(repeats) || repeats < 1) {
    console.error(`--repeats must be a positive integer; got ${repeats}`);
    process.exit(1);
  }
  if (repeats < 10) {
    console.warn(
      `WARN: --repeats=${repeats} is below Doc 4 Wave 1.1 floor of N≥10. Continuing.`,
    );
  }

  return { mode, repeats, fixture, outDir };
}

function printHelp(): void {
  console.log(`Usage: wave_5_1_harness [--mock|--live] [--repeats N] [--fixture path] [--out dir]

Env (live mode):
  OTO_EVAL_CONVEX_URL   https://<deployment>.convex.cloud
  OTO_EVAL_CONVEX_KEY   bearer token

Outputs:
  <outDir>/<timestamp>.json   full machine-readable report
  <outDir>/<timestamp>.txt    human-readable summary
`);
}

// -- Fixture loader -----------------------------------------------------------

async function loadFixture(filepath: string): Promise<LabeledEntry[]> {
  const buf = await fs.readFile(filepath, "utf8");
  const lines = buf.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out: LabeledEntry[] = [];
  for (const [idx, line] of lines.entries()) {
    try {
      out.push(JSON.parse(line) as LabeledEntry);
    } catch (e) {
      throw new Error(
        `Fixture line ${idx + 1} is not valid JSON: ${(e as Error).message}`,
      );
    }
  }
  return out;
}

// -- Per-query driver --------------------------------------------------------

interface RepeatResult {
  cascade: CascadeResponse;
  pass: boolean;
}

interface PerQueryReport extends PerQueryResult {
  repeats: number;
  repeats_passed: number;
  pass_rate: number;
  pass_ci_low: number;
  pass_ci_high: number;
  precision_at_3: number;
  recall_at_5: number;
  rr: number;
}

async function runQuery(
  entry: LabeledEntry,
  mode: CascadeMode,
  repeats: number,
): Promise<PerQueryReport> {
  const results: RepeatResult[] = [];
  for (let i = 0; i < repeats; i++) {
    const cascade = await runCascade(entry, mode);
    // A repeat "passes" iff tier matches expected AND render_tag matches AND
    // (for retrieval cases) at least one fact in top-3 matches expected
    // substrings. For Cat F: pass iff resolved_tier=="REFUSE" with no facts.
    const tierOk = cascade.resolved_tier === entry.expected_source_tier;
    const tagOk = cascade.actual_render_tag === entry.expected_render_tag;
    let factOk = true;
    if (entry.expected_source_tier !== "REFUSE") {
      const p3 = precisionAt3(
        cascade.first_hit_facts,
        entry.expected_fact_substrings,
      );
      factOk = p3 > 0;
    } else {
      factOk = cascade.first_hit_facts.length === 0;
    }
    results.push({ cascade, pass: tierOk && tagOk && factOk });
  }

  // For deterministic cascades (cascadeTier2 is) the repeats are identical;
  // we keep the first as the canonical reading. The N>1 structure exists for
  // when this harness later drives LLM-judge boundary cases (non-determ).
  const canonical = results[0].cascade;
  const passes = results.filter((r) => r.pass).length;
  const ci = passRateWithConfidence(passes, results.length);

  const perQuery: PerQueryResult = {
    id: entry.id,
    category: entry.category,
    expected_tier: entry.expected_source_tier,
    actual_tier: canonical.resolved_tier,
    first_hit_facts: canonical.first_hit_facts,
    union_facts: canonical.union_facts,
    expected_fact_substrings: entry.expected_fact_substrings,
    expected_render_tag: entry.expected_render_tag,
    actual_render_tag: canonical.actual_render_tag,
    refusal_violation:
      entry.expected_source_tier === "REFUSE" &&
      canonical.first_hit_facts.length > 0,
  };

  return {
    ...perQuery,
    repeats: results.length,
    repeats_passed: passes,
    pass_rate: ci.rate,
    pass_ci_low: ci.ciLow,
    pass_ci_high: ci.ciHigh,
    precision_at_3: precisionAt3(canonical.first_hit_facts, entry.expected_fact_substrings),
    recall_at_5: recallAt5(canonical.union_facts, entry.expected_fact_substrings),
    rr: reciprocalRank(canonical.first_hit_facts, entry.expected_fact_substrings),
  };
}

// -- Aggregate / report shape -------------------------------------------------

interface Report {
  run_id: string;
  started_at: string;
  completed_at: string;
  mode: CascadeMode;
  repeats: number;
  num_queries: number;
  num_passed: number;
  metrics: {
    precision_at_3: number;
    recall_at_5: number;
    mrr: number;
    tier_misclassification: ReturnType<typeof tierMisclassification>;
    disclaim_tag_correctness: ReturnType<typeof disclaimTagCorrectness>;
    refusal_violation_rate: number;
  };
  per_category: Record<Category, unknown>;
  per_query: PerQueryReport[];
}

// -- Summary printer ----------------------------------------------------------

function fmtPct(x: number): string {
  return (x * 100).toFixed(1).padStart(5) + "%";
}

function renderSummary(r: Report): string {
  const lines: string[] = [];
  lines.push("=".repeat(72));
  lines.push(`Wave 5.1 eval — run ${r.run_id}`);
  lines.push(
    `mode=${r.mode}  repeats=${r.repeats}  queries=${r.num_queries}  passed=${r.num_passed}/${r.num_queries}`,
  );
  lines.push(`started=${r.started_at}  completed=${r.completed_at}`);
  lines.push("=".repeat(72));
  lines.push("");
  lines.push("Top-line metrics (excluding Cat F)");
  lines.push("-".repeat(72));
  lines.push(`  precision@3            ${fmtPct(r.metrics.precision_at_3)}`);
  lines.push(`  recall@5               ${fmtPct(r.metrics.recall_at_5)}`);
  lines.push(`  MRR                    ${fmtPct(r.metrics.mrr)}`);
  lines.push(`  tier_misclass_rate     ${fmtPct(r.metrics.tier_misclassification.rate)}`);
  lines.push(`    T1 -> T2_*           ${fmtPct(r.metrics.tier_misclassification.t1_to_t2)}`);
  lines.push(`    T1 -> T3 (LOUD)      ${fmtPct(r.metrics.tier_misclassification.t1_to_t3)}`);
  lines.push(`    T2_HASH -> STRUCT/TX ${fmtPct(r.metrics.tier_misclassification.t2_hash_to_struct)}`);
  lines.push(`    T2_STRUCT -> TEXT    ${fmtPct(r.metrics.tier_misclassification.t2_struct_to_text)}`);
  lines.push(`    T2_* -> T3 (LOUD)    ${fmtPct(r.metrics.tier_misclassification.t2_to_t3)}`);
  lines.push(`  disclaim_tag_correct   ${fmtPct(r.metrics.disclaim_tag_correctness.correctness)}`);
  lines.push(`    over_disclaim_rate   ${fmtPct(r.metrics.disclaim_tag_correctness.over_disclaim_rate)}`);
  lines.push(`    under_disclaim_rate  ${fmtPct(r.metrics.disclaim_tag_correctness.under_disclaim_rate)}  <- DIRECTIONAL FAILURE`);
  lines.push(`  refusal_violation_rate ${fmtPct(r.metrics.refusal_violation_rate)}`);
  lines.push("");
  lines.push("Wave 5.3 graduation bar (composite acceptance)");
  lines.push("-".repeat(72));
  const bar = [
    ["precision@3 ≥ 0.70", r.metrics.precision_at_3 >= 0.7],
    ["recall@5 ≥ 0.80", r.metrics.recall_at_5 >= 0.8],
    ["MRR ≥ 0.65", r.metrics.mrr >= 0.65],
    ["tier_misclass ≤ 0.10", r.metrics.tier_misclassification.rate <= 0.1],
    ["disclaim_correct ≥ 0.95", r.metrics.disclaim_tag_correctness.correctness >= 0.95],
    ["under_disclaim ≤ 0.02", r.metrics.disclaim_tag_correctness.under_disclaim_rate <= 0.02],
    ["refusal_violation ≤ 0.05", r.metrics.refusal_violation_rate <= 0.05],
  ];
  for (const [label, ok] of bar) {
    lines.push(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  }
  lines.push("");
  lines.push("Per-category breakdown");
  lines.push("-".repeat(72));
  lines.push("  cat  n   p@3    r@5    mrr    tier-mis  tag-corr");
  for (const cat of ["A", "B", "C", "D", "E", "F", "G", "H", "I"] as Category[]) {
    const agg = r.per_category[cat] as
      | {
          count: number;
          precision_at_3: number;
          recall_at_5: number;
          mrr: number;
          tier_misclass_rate: number;
          disclaim_tag_correctness: number;
        }
      | undefined;
    if (!agg) continue;
    lines.push(
      `  ${cat}    ${String(agg.count).padStart(2)}  ${fmtPct(agg.precision_at_3)} ${fmtPct(agg.recall_at_5)} ${fmtPct(agg.mrr)} ${fmtPct(agg.tier_misclass_rate)}  ${fmtPct(agg.disclaim_tag_correctness)}`,
    );
  }
  lines.push("");
  lines.push("Per-query pass-rates (N=" + r.repeats + " repeats, 95% Wilson CI)");
  lines.push("-".repeat(72));
  for (const q of r.per_query) {
    const flag = q.actual_tier === q.expected_tier ? "  " : "!!";
    lines.push(
      `  ${flag} ${q.id} [${q.category}]  exp=${q.expected_tier.padEnd(8)} got=${q.actual_tier.padEnd(8)}  pass=${q.repeats_passed}/${q.repeats} (${fmtPct(q.pass_rate)} [${fmtPct(q.pass_ci_low)}..${fmtPct(q.pass_ci_high)}])  p@3=${q.precision_at_3.toFixed(2)} r@5=${q.recall_at_5.toFixed(2)} rr=${q.rr.toFixed(2)}`,
    );
  }
  lines.push("=".repeat(72));
  return lines.join("\n");
}

// -- Main --------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const entries = await loadFixture(args.fixture);

  const startedAt = new Date().toISOString();
  const runId = startedAt.replace(/[:.]/g, "-");

  const perQuery: PerQueryReport[] = [];
  for (const entry of entries) {
    const rep = await runQuery(entry, args.mode, args.repeats);
    perQuery.push(rep);
  }
  const completedAt = new Date().toISOString();

  const perQueryResults: PerQueryResult[] = perQuery.map((q) => ({
    id: q.id,
    category: q.category,
    expected_tier: q.expected_tier,
    actual_tier: q.actual_tier,
    first_hit_facts: q.first_hit_facts,
    union_facts: q.union_facts,
    expected_fact_substrings: q.expected_fact_substrings,
    expected_render_tag: q.expected_render_tag,
    actual_render_tag: q.actual_render_tag,
    refusal_violation: q.refusal_violation,
  }));

  const passedQueries = perQuery.filter((q) => q.repeats_passed === q.repeats).length;
  const report: Report = {
    run_id: runId,
    started_at: startedAt,
    completed_at: completedAt,
    mode: args.mode,
    repeats: args.repeats,
    num_queries: entries.length,
    num_passed: passedQueries,
    metrics: {
      precision_at_3: meanPrecisionAt3(perQueryResults),
      recall_at_5: meanRecallAt5(perQueryResults),
      mrr: meanReciprocalRank(perQueryResults),
      tier_misclassification: tierMisclassification(perQueryResults),
      disclaim_tag_correctness: disclaimTagCorrectness(perQueryResults),
      refusal_violation_rate: refusalViolationRate(perQueryResults),
    },
    per_category: aggregateByCategory(perQueryResults) as Record<Category, unknown>,
    per_query: perQuery,
  };

  await fs.mkdir(args.outDir, { recursive: true });
  const jsonPath = path.join(args.outDir, `${runId}.json`);
  const txtPath = path.join(args.outDir, `${runId}.txt`);
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  const summary = renderSummary(report);
  await fs.writeFile(txtPath, summary, "utf8");
  console.log(summary);
  console.log(`\nReport JSON: ${jsonPath}`);
  console.log(`Summary:     ${txtPath}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
