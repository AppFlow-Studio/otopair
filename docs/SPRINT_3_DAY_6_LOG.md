# Sprint 3 Day 6 — render_support_form (§13 Channel 1); Sprint 3 substantive feature work COMPLETE

**Date:** 2026-05-17 (Sprint 3 Day 6 — logical work-day demarcation: Days 1-5 covered the registry foundation + Tier 2 features; Day 6 closes the final substantive item)
**Authority:** `docs/OTO_CAPABILITY_REGISTRY.md` §13 Support (form-vs-redirect-vs-AI-icon three-channel architecture).
**Owner:** PM orchestrator + 3 subagent dispatches in surface-partitioned parallel.

---

## 0. Day 6 in one sentence

**Sprint 3 Day 6 lands `render_support_form` (3-category substantive intake — `mechanic_dispute` / `service_complaint` / `billing_issue`) across 3 surface-partitioned parallel dispatches, completing all Sprint 3 substantive feature work: Infrastructure registered the tool across 4 required surfaces (tools.ts +59 with schema + OTO_TOOL_CATEGORY + field-parity contract, dispatcher.ts +29 with packageRenderDirective branch + ChatMessageEnvelope.supportForm field, chat.ts +5 with TOOL_NAMES_V1 entry — Block 4 invariant verified via dynamic renderToolNames lookup), Prompt Engineer rewrote the existing `# Support intake` section in stable.ts (+14 net lines at lines 504-567, `v0.17-stable` → `v0.18-stable`) removing 4 instances of stale "still in development" language + codifying the 3-category contract + rich-detail-anchored triage rule (≥1 anchor: shop / mechanic / dollar / date / work-item) + 3-channel discrimination rules + prefilled_fields rigor + user-owns-Submit rule + 11 MUST-NOTs (no taking sides, no manufactured empathy, no false-submission promises, no invented prefills, no AI-feedback misrouting, no deprecated platform_bug/ai_escalation categories, no vague-ask misrouting, no diagnostic misrouting, no legal-evaluation misrouting, no channel stacking, no meta-narration), QA Lead appended 6 active eval cases (91→97 total — 3 category positives + 2 discrimination + 1 prefilled-fields rigor) with 91 pre-existing byte-identical at SHA-256 `6002e3466c79584b…`; commits `7d15d46` (Pass A) + this log (Pass B); 20/20 CI invariants clean; tool live count 39→40; composite prompt now `v0.18-stable+v0.14-volatile`; schema migration deferred (mobile-team scope — the form's Submit button is a frontend action); Sprint 3 substantive feature work now ENDS HERE — all 4 Tier 2 surfaces + §13 Channel 1 form + §15.12 anchoring + §1 tone are LIVE; remaining Sprint 3 scope is Tier 3 carryovers only.**

---

## 1. Methodology — Day 6 timeline

Three passes:

| # | Pass | Owner | Surface | Type |
|---|---|---|---|---|
| A | render_support_form dispatch (3-way parallel) | 3 subagents — Infrastructure + Prompt Engineer + QA Lead | tools.ts + dispatcher.ts + chat.ts + stable.ts + eval JSON + registry doc | Substantive feature dispatch |
| B | Verify + commit | PM (mechanical) | git commit `7d15d46` + registry status updates | PM |
| C | Day 6 log | PM | `docs/SPRINT_3_DAY_6_LOG.md` (this file) | PM |

### 1.1 Why Day 6 was clean (continuing the Day 5 cleanest-of-Sprint-3 trend)

Day 6 ran cleanly for the same reasons Day 5 did:
- Registry contract locked since Day 1 (with subsequent §13 refinements in Day 1 Pass E + Pass F)
- Day 3's per-category surface-enumeration rule applied
- No scope iteration needed (Waleed's three-channel architecture was already locked through Days 1-4)

The Prompt Engineer dispatch was slightly heavier than other days because it required REWRITING an existing section (rather than appending a new one) — removing 4 instances of stale "still in development" language. This is the natural cost when a registry domain graduates from "planned" to "live."

### 1.2 Schema migration deferred — schema work outside Oto-scope

The Day 6 brief explicitly deferred the `support_intake_submissions` schema migration to mobile-team scope. Reasoning per registry §13: *"the form's Submit button is the user's action"* — the actual submission happens in the frontend, which has its own backend route for persisting submissions. Oto's `render_support_form` tool just packages the form's pre-filled contents; the user reviews, edits, and submits via the mobile UI's Submit button.

This means: Oto-side, there's no schema change for `support_intake_submissions`. Mobile team handles their submission backend in parallel. The Day 6 dispatch matches the Day 2-5 zero-schema-change pattern exactly.

### 1.3 Subagent dispatch reports (under-target word counts)

**Infrastructure (under 300 words):**
- tools.ts 1147 → 1206 (+59) — schema at lines 800-860; field-parity comment + OTO_TOOL_CATEGORY
- dispatcher.ts 431 → 460 (+29) — case branch at line 235-257; ChatMessageEnvelope.supportForm field
- chat.ts 3539 → 3544 (+5) — TOOL_NAMES_V1 entry with §13 Channel 1 comment marker
- 20/20 CI clean; brace-balance delta=0 across all 3 files
- TS clean on touched files
- Block 4 invariant verified (render_support_form in TOOL_NAMES_V1 + OTO_TOOL_CATEGORY render)
- Decision flag: discrimination phrasing in tool description — "lightweight redirects" vs "substantive intake" axis matches registry §13 framing; AI-feedback override clause points to per-message UI icon. PM accepted.

**Prompt Engineer (under 400 words):**
- stable.ts 1133 → 1147 (+14)
- v0.17-stable → v0.18-stable
- `# Support intake` section at lines 504-567 (between `# App-navigation redirects` and `# Question caps`)
- 4 instances of stale "still in development" language found + removed
- 20/20 CI clean
- Decision flag: rich-detail-anchored triage threshold — current rule says "at least one anchor"; PM may want to tighten to "two anchors" or "specific-noun anchor" if eval surfaces confusion on edge cases like *"shop did bad work last week"* (date anchor + service complaint but no shop name / mechanic / dollar). Flagged for Day 6 retro.

**QA Lead (under 400 words):**
- 6 active cases appended (91 → 97; 89 active + 8 disabled)
- 91 pre-existing byte-identical (SHA-256 `6002e346…`)
- 20/20 CI clean; JSON valid
- Skipped optional 7th case (`support_form_deprecated_categories_not_fired`) — overlaps with Day 2's `link_button_bug_report`
- Decision flag: case 6 ban list for invented details = specific shop names + specific dollar amounts ($100/$200/$300/$500 — AI-completion defaults) + specific weekday names. Deliberately did NOT ban bare "$" (Oto might legitimately echo "billing") or "mechanic" (category framing word). The ban list is a heuristic proxy for the proper assertion (which would be `prefilled_fields` argument verification — Tier 3 `tools_called_with_args` runner primitive carryover).

---

## 2. What landed (Pass A, commit `7d15d46`)

### 2.1 `convex/oto/tools.ts` (+59 lines)

NEW `render_support_form` schema in RENDER_TOOLS at lines 800-860:
- 3-category enum: `mechanic_dispute` / `service_complaint` / `billing_issue`
- Required: `category` + `summary`
- Optional: `prefilled_fields` (object with optional `description`, `shop_name`, `visit_date`, `amount`, `mechanic_name` — all "ONLY if user said it; never invent")
- Description explicitly discriminates 3-channel architecture:
  - vs `render_link_button` lightweight redirects (substantive intake requires rich detail)
  - vs per-message AI-feedback icon (when user complains about Oto's response, DO NOT fire this tool AND DO NOT fire bug_report redirect; point to the icon)
- Terminal-render note (ENDS YOUR TURN)
- OTO_TOOL_CATEGORY entry as `"render"`
- Field-parity contract updated: `render_support_form → message.supportForm`

### 2.2 `convex/oto/dispatcher.ts` (+29 lines)

NEW `case "render_support_form":` branch in `packageRenderDirective` at lines 235-257. Packages `{ category, summary, prefilled_fields }` via `renderD("supportForm", ...)`.

`ChatMessageEnvelope` interface extended: `supportForm?: unknown;` at line ~404.

### 2.3 `convex/oto/chat.ts` (+5 lines)

- TOOL_NAMES_V1 (line 119): added `"render_support_form"` after `"render_record_confirmation"` with comment marker referencing §13 Channel 1
- No `buildCallables` entry needed (render tools have no callables)
- `renderToolNames` dynamic computation at chat.ts:186 picks up `render_support_form` automatically via OTO_TOOL_CATEGORY

### 2.4 `convex/oto/prompt/stable.ts` (+14 net lines, v0.17-stable → v0.18-stable)

Rewrote `# Support intake` section at lines 504-567 to reflect LIVE form status:
- Removed 4 instances of "still in development" / "form isn't built yet" language
- Codified 3-category contract with per-category signal cues
- Rich-detail-anchored triage rule (≥1 anchor)
- 3-channel discrimination as prose-bullet routing checklist
- Prefilled_fields rules (user-said-only)
- User-owns-Submit rule (terminal render; 3 acceptable framing phrasings; hard ban on "I've sent this" etc.)
- 11 MUST-NOTs

`# Tools` registry: `render_support_form` entry rewritten as LIVE.
`# Capability honesty`: CAN-DO bullet added; CANNOT bullet rewritten.

### 2.5 `scripts/oto-eval-cases.json` (91 → 97 cases, +6 active)

Group A — 3 form-category positives:
- `support_form_mechanic_dispute`
- `support_form_service_complaint`
- `support_form_billing_issue`

Group B — 2 discrimination:
- `support_form_vs_redirect_lightweight`
- `support_form_no_for_ai_feedback`

Group C — 1 prefilled-fields rigor:
- `support_form_no_invented_details`

91 pre-existing byte-identical (SHA-256 `6002e3466c79584bf687d2c292ded158bf68d35df47cc8d47c68a127a01aa677`).

### 2.6 `docs/OTO_CAPABILITY_REGISTRY.md` (status updates)

- §13 Support: status header added — `render_support_form` LIVE
- §16 planned-tools table: `render_support_form` row marked **live**

---

## 3. Sprint 3 Day 6 Verification

```
CI grep:                20/20 rules clean
Brace-balance:          tools.ts delta=0 (261/261)
                        dispatcher.ts delta=0 (64/64)
                        chat.ts delta=0 (576/576)
                        stable.ts (template-literal — expected)
Schema hash:            6c5818395c2f6e38d070132ea56957bc9b80997c4013982dd3d2d3451f792385 (unchanged)
Eval JSON:              97 cases (89 active + 8 disabled — 6 new + 91 prior)
91 pre-existing cases:  byte-identical (deep-sorted SHA-256 6002e346…)
Stable prompt:          v0.18-stable
Volatile prompt:        v0.14-volatile (unchanged from Day 4)
Composite prompt:       v0.18-stable+v0.14-volatile
TypeScript:             0 NEW TS errors on Day 6 touched code
Block 4 invariant:      VERIFIED
Files touched (Pass A): 6 (tools.ts + dispatcher.ts + chat.ts + stable.ts + eval JSON + registry doc)
Commit:                 7d15d46
```

---

## 4. Sprint 3 substantive feature work — COMPLETE

| Surface | Status | Days | Tools |
|---|---|---|---|
| §14.1 `render_link_button` (9 destinations) | LIVE | Days 2 + 3 + 4 | 1 tool, 9 destinations |
| §14.2 Loyalty in-chat | LIVE | Day 3 | 4 tools |
| §15.12 Vehicle anchoring + §1 tone calibration | LIVE | Day 4 | constraints + register cues |
| §14.3 Booking Status | LIVE | Day 5 | 3 tools |
| §13 Channel 1 `render_support_form` (3 categories) | LIVE | Day 6 (this) | 1 tool |
| §13 Channel 2 `render_link_button` redirects | LIVE | Day 2 | (shared with §14.1) |
| §13 Channel 3 per-message AI-feedback icon | mobile-team coord | n/a | UI affordance, not an Oto tool |

**Substantive Sprint 3 feature work: COMPLETE.** Remaining Sprint 3 items are Tier 3 carryovers only — none of them are new feature surfaces; all are refinements / ergonomics / mobile coordination.

---

## 5. MVP capability progression (Day 5 close → Day 6 close)

| Surface | Day 5 EOD | **Day 6 EOD** | Δ |
|---|---|---|---|
| User-visible MVP capability | ~98-99% | **~99%** | +0.5% (final substantive surface lands) |
| Architectural-discipline coverage | 100% | **100%** | maintained |
| Tools live | 39 | **40** | +1 (render_support_form) |
| Stable prompt version | v0.17-stable | **v0.18-stable** | bumped |
| Volatile prompt version | v0.14-volatile | **v0.14-volatile** | unchanged |
| Composite prompt | v0.17-stable+v0.14-volatile | **v0.18-stable+v0.14-volatile** | stable half bumped |
| Eval cases | 91 (83 active + 8 disabled) | **97 (89 active + 8 disabled)** | +6 |
| CI invariants | 20 rules | **20 rules** | maintained |
| Sprint 3 substantive features | 5 of 6 live | **6 of 6 COMPLETE** | done |

---

## 6. Sprint 3 priorities — refresh post-Day-6 (only Tier 3 carryovers remain)

### Tier 2 — DONE

### Sprint 3 substantive feature work — DONE

### Tier 3 carryovers (none are new feature surfaces; all are refinements)

1. **Frontend coordination — remove synthetic "I'd like to confirm X vehicle" first message** (Day 4 finding). Mobile team ticket. Backend already handles this.
2. **Runner primitive `tools_called_with_args`** (Day 2 finding) — tightens per-tool-arg correctness across many Day 2-6 cases.
3. **Registry-CI guard** (Day 3 finding) — lints `OTO_TOOLS ⊂ TOOL_NAMES_V1`.
4. **Extract rewards program constants** (Day 3 finding) — `convex/constants/rewards.ts`.
5. **`convex/oto/bookings.ts` shared-helper extraction** (Day 5 finding) — blocked by TS2589; revisit after Wave 5 work.
6. **`bookings.ts` schema bug fix** (Day 5 finding) — `scheduled_at` vs `scheduled_date` in both queries; fix together.
7. **NEW Day 6: Rich-detail-anchored triage threshold tightening** — if eval surfaces confusion on edge cases (e.g. *"shop did bad work last week"*), tighten from ≥1 anchor to ≥2 or specific-noun.
8. **`prompt_injection_tag_smuggling_rejected` sharpening** (Day 11 Sprint 2 finding).
9. **Wave 1.5 formal multi-version run** — now at v0.18-stable+v0.14-volatile; multi-version run across v0.9 → v0.18 stable would surface any regression series.
10. **"That sucks" empathy phrasing softening if needed** (Day 4 finding).
11. **Mobile coordination tickets** (Day 2 linkButton + Day 5 bookingCard/bookingsList + Day 6 supportForm + Day 1 Pass F per-message AI icon).
12. **Optional 7th Day 5 eval case** (pending vs active subset).
13. **Schema migration for `support_intake_submissions`** (Day 6 deferred) — mobile-team coordination ticket for the form's Submit-button backend.

### Tier 4-7 — same as Sprint 2 close handoff (Wave 5 reranker v2 implementation, Wave 6 deterministic router, etc.)

---

## 7. The Day 6 one-line summary

**Sprint 3 Day 6 closes substantive feature work by landing `render_support_form` (§13 Channel 1, 3-category enum: mechanic_dispute / service_complaint / billing_issue) across 6 file surfaces in 1 dispatch — Infrastructure across 3 files (+93 net lines: tools.ts schema at 800-860 + dispatcher.ts case branch at 235-257 + chat.ts TOOL_NAMES_V1 entry with discrimination phrasing in description against the lightweight render_link_button redirects + the per-message AI-feedback icon, Block 4 invariant verified via dynamic renderToolNames), Prompt Engineer rewrote # Support intake section (+14 net at lines 504-567 in stable.ts, `v0.17-stable` → `v0.18-stable`) removing 4 instances of stale "still in development" language + codifying 3-category contract + rich-detail-anchored triage rule (≥1 anchor: shop/mechanic/dollar/date/work-item) + 3-channel discrimination + prefilled_fields rigor + user-owns-Submit rule + 11 MUST-NOTs, QA Lead appended 6 active cases (91→97 total — 3 category positives + 2 discrimination + 1 prefilled-fields rigor; 91 pre-existing byte-identical at SHA-256 `6002e3466c79584b…`); commit `7d15d46` + this log; 20/20 CI clean; tool live count 39→40; composite prompt `v0.18-stable+v0.14-volatile`; schema migration deferred (mobile-team scope — form Submit is frontend action); Sprint 3 substantive feature work ENDS HERE (4 Tier 2 surfaces + §13 Channel 1 form + §15.12 anchoring + §1 tone all LIVE); remaining Sprint 3 scope is Tier 3 carryovers only (none of them are new feature surfaces — refinements, ergonomics, mobile coordination); Days 5 + 6 demonstrated the cleanest two-day stretch of Sprint 3 because the Day 1 registry foundation + Day 3 surface-enumeration rule + locked scope eliminated scope iteration overhead.**

— End of Sprint 3 Day 6. All Sprint 3 substantive feature work complete. Ready for sprint-close handoff or further Tier 3 work as Waleed directs.
