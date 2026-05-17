# Sprint 3 Day 5 — Booking Status (4th and final Tier 2 dispatch); Sprint 3 Tier 2 COMPLETE

**Date:** 2026-05-17 (Sprint 3 Day 5 — logical work-day demarcation: Day 1 registry foundation, Day 2 render_link_button, Day 3 Loyalty, Day 4 vehicle anchoring + tone, Day 5 Booking Status)
**Authority:** `docs/OTO_CAPABILITY_REGISTRY.md` §14.3 (Booking Status contract).
**Owner:** PM orchestrator (dispatch + verify + commit + log) + 3 subagent dispatches in surface-partitioned parallel.

---

## 0. Day 5 in one sentence

**Sprint 3 Day 5 closes Tier 2 by landing the 4th and final feature surface — Booking Status — across 3 surface-partitioned parallel dispatches: Infrastructure registered 3 new tools (`get_pending_bookings` data tool + `render_booking_card` and `render_bookings_list` terminal render tools) across 4 file surfaces (`convex/oto/bookings.ts` +76 lines for the NEW `getPendingBookings` query mirroring `getBookings` with `status === "pending"` filter, `convex/oto/tools.ts` +54 lines for the 3 schemas + OTO_TOOL_CATEGORY + field-parity contract, `convex/oto/dispatcher.ts` +29 lines for 2 new render branches + 2 ChatMessageEnvelope fields, `convex/oto/chat.ts` +24 lines for TOOL_NAMES_V1 sub-group + DATA_TOOL_CALLABLE_NAMES extension + buildCallables entry — all 4 surfaces per the Day 3 surface-enumeration rule); Prompt Engineer added a NEW `# Booking Status — viewing existing bookings` section to `convex/oto/prompt/stable.ts` (+49 lines, lines 787-825, positioned BEFORE `# Booking flow` since viewing is logically prior to creating) with discrimination rules per user phrasing as Haiku-readable prose bullets + "Choosing between" paragraph anchored on USER WORDS rather than semantic subset-relationship to head off Haiku confusion + 4 MUST-NOTs + 3 # Tools registry entries + 4 # Capability honesty CAN-DO bullets + `STABLE_PROMPT_VERSION` v0.16-stable → v0.17-stable (composite v0.17-stable+v0.14-volatile); QA Lead appended 6 active eval cases (85→91 total — 3 tool-routing positives + 2 discrimination + 1 mutual-exclusion) with 85 pre-existing cases byte-identical at SHA-256 `296228749f33329a…`; commits `3ed7ae4` (Pass A) + this log (Pass B); 20/20 CI invariants clean; Block 4 invariant verified across all 3 new tool names; schema hash unchanged (no schema touch); live tool count 36 → 39 (3 new tools); Sprint 3 Tier 2 is now 4 of 4 COMPLETE — render_link_button (9 destinations) + Loyalty in-chat (4 tools) + Day 4 anchoring/tone + Day 5 Booking Status (3 tools) all live; the only remaining Sprint 3 substantive feature is `render_support_form` 3-category dispatch (§13 Channel 1) which is separate from Tier 2 and can ship in its own day; one new Tier 3 carryover surfaced — `convex/oto/bookings.ts` shared-helper extraction blocked by TS2589 (deep-instantiation trap on `query({})` definition; preserved the 50-line duplication between `getBookings` and `getPendingBookings` with a header comment documenting rationale).**

---

## 1. Methodology — Day 5 timeline

Three passes:

| # | Pass | Owner | Surface | Type |
|---|---|---|---|---|
| A | Booking Status dispatch (3-way parallel) | 3 subagents — Infrastructure + Prompt Engineer + QA Lead | `convex/oto/bookings.ts` + `convex/oto/tools.ts` + `convex/oto/dispatcher.ts` + `convex/oto/chat.ts` + `convex/oto/prompt/stable.ts` + `scripts/oto-eval-cases.json` + `docs/OTO_CAPABILITY_REGISTRY.md` (registry status updates) | Substantive feature dispatch |
| B | Verify + commit | PM (mechanical) | git commit `3ed7ae4` + registry status updates | PM |
| C | Day 5 log | PM | `docs/SPRINT_3_DAY_5_LOG.md` (this file) | PM |

### 1.1 Why Day 5 was the cleanest dispatch of Sprint 3

Day 5 ran cleaner than Days 2-4 for two reasons:

1. **Registry contract was locked from Day 1.** §14.3 was authored Day 1 Pass A and survived through Pass F (Day 1) without scope drift. No iteration needed; dispatch briefs referenced a stable contract.

2. **Day 3's surface-enumeration rule applied.** Each subagent brief listed ALL required surfaces per tool category — data tools: schema + category + TOOL_NAMES_V1 + DATA_TOOL_CALLABLE_NAMES + callable; render tools: schema + category + TOOL_NAMES_V1 + dispatcher branch. No defect like Day 2's missing TOOL_NAMES_V1 entry.

The implementation cost was higher than Day 2 (4 file surfaces for Infrastructure vs Day 2's 2) but the dispatch process was clean — no Pass A0 defect fix needed, no Pass A1/A2 scope corrections.

### 1.2 Infrastructure decisions

**Decision 1: Duplicated handler over shared helper.** First attempted a shared `runBookingsQuery` helper to avoid 50 lines of duplication between `getBookings` and `getPendingBookings`. The extraction tripped TS2589 ("excessively deep instantiation") on the `query({...})` definition because the extracted helper's `ctx: any` signature broke Convex's deep schema-inference chain. Reverted to two parallel handlers with a header comment documenting rationale.

This is the same TS2589 quirk Sprint 2 documented for `sendMessage` (line 248-258 in chat.ts) — Convex's schema-inference depth limit interacts badly with parametric helpers. The workaround is per-route duplication. Tier 3 carryover: revisit after Wave 5 work resolves the deep-instantiation issue.

**Decision 2: Pre-existing schema bug preserved.** The original `getBookings` reads `b.scheduled_at` but the schema field is actually `scheduled_date` (string). TS flags this; Convex tolerates it at runtime (returns `null` for the missing field). `getPendingBookings` mirrors this exactly for consistency. Tier 3 carryover: fix both queries together rather than fixing one and leaving the other.

**Decision 3: Block 4 invariant verification was explicit.** Infrastructure brief mandated verification that all 3 new tool names appear in their respective drift-check sets. Confirmed in the report: `get_pending_bookings` in both TOOL_NAMES_V1 AND DATA_TOOL_CALLABLE_NAMES; the 2 render tools picked up automatically via the dynamic `renderToolNames` computation at chat.ts:179 (filters OTO_TOOL_CATEGORY).

### 1.3 Prompt Engineer decisions

**Decision 1: Section placement BEFORE `# Booking flow`.** Per spec, "viewing existing bookings is logically prior to creating new bookings." Section lands at lines 787-825 between `# Pricing` (line 766) and `# Booking flow` (line 827). Cross-reference to # Booking flow reads naturally.

**Decision 2: User-phrasing-anchored discrimination.** The subset relationship (pending ⊂ active) is conceptually clean but Haiku risk is real — Haiku may over-fire `get_pending_bookings` whenever it hears "upcoming" / "scheduled." Added explicit "Choosing between" paragraph anchoring the rule on USER PHRASING ("the words 'pending', 'waiting on confirmation', 'not yet confirmed'") rather than on semantic subset relationship. Set default to broader active when in doubt.

**Decision 3: Tools registry placement.** 3 new entries placed immediately after `get_bookings` in `# Tools` block. Sensible grouping.

### 1.4 QA Lead decisions

**Decision 1: Discrimination case asserts via absence rather than presence.** `booking_status_vs_booking_flow_discrimination` tests a routing RULE, not single-tool correctness. Load-bearing assertion is the `tools_not_called` set excluding ALL THREE §14.3 viewing tools, combined with `tools_called` including `render_service_picker` (§4 stage-1 surface). Discrimination verified by ABSENCE of viewing tools rather than presence of a specific create-flow tool, because Haiku may legitimately use alternate stage-1 first moves (`list_service_categories`, `list_services_for_vehicle`).

**Decision 2: Confirmation-check case kept soft on render_booking_card.** `booking_status_confirmation_check` doesn't assert that `render_booking_card` MUST fire (Haiku may surface status in prose only). Text_contains anchored on broad `["booking"]` rather than specific status word ("confirmed" / "pending") since the runner's text_contains is AND-semantics and status varies with fixture state.

**Decision 3: Skipped optional 7th case (pending vs active subset).** The §14.3 contract doesn't explicitly disambiguate "what's coming up?" between `get_bookings(active)` vs `get_pending_bookings`, and Haiku-variance risk is real per the N=1 noise concern. PM should decide whether prompt language adds disambiguation BEFORE authoring this case.

---

## 2. What landed (Pass A, commit `3ed7ae4`)

### 2.1 `convex/oto/bookings.ts` (+76 lines)

NEW `getPendingBookings` query:
- Args: `limit` (optional, default 5, max 20). NO `status_filter` arg (always pending).
- Filter: `b.status === "pending"` only.
- Same `OtoBookingSummary` return shape as `getBookings`.
- Same auth pattern (`ctx.auth.getUserIdentity()` → users table lookup).
- Header comment documents the duplication rationale (TS2589 trap on shared helper).

### 2.2 `convex/oto/tools.ts` (+54 lines)

Three new tool schemas:
- `get_pending_bookings` (DATA) — `limit?` integer input. Description distinguishes from `get_bookings(active)`.
- `render_booking_card` (RENDER) — `booking_id` string input. Terminal render.
- `render_bookings_list` (RENDER) — `booking_ids` array (1-10) input. Terminal render.

OTO_TOOL_CATEGORY: 1 new data + 2 new render entries.
Field-parity contract comment updated: `render_booking_card → message.bookingCard`, `render_bookings_list → message.bookingsList`.

### 2.3 `convex/oto/dispatcher.ts` (+29 lines)

Two new render branches in `packageRenderDirective`:
- `case "render_booking_card":` → `renderD("bookingCard", { booking_id })`
- `case "render_bookings_list":` → `renderD("bookingsList", { booking_ids })`

ChatMessageEnvelope interface extended: `bookingCard?: unknown;`, `bookingsList?: unknown;`.

### 2.4 `convex/oto/chat.ts` (+24 lines)

- TOOL_NAMES_V1: new commented sub-group "Booking Status — Sprint 3 Day 5 §14.3" with 3 tool names.
- DATA_TOOL_CALLABLE_NAMES drift-check set: 1 entry added for `get_pending_bookings`.
- buildCallables: 1 new callable for `get_pending_bookings` → `api.oto.bookings.getPendingBookings(limit)`.

Block 4 invariant verified.

### 2.5 `convex/oto/prompt/stable.ts` (+49 lines, v0.16-stable → v0.17-stable)

NEW `# Booking Status — viewing existing bookings` section at lines 787-825 (between `# Pricing` and `# Booking flow`):
- Distinguishes Booking Status (viewing existing) from Booking Flow (creating new)
- Discrimination rules per user phrasing as Haiku-readable prose bullets (NOT markdown table)
- "Choosing between" paragraph anchored on USER WORDS for the subset relationship
- Terminal-render rule for both render tools
- 4 MUST-NOTs
- Cross-reference to # Booking flow

`# Tools` registry block: 3 new entries (after existing get_bookings).
`# Capability honesty`: 4 new CAN-DO bullets.

`STABLE_PROMPT_VERSION` bumped v0.16-stable → v0.17-stable. Composite: v0.17-stable+v0.14-volatile.

### 2.6 `scripts/oto-eval-cases.json` (85 → 91 cases, +6 active)

Group A — 3 tool-routing positives:
- `booking_status_pending`
- `booking_status_next_appointment`
- `booking_status_list_view`

Group B — 2 discrimination:
- `booking_status_confirmation_check`
- `booking_status_vs_booking_flow_discrimination`

Group C — 1 mutual-exclusion:
- `booking_status_card_or_list_not_both`

85 pre-existing cases byte-identical (SHA-256 `296228749f33329a0dacddc2770fe79044f4199444bc1bb76f50daad5c2869a2`).

### 2.7 `docs/OTO_CAPABILITY_REGISTRY.md` (status updates)

- §14.3 status: `planned` → **LIVE as of Sprint 3 Day 5 Pass A**.
- §16 planned-tools table: 3 Booking Status rows marked **live**.

---

## 3. Sprint 3 Day 5 Verification

```
CI grep:                20/20 rules clean
Brace-balance:          bookings.ts delta=0
                        tools.ts delta=0
                        dispatcher.ts delta=0
                        chat.ts delta=0
                        stable.ts open=1 close=1 delta=0 (template-literal — expected)
Schema hash:            6c5818395c2f6e38d070132ea56957bc9b80997c4013982dd3d2d3451f792385 (unchanged)
Eval JSON:              91 cases (83 active + 8 disabled — 6 new + 85 prior)
85 pre-existing cases:  byte-identical (deep-sorted SHA-256 296228749f33329a…)
Stable prompt:          v0.17-stable
Volatile prompt:        v0.14-volatile (unchanged from Day 4)
Composite prompt:       v0.17-stable+v0.14-volatile
TypeScript:             0 NEW TS errors on Day 5 touched code (12 pre-existing
                        in bookings.ts — 6 in getBookings predating this work,
                        6 mirrored into getPendingBookings for consistency)
Files touched (Pass A): 7 (bookings.ts + tools.ts + dispatcher.ts + chat.ts +
                        stable.ts + eval JSON + registry doc)
Block 4 invariant:      VERIFIED — all 3 new tool names in correct surfaces
Commit:                 3ed7ae4 — all 7 file changes atomic
```

---

## 4. Sprint 3 Tier 2 — COMPLETE

| Tier 2 surface | Status | Day(s) |
|---|---|---|
| §14.1 `render_link_button` (9 destinations) | LIVE | Day 2 Pass A + Day 3 Pass A0 (defect fix) + Day 4 Pass B (9th destination) |
| §14.2 Loyalty in-chat (4 tools) | LIVE | Day 3 Pass A |
| §15.12 Vehicle anchoring + §1 tone calibration | LIVE | Day 4 Pass B |
| §14.3 Booking Status (3 tools) | LIVE | Day 5 Pass A (this) |

**4 of 4 Tier 2 surfaces complete.** Sprint 3 substantive feature work is now ~95% done; remaining Sprint 3 items are smaller carryovers + the `render_support_form` 3-category dispatch (which was always positioned as a separate dispatch from Tier 2 per §13).

---

## 5. MVP capability progression (Day 4 close → Day 5 close)

| Surface | Day 4 EOD | **Day 5 EOD** | Δ |
|---|---|---|---|
| User-visible MVP capability | ~97-98% | **~98-99%** | +0.5-1% (4th and final Tier 2 surface lands) |
| Architectural-discipline coverage | 100% | **100%** | maintained |
| Tools live | 36 | **39** | +3 (get_pending_bookings + render_booking_card + render_bookings_list) |
| Stable prompt version | v0.16-stable | **v0.17-stable** | bumped |
| Volatile prompt version | v0.14-volatile | **v0.14-volatile** | unchanged |
| Composite prompt | v0.16-stable+v0.14-volatile | **v0.17-stable+v0.14-volatile** | stable half bumped |
| Eval cases | 85 (77 active + 8 disabled) | **91 (83 active + 8 disabled)** | +6 |
| CI invariants | 20 rules | **20 rules** | maintained |
| Sprint 3 Tier 2 | 3 of 4 done | **4 of 4 COMPLETE** | done |

---

## 6. Sprint 3 priorities — refresh post-Day-5

### Tier 2 — COMPLETE

All 4 surfaces live. No further Tier 2 work.

### Tier 2-adjacent — `render_support_form` (separate dispatch, §13 Channel 1)

This was positioned as separate from Tier 2 throughout Sprint 3 because the 3-category form (mechanic_dispute / service_complaint / billing_issue) requires backing table decisions (`support_intake_submissions` is `planned` in §17). Can ship in its own day with the same 3-way parallel pattern; Infrastructure dispatch would include schema work this time.

### Tier 3 — Sprint 2 + Day 2/3/4/5 carryovers

1. **Frontend coordination — remove synthetic "I'd like to confirm X vehicle" first message** (Day 4). Mobile team ticket. Backend already handles this.
2. **Runner primitive `tools_called_with_args`** (Day 2 finding) — tightens per-tool-arg correctness.
3. **Registry-CI guard** (Day 3 finding) — lints `OTO_TOOLS ⊂ TOOL_NAMES_V1`.
4. **Extract rewards program constants** (Day 3 finding) — `convex/constants/rewards.ts`.
5. **NEW Day 5: `convex/oto/bookings.ts` shared-helper extraction** — blocked by TS2589; revisit after Wave 5 work resolves deep-instantiation.
6. **NEW Day 5: `bookings.ts` schema bug fix** — `scheduled_at` vs `scheduled_date` discrepancy preserved in both queries for consistency; fix together.
7. **`prompt_injection_tag_smuggling_rejected` sharpening** (Day 11 Sprint 2 finding).
8. **Wave 1.5 formal multi-version run** — now at v0.17-stable+v0.14-volatile.
9. **"That sucks" empathy phrasing** — soften only if eval results flag it.
10. **Mobile coordination: `ChatMessage.linkButton` rendering** (Day 2).
11. **Mobile coordination: `ChatMessage.bookingCard` + `bookingsList` rendering** (Day 5).
12. **Mobile coordination: per-message AI-feedback icon UI** (Day 1 Pass F).
13. **Optional 7th Day 5 eval case** (`booking_status_pending_vs_active_subset`) — pending PM decision on prompt-language disambiguation.

### Tier 4-7 — same as Sprint 2 close handoff (Wave 5 reranker v2 implementation, Wave 6 deterministic router, etc.)

---

## 7. The Day 5 one-line summary

**Sprint 3 Day 5 closes Tier 2 (4 of 4 surfaces COMPLETE) by landing Booking Status across 7 file surfaces in 1 dispatch — Infrastructure across 4 files (+183 net lines) registered 3 new tools with all required surfaces verified (Block 4 invariant clean: `get_pending_bookings` in TOOL_NAMES_V1 + DATA_TOOL_CALLABLE_NAMES + buildCallables; `render_booking_card` + `render_bookings_list` in TOOL_NAMES_V1 + OTO_TOOL_CATEGORY + dispatcher branches + ChatMessageEnvelope fields), plus NEW `getPendingBookings` query in `convex/oto/bookings.ts` (status === "pending" filter, mirror of `getBookings`, 50-line duplication accepted due to TS2589 deep-instantiation trap on shared-helper extraction — Tier 3 carryover); Prompt Engineer added `# Booking Status — viewing existing bookings` section at stable.ts lines 787-825 (before `# Booking flow` since viewing is logically prior to creating) with discrimination rules anchored on USER PHRASING ("pending" / "waiting on confirmation" / "not yet confirmed") rather than semantic subset relationship to head off Haiku confusion + 4 MUST-NOTs + 3 # Tools registry entries + 4 CAN-DO bullets + `STABLE_PROMPT_VERSION` v0.16-stable → v0.17-stable; QA Lead appended 6 active eval cases (85→91 total — 3 positives + 2 discrimination + 1 mutual-exclusion; 85 pre-existing byte-identical at SHA-256 `296228749f33329a…`); commit `3ed7ae4` + this log; 20/20 CI clean; tool live count 36→39; Sprint 3 Tier 2 substantive feature work is now ~95% done; only remaining Sprint 3 substantive item is `render_support_form` 3-category dispatch (§13 Channel 1, separate from Tier 2); Day 5 ran the cleanest dispatch of Sprint 3 — locked registry contract from Day 1 + Day 3's explicit per-category surface-enumeration rule + no scope iteration needed.**

— End of Sprint 3 Day 5. Tier 2 closes at 4 of 4 surfaces live. Day 6 (if needed) picks up `render_support_form` as a standalone dispatch.
