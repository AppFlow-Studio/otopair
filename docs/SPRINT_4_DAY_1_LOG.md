# Sprint 4 Day 1 — booking-flow consolidation (`render_book_service`); prompt cleanup; runner instrumentation

**Date:** 2026-05-17 (Sprint 4 Day 1 — first work-day after the Sprint 3 close + waleed-dev-oto-merge bucketed merge)
**Authority:** Waleed's 4 asks (synthetic-first-message removal, diagnostic-ask phrasing, 6-stage booking → 1 component, multi-service bundling preserved).
**Owner:** PM orchestrator + frontend (Waleed/mobile team) + 3 subagent dispatches.

---

## 0. Day 1 in one sentence

**Sprint 4 Day 1 lands `render_book_service` as a single consolidating tool replacing the 6-step booking render chain (`render_service_picker` / `render_diagnostic_form` / `render_quick_replies` / `render_shop_carousel` / `render_time_selector` / `render_booking_confirmation` + the `navigate_to_payment` redirect that followed); the new tool accepts `service_slugs: string[]` (multi-service bundling native), `diagnostic_system`, `customer_notes`, `recommended_priority`, `recommended_mechanic_id`, `vehicle_id`; mobile-team owns the new `BookServiceComponent` (ticket landed at `docs/SPRINT_4_FRONTEND_BOOK_SERVICE_TICKET.md` §1–§9) while Waleed has already completed 12 of the frontend tasks (new component scaffold + 3 legacy components deleted + envelope-field type cleanup); backend coordination across 8 Passes (A scope-lock → B implementation → C smoke + diagnose → D 3-subagent root-cause team → E prompt-contradiction scrub → F deny-list scrub → G chat.ts envelope-field scrub → H runner-instrumentation for visibility on failed turns); composite prompt advanced `v0.18-stable+v0.14-volatile` → `v0.21-stable+v0.16-volatile`; eval cases 97 → 103 (6 new book_service cases + 8 existing cases migrated); live tool count 40 → 35 (–6 deprecated +1 added); ONE case currently passes the new contract (`book_service_deprecated_tools_not_fired`), the other 4 fail with a mix of assertion-too-narrow signals (text_contains "book" / "diagnostic" missing — but Haiku may be using register-equivalent "schedule" / "set up") and possibly-real behavioral signals (multi-service text missing the service names); the Pass H runner patch now persists Haiku's actual output text + fired-tool list on every FAILED turn, unblocking the diagnostic — next session reads the actual text to decide between prompt-sharpening (Pass I) vs eval-softening (Pass I-alt).**

---

## 1. Methodology — Day 1 timeline

Eight passes across one long work-day:

| # | Pass | Owner | Surface | Type |
|---|---|---|---|---|
| A | Scope-lock + frontend ticket | PM | docs/SPRINT_4_FRONTEND_BOOK_SERVICE_TICKET.md + registry §1/§3/§4/§16 | Scope |
| B | Backend implementation (3-way parallel) | 3 subagents — Infrastructure + Prompt + QA | tools.ts + dispatcher.ts + chat.ts + stable.ts + volatile.ts + oto-eval-cases.json + registry doc | Substantive feature dispatch |
| C | REPEAT=3 smoke + initial diagnose | PM | scripts/eval/runs/_run-eval-cases-result.json | Verification |
| D | 3-subagent root-cause team | 3 subagents — Prompt Engineer + Context + QA | prompt contradiction inventory across stable.ts + volatile.ts | Diagnostic |
| E | Prompt-contradiction scrub | PM (mechanical) | stable.ts + volatile.ts (8 sites scrubbed) | Cleanup |
| F | Deny-list scrub | PM (mechanical) | stable.ts (remove deprecated tool names from prompt deny-list) | Cleanup |
| G | chat.ts envelope-field scrub | PM (mechanical) | chat.ts (validator + SendMessageResult + pull-through + return-spread) | Cleanup |
| H | Runner instrumentation | PM | scripts/eval/runs/_run-eval-cases.ts (+15 lines) | Tooling |

### 1.1 Why Day 1 needed 8 passes (vs Sprint 3's 1-3 per day)

Two reasons stack:
1. **Consolidation > addition**: every prior substantive dispatch (render_link_button, Loyalty, vehicle anchoring, Booking Status, render_support_form) was additive — register the new tool, no rewrite of existing surfaces. Pass B's `render_book_service` is the first dispatch that DEPRECATES 6 existing tools simultaneously while adding 1 new one. That ratio guarantees cascade contradictions (Pass D's finding: 8 stable.ts/volatile.ts sites positively-reinforced phrasings that the new contract bans).
2. **Smoke caught real failures, not just style drift**: Pass C's 0/5 stable failures looked like assertion-too-narrow at first glance, but Pass D's 3-subagent dispatch (Prompt Engineer + Context Engineering + QA Lead) found load-bearing structural issues (deprecated tool names still listed in prompt with positive examples, exemplars still using "I'll pull that up", etc). Without the team diagnosis Waleed would have shipped a contradictory prompt.

### 1.2 The reliability asymmetry (Pass D key finding)

Hard-filter constraints (TOOL_NAMES_V1 allowlist at chat.ts:151) held 100% — no deprecated tool fired runtime because they were filtered at the dispatcher level. Soft-text rules (phrasing constraints in prompt) held only partially because Pass B's prompt-engineer dispatch added the new contract but didn't rewrite away from the old phrasings still embedded in 8 separate sites (one rule + four positive exemplars + three deny-list mentions + one section heading still using "I'll pull that up" register).

The fix pattern (Pass E): every site that still positively-reinforced a banned phrasing got rewritten with the booking register Waleed asked for ("Want to book that now?" / "Set up the booking flow" / "Got it. Want to book that now?").

The no-system-narration rule (which has its own ## heading + 4 exemplars + 3 MUST-NOTs in stable.ts) is the structural template that the new booking-action rule needs to grow into. Pass I (next session) may need to give the booking-action rule its own ## heading rather than burying it as one paragraph inside the §4 Booking section.

### 1.3 The 12 frontend tasks Waleed completed in parallel

While the 8 backend passes ran, Waleed (mobile-team-of-one) implemented the frontend side:
- New `components/ai-chat/BookServiceComponent.tsx` (sub-stages 1–6)
- Updated `app/(main-tabs)/ai-chat/index.tsx` to detect `ChatMessage.bookService` and route to the new component
- Removed 3 legacy components (AIBookingCarousel, AIDiagnosticForm, AIServicePicker)
- Cleaned up `services/ai/types.ts` `ChatMessage` type (removed 6 deprecated envelope fields)
- Updated `components/ai-chat/index.ts` exports
- Removed the synthetic "I'd like to confirm my X car" first-message injection (one of Waleed's 4 asks, frontend-only)

This parallel execution shipped the frontend + backend in one work-day — possible only because Pass A locked the contract first so the two sides could move independently.

---

## 2. Pass B implementation surfaces (3-way parallel dispatch)

### 2.1 Infrastructure
- `convex/oto/tools.ts`: 6 deprecated tool schemas removed (-258 lines), `render_book_service` added with 6-field schema (+ field-parity comment + OTO_TOOL_CATEGORY entry); net 1378 → 1120 lines (-258 net).
- `convex/oto/dispatcher.ts`: 5 deprecated render branches removed; 1 `render_book_service` branch added; `ChatMessageEnvelope.bookService` field added; deprecated envelope fields removed; net 460 → 418 lines (-42).
- `convex/oto/chat.ts`: TOOL_NAMES_V1 reduced by 6 deprecated names + 1 added; Block 4 module-load invariant clean (renderToolNames lookup); polite-exit counter reset condition migrated from `showDiagnosticForm` to `bookService`; `trace.book_service` replaces `trace.show_diagnostic_form`.

### 2.2 Prompt
- `convex/oto/prompt/stable.ts`: §4 Booking section rewritten to describe the new single-tool prefill flow; booking-action rule added ("Want to book that now?" register); composite version `v0.18` → `v0.19-stable` after Pass B; subsequent scrubs advanced it to `v0.21-stable`.
- `convex/oto/prompt/volatile.ts`: example 12 (booking exemplar) rewritten; composite version `v0.14-volatile` → `v0.15-volatile` after Pass B; Pass E added 5 more scrubs → `v0.16-volatile`.

### 2.3 QA
- `scripts/oto-eval-cases.json`: 6 new cases (`book_service_single_diagnostic`, `book_service_single_routine`, `book_service_multi_bundle`, `book_service_diagnostic_phrasing_correct`, `book_service_polite_exit_not_sure`, `book_service_deprecated_tools_not_fired`); 8 existing cases migrated to expect `render_book_service` instead of the deprecated tools; case count 97 → 103.

---

## 3. Pass D root-cause findings (8 contradictions diagnosed)

Pass C's REPEAT=3 smoke showed 0/5 stable, but the failure reasons were mostly "text_contains missing: 'book'" — ambiguous between assertion-too-narrow and real behavioral. Pass D's 3-subagent team found 8 prompt contradictions where the new contract was rule-stated but the exemplars + deny-list still reinforced the banned phrasings:

| # | File | Site | Old | New (Pass E) |
|---|---|---|---|---|
| 1 | stable.ts L60 | one-liner exemplar | "Want me to pull that up?" | "Want me to dig in?" |
| 2 | stable.ts L455 | onboarding redirect | "I can pull up the onboarding screen" | "I can open the onboarding screen" |
| 3 | stable.ts L895 | booking action exemplar | "Pull up the booking flow" | "Set up the booking flow" |
| 4 | stable.ts L1052 | redirect-second exemplar | "I can pull up the onboarding screen" | "I can open the onboarding screen" |
| 5 | stable.ts L860 | deny-list bullet | enumerated 6 deprecated tool names | bullet removed (Pass F) |
| 6 | volatile.ts L74 | dispute exemplar | "let me pull up a dispute form" | "let me set up a dispute form" |
| 7 | volatile.ts L157 | booking commentary | "pulling up the booking flow" | "setting up the booking now" |
| 8 | volatile.ts L251 | warmth-on-routine exemplar | "let me run the specs and pull up the booking flow" | "Got it. Want to book that now?" |

After Pass E + F + G the contradictions were resolved. Pass C's REPEAT=3 re-run STILL showed 0/5 stable, but the failure reasons shifted from "stale phrasing" to purely "text_contains missing" + "tools_called missing" — i.e. the remaining failures are now either assertion-too-narrow or genuine register issues, not contradiction artifacts. Pass H's runner instrumentation is what unblocks the next decision.

---

## 4. Pass C/G smoke results (current state)

REPEAT=3 on the 5 active book_service cases (the 6th case `book_service_polite_exit_not_sure` is disabled — multi-turn narrowing fixture):

| Case | PASS | Failure pattern |
|---|---|---|
| `book_service_single_diagnostic` | 0/3 | `text_contains missing: "book"` (all 3); one hit on `text_not_contains: "pull that up"` (resolved by Pass E) |
| `book_service_single_routine` | 1/3 | one attempt missed `render_book_service` tool fire (real behavior); one missed `text_contains: "oil"` |
| `book_service_multi_bundle` | 0/3 | all 3 missed `text_contains: "oil"` AND `text_contains: "tire"` |
| `book_service_diagnostic_phrasing_correct` | 0/3 | all 3 missed both `"book"` AND `"diagnostic"`; one hit `text_not_contains: "pull up a diagnostic"` (resolved by Pass E) |
| `book_service_deprecated_tools_not_fired` | 3/3 PASS | (Pass G hard-filter holding 100%) |

**Diagnosis hypotheses (next-session priorities):**
- **Assertion-too-narrow (likely cases 1, 4):** Haiku may use "schedule"/"set up"/"reserve" in the booking-action register. Pass H's runner patch persists `result.text` on FAILED turns — read it before Pass I.
- **Real behavioral failure (likely cases 2, 3):** Haiku may not be firing `render_book_service` for routine asks; multi-service text may be too generic. If Pass H text confirms this, Pass I sharpens the §4 Booking section with explicit multi-slot exemplars.
- **Mixed:** likely the real answer. Pass H text-read distinguishes per-case.

---

## 5. Pass H runner instrumentation

`scripts/eval/runs/_run-eval-cases.ts` (+15 lines) — failed turn results now persist:
- `text: result.text` (Haiku's complete assistant message for that turn)
- `toolsFired: collectFiredTools(result)` (deduped union of names across all `iterations[].{data,state,terminal}_tool_uses[]`)

Passing turns omit `text` to keep the result JSON scannable. The helper `collectFiredTools(result: SendResult): string[]` aggregates `collectToolNames(iter)` across all iterations and returns a sorted-unique list.

Commit: `46ff197`.

---

## 6. Sprint 4 Day 1 deliverable summary

**Backend:** 4 commits (`709a445` Pass B + `86f0185` Pass E + `8d87666` Pass F + `33dd3ec` Pass G + `46ff197` Pass H — 5 actually) — `render_book_service` live; 6 deprecated tools removed; composite prompt `v0.21-stable+v0.16-volatile`; eval count 103; live tool count 35.

**Frontend (Waleed):** 12 tasks done in parallel — BookServiceComponent landed, 3 legacy components deleted, ChatMessage type cleanup, synthetic-first-message injection removed.

**Sprint 4 Day 1 verification status:** smoke not yet green. 1/5 stable on the new cases. The 4 failing cases are pending Pass H text-read to decide between Pass I (prompt sharpening — booking-action register heading) vs Pass I-alt (eval softening — `text_contains_any` OR-union primitive for the booking register family `{book, schedule, set up, reserve}`).

---

## 7. Carryovers to Day 2

1. **Pass I diagnosis** — read Pass H persisted `text` for the 4 failing cases; decide prompt-sharpen vs eval-soften route. Requires fresh JWT.
2. **Mobile-team coordination** — Waleed has the frontend done; needs to verify the new `BookServiceComponent` against an end-to-end happy-path manually (Convex deploy + Haiku + new component render); not a backend concern but worth a check-in.
3. **Registry §4 update** — once Pass I lands, update `docs/OTO_CAPABILITY_REGISTRY.md` §16 status taxonomy: 6 deprecated tools → "retired" entries; `render_book_service` from "planned" → "live (verified)".
4. **Eval-runner Tier 3 primitive** — `text_contains_any` (OR-union semantic) is the cleanest fix for assertion-too-narrow on register-equivalent phrasings. If Pass I-alt is the chosen route, this primitive lands first.
5. **Composite prompt schema-hash** — if §4 gets restructured (Pass I), the Wave 1.9 schema-hash baseline at `scripts/ci/schema-hash.expected` will need a Pass-J update.

---

## 8. Methodology lessons (Day 1)

1. **Consolidation needs cascade-scrub.** Every dispatch that deprecates N existing tools needs an explicit cleanup pass for prompt + chat.ts envelope-fields + dispatcher branches. Pass B's brief should have enumerated "scrub all positive exemplars referencing the deprecated register" as a deliverable. Treat this as a Sprint 4 dispatch-brief rule update.
2. **0/5 smoke isn't always real behavior.** When a new contract lands and REPEAT=3 shows 0 stable, the FIRST diagnostic is "prompt-contradiction scrub" not "the model can't do it" — load-bearing.
3. **Runner persistence is load-bearing for diagnosis.** Pass H's tiny patch (15 lines) is the difference between "I think it's assertion-too-narrow" and "here's the actual text — decide." This belongs as standard runner instrumentation, not a Day-1 carryover. (It's now committed permanently.)
4. **Parallel frontend + backend works when scope-lock is real.** Pass A's frontend ticket (168 lines) gave Waleed enough to implement against the locked envelope without waiting for Pass B's commit. The 6 deprecated render branches in the mobile chat-message detection logic became safe to remove after Pass B's commit (`709a445`).
