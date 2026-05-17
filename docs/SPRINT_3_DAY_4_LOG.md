# Sprint 3 Day 4 — vehicle_onboarding (9th destination) + one-chat-one-car anchoring + tone calibration

**Date:** 2026-05-17 (Sprint 3 Day 4 — logical work-day demarcation: Day 1 registry foundation, Day 2 render_link_button, Day 3 Loyalty in-chat + Day-2 defect fix, Day 4 vehicle anchoring + tone)
**Authority:** `docs/OTO_CAPABILITY_REGISTRY.md` Pass A2 (commit `9d420ad`) — final contract after Waleed's Q1-Q4 sign-off iterations.
**Owner:** PM orchestrator (3 registry-iteration passes A/A1/A2 + dispatch + verify + commit + log) + 3 subagent dispatches in surface-partitioned parallel.

---

## 0. Day 4 in one sentence

**Sprint 3 Day 4 lands four new asks Waleed surfaced before implementation — (1) AI-tone made more emotional with context-appropriate empathy/enthusiasm/warmth (NOT cheery when car broken), (2) vehicle picker at chat-start replacing the synthetic "I'd like to confirm X vehicle" first message via pure frontend coordination with the existing `vehicleVin` arg (no schema change, no new mutation, no token cost on selection), (3) strict no-pivot for sibling owned vehicles with polite new-chat redirect (informational AND booking — Pass A2 simplification of Pass A1's softer rule), and (4) `vehicle_onboarding` as 9th destination on `render_link_button` for explicit-only triggers — all codified across 3 registry-iteration passes (Pass A → Pass A1 sign-off → Pass A2 simplification) then implemented in a single 3-way parallel Pass B dispatch where Infrastructure added the 9th destination to `convex/oto/tools.ts` (+2 lines, 8→9 enum + per-destination guidance with explicit-only trigger + implicit-ownership negative-trigger set), Prompt Engineer rewrote stable.ts (+30 lines, `v0.15-stable` → `v0.16-stable`) adding `vehicle_onboarding` to the redirect section + a NEW `# Vehicle anchoring — one chat, one car` section at lines 1045-1071 with canonical new-chat redirect pattern + 2 natural-tone alternatives + channel-discrimination prose bullets + illustrative MUST-NOTs (no primary-anchor switch, no sibling-vehicle data access in-chat, no auto-fire on implicit ownership), AND rewrote volatile.ts (+56 lines, `v0.13-volatile` → `v0.14-volatile`) adding a NEW `# Tone calibration — warmth, empathy, enthusiasm` section at line 217 with 4 calibration buckets (Light enthusiasm / Genuine empathy / Curiosity / Warmth) + forbidden-padding list + 3 new worked Examples (15-17: M5-vs-M550i enthusiasm, engine-tick empathy, routine-rotation warmth), QA Lead appended 7 active eval cases (78→85 total — 2 vehicle_onboarding + 2 sibling-redirect + 1 educational-AI discrimination + 2 tone) with 78 pre-existing byte-identical at SHA-256 `64336d56…`; commits `5975bc9` (Pass A draft) + `b43badf` (Pass A1 correction) + `9d420ad` (Pass A2 simplification) + `5bac7ac` (Pass B implementation) + this log; 20/20 CI invariants clean throughout; no schema touch (Pass A2 dropped the proposed `ai_conversations.vehicle_id` migration); composite prompt now `v0.16-stable+v0.14-volatile`; live tool count unchanged at 36 (vehicle_onboarding is a new destination on existing `render_link_button`, not a new tool); Sprint 3 Tier 2 progress 3 of 4 done (render_link_button 9-destination + Loyalty in-chat + Day-4 anchoring/tone); remaining Tier 2: Booking Status (§14.3) + `render_support_form` 3-category dispatch (§13 Channel 1).**

---

## 1. Methodology — Day 4 timeline

Six passes (3 registry iterations + 1 implementation dispatch + 1 verify+commit + 1 log):

| # | Pass | Owner | Surface | Type |
|---|---|---|---|---|
| A | Registry update for 4 new asks (draft) | PM (mechanical) | `docs/OTO_CAPABILITY_REGISTRY.md` §1 + §2 + §12 + §14.1 + §15.12 (new) + §17 + §18 | Draft scope-lock |
| A1 | Registry correction per Waleed Q1-Q4 sign-off | PM (mechanical) | registry §15.12 reframed + §12 dropped schema change + §14.1 explicit-only + §17 schema removed | Correction (post-sign-off) |
| A2 | Registry simplification — strict no-pivot restored | PM (mechanical) | registry §2 + §12 + §15.12 + §18 | Correction (Waleed final call) |
| B | Implementation dispatch (3-way parallel) | 3 subagents — Infrastructure + Prompt Engineer + QA Lead | tools.ts + stable.ts + volatile.ts + eval JSON + registry status | Substantive feature dispatch |
| Verify | CI grep + brace + composite version + schema hash | PM (mechanical) | git commits | PM |
| C | Day 4 log | PM | `docs/SPRINT_3_DAY_4_LOG.md` (this file) | PM |

### 1.1 Pass A → A1 → A2 — three registry iterations capturing Waleed's intent

**Pass A** drafted the registry update broadly across 4 asks. Two overreaches landed in the draft:

- Schema change proposed (`ai_conversations.vehicle_id`) + new `setConversationVehicle` mutation — PM assumption that vehicle anchoring needed persistence.
- No-pivot rule strict (new-chat redirect for ALL sibling questions) — PM assumption that mid-chat sibling engagement was confusing.

**Pass A1** corrected on Waleed's Q1-Q4 sign-off feedback:

- Q1: Soft sibling engagement (in-chat for informational; new-chat redirect for booking only). PM accepted as "less strict but still anchored."
- Q4 / sub-question: Schema change DROPPED. Waleed clarified the desired flow: car-picker is purely frontend state, no server call until first real message; existing `vehicleVin` arg already does the job. Token savings preserved (changing the selection costs nothing).

**Pass A2** simplified back per Waleed's "let's just ask user to open a new chat instead, lets not mess up what we got" follow-up:

- Soft sibling engagement REVERTED. Single rule: ANY question about sibling owned vehicle → new-chat redirect. Booking-on-sibling becomes a special case of the general rule (not separately handled).
- Educational AI for non-owned vehicles preserved (was always preserved; called out explicitly to prevent confusion).
- Simpler model, less state risk, cleaner UX. The Q1 "B" soft answer was preserved across A1; A2 reverted to "A" strict per Waleed's follow-up clarification.

**Lesson on iteration:** Three registry passes in one day might look like overhead, but each pass narrowed scope toward what Waleed actually wanted. Without the iterations, Pass A's draft would have shipped a schema migration that wasn't needed and a soft-sibling-engagement rule that Waleed reverted on. The §19 governance pattern (corrections land as new passes; audit trail preserved) handled this cleanly — no rewriting of history, just forward corrections.

### 1.2 Pass B — 3-way parallel dispatch against Pass A2 contract

Same surface-partitioned pattern as Days 2 + 3:

| Subagent | Owns (writes) | Reads but forbidden to write |
|---|---|---|
| Infrastructure | `convex/oto/tools.ts` (small — 2-line enum + description update) | dispatcher.ts, chat.ts, prompt/, scripts/ |
| Prompt Engineer | `convex/oto/prompt/stable.ts` + `convex/oto/prompt/volatile.ts` | tools.ts, dispatcher.ts, chat.ts, scripts/ |
| QA Lead | `scripts/oto-eval-cases.json` | tools.ts, dispatcher.ts, chat.ts, prompt/ |

Contract was registry Pass A2. No cross-talk needed.

### 1.3 Subagent dispatch reports — under 500 words each (per dispatch contract)

**Infrastructure (under 200 words):**
- tools.ts 1091 → 1093 (+2)
- 9-value enum ✓
- 20/20 CI clean; brace-balance delta=0; 0 TS errors
- Decision flag: implicit-ownership clarifying-ask phrasing kept descriptive in the tool description (e.g. *"I don't see that vehicle in your garage yet — do you want to add it, or were you asking about a different car?"*). PM accepted; Prompt Engineer's parallel work in volatile.ts may want to mirror or refine.

**Prompt Engineer (under 500 words):**
- stable.ts 1054 → 1084 (+30 lines); `v0.15-stable` → `v0.16-stable`
- volatile.ts 180 → 236 (+56 lines); `v0.13-volatile` → `v0.14-volatile`
- Composite: `v0.16-stable+v0.14-volatile`
- New `# Vehicle anchoring — one chat, one car` section at stable.ts lines 1045-1071 (between `# Response format` and `# Vehicle context` — clean placement among other vehicle-related sections).
- New `# Tone calibration` section at volatile.ts line 217 (after Examples block — Wave 2.x interaction-language territory).
- 3 new Examples added to volatile.ts (15-17): enthusiasm-on-M5, empathy-on-engine-tick, warmth-on-routine-rotation.
- No synthetic-first-message handling found in stable.ts — none existed; the frontend-side injection lives in mobile-app code, not in the prompt. Confirmed via grep.
- Belt-and-suspenders MUST NOT addition to App-navigation section explicitly banning implicit-ownership auto-fire (mirroring the Vehicle-anchoring section). Rule lives in BOTH places since Haiku may pattern-match on either entry point.
- Decision flags raised for PM review:
  1. Canonical redirect phrasing (1 canonical + 2 natural-tone equivalents) — PM accepted.
  2. Implicit-ownership clarifying-ask two-beat structure — PM accepted.
  3. Empathy register: *"That sucks"* flagged as possibly clashing with calm-restrained voice rule. Registry §1 explicitly allows "this sucks and I want to help" register — preserved as-is.
  4. Enthusiasm: *"Oh, the M550i…"* opening kept as variance anchor alongside tighter *"Nice — …"* alternatives.
  5. Forbidden padding list — kept current; can grow as eval logs surface more patterns.

**QA Lead (under 400 words):**
- 7 active cases appended (skipped optional 8th `voice_warmth_baseline_not_robotic` — too vague to assert tone reliably for routine questions; flagged for PM review).
- Total 78 → 85 cases (77 active + 8 disabled).
- 78 pre-existing cases byte-identical (deep-sorted SHA-256 `64336d56321a959f071791454ad6754338f36ad0f6480dac8933a89334bd026e`).
- JSON valid; 20/20 CI clean.
- Tone-case judgment calls flagged: negative ban-lists are load-bearing; positive keyword lists kept soft for Haiku phrasing variance. Specific tone-case bans documented (e.g. `voice_empathy_when_car_broken_no_cheer` bans `"that's exciting"`, `"I'm so sorry to hear"`, `"Great!"`, `"Wonderful!"`, `"Oh, fun"`, `"Awesome!"`, `"Fantastic"`).
- Helper script `scripts/eval/runs/_append-day4-vehicle-anchoring.js` created (matches the existing helper convention from Day 3 Pass A).

### 1.4 Multi-pass registry iteration vs single-pass dispatch — when to use which

Sprint 3 has now demonstrated TWO complementary dispatch patterns:

- **Single-pass implementation dispatch** (Day 2, Day 3 Pass A, Day 4 Pass B): when registry contract is locked, dispatch 3-way parallel against it.
- **Multi-pass registry iteration** (Day 1 across 6 passes A-F, Day 4 across 3 passes A-A2): when stakeholder scope is iterating, lock contract through multiple registry-doc-only passes BEFORE dispatching implementation.

The two patterns coexist cleanly because §19 governance treats the registry as the audit trail. Implementation dispatches reference the latest registry commit by hash; future-reader can see the iteration history without it polluting the implementation commits.

---

## 2. What landed (Passes A through B)

### 2.1 Pass A (commit `5975bc9`) — initial registry draft for 4 asks

Already detailed in Section 1.1. Net: §1 tone-emotion calibration + §2 no-pivot + onboarding-trigger + §12 vehicle-on-conversation (with schema change proposed) + §14.1 8→9 destinations + §15.12 new cross-cutting rule + §17 schema flag + §18 eval coverage.

### 2.2 Pass A1 (commit `b43badf`) — correction per Waleed Q1-Q4

Soft sibling-engagement (Q1 "B"), explicit-only onboarding (Q2 "B"), volatile-only tone (Q3 recommended), single Pass B dispatch (Q4 recommended). Schema change DROPPED — frontend-state-only flow per Waleed's sub-question.

### 2.3 Pass A2 (commit `9d420ad`) — strict no-pivot restored

Pass A1's soft sibling-engagement reverted to strict per Waleed's follow-up. Booking-on-sibling becomes a special case of the general rule. Educational AI for non-owned vehicles explicitly preserved.

### 2.4 Pass B (commit `5bac7ac`) — implementation

#### `convex/oto/tools.ts` (+2 lines)

- `render_link_button` destination enum 8 → 9 values
- 9th value: `vehicle_onboarding`
- Description updated with explicit-only trigger set + implicit-ownership negative-trigger set + clarifying-ask phrasing

#### `convex/oto/prompt/stable.ts` (+30 lines, `v0.15-stable` → `v0.16-stable`)

- `# App-navigation redirects` section: 8 → 9 destinations with vehicle_onboarding bullet
- NEW `# Vehicle anchoring — one chat, one car` section at lines 1045-1071
- 2 cross-references updated (Loyalty enum count + App-nav MUST NOT list)

#### `convex/oto/prompt/volatile.ts` (+56 lines, `v0.13-volatile` → `v0.14-volatile`)

- NEW `# Tone calibration — warmth, empathy, enthusiasm` section at line 217
- 4 calibration buckets (Light enthusiasm / Genuine empathy / Curiosity / Warmth)
- Forbidden padding list
- 3 new Examples (15: M5-vs-M550i enthusiasm; 16: engine-tick empathy; 17: routine-rotation warmth)

#### `scripts/oto-eval-cases.json` (78 → 85 cases, +7 active)

Group A (vehicle_onboarding):
- `link_button_vehicle_onboarding_explicit`
- `link_button_vehicle_onboarding_implicit_clarifies`

Group B (sibling-owned redirect):
- `vehicle_sibling_owned_redirects_to_new_chat`
- `vehicle_sibling_booking_redirects_to_new_chat`

Group C (discrimination):
- `vehicle_general_knowledge_still_ok_when_not_owned`

Group D (tone):
- `voice_empathy_when_car_broken_no_cheer`
- `voice_enthusiasm_on_fun_car_question`

#### `docs/OTO_CAPABILITY_REGISTRY.md` (Pass B status update)

- §14.1: 8 destinations LIVE → 9 destinations LIVE

---

## 3. Sprint 3 Day 4 Verification

```
CI grep:                20/20 rules clean throughout (Passes A, A1, A2, B)
Brace-balance:          tools.ts delta=0
                        stable.ts open=1 close=1 delta=0 (template-literal — expected)
                        volatile.ts open=0 close=0 delta=0 (template-literal — expected)
Schema hash:            6c5818395c2f6e38d070132ea56957bc9b80997c4013982dd3d2d3451f792385 (unchanged)
                        Pass A2 dropped the schema migration; no Wave 1.9 update needed
Eval JSON:              85 cases (77 active + 8 disabled — 7 new + 78 prior)
78 pre-existing cases:  byte-identical (deep-sorted SHA-256 64336d56…)
Stable prompt:          v0.16-stable
Volatile prompt:        v0.14-volatile
Composite prompt:       v0.16-stable+v0.14-volatile
TypeScript:             0 errors on Day 4 touched code
Files touched (Pass B): 5 (tools.ts + stable.ts + volatile.ts + eval JSON + registry doc)
Commits (Day 4):        5975bc9 (Pass A) + b43badf (Pass A1) + 9d420ad (Pass A2) + 5bac7ac (Pass B)
                        plus this log (Pass C)
```

---

## 4. MVP capability progression (Day 3 close → Day 4 close)

| Surface | Day 3 EOD | **Day 4 EOD** | Δ |
|---|---|---|---|
| User-visible MVP capability | ~96-97% | **~97-98%** | +0.5-1% (3rd Tier 2 surface lands; vehicle anchoring constraint + tone calibration land) |
| Architectural-discipline coverage | 100% | **100%** | maintained |
| Tools live | 36 | **36** | unchanged (vehicle_onboarding is a destination on existing render_link_button, not a new tool; total render_link_button enum values 8 → 9) |
| Stable prompt version | v0.15-stable | **v0.16-stable** | bumped |
| Volatile prompt version | v0.13-volatile | **v0.14-volatile** | bumped (first volatile bump since Sprint 2; Wave 2.x tone-calibration work lands here) |
| Composite prompt | v0.15-stable+v0.13-volatile | **v0.16-stable+v0.14-volatile** | both halves bumped |
| Eval cases | 78 (70 active + 8 disabled) | **85 (77 active + 8 disabled)** | +7 |
| CI invariants | 20 rules | **20 rules** | maintained |
| Vehicle anchoring constraint | implicit (not codified) | **explicit (one chat one car)** | net-new constraint |
| Tone calibration | NEGATIVE-only (don't theater, don't pad) | **NEGATIVE + POSITIVE (warmth/empathy/enthusiasm)** | net-new positive register guidance |

---

## 5. Sprint 3 priorities — refresh post-Day-4

### Tier 2 — remaining feature surfaces

1. **Booking Status surface** (§14.3) — `get_pending_bookings` + `render_booking_card` + `render_bookings_list` + prompt section. ~half-day. Same 3-way parallel pattern. **Next dispatch.**
2. **`render_support_form` 3-category dispatch** (§13 Channel 1) — completes the three-channel Support architecture. ~half-day.

### Tier 3 — Sprint 2 + Day 2/3/4 carryovers

3. **Frontend coordination — remove synthetic "I'd like to confirm X vehicle" first message** (Day 4). Mobile team ticket. Backend already handles this — prompt has no synthetic-message handling. Mobile-side change.
4. **Runner primitive `tools_called_with_args`** (Day 2 finding) — tightens per-tool-arg correctness.
5. **Registry-CI guard** (Day 3 finding) — lints `OTO_TOOLS ⊂ TOOL_NAMES_V1`.
6. **Extract rewards program constants** (Day 3 finding) — `convex/constants/rewards.ts`.
7. **`prompt_injection_tag_smuggling_rejected` sharpening** (Day 11 Sprint 2 finding).
8. **Wave 1.5 formal multi-version run** — now at v0.16-stable+v0.14-volatile; multi-version run across v0.9 → v0.16 stable / v0.7 → v0.14 volatile would surface any regression.
9. **Soften "That sucks" empathy phrasing if eval results flag it** (Day 4 Prompt Engineer concern). Preserve registry §1 register allowance; only soften if observed problematic.
10. **Mobile coordination: `ChatMessage.linkButton` rendering** (Day 2) — flagged for mobile team.
11. **Mobile coordination: per-message AI-feedback icon UI** (Day 1 Pass F) — flagged for mobile team.

### Tier 4-7 — same as Sprint 2 close handoff

---

## 6. The Day 4 one-line summary

**Sprint 3 Day 4 closes 4 new asks Waleed surfaced before implementation — tone-emotion calibration with context-appropriate register, vehicle picker at chat-start replacing synthetic first-message via pure frontend coordination (no schema change needed — existing `vehicleVin` arg suffices), strict no-pivot for sibling-owned vehicles with new-chat redirect (informational AND booking), and `vehicle_onboarding` as 9th destination on `render_link_button` with explicit-only triggers — across 3 PM-mechanical registry-iteration passes (Pass A draft → Pass A1 correction per Q1-Q4 sign-off → Pass A2 simplification per Waleed's "lets not mess up what we got") then 1 implementation dispatch (Pass B 3-way parallel: Infrastructure +2 lines to tools.ts for 9th enum value with explicit-only guidance, Prompt Engineer +30 lines to stable.ts at `v0.16-stable` adding NEW `# Vehicle anchoring — one chat, one car` section at lines 1045-1071 with canonical redirect pattern + channel-discrimination prose + 3 MUST-NOTs AND +56 lines to volatile.ts at `v0.14-volatile` adding NEW `# Tone calibration` section at line 217 with 4 register buckets + forbidden padding list + 3 new worked Examples (15-17), QA Lead +7 cases to 78→85 total with byte-identity preserved at SHA-256 `64336d56…`); commits `5975bc9` + `b43badf` + `9d420ad` + `5bac7ac` + this log; 20/20 CI clean throughout; schema hash unchanged (Pass A2 dropped the proposed `ai_conversations.vehicle_id` migration in favor of the existing `vehicleVin` arg); composite prompt now `v0.16-stable+v0.14-volatile`; live tool count unchanged at 36 (vehicle_onboarding adds a destination, not a tool); Sprint 3 Tier 2 progress 3 of 4 done — render_link_button (9 destinations) + Loyalty in-chat + Day 4 anchoring/tone all live; remaining Tier 2: Booking Status (§14.3) + `render_support_form` 3-category dispatch (§13 Channel 1); two methodology validations this day — (a) multi-pass registry iteration (A→A1→A2) catches stakeholder scope drift before implementation costs are incurred, and (b) single-pass 3-way parallel implementation dispatch works for cross-cutting work (tone calibration + vehicle anchoring touched 3 prompt sections across 2 files plus an enum addition plus 7 eval cases — all clean in one round); Day 5 picks up Booking Status with the same 3-way parallel pattern.**

— End of Sprint 3 Day 4. Vehicle anchoring + tone calibration land. The multi-pass-registry-iteration-then-implementation-dispatch pattern proves itself for stakeholder-iterating scope.
