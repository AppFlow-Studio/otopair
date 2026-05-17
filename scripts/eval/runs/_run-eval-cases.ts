// Ports the harness's window.__oto.runEval() to a standalone tsx runner so
// Claude Code can fire all 31 canonical eval cases via Bash + JWT, without
// needing a browser. Mirrors scripts/oto-harness.html lines 1660+ as faithfully
// as the assertions allow.
//
// Usage:
//   JWT="eyJ..." CONVEX_URL="https://flippant-mink-750.convex.cloud" \
//     npx tsx scripts/eval/runs/_run-eval-cases.ts
//
// Output: per-case pass/fail with reasons + final tally.

import { readFileSync, writeFileSync } from "node:fs";

interface ExpectBlock {
  tools_called?: string[];
  tools_not_called?: string[];
  branch?: string;
  text_contains?: string[];
  text_not_contains?: string[];
  form_system?: string;
  // envelope_contains / envelope_not_contains (Day 8) — assertion primitives
  // that operate on `result.trace.envelope` (string) instead of result.text.
  // Closes the cross-conversation READ-path coverage gap: commit 28bfea1
  // wires getCrossConversationMemory into <recent_context>, but no prior
  // primitive could verify the envelope actually contains expected substrings.
  // Symmetric pair (positive + negative) parallels text_contains structure.
  envelope_contains?: string[];
  envelope_not_contains?: string[];
}
// PreSeedMutation (Day 8) — per-case `pre_seed_mutations` field. Each entry
// is dispatched via `call(path, args, "mutation")` BEFORE the case's turns
// run. Used to seed cross-conversation memory (user_semantic_facts /
// conversation_facts rows in a prior conversation) so the runner can
// validate the READ path. NO post-case cleanup — fixture rows accumulate
// (the test user has many already; isolation will be a follow-up if
// behavior becomes contaminated).
interface PreSeedMutation {
  path: string;
  args: Record<string, unknown>;
}
interface Turn {
  user: string;
  expect: ExpectBlock;
}
interface Case {
  name: string;
  description: string;
  vehicle_vin_tail?: string;
  turns: Turn[];
  pre_seed_mutations?: PreSeedMutation[];
  disabled?: boolean;
  disabled_reason?: string;
}

const JWT = process.env.JWT;
const URL = process.env.CONVEX_URL ?? "https://flippant-mink-750.convex.cloud";
const USER_ID = "md7fjepfczgwtpn0vpas2y3rrh83ggb3";
if (!JWT) {
  console.error("ENV JWT is required");
  process.exit(1);
}

async function call(path: string, args: Record<string, unknown>, kind: "query" | "mutation" | "action"): Promise<unknown> {
  const res = await fetch(`${URL}/api/${kind}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${JWT}`,
    },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const raw = (await res.json()) as { status: string; value?: unknown; errorMessage?: string };
  if (raw.status !== "success") {
    throw new Error(`${path} failed: ${raw.errorMessage?.slice(0, 300)}`);
  }
  return raw.value;
}

// Map: vin_tail (e.g. "N96146") -> full VIN owned by the user (e.g.
// "WBAJS7C01LBN96146"). Populated once at suite start from
// vehicles:getMyVehicles. chat:sendMessage's `vehicleVin` arg expects the
// FULL VIN, not a tail — passing a tail silently falls back to
// most-recently-added (which is the bug the v0 runner shipped with).
const ownedVinByTail = new Map<string, string>();

async function loadOwnedVehicles(): Promise<void> {
  const vehicles = (await call("vehicles:getMyVehicles", {}, "query")) as Array<{ vin: string }>;
  for (const v of vehicles) {
    if (!v.vin) continue;
    // Build entries for ALL suffix lengths from 6 to full — case JSONs use
    // short tails like "N96146" (6 chars); generic matching handles whatever
    // length the case author picked.
    for (let len = 6; len <= v.vin.length; len++) {
      const suffix = v.vin.slice(-len);
      // Don't overwrite a longer-suffix match with a shorter one (collision
      // safety — two VINs sharing a 6-char tail would be a real ambiguity).
      if (!ownedVinByTail.has(suffix)) ownedVinByTail.set(suffix, v.vin);
    }
  }
  console.log(`Owned vehicles: ${vehicles.length}; suffix index size: ${ownedVinByTail.size}`);
}

// Per the cases JSON _doc: "default M550i N96146". When a case omits
// vehicle_vin_tail, the harness applies this default. The chat:sendMessage
// fallback ("most-recently-added") is NOT what cases expect — they expect
// the canonical test M550i.
const DEFAULT_VIN_TAIL = "N96146";

function resolveVin(vinTail: string | undefined): string | null {
  const raw = vinTail ?? DEFAULT_VIN_TAIL;
  // Case JSON sometimes encodes "M550i N96146" (display + tail). Strip a leading
  // model-name prefix if present — the tail is always trailing.
  const tail = raw.includes(" ") ? raw.split(" ").pop()! : raw;
  const fullVin = ownedVinByTail.get(tail);
  if (!fullVin) {
    console.warn(`  [resolveVin] no owned VIN ends with "${tail}" — case will run against fallback vehicle`);
    return null;
  }
  return fullVin;
}

interface IterTrace {
  branch?: string;
  // Trace splits tool calls into THREE buckets, not one (mirrors the
  // dispatcher's terminal/state/data categorization at chat.ts):
  data_tool_uses?: Array<{ name: string; input?: unknown }>;
  state_tool_uses?: Array<{ name: string; input?: unknown }>;
  terminal_tool_uses?: Array<{ name: string; input?: unknown }>;
  assistant_text?: string;
}

function collectToolNames(iter: IterTrace): string[] {
  return [
    ...(iter.data_tool_uses ?? []),
    ...(iter.state_tool_uses ?? []),
    ...(iter.terminal_tool_uses ?? []),
  ].map((t) => t.name);
}
interface SendResult {
  text: string;
  trace?: {
    iterations?: IterTrace[];
    envelope?: string;
    show_diagnostic_form?: { initialSystem?: string };
  };
  show_diagnostic_form?: { initialSystem?: string };
}

function assertExpect(turn: Turn, idx: number, result: SendResult): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const e = turn.expect;
  const trace = result.trace;
  const iters = trace?.iterations ?? [];

  // tools_called: all listed must appear in ANY iter (union across the
  // data_tool_uses / state_tool_uses / terminal_tool_uses buckets).
  if (e.tools_called && e.tools_called.length > 0) {
    const fired = new Set<string>();
    for (const iter of iters) {
      for (const name of collectToolNames(iter)) fired.add(name);
    }
    const missing = e.tools_called.filter((t) => !fired.has(t));
    if (missing.length > 0) {
      reasons.push(`tools_called missing: ${missing.join(", ")} (fired: ${Array.from(fired).join(", ") || "(none)"})`);
    }
  }

  // tools_not_called: NONE of the listed may appear in ANY iter (mirror of
  // tools_called, with the same union across the three trace buckets).
  // Rigorous negative-case assertion primitive — Day 5's negative semantic-fact
  // cases lean on text_not_contains for terminology-leakage as a proxy for
  // "tool didn't fire", which is brittle. This primitive checks the tool
  // dispatch trace directly. Symmetric counterpart of the tools_called block.
  if (e.tools_not_called && e.tools_not_called.length > 0) {
    const fired = new Set<string>();
    for (const iter of iters) {
      for (const name of collectToolNames(iter)) fired.add(name);
    }
    const violations = e.tools_not_called.filter((t) => fired.has(t));
    if (violations.length > 0) {
      reasons.push(`tools_not_called fired (must NOT have): ${violations.join(", ")} (all fired: ${Array.from(fired).join(", ") || "(none)"})`);
    }
  }

  // branch: must match LAST iter's branch
  if (e.branch) {
    const lastBranch = iters[iters.length - 1]?.branch;
    if (lastBranch !== e.branch) {
      reasons.push(`branch expected ${e.branch} got ${lastBranch ?? "(none)"}`);
    }
  }

  // text_contains: all must be in final text (case-insensitive)
  if (e.text_contains && e.text_contains.length > 0) {
    const lower = result.text.toLowerCase();
    for (const needle of e.text_contains) {
      if (!lower.includes(needle.toLowerCase())) {
        reasons.push(`text_contains missing: "${needle}"`);
      }
    }
  }

  // text_not_contains: none may be in final text
  if (e.text_not_contains && e.text_not_contains.length > 0) {
    const lower = result.text.toLowerCase();
    for (const needle of e.text_not_contains) {
      if (lower.includes(needle.toLowerCase())) {
        reasons.push(`text_not_contains hit: "${needle}"`);
      }
    }
  }

  // form_system: render_diagnostic_form.initialSystem must equal
  if (e.form_system) {
    const sys = result.show_diagnostic_form?.initialSystem ?? trace?.show_diagnostic_form?.initialSystem;
    if (sys !== e.form_system) {
      reasons.push(`form_system expected "${e.form_system}" got "${sys ?? "(none)"}"`);
    }
  }

  // envelope_contains / envelope_not_contains (Day 8) — operate on the
  // envelope STRING in trace (set at chat.ts:524 from buildEnvelope output).
  // Mirrors the text_contains / text_not_contains semantics: substring match,
  // case-insensitive. Used by cross-conversation READ-path eval cases to
  // verify <recent_context> actually surfaces the seeded prior-conv facts.
  const envelopeStr = (trace?.envelope ?? "").toLowerCase();
  if (e.envelope_contains && e.envelope_contains.length > 0) {
    for (const needle of e.envelope_contains) {
      if (!envelopeStr.includes(needle.toLowerCase())) {
        reasons.push(`envelope_contains missing: "${needle}"`);
      }
    }
  }
  if (e.envelope_not_contains && e.envelope_not_contains.length > 0) {
    for (const needle of e.envelope_not_contains) {
      if (envelopeStr.includes(needle.toLowerCase())) {
        reasons.push(`envelope_not_contains hit: "${needle}"`);
      }
    }
  }

  return { pass: reasons.length === 0, reasons };
}

async function runCase(c: Case): Promise<{ name: string; pass: boolean; turnResults: Array<{ idx: number; pass: boolean; reasons: string[] }>; error?: string }> {
  const sessionId = `claude-eval-${c.name}-${Date.now()}`;
  let conversationId: string;
  try {
    conversationId = (await call("ai_conversations:create", { user_id: USER_ID, session_id: sessionId }, "mutation")) as string;
  } catch (e: unknown) {
    return { name: c.name, pass: false, turnResults: [], error: `create conv failed: ${(e as Error).message}` };
  }

  // pre_seed_mutations (Day 8) — dispatched BEFORE any turn runs. Used by
  // cross-conv READ-path and retract-path cases to seed user_semantic_facts /
  // conversation_facts rows the AI is expected to subsequently read or
  // retract. Each mutation is fired sequentially via the standard `call`
  // wrapper so it shares JWT + Convex auth with the chat send. Failure on
  // any seed marks the entire case as failed (no point running turns against
  // a half-seeded fixture). NO cleanup hook — rows accumulate; the test user
  // already has many. If fixture isolation becomes necessary, add per-case
  // teardown here as a follow-up.
  if (c.pre_seed_mutations && c.pre_seed_mutations.length > 0) {
    for (let s = 0; s < c.pre_seed_mutations.length; s++) {
      const seed = c.pre_seed_mutations[s];
      try {
        await call(seed.path, seed.args, "mutation");
      } catch (e: unknown) {
        return {
          name: c.name,
          pass: false,
          turnResults: [],
          error: `pre_seed_mutations[${s}] (${seed.path}) failed: ${(e as Error).message}`,
        };
      }
    }
  }

  const turnResults: Array<{ idx: number; pass: boolean; reasons: string[] }> = [];
  for (let i = 0; i < c.turns.length; i++) {
    const turn = c.turns[i];
    let result: SendResult;
    try {
      const resolvedVin = resolveVin(c.vehicle_vin_tail);
      result = (await call(
        "oto/chat:sendMessage",
        {
          conversationId,
          message: turn.user,
          debug: true,
          debug_skip_persist: true,
          ...(resolvedVin ? { vehicleVin: resolvedVin } : {}),
        },
        "action",
      )) as SendResult;
    } catch (e: unknown) {
      turnResults.push({ idx: i, pass: false, reasons: [`send failed: ${(e as Error).message}`] });
      break;
    }
    const { pass, reasons } = assertExpect(turn, i, result);
    turnResults.push({ idx: i, pass, reasons });
    if (!pass) break; // short-circuit: subsequent turns depend on this one's state
  }

  const allPass = turnResults.every((tr) => tr.pass) && turnResults.length === c.turns.length;
  return { name: c.name, pass: allPass, turnResults };
}

(async () => {
  const json = JSON.parse(readFileSync("scripts/oto-eval-cases.json", "utf8")) as { cases: Case[] };
  const all = json.cases;
  const activeAll = all.filter((c) => !c.disabled);
  const disabled = all.filter((c) => c.disabled);
  // CASE_FILTER env var: optional substring match on case name. When set, only
  // cases whose name includes the filter run. Used for targeted measurements
  // (e.g., the new semantic-fact subset) without disturbing the canonical suite.
  const filter = process.env.CASE_FILTER ?? "";
  const active = filter ? activeAll.filter((c) => c.name.includes(filter)) : activeAll;

  // REPEAT env var (Day 8) — each case runs N times. PASS criteria: ALL N
  // runs must pass for the case to be marked PASS in the final tally. Enables
  // ad-hoc N=K statistical runs (the Wave 1.5 protocol prerequisite) without
  // authoring a full comparator harness. Default 1 preserves current behavior.
  // Clamp to a sane integer >= 1 (so REPEAT=0 / NaN / negative all -> 1).
  const repeatRaw = Number.parseInt(process.env.REPEAT ?? "1", 10);
  const REPEAT = Number.isFinite(repeatRaw) && repeatRaw >= 1 ? repeatRaw : 1;

  console.log(`Loaded ${all.length} cases (${activeAll.length} active, ${disabled.length} disabled)${filter ? `; filter="${filter}" -> ${active.length} matched` : ""}${REPEAT > 1 ? `; REPEAT=${REPEAT} (each case must pass all ${REPEAT} attempts)` : ""}`);
  await loadOwnedVehicles();
  console.log("");

  // Per-case aggregate: { name, pass, attempts: Array<runCase result> }
  interface CaseAggregate {
    name: string;
    pass: boolean;
    attempts: Array<Awaited<ReturnType<typeof runCase>>>;
    passCount: number;
  }
  const results: CaseAggregate[] = [];
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < active.length; i++) {
    const c = active[i];
    const attempts: Array<Awaited<ReturnType<typeof runCase>>> = [];
    let passCount = 0;
    for (let r = 0; r < REPEAT; r++) {
      const attempt = await runCase(c);
      attempts.push(attempt);
      if (attempt.pass) passCount++;
    }
    const casePass = passCount === REPEAT;
    const aggregate: CaseAggregate = { name: c.name, pass: casePass, attempts, passCount };
    results.push(aggregate);

    const tag = REPEAT > 1 ? ` (${passCount}/${REPEAT} PASS)` : "";
    process.stdout.write(`[${i + 1}/${active.length}] ${c.name}${tag} ... `);
    if (casePass) {
      passed++;
      console.log("PASS");
    } else {
      failed++;
      console.log("FAIL");
      // Show failure detail from EACH failed attempt for diagnosability.
      for (let aIdx = 0; aIdx < attempts.length; aIdx++) {
        const a = attempts[aIdx];
        if (a.pass) continue;
        const attemptPrefix = REPEAT > 1 ? `    [attempt ${aIdx + 1}]` : "   ";
        if (a.error) console.log(`${attemptPrefix} error: ${a.error}`);
        for (const tr of a.turnResults) {
          if (!tr.pass) {
            console.log(`${attemptPrefix} turn ${tr.idx}: ${tr.reasons.join("; ")}`);
          }
        }
      }
    }
  }

  console.log("");
  console.log("=".repeat(72));
  if (REPEAT > 1) {
    console.log(`OVERALL: ${passed}/${active.length} cases PASS (all ${REPEAT} attempts)  (${failed} FAIL — at least one attempt failed, ${disabled.length} skipped/disabled)`);
  } else {
    console.log(`OVERALL: ${passed}/${active.length} PASS  (${failed} failed, ${disabled.length} skipped/disabled)`);
  }
  console.log("=".repeat(72));

  writeFileSync(
    "scripts/eval/runs/_run-eval-cases-result.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        repeat: REPEAT,
        passed,
        failed,
        disabled: disabled.length,
        results,
      },
      null,
      2,
    ),
  );
  console.log("Full result: scripts/eval/runs/_run-eval-cases-result.json");
})();
