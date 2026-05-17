# Sprint 3 Day 2 — render_link_button (8-destination app-navigation redirect)

**Date:** 2026-05-17 (Sprint 3 Day 2 — same calendar day as Day 1; logical work-day demarcation: Day 1 was the registry foundation across 6 passes, Day 2 begins capability execution against the registry contract)
**Authority:** `docs/OTO_CAPABILITY_REGISTRY.md` §14.1 (the contract Pass A implements) + Sprint 3 Day 1 Pass F's three-channel Support architecture.
**Owner:** PM orchestrator (dispatch + verify + commit) + 3 subagent dispatches in surface-partitioned parallel.

---

## 0. Day 2 in one sentence

**Sprint 3 Day 2 lands the first Tier 2 feature surface: `render_link_button` (8-destination app-navigation redirect tool — `terms_of_service` / `privacy_policy` / `settings` / `profile` / `transaction_history` / `customer_support` / `feedback` / `bug_report`) across three surface-partitioned parallel dispatches — Infrastructure registered the tool in `convex/oto/tools.ts` (+44 lines) and `convex/oto/dispatcher.ts` (+23 lines) with the 8-destination enum + optional `label?` override + ChatMessage.linkButton envelope field + 0 TS errors + brace-balance delta=0 on both files; Prompt Engineer added a NEW `# App-navigation redirects` section to `convex/oto/prompt/stable.ts` BEFORE the existing `# Support intake` section (+65 lines total) with prose per-destination trigger phrasings, terminal-render rule, transaction-history-vs-service-history discrimination clause, and 5 illustrative MUST-NOTs (no invented destinations, no recomposed screen content, no bug_report/feedback confusion with AI-feedback, no redirect stacking, no system narration) AND rewrote the `# Support intake` section to reflect the three-channel architecture (form / redirect / per-message AI-feedback icon) AND updated `# Capability honesty` to graduate the redirect destinations into the CAN-DO list AND bumped `STABLE_PROMPT_VERSION` v0.13-stable → v0.14-stable (composite v0.14-stable+v0.13-volatile); QA Lead appended 14 new active eval cases to `scripts/oto-eval-cases.json` (57 → 71 cases; 8 destination positives in Group A + 3 AI-feedback routing in Group B + 3 transaction-vs-service-history + invalid-destination discrimination in Group C, all with byte-identity verification on the 57 pre-existing cases via deep-sorted SHA-256 `6af7347a…`); commit `591c7f4` ships all four surfaces + the registry §14.1 + §16 status updates (planned → LIVE) in one atomic Pass A; 20/20 CI invariants clean throughout; schema hash unchanged; the highest-leverage Sprint 3 dispatch lands cleanly in a single round of 3-way parallel dispatching.**

---

## 1. Methodology — Day 2 timeline

Three passes:

| # | Pass | Owner | Surface | Type |
|---|---|---|---|---|
| A | render_link_button dispatch (3-way parallel) | 3 subagents — Infrastructure + Prompt Engineer + QA Lead | `convex/oto/tools.ts` + `convex/oto/dispatcher.ts` + `convex/oto/prompt/stable.ts` + `scripts/oto-eval-cases.json` + `docs/OTO_CAPABILITY_REGISTRY.md` (registry status updates) | Substantive feature dispatch |
| B | Verify + commit | PM (mechanical) | git commit `591c7f4` | PM |
| C | Day 2 log | PM | `docs/SPRINT_3_DAY_2_LOG.md` (this file) | PM |

### 1.1 Why 3-way parallel worked cleanly

The Sprint 2 methodology lesson (#1 in HANDOFF §7) was that "surface-partitioned parallel dispatching scales as long as the brief explicitly names cross-surface restrictions." Day 2 Pass A is the first test of this pattern against a feature dispatch (Sprint 2 used it for design + correction passes, not feature implementation).

Surface partitioning:

| Subagent | Owns (writes) | Reads but forbidden to write |
|---|---|---|
| Infrastructure Architect | `convex/oto/tools.ts` + `convex/oto/dispatcher.ts` | prompt/, scripts/, chat.ts, schema.ts |
| Prompt Engineer | `convex/oto/prompt/stable.ts` | tools.ts, dispatcher.ts, scripts/, chat.ts |
| QA Lead | `scripts/oto-eval-cases.json` | tools.ts, dispatcher.ts, prompt/ |

The contract each subagent operated against was the registry §14.1 (and §13 for Prompt Engineer). No subagent had to wait for another's output because the contract was already codified in Day 1 across 6 passes. This is the payoff of the Day 1 registry-foundation work: every Tier 2 dispatch ships against a single source of truth without cross-talk.

### 1.2 Each subagent's report-back

Infrastructure (under 300 words):
- tools.ts 994 → 1038 (+44 lines) + dispatcher.ts 379 → 402 (+23 lines)
- 20/20 CI clean
- TS check 0 errors on touched files
- Brace-balance delta=0 on both files
- PM-review item: render_link_button placed in RENDER_TOOLS after `render_record_confirmation` and before `render_quick_replies` (clusters terminal/UI-affordance renders together). Reasonable; PM accepted without re-ordering.

Prompt Engineer (under 350 words):
- stable.ts 933 → 998 (+65 lines)
- v0.13-stable → v0.14-stable
- 20/20 CI clean
- Disclosed in-scope divergence: also updated the `# Tools` registry block inside stable.ts to mark render_support_form 3-category reduction + add render_link_button entry. PM accepted (would otherwise contradict the rewritten Support intake section).
- Decision PM-review: how aggressive on bug_report/feedback ↔ AI-feedback confusion banning. Went moderate-firm (illustrative MUST-NOTs in both new redirect section AND Support intake, no hard-banned forbidden-phrasing block). PM accepted; the eval cases catch routing errors regardless of phrasing.

QA Lead (under 400 words):
- 14 active cases appended (8 destination positives + 3 AI-feedback routing + 3 discrimination)
- Total 57 → 71 cases (63 active + 8 disabled)
- 57 pre-existing cases byte-identical (deep-sorted SHA-256 `6af7347a35772dde33a2d62031605c6d2bb99147b6a5ecddd4c5f1c09ddbf59d`)
- JSON valid
- 20/20 CI clean
- Important judgment call: the eval runner has NO tool-argument assertion primitive — `tools_called` / `tools_not_called` check tool NAMES only. Group A per-destination correctness verified via `text_contains` keyword matching on destination keywords (`"terms"`, `"privacy"`, `"settings"`, etc.) in the framing sentence. Flagged for Sprint 3 Tier 3 runner-primitive carryover (`tools_called_with_args` would tighten Group A).
- All 14 cases include `update_conversation_state` (§15.9 always-rides-along rule).
- All 8 Group A cases assert `branch: "terminal"` (`render_link_button` is a terminal render per §14.1).

### 1.3 The "tool-arg assertion gap" is the Day 2 finding to add to Sprint 3 Tier 3 carryovers

QA Lead's judgment call surfaced a runner-primitive gap. Sprint 2 added `pre_seed_mutations` + `envelope_contains` / `envelope_not_contains` primitives (Day 8); Day 11 added `_teardown-fixtures.ts`. The next obvious primitive is `tools_called_with_args` — asserts not just that a tool was called, but that it was called with specific argument values. This would tighten Group A from "render_link_button called + keyword in text" to "render_link_button called with `destination: \"terms_of_service\"` precisely."

Sprint 3 Tier 3 carryover (added today): runner primitive `tools_called_with_args` — small dispatch, follows the Sprint 2 pattern of incremental runner primitive additions.

---

## 2. What landed (Pass A, commit `591c7f4`)

### 2.1 `convex/oto/tools.ts` (+44 lines)

- New `render_link_button` schema in `RENDER_TOOLS` array
- 8-destination enum with comprehensive description telling Haiku WHEN to call for each destination + terminal-render rule + bug_report-is-general-app-bugs-only clarifier
- Optional `label?` parameter for context-specific button text overrides
- OTO_TOOL_CATEGORY entry: `render_link_button: "render"`
- Field-parity contract comment updated: `render_link_button → message.linkButton`
- Tool placement: between `render_record_confirmation` and `render_quick_replies` (terminal/UI-affordance cluster)

### 2.2 `convex/oto/dispatcher.ts` (+23 lines)

- `case "render_link_button":` branch in `packageRenderDirective`
- Packages `{ destination, label? }` into render directive with `field: "linkButton"` via `renderD()` helper
- Conditional spread on `label` (omitted when not provided)
- `ChatMessageEnvelope` interface gained `linkButton?: unknown;` with §14.1 reference comment

### 2.3 `convex/oto/prompt/stable.ts` (+65 lines, v0.13-stable → v0.14-stable)

**New section: `# App-navigation redirects — render_link_button`** (placed at line 461, immediately before the rewritten `# Support intake` at line 502):

- 8-destination enum with prose per-destination trigger phrasings + example phrasings
- Terminal-render rule (calling this tool ENDS YOUR TURN)
- `label?` override guidance
- Transaction-history-vs-service-history discrimination clause (transaction_history is payments-ledger via redirect; service history is completed bookings in-chat via `get_bookings`)
- 5 illustrative MUST-NOTs:
  1. Never invent destinations not in the 8-value enum
  2. Never recompose Settings / Profile / Transaction-History / Loyalty content in chat (the screens own those surfaces)
  3. Never confuse `bug_report` with AI-conversation feedback (per-message icon owns AI-conversation feedback)
  4. Never confuse `feedback` redirect with AI-conversation feedback either
  5. Never narrate the system (no "the redirect tool", no "I'll route you", no tool name leakage)

**Rewritten `# Support intake` section** (three-channel architecture):

- Channel 1 — Form path: `render_support_form` (3 categories — `mechanic_dispute` / `service_complaint` / `billing_issue`; marked as "still in development — for now redirect to customer_support")
- Channel 2 — Redirect path: `render_link_button` with `customer_support` / `feedback` / `bug_report`
- Channel 3 — Per-message AI-feedback icon: NOT an Oto tool; mobile chat UI renders an exclamation-point icon alongside copy / TTS; Oto's role when user complains about a specific Oto response is to acknowledge briefly + point to the icon with the canonical pattern: *"Thanks for flagging — if that's worth reporting, tap the exclamation-point icon next to my response and the team will see the conversation."*
- Channel-discrimination decision rules as prose bullets
- Old `platform_bug` + `ai_escalation` form-category references dropped + new explicit MUST-NOT against referencing them

**`# Capability honesty` section updated**:

- Three new CAN-DO redirect bullets (TOS/Privacy, Settings/Profile/Transaction-History, Customer-Support/Feedback/Bug-Report)
- Rewrote support-tickets CANNOT bullet: `render_support_form` in development → route to customer_support for now
- New CANNOT bullet: file a report about Oto's own response (per-message UI icon handles that)

**`# Tools` registry block inside stable.ts updated**:

- `render_support_form` entry reduced to 3 final categories with explicit ai_escalation / platform_bug deprecation note
- New `render_link_button` entry pointing to the new redirect section

**`STABLE_PROMPT_VERSION` bumped**: `v0.13-stable` → `v0.14-stable`. Composite version auto-derives: `v0.14-stable+v0.13-volatile`.

### 2.4 `scripts/oto-eval-cases.json` (57 → 71 cases, +14 active)

**Group A — 8 destination positives** (one per §14.1 destination enum value, each asserts `render_link_button` in `tools_called` + destination-keyword in `text_contains` + `branch: "terminal"`):

1. `link_button_tos_request`
2. `link_button_privacy_request`
3. `link_button_settings_open`
4. `link_button_profile_open`
5. `link_button_transaction_history` (also `tools_not_called: ["get_bookings"]`)
6. `link_button_customer_support`
7. `link_button_feedback_filing`
8. `link_button_bug_report`

**Group B — 3 AI-feedback routing**:

9. `ai_feedback_points_to_icon` (asserts "icon" in text; render_link_button + render_support_form NOT called)
10. `ai_feedback_no_promise_to_file` (bans "I'll let the team know" / "I'll flag this" / "I'll file a report" / etc.)
11. `ai_feedback_distinguishes_from_bug_report` (Oto-response complaint → no bug_report redirect)

**Group C — 3 discrimination**:

12. `transaction_vs_service_history_redirect` (render_link_button fires; get_bookings does NOT)
13. `transaction_vs_service_history_in_chat` (get_bookings fires; render_link_button does NOT — counterpart to #12)
14. `link_button_invalid_destination_rejected` (loyalty NOT a valid destination → no render_link_button)

**Verification**: 57 pre-existing cases byte-identical (deep-sorted SHA-256 `6af7347a35772dde33a2d62031605c6d2bb99147b6a5ecddd4c5f1c09ddbf59d`); JSON parses cleanly; total 71 (63 active + 8 disabled).

### 2.5 `docs/OTO_CAPABILITY_REGISTRY.md` (status updates)

- §14.1 status changed: `planned` → **LIVE as of Sprint 3 Day 2 Pass A** with implementation-detail note (tool registered, prompt section authored, eval cases shipped, mobile-frontend coordination remaining)
- §16 Planned tools table: render_link_button row updated with **live** badge

---

## 3. Sprint 3 Day 2 Verification

```
CI grep:                20/20 rules clean throughout
Brace-balance:          tools.ts delta=0, dispatcher.ts delta=0
                        stable.ts open=1 close=1 delta=0 (template-literal file; expected)
Schema hash:            6c5818395c2f6e38d070132ea56957bc9b80997c4013982dd3d2d3451f792385 (unchanged)
Eval JSON:              71 cases (63 active + 8 disabled — 14 new + 57 prior)
57 pre-existing cases:  byte-identical (deep-sorted SHA-256 6af7347a…)
Stable prompt:          v0.14-stable
Composite prompt:       v0.14-stable+v0.13-volatile
TypeScript:             0 errors on touched files (per Infrastructure dispatch report)
Files touched:          5 (tools.ts, dispatcher.ts, stable.ts, eval JSON, registry doc)
Commit:                 591c7f4 — all four surfaces + registry status atomic
```

---

## 4. MVP capability progression (Day 1 close → Day 2 close)

| Surface | Day 1 EOD | **Day 2 EOD** | Δ |
|---|---|---|---|
| User-visible MVP capability | ~94-95% | **~95-96%** | +0.5-1% (first new feature surface lands) |
| Architectural-discipline coverage | 100% | **100%** | maintained (registry updated in same commit) |
| Tools live | 31 | **32** | +1 (render_link_button) |
| Cross-domain redirect coverage | None | **Settings + Profile + Transaction History + TOS + Privacy + Customer Support + Feedback + Bug Report** | net-new |
| Three-channel Support architecture | Documented (§13) | **Documented + first channel live** (Channel 2 redirect path) | partial — Channel 1 form path is next |
| Stable prompt version | v0.13-stable | **v0.14-stable** | bumped |
| Eval cases | 57 (49 active + 8 disabled) | **71 (63 active + 8 disabled)** | +14 |
| CI invariants | 20 rules | **20 rules** | maintained |

Day 2 is the first day where Oto's user-visible capability grows. Sprint 2 closed at architecture-substrate maturity (~94-95%); Day 2 begins the feature-build-out phase against that substrate.

---

## 5. Sprint 3 priorities — refresh post-Pass-A

### Tier 2 — remaining feature surfaces (next up, Day 3-4)

1. **Loyalty in-chat surface** (§14.2) — `get_rewards_summary` graduation + 3 new data tools (`get_loyalty_points_history`, `get_available_redemptions` informational-only, `get_loyalty_program_info`) + prompt section with the no-claim-flow + conversational-pointer rule. ~half-day, 3-way parallel dispatch same pattern as Day 2.
2. **Booking Status surface** (§14.3) — `get_pending_bookings` + `render_booking_card` + `render_bookings_list` + prompt section. ~half-day.
3. **`render_support_form` 3-category dispatch** (§13 Channel 1) — completes the three-channel architecture. ~half-day. Lands separately from §14.1 to keep dispatches scoped.

### Tier 3 — Sprint 2 carryovers + Day 2 finding

4. **NEW: `tools_called_with_args` runner primitive** — added by Day 2 QA-Lead finding. Tightens Group A per-destination correctness from text_contains keyword matching to actual tool-argument assertion. Small dispatch. Follow-on to Sprint 2's eval-runner primitive additions (`pre_seed_mutations`, `envelope_contains`, REPEAT).
5. **`prompt_injection_tag_smuggling_rejected` sharpening** (carryover from Day 11 — 1/3 PASS at REPEAT=3).
6. **Wave 1.5 formal multi-version run** — N=5-10 on representative subset across v0.9 → v0.14 (now that v0.14-stable is live, this would surface any v0.13 → v0.14 regressions).
7. **Within-session per-case fixture-isolation hook** — runner-level `--teardown-before-each` flag.
8. **Volatile.ts examples for the new v0.14 redirect rules** — 2-3 worked-conversation Examples for the volatile section showing redirect-vs-in-chat discrimination. Small Prompt Engineer dispatch when Sprint 3 stabilizes.
9. **Mobile coordination: `ChatMessage.linkButton` rendering** — outside Oto AI scope but flagged for mobile-team Sprint 3 ticket. Without the mobile component, the tool fires server-side but the user doesn't see the button.

### Tier 4-7 — same as Sprint 2 close handoff (Wave 5 reranker v2 implementation, Wave 6 deterministic router, etc.)

---

## 6. The Day 2 one-line summary

**Sprint 3 Day 2 lands the first Tier 2 feature surface via 3-way surface-partitioned parallel dispatching: `render_link_button` (8-destination app-navigation redirect tool — `terms_of_service` / `privacy_policy` / `settings` / `profile` / `transaction_history` / `customer_support` / `feedback` / `bug_report` + optional `label?` override + terminal render) lands across Infrastructure (`convex/oto/tools.ts` +44 + `convex/oto/dispatcher.ts` +23, 0 TS errors, brace-delta=0), Prompt Engineer (`convex/oto/prompt/stable.ts` +65 with new `# App-navigation redirects` section + rewritten `# Support intake` three-channel architecture + updated `# Capability honesty` + `STABLE_PROMPT_VERSION` v0.13-stable → v0.14-stable), and QA Lead (`scripts/oto-eval-cases.json` 57 → 71 cases with 8 destination positives + 3 AI-feedback routing + 3 discrimination, 57 pre-existing cases byte-identical at SHA-256 `6af7347a…`); commit `591c7f4` ships all four surfaces + the registry §14.1 + §16 status (planned → LIVE) atomically; 20/20 CI invariants clean throughout; schema hash unchanged; tool live count 31 → 32; Day 2 surfaces one Sprint 3 Tier 3 carryover — runner primitive `tools_called_with_args` to tighten per-destination correctness from text_contains keyword matching to actual tool-arg assertion; the registry's Day-1 foundation paid off cleanly today — all three subagents operated against §14.1 + §13 contracts without cross-talk; Day 3 picks up the second Tier 2 surface — Loyalty in-chat (§14.2) is the natural next dispatch with the same 3-way parallel pattern.**

— End of Sprint 3 Day 2. First feature-build dispatch lands. The 3-way parallel pattern scales for substantive feature work, not just methodology + correction passes.
