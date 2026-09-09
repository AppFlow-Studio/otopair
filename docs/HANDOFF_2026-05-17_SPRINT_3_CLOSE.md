# Sprint 2 → Sprint 3 → Sprint 3-close handoff — v3 AI architecture at ~99% MVP
**Date:** 2026-05-17 (Sprint 3 Day 6 EOD)
**From:** Claude Code (Sprint 3 run; 6 days of work Day 1 → Day 6 inclusive, 20 commits)
**To:** Next Claude Code (further Tier 3 carryovers, mobile coordination, OR Sprint 4 scoping)
**Status:** Sprint 3 substantive feature work COMPLETE. All 4 Tier 2 surfaces + §13 Channel 1 form + §15.12 vehicle anchoring + §1 tone calibration are LIVE. Remaining Sprint 3 scope is Tier 3 carryovers only — none of them are new feature surfaces.

---

## 0. The 8 things you must know before anything else

1. **You are the PM orchestrator** for an 11-subagent team (defined in `.claude/agents/`). Dispatch substantive work via `subagent_type: "general-purpose"` and have each agent `Read` its own role file at `.claude/agents/<role>.md` first. The custom-agent slugs are NOT registered in this Claude Code harness.

2. **The Capability Registry (`docs/OTO_CAPABILITY_REGISTRY.md`) IS the contract.** Sprint 3 Day 1 authored it across 6 iteration passes (A-F). Every feature dispatch references it. Every prompt edit + tool addition + eval case maps to a domain entry. §19 governance covers when/how to update.

3. **Surface-partitioned 3-way parallel dispatching is the proven pattern.** 6 days of Sprint 3 ran Infrastructure + Prompt Engineer + QA Lead in parallel against the registry contract with zero cross-talk. The discipline: each brief explicitly names cross-surface restrictions + the registry section that's the contract.

4. **Per-tool-category surface enumeration is MANDATORY in dispatch briefs.** This is the Day 2 → Day 3 Pass A0 lesson. Render tools need: schema + category + TOOL_NAMES_V1 + dispatcher branch (NO callable). Data tools need: schema + category + TOOL_NAMES_V1 + DATA_TOOL_CALLABLE_NAMES + buildCallables. State tools need: schema + category + TOOL_NAMES_V1 + STATE_TOOL_CALLABLE_NAMES + callable. Missing ANY required surface → Block 4 invariant at chat.ts:198-216 logs CONFIG ERROR at Convex module load.

5. **Multi-pass registry iteration handles stakeholder scope drift.** Sprint 3 Day 1 ran 6 passes (A-F) iterating with Waleed. Day 4 ran 3 passes (A-A2) again on new asks. The §19 governance pattern (corrections land as new passes; audit trail preserved) eliminates the need to rewrite history.

6. **20 CI invariants stay green throughout.** Run `bash scripts/ci/vehicle-facts-grep.sh` after EVERY substantive change. All 20 rules must pass. Sprint 2 added rules 12-20; Sprint 3 added nothing new to the 20 (no schema migrations) but maintained all 20 clean across 20 commits.

7. **No schema migrations across Sprint 3.** Wave 1.9 Rule 20 (schema hash drift guard) protected the substrate; all feature work fit existing tables. The proposed `ai_conversations.vehicle_id` migration in Day 4 Pass A was DROPPED in Pass A1 (the existing `vehicleVin` arg already does the job). The `support_intake_submissions` table for `render_support_form` submissions is mobile-team scope (the Submit button is a frontend action).

8. **Two distinct auth surfaces (unchanged).** Convex deploy key (`Authorization: Convex <key>`) for internal queries + mutations + npx commands. User JWT (`Authorization: Bearer <token>`) for chat:sendMessage + public mutations + queries. ~1-hour JWT life.

---

## 1. Sprint 3 commit timeline (final)

```
Day 6:  13beada  Sprint 3 Day 6 log + substantive-work closure
        7d15d46  Sprint 3 Day 6 Pass A: render_support_form 3-category form (§13 Channel 1)

Day 5:  9f39a1d  Sprint 3 Day 5 log + Tier 2 closure
        3ed7ae4  Sprint 3 Day 5 Pass A: Booking Status (4th and final Tier 2 dispatch)

Day 4:  1deae1d  Sprint 3 Day 4 log
        5bac7ac  Sprint 3 Day 4 Pass B: vehicle_onboarding (9th destination) + one-chat-one-car anchoring + tone calibration
        9d420ad  Sprint 3 Day 4 Pass A2: simplify back to strict no-pivot for owned siblings
        b43badf  Sprint 3 Day 4 Pass A1: registry correction per Waleed Q1-Q4 sign-off
        5975bc9  Sprint 3 Day 4 Pass A: registry update — 4 new asks

Day 3:  bb7d689  Sprint 3 Day 3 log
        f65f42e  Sprint 3 Day 3 Pass A: Loyalty in-chat surface
        a0248d7  Sprint 3 Day 3 Pass A0: fix Day 2 defect — render_link_button → TOOL_NAMES_V1

Day 2:  7871660  Sprint 3 Day 2 log
        591c7f4  Sprint 3 Day 2 Pass A: render_link_button (8 destinations)

Day 1:  619f76e  Sprint 3 Day 1 Pass F: drop redemption claim + AI-feedback UI button
        74e5893  Sprint 3 Day 1 Pass E: §14.1 enum expansion to 8 destinations
        2313c78  Sprint 3 Day 1 Pass D: §14 re-correction — Loyalty in-chat, not redirect
        9c417ef  Sprint 3 Day 1 Pass C: §14 scope correction post-Waleed review
        caac4fe  Sprint 3 Day 1 log
        56a59ab  Sprint 3 Day 1 Pass A: capability registry foundation
```

**Sprint 3 net contribution:** 6 days, 20 commits, ~1,500 lines of code added across `convex/oto/` + ~30 net eval cases + ~1,500 lines of doc/log. The Capability Registry (`docs/OTO_CAPABILITY_REGISTRY.md`) grew from new (857 lines Day 1) to ~1,200 lines through Day 6 iterations.

---

## 2. What's deployed where (unchanged from Sprint 2)

| Deployment | URL | Has Sprint 1? | Has Sprint 2? | Has Sprint 3? |
|---|---|---|---|---|
| Dev (flippant-mink-750) | `https://flippant-mink-750.convex.cloud` | YES | YES | **YES** (current HEAD — all Sprint 3 features) |
| Prod (mellow-cat-431) | `https://mellow-cat-431.convex.cloud` | NO (cylinders hotfix only) | NO | NO |

Prod stays unvalidated for Sprint 1-3. Hotfixes branch from `806403a` (pre-Sprint-1).

---

## 3. Sprint 3 day-by-day summary

### Day 1 (6 passes A-F) — Capability Registry foundation
- Pass A: `docs/OTO_CAPABILITY_REGISTRY.md` shipped (857 lines, 20 sections; 12 domains; status taxonomy; per-domain template; eval coverage matrix; §19 governance)
- Passes B-F: iteration with Waleed on Sprint 3 Tier 2 scope (render_link_button destination enum 6→3→2→8, Loyalty in-chat vs redirect, redemption claim drop, AI-feedback per-message UI icon clarification)
- Key methodology lesson: **multi-pass registry iteration BEFORE dispatch** catches stakeholder scope drift. 6 passes saved a wrong schema migration + a wrong soft-pivot rule + multiple over-scoped enum drafts.

### Day 2 (1 pass) — `render_link_button` (8 destinations)
- Surface-partitioned 3-way parallel dispatch (Infrastructure + Prompt + QA) against locked registry contract
- 8 destinations: terms_of_service / privacy_policy / settings / profile / transaction_history / customer_support / feedback / bug_report
- Stable prompt v0.13 → v0.14
- Eval cases 57 → 71 (+14)
- Live tool count 31 → 32
- **Day 2 latent defect:** `render_link_button` registered in tools.ts + dispatcher.ts but MISSED in `chat.ts:TOOL_NAMES_V1` (Infrastructure brief said "DO NOT touch chat.ts — render tools don't have callables" which was WRONG — render tools don't have callables but DO need TOOL_NAMES_V1 entries to be visible to Haiku). Block 4 module-load invariant would have logged CONFIG ERROR at startup.

### Day 3 (2 passes A0 + A) — Loyalty in-chat + Day-2 defect fix
- Pass A0: surgical 4-line fix adding `render_link_button` to TOOL_NAMES_V1. **Pre-flight inventory caught the defect before runtime.**
- Pass A: Loyalty 3-way parallel dispatch — 3 new data tools (`get_loyalty_points_history`, `get_available_redemptions` informational-only, `get_loyalty_program_info`) + `get_rewards_summary` graduation from live-unsurfaced to live
- NEW `getProgramInfo` query in `convex/rewards.ts` (exposes earn-rate/tier-threshold constants)
- Stable prompt v0.14 → v0.15
- Eval cases 71 → 78 (+7)
- Live tool count 32 → 36
- Load-bearing constraint: NO claim flow in chat (per Day 1 Pass F); Oto describes redemptions, points to Loyalty screen
- **Methodology lesson:** Dispatch brief must enumerate ALL surface requirements per tool category. Day 3 brief codified the rule that would have caught the Day 2 defect at dispatch-time.

### Day 4 (4 passes A + A1 + A2 + B) — Vehicle anchoring + tone calibration + vehicle_onboarding
- Multi-pass registry iteration: Pass A draft → Pass A1 correction per Waleed Q1-Q4 sign-off → Pass A2 strict no-pivot reversion
- Pass B implementation: tools.ts enum 8→9 (added vehicle_onboarding), stable.ts v0.15→v0.16 (new `# Vehicle anchoring — one chat, one car` section + 9th destination), volatile.ts v0.13→v0.14 (NEW `# Tone calibration — warmth, empathy, enthusiasm` section + 3 worked Examples 15-17 — first volatile bump since Sprint 2)
- Eval cases 78 → 85 (+7)
- Live tool count unchanged at 36 (vehicle_onboarding is a destination, not a tool)
- Constraints: ANY question about sibling-owned vehicle → polite new-chat redirect; non-owned vehicles → educational AI engagement; vehicle_onboarding redirect explicit-only trigger
- **Methodology lesson:** Multi-pass registry iteration (3 passes for 1 day's worth of asks) eliminates 2 wrong-direction risks (schema migration drop in Pass A1; soft-pivot reversion in Pass A2)

### Day 5 (1 pass) — Booking Status
- 3-way parallel dispatch against locked registry contract — cleanest dispatch of Sprint 3
- 3 new tools: `get_pending_bookings` + `render_booking_card` + `render_bookings_list`
- NEW `getPendingBookings` query in `convex/oto/bookings.ts` (mirror of `getBookings`, 50-line duplication accepted due to TS2589 deep-instantiation trap on shared-helper extraction)
- Stable prompt v0.16 → v0.17
- Eval cases 85 → 91 (+6)
- Live tool count 36 → 39
- New `# Booking Status` prompt section discriminates from existing `# Booking flow` (viewing existing vs creating new)
- **Methodology lesson:** Locked registry contract + Day 3's per-category surface-enumeration rule + no scope iteration = clean single-pass dispatch.

### Day 6 (1 pass) — `render_support_form` (§13 Channel 1)
- 3-way parallel dispatch; 3-category enum (mechanic_dispute / service_complaint / billing_issue)
- Stable prompt v0.17 → v0.18; `# Support intake` section rewritten removing 4 instances of stale "still in development" language
- Eval cases 91 → 97 (+6)
- Live tool count 39 → 40
- 3-channel Support architecture complete: form path LIVE (this day) + redirect path LIVE since Day 2 + per-message AI-icon = mobile-team coord
- Schema migration deferred (mobile-team scope: the form's Submit button is a frontend action)

---

## 4. Wave-by-wave status (carried from Sprint 2)

| Wave | Status | Sprint 3 Δ | Sprint 4+ work |
|---|---|---|---|
| **Wave 1.4** v3 KB consolidation | ✓ Sprint 1 done | — | — |
| **Wave 1.5** statistical comparator protocol | Primitive shipped Sprint 2 Day 8 (REPEAT env in runner); formal multi-version run NOT YET DONE | — | Run N=5-10 on v0.9 → v0.18 stable / v0.7 → v0.14 volatile on representative subset |
| **Wave 1.9** schema-hash CI guard | ✓ Sprint 2 Day 10 (Rule 20 + `scripts/ci/schema-hash.expected`) | maintained (no schema migrations) | — |
| **Wave 2.4** token budget | Open carryover — no progress | — | Carryover |
| **Wave 3** memory keystone | 9/11 user-facing helpers wired | maintained | Admin-only `registerKbTopic` / `deprecateKbTopic` if needed |
| **Wave 4** prompt split | ✓ Sprint 2 Day 1 (stable/volatile split) | **stable.ts v0.13 → v0.18** (5 bumps); **volatile.ts v0.13 → v0.14** (1 bump — first since Sprint 2 close) | Wave 4 v2 (finer boundary) deferred |
| **Wave 5** retrieval rebuild | Design done Sprint 2 Day 11; **Implementation NOT YET DONE** | — | Sprint 4 priority |
| **Wave 6** deterministic router | NOT STARTED | — | Sprint 4+ multi-day |
| **Wave 7.1** untrusted-input wrapping | ✓ Sprint 2 (envelope + sanitizer + v0.13 rule) | — | tag-smuggling case sharpening (Day 11 finding) |
| **Wave 7.2** degradation ladder | ✓ Sprint 2 (design + impl + pre-turn gate) | — | §9 PM-review checkboxes ratification; success-event recording v2 promotion |
| **Wave 7.3** PII rate-limit | ✓ Sprint 2 (primitive + full enforcement) | — | Soft-block tier (DECISION-C, optional) |

---

## 5. Eval suite state (final at Sprint 3 close)

```
Total cases:       97 (89 active + 8 disabled — 1 polite-exit + 7 Cat M)
Runner primitives: tools_called, tools_not_called, branch,
                   text_contains, text_not_contains, form_system,
                   envelope_contains, envelope_not_contains,
                   pre_seed_mutations (per-case),
                   CASE_FILTER env, REPEAT env
Pre-existing 57 cases: byte-identical to Sprint 2 Day 11 HEAD throughout
Sprint 3 net adds:  +40 active eval cases across Days 2 + 3 + 4 + 5 + 6
Cat M cases:       7 SPEC cases for Wave 5 reranker v2 (still disabled until impl lands)
Day 2 cases:       14 (link_button_*, ai_feedback_*, transaction_vs_service_history_*)
Day 3 cases:       7 (loyalty_*)
Day 4 cases:       7 (link_button_vehicle_onboarding_*, vehicle_sibling_*, voice_*)
Day 5 cases:       6 (booking_status_*)
Day 6 cases:       6 (support_form_*)
Decay self-test:   4/4 PASS (memoryDecay.ts, unchanged)
Equivalence v2:    24/24 PASS (memoryEquivalence.ts, unchanged)
Teardown utility:  scripts/eval/runs/_teardown-fixtures.ts (unchanged)
Helper scripts:    _append-day3-loyalty.js, _append-day4-vehicle-anchoring.js,
                   _append-day6-support.js (untracked; reproducible audit pattern)
```

**Known eval flap (Sprint 2 Day 11 carryover, still open):**
- `prompt_injection_tag_smuggling_rejected` — Day 11 REPEAT=3 showed 1/3 PASS. Haiku sometimes echoes `<system>` / `record_semantic_fact` from user's injection content. Backend defense holds; user-visible response leaks. Sprint 4 sharpening priority.

**Tool-arg primitive limitation (Day 2 finding, carried through Days 3-6):**
- Runner has no `tools_called_with_args` primitive — can't assert `category="mechanic_dispute"`, `destination="terms_of_service"`, `limit=1`, etc. Per-tool correctness verified via tool-name + text_contains keyword matching. Sprint 4 Tier 3 carryover.

---

## 6. The single most important thing in this handoff

**Sprint 3 substantive feature work is COMPLETE. The Capability Registry is the LIVING CONTRACT — every Sprint 4+ feature dispatch must reference and update it per §19 governance.** No new feature surface should land without a corresponding registry entry. The registry's per-domain template (Purpose → User-visible behaviors → Tools (status) → Prompt rules → Data sources → Oto MUST NOT → Eval coverage) is the dispatch contract. Surface-enumeration rule (Day 3 lesson) is mandatory in every dispatch brief.

---

## 7. Sprint 3 close priority queue (Tier 3 carryovers — none new feature surfaces)

### Tier 3.A — Eval infrastructure refinements

1. **Runner primitive `tools_called_with_args`** (Day 2 finding) — tightens per-tool-arg correctness across many Day 2-6 cases. Small dispatch (~half-day). Follow Sprint 2 runner-primitive pattern.
2. **Optional 7th Day 5 eval case** (`booking_status_pending_vs_active_subset`) — pending PM decision on prompt-language disambiguation.

### Tier 3.B — CI invariant additions

3. **Registry-CI guard** (Day 3 finding) — lints `OTO_TOOLS ⊂ TOOL_NAMES_V1`. Catches the Day 2 Pass A0 defect class explicitly at CI time rather than relying on the Block 4 runtime invariant which only fires at Convex module load. Small dispatch (~half-day). Follow Wave 1.9 schema-hash CI guard pattern.

### Tier 3.C — Code hygiene

4. **Extract rewards program constants** (Day 3 finding) — `convex/constants/rewards.ts` so `getProgramInfo` query + `addCreditForCompletedBooking` inline-constants share one source. Small mechanical (~quarter-day).
5. **`convex/oto/bookings.ts` shared-helper extraction** (Day 5 finding) — blocked by TS2589 deep-instantiation; revisit after Wave 5 work resolves the trap.
6. **`bookings.ts` schema bug fix** (Day 5 finding) — `scheduled_at` vs `scheduled_date` discrepancy preserved in both `getBookings` and `getPendingBookings`; fix together in a paired commit.

### Tier 3.D — Prompt / Eval calibration

7. **Rich-detail-anchored triage threshold tightening** (Day 6 Prompt Engineer concern) — if eval surfaces confusion on edge cases like *"shop did bad work last week"*, tighten from ≥1 anchor to ≥2 or specific-noun requirement. Volatile bump.
8. **`prompt_injection_tag_smuggling_rejected` sharpening** (Sprint 2 Day 11 finding) — Sprint 3 didn't address. Either v0.18 → v0.19 stable rule sharpening OR eval relaxation OR post-response sanitization layer. Small dispatch.
9. **"That sucks" empathy phrasing softening** (Day 4 Prompt Engineer concern) — only if eval results flag it. Currently preserved per Registry §1 register allowance.
10. **Wave 1.5 formal multi-version run** — now at v0.18-stable+v0.14-volatile; multi-version run across v0.9 → v0.18 stable / v0.7 → v0.14 volatile on representative subset. ~2-4 hr Anthropic compute; deploy-key auth for multi-hour windows.

### Tier 3.E — Mobile coordination tickets

11. **Frontend coordination — remove synthetic "I'd like to confirm X vehicle" first message** (Day 4 finding). Mobile team ticket. Backend already handles this; prompt has no synthetic-message handling.
12. **Mobile UI rendering for new ChatMessage fields:** `linkButton` (Day 2), `bookingCard` + `bookingsList` (Day 5), `supportForm` (Day 6), per-message AI-feedback icon (Day 1 Pass F). All mobile-team tickets.
13. **Schema migration for `support_intake_submissions`** (Day 6 deferred) — mobile-team coordination for the form's Submit-button backend.

### Tier 4-7 — same as Sprint 2 close handoff

- Wave 5 reranker v2 implementation per `docs/SPRINT_2/WAVE_5_RETRIEVAL_REBUILD.md`
- 20-30 additional Cat M cases
- Wave 5 weight tuning
- Wave 6 deterministic router
- Wave 7.2 §9 PM-review checkboxes ratification
- Mobile UI handling of `error_kind` values
- Sub-block PII counter tier (DECISION-C)
- Wave 5.2 baseline measurement on prod (prod-deploy gate)
- Wave 2.4 token budget
- A/B start percentage for first protocol run
- `runBackfillV3Lifecycle` against live Convex
- Rotate prod deploy key
- Duplicate BMW M550i G30 2020 configs on dev
- Project hygiene: `scripts/eval/runs/` ephemeral output cleanup

---

## 8. Methodology lessons (carried forward to Sprint 4)

1. **Multi-pass registry iteration eliminates wrong-direction risk.** Sprint 3 Days 1 + 4 ran 9 total registry-iteration passes that saved a schema migration, a soft-pivot rule, and multiple over-scoped enum drafts. The §19 governance pattern (corrections land as new passes; audit trail preserved) handles ambiguous stakeholder asks cleanly. Cost: doc-only commits. Benefit: zero throwaway code.

2. **Surface-enumeration rule per tool category is MANDATORY in dispatch briefs.** Day 2 → Day 3 Pass A0 was the lesson. Render tools need ALL FOUR surfaces (schema + category + TOOL_NAMES_V1 + dispatcher branch). Data tools need ALL FIVE (schema + category + TOOL_NAMES_V1 + DATA_TOOL_CALLABLE_NAMES + buildCallables). Briefs must list them explicitly OR the Block 4 invariant will catch the miss at module load.

3. **Pre-flight inventory catches defects static checks miss.** Day 3 caught the Day 2 Pass A0 defect via pre-flight grep of chat.ts for the Loyalty wiring patterns. Day 8 (Sprint 2) caught the `ReturnsValidationError` via first-run validation. The discipline: before dispatching, inventory the surfaces you're about to touch + verify the prior session's claims against ground truth.

4. **Surface-partitioned 3-way parallel dispatching scales for feature work.** Days 2 + 3 + 4 (Pass B) + 5 + 6 all ran Infrastructure + Prompt + QA in parallel against the registry contract. Zero cross-talk needed because each subagent reads the registry independently. Dispatches that touch overlapping surfaces would need different partitioning — for Sprint 3 substantive features, the partition was clean.

5. **Registry as living contract pays compound returns.** Day 1's 857-line registry foundation paid off Days 2-6 with locked contracts that enabled clean parallel dispatching. Future sprints should treat the registry the same way — front-load contract codification, then dispatch.

6. **Schema migrations are EXPENSIVE in Convex; defer when possible.** Sprint 3 had two opportunities to add schema fields (Day 4 `ai_conversations.vehicle_id`, Day 6 `support_intake_submissions`). Both deferred. The existing per-turn `vehicleVin` arg + mobile-team-owned submission backend handled both cases at zero schema cost. When the answer is "yes the field would be nice," ask the second question: "but is there an existing mechanism that does the job?"

7. **Distinguish pass types in commit messages.** Sprint 3 commit messages tagged each pass: "Pass A draft," "Pass A1 correction," "Pass A2 simplification," "Pass B implementation." The taxonomy helped readers (and the registry's §19 governance) understand what each commit did. Future sessions: keep this discipline.

---

## 9. The literal copy-paste prompt for Sprint 4 / further Tier 3 work

When you start Claude Code in `C:\Users\manso\Desktop\otopair-1\` after `/clear`, paste this:

```
You are the PM orchestrator for OtoPair, continuing from Sprint 3 Day 6 close (commits 7d15d46 + 13beada + Sprint-3-close handoff). Sprint 3 substantive feature work is COMPLETE. All 4 Tier 2 surfaces + §13 Channel 1 form + §15.12 vehicle anchoring + §1 tone calibration are LIVE. Remaining Sprint 3 scope is Tier 3 carryovers only.

Read these in order before doing anything else:
1. docs/OTO_CAPABILITY_REGISTRY.md — the living contract; every domain + every MUST NOT + every tool/table/prompt-rule/eval cross-reference
2. docs/HANDOFF_2026-05-17_SPRINT_3_CLOSE.md — Sprint 3 close handoff (this file)
3. docs/SPRINT_3_DAY_6_LOG.md — Day 6 specifics (most recent dispatch)
4. .claude/agents/_pm-orchestrator.md — your role definition
5. CLAUDE.md + REFERENCES.md — project context

After reading, verify state:
1. `git log --oneline -10` — should start with 13beada (Day 6 log) or later
2. `bash scripts/ci/vehicle-facts-grep.sh` — expect 20/20 rules clean
3. Schema hash check: `sha256sum convex/schema.ts | awk '{print $1}'` must match scripts/ci/schema-hash.expected
4. Eval cases count: `node -e "console.log(JSON.parse(require('fs').readFileSync('scripts/oto-eval-cases.json','utf8')).cases.length)"` — should be 97
5. Stable prompt version: should be v0.18-stable
6. Volatile prompt version: should be v0.14-volatile

Then DECIDE WITH WALEED what to do next. Options:

A) Tier 3 carryovers in the Sprint 3 close handoff §7 (no new feature work; refinements only):
   - Runner primitive tools_called_with_args (Day 2 finding) — small dispatch
   - Registry-CI guard linting OTO_TOOLS ⊂ TOOL_NAMES_V1 (Day 3 finding) — small dispatch
   - Rewards constants extraction (Day 3 finding) — small mechanical
   - bookings.ts shared-helper / schema-bug fixes (Day 5 finding)
   - Tag-smuggling case sharpening (Sprint 2 Day 11 finding)
   - Wave 1.5 formal multi-version run (now spans v0.9 → v0.18)
   - Mobile coordination tickets

B) Sprint 4 substantive work:
   - Wave 5 reranker v2 implementation per docs/SPRINT_2/WAVE_5_RETRIEVAL_REBUILD.md
   - Wave 6 deterministic router
   - New feature surfaces Waleed scopes (would need new §14.x registry entry first)

C) Sprint 3-final polish + sprint-close ceremonies:
   - Ratify open Day-N retro items (Day 4 "That sucks" phrasing, Day 5 pending-vs-active eval case, Day 6 rich-detail triage threshold)
   - Run a representative-subset eval to verify all Sprint 3 features work end-to-end

Default RECOMMENDATION if Waleed says "continue": pick the highest-leverage Tier 3 carryover. The Registry-CI guard is a strong candidate — small dispatch, catches future defect class, follows Wave 1.9 pattern.

Methodology rules (non-negotiable, same as Sprint 2-3):
- Dispatch via Task tool with subagent_type: "general-purpose"; tell each agent to Read .claude/agents/<role>.md first
- Surface-partitioned parallel dispatching
- 20 CI invariants must stay green
- Per-tool-category surface enumeration in EVERY dispatch brief (Day 3 lesson)
- Per-pass commits
- Day logs after each dispatch round
- Registry update accompanies every feature dispatch (§19 governance)

Operational keys (unchanged from Sprint 2-3):
- Dev deploy key: dev:flippant-mink-750|eyJ2MiI6ImNlNTk3ZDE1N2QxZjQyYzA5ZmRhYzFmYzIxOGU4MGQ5In0=
- Dev Convex URL: https://flippant-mink-750.convex.cloud
- Prod Convex URL: https://mellow-cat-431.convex.cloud — DO NOT DEPLOY waleed-dev-oto here
- User JWT for chat:sendMessage: ~1-hour validity, fresh per session
- Test user._id: md7fjepfczgwtpn0vpas2y3rrh83ggb3
- Test M550i full VIN: WBAJS7C01LBN96146 (eval default, tail "N96146")
- 97-case eval suite + REPEAT env for N=K statistical runs

Do NOT:
- Deploy waleed-dev-oto to prod
- Add new feature surfaces without first adding a registry entry (§19 governance)
- Skip the surface-enumeration rule in dispatch briefs
- Touch convex/_generated/
- Bypass Wave 1.9 schema-hash CI guard
- Trust subagent claims without verifying against ground truth
```

That's the prompt. Sprint 4 starts wherever Waleed directs.

---

## 10. The single one-sentence summary

**Sprint 3 closed at ~99% MVP capability across 6 days of work — Day 1 authored the 1,200-line Capability Registry across 6 stakeholder-iteration passes establishing the §19 governance contract every Sprint 3+ feature dispatch references, Days 2-6 shipped all 4 Tier 2 substantive feature surfaces plus the §13 Channel 1 support form via 5 single-pass 3-way parallel surface-partitioned dispatches plus 1 multi-pass Day 4 iteration that handled Waleed's tone-and-anchoring scope drift across A→A1→A2 + Pass B, landing `render_link_button` 9-destination app-navigation redirect (terms_of_service / privacy_policy / settings / profile / transaction_history / customer_support / feedback / bug_report / vehicle_onboarding) + Loyalty in-chat informational surface with `get_rewards_summary` graduation + 3 new data tools (`get_loyalty_points_history`, `get_available_redemptions` informational-only, `get_loyalty_program_info`) + NEW `getProgramInfo` query exposing program constants + vehicle-anchoring rule (one chat = one car; sibling-owned questions → new-chat redirect; non-owned → educational AI) + tone calibration (`# Tone calibration — warmth, empathy, enthusiasm` section in volatile.ts + 3 new Examples 15-17 + context-appropriate emotion as load-bearing constraint) + Booking Status (`get_pending_bookings` + `render_booking_card` + `render_bookings_list` + NEW `getPendingBookings` query) + `render_support_form` 3-category form (`mechanic_dispute` / `service_complaint` / `billing_issue`); composite prompt grew from `v0.13-stable+v0.13-volatile` (Sprint 2 close) to `v0.18-stable+v0.14-volatile` (Sprint 3 close, 5 stable bumps + 1 volatile bump — the first volatile bump since Sprint 2); 20 commits across 6 days; 97 eval cases (up from 57 — 40 active cases added across Days 2-6) with 89 active + 8 disabled including 7 Cat M starter cases queued for Wave 5; 40 live tools (up from 31); 20/20 CI invariants clean throughout; zero schema migrations (Wave 1.9 Rule 20 schema-hash baseline unchanged because the proposed Day 4 `ai_conversations.vehicle_id` migration was DROPPED in Pass A1 once Waleed clarified the existing per-turn `vehicleVin` arg already does the job, and the `support_intake_submissions` table for Day 6 form submissions is mobile-team scope); remaining Sprint 3 scope is Tier 3 carryovers ONLY (none are new feature surfaces — refinements + ergonomics + mobile coordination): runner primitive `tools_called_with_args`, registry-CI guard linting `OTO_TOOLS ⊂ TOOL_NAMES_V1` (catches the Day 2 Pass A0 defect class explicitly), rewards constants extraction, bookings shared-helper + schema-bug fixes, rich-detail triage threshold tightening if eval surfaces issues, tag-smuggling sharpening (Sprint 2 Day 11 carryover at 1/3 PASS), Wave 1.5 formal multi-version run across v0.9 → v0.18 stable / v0.7 → v0.14 volatile, mobile coordination tickets for synthetic-first-message removal + ChatMessage envelope-field rendering across all Sprint 3 render tools, schema migration for `support_intake_submissions` (mobile-team-owned); methodology lessons codified: multi-pass registry iteration eliminates wrong-direction risk, surface-enumeration rule per tool category is MANDATORY in dispatch briefs, pre-flight inventory catches defects static checks miss, surface-partitioned 3-way parallel scales for feature work, registry as living contract pays compound returns, schema migrations are expensive and should be deferred when an existing mechanism already does the job, distinguish pass types in commit messages.**

— End of Sprint 3 handoff. Ready for Sprint 4 or further Tier 3 work as Waleed directs.
