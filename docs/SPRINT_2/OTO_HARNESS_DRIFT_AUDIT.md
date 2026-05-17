# Oto Harness — Drift Audit (Sprint 2 / Wave 3 pre-flight)

**Date:** 2026-05-16
**Dispatched by:** AI QA & Evaluation Lead (PM dispatch under Wave 3 design lock-in)
**Inputs audited:**
- `scripts/oto-harness.html` (1797 LOC, last touched pre-Wave 4)
- `scripts/oto-eval-cases.json` (31 cases, 505 LOC)
**Audited against HEAD `176f070`** (Wave 4 prompt split landed; Wave 7.3 bumpMoat wired).

## Executive summary

The harness held up MUCH better than the "completely outdated" framing implied. Five sprints touched the chat path; only **two** mechanical drifts make a case-set adaptation necessary. The conceptual frame (case shape, runner, three branch labels, assertion vocabulary) is still load-bearing and worth preserving as-is.

Counts:
| Category | Drifts found |
|---|---|
| Tool-name drift | 0 |
| Branch-string drift | 0 |
| Endpoint / auth drift | 0 |
| Convex URL default | 0 |
| System-prompt assumption drift | 1 (subtle, harness-runtime only) |
| Schema drift | 0 |
| Other surprising | 2 |

## 1. Tool-name drift — NONE

Every tool name asserted in `oto-eval-cases.json` exists in current `convex/oto/tools.ts` and is advertised by `convex/oto/chat.ts:TOOL_NAMES_V1` (lines 84-112). Unique tool names asserted across all 31 cases:

- `get_bookings`
- `get_due_services`
- `get_vehicle_facts`
- `get_vehicle_health`
- `lookup_vehicle_spec` (not asserted in any `tools_called`, only banned in `text_not_contains`)
- `record_vehicle_fact` (referenced in `kb_writes_on_factual_answer` description; not in `tools_called`)
- `render_diagnostic_form`
- `render_record_confirmation`
- `update_conversation_state`
- `web_search` (referenced in `text_not_contains` only)

All 10 are wired and live. `lookup_vehicle_spec` is wired both as a callable (chat.ts:94) and as a category-mapped data tool (tools.ts:769). `web_search` is a server-managed Anthropic tool (chat.ts:121-128). No removals, no renames.

## 2. Branch-string drift — NONE

JSON cases reference `branch: "text_only"` and `branch: "terminal"`. `chat.ts:534-538` emits exactly these three labels: `terminal | text_only | data_continue`. The branch assignment logic still picks the last iter's branch. (Verified: harness eval runner already reads `iters[iters.length - 1].branch` at line 1694.)

## 3. Endpoint / auth drift — NONE

- Action path `oto/chat:sendMessage` matches `chat.ts:253` (`export const sendMessage`). Convex exposes it as `api.oto.chat.sendMessage` → wire path `oto/chat:sendMessage` ✓.
- Auxiliary queries used by the harness (`vehicles:getMyVehicles`, `users:getCurrentUser`, `ai_conversations:getByUserId`, `ai_conversations:create`, `ai_messages:getByConversationId`) all exist and have matching argument shapes.
- Clerk template name is still `"convex"` (canonical; unchanged across all sprints).
- The action's return shape (`text, quickReplies?, showDiagnosticForm?, showRecordConfirmation?, …, trace?`) is byte-compatible with what the harness already destructures (lines 786-799).

## 4. Convex URL default — CURRENT

`oto-harness.html:372` hardcodes `https://flippant-mink-750.convex.cloud`. `.env.local` confirms:
```
CONVEX_DEPLOYMENT=dev:flippant-mink-750
EXPO_PUBLIC_CONVEX_URL=https://flippant-mink-750.convex.cloud
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YWxsb3dpbmctbGFkeWJpcmQtMjAuY2xlcmsuYWNjb3VudHMuZGV2JA
```
Both the URL and the publishable key in `DEFAULTS` (oto-harness.html:371-382) match `.env.local` exactly. No change needed.

## 5. System-prompt assumption drift — ONE (case-specific)

### 5.1 `polite_exit_after_vague_narrowing` (oto-eval-cases.json:354-371)

This is the only case that meaningfully misbehaves under the harness today. The case asserts that the 6th narrowing turn fires `render_diagnostic_form` with `form_system: "not_sure"`.

**Mechanism:** The polite-exit threshold (`POLITE_EXIT_THRESHOLD = 6` at `envelope.ts:59`) is gated on `ai_conversations.diagnostic_turn_count`. The counter is incremented in `chat.ts:817` — but only inside `if (!skipPersist)` (line 804). The harness runner defaults to `debug_skip_persist: true` (oto-harness.html:1689), so **the counter never increments under harness runs**.

This is a real interaction effect between Wave 3.x (skip_persist) and the polite-exit Locked Principle #6. Two non-invasive fixes are available; this dispatch is using fix (B):

- **(A)** Add a harness flag to set the counter manually before sending each turn. Requires touching `convex/oto/`, which is out of scope.
- **(B)** Mark the case `disabled: true` with `disabled_reason` pointing here. Preserves intent, lets all other cases run.

Trust-protocol cases (`brake_self_reported_triggers_record_confirmation`, `brake_record_confirmed_routes_to_diagnostic`, `oil_symptom_triggers_record_confirmation`, `tires_symptom_triggers_record_confirmation`) were checked against `Trust_Protocol_Inflight_Handoff.md` — the doc still exists (`docs/oto-ai/Trust_Protocol_Inflight_Handoff.md`) and the prompt still references the gate at `prompt/stable.ts:281`, `327`, `349`, `381`. Protocol shape is intact.

## 6. Schema drift — NONE

`vehicle_searched_facts` consolidation was checked: the dispatcher `record_vehicle_fact` callable still writes through `vehicleFactsEditing.ts` helpers, which use the post-consolidation schema. No case asserts a specific table shape — cases assert tool calls and response text only, so they are insulated from schema churn.

## 7. Other surprising findings

### 7.1 Eval runner already supports `state_tool_uses`

`oto-harness.html:1698` already aggregates `state_tool_uses` into `toolsThisTurn`. This means `update_conversation_state` (a state-category tool per `OTO_TOOL_CATEGORY` at `tools.ts:774`) is correctly picked up by the assertion engine. The harness was retrofitted for the state-category split before the JSON cases were last revised, which is why ~21/31 cases include `update_conversation_state` in `tools_called` and still match. No change needed.

### 7.2 Test user's default VIN tail `N96146` is BMW M550i — engine-fact case is sensitive

`engine_fact_accuracy_n63_not_s63` asserts `text_contains: ["N63"]` and `text_not_contains: ["S63", "625 hp"]`. This is correct for Waleed's saved 2020 M550i (engine code N63 B44O2). If the test user's saved vehicle changes or the vehicle facts KB regresses, this case will fail in a load-bearing way. Worth keeping as the "engine-fact regression canary."

### 7.3 No `_doc` / `description` was lost in adaptation

The JSON has a top-level `_doc` field with the schema contract. Cases all have human-meaningful `description` fields. Preserved verbatim per the dispatch constraint.

## Drift conclusion

Net adaptation required: **disable 1 case** (`polite_exit_after_vague_narrowing`) until the counter-increment gate is decoupled from `skipPersist`. Everything else passes inspection.
