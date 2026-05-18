# Oto AI — Documentation Index

| | |
|---|---|
| **Owner** | Waleed Mansour |
| **Current runtime version** | v0.9 (see `Oto_AI_v0.9_Handoff.md`) |
| **Source of truth for prompt body** | `convex/oto/system_prompt.ts` (NOT the markdown — see note in `Oto_AI_Cached_System_Prompt_v0.md` header) |
| **Last updated** | 2026-05-14 |

This folder is the canonical reference for Oto AI. A new session should read these in order.

## Reading order (start here)

1. **`Oto_AI_v0.9_Handoff.md`** — latest session handoff. Current state, what shipped, what's pending, footguns, next-session priorities.
2. **`tool-inventory.md`** — v0.9 Current Tools section at the top is the authoritative tool inventory. Historical v3 Phase 1 spec follows below for context.
3. **`oto-engine-inventory.md`** — v0.9 State Update at the top + the Five Locked Decisions (A/B/C/D) and Twelve Locked Principles still in canonical sections below.
4. **`handoff-addendum.md`** — v0.9 status note + Section 4.5 ("render, don't navigate") architectural rationale.
5. **`Oto_AI_Cached_System_Prompt_v0.md`** — header changelog tracks v0.6 → v0.9. **The runtime body is in `convex/oto/system_prompt.ts`** — this markdown's body is the v0.6 historical snapshot.
6. **`slug-drift-remediation.md`** — parked cleanup work; still applies as of v0.9.

## Historical handoffs (for journey context)

- `Oto_AI_v0.6.2_Harness_Handoff.md` — harness scaffold, conversation/vehicle dropdowns, Directive 7 (vehicle_id lookup fix), known_issues label translation
- `Oto_AI_v0.7_Handoff.md` — friendliness rewrite, conversation_state plumbing, vehicle_facts capability, telemetry, prompt caching, polite-exit counter, eval harness
- `Oto_AI_v0.8_Handoff.md` — vehicle_facts KB (semantic + structural), lookup_vehicle_spec, web_search, educational AI repositioning, multi-tool batching, no-system-narration rule, loop hardening
- `Oto_AI_v0.9_Handoff.md` — 6-stage booking flow chain, pricing rule, trigger-only render schemas, confirm=execute, pre_selected_id, Sonnet cascade scaffolding, render diagnostic form fix

## Source-code anchors

| Doc reference | Code file |
|---|---|
| Prompt body | `convex/oto/system_prompt.ts` |
| Tool schemas (source-of-truth) | `convex/oto/tools.ts` |
| Wired tool set | `convex/oto/chat.ts` (`TOOL_NAMES_V1`) |
| Dispatcher | `convex/oto/dispatcher.ts` |
| Booking flow scenarios (rule engine, historical reference) | `services/ai/scenarios.ts` |
| Diagnostic enum (still snake_case in code; founder-canonical labels in v0.9 handoff) | `lib/diagnostic-checklist-templates.ts` |
| Harness (drives the runtime end-to-end) | `scripts/oto-harness.html` + `scripts/oto-eval-cases.json` |
| Schema | `convex/schema.ts` — `ai_conversations`, `ai_messages`, `vehicle_facts`, `oto_telemetry` |

## When in doubt

The runtime is source of truth. If a doc disagrees with `convex/oto/system_prompt.ts` or `convex/oto/tools.ts`, patch the doc, not the runtime — unless founder review locks the doc statement.
