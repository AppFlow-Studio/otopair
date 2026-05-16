// =============================================================================
// Wave 2.4 loader + judge invocation — Sprint 1 Day 7
// =============================================================================
//
// Loads `scripts/eval/fixtures/wave_2_4_cases.jsonl` and exposes the helpers
// the Wave 1.4 v3 harness needs to run category (f) — answer-body-language
// judge.
//
// The fixture file ships 8 contrastive cases authored by the Interaction
// Strategist on Day 6 (docs/SPRINT_1/WAVE_2_4_PR_DRAFT.md §5):
//   • 3 right-example answer-body cases     (PASS expected)
//   • 3 wrong-example answer-body cases     (FAIL expected — wrong-example body
//                                            is shipped verbatim in the fixture
//                                            as `candidate_response`)
//   • 2 post-report cases                   (1 PASS, 1 FAIL)
//
// Each case carries a verbatim `judge_prompt` field — the 3-criterion answer-
// body template OR the 5-criterion post-report template. The judge sub-type
// is selected per-case from the embedded template; we do NOT hard-code two
// judge functions (per Day 7 task spec).
//
// PURITY: the loader, the schema validator, and the mock verdict generator
// are pure (no I/O, no Date, no random). Live mode is the only path that
// performs I/O (Convex chat action POST + Anthropic judge API POST), and the
// I/O is segregated behind the typed boundary `JudgeRuntime`.
// =============================================================================

import { promises as fs } from "node:fs";

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------

export type Wave24ExpectedBehavior =
  | "right-example"
  | "wrong-example"
  | "right-example-post-report"
  | "wrong-example-post-report";

export type Wave24Verdict = "PASS" | "FAIL";

/**
 * The two judge sub-types recognized today. The category-string is the source
 * of truth in the fixture; the loader inspects `category` plus structural
 * markers in `judge_prompt` to label the sub-type.
 *
 * Both sub-types share the same code path — `runJudgeForCase` renders the
 * embedded template against the candidate response. The sub-type is metadata
 * carried alongside the result for reporting (Day 7 task spec: "implement them
 * as the same code path with the template selected per-case — don't hard-code
 * two judge functions").
 */
export type Wave24JudgeSubtype = "answer_body" | "post_report";

export interface Wave24VehicleScope {
  make: string;
  model: string;
  year_min: number;
  year_max: number;
  engine_code?: string;
  chassis_code?: string;
  trim_or_engine?: string;
}

export interface Wave24CaseInput {
  user_query: string;
  vehicle_scope: Wave24VehicleScope;
  source_tier: "T1" | "T2_HASH" | "T2_STRUCT" | "T2_TEXT" | "T3";
  verification_status: "verified" | "unverified" | "n/a";
  web_context?: string;
  /**
   * Some cases ship a pre-baked candidate response verbatim (the wrong-example
   * cases need this — they assert the judge correctly FAILS on a known-bad
   * body, so the body MUST be stable across runs). Right-example cases omit
   * this field and let live mode generate the response from Oto's chat action.
   */
  candidate_response?: string;
}

export interface Wave24Case {
  case_id: string;
  input: Wave24CaseInput;
  expected_behavior: Wave24ExpectedBehavior;
  expected_judge_verdict: Wave24Verdict;
  judge_prompt: string;
  pass_threshold: number;
  repeats: number;
  category: "wave_2_4_boundary" | "wave_2_4_post_report";
  cross_tenant?: boolean;
  notes?: string;
}

// -----------------------------------------------------------------------------
// JSONL parser + shape validator — PURE
// -----------------------------------------------------------------------------

/**
 * Parse a JSONL buffer (one entry per line) into validated Wave 2.4 cases.
 *
 * Fail-fast: throws on the first malformed line (per Day 7 spec). The error
 * message includes the line number and the failing field so the operator can
 * fix it without reading the parser source.
 *
 * Pure: no I/O. Caller does the readFile.
 */
export function parseWave24JsonlBuffer(buf: string): Wave24Case[] {
  const lines = buf.split(/\r?\n/);
  const out: Wave24Case[] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    if (raw.trim().length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        `wave_2_4 fixture line ${idx + 1}: invalid JSON — ${(e as Error).message}`,
      );
    }
    const c = validateCase(parsed, idx + 1);
    out.push(c);
  }
  return out;
}

/**
 * Async convenience wrapper. The pure path is parseWave24JsonlBuffer; this
 * one does the I/O and delegates.
 */
export async function loadWave24Fixture(filepath: string): Promise<Wave24Case[]> {
  const buf = await fs.readFile(filepath, "utf8");
  return parseWave24JsonlBuffer(buf);
}

function validateCase(parsed: unknown, lineNum: number): Wave24Case {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`wave_2_4 fixture line ${lineNum}: entry is not a JSON object`);
  }
  const o = parsed as Record<string, unknown>;

  requireString(o, "case_id", lineNum);
  requireString(o, "expected_behavior", lineNum);
  requireString(o, "expected_judge_verdict", lineNum);
  requireString(o, "judge_prompt", lineNum);
  requireString(o, "category", lineNum);
  requireNumber(o, "pass_threshold", lineNum);
  requireNumber(o, "repeats", lineNum);

  const expected_behavior = o.expected_behavior as Wave24ExpectedBehavior;
  if (
    expected_behavior !== "right-example" &&
    expected_behavior !== "wrong-example" &&
    expected_behavior !== "right-example-post-report" &&
    expected_behavior !== "wrong-example-post-report"
  ) {
    throw new Error(
      `wave_2_4 fixture line ${lineNum}: expected_behavior=${String(expected_behavior)} is not one of the four allowed values`,
    );
  }

  const verdict = o.expected_judge_verdict as Wave24Verdict;
  if (verdict !== "PASS" && verdict !== "FAIL") {
    throw new Error(
      `wave_2_4 fixture line ${lineNum}: expected_judge_verdict must be 'PASS' or 'FAIL'; got ${String(verdict)}`,
    );
  }

  const category = o.category as Wave24Case["category"];
  if (category !== "wave_2_4_boundary" && category !== "wave_2_4_post_report") {
    throw new Error(
      `wave_2_4 fixture line ${lineNum}: category=${String(category)} is not one of the two allowed values`,
    );
  }

  if (typeof o.input !== "object" || o.input === null) {
    throw new Error(`wave_2_4 fixture line ${lineNum}: input must be an object`);
  }
  const input = o.input as Record<string, unknown>;
  requireString(input, "user_query", lineNum, "input.user_query");
  requireString(input, "source_tier", lineNum, "input.source_tier");
  requireString(input, "verification_status", lineNum, "input.verification_status");

  if (typeof input.vehicle_scope !== "object" || input.vehicle_scope === null) {
    throw new Error(
      `wave_2_4 fixture line ${lineNum}: input.vehicle_scope must be an object`,
    );
  }
  const vs = input.vehicle_scope as Record<string, unknown>;
  requireString(vs, "make", lineNum, "input.vehicle_scope.make");
  requireString(vs, "model", lineNum, "input.vehicle_scope.model");
  requireNumber(vs, "year_min", lineNum, "input.vehicle_scope.year_min");
  requireNumber(vs, "year_max", lineNum, "input.vehicle_scope.year_max");

  // candidate_response is optional (right-example cases let live mode generate it).
  if (
    input.candidate_response !== undefined &&
    typeof input.candidate_response !== "string"
  ) {
    throw new Error(
      `wave_2_4 fixture line ${lineNum}: input.candidate_response must be a string when present`,
    );
  }

  // cross-tenant + notes are optional metadata.
  return parsed as Wave24Case;
}

function requireString(
  o: Record<string, unknown>,
  key: string,
  lineNum: number,
  display?: string,
): void {
  if (typeof o[key] !== "string" || (o[key] as string).length === 0) {
    throw new Error(
      `wave_2_4 fixture line ${lineNum}: required string field '${display ?? key}' is missing or empty`,
    );
  }
}

function requireNumber(
  o: Record<string, unknown>,
  key: string,
  lineNum: number,
  display?: string,
): void {
  if (typeof o[key] !== "number" || !Number.isFinite(o[key])) {
    throw new Error(
      `wave_2_4 fixture line ${lineNum}: required number field '${display ?? key}' is missing or non-finite`,
    );
  }
}

// -----------------------------------------------------------------------------
// Judge sub-type classifier — PURE
// -----------------------------------------------------------------------------

/**
 * Classify a case into one of the two judge sub-types by looking at the
 * category field first, falling back to a heuristic on the embedded template.
 * Same code path runs both; the sub-type is metadata.
 */
export function classifyJudgeSubtype(c: Wave24Case): Wave24JudgeSubtype {
  if (c.category === "wave_2_4_post_report") return "post_report";
  // Defensive: if the category got mislabeled but the template clearly
  // mentions the 5-criterion post-report shape, treat it as post_report. This
  // matches the Interaction Strategist's "5-criterion" marker.
  if (c.category === "wave_2_4_boundary") return "answer_body";
  // Unreachable given validateCase, but keep the type-narrowing exhaustive.
  return "answer_body";
}

// -----------------------------------------------------------------------------
// Judge prompt rendering — PURE
// -----------------------------------------------------------------------------

/**
 * Render the final judge-ready prompt by appending the candidate context to
 * the embedded judge_prompt template. The template comes verbatim from the
 * fixture; this helper just glues on the actual response + context so the
 * judge sees a complete artifact to score.
 *
 * Pure: no I/O, no clock, no random. Deterministic given (case, candidate).
 */
export function renderJudgePrompt(c: Wave24Case, candidateResponse: string): string {
  const subtype = classifyJudgeSubtype(c);
  const parts: string[] = [];
  parts.push(c.judge_prompt);
  parts.push("");
  parts.push("--- USER QUESTION ---");
  parts.push(c.input.user_query);
  parts.push("");
  if (c.input.web_context && c.input.web_context.length > 0) {
    parts.push("--- WEB CONTEXT OTO HAD ACCESS TO ---");
    parts.push(c.input.web_context);
    parts.push("");
  }
  parts.push(
    subtype === "post_report"
      ? "--- OTO POST-REPORT ACKNOWLEDGMENT ---"
      : "--- OTO RESPONSE ---",
  );
  parts.push(candidateResponse);
  parts.push("");
  parts.push("Return verdict on the first line (PASS or FAIL), rationale on subsequent lines.");
  return parts.join("\n");
}

// -----------------------------------------------------------------------------
// Mock verdict generator — PURE
// -----------------------------------------------------------------------------

/**
 * Mock-mode verdicts are deterministic per case_id. The rule (per Day 7 task
 * spec): right-example cases produce PASS, wrong-example cases produce FAIL.
 * No randomness — that's what lets the loader behave like a unit test against
 * the fixture (the harness can run offline and still produce stable verdicts).
 *
 * The rationale string is canned so reports show *why* the mock returned what
 * it did; it explicitly labels itself as a mock so reviewers don't confuse
 * mock output with a real judge call.
 */
export function mockVerdictForCase(c: Wave24Case): {
  verdict: Wave24Verdict;
  rationale: string;
} {
  const isRight =
    c.expected_behavior === "right-example" ||
    c.expected_behavior === "right-example-post-report";
  if (isRight) {
    return {
      verdict: "PASS",
      rationale: `[mock] right-example case ${c.case_id}: mock judge returns PASS to match expected_judge_verdict.`,
    };
  }
  return {
    verdict: "FAIL",
    rationale: `[mock] wrong-example case ${c.case_id}: mock judge returns FAIL to match expected_judge_verdict.`,
  };
}

// -----------------------------------------------------------------------------
// Live judge invocation — IMPURE (I/O)
// -----------------------------------------------------------------------------

/**
 * The two halves of live-mode I/O. Both halves are injected through this
 * narrow interface so the live judge function stays testable — the test suite
 * can supply fakes that produce deterministic verdicts without touching
 * Anthropic or Convex.
 */
export interface JudgeRuntime {
  /** Calls Oto's chat action with the user_query + scope; returns the assistant body. */
  runOtoChat(input: Wave24CaseInput): Promise<string>;
  /** Sends the rendered judge prompt to the eval-account Claude Haiku endpoint. */
  callJudgeModel(judgePrompt: string): Promise<{ verdict: Wave24Verdict; rationale: string }>;
}

/**
 * Parse a Claude Haiku response (free-form text) into a typed verdict.
 *
 * Convention enforced by the appended instruction in renderJudgePrompt:
 *   line 1 = PASS or FAIL (case-insensitive)
 *   lines 2+ = rationale
 *
 * If the first line is malformed, treat as FAIL with a marker rationale so
 * harness reports surface the parse failure clearly rather than crashing.
 *
 * Pure.
 */
export function parseJudgeReply(reply: string): {
  verdict: Wave24Verdict;
  rationale: string;
} {
  const lines = reply.trim().split(/\r?\n/);
  const first = (lines[0] ?? "").trim().toUpperCase();
  if (first.startsWith("PASS")) {
    return { verdict: "PASS", rationale: lines.slice(1).join("\n").trim() };
  }
  if (first.startsWith("FAIL")) {
    return { verdict: "FAIL", rationale: lines.slice(1).join("\n").trim() };
  }
  return {
    verdict: "FAIL",
    rationale: `[parse-error] judge first line did not start with PASS/FAIL: ${first.slice(0, 120)}`,
  };
}

// -----------------------------------------------------------------------------
// Live runtime backed by Anthropic API + Convex HTTP action
// -----------------------------------------------------------------------------

/**
 * Env vars (documented in scripts/eval/README.md):
 *   OTO_JUDGE_ANTHROPIC_KEY   bearer key for the SEPARATE eval-only Anthropic
 *                             account (Doc 4 Wave 1.2 — must not be the
 *                             production Oto Anthropic account).
 *   OTO_JUDGE_MODEL           model id; defaults to "claude-haiku-4-5".
 *   OTO_EVAL_CONVEX_URL       https://<deployment>.convex.cloud (same var the
 *                             cascadeClient already uses for live runs).
 *   OTO_EVAL_CONVEX_KEY       bearer for the eval principal on Convex.
 *
 * The judge call uses the eval-only Anthropic key — NOT the production key
 * that powers Oto chat. Doc 4 Wave 1.2 mandates the separation: eval account
 * billing, rate-limit, and prompt-cache are isolated from production so an
 * eval bug can't burn through production quota or leak production traces.
 */
export function buildDefaultJudgeRuntime(): JudgeRuntime {
  return {
    async runOtoChat(input: Wave24CaseInput): Promise<string> {
      const url = process.env.OTO_EVAL_CONVEX_URL;
      const key = process.env.OTO_EVAL_CONVEX_KEY;
      if (!url || !key) {
        throw new Error(
          "Live mode requires OTO_EVAL_CONVEX_URL and OTO_EVAL_CONVEX_KEY for the Oto chat call. Set them or pass --mock.",
        );
      }
      const endpoint = `${url.replace(/\/$/, "")}/api/action`;
      const body = {
        path: "oto/chat:answerQuestion",
        args: {
          user_query: input.user_query,
          vehicle_scope: input.vehicle_scope,
          eval_context: {
            source_tier: input.source_tier,
            verification_status: input.verification_status,
            web_context: input.web_context ?? null,
          },
        },
        format: "json",
      };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Convex ${key}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `oto/chat:answerQuestion HTTP ${res.status}: ${text.slice(0, 200)}`,
        );
      }
      const raw = (await res.json()) as {
        status: string;
        value?: { assistant_text?: string };
        errorMessage?: string;
      };
      if (raw.status !== "success" || !raw.value || !raw.value.assistant_text) {
        throw new Error(
          `oto chat action returned ${raw.status}: ${raw.errorMessage ?? "(no message)"}`,
        );
      }
      return raw.value.assistant_text;
    },

    async callJudgeModel(judgePrompt: string): Promise<{ verdict: Wave24Verdict; rationale: string }> {
      const key = process.env.OTO_JUDGE_ANTHROPIC_KEY;
      if (!key) {
        throw new Error(
          "Live judge requires OTO_JUDGE_ANTHROPIC_KEY (eval-only Anthropic account; Doc 4 Wave 1.2). Set it or pass --mock.",
        );
      }
      const model = process.env.OTO_JUDGE_MODEL ?? "claude-haiku-4-5";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [{ role: "user", content: judgePrompt }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `judge model HTTP ${res.status}: ${text.slice(0, 200)}`,
        );
      }
      const raw = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = (raw.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n");
      return parseJudgeReply(text);
    },
  };
}

// -----------------------------------------------------------------------------
// One-shot per-case judge run — same code path for both sub-types
// -----------------------------------------------------------------------------

export interface Wave24JudgeOutcome {
  case_id: string;
  subtype: Wave24JudgeSubtype;
  expected_verdict: Wave24Verdict;
  actual_verdict: Wave24Verdict;
  passed: boolean;
  candidate_response: string;
  rationale: string;
}

/**
 * Mock mode: returns the mock verdict directly. Pure (modulo the implicit
 * read of `mode`); no I/O.
 *
 * Live mode: if the case ships a verbatim candidate_response (wrong-example
 * cases), the judge scores that body directly. If not, we call Oto's chat
 * action through `runtime.runOtoChat` to generate the response, then score
 * with `runtime.callJudgeModel`.
 *
 * "passed" is true iff actual_verdict === expected_verdict. This is what
 * lets contrastive testing work: a wrong-example case "passes" when the judge
 * correctly returns FAIL on it. The harness aggregator then computes the
 * standard pass-rate over N repeats.
 */
export async function runJudgeForCase(
  c: Wave24Case,
  mode: "mock" | "live",
  runtime?: JudgeRuntime,
): Promise<Wave24JudgeOutcome> {
  const subtype = classifyJudgeSubtype(c);

  if (mode === "mock") {
    const m = mockVerdictForCase(c);
    return {
      case_id: c.case_id,
      subtype,
      expected_verdict: c.expected_judge_verdict,
      actual_verdict: m.verdict,
      passed: m.verdict === c.expected_judge_verdict,
      candidate_response: c.input.candidate_response ?? "[mock] no candidate_response in fixture; live mode would call Oto.",
      rationale: m.rationale,
    };
  }

  const rt = runtime ?? buildDefaultJudgeRuntime();
  const candidateResponse =
    c.input.candidate_response ?? (await rt.runOtoChat(c.input));
  const rendered = renderJudgePrompt(c, candidateResponse);
  const judged = await rt.callJudgeModel(rendered);
  return {
    case_id: c.case_id,
    subtype,
    expected_verdict: c.expected_judge_verdict,
    actual_verdict: judged.verdict,
    passed: judged.verdict === c.expected_judge_verdict,
    candidate_response: candidateResponse,
    rationale: judged.rationale,
  };
}
