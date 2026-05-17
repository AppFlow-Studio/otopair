# Oto Harness — Run Guide (Sprint 2, post-drift-audit)

The browser harness at `scripts/oto-harness.html` is OtoPair's LLM-in-the-loop smoke test. It calls the production `oto/chat:sendMessage` action directly using a real Clerk JWT (no deploy keys, no mocks). The harness has been live since Sprint 1; this guide reflects the **2026-05-16 drift-audited state** where 31 of 32 golden cases are runnable and 1 is intentionally disabled (see `OTO_HARNESS_DRIFT_AUDIT.md` §5.1).

## 1. Prerequisites

### 1.1 Convex dev deployment
- Pointing at `dev:flippant-mink-750` (default). Confirm via `npx convex dev --tail-logs` in another terminal — leave this running while you eval; you'll see envelope + iteration logs there in real time.
- Env vars set on the deployment:
  - `ANTHROPIC_API_KEY` — required. Without it, every `sendMessage` call throws "ANTHROPIC_API_KEY env var not set" at `chat.ts:437`.
  - `FIRECRAWL_API_KEY` — optional; only relevant for enrichment-pipeline test cases (none of the 32 chat cases hit this directly).

### 1.2 Test user (Waleed's account)
- Email: `mrdogsog@gmail.com` (the harness signs in via Clerk's hosted modal).
- Has at least one saved vehicle. The default vin tail `N96146` (2020 BMW M550i) is referenced by the engine-fact regression case (`engine_fact_accuracy_n63_not_s63`). If that VIN is gone, that single case will fail; the other 30 still run.

### 1.3 Local HTTP server
- The harness loads Clerk-JS from esm.sh. Clerk's auth modal rejects `file://` origin. You **must** serve over `http://localhost`.

## 2. Serve the HTML

From the repo root:

```bash
# Option A: Python 3 (most environments)
python3 -m http.server 8000 --directory scripts/

# Option B: Node-based
npx serve scripts/ -l 8000

# Option C: Bun/anything else that serves a directory on 8000
```

Then open `http://localhost:8000/oto-harness.html`.

## 3. Sign in

1. The page loads. Top-right of the Settings panel says "loading Clerk…" then either "signed in: <email>" (if your browser already has a Clerk session) or "Clerk loaded — click Sign in".
2. Click **Sign in**. Clerk's hosted modal opens. Sign in as `mrdogsog@gmail.com`. The modal closes on its own.
3. The dropdowns auto-populate:
   - **Vehicle** — pick the M550i (or leave blank to use most-recent).
   - **Conversation** — click **+ new** to start a fresh row scoped to your user (recommended for a clean eval run).
4. **Leave `debug_skip_persist` checked.** This keeps the harness from polluting your real `ai_messages` history.

The header pills at the top should show: `auth: <jwt-prefix>...`, `convo: <id-prefix>...`, `veh: <year make model>`. All three green.

## 4. Run a single case (smoke)

In the middle Conversation panel, type a single user message and hit **Send**. The action runs. The right-side Trace panel lights up with:

- Envelope (what Haiku actually saw)
- System prompt (which STABLE+VOLATILE composite version)
- Tools advertised (should be ~18 tool entries)
- One card per Anthropic iteration showing branch (`text_only` / `terminal` / `data_continue`), tool_use blocks, and tool_result blocks
- Final outputs (`final_text`, `quick_replies`, `show_diagnostic_form`)

If anything fails, the status line above the Send button shows the error. Common first-run failures:
- `unauthenticated` -> JWT didn't stamp; click **Refresh JWT**.
- `ANTHROPIC_API_KEY env var not set` -> set it on the Convex deployment.
- `not authorized` -> conversation belongs to a different user; click **+ new**.

### 4.1 Recommended first smoke message

**Try this first:** "How is my car doing?"

This exercises the most-touched code path (Sprint 1 vehicle facts + Sprint 2 prompt-split + Sprint 4 bumpMoat user-attribution closure). Expected pattern:
- Iter 1: `get_vehicle_health` and `get_due_services` fire (multi-tool batching, per `multi_tool_batch_health_and_due`).
- Iter 2: `update_conversation_state` + text response. Branch `text_only`.
- No mention of "thermostat", "low coolant", or markdown `**` (per `health_check_with_warning_light`).

## 5. Run the full suite

Open the browser DevTools console (Cmd-Opt-J / Ctrl-Shift-J). Run:

```js
await window.__oto.runEval()
```

This:
1. Fetches `oto-eval-cases.json` from the dev server.
2. Loops every case, creating a fresh `ai_conversations` row per case (no cross-case state leakage).
3. Sends each turn through `oto/chat:sendMessage` with `debug_skip_persist: true`.
4. Asserts `tools_called`, `branch`, `text_contains`, `text_not_contains`, `form_system` per the JSON contract.

Returns:
```js
{
  total: 31,         // disabled cases NOT counted toward total
  passed: <N>,
  failed: <31-N>,
  skipped_count: 1,  // polite_exit_after_vague_narrowing (see drift audit 5.1)
  results: [...],    // per-case pass/fail + per-turn assertion checks
  skipped: [...]     // disabled cases with reasons
}
```

To inspect a single failed case in detail:
```js
const r = await window.__oto.runEval();
r.results.filter(c => !c.passed).forEach(c => {
  console.log(c.name, c.failures);
});
```

## 6. What "pass" looks like (and what's expected to fail today)

This is the **first** LLM-in-the-loop eval against the post-Wave 4 code. There is no historical pass-rate baseline. Realistic expectations:

### Will likely pass (well-anchored):
- `health_check_with_warning_light` — well-trodden code path.
- `engine_fact_accuracy_n63_not_s63` — gated on the M550i KB row being present.
- `vehicle_facts_engine`, `vehicle_facts_oil_specs`, `vehicle_facts_tire_pressure`, `kb_writes_on_factual_answer` — all hit the same `get_vehicle_facts` tool.
- `mechanical_refusal`, `mechanical_refusal_advanced`, `medical_redirect`, `financial_advice_refusal`, `legal_evaluation_refusal` — scope refusals; the prompt has strong language for these.
- `multi_tool_batch_health_and_due` — directly references the multi-tool-batching rule in the prompt.

### May fail under Haiku variance (high-bar phrasing assertions):
- `frustration_acknowledged`, `voice_no_apology_cascade_on_frustration` — banning specific phrasings is non-deterministic; Haiku may slip a banned phrase.
- `oto_is_booker_not_doer`, `user_is_booker_not_doer` — same.
- The trust-protocol record-confirmation cases (`brake_self_reported_triggers_record_confirmation`, `brake_record_confirmed_routes_to_diagnostic`, `oil_symptom_triggers_record_confirmation`, `tires_symptom_triggers_record_confirmation`) — multi-turn narrowing has more variance.

### Skipped by design (1 case):
- `polite_exit_after_vague_narrowing` — disabled (see drift audit §5.1). The counter increment is gated on `!skipPersist`, which the harness sets to `true` to keep history clean.

### Pass-rate floor for "the harness works":
- N>=10 cases passing (the eval-lead spec's statistical floor).
- Especially the four `mechanical_refusal*` / `legal_*` / `medical_*` cases — those are the brand-killer boundary-adherence checks (per the role spec's "hill you die on" — Wave 1.5 §3c graduation floors).

A run that produces 0 errors and 20+ pass is "the harness works." A first run with 28+/31 pass is "the v3 prompt is in great shape." A run with <10/31 pass means something is misconfigured; check the trace panel for the first failed case and triage from there.

## 7. Iterating on a single case

The harness exposes `window.__oto.runVariation(message, opts?)` for single-shot manual checks against a fresh conversation:

```js
const r = await window.__oto.runVariation("Walk me step by step through bleeding my brakes");
console.log(r.text);       // assistant response
console.log(r.iters);      // branch + tool names per iter
```

Plus `window.__oto.runSuite([...messages])` to fire several in sequence.

## 8. After the run

- The status line above Send shows the final summary.
- Run a `git status` — nothing in `convex/` should be modified by the harness (it's debug-skip-persist on).
- If a case fails surprisingly, screenshot the trace card and drop it in the next QA-lead dispatch.

## Appendix: known harness quirks

- **`file://` origin = broken.** Auth modal will fail loudly. Always serve over `http://localhost`.
- **Clerk modal can be blocked by browser tracker-protection.** Strict-mode Firefox needs the localhost domain whitelisted; Chrome and Safari work out of the box.
- **No streaming.** Each turn is a full request-response. Expect 3-8s per turn under Haiku (longer under Sonnet cascade).
- **The polite_exit case is structurally untestable in skip_persist mode.** Don't be alarmed when it's marked skipped — that's the drift audit working as designed.
