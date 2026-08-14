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
//   / pre_seed_mutations. Env: CASE_FILTER (name substring), REPEAT (N>=1, all
//   N must pass), TARGET_EMAIL (default the M550i owner).
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

function assertTurn(t, r, turnIdx, failures) {
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
  if (e.form_system) {
    const actual = result.showDiagnosticForm?.initialSystem ?? null;
    if (actual !== e.form_system) fail(`form_system "${actual}" !== "${e.form_system}"`);
  }
  for (const n of e.envelope_contains || [])
    if (!envelope.includes(String(n).toLowerCase())) fail(`envelope missing "${n}"`);
  for (const n of e.envelope_not_contains || [])
    if (envelope.includes(String(n).toLowerCase())) fail(`envelope contains banned "${n}"`);
  return { tools, branch: lastIter.branch, text: result.text ?? "" };
}

const data = JSON.parse(readFileSync(join(repo, "scripts", "oto-eval-cases.json"), "utf8"));
const all = data.cases || [];
// CASE_FILTER accepts a comma-separated list of name substrings (any match).
const filters = CASE_FILTER.split(",").map((f) => f.trim()).filter(Boolean);
const active = all.filter(
  (c) => c.disabled !== true && (filters.length === 0 || filters.some((f) => c.name.includes(f))),
);
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
      for (let i = 0; i < c.turns.length; i++) {
        const r = runTurn(c.turns[i].user, cid);
        cid = r?.conversationId ?? cid;
        const summary = assertTurn(c.turns[i], r, i, failures);
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
