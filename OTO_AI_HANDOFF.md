# Oto AI — Microscopic Handoff

**Audience:** the next person (or the next Claude session) who is going to fine-tune Oto.
**Status:** synthesized from a full read of `convex/oto/`, `components/ai-chat/`, `app/(main-tabs)/ai-chat/`, `services/ai/`, `stores/`, related `hooks/`, and the supporting utilities. Every claim below is keyed to a file and a line range. Cross-checked against source on May 18, 2026.

**Owner:** Waleed.
**Repo state at time of writing:** branch `main`, working tree at `C:\Users\manso\Desktop\otopair-1`, Convex deployment `flippant-mink-750` (declared in `.env.local` as `CONVEX_DEPLOYMENT`).

---

## 0. The TL;DR for whoever is reading this next

Oto is a Claude-Haiku-driven automotive concierge with a deep, evidence-graded knowledge stack. The framework is already mature — there's a prompt split into stable + volatile, a structured per-turn vehicle envelope, a 24-tool API surface, a reliability-event ladder, an eval harness with Wilson-CI pass-rate scoring, and a Wave-3 mirror of conversation facts into typed append-only rows. This is not an MVP.

The fabrication and "pushy" behavior you observed in the stress tests are not the model failing to know things. They are three specific, locatable bugs:

1. **F1 — fabricated "oil due in 2 weeks" for a car with zero service history.** Real code bug. The `oil` fallback in `convex/oto/vehicleHealth.ts:327` returns `status: "due_soon"` (every other type returns `on_time`), then `URGENT_DETAILS.oil.due_soon` in `utils/maintenanceEnrichment.ts:38-46` stamps a fabricated `"~5 months ago"` last-service date and a `"Service within 2 weeks"` urgency string onto the item. The prompt rule guarding against this fires on `status: "unknown"` — a status the code never emits. The truth gate is written against a state the data layer doesn't produce.

2. **F2 — "Schedule Services" / "Something Feels Off" / "Warning Light is On" tiles on the entry screen.** The data exists in `services/ai/scenarios.ts:180-184` as `WELCOME_SUGGESTIONS`, gets passed as props into `AIGreeting`, but the current `AIGreeting.tsx` doesn't render them — they're dead-piped. If you saw them in the stress test, that was an older branch or a deeper-in-chat surface (`PromptSuggestions`, which uses different copy).

3. **F4 / "User prefers BMW M specialist" overshoot.** The literal string isn't in the codebase. It's emergent: the vehicle envelope renders `display: 2020 BMW M550i xDrive` (`envelope.ts:145-168`), the volatile prompt is loaded with M550i examples (`volatile.ts:90, 127, 149, ...`), and `stable.ts:154-160` defines `mechanic_preference` but says nothing about abstraction level. So when the user expresses "wants a brand specialist," Haiku reaches into the most-primed brand+trim string and writes "User prefers BMW M specialist." Fix is one prompt-rule addition + (optionally) a normalization step at `recordUserSemanticFact` ingest.

4. **F3 — dumping the decision tree** is mostly prompt-side; the protocol exists at `stable.ts:140-148` and elsewhere, but the diagnostic-traversal guidance isn't bound to a hard rule against enumerating causes. Easier to fix once F1/F4 are out of the way.

The Brief's claim that the re-ask bug is unfixed plumbing (Section 8) is *not* what the code shows. `chat.ts:685-802` reads `ai_conversations.established_facts` every turn and `envelope.ts:215-219` renders it. The re-ask is upstream — either Haiku is not calling `update_conversation_state` on the fact-establishing turn, is writing a whole-state replacement that drops the prior fact (the tool is replace-not-merge), or the 12-entry cap at `chat.ts:2684` is silently truncating. Verify with telemetry before re-plumbing.

The eval harness is real and good (`scripts/eval/wave_5_1_harness.ts`, default `--repeats 10`, Wilson 95% CI per query, hard floors documented at lines 268-276). Use it. The Brief's Section 7 cases are absorbable into either `oto-eval-cases.json` (chat behavioral) or `wave_5_1_labeled_set.jsonl` (retrieval cascade).

The rest of this document is the microscope.

---

## 1. What Oto is, architecturally

Oto is a single Convex action (`api.oto.chat.sendMessage`) that, per user turn:

1. Authenticates via Clerk, resolves the user, optionally pins to a vehicle.
2. Loads conversation history (last 10 turns), prior conversation facts, cross-conversation memory.
3. Assembles a layered system prompt: stable rules + a per-turn volatile envelope (vehicle data, conversation state, recent context, polite-exit signal).
4. Calls Anthropic with 24 tools available + `web_search` as a server-managed tool, in a tool-use loop capped at 5 iterations.
5. Persists the user message and assistant turn into `ai_messages` (render substrate) and `conversation_audit` (forensic substrate); fires `oto_telemetry` and optional `reliability_events`.
6. Returns to the mobile client a structured payload with `text`, optional `quickReplies`, and zero or more render-directive envelopes (`bookService`, `showRecordConfirmation`, `linkButton`, `bookingCard`, `bookingsList`).

The mobile client (`app/(main-tabs)/ai-chat/index.tsx`) funnels all five user-input surfaces (typed Send, voice, suggestion tile, quick reply, trust-protocol decision) into one call site at `sendToOtoAI` (lines 374-519) and routes the response into a render loop at lines 1218-1277.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MOBILE CLIENT                                   │
│                                                                              │
│  app/(main-tabs)/ai-chat/index.tsx                                           │
│  ┌──────────────┐   ┌─────────────────┐   ┌───────────────────────────┐    │
│  │  AIGreeting  │ → │  AIInputBox     │ → │  sendToOtoAI(messageText) │    │
│  │  (vehicle    │   │  (typed/voice/  │   │  L374-519                 │    │
│  │   picker)    │   │   attachments)  │   └──────────┬────────────────┘    │
│  └──────────────┘   └─────────────────┘              │                      │
│                                                       │                      │
│  Render loop L1218-1277                               ▼                      │
│  ├ AIMessageBubble (text + quickReplies)   useAction(api.oto.chat.         │
│  ├ BookServiceComponent (if bookService)              sendMessage)         │
│  ├ AIRecordConfirmation (if showRec...)                                    │
│  ├ LinkButton / BookingCard / BookingsList                                 │
│  └ PromptSuggestions (rule-engine path only)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼  Convex action
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONVEX ACTION: oto/chat.ts                           │
│                                                                              │
│  sendMessageHandlerCore  L475-2400+                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Auth + load user (L497-507)                                        │   │
│  │ 2. Load history (HISTORY_TURNS=10), prior facts, x-conv memory       │   │
│  │ 3. Build envelope ─────────► oto/envelope.ts                          │   │
│  │ 4. Build system prompt ────► oto/prompt/{stable,volatile,index}.ts    │   │
│  │ 5. Anthropic tool loop (MAX_TOOL_ITERATIONS=5)                        │   │
│  │    └ tools dispatched via buildCallables (L2040-2290+)                │   │
│  │ 6. Strip render tool blocks; persist message+audit; telemetry         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  TIER 1          │         │  TIER 2          │         │  TIER 3          │
│  Structural moat │         │  vehicle_facts   │         │  web_search      │
│  (28 tables)     │         │  KB (hash/struct │         │  (Anthropic      │
│  via queryMoat   │         │  /text cascade)  │         │  server-side)    │
│  vehicleFacts.ts │         │  vehicleFactsKB  │         │  result → wrote  │
│  vehicleHealth   │         │  cascadeTier2    │         │  back to KB as   │
│  trim_specs etc. │         │                  │         │  unverified      │
└──────────────────┘         └──────────────────┘         └──────────────────┘

Memory:
  ai_conversations.established_facts ◄──── update_conversation_state tool
  conversation_facts (Wave 3 typed mirror, append-only, write-only currently)
  user_semantic_facts (cross-conv, 120-day half-life decay, read on every turn)
  conversation_audit (forensic, every turn)
```

---

## 2. The whole `convex/oto/` map, file by file

### 2.1 The entrypoint: `chat.ts` (3,501 lines)

The action handler runs ~1,650 lines; the rest is the retry/backoff infrastructure plus `buildCallables`, a closure factory that bridges Convex `ctx` into pure dispatcher closures.

Key constants at the top of file (`chat.ts:64-74`):

```ts
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SONNET_MODEL = "claude-sonnet-4-6";
const MODEL = HAIKU_MODEL;       // currently locked to Haiku
const MAX_TOKENS = 1024;
const HISTORY_TURNS = 10;
const MAX_TOOL_ITERATIONS = 5;
```

The 24 tools surfaced to Haiku live at `chat.ts:84-129`. There is a module-load invariant check (`chat.ts:158-238`) that scans the prompt for tool name references and logs `[oto/chat] CONFIG ERROR` if the prompt mentions a tool not in `TOOL_NAMES_V1`. Use this as a guardrail when adding tools.

Turn anatomy:
- `auth` at `chat.ts:497-507`
- conversation load + history fetch
- envelope build (`chat.ts:685-802` is the assembly site — note how `established_facts` is read at line 688, this matters for the re-ask question)
- Anthropic call in tool-use loop
- callable dispatcher: `buildCallables` returns one async fn per tool name; dispatched per `tool_use` block
- response strip, persist, fire telemetry + render-directive envelopes back to the client

### 2.2 The prompt — `prompt/stable.ts`, `prompt/volatile.ts`, `prompt/index.ts`

The system prompt is split for caching efficiency. **`stable.ts`** carries the immutable rules: role, tools, scopes, refusal policy, examples. **`volatile.ts`** carries the per-turn examples and any context the engineering team wants Haiku to weight heavily on this turn. **`index.ts`** combines them.

`stable.ts` is the heart of Oto's behavior. The sections most relevant to the four failure classes:

- **Lines 140-148 — conversation-state discipline**: "There is no turn shape … where you skip the state call." This is the rule the re-ask bug depends on Haiku obeying. Cross-referenced from `tools.ts` `update_conversation_state` definition.
- **Lines 150-170 — semantic fact recording**: `mechanic_preference` is defined as "repeated booking with one mechanic, anchors like 'books with Carlos'." No rule about abstraction level — this is the F4 fix surface for "BMW M specialist."
- **Lines 176-180 — fact retraction**: contains the user-quote-as-example *"I don't trust BMW specialists anymore..."* — this is the only place "BMW specialists" appears in the codebase; it's a *user quote* inside a teaching example, not an instruction.
- **Lines 184-197 — untrusted-user-input boundary**: the wrapping convention that protects against prompt injection. Useful background, not where the failures live.
- **Lines 920-936 — service history rules**: "Don't invent service history. If `get_vehicle_health` shows `status: \"unknown\"` for an item…" — **this rule never fires** because the data layer doesn't emit `"unknown"` for the AMG GT case; it emits `"due_soon"` from the `oil` fallback. The truth gate is misaligned with the code.

`volatile.ts` is loaded with M550i examples (lines 90, 127, 149, 191-195, 215, 227). This is part of why a BMW M550i user gets very BMW-M-flavored Haiku output — the few-shots are about that exact car. Helpful for in-the-trim accuracy, but it also primes the over-specific preference recording.

### 2.3 The vehicle envelope — `envelope.ts`

This is the "Truth Gate context contract" the Brief refers to in §6. It builds a structured, per-turn block that gets prepended to the conversation as `system` content.

Key blocks emitted:
- `<vehicle>` — `formatDisplayString` (lines 145-168) builds the display ("2020 BMW M550i xDrive" for Waleed's car); if year/make/model/trim/nickname are all missing, falls back to `"Your vehicle"` (line 158).
- `<vehicle_facts>` — populated from the KB tier-2 read.
- `<conversation_state>` — lines 215-219:
  ```ts
  if (conversationState.established_facts.length > 0) {
    lines.push(`  established_facts:`);
    for (const fact of conversationState.established_facts) {
      lines.push(`    - ${fact}`);
    }
  }
  ```
  **This is the re-injection site for `established_facts`. It runs every turn.** The plumbing the Brief flagged as broken is in fact wired.
- `<recent_context>` — lines 230-243, prior-conversation facts from `getCrossConversationMemory`. Each line formatted as `- [${fact_type}] ${payload_text}  (${rel})`. The user_semantic_facts payloads land here verbatim — including "User prefers BMW M specialist" if that's what got written.
- `<polite_exit_required>` — lines 245-253, injected when `diagnostic_turn_count >= 6` (the `POLITE_EXIT_THRESHOLD`). Tells Haiku to call `render_book_service` with diagnostic-scan defaults. This is the convergence enforcement from Locked Principle #6.

Absence semantics: the envelope OMITS fields that are missing; it does not send `null`. This is the right shape for a truth gate — Haiku sees the absence as the absence.

### 2.4 The tool surface — `tools.ts`

The 24-tool catalog. By category:

- **State tools** (`update_conversation_state`, `record_semantic_fact`, `retract_semantic_fact`, `record_conversation_fact`, `retract_conversation_fact`) — these have non-terminal semantics: they're side effects, do not gate loop continuation, and return a trivial ack.
- **Read tools** — `get_vehicle_facts`, `retrieve_vehicle_facts` (the T2 cascade entry), `get_vehicle_health`, `get_projected_health_score`, `get_due_services`, `get_bookings`, `get_pending_bookings`, `get_record_for_confirmation`, `lookup_vehicle_spec`, `list_services_for_vehicle`, the four loyalty tools, etc.
- **Render directives** — `render_book_service`, `render_record_confirmation`, `render_quick_replies`, `render_link_button`, `render_booking_card`, `render_bookings_list`. These mark terminal turns and produce client-side envelopes.
- **Server-managed** — `web_search` (Anthropic), bypasses the callable dispatcher.

The "User prefers BMW M specialist" fix touches `tools.ts:508` (the example text in the `text` arg description for `record_semantic_fact`):

> `"The fact, written in third person referring to the user. Concise, single sentence. Example: 'User prefers synthetic oil.' or 'User drives ~30k miles per year.'"`

No guidance about abstraction level. The example primes Haiku to be specific, not general.

### 2.5 The truth-gate stack — `vehicleFacts.ts`, `vehicleFactsKB.ts`, `vehicleFactsEditing.ts`, `lookupVehicleSpec.ts`, `vehicleHealth.ts`, `dueServices.ts`

**`vehicleFacts.ts` (226 lines)** — backs `get_vehicle_facts`. Tier 1 structural-moat reader. Joins `vehicles → vehicle_config → engine + transmission + trim + makes + models + trim_specs`. Every field uses `?? null` — safe at this layer; risk is purely prompt-side.

**`vehicleFactsKB.ts` (528 lines)** — Tier 2 cascade reader against the consolidated `vehicle_facts` table. Three sub-queries: HASH (`canonical_question_key` exact match, O(log n)), STRUCT (`by_vehicle_config → by_chassis → by_engine`), TEXT (Convex `searchIndex` BM25). The disclaim-tag predicate is locked at lines 151-157:

```ts
function computeRenderDisclaimTag(
  source: string,
  verification_status: string | undefined,
): boolean {
  const status = verification_status ?? "unverified";
  return source === "web_search" && status === "unverified";
}
```

This is THE single source of truth for "should we tell the user this answer is hedged" — chat envelope, eval harness, and mobile renderer all consume the boolean. If the renderer drops the boolean, the user can't tell hedged from verified.

**`vehicleFactsEditing.ts` (467 lines)** — the only sanctioned write path for `vehicle_facts`, enforced by `scripts/ci/vehicle-facts-grep.sh`. Sets the verification-status lifecycle:

```ts
// Lines 192-194:
const defaultStatus: "unverified" | "verified" =
  args.source === "web_search" ? "unverified" : "verified";
```

And the web_search confidence floor at lines 148-152: anything from web_search must be `confidence <= 0.7`.

**`lookupVehicleSpec.ts` (284 lines)** — free-text catalog lookup for cars the user does NOT own (comparison questions: "how does the M550i compare to a full M5?"). Word-boundary matching to avoid M5/M550i substring collisions (lines 96-112). Returns null on miss; the prompt at `stable.ts:655` tells Haiku to fall back to training knowledge + web_search with a clean hedge.

**`vehicleHealth.ts` (441 lines) — THE F1 SMOKING GUN.** See §3.1 below.

**`dueServices.ts` (102 lines)** — backs `get_due_services`. Reads `vehicle_service_states` (Ahmad's maintenance-pipeline projections, separate from `maintenance_records`). Returns only `overdue` and `due_soon` rows. The fabrication risk here is **second-order**: if `vehicle_service_states` is populated by the pipeline based purely on OEM intervals without anchoring to `last_service_date`, every car gets synthetic due-dates the moment the pipeline runs. For the AMG GT, **check whether `vehicle_service_states` has rows at all** — if not, `vehicleHealth.ts` is the sole F1 source; if so, `dueServices.ts` is a parallel source needing the same fix.

### 2.6 Memory & cross-conv — `memoryDecay.ts`, `memoryEquivalence.ts`, `memoryEditing.ts`

**`memoryDecay.ts` (171 lines)** — pure 120-day half-life exponential decay on `user_semantic_facts.confidence`, applied at READ time (`effective = stored * 2^(-elapsed_days / 120)`, clamped to [0, 1]). The 0.1 floor is in the consumer, not here.

**`memoryEquivalence.ts` (497 lines)** — paraphrase-tolerant matching for reinforce + retract (Jaccard threshold 0.6 on fingerprinted tokens). Adversarial guard: hostile inputs containing `<untrusted_user_input>`, `<conversation_state>`, etc. as substrings can never match a stored row — forces them through INSERT where the sanitizer rejects.

**`memoryEditing.ts` (~1,943 lines)** — the sanctioned write surface for the five Wave 3 tables. The 12 helpers handle the full lifecycle: record/reinforce/retract for conversation_facts and user_semantic_facts, plus episodic-control, audit, and kb_topics. **Key for the re-ask question:** `getCrossConversationMemory` at lines 1356-1590 EXCLUDES the current conversation (line 1466). So within one conversation, facts dropped from `ai_conversations.established_facts` cannot be recovered from `conversation_facts` rows for THIS conversation — the typed mirror is one-way until Wave 5 cuts over.

### 2.7 Eval & observability — `evalHarness.ts`, `evalTestFilter.ts`, `telemetry.ts`, `reliability.ts`, `promptChangelog.ts`

**`evalHarness.ts` (720 lines)** — single `runFullCascade` action that walks T1 → T2 → T3 and returns which tier hit. T1 topic map is hardcoded at lines 162-314 (22 topics); off-list topics short-circuit to T2 regardless of enrichment availability. **T3 is a stub** at lines 699-709 — returns `{ tier: "T3", facts: [] }` in `--live` eval mode with `no_web_search: true`. This matters: web-search behavior is not exercised in baseline eval.

**`evalTestFilter.ts` (209 lines)** — enforces the `"EvalTest"` make-name sentinel. The eval seed creates synthetic vehicles under `make.name = "EvalTest"`; real chat reads must skip them. Wired into `lookupVehicleSpec.ts`, `vehicleFacts.ts`, `vehicleHealth.ts`, and the `retrieve_vehicle_facts` callable in `chat.ts`.

**Two eval surfaces with different repeat strategies:**
- `scripts/eval/wave_5_1_harness.ts` — retrieval cascade eval. Default `--repeats 10`. Wilson 95% CI per query via `passRateWithConfidence`. Aggregate metrics: p@3, recall@5, MRR, tier_misclass, disclaim_correct, refusal_violation. Graduation bar at lines 268-276.
- `scripts/eval/runs/_run-eval-cases.ts` — chat behavioral eval, port of `scripts/oto-harness.html`. Uses `scripts/oto-eval-cases.json` (~31 cases). Strict criterion: all N attempts must pass (line 365). No CI.

**`telemetry.ts` (40 lines)** — per-turn fire-and-forget `recordTurn` mutation into `oto_telemetry`. Tracks model used, prompt version, iterations, hit_cap, token counts, latency, tools_called, final_branch, optional booking_id and error. Cost-per-booking unverifiable without this (Locked Principle #12).

**`reliability.ts` (409 lines)** — Wave 7.2 reliability-event surface. 21 distinct swallow sites (`KNOWN_SURFACES` at lines 61-88). Demote ladder (`FULL → DEGRADED → MINIMAL → DOWN`) with explicit thresholds at lines 278-280. Read once per turn at handler entrance.

### 2.8 Bookings — `bookings.ts`

184 lines, read-only. Backs `get_bookings` and `get_pending_bookings`. Booking creation does NOT happen here — Oto surfaces a booking by emitting the `render_book_service` terminal tool, which returns a frontend payload; the user's tap inside `BookServiceComponent` is what fires the mutation. The polite-exit pattern (envelope.ts:245-253) hands off to `render_book_service` when `diagnostic_turn_count >= 6`.

### 2.9 Other files

- **`canonicalize.ts` + `.test.ts`** (128 + 130 lines) — pure SHA-256 normalization for `canonical_question_key`. Lowercase → NFKC → strip terminal punct → collapse whitespace. The substrate for T2_HASH cache hits across users.
- **`searchedFacts.ts`** (27 lines) — deprecated stub. Pure re-export from `vehicleFactsEditing.ts`. CI rule 5 blocks new imports.
- **`factReports.ts`** (26 lines) — single-line re-export alias `report → reportVehicleFact`.
- **`recordConfirmation.ts`** (109 lines) — backs `AIRecordConfirmation` mobile component. Two-step state machine. The trust-gating tool: when `self_reported on_time` contradicts user-described symptoms, the prompt rule at `stable.ts:330` says call this FIRST. **No symmetric rule exists for `inferred` items** — relevant to F1.
- **`queryMoat.ts`** (700 lines) — per-user read rate-limiter wrapping the 28 moat tables. Defends against compromised auth pulling the whole enrichment lake. Soft-block returns `[]` silently (lines 312-319), which is itself a small absence-vs-presence risk under load.
- **`migrations/vehicleFactsReconciliation.ts`** (852 lines) — fourth defense layer, 15-min cron, four parity checks (replay equivalence, counter parity, orphan audit rows, telemetry parity). Pages on first anomaly for the strict checks.
- **`migrations/verifiedFactsSeed.ts`** (347 lines) — eval-only fixture writes for cross-tenant verified/unverified test cases.
- **`migrations/evalTenantsSeed.ts`** (494 lines) — two users (`oto_eval_user_a/b`) and one synthetic vehicle (year 9999 "CrossTenantFixture" Base trim). Purely a structural fixture for cross-tenant boundary testing. No behavioral personas.

---

## 3. The four failure classes — where they live in code

### 3.1 F1 — fabricated "oil due within 2 weeks" (the AMG GT case)

**This is the only failure that is a real, locatable code bug.**

**Path through the code, verified line by line:**

1. User opens chat with the AMG GT as active vehicle. Haiku calls `get_vehicle_health`.
2. `chat.ts:2040` dispatches to `api.oto.vehicleHealth.getVehicleHealth`.
3. `loadVehicleContext` in `vehicleHealth.ts:162` queries `maintenance_records` by `by_vehicle_owner`. Returns `[]` for the AMG GT.
4. `buildMaintenanceItems` returns an empty Map. The for-loop at line 272 iterates `ALL_MAINTENANCE_TYPES`. For `oil`:
   - No userItem → fall through
   - No warning light → fall through
   - Not a battery → fall through
   - Hits the fallback table at lines 326-331:
     ```ts
     const fallback: Record<string, { status: MaintenanceStatus; description: string; detail: string }> = {
       oil:    { status: "due_soon", description: "No oil change data — service recommended", detail: "Check soon" },
       brakes: { status: "on_time",  description: "No brake concerns reported",              detail: "On time" },
       tires:  { status: "on_time",  description: "No tire concerns reported",               detail: "On time" },
       battery:{ status: "on_time",  description: "No battery concerns reported",            detail: "On time" },
     };
     ```
     **Notice: `oil` is the only type that defaults to `due_soon` when no data exists.** Every other type defaults to `on_time`. Likely a residue from an earlier "always nudge users about oil changes" product decision.
   - Pushes `{ id: "unknown-oil", status: "due_soon", description, detail }`.
5. `enrichedItems = merged.map(enrichUrgentItem)` at line 345.
6. `enrichUrgentItem` in `utils/maintenanceEnrichment.ts:149-164` matches the `due_soon` status:
   ```ts
   const type = item.id.replace(/^(unknown-|user-|smartcar-)/, "");
   const details = URGENT_DETAILS[type]?.[item.status];
   ...
   return { ...item, ...details };
   ```
   `item.id = "unknown-oil"` → strips to `"oil"` → reads `URGENT_DETAILS.oil.due_soon`:
   ```ts
   due_soon: {
     lastService: "~5 months ago",
     urgency: "Service within 2 weeks",
     impacts: [...],
     recommendation: "Your oil is approaching the end of its service life. Plan an oil change soon to keep your engine running smoothly.",
   },
   ```
   **These are constants. They get stamped on any item with status `due_soon`, no matter the actual vehicle.**
7. `toAiShape` (vehicleHealth.ts:354) flattens to: `last_service: "~5 months ago"`, `urgency_label: "Service within 2 weeks"`, `record_provenance: "inferred"` (because `id.startsWith("unknown-")`).
8. Tool result sent back to Haiku. Haiku reads `urgency_label: "Service within 2 weeks"` and renders "Your oil change is due within the next 2 weeks."
9. The prompt rule at `stable.ts:934` ("Don't invent service history. If `get_vehicle_health` shows `status: \"unknown\"` for an item...") DOES NOT FIRE — because the code never emits `status: "unknown"`. The truth gate guards a state the data layer doesn't produce.

**Three orthogonal fixes, all needed:**

1. **Defaulting fix** — change `vehicleHealth.ts:327` so `oil` defaults to `on_time` like the others, OR introduce a new `"unknown"` status to the `MaintenanceStatus` union and use it here. This makes the `stable.ts:934` rule actually fire.
2. **Enrichment guard** — gate `enrichUrgentItem` in `utils/maintenanceEnrichment.ts:149` on `record_provenance !== "inferred"`. Inferred items should not get fabricated `lastService` strings stamped on them. The safer pattern is to split `URGENT_DETAILS` into `inferred_safe` (no dates, no fabricated history) vs `record_backed` (current copy).
3. **Prompt rule** — add a rule to `stable.ts` keyed on `record_provenance: "inferred"`: "When a maintenance item has `record_provenance: \"inferred\"`, NEVER assert a specific timeline. Say 'I don't have your [type] history' and offer to add a record via render_record_confirmation." Symmetric to the existing trust-gate rule at `stable.ts:330` for `self_reported`.

**Defense in depth — `vehicleHealth.ts:381`** — additionally, strip the `last_service` and `urgency_label` fields from `toAiShape` when `record_provenance === "inferred"`. Even if the prompt rule fails, the fields aren't there to misread.

**Also check `dueServices.ts`/`vehicle_service_states`:** if Ahmad's pipeline projects synthetic due-dates onto unanchored vehicles, that's a parallel F1 source needing the same anchor check (`last_service_date` defined before `due_at_date` is allowed to emit).

### 3.2 F2 — "Schedule Services" / "Something Feels Off" / "Warning Light is On" on the entry screen

**Status: the data exists; the JSX does not currently render it.**

`WELCOME_SUGGESTIONS` is defined at `services/ai/scenarios.ts:180-184`:

```ts
export const WELCOME_SUGGESTIONS = [
  { id: "oil", text: "Schedule Services for my Vehicle", value: "Schedule Services for my Vehicle" },
  { id: "vague", text: "Something Feels Off", value: "Something Feels Off" },
  { id: "check_engine", text: "Warning Light is On", value: "Warning Light is On" },
];
```

Re-exported from `services/ai/scenarioEngine` and passed into `AIGreeting` at `ai-chat/index.tsx:1200`:

```tsx
<AIGreeting
  userName={userFirstName}
  suggestions={WELCOME_SUGGESTIONS}
  onSuggestionPress={handleSuggestionPress}
  ...
/>
```

`AIGreeting.tsx:52-61` declares the props:
```tsx
interface AIGreetingProps {
  userName?: string;
  suggestions: { id: string; text: string; subtitle?: string; value?: string }[];
  onSuggestionPress: (text: string) => void;
  ...
}
```

**But the JSX at `AIGreeting.tsx:247-346` never references `suggestions` or calls `onSuggestionPress`.** A full read + grep confirmed: the only references to `suggestions` are the prop declaration and the destructure. The greeting currently renders the welcome text + vehicle carousel only.

**Three implications:**
- If the Brief observed those tiles in stress testing, that observation is either (a) from an older branch where `AIGreeting` rendered them, or (b) from `PromptSuggestions` deeper in chat (which uses different copy: "My brakes are squeaking", "I need an oil change", etc. — `PromptSuggestions.tsx:202-208`).
- The data is dead-piped. Cleanest fix: delete the prop wiring at `index.tsx:1200-1201` and the prop declaration at `AIGreeting.tsx:54-55, 169-170`. Optionally delete `WELCOME_SUGGESTIONS`.
- If you WANT the entry to surface non-booking-flavored prompts, rebuild deliberately. The current `WELCOME_SUGGESTIONS` copy biases toward booking ("Schedule Services") and urgency ("Warning Light is On") — exactly the F2 anti-pattern.

### 3.3 F3 — dumping the decision tree

The prompt does carry diagnostic-traversal guidance in `stable.ts` (the "one splitter, not enumeration" pattern), but **no enforcement hook** in the dispatcher prevents Haiku from emitting an enumerated cause list. This is a prompt-discipline gap.

**Two ways to harden:**
- Add an explicit rule like the Brief's Artifact A: "Never present the user a list of possible causes and ask 'which applies?'. Before asking, check: does this question eliminate ~half the remaining causes? If it confirms one, reject it."
- Add behavioral eval cases that fail any turn whose assistant text contains `≥3` enumerated causes + a "which applies" question. The chat-behavioral harness supports `text_not_contains`; add `enumerated_causes_count > 2` as a derived check.

### 3.4 F4 — re-ask + architecture leak

**Two distinct bugs, both already partially addressed in code:**

**(a) The "wiper blades aren't in the catalog" architecture leak** — the prompt at `stable.ts` does say "never mention internal systems." If Oto says "catalog," "row," "pipeline," "service state," that's a prompt-discipline failure. Add behavioral eval `text_not_contains: ["catalog", "row", "pipeline", "service state"]` to the relevant cases.

**(b) The re-ask bug.** This is the one the Brief diagnosed as "established_facts isn't being re-injected." **The code disagrees:**

- WRITE site: Haiku must call `update_conversation_state` with the full `established_facts` array. The tool handler at `chat.ts:2680-2725` patches `ai_conversations.established_facts` AND mirrors to typed `conversation_facts` rows. Cap of 12 entries at line 2684.
- READ site: `chat.ts:688` reads `ai_conversations.established_facts` every turn:
  ```ts
  established_facts: ((conversation as any).established_facts ?? []) as string[],
  ```
- RENDER site: `envelope.ts:215-219` emits it into `<conversation_state>`:
  ```ts
  if (conversationState.established_facts.length > 0) {
    lines.push(`  established_facts:`);
    for (const fact of conversationState.established_facts) {
      lines.push(`    - ${fact}`);
    }
  }
  ```

**The re-injection is happening.** So why does Oto re-ask?

Three plausible upstream root causes, in order of likelihood:
1. **Haiku doesn't call `update_conversation_state` on the turn that surfaces the fact.** `stable.ts:142` says "There is no turn shape where you skip the state call." Not enforced at the dispatcher level — there's no "forced state call" path. Verify via `oto_telemetry.tools_called` for the offending conversations.
2. **Haiku writes a NEW `established_facts` array that drops the prior fact.** The tool semantics is whole-state-replacement (not delta). `stable.ts:136` explicitly says "Pass the FULL current state — not deltas. If something hasn't changed, repeat it." If Haiku drops the old fact while writing new ones, the array gets clobbered. Verify by diffing the `update_conversation_state` arg between adjacent turns in `conversation_audit`.
3. **The 12-entry cap silently truncates.** At `chat.ts:2684`, `.slice(0, 12)` drops the oldest. Prompt says 10 but the code is 12. If Haiku writes 13, you lose the first one with no telemetry signal. Verify against `oto_telemetry` if you see > 12 entries before a re-ask.

**Don't re-plumb yet.** Run the offending stress-test conversation against telemetry first. If `tools_called` shows `update_conversation_state` is missing on the relevant turn, fix the prompt rule. If it's being called but the arg array has dropped the fact, fix the prompt rule about "pass the FULL state." If it's being called with the full state but the read is wrong, then re-plumb.

---

## 4. The "User prefers BMW M specialist" overshoot — full trace

**The literal string does not appear in the codebase.** Grep returned zero hits.

The phrasing is **emergent**, not templated. Three forces combine:

**Force 1 — the vehicle envelope primes the trim.** `envelope.ts:145-168` (`formatDisplayString`) builds `"2020 BMW M550i xDrive"` for Waleed's vehicle and emits it into every prompt as:
```
<vehicle>
  display: 2020 BMW M550i xDrive
  id: <vehicle_id>
</vehicle>
```

**Force 2 — the volatile prompt's few-shots are M550i-flavored.** `volatile.ts` lines 90, 127, 149, 191-195, 215, 227 all use M550i as the example. So Haiku is heavily trained on this exact vehicle's idiom in every turn.

**Force 3 — `stable.ts:154-160` defines `mechanic_preference` with NO abstraction rule.** The bullet reads:
> `mechanic_preference` — repeated booking with one mechanic, anchors like *"books with Carlos"*

Followed at `stable.ts:154`: "Use third person referring to the user when writing `text`." But nothing about abstraction. So when the user says "I want someone who knows BMWs," Haiku reaches into the most-primed brand+trim string and writes `"User prefers BMW M specialist"`.

Then `tools.ts:507-508` reinforces specificity through its example:
> `"The fact, written in third person referring to the user. Concise, single sentence. Example: 'User prefers synthetic oil.' or 'User drives ~30k miles per year.'"`

Both examples are concrete and specific. Nothing in the example pattern teaches generalization.

**Schema constraint check:** `user_semantic_facts.payload` is `v.string()` (no shape constraint). The categorization `mechanic_preference` is the only structured anchor; the payload can disagree with it and the validator won't catch it.

**Fixes (cheapest first):**

1. **Add a sentence to `stable.ts:~156`** in the `mechanic_preference` bullet:
   > "Record at the broadest meaningful abstraction. Prefer 'brand specialist' over 'BMW specialist'; prefer 'dealer-experienced' over 'BMW M5 specialist'. The user's specific vehicle is already in `<vehicle>` — never bake it into the fact text. The fact should remain true even if the user trades the car in."
2. **Edit the example in `tools.ts:508`** to a general one: `"Example: 'User prefers a vehicle specialist (rather than a generalist).' or 'User wants the closest shop, not the cheapest.'"`.
3. **Optional: add normalization at `recordUserSemanticFact` ingest** (`memoryEditing.ts:473`) that strips known make/model/trim tokens from `mechanic_preference` and `service_preference` payloads. Risk: would also normalize legitimate cases ("the user definitely meant 'a BMW M shop' because they own one"). Lean toward prompt-side first; only add this layer if eval shows the prompt change doesn't hold.

---

## 5. How Oto infers data about the user/vehicle — the full data flow

Every Oto turn assembles its understanding of the user from **five distinct sources**:

**Source A — Clerk auth identity** (`chat.ts:497-507`). Resolves to a `users` row. Provides `_id`, name, email.

**Source B — Vehicle resolution.** The mobile client passes `vehicleVin` to `sendMessage` (from `selectedVehicleVin` in `AIGreeting`, the vehicle the user tapped). `chat.ts` resolves the VIN to `vehicles` + `vehicle_owners` rows. The `vehicle_owners` row carries the per-user vehicle context: `mileage`, `drivingConditions`, `avgMonthlyDriving`, `knownIssues[]` (sentinel-prefixed: `["check_engine"]`, `["other", "tpms"]`), `health_score`, `vehicle_mode`, `next_checkin_due`, plus onboarding bits.

**Source C — Conversation state on `ai_conversations`** (read at `chat.ts:685-802`). Carries:
- `mood`, `arc_summary`, `established_facts: array<string>`, `last_user_intent`, `state_updated_at` (Sprint 2 conversation state)
- `diagnostic_turn_count` (polite-exit counter)
- `current_model` (Sonnet cascade routing)

**Source D — Recent conversation history.** Last 10 turns from `ai_messages`. The render substrate; not the forensic substrate (`conversation_audit` is the forensic spine).

**Source E — Cross-conversation memory.** `getCrossConversationMemory` (`memoryEditing.ts:1356-1590`) pulls:
- Top-K=5 most-recent active facts from the user's OTHER conversations (excluding current — line 1466) from `conversation_facts`.
- Active `user_semantic_facts` for this user, decay-floored at 0.1.
- Merges, sorts by score DESC + recency DESC.

These five sources flow into `envelope.ts` which assembles the `<vehicle>`, `<vehicle_facts>`, `<conversation_state>`, `<recent_context>`, and `<polite_exit_required>` blocks for the system prompt.

**Tools Haiku can call to widen its understanding mid-turn:**
- `get_vehicle_facts` — Tier 1 structural moat (this user's car)
- `retrieve_vehicle_facts` — Tier 2 KB cascade (any car, with disclaim flag for unverified web-search facts)
- `lookup_vehicle_spec` — Tier 1 free-text catalog (cars the user does not own — for comparisons)
- `get_vehicle_health` / `get_projected_health_score` / `get_due_services` — maintenance state
- `get_bookings` / `get_pending_bookings` / `get_record_for_confirmation` — booking & service history
- `list_services_for_vehicle` — service catalog scoped to user's car
- `web_search` — Anthropic server-side (results are written back to `vehicle_facts` as `source: web_search`, `verification_status: unverified`)

**The user-preference write surface (THE only Oto memory write):**
- `record_semantic_fact` → `recordUserSemanticFact` → `user_semantic_facts` table. Categorized via `fact_type` enum (`mechanic_preference | service_preference | communication_style | vehicle_quirk | history_anchor`). Payload is free-text prose, written by Haiku.
- `update_conversation_state` → `ai_conversations.established_facts` array (legacy, 12-cap) AND mirrored to typed `conversation_facts` rows (append-only, write-only currently).

**Three preference systems exist; only one feeds Oto:**
1. `user_settings_preferences` (notifications, language, units) — `convex/preferences.ts`. Never enters Oto's prompt.
2. `user_mechanic_preferences` (booking-time mechanic favorites, FK to specific mechanic) — `convex/schema.ts:1189`. Never enters Oto's prompt.
3. `user_semantic_facts` (durable cross-conversation memory) — `convex/oto/memoryEditing.ts`. This is Oto's preference surface.

If you want Oto to know that a user has set "prefer text over images" in `user_settings_preferences`, you'd have to mirror that into the envelope explicitly — it's not wired today.

---

## 6. Fix map — priority-ordered, with file pointers

| # | Fix | Files | LoC change | Risk |
|---|---|---|---|---|
| 1 | Stop fabricating oil due date for unanchored vehicles | `convex/oto/vehicleHealth.ts:326-340` + `utils/maintenanceEnrichment.ts:149-164` + add `MaintenanceStatus.unknown` to `utils/maintenanceStatus.ts` + add prompt rule to `convex/oto/prompt/stable.ts` near line 934 | ~40 lines | Low (defaulting + prompt-side, no schema change) |
| 2 | Strip `last_service`/`urgency_label` for inferred items in `toAiShape` | `convex/oto/vehicleHealth.ts:374-386` | ~6 lines | Very low (defense in depth) |
| 3 | "BMW M specialist" overshoot fix — abstraction rule | `convex/oto/prompt/stable.ts` near line 156 + `convex/oto/tools.ts:508` | ~6 lines | Low |
| 4 | Delete dead-piped welcome tiles | `app/(main-tabs)/ai-chat/index.tsx:1200-1201` + `components/ai-chat/AIGreeting.tsx:54-55, 169-170` + maybe `services/ai/scenarios.ts:180-184` | ~10 lines | Very low |
| 5 | Diagnose re-ask: telemetry-first | Run a query against `oto_telemetry.tools_called` for the offending stress-test conversations + diff `update_conversation_state` args in `conversation_audit` across adjacent turns. NOT a prompt change yet. | None until diagnosed | None |
| 6 | If re-ask is "Haiku dropped fact in replacement," strengthen prompt rule | `convex/oto/prompt/stable.ts:136, 142, 146` | ~10 lines | Low |
| 7 | F3 — explicit "no enumerated cause list" rule + behavioral eval | `convex/oto/prompt/stable.ts` (find diagnostic-traversal section) + `scripts/oto-eval-cases.json` | ~20 lines + cases | Low |
| 8 | F4 architecture-leak audit — behavioral eval | `scripts/oto-eval-cases.json` with `text_not_contains: ["catalog", "row", "pipeline", "service state"]` | ~50 LoC of cases | Very low |
| 9 | (Later) Wave 5 cutover — read `conversation_facts` mirror into envelope for current conversation | `convex/oto/envelope.ts` + `convex/oto/chat.ts:685-802` | ~30 lines | Medium — semantic change, needs eval before/after |

**Acceptance bar for shipping any of the prompt fixes** is the Brief's Section 10: N=10 runs per eval case, ≥90% pass rate, 100% on the blocking cases (no fabrications, no make-leaks). The Wave 5.1 harness already implements Wilson 95% CI per query — wire the new cases through it.

---

## 7. Worth-knowing facts that didn't fit above

**The Anthropic call is currently locked to Haiku.** `chat.ts:68` sets `const MODEL = HAIKU_MODEL`. The Sonnet cascade routing fields exist (`ai_conversations.current_model`, reliability events `setCurrentModel_sonnet_handoff` / `setCurrentModel_haiku_handback`) but aren't active. If you flip Sonnet on for harder turns, expect different failure modes — re-run the eval baseline.

**The mobile client has a feature flag** `USE_OTO_AI_ACTION = true` at `app/(main-tabs)/ai-chat/index.tsx:103`. When false, falls back to a local rule-engine scenario-engine path (`services/ai/scenarioEngine.ts`) that is fully intact. Useful for offline testing and as a fallback if Oto goes down.

**The mock vehicles in `AIGreeting`** (Lexus ES + Ford Explorer) are *always* appended (line 177). These show up in the carousel for users with fewer than two real vehicles. Not a bug per se but worth knowing if you test on an empty user.

**`AISources` is currently hidden.** `AIMessageBubble.tsx:410-414` has the render commented out. If you want to surface source citations (the verification UX), uncomment + supply `message.sources` from the action.

**The Wave 5 mirror is one-way.** `conversation_facts` rows are written by `update_conversation_state` but never read back into the current conversation's envelope. The cross-conv READ at `memoryEditing.ts:1466` excludes the current conversation. If you want the typed mirror to participate in re-injection, that's a Wave 5 cutover (last row of the fix table).

**The eval harness has a `--live` mode** that runs against the actual deployment. Default `--repeats 10`. Falls back to `no_web_search: true` to avoid latency in measurement — this is why T3 web behavior isn't exercised in baseline eval. Add a separate `--web` flag if you want to measure web-search behavior under load.

**Telemetry is the verification gospel.** Per Locked Principle #12, cost-per-booking is unverifiable without `oto_telemetry`. Every prompt change should be paired with a check on the telemetry — input/output tokens, iterations_used, hit_cap, final_branch, tools_called. The cron-driven reliability ladder at `reliability.ts:284-408` will degrade Oto's behavior under sustained Anthropic failures; check `getCurrentDegradationState` if Oto seems off.

---

## 8. What I could not verify — open questions for the next session

1. **Live data audit of the AMG GT case.** The Convex MCP shows as connected in the registry but its tools aren't exposed to my session's deferred-tool registry — I couldn't read `ai_conversations`, `oto_telemetry`, or `vehicle_service_states` directly. Reconnect the Convex MCP or paste a deploy key, then verify:
   - Does `vehicle_service_states` have rows for the AMG GT? (If yes, `dueServices.ts` is a parallel F1 source.)
   - In the stress-test conversation that produced "oil due within 2 weeks," what did `oto_telemetry.tools_called` show? Was `update_conversation_state` called?
   - In the re-ask conversation, diff the `update_conversation_state` arg across adjacent turns from `conversation_audit`.
2. **Whether `WELCOME_SUGGESTIONS` was rendered in the version the stress test ran against.** Check the git log for `AIGreeting.tsx` around the date of the stress test. If a prior version rendered them, the fix to delete dead code stands; if not, the F2 observation came from a different surface.
3. **The Sonnet cascade.** Is it ever live? Are there conversations where `current_model` flipped to Sonnet? Behavior might differ.
4. **The Notion brief's exact deployment.** The brief mentions "Waleed's deployment" — `flippant-mink-750` per `.env.local`. Confirm this is the same one tested.

---

## 9. File-path index (absolute, for quick navigation)

**Convex — Oto core:**
- `C:\Users\manso\Desktop\otopair-1\convex\oto\chat.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\dispatcher.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\envelope.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\tools.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\prompt\stable.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\prompt\volatile.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\prompt\index.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\system_prompt.ts` *(legacy — verify in-use status)*

**Convex — Truth gate:**
- `C:\Users\manso\Desktop\otopair-1\convex\oto\vehicleFacts.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\vehicleFactsKB.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\vehicleFactsEditing.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\vehicleHealth.ts` ← F1 fallback table at line 327
- `C:\Users\manso\Desktop\otopair-1\convex\oto\lookupVehicleSpec.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\dueServices.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\canonicalize.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\searchedFacts.ts` *(deprecated stub)*
- `C:\Users\manso\Desktop\otopair-1\convex\oto\factReports.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\recordConfirmation.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\queryMoat.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\bookings.ts`
- `C:\Users\manso\Desktop\otopair-1\utils\maintenanceEnrichment.ts` ← F1 URGENT_DETAILS at lines 27-56

**Convex — Memory:**
- `C:\Users\manso\Desktop\otopair-1\convex\oto\memoryDecay.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\memoryEquivalence.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\memoryEditing.ts`

**Convex — Eval & observability:**
- `C:\Users\manso\Desktop\otopair-1\convex\oto\evalHarness.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\evalTestFilter.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\telemetry.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\reliability.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\promptChangelog.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\migrations\vehicleFactsReconciliation.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\migrations\verifiedFactsSeed.ts`
- `C:\Users\manso\Desktop\otopair-1\convex\oto\migrations\evalTenantsSeed.ts`

**Convex — Schema:**
- `C:\Users\manso\Desktop\otopair-1\convex\schema.ts`

**Eval scripts:**
- `C:\Users\manso\Desktop\otopair-1\scripts\eval\wave_5_1_harness.ts`
- `C:\Users\manso\Desktop\otopair-1\scripts\eval\runs\_run-eval-cases.ts`
- `C:\Users\manso\Desktop\otopair-1\scripts\eval\lib\metrics.ts`
- `C:\Users\manso\Desktop\otopair-1\scripts\eval\fixtures\wave_5_1_labeled_set.jsonl`
- `C:\Users\manso\Desktop\otopair-1\scripts\eval\fixtures\wave_2_4_cases.jsonl`
- `C:\Users\manso\Desktop\otopair-1\scripts\oto-eval-cases.json`
- `C:\Users\manso\Desktop\otopair-1\scripts\oto-harness.html`

**Mobile — chat UI:**
- `C:\Users\manso\Desktop\otopair-1\app\(main-tabs)\ai-chat\index.tsx`
- `C:\Users\manso\Desktop\otopair-1\app\(main-tabs)\ai-chat\_layout.tsx`
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\AIGreeting.tsx` ← F2 dead-piped suggestions
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\AIWelcomeScreen.tsx`
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\AIChatHistory.tsx`
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\AIMessageBubble.tsx`
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\AIInputBox.tsx`
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\AIQuickReplies.tsx`
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\PromptSuggestions.tsx`
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\AIContextBar.tsx`
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\AIReasoning.tsx`
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\AISources.tsx` *(currently hidden)*
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\AIRecordConfirmation.tsx`
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\OtoRenderTools.tsx`
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\BookServiceComponent.tsx`
- `C:\Users\manso\Desktop\otopair-1\components\ai-chat\AIFeedbackModal.tsx`

**Mobile — state:**
- `C:\Users\manso\Desktop\otopair-1\stores\useAIChatStore.ts`

**Scenario engine (legacy fallback path):**
- `C:\Users\manso\Desktop\otopair-1\services\ai\scenarioEngine.ts`
- `C:\Users\manso\Desktop\otopair-1\services\ai\scenarios.ts` ← F2 `WELCOME_SUGGESTIONS` at lines 180-184
- `C:\Users\manso\Desktop\otopair-1\services\ai\types.ts`

---

---

## 10. Live data findings (Waleed deployment, audited May 18, 2026)

The Convex MCP came online late in the session and I ran the live audit. Findings below override or sharpen earlier sections wherever they conflict.

### 10.1 Scale and shape of the deployment

| Table | Count | What this tells us |
|---|---|---|
| `ai_conversations` | **648** | High volume of session creation |
| `ai_messages` | **324** | Roughly 0.5 messages per conversation — most conversations are stubs |
| `conversation_audit` | **122** | The forensic spine is way under-written vs `ai_messages` — write-path gap |
| `oto_telemetry` | **90** | Even sparser than audit — telemetry is firing on a minority of turns |
| `conversation_facts` | **898** | Wave 3 mirror IS being written, ~7 facts per audited turn |
| `user_semantic_facts` | **24** | Small, but contains the smoking gun for the equivalence bug — see §10.4 |
| `vehicle_facts` | **55** | Tier 2 KB is populated but tiny |
| `vehicle_facts_audit` | **0** | Nobody has edited any verified fact yet |
| `fact_reports` | **0** | Nobody has reported a wrong fact |
| `reliability_events` | **0** | Either no incidents OR the wiring isn't actually firing — verify on next outage |
| `maintenance_records` | **4** | Across 5 vehicle_owners covering 114 vehicles |
| `vehicle_service_states` | **0** | **Confirms `dueServices.ts` is NOT a parallel F1 source — `vehicleHealth.ts` is the sole F1 path** |
| `vehicles` | 114 | |
| `vehicle_owners` | 5 | |

**Two structural takeaways:**

- The `648 / 324 / 122 / 90` cascade is a real write gap. Most conversations never get a real turn (likely created via greeting-screen vehicle-confirm or app session bootstrap and never used). Either the create-on-first-touch logic is too eager, OR conversations get created but the user closes the app before the first send. Either way, the forensic/telemetry under-write means we have less per-turn signal than the conversation count suggests.
- `vehicle_service_states = 0` is decisive — Ahmad's pipeline outputs nothing for this deployment. `getDueServices` always returns `[]`. So `vehicleHealth.ts` with its fallback table is the SOLE source of any "your car is due for X" assertion. The fix in §6 row 1 is sufficient; no parallel pipeline-side fix needed for this deployment.

### 10.2 F1 is reproducible TODAY — the AMG GT case from the brief literally exists in the data

Waleed's vehicle_owners table has 5 rows; only ONE has maintenance records.

| vehicleOwnerId | Vehicle | Records | F1 risk |
|---|---|---|---|
| `ph72nhtndj3b5sz5fct9fmtcq183gqaz` | 2020 BMW M550i (89k mi, knownIssues: `["other","temperature"]`) | 4 (oil/brakes/tires/battery) | None — has data |
| `ph70gz3evcjhef0f534w0gctqh83ma2f` | **2020 Mercedes-Benz AMG GT** | **0** | **F1 fires on every health check** |
| `ph757fkvnmh211exrmv697f2wd85gj6e` | 2020 BMW 5 Series | 0 | F1 fires |
| `ph76ykgfgz3rrn8h06s3xghvzn85h8a7` | 2022 BMW 4 Series | 0 | F1 fires |
| `ph73dqnz732krderfd2g1h2sjx85gdxc` | 2014 BMW 6 Series | 0 | F1 fires |

The Brief's "AMG GT with no service history that Oto told 'oil due within 2 weeks'" is `ph70gz3evcjhef0f534w0gctqh83ma2f`. Any `get_vehicle_health` call against it will return `{ id: "unknown-oil", status: "due_soon", last_service: "~5 months ago", urgency_label: "Service within 2 weeks", record_provenance: "inferred" }` — the path traced in §3.1.

**This is the regression test:** run `api.oto.vehicleHealth.getVehicleHealth({ vehicle_id: <AMG GT VIN> })` and assert that the `oil` item does NOT contain `last_service` or `urgency_label`. Wire it into `oto-eval-cases.json` as a blocking case.

**Cross-system effect:** four of five vehicles in this account hit F1. In the wider deployment, with `maintenance_records = 4` across 114 vehicles, F1 is the default behavior for **>96% of vehicles**. This isn't an edge case.

### 10.3 What Oto actually said in production — F4 architecture leak is severe in older versions

Sampled the 20 most recent `ai_messages`. Highlights:

**The worst leak I've seen so far** — conversation `n17awgqzzmq80cxskwaqxkeqss86hp7w`, user asks "Do you see the car ID?", Oto responds:

> "Yes, I do see your vehicle ID! 🔍 I have it registered as **pn76ns5s017bgf8hn71xe12nwx85n2tb** in the system, but unfortunately that ID alone doesn't give me access to the specific make, model, or trim details yet."

**Oto recited the raw Convex document `_id` to the user.** That's F4 in its purest form — internal database identifier surfaced as user-facing text. The user doesn't know what a Convex `_id` is, and the leak itself is the failure. Add an explicit prompt rule: "Never expose internal IDs (`_id`, vehicle_owner_id, conversation_id, anything starting with `pn7`/`k57`/`n17`). If asked about 'car ID' or 'vehicle ID', interpret as VIN or display name."

**Vehicle-pinning is not respected mid-conversation** — same conversation:
- User: "Hello, what is my car"
- Oto: "Hey Test! Your vehicle is a **2020 Volkswagen Jetta 1.4T R-Line**"
- User: "I selected a different car."
- Oto: "Got it! 👍 I see you've selected a different vehicle. However, I'm still showing your **2020 Volkswagen Jetta 1.4T R-Line** in my system."

Oto says "I see you've selected a different vehicle" and then renders the OLD one. The envelope captures the vehicle once and doesn't re-resolve per turn — or the mobile client isn't passing the updated `vehicleVin` arg. Verify at `app/(main-tabs)/ai-chat/index.tsx:415-430` (the `sendMessageAction({ vehicleVin })` call): is `selectedVehicleVin` updated when the user taps a different vehicle in the carousel mid-conversation? Today the greeting hides the carousel after first confirmation (`isCarConfirmed`), so the user probably literally cannot re-select. If true, this is a UX gap, not an envelope bug.

**Heavy emoji density in v0.8 / v0.9** — the early responses are loaded with 👋 🚗 🔍 👍 😊. Contradicts the "calm, expert concierge" persona. The v0.15-stable+v0.13-volatile responses are dramatically better:
> User: "I'd like to confirm my 2020 BMW M550i"
> Oto: "Got it — your 2020 BMW M550i xDrive is confirmed in the system. What do you need?"

So prompt evolution is already moving in the right direction. The newest version is on the right side of every behavioral concern in the Brief.

**Prompt version timeline in this deployment:** v0.8 → v0.9 → v0.10 → v0.11 → v0.13 → v0.15 (stable+volatile). Active is `v0.15-stable+v0.13-volatile`. Cross-version diff would tell us what's already been fixed — pull it from `promptChangelog.ts` for the next session.

### 10.4 Semantic-fact equivalence is broken in production — duplicate rows are accumulating

The `user_semantic_facts` table has 24 rows, all for the same user (Waleed: `md7fjepfczgwtpn0vpas2y3rrh83ggb3`). 22 of them are stress-test fixtures (`retracted_reason: "test_fixture_teardown"`); 2 are currently active. But the duplication pattern is striking:

| Pattern | Distinct rows | Should have been |
|---|---|---|
| "User prefers terse summaries with minimal preamble" / "User prefers terse, concise answers" / "User prefers terse, direct answers" / "User prefers terse one-liner responses" / "User prefers terse text-only answers" | **8+ rows** | 1 row, reinforced |
| "User only trusts BMW specialists, never general shops" / "User will only book BMW specialists for this vehicle, will not use general shops" / "User only books service at BMW specialists for their M550i; refuses general independent shops" | **5+ rows across `mechanic_preference` AND `service_preference`** | 1 row in the right category, reinforced |
| "User's M550i pulls slightly to the left when brakes are cold" / "User's 2020 BMW M550i xDrive pulls left when brakes are cold" / "User's 2020 BMW M550i xDrive pulls left slightly when brakes are cold; this is a known vehicle-specific quirk" | **3+ rows** | 1 row, reinforced |

The equivalence matcher in `memoryEquivalence.ts` (Jaccard ≥ 0.6 on fingerprinted tokens) should be catching all of these. **It isn't.** Two possibilities:

1. **`recordUserSemanticFact` isn't calling `findUserSemanticFactByPayload` before insertion.** The Wave 3 spec says the "helper layer decides reinforce vs insert" — if that branching happens upstream of the canonical helper, and chat.ts dispatches `record_semantic_fact` directly to the bare insert path, equivalence never gets consulted. Open `memoryEditing.ts:473-528` and `chat.ts` around the `record_semantic_fact` dispatcher to verify.
2. **The fingerprint algorithm is too aggressive on stopword removal.** "User prefers terse summaries" → "prefer terse summary" (3 tokens); "User prefers terse, concise answers" → "prefer terse concise answer" (4 tokens). Jaccard = 2/5 = 0.4 — below the 0.6 threshold. The Brief's intent — that paraphrases should reinforce — is fighting an algorithm that's penalizing them.

**Recommended fix:** lower the threshold to 0.4, OR (better) chain the matcher with a Haiku-tier semantic-similarity call when the lexical match is between 0.3 and 0.6. The Brief's Section 4 fix list should include "semantic fact dedup" as item #10 — it's a different bug from the "BMW M specialist" overshoot, and it compounds it (every restatement creates a new specific row, which then competes in the recent-context block).

Live data also confirms the **"BMW M specialist" overshoot pattern is real and emergent** — even the most recent active row reads `"User only trusts BMW specialists, never general shops."`. Slightly better than "BMW M specialist" (the M is gone), but still brand-specific. The fix in §6 row 3 is correct; no change.

### 10.5 The re-ask diagnosis — telemetry says hypothesis #1 is WRONG

`oto_telemetry.tools_called` shows `update_conversation_state` is called on essentially every meaningful turn (only the empty placeholder turns with `input_tokens=0` lack it). So the Brief's Section 8 suggestion that "Haiku skips the state call" is not supported in live data — at least not at the scale of "common cause."

What that leaves:
- **Hypothesis #2 (Haiku drops a fact in whole-state replacement)** — verifiable by diffing `conversation_audit` payloads across adjacent turns. Telemetry doesn't expose the args; need to query `conversation_audit.tool_calls` directly.
- **Hypothesis #3 (12-entry cap silently truncates)** — verifiable. Look at `ai_conversations` rows where `established_facts.length === 12`; check `conversation_facts` for that conversation; any fact in `conversation_facts` not in `established_facts` was dropped.

The conversation `n178znmxbj661dmzb77esamnw186x1b3` ("How is my car doing?" against the M550i) has `established_facts = ["Vehicle: 2020 BMW M550i xDrive", "User asking for overall car health assessment"]` after one turn — fine. To diagnose re-ask, we need a multi-turn diagnostic conversation where the fact-drop happened. The session_id `"trust-gate-final-2-1778784257223"` on conversation `n1792ncyyc2pfx76a3t51eyc0n86q3j8` suggests there's a structured eval run we could pull from `oto-eval-cases.json` and replay.

### 10.6 The Wave 3 mirror IS being written

15 most recent `conversation_facts` rows confirm: every fact flows through with typed payloads (`{ kind: "observation", text: "..." }`), `source_turn`, `written_by: "chat_agent"`. The mirror is hot. Still one-way (per §2.6 and §3.4), but the foundation is solid for the Wave 5 cutover (§6 row 9) when the team's ready.

### 10.7 Updated fix-map priority based on live data

The §6 fix map was correct but understated the urgency of items 1 and 3. Here's the updated priority:

| Rank | Fix | Why the live data shifted this |
|---|---|---|
| 1 | F1 — vehicleHealth oil fallback + URGENT_DETAILS inferred-guard + prompt rule | **96%+ of vehicles in the deployment trip this path.** Not an edge case. |
| 2 | F4 — never-expose-internal-IDs prompt rule | Oto literally recited a Convex `_id`. Single worst leak observed. Trivial prompt fix. |
| 3 | F4 — "BMW M specialist" abstraction rule + semantic-fact dedup | The two compound each other: poor abstraction creates over-specific facts; broken dedup makes 5 of them stick around. Fix both in one change. |
| 4 | Vehicle-pinning UX gap | Confirm via mobile client whether mid-conversation vehicle switch is even possible. If not, add UX affordance OR make the envelope re-resolve from a fresh `selectedVehicleVin` arg per turn. |
| 5 | F1 defense-in-depth — strip last_service/urgency_label for inferred | One-line fix at `vehicleHealth.ts:381`, locks the bug from regressing. |
| 6 | Diagnose re-ask via `conversation_audit.tool_calls` diff | Telemetry already rules out the simplest cause. Don't re-plumb. |
| 7 | Delete dead-piped welcome tiles OR repurpose deliberately | F2 is currently not active; lowest urgency. |
| 8 | Behavioral eval cases for everything above | Bind the fixes to N=10 Wilson-CI pass-rate evals before declaring done. |
| 9 | (Investigate) 648/324/122/90 write gap | Likely benign (empty session creation) but worth understanding before relying on conversation count for any product metric. |
| 10 | (Investigate) Why `reliability_events = 0` | Either the system has never degraded OR the wiring isn't firing. Verify on next planned Anthropic outage / chaos test. |

---

*End of handoff. The fix map in §6 + §10.7 is the action list. Sections 3 and 4 are the code-side verifications. Sections 1–2 are the orientation. Section 10 is the live-data confirmation: F1 reproduces today against the AMG GT (`ph70gz3evcjhef0f534w0gctqh83ma2f`), F4 includes a Convex `_id` leak, and semantic-fact dedup is broken in production. Start with §10.7 row 1.*
