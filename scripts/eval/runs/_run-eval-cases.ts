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

  console.log(`Loaded ${all.length} cases (${activeAll.length} active, ${disabled.length} disabled)${filter ? `; filter="${filter}" -> ${active.length} matched` : ""}`);
  await loadOwnedVehicles();
  console.log("");

  const results: Array<Awaited<ReturnType<typeof runCase>>> = [];
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < active.length; i++) {
    const c = active[i];
    process.stdout.write(`[${i + 1}/${active.length}] ${c.name} ... `);
    const r = await runCase(c);
    results.push(r);
    if (r.pass) {
      passed++;
      console.log("PASS");
    } else {
      failed++;
      console.log("FAIL");
      if (r.error) console.log(`    error: ${r.error}`);
      for (const tr of r.turnResults) {
        if (!tr.pass) {
          console.log(`    turn ${tr.idx}: ${tr.reasons.join("; ")}`);
        }
      }
    }
  }

  console.log("");
  console.log("=".repeat(72));
  console.log(`OVERALL: ${passed}/${active.length} PASS  (${failed} failed, ${disabled.length} skipped/disabled)`);
  console.log("=".repeat(72));

  writeFileSync(
    "scripts/eval/runs/_run-eval-cases-result.json",
    JSON.stringify({ timestamp: new Date().toISOString(), passed, failed, disabled: disabled.length, results }, null, 2),
  );
  console.log("Full result: scripts/eval/runs/_run-eval-cases-result.json");
})();
