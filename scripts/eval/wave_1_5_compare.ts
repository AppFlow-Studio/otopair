// =============================================================================
// Wave 1.5 — prompt-change delta comparator (Sprint 1 Day 5)
// =============================================================================
//
// Companion to docs/SPRINT_1/WAVE_1_5_PROMPT_CHANGE_PROTOCOL.md.
//
// Runs the Wave 5.1 labeled-set harness against TWO prompt versions and
// computes per-case + aggregate deltas with Wilson 95% CIs. Emits:
//   - delta.json (machine-readable, consumed by CI gate)
//   - delta.md   (human-readable, posted as the PR comment)
//
// Usage:
//   npx tsx scripts/eval/wave_1_5_compare.ts \
//     --baseline <commit-or-version> \
//     --candidate <commit-or-version> \
//     [--repeats 10] [--out scripts/eval/runs/compare/<PR>/]
//
// In CI: the workflow checks out the baseline commit, builds the prompt
// payload, sets OTO_PROMPT_VERSION_OVERRIDE=baseline-build, runs the
// cascadeClient in `live` mode; then it does the same for the candidate
// commit. Both runs share the SAME cascadeTier2 substrate (the cascade is
// deterministic by design — Doc 4 Wave 5.4), so the only delta between the
// two harness outputs is the prompt-driven judging of disclaim/tier/refusal
// behavior at the cascade entry layer.
//
// The gate is:
//   PASS iff
//     (a) no per-case regression: for every case, NOT (baseline - candidate
//         > 0.05 AND CIs disjoint)
//     (b) aggregate Wilcoxon signed-rank p > 0.05 (no systematic regression)
//     (c) the seven Wave 5.3 graduation-bar metrics still pass on candidate
//     (d) no case that was PASS at baseline went FAIL at candidate (binary)
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
  refusalViolationRate,
  reciprocalRank,
  tierMisclassification,
  type Category,
  type PerQueryResult,
} from "./lib/metrics";

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

interface CliArgs {
  mode: CascadeMode;
  repeats: number;
  fixture: string;
  outDir: string;
  baseline: string;
  candidate: string;
  perCaseDropThreshold: number; // default 0.05 per protocol §3(a)
}

function parseArgs(argv: string[]): CliArgs {
  const here = path.dirname(fileURLToPath(import.meta.url));
  let mode: CascadeMode = "mock";
  let repeats = 10;
  let fixture = path.join(here, "fixtures", "wave_5_1_labeled_set.jsonl");
  let outDir = path.join(here, "runs", "compare");
  let baseline = "";
  let candidate = "";
  let perCaseDropThreshold = 0.05;

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mock") mode = "mock";
    else if (a === "--live") mode = "live";
    else if (a === "--repeats") repeats = Number(argv[++i]);
    else if (a === "--fixture") fixture = argv[++i];
    else if (a === "--out") outDir = argv[++i];
    else if (a === "--baseline") baseline = argv[++i];
    else if (a === "--candidate") candidate = argv[++i];
    else if (a === "--per-case-threshold")
      perCaseDropThreshold = Number(argv[++i]);
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      printHelp();
      process.exit(1);
    }
  }

  if (!baseline || !candidate) {
    console.error("--baseline and --candidate are required");
    printHelp();
    process.exit(1);
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

  return {
    mode,
    repeats,
    fixture,
    outDir,
    baseline,
    candidate,
    perCaseDropThreshold,
  };
}

function printHelp(): void {
  console.log(`Usage: wave_1_5_compare --baseline <ver> --candidate <ver> [opts]

Required:
  --baseline <version>     baseline prompt version (commit, tag, or version string)
  --candidate <version>    candidate prompt version (commit, tag, or version string)

Optional:
  --mock                   use canned cascade results (default; CI uses --live)
  --live                   hit real Convex deployment
  --repeats N              repeats per case (default 10, Doc 4 Wave 1.1 floor)
  --fixture path           override labeled set path
  --out dir                output dir (default scripts/eval/runs/compare/)
  --per-case-threshold N   override 0.05 per-case drop threshold

Env (live mode):
  OTO_EVAL_CONVEX_URL          https://<deployment>.convex.cloud
  OTO_EVAL_CONVEX_KEY          bearer token
  OTO_PROMPT_VERSION_OVERRIDE  set by this script per run; cascadeClient reads it

Outputs:
  <out>/baseline.json    raw baseline harness output
  <out>/candidate.json   raw candidate harness output
  <out>/delta.json       machine-readable per-case + aggregate delta
  <out>/delta.md         human-readable PR-comment summary

Exit codes:
  0 — gate PASS, merge allowed
  1 — gate FAIL, merge blocked
`);
}

// -----------------------------------------------------------------------------
// Per-version run — wraps the Wave 5.1 harness's core loop. Reuses the metric
// functions in lib/metrics.ts so we keep one source of truth for the math.
// -----------------------------------------------------------------------------

interface PerCaseRun {
  id: string;
  category: Category;
  expected_tier: PerQueryResult["expected_tier"];
  actual_tier: PerQueryResult["actual_tier"];
  expected_render_tag: boolean;
  actual_render_tag: boolean;
  repeats: number;
  repeats_passed: number;
  pass_rate: number;
  pass_ci_low: number;
  pass_ci_high: number;
  precision_at_3: number;
  recall_at_5: number;
  rr: number;
  refusal_violation?: boolean;
}

interface VersionRun {
  version: string;
  num_queries: number;
  per_case: PerCaseRun[];
  aggregate: {
    precision_at_3: number;
    recall_at_5: number;
    mrr: number;
    tier_misclass_rate: number;
    disclaim_tag_correctness: number;
    over_disclaim_rate: number;
    under_disclaim_rate: number;
    refusal_violation_rate: number;
  };
}

async function loadFixture(filepath: string): Promise<LabeledEntry[]> {
  const buf = await fs.readFile(filepath, "utf8");
  const lines = buf.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((l, idx) => {
    try {
      return JSON.parse(l) as LabeledEntry;
    } catch (e) {
      throw new Error(
        `Fixture line ${idx + 1} bad JSON: ${(e as Error).message}`,
      );
    }
  });
}

async function runOneVersion(
  version: string,
  entries: LabeledEntry[],
  mode: CascadeMode,
  repeats: number,
): Promise<VersionRun> {
  // The cascadeClient reads OTO_PROMPT_VERSION_OVERRIDE; setting it scopes the
  // run to the named prompt version. In mock mode this is a no-op but we
  // still set it so the mock layer can key on it for diff-able mock outputs.
  process.env.OTO_PROMPT_VERSION_OVERRIDE = version;

  const perCase: PerCaseRun[] = [];
  const perQueryResults: PerQueryResult[] = [];

  for (const entry of entries) {
    let passes = 0;
    let canonical: CascadeResponse | null = null;
    for (let i = 0; i < repeats; i++) {
      const r = await runCascade(entry, mode);
      if (i === 0) canonical = r;
      const tierOk = r.resolved_tier === entry.expected_source_tier;
      const tagOk = r.actual_render_tag === entry.expected_render_tag;
      let factOk = true;
      if (entry.expected_source_tier !== "REFUSE") {
        factOk = precisionAt3(r.first_hit_facts, entry.expected_fact_substrings) > 0;
      } else {
        factOk = r.first_hit_facts.length === 0;
      }
      if (tierOk && tagOk && factOk) passes++;
    }
    const ci = passRateWithConfidence(passes, repeats);
    const c = canonical as CascadeResponse;

    const pqr: PerQueryResult = {
      id: entry.id,
      category: entry.category,
      expected_tier: entry.expected_source_tier,
      actual_tier: c.resolved_tier,
      first_hit_facts: c.first_hit_facts,
      union_facts: c.union_facts,
      expected_fact_substrings: entry.expected_fact_substrings,
      expected_render_tag: entry.expected_render_tag,
      actual_render_tag: c.actual_render_tag,
      refusal_violation:
        entry.expected_source_tier === "REFUSE" && c.first_hit_facts.length > 0,
    };
    perQueryResults.push(pqr);

    perCase.push({
      id: entry.id,
      category: entry.category,
      expected_tier: pqr.expected_tier,
      actual_tier: pqr.actual_tier,
      expected_render_tag: pqr.expected_render_tag,
      actual_render_tag: pqr.actual_render_tag,
      repeats,
      repeats_passed: passes,
      pass_rate: ci.rate,
      pass_ci_low: ci.ciLow,
      pass_ci_high: ci.ciHigh,
      precision_at_3: precisionAt3(c.first_hit_facts, entry.expected_fact_substrings),
      recall_at_5: recallAt5(c.union_facts, entry.expected_fact_substrings),
      rr: reciprocalRank(c.first_hit_facts, entry.expected_fact_substrings),
      refusal_violation: pqr.refusal_violation,
    });
  }

  const tm = tierMisclassification(perQueryResults);
  const dt = disclaimTagCorrectness(perQueryResults);
  return {
    version,
    num_queries: entries.length,
    per_case: perCase,
    aggregate: {
      precision_at_3: meanPrecisionAt3(perQueryResults),
      recall_at_5: meanRecallAt5(perQueryResults),
      mrr: meanReciprocalRank(perQueryResults),
      tier_misclass_rate: tm.rate,
      disclaim_tag_correctness: dt.correctness,
      over_disclaim_rate: dt.over_disclaim_rate,
      under_disclaim_rate: dt.under_disclaim_rate,
      refusal_violation_rate: refusalViolationRate(perQueryResults),
    },
  };
}

// -----------------------------------------------------------------------------
// Wilcoxon signed-rank test on paired pass-rates (one-sided: candidate < baseline)
//
// Pure function (no I/O, no clock, no randomness). Returns p-value via the
// normal approximation with continuity correction. For N >= 10 the
// approximation is acceptable; the test is conservative at the boundary, so
// a borderline p is more likely to fail than to falsely-pass — that's the
// right direction for a merge gate.
// -----------------------------------------------------------------------------

export function wilcoxonOneSided(
  baseline: number[],
  candidate: number[],
): { z: number; p: number; n_effective: number } {
  if (baseline.length !== candidate.length) {
    throw new Error("wilcoxonOneSided: arrays must have equal length");
  }
  const diffs: number[] = [];
  for (let i = 0; i < baseline.length; i++) {
    const d = baseline[i] - candidate[i]; // positive = candidate regressed
    if (d !== 0) diffs.push(d);
  }
  const n = diffs.length;
  if (n === 0) return { z: 0, p: 0.5, n_effective: 0 };

  // Rank |diffs| ascending, with average rank for ties.
  const abs = diffs.map((d, i) => ({ d, abs: Math.abs(d), i }));
  abs.sort((a, b) => a.abs - b.abs);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && abs[j + 1].abs === abs[i].abs) j++;
    const avg = (i + j + 2) / 2; // ranks are 1-based
    for (let k = i; k <= j; k++) ranks[abs[k].i] = avg;
    i = j + 1;
  }

  let wPlus = 0;
  for (let k = 0; k < n; k++) {
    if (diffs[k] > 0) wPlus += ranks[k];
  }

  const mean = (n * (n + 1)) / 4;
  const variance = (n * (n + 1) * (2 * n + 1)) / 24;
  // Continuity correction: subtract 0.5 in the direction of the alternative.
  // Alternative is "candidate < baseline" i.e. wPlus > mean.
  const z = (wPlus - mean - 0.5) / Math.sqrt(variance);
  // Upper-tail p-value via normal-approx (no Math.erf in node lib types, so
  // we use the Abramowitz & Stegun 7.1.26 approximation).
  const p = 1 - standardNormalCdf(z);
  return { z, p, n_effective: n };
}

// Abramowitz & Stegun 7.1.26 — pure, deterministic.
function standardNormalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

// -----------------------------------------------------------------------------
// Delta + gate
// -----------------------------------------------------------------------------

interface PerCaseDelta {
  id: string;
  category: Category;
  baseline_pass_rate: number;
  baseline_ci: [number, number];
  candidate_pass_rate: number;
  candidate_ci: [number, number];
  delta: number;
  regression: boolean;
  regression_reason: string | null;
  binary_pass_fail_flip: boolean;
}

interface DeltaReport {
  baseline_version: string;
  candidate_version: string;
  repeats: number;
  per_case_drop_threshold: number;
  per_case: PerCaseDelta[];
  baseline_aggregate: VersionRun["aggregate"];
  candidate_aggregate: VersionRun["aggregate"];
  aggregate_delta: {
    precision_at_3: number;
    recall_at_5: number;
    mrr: number;
    tier_misclass_rate: number;
    disclaim_tag_correctness: number;
    under_disclaim_rate: number;
    refusal_violation_rate: number;
  };
  wilcoxon: { z: number; p: number; n_effective: number };
  graduation_bar_candidate: Array<{ label: string; passed: boolean }>;
  regressing_cases: string[];
  pass_fail_flips: string[];
  gate: "PASS" | "FAIL";
  gate_failures: string[];
}

function computeDelta(
  baseline: VersionRun,
  candidate: VersionRun,
  perCaseDropThreshold: number,
): DeltaReport {
  // Per-case deltas. Pair by id; baseline and candidate must share id space.
  const byId = new Map(candidate.per_case.map((c) => [c.id, c]));
  const perCase: PerCaseDelta[] = [];
  for (const b of baseline.per_case) {
    const c = byId.get(b.id);
    if (!c) {
      throw new Error(
        `candidate run missing case ${b.id} — fixture mismatch between runs`,
      );
    }
    const delta = b.pass_rate - c.pass_rate; // positive = regression
    const ciDisjoint = c.pass_ci_high < b.pass_ci_low;
    // Regression iff drop > threshold AND CIs disjoint.
    const regression = delta > perCaseDropThreshold && ciDisjoint;
    const reason = regression
      ? `drop ${delta.toFixed(3)} > ${perCaseDropThreshold} AND CIs disjoint (cand_high=${c.pass_ci_high.toFixed(3)} < base_low=${b.pass_ci_low.toFixed(3)})`
      : null;
    const binaryFlip =
      b.repeats_passed === b.repeats && c.repeats_passed < c.repeats;
    perCase.push({
      id: b.id,
      category: b.category,
      baseline_pass_rate: b.pass_rate,
      baseline_ci: [b.pass_ci_low, b.pass_ci_high],
      candidate_pass_rate: c.pass_rate,
      candidate_ci: [c.pass_ci_low, c.pass_ci_high],
      delta,
      regression,
      regression_reason: reason,
      binary_pass_fail_flip: binaryFlip,
    });
  }

  // Wilcoxon on paired pass-rates.
  const baselineRates = perCase.map((c) => c.baseline_pass_rate);
  const candidateRates = perCase.map((c) => c.candidate_pass_rate);
  const wil = wilcoxonOneSided(baselineRates, candidateRates);

  // Graduation-bar check on candidate (Wave 5.3 floors).
  const ag = candidate.aggregate;
  const gradBar = [
    { label: "precision@3 ≥ 0.70", passed: ag.precision_at_3 >= 0.7 },
    { label: "recall@5 ≥ 0.80", passed: ag.recall_at_5 >= 0.8 },
    { label: "MRR ≥ 0.65", passed: ag.mrr >= 0.65 },
    { label: "tier_misclass ≤ 0.10", passed: ag.tier_misclass_rate <= 0.1 },
    { label: "disclaim_correct ≥ 0.95", passed: ag.disclaim_tag_correctness >= 0.95 },
    { label: "under_disclaim ≤ 0.02", passed: ag.under_disclaim_rate <= 0.02 },
    { label: "refusal_violation ≤ 0.05", passed: ag.refusal_violation_rate <= 0.05 },
  ];

  const regressingCases = perCase.filter((c) => c.regression).map((c) => c.id);
  const flips = perCase.filter((c) => c.binary_pass_fail_flip).map((c) => c.id);

  const failures: string[] = [];
  if (regressingCases.length > 0) {
    failures.push(`per-case regression on ${regressingCases.length} case(s): ${regressingCases.join(", ")}`);
  }
  if (wil.p < 0.05) {
    failures.push(`Wilcoxon signed-rank p=${wil.p.toFixed(4)} < 0.05 (candidate systematically regresses)`);
  }
  const gradFails = gradBar.filter((b) => !b.passed).map((b) => b.label);
  if (gradFails.length > 0) {
    failures.push(`graduation-bar floor breach: ${gradFails.join("; ")}`);
  }
  if (flips.length > 0) {
    failures.push(`pass→fail binary flip on ${flips.length} case(s): ${flips.join(", ")}`);
  }

  return {
    baseline_version: baseline.version,
    candidate_version: candidate.version,
    repeats: baseline.per_case[0]?.repeats ?? 0,
    per_case_drop_threshold: perCaseDropThreshold,
    per_case: perCase,
    baseline_aggregate: baseline.aggregate,
    candidate_aggregate: candidate.aggregate,
    aggregate_delta: {
      precision_at_3:
        candidate.aggregate.precision_at_3 - baseline.aggregate.precision_at_3,
      recall_at_5:
        candidate.aggregate.recall_at_5 - baseline.aggregate.recall_at_5,
      mrr: candidate.aggregate.mrr - baseline.aggregate.mrr,
      tier_misclass_rate:
        candidate.aggregate.tier_misclass_rate -
        baseline.aggregate.tier_misclass_rate,
      disclaim_tag_correctness:
        candidate.aggregate.disclaim_tag_correctness -
        baseline.aggregate.disclaim_tag_correctness,
      under_disclaim_rate:
        candidate.aggregate.under_disclaim_rate -
        baseline.aggregate.under_disclaim_rate,
      refusal_violation_rate:
        candidate.aggregate.refusal_violation_rate -
        baseline.aggregate.refusal_violation_rate,
    },
    wilcoxon: wil,
    graduation_bar_candidate: gradBar,
    regressing_cases: regressingCases,
    pass_fail_flips: flips,
    gate: failures.length === 0 ? "PASS" : "FAIL",
    gate_failures: failures,
  };
}

// -----------------------------------------------------------------------------
// Markdown summary (PR comment)
// -----------------------------------------------------------------------------

function fmtPct(x: number): string {
  return (x * 100).toFixed(1) + "%";
}
function fmtSignedPct(x: number): string {
  const s = (x * 100).toFixed(1);
  return x >= 0 ? `+${s}%` : `${s}%`;
}

function renderMarkdown(delta: DeltaReport): string {
  const lines: string[] = [];
  lines.push(`## Wave 1.5 prompt-change gate: **${delta.gate}**`);
  lines.push("");
  lines.push(`- baseline: \`${delta.baseline_version}\``);
  lines.push(`- candidate: \`${delta.candidate_version}\``);
  lines.push(`- repeats per case: ${delta.repeats}`);
  lines.push(`- per-case drop threshold: ${delta.per_case_drop_threshold}`);
  lines.push("");
  if (delta.gate === "FAIL") {
    lines.push(`### Gate failures (${delta.gate_failures.length})`);
    for (const f of delta.gate_failures) lines.push(`- ${f}`);
    lines.push("");
  }
  lines.push(`### Aggregate metrics`);
  lines.push("");
  lines.push(`| metric | baseline | candidate | delta |`);
  lines.push(`|---|---|---|---|`);
  const ag = delta.aggregate_delta;
  const b = delta.baseline_aggregate;
  const c = delta.candidate_aggregate;
  lines.push(`| precision@3 | ${fmtPct(b.precision_at_3)} | ${fmtPct(c.precision_at_3)} | ${fmtSignedPct(ag.precision_at_3)} |`);
  lines.push(`| recall@5 | ${fmtPct(b.recall_at_5)} | ${fmtPct(c.recall_at_5)} | ${fmtSignedPct(ag.recall_at_5)} |`);
  lines.push(`| MRR | ${fmtPct(b.mrr)} | ${fmtPct(c.mrr)} | ${fmtSignedPct(ag.mrr)} |`);
  lines.push(`| tier_misclass | ${fmtPct(b.tier_misclass_rate)} | ${fmtPct(c.tier_misclass_rate)} | ${fmtSignedPct(ag.tier_misclass_rate)} |`);
  lines.push(`| disclaim_correct | ${fmtPct(b.disclaim_tag_correctness)} | ${fmtPct(c.disclaim_tag_correctness)} | ${fmtSignedPct(ag.disclaim_tag_correctness)} |`);
  lines.push(`| under_disclaim | ${fmtPct(b.under_disclaim_rate)} | ${fmtPct(c.under_disclaim_rate)} | ${fmtSignedPct(ag.under_disclaim_rate)} |`);
  lines.push(`| refusal_violation | ${fmtPct(b.refusal_violation_rate)} | ${fmtPct(c.refusal_violation_rate)} | ${fmtSignedPct(ag.refusal_violation_rate)} |`);
  lines.push("");
  lines.push(`### Aggregate Wilcoxon signed-rank (one-sided: candidate < baseline)`);
  lines.push(`- z = ${delta.wilcoxon.z.toFixed(3)}, p = ${delta.wilcoxon.p.toFixed(4)}, n_eff = ${delta.wilcoxon.n_effective}`);
  lines.push(`- ${delta.wilcoxon.p < 0.05 ? "FAIL — systematic regression" : "PASS — no systematic regression"}`);
  lines.push("");
  lines.push(`### Wave 5.3 graduation-bar (candidate)`);
  for (const g of delta.graduation_bar_candidate) {
    lines.push(`- ${g.passed ? "PASS" : "FAIL"} ${g.label}`);
  }
  lines.push("");
  if (delta.regressing_cases.length > 0) {
    lines.push(`### Per-case regressions (${delta.regressing_cases.length})`);
    lines.push("");
    lines.push(`| case | cat | baseline | candidate | delta | reason |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const id of delta.regressing_cases) {
      const c = delta.per_case.find((x) => x.id === id)!;
      lines.push(
        `| ${c.id} | ${c.category} | ${fmtPct(c.baseline_pass_rate)} [${fmtPct(c.baseline_ci[0])}..${fmtPct(c.baseline_ci[1])}] | ${fmtPct(c.candidate_pass_rate)} [${fmtPct(c.candidate_ci[0])}..${fmtPct(c.candidate_ci[1])}] | ${fmtSignedPct(-c.delta)} | ${c.regression_reason} |`,
      );
    }
    lines.push("");
  }
  if (delta.pass_fail_flips.length > 0) {
    lines.push(`### Binary PASS→FAIL flips (${delta.pass_fail_flips.length})`);
    for (const id of delta.pass_fail_flips) lines.push(`- ${id}`);
    lines.push("");
  }
  lines.push(`### All cases`);
  lines.push("");
  lines.push(`<details><summary>${delta.per_case.length} cases</summary>`);
  lines.push("");
  lines.push(`| case | cat | baseline | candidate | delta |`);
  lines.push(`|---|---|---|---|---|`);
  for (const c of delta.per_case) {
    const flag = c.regression ? "REG" : c.binary_pass_fail_flip ? "FLIP" : "ok";
    lines.push(
      `| ${c.id} (${flag}) | ${c.category} | ${fmtPct(c.baseline_pass_rate)} | ${fmtPct(c.candidate_pass_rate)} | ${fmtSignedPct(-c.delta)} |`,
    );
  }
  lines.push("");
  lines.push(`</details>`);
  return lines.join("\n");
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const entries = await loadFixture(args.fixture);

  console.log(`Wave 1.5 compare: baseline=${args.baseline} candidate=${args.candidate}`);
  console.log(`mode=${args.mode} repeats=${args.repeats} cases=${entries.length}`);

  console.log("\n[1/2] Running baseline...");
  const baseline = await runOneVersion(args.baseline, entries, args.mode, args.repeats);
  console.log("[2/2] Running candidate...");
  const candidate = await runOneVersion(args.candidate, entries, args.mode, args.repeats);

  const delta = computeDelta(baseline, candidate, args.perCaseDropThreshold);

  await fs.mkdir(args.outDir, { recursive: true });
  const baselinePath = path.join(args.outDir, "baseline.json");
  const candidatePath = path.join(args.outDir, "candidate.json");
  const deltaJsonPath = path.join(args.outDir, "delta.json");
  const deltaMdPath = path.join(args.outDir, "delta.md");

  await fs.writeFile(baselinePath, JSON.stringify(baseline, null, 2), "utf8");
  await fs.writeFile(candidatePath, JSON.stringify(candidate, null, 2), "utf8");
  await fs.writeFile(deltaJsonPath, JSON.stringify(delta, null, 2), "utf8");
  await fs.writeFile(deltaMdPath, renderMarkdown(delta), "utf8");

  console.log("");
  console.log("=".repeat(72));
  console.log(`Gate: ${delta.gate}`);
  if (delta.gate === "FAIL") {
    for (const f of delta.gate_failures) console.log(`  - ${f}`);
  }
  console.log("=".repeat(72));
  console.log(`baseline:  ${baselinePath}`);
  console.log(`candidate: ${candidatePath}`);
  console.log(`delta:     ${deltaJsonPath}`);
  console.log(`comment:   ${deltaMdPath}`);

  process.exit(delta.gate === "PASS" ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(2);
});
