> **HISTORICAL DOCUMENT — v0.7.** Current runtime is v0.9. Read `Oto_AI_v0.9_Handoff.md` first. This document is kept for journey context (when the friendliness rewrite, conversation state plumbing, vehicle_facts capability, telemetry, prompt caching, polite-exit counter, and eval harness all shipped).

# Oto AI v0.7 — Session Handoff

| | |
|---|---|
| **For** | The next Claude session continuing Oto AI work |
| **From** | Claude (Cowork mode, this session) |
| **State** | v0.7 prompt + state plumbing + telemetry + caching + polite-exit counter + eval harness shipped. **7 of 8 golden cases passing**. One persistent Decision A loophole remains as a Sonnet-cascade calibration target. |
| **Founder** | Waleed Mansour (mrdogsog@gmail.com) |
| **Canonical reference** | `docs/oto-ai/` — see `Oto_AI_Cached_System_Prompt_v0.md`, `oto-engine-inventory.md`, `tool-inventory.md`, `handoff-addendum.md`, `slug-drift-remediation.md` |

---

## Read this first

The canonical Oto AI specification lives in `docs/oto-ai/`. The v0.7 changes documented here layer on top of those docs. If anything in this handoff conflicts with what's in `docs/oto-ai/`, the canonical doc wins.

The harness (`scripts/oto-harness.html`) is the iteration ground truth. Open via `npx serve scripts` → `http://localhost:3000/oto-harness.html`. Do NOT open via `file://`.

**Waleed's operating preferences** (locked across sessions):
1. One task per prompt. Never bundle multiple fixes.
2. Direct answers, no padding.
3. Push back when you disagree, don't reflexively defer to Phase 2.
4. Don't over-engineer. Most bugs are one line.
5. Investigation before implementation.
6. Use existing patterns (Convex SDK, existing queries) — don't reinvent.

---

## Diagnostic subsystem options — codebase + canonical

| Codebase enum | UI label (current) | Founder-stated canonical |
|---|---|---|
| `brakes` | "Brakes" | brake |
| `tires_wheels` | "Tires & Wheels" | tires |
| `engine` | "Engine" | engine |
| `battery_electrical` | "Battery & Electrical" | Battery & electrical |
| `not_sure` | "Not Sure" | not sure |

**Drift to reconcile** (still pending — flagged in prior handoff, not yet shipped):
- `components/ai-chat/AIDiagnosticForm.tsx` — UI labels
- `lib/diagnostic-checklist-templates.ts` — enum values
- `convex/oto/system_prompt.ts` — Decision B mapping table references old enum
- `convex/oto/tools.ts` — `render_diagnostic_form.diagnostic_system` enum
- `convex/schema.ts` — `bookings.diagnostic_system` column

Open question: should the codebase enum values rename to match the labels (e.g., `brakes` → `brake`, `tires_wheels` → `tires`), or do labels change while enum stays?

---

## What v0.7 shipped this session

### Backend infrastructure

**Conversation state plumbing (the lead feature).** Oto now maintains conversational memory across turns without re-deriving context from raw history.

- **Schema:** `ai_conversations` got five new optional columns — `mood`, `arc_summary`, `established_facts`, `last_user_intent`, `state_updated_at`, plus `diagnostic_turn_count` for the polite-exit counter.
- **Mutation:** `convex/ai_conversations.ts:updateState` (auth-scoped, replaces full state — no merging) and `setDiagnosticTurnCount` (server-managed; Haiku can't game the counter).
- **Tool:** `update_conversation_state` — new "state" tool category. Side-effect call that fires alongside whatever else Haiku is doing in a turn. Does NOT terminate the loop. Schema accepts `mood` (enum), `arc` (string ≤400 chars), `established_facts` (string[]), `last_intent` (free-form tag). Loop machinery routes parallel-dispatched state acks alongside data results when needed.
- **Envelope:** `convex/oto/envelope.ts` now emits `<conversation_state>` block in the uncached zone (above conversation_history). Replays mood, arc, facts, intent on every turn so Haiku has them inline.
- **Field-name alignment:** All three layers (tool param + envelope label + mutation arg) use the short names `arc` and `last_intent` to prevent the alignment bug that surfaced mid-session (Haiku writing `arc` while mutation expected `arc_summary` → silent drop). Mutation translates short names → DB columns internally for back-compat.

**Vehicle facts capability.** Users can now ask specs about their own car.

- `convex/oto/vehicleFacts.ts` — new `getVehicleFacts` query joining `vehicles` → `vehicle_configs` → `engines`, `transmissions`, `trims`, `trim_specs`. Returns engine (displacement, cylinders, configuration, aspiration, oil viscosity + capacity, coolant type + capacity, spark plug count, timing type), transmission (type, speeds, fluid), drivetrain, tire fitment (size + pressure + run-flat/staggered flags), brake/PS fluid types + capacities.
- Wired as `get_vehicle_facts` data tool. Prompt teaches Haiku to call it for user's-car spec questions; to use training knowledge for cars they don't own.

**Block 2 closure (from prior handoff).** Both `get_bookings` and `get_due_services` callables landed last session — verified wired in v0.7. Total data tool count: 7. Total tools advertised: 10 (7 data + 1 state + 2 render).

**Block 3 — `render_service_picker` wired** in TOOL_NAMES_V1.

**Block 4 — invariant tightened.** Module-load check now scans the system prompt body for backticked tool references and verifies every name appears in `TOOL_NAMES_V1`. Closes the drift footgun where prompt-advertised-but-not-wired tools cause silent dispatcher failures.

**Block 5 — `oto_telemetry` table + fire-and-forget write per turn.** Schema: conversation_id, user_id, ts, model, system_prompt_version, iterations_used, hit_cap, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, total_latency_ms, tools_called, final_branch, booking_id, error. Locked Principle #12 satisfied — cost-per-booking is now verifiable.

**Block 6 — prompt caching.** `system` field switched from raw string to a content block with `cache_control: { type: "ephemeral" }`. Tools array gets a cache_control breakpoint on its last entry. Should drop input-token cost ~90% on cached turns. Telemetry captures cache_creation/cache_read tokens for verification.

**Block 7 — eval harness.** `scripts/oto-eval-cases.json` with 8 golden cases, runner at `window.__oto.runEval()`. Asserts tool calls, branch, text contains/not-contains, form system. **Currently 7/8 passing**. Locked Principle #8 satisfied — every prompt change can now be evaluated.

**Polite-exit counter (Phase 2 item — early).** `diagnostic_turn_count` on `ai_conversations`. chat.ts increments when Haiku stays in `symptom_narrowing_*` intent without rendering the form; resets to 0 when form renders. At ≥6 the envelope emits a `<polite_exit_required>` block forcing `render_diagnostic_form` with `not_sure`.

**Markdown post-process strip (`stripVoiceMarkup`).** Server-side belt-and-suspenders — strips `**bold**`, `__bold__`, and `# heading` markers from Haiku's text before persistence + return. The prompt forbids markdown on data points but Haiku falls back to it under pressure; this guarantees the voice rail.

### Prompt — v0.7

Major rewrite of the `# Voice` section. Friendliness is now the baseline; the `calm > restrained > confident > direct` hierarchy is reframed as an **override stack for hard turns** (frustration, safety, legal-adjacent, abuse), not the default mode.

New subsections under Voice:
- **What "friendly" sounds like in practice** — contractions, casual openers, first-person POV (*"I'm seeing"* not *"the system shows"*).
- **What "friendly" never sounds like** — banned phrasings (*"Certainly!"*, *"I'd be happy to help!"*, *"As an AI assistant…"*), no AI self-narration, no pleasantry padding.
- **Adaptive shaping** — explicit mood-by-mood guidance (calm, worried, frustrated, hyped, confused). Read mood, adjust pacing/depth/warmth, NEVER mirror vocabulary or intensity.

New top-level section: `# Conversation state — your memory across turns`. Explains the envelope block, the tool, mandates state updates on EVERY turn including terminal-render and single-shot factual turns.

New top-level section: `# General car knowledge — facts about cars the user doesn't own`. Permits answering from training knowledge with hedges; bans pretending to look things up; lists what's still off-limits (live pricing, recalls, inventory).

Tool entries added: `get_vehicle_facts`, `update_conversation_state`.

Decision A tightened with explicit banned-phrasing list AND a decision tree for on_time-state symptom routing. (Persistent loophole — see Open Issues.)

Anti-fabrication rule sharpened in the service-history Voice subsection.

Score-volunteer trigger phrases enumerated explicitly (was vague; eval failure forced the tightening).

Cause-speculation rule generalized from specific banned phrases to an abstract pattern (any tool-finding + 2+ named mechanical possibilities = banned).

---

## Eval baseline — 7/8 passing

Run via `await window.__oto.runEval()`.

| Case | Status |
|---|---|
| `health_check_with_warning_light` | PASS |
| `brake_narrowing_on_time_to_diagnostic` | **FAIL** (Decision A loophole) |
| `frustration_acknowledged` | PASS |
| `override_pushback` | PASS |
| `mechanical_refusal` | PASS |
| `legal_evaluation_refusal` | PASS |
| `vehicle_facts_engine` | PASS |
| `general_car_knowledge_other_car` | PASS |

The one failing case has been re-attempted four times with progressively stricter prompt rules; Haiku consistently slips back to recommending direct Brake Pad Replacement when symptoms "feel like" wear, even with brakes flagged `on_time`. This appears to be a Haiku instruction-following ceiling — likely best addressed by:

1. **Sonnet cascade** (Phase 2, deferred for calibration data) — Sonnet follows complex instructions more reliably than Haiku
2. **Structural enforcement** — a server-side guard that detects "direct service recommendation in turn that should render diagnostic_form" and rewrites/blocks
3. **Few-shot examples** in the prompt of the correct on_time → diagnostic-form path (current examples 11/12 already cover this but may need re-emphasis)

Documenting as a known Phase 2 calibration target.

---

## Open issues to address next session

1. **Decision A loophole** — `brake_narrowing_on_time_to_diagnostic` eval failure. See above.

2. **Source-of-truth markdown sync.** `docs/oto-ai/Oto_AI_Cached_System_Prompt_v0.md` is still on v0.6 content. Needs full sync to v0.7 prompt body. Byte-identity rule applies. Add changelog row for v0.7.

3. **Diagnostic enum drift** (still pending from prior handoff). Founder-stated canonical labels are `brake`, `tires`, `engine`, `Battery & electrical`, `not sure`. Codebase has `brakes`, `Tires & Wheels`, `Battery & Electrical`, `Not Sure`. Five locations need to move together — listed at top.

4. **Cause speculation pattern persistence.** Even with the generalized rule, Haiku occasionally enumerates causes on tool findings under longer-response pressure. Same Phase 2 calibration territory as #1.

5. **Vehicle facts tool not yet eval-tested in detail.** The single golden case (`vehicle_facts_engine`) just verifies the tool fires; depth of response quality not covered. Future eval expansion should add: oil-spec lookup, tire-pressure lookup, fluid-spec lookup, drivetrain-question.

---

## Phase 2 remaining (not yet shipped this session)

- **Sonnet escalation cascade** (`#18`). Two tools (`request_sonnet_handoff`, `request_haiku_handback`), dispatcher per-turn routing, Sonnet system-prompt addendum, Haiku complexity self-assessment section. Needs TestFlight calibration to set thresholds — that's the deferral reason per the vision doc. Target: complexity self-assessment fires on 15-25% of diagnostic turns.

- **Streaming responses** (`#20`). Convert `sendMessage` to a streaming action. Mobile client renders tokens as they arrive. First-token latency target <600ms. Big infra change touching the chat screen + protocol.

- **RAG knowledge base scaffold** (`#21`). Vector store for verified service content. `retrieve_kb_chunk` tool. Per-make/model service content seeded for top 5 makes (BMW, Toyota, Honda, Ford, Tesla). Locked Principle #5 — the moat.

---

## File map — v0.7 changes

```
convex/schema.ts                                  [MOD]  +6 cols on ai_conversations, +1 table oto_telemetry
convex/ai_conversations.ts                        [MOD]  +updateState, +setDiagnosticTurnCount
convex/oto/system_prompt.ts                       [MOD]  v0.7 — voice rewrite, state section, general-knowledge section, Decision A tighten, banned-phrasing lists
convex/oto/tools.ts                               [MOD]  +update_conversation_state, +get_vehicle_facts, +state category
convex/oto/chat.ts                                [MOD]  state callable, state-tool dispatch, prompt caching, telemetry, polite-exit counter, stripVoiceMarkup, prompt-body invariant
convex/oto/envelope.ts                            [MOD]  +<conversation_state> block, +<polite_exit_required> block
convex/oto/vehicleFacts.ts                        [NEW]  getVehicleFacts query
convex/oto/telemetry.ts                           [NEW]  recordTurn mutation
scripts/oto-eval-cases.json                       [NEW]  8 golden cases
scripts/oto-harness.html                          [MOD]  +runEval() + cases loader
docs/oto-ai/Oto_AI_v0.7_Handoff.md                [NEW]  this document
```

---

## Sources — canonical first

In reading order for someone picking this up cold:

- `docs/oto-ai/Oto_AI_Cached_System_Prompt_v0.md` (needs v0.7 sync — runtime is `convex/oto/system_prompt.ts`)
- `docs/oto-ai/oto-engine-inventory.md`
- `docs/oto-ai/handoff-addendum.md`
- `docs/oto-ai/tool-inventory.md`
- `docs/oto-ai/slug-drift-remediation.md`
- `convex/oto/system_prompt.ts` — v0.7 prompt body
- `scripts/oto-harness.html` — read top-to-bottom
- `scripts/oto-eval-cases.json` — current eval set

---

*End of handoff. v0.7 is a meaningful step: state plumbing, friendliness, vehicle facts, general knowledge boundary, telemetry, caching, polite-exit counter, eval harness — all shipped. The remaining loophole is a Sonnet-cascade calibration target, not a prompt-iteration target.*
