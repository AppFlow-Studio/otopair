// =============================================================================
// Headless behavioral eval runner — scripts/oto-eval-cases.json
// =============================================================================
//
// The canonical runner (scripts/oto-harness.html runEval) is browser-based and
// Clerk-gated, which makes regression runs a manual chore — the v0.40→v0.46
// prompt arc (2026-08-13) shipped six stable-prompt bumps with only targeted
// device checks. This runner drives the SAME golden cases headlessly through
// oto/simulate:simulateOtoMessage (admin-key internalAction → identical
// sendMessageHandlerCore path a signed-in user gets) via `npx convex run`.
//
// Assertion semantics mirror oto-harness.html runEval byte-for-byte, plus the
// fields the JSON _doc defines that the HTML block predates:
//   tools_called / tools_not_called / branch / text_contains /
//   text_not_contains / form_system / envelope_contains / envelope_not_contains
//   / pre_seed_mutations / text_judge (LLM judge via devOnly/evalJudge:judge —
//   behavioral criteria instead of fragile substrings; Pass H's
//   assertion-too-narrow fix). Env: CASE_FILTER (name substring), REPEAT
//   (N>=1, all N must pass), TARGET_EMAIL (default the M550i owner).
//
// Usage:  node scripts/eval/behavioral_runner.mjs
// Output: scripts/eval/runs/behavioral_<ts>.json + console summary.
// =============================================================================
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const BASH = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";

const TARGET_EMAIL = process.env.TARGET_EMAIL || "mansourwaleed06@gmail.com";
const CASE_FILTER = process.env.CASE_FILTER || "";
const REPEAT = Math.max(1, parseInt(process.env.REPEAT || "1", 10));
const DEFAULT_VIN = "WBAJS7C01LBN96146"; // M550i, tail N96146 (per case _doc)

function convexRun(fn, args) {
  const json = JSON.stringify(args).replace(/'/g, "'\\''");
  const cmd = `cd '${repo.replace(/\\/g, "/")}' && npx convex run '${fn}' '${json}'`;
  const out = execFileSync(BASH, ["-lc", cmd], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 180_000,
  });
  // convex run prints the return value; tolerate leading log noise.
  const start = out.indexOf("{") === -1 ? out.indexOf("[") : out.indexOf("{");
  if (start === -1) return null;
  return JSON.parse(out.slice(start));
}

function runTurn(message, conversationId) {
  const args = {
    userEmail: TARGET_EMAIL,
    message,
    vehicleVin: DEFAULT_VIN,
    persist: false, // mirrors the HTML harness's debug_skip_persist
    trace: true,
  };
  if (conversationId) args.conversationId = conversationId;
  return convexRun("oto/simulate:simulateOtoMessage", args);
}

function assertTurn(t, r, turnIdx, failures, toolsSoFar = []) {
  const e = t.expect || {};
  const result = r?.result ?? {};
  const tr = result.trace || {};
  const iters = tr.iterations || [];
  const lastIter = iters[iters.length - 1] || {};
  const tools = [];
  for (const it of iters) {
    for (const tu of it.data_tool_uses || []) tools.push(tu.name);
    for (const tu of it.state_tool_uses || []) tools.push(tu.name);
    for (const tu of it.terminal_tool_uses || []) tools.push(tu.name);
  }
  // tools_called_any_turn — the cross-turn primitive (Sprint 3 carryover,
  // landed 2026-08-14): asserts against the UNION of tools fired in this turn
  // plus every earlier turn of the case. For behaviors where the read
  // legitimately happens a turn before the render (get_vehicle_health on the
  // narrowing turn, card on the gate turn), the per-turn tools_called
  // assertion punished correct sequencing.
  const cumulative = [...toolsSoFar, ...tools];
  for (const x of e.tools_called_any_turn || [])
    if (!cumulative.includes(x))
      failures.push(
        `turn ${turnIdx + 1}: missing tool "${x}" across all turns (saw: ${cumulative.join(",") || "none"})`,
      );
  const text = String(result.text || "").toLowerCase();
  const envelope = String(tr.envelope || "").toLowerCase();
  const fail = (msg) => failures.push(`turn ${turnIdx + 1}: ${msg}`);

  for (const x of e.tools_called || [])
    if (!tools.includes(x)) fail(`missing tool "${x}" (saw: ${tools.join(",") || "none"})`);
  for (const x of e.tools_not_called || [])
    if (tools.includes(x)) fail(`forbidden tool "${x}" was called`);
  if (e.branch && lastIter.branch !== e.branch)
    fail(`branch "${lastIter.branch}" !== "${e.branch}"`);
  for (const n of e.text_contains || [])
    if (!text.includes(String(n).toLowerCase())) fail(`text missing "${n}"`);
  for (const n of e.text_not_contains || [])
    if (text.includes(String(n).toLowerCase())) fail(`text contains banned "${n}"`);
  // book_service_rendered — asserts the turn shipped a BookService render,
  // whether the MODEL called render_book_service or the SERVER's forced-exit
  // backstop concluded the turn (which sets renderEnvelope.bookService with no
  // tool_use — invisible to tools_called/tools_called_any_turn by design).
  // Reads trace.book_service (chat.ts sets it post-backstop on debug runs).
  if (e.book_service_rendered === true) {
    if (!tr.book_service)
      fail(`book_service not rendered (trace.book_service empty)`);
  }
  // link_button_not_rendered — asserts the turn shipped NO link button in the
  // final envelope. The effect-level twin of tools_not_called: server-side
  // suppression (loyalty proxy-redirect) drops the render but cannot unsay
  // the model's tool CALL, so call-level assertions would fail a turn whose
  // user-visible behavior is correct.
  if (e.link_button_not_rendered === true) {
    if (tr.link_button)
      fail(
        `link_button rendered (${JSON.stringify(tr.link_button).slice(0, 80)})`,
      );
  }
  if (e.form_system) {
    const actual = result.showDiagnosticForm?.initialSystem ?? null;
    if (actual !== e.form_system) fail(`form_system "${actual}" !== "${e.form_system}"`);
  }
  for (const n of e.envelope_contains || [])
    if (!envelope.includes(String(n).toLowerCase())) fail(`envelope missing "${n}"`);
  for (const n of e.envelope_not_contains || [])
    if (envelope.includes(String(n).toLowerCase())) fail(`envelope contains banned "${n}"`);
  // text_judge — behavioral criteria evaluated by an LLM judge (temperature 0,
  // verdict-first). The judge sees ONLY this turn's assistant text, so criteria
  // must be self-contained. A judge-transport error fails the turn loudly
  // (it's an infra problem, not a soft pass).
  if (e.text_judge) {
    try {
      const verdict = convexRun("devOnly/evalJudge:judge", {
        criteria: String(e.text_judge),
        text: result.text ?? "",
      });
      if (!verdict || verdict.pass !== true)
        fail(`judge: ${verdict?.reason ?? "no verdict returned"}`);
    } catch (err) {
      fail(`judge transport error: ${String(err?.message ?? err).slice(0, 200)}`);
    }
  }
  return { tools, branch: lastIter.branch, text: result.text ?? "" };
}

const data = JSON.parse(readFileSync(join(repo, "scripts", "oto-eval-cases.json"), "utf8"));
const all = data.cases || [];
// CASE_FILTER accepts a comma-separated list of name substrings (any match).
const filters = CASE_FILTER.split(",").map((f) => f.trim()).filter(Boolean);
let active = all.filter(
  (c) => c.disabled !== true && (filters.length === 0 || filters.some((f) => c.name.includes(f))),
);
// SLICE="start:end" — index range over the ACTIVE list (end exclusive), for
// splitting a full-suite run across command-timeout windows. Applied after
// CASE_FILTER. e.g. SLICE=0:32, SLICE=32:64, SLICE=64:96.
if (process.env.SLICE) {
  const m = /^(\d+):(\d+)$/.exec(process.env.SLICE.trim());
  if (!m) throw new Error(`bad SLICE "${process.env.SLICE}" — want "start:end"`);
  active = active.slice(Number(m[1]), Number(m[2]));
}
const skipped = all.filter((c) => c.disabled === true).map((c) => ({ name: c.name, reason: c.disabled_reason || "" }));
console.log(`cases: ${active.length} active${CASE_FILTER ? ` (filter: ${CASE_FILTER})` : ""}, ${skipped.length} disabled, REPEAT=${REPEAT}`);

const results = [];
let done = 0;
for (const c of active) {
  const caseOut = { name: c.name, description: c.description, passed: true, failures: [], runs: [] };
  for (let rep = 0; rep < REPEAT; rep++) {
    const failures = [];
    const runOut = { rep: rep + 1, turns: [] };
    try {
      for (const m of c.pre_seed_mutations || []) convexRun(m.path, m.args || {});
      let cid = undefined;
      const toolsSoFar = [];
      for (let i = 0; i < c.turns.length; i++) {
        const r = runTurn(c.turns[i].user, cid);
        cid = r?.conversationId ?? cid;
        const summary = assertTurn(c.turns[i], r, i, failures, toolsSoFar);
        toolsSoFar.push(...summary.tools);
        runOut.turns.push({ user: c.turns[i].user, ...summary });
      }
    } catch (err) {
      failures.push(`threw: ${String(err.message || err).slice(0, 300)}`);
    }
    runOut.failures = failures;
    caseOut.runs.push(runOut);
    if (failures.length) {
      caseOut.passed = false;
      caseOut.failures.push(...failures.map((f) => `rep${rep + 1}: ${f}`));
    }
  }
  results.push(caseOut);
  done++;
  console.log(`[${done}/${active.length}] ${caseOut.passed ? "PASS" : "FAIL"}  ${c.name}${caseOut.passed ? "" : "  — " + caseOut.failures[0]}`);
}

const passed = results.filter((r) => r.passed).length;
const summary = {
  ran_at: new Date().toISOString(),
  target_email: TARGET_EMAIL,
  repeat: REPEAT,
  total: results.length,
  passed,
  failed: results.length - passed,
  skipped_count: skipped.length,
  failed_cases: results.filter((r) => !r.passed).map((r) => ({ name: r.name, failures: r.failures })),
  results,
  skipped,
};
mkdirSync(join(here, "runs"), { recursive: true });
const outPath = join(here, "runs", `behavioral_${Date.now()}.json`);
writeFileSync(outPath, JSON.stringify(summary, null, 1));
console.log(`\n${passed}/${results.length} passed (${skipped.length} disabled). Report: ${outPath}`);
process.exit(0);
