# Sprint 3 pre-merge inventory + Tier 3 carryover bug-fix plans

**Date:** 2026-05-17 (Sprint 3 close + Day 7 EOD)
**Branch:** `waleed-dev-oto` (~440 commits ahead of `main`)
**Purpose:** Capture the bookings.ts `scheduled_at` vs `scheduled_date` bug-fix plan + all remaining Tier 3 carryover details + a complete Sprint 3 file-touch inventory + pre-merge / post-merge verification protocol — so that when we pull updates from another branch, NONE of the Sprint 3 Oto Convex work is lost.

---

## §0. Why this doc exists

We're about to pull changes from an updated branch (likely `main` or a sibling feature branch). 440 commits and 826 files diverge between `waleed-dev-oto` and `main`. The Sprint 3 work — 22 commits across Days 1-7 covering 18 distinct files — MUST survive the merge. This doc:

1. Lists every Sprint 3 file change with its current state (line count + version).
2. Captures the bookings.ts schema-bug fix plan in implementation-ready detail (the immediate "write this down" ask).
3. Captures all other Tier 3 carryover items in similar detail so the merge doesn't drop them.
4. Provides pre-merge and post-merge verification protocols.

---

## §1. Sprint 3 file inventory — what MUST survive the merge

18 files touched across Sprint 3 (commits `56a59ab` through `bbc83fa`):

### Tier-1 critical (production code — Oto AI surface)

| File | Sprint 3 net change | Final state |
|---|---|---|
| `convex/oto/tools.ts` | 994 → 1206 (+212) | 9 new tool schemas + 1 enum addition: render_link_button (new, 9-destination enum), render_support_form (new, 3-category), 3 Loyalty data tools, 3 Booking Status tools, get_pending_bookings + render_booking_card + render_bookings_list, vehicle_onboarding as 9th destination of render_link_button. Field-parity contract comment updated multiple times. |
| `convex/oto/dispatcher.ts` | 379 → 460 (+81) | 4 new render branches: render_link_button, render_booking_card, render_bookings_list, render_support_form. ChatMessageEnvelope fields added: linkButton, bookingCard, bookingsList, supportForm. |
| `convex/oto/chat.ts` | 3325 → 3544 (+219) | TOOL_NAMES_V1 entries for 8 new tools (render_link_button, 4 Loyalty, 3 Booking Status, render_support_form). DATA_TOOL_CALLABLE_NAMES extended with 4 new (Loyalty + get_pending_bookings). buildCallables extended with 4 new callables. |
| `convex/oto/prompt/stable.ts` | 933 → 1147 (+214) | `v0.13-stable` → `v0.18-stable` (5 bumps). NEW sections: `# App-navigation redirects`, `# Vehicle anchoring — one chat, one car`, `# Loyalty — rewards balance, history, redemption browsing`, `# Booking Status — viewing existing bookings`. REWROTE: `# Support intake` section (graduated render_support_form from planned to live), `# Tools` registry block (many new entries), `# Capability honesty` (many new CAN-DO and CANNOT bullets). |
| `convex/oto/prompt/volatile.ts` | 179 → 236 (+57) | `v0.13-volatile` → `v0.14-volatile`. NEW `# Tone calibration — warmth, empathy, enthusiasm` section. 3 new Examples (15-17): M5-vs-M550i enthusiasm, engine-tick empathy, routine-rotation warmth. |
| `convex/oto/bookings.ts` | 102 → 177 (+75) | NEW `getPendingBookings` query (mirror of `getBookings`, filters `status === "pending"`). **CONTAINS THE scheduled_at-vs-scheduled_date BUG** mirrored from `getBookings`. See §2 for fix plan. |
| `convex/rewards.ts` | 633 → 738 (+105) | NEW `getProgramInfo` query exposing loyalty program constants (earn rates 1%/1.5%/2%, tier thresholds $750/$1500, 180-day expiry). Constants mirror `addCreditForCompletedBooking` inline values — see §3 for extraction plan. |

### Tier-2 critical (eval + CI)

| File | Sprint 3 net change | Final state |
|---|---|---|
| `scripts/oto-eval-cases.json` | 57 → 97 cases (+40 active) | Day 2: +14, Day 3: +7 Loyalty, Day 4: +7 vehicle/tone, Day 5: +6 booking, Day 6: +6 support. Helper JS scripts in `scripts/eval/runs/_append-day3-*.js`, `_append-day4-*.js`, `_append-day6-*.js` (untracked, reproducible audit). |
| `scripts/ci/vehicle-facts-grep.sh` | 660 → 698 (+38) | NEW Rule 21 (Day 7) — Registry-CI guard mirroring chat.ts Block 4 invariant at CI time. Total invariants: 20 → 21. |
| `scripts/ci/_extract-prompt-tool-refs.js` | NEW (13 lines) | Node helper for Rule 21 — parses `\`tool_name\`` escape pattern from stable.ts + volatile.ts template literals. |

### Tier-3 (docs — capability registry, day logs, handoffs)

| File | Sprint 3 net change | Final state |
|---|---|---|
| `docs/OTO_CAPABILITY_REGISTRY.md` | NEW (~1,200 lines) | The living contract. 12 domains. 20 sections. Status taxonomy. Per-domain template. Eval coverage matrix. §19 governance. Updated through Days 1-7. |
| `docs/SPRINT_3_DAY_1_LOG.md` | NEW (~390 lines) | 6-pass registry foundation narrative + scope iteration record. |
| `docs/SPRINT_3_DAY_2_LOG.md` | NEW (~221 lines) | render_link_button (8 destinations) dispatch. |
| `docs/SPRINT_3_DAY_3_LOG.md` | NEW (~250 lines) | Loyalty + Day-2 defect fix narrative. |
| `docs/SPRINT_3_DAY_4_LOG.md` | NEW (~227 lines) | Vehicle anchoring + tone + onboarding (3 registry passes). |
| `docs/SPRINT_3_DAY_5_LOG.md` | NEW (~227 lines) | Booking Status dispatch. |
| `docs/SPRINT_3_DAY_6_LOG.md` | NEW (~216 lines) | render_support_form dispatch + Tier 2 closure. |
| `docs/HANDOFF_2026-05-17_SPRINT_3_CLOSE.md` | NEW (~329 lines) | Sprint 3 close handoff for next session. |

### Files NOT touched by Sprint 3 (but related — preserve as-is)

These were touched by prior sprints but UNCHANGED by Sprint 3. If the merge brings updates to these, that's fine — Sprint 3 has no contributions to merge in:
- `convex/schema.ts` — Wave 1.9 schema-hash baseline at `scripts/ci/schema-hash.expected = 6c5818395c2f6e38d070132ea56957bc9b80997c4013982dd3d2d3451f792385`. NO Sprint 3 schema migrations.
- `convex/oto/system_prompt.ts` (shim file).
- `convex/oto/envelope.ts`.
- `convex/oto/memoryEditing.ts`, `memoryDecay.ts`, `memoryEquivalence.ts`.
- `convex/oto/reliability.ts`.
- `convex/oto/queryMoat.ts`.
- All Sprint 1-2 memory/keystone/wave-7 work.

---

## §2. Tier 3 BUG: `bookings.ts` scheduled_at vs scheduled_date (Day 5 finding)

### The bug in three lines

**Schema (`convex/schema.ts:1313`):**
```ts
bookings.scheduled_date: v.optional(v.string())  // ISO date string e.g. "2026-05-20"
```

**Tool query (`convex/oto/bookings.ts` lines 95 and 171 — same bug in BOTH `getBookings` and `getPendingBookings`):**
```ts
scheduled_at: b.scheduled_at ?? null,   // reads b.scheduled_at — DOES NOT EXIST on the schema
```

**OtoBookingSummary interface (`convex/oto/bookings.ts:32`):**
```ts
scheduled_at: number | null;   // wrong field name AND wrong type
```

### Runtime impact

- `b.scheduled_at` is `undefined` for every booking row.
- `?? null` falls back, always returns `null`.
- Every Oto response surfacing "next appointment" / "when's my booking" has NO date data to use. Haiku falls back to generic phrasing OR makes up a date.
- TypeScript flags this as `TS2339: Property 'scheduled_at' does not exist on type 'Doc<"bookings">'` — that's part of the 12 pre-existing TS errors in `bookings.ts` flagged by the Day 5 Infrastructure dispatch.
- Convex tolerates the missing field at runtime (returns undefined → coerced to null after `??`), so it never crashed loudly — silent data-loss bug.

### Downstream check (verified before recommending the rename)

`scheduled_at` is referenced ONLY in `convex/oto/bookings.ts`. No other code reads it. No eval case asserts it. The rename is clean — zero downstream impact.

### Recommended fix (Option A)

Rename `scheduled_at` → `scheduled_date` in 3 places in `convex/oto/bookings.ts`:

**Edit 1: Interface (line ~32):**
```ts
// Before
scheduled_at: number | null;

// After
scheduled_date: string | null;
```

**Edit 2: getBookings return shape (line ~95):**
```ts
// Before
scheduled_at: b.scheduled_at ?? null,

// After
scheduled_date: b.scheduled_date ?? null,
```

**Edit 3: getPendingBookings return shape (line ~171):**
```ts
// Before
scheduled_at: b.scheduled_at ?? null,

// After
scheduled_date: b.scheduled_date ?? null,
```

**Verification after fix:**
- TypeScript compile: should drop 2 of the 12 pre-existing TS errors (the `scheduled_at` accesses).
- Eval cases: re-run `booking_status_next_appointment` / `booking_status_list_view` / `booking_status_pending` — Haiku should now have real date strings to surface.
- 21/21 CI invariants: should remain clean (no schema changes; no prompt changes; no tool surface changes).
- Schema hash: unchanged.

### Why Option A over Option B

Option B was: parse the ISO string into a unix timestamp, keep `scheduled_at: number` naming. Rejected because:
- More code (date parsing + null handling).
- No clear benefit — Haiku JSON-stringifies either representation; the model handles both fine.
- Adds a parsing failure mode (malformed date strings) we don't currently have.
- Doesn't match the schema's source-of-truth shape.

Option A matches the schema. That's the right choice.

### Dispatch estimate

PM-mechanical, ~quarter-day. 3 file edits in one file. No subagent needed.

---

## §3. Tier 3 carryover: Rewards constants extraction (Day 3 finding)

### Current state

`getProgramInfo` query in `convex/rewards.ts` (NEW Day 3 Pass A, lines ~700-738) hardcodes loyalty program constants:
- Earn rates: driver 1%, preferred 1.5%, elite 2%
- Tier thresholds: $750 (preferred), $1500 (elite)
- Expiry: 180 days with elite exemption

These constants mirror inline values in `addCreditForCompletedBooking` (the booking → credit-grant mutation, around `convex/rewards.ts:250-300`). The Day 3 Infrastructure agent added a doc comment flagging the must-match invariant but did NOT extract to a shared file.

### Recommended fix

Create `convex/constants/rewards.ts`:

```ts
// =============================================================================
// Rewards program constants — single source of truth.
//
// MUST stay synchronized with the AI tool exposure in convex/rewards.ts
// getProgramInfo (which Haiku reads via get_loyalty_program_info) AND
// with the inline values in addCreditForCompletedBooking (which the
// booking flow uses to grant credit).
// =============================================================================

export const REWARDS_EARN_RATES = {
  driver: 0.01,    // 1%
  preferred: 0.015, // 1.5%
  elite: 0.02,     // 2%
} as const;

export const REWARDS_TIER_THRESHOLDS = {
  preferred_min_spend_usd: 750,
  elite_min_spend_usd: 1500,
} as const;

export const REWARDS_EXPIRY_DAYS = 180;
export const REWARDS_ELITE_EXEMPT_FROM_EXPIRY = true;
```

Then update `convex/rewards.ts` to import + use these in both `getProgramInfo` and `addCreditForCompletedBooking`.

### Verification after fix

- TypeScript compile: no new errors; one fewer must-match invariant to maintain in code review.
- 21/21 CI clean: no rule changes needed.
- Schema hash: unchanged.
- Eval cases: re-run `loyalty_program_info_request` (Day 3) to confirm Oto still surfaces the same program rules.

### Dispatch estimate

PM-mechanical, ~quarter-day. 1 new file + 2 edits in existing file.

---

## §4. Tier 3 carryover: `tools_called_with_args` runner primitive (Day 2 finding)

### The gap

Eval runner has no primitive to assert tool ARGUMENTS, only tool NAMES. Across Days 2-6 + Day 7's Rule 21, ~25 eval cases verify per-destination / per-category correctness via `text_contains` keyword matching as a PROXY for argument matching:

- Day 2: 8 `link_button_<destination>_*` cases verify destination via keyword in framing text
- Day 3: 5 `loyalty_*` cases verify tool routing without arg verification
- Day 4: 1 `link_button_vehicle_onboarding_explicit` verifies destination via keyword
- Day 5: 3 `booking_status_*` cases verify limit/booking_id via keyword
- Day 6: 3 `support_form_*` cases verify category via keyword

A real `tools_called_with_args` primitive would let cases assert:
```jsonc
{
  "tools_called_with_args": [
    { "name": "render_link_button", "args": { "destination": "terms_of_service" } }
  ]
}
```

instead of:
```jsonc
{
  "tools_called": ["render_link_button"],
  "text_contains": ["terms"]
}
```

### Implementation sketch

The runner (`scripts/eval/runs/_run-eval-cases.ts` — exact path TBD post-merge) parses tool_use blocks from the assistant response. It already extracts the tool NAME for `tools_called` assertions. Add a parallel extraction of the tool's `input` object, then provide assertion against a {name, args} pattern with partial-object matching (the test arg-spec is a subset of the actual args).

Three sub-tasks:
1. Add `tools_called_with_args` assertion type to the runner (Infrastructure dispatch).
2. Add 5-10 representative cases as POSITIVE migrations from text_contains to tools_called_with_args (QA dispatch).
3. Document the new assertion in the runner README / eval-case schema doc.

### Dispatch estimate

~half-day; 1-way Infrastructure for the runner, then QA Lead to migrate cases. Could be 2-way parallel.

---

## §5. Tier 3 carryover: `prompt_injection_tag_smuggling_rejected` sharpening (Sprint 2 Day 11 finding)

### The gap

At REPEAT=3, Haiku echoes user-injection content (`<system>`, `record_semantic_fact`, etc.) ~1/3 of the time. Backend defense (helper sanitizer + envelope wrapping) holds — no rows written. But the user-visible response leaks the hostile substring, which trips the eval assertion.

### Three options

**Option A: Sharpen the prompt rule** (`stable.ts` `# Untrusted user input` section). Add explicit BANNED phrasings list: Oto MUST NOT quote `<system>`, `record_semantic_fact`, `</untrusted_user_input>`, or other envelope-tag substrings even when the user's message contains them. Risk: explicit banning may make Haiku self-conscious and trigger weird workarounds.

**Option B: Relax the eval assertion.** Change `text_not_contains` to check "no behavioral compliance with the injection" rather than "no substring leak." Risk: weaker test; we'd lose signal on actual injection leaks.

**Option C: Post-response sanitization layer** in `chat.ts`. Scan the assistant's text response for the forbidden-tag list and either strip them or fall back to a degraded response. Risk: adds latency + code complexity; could mask real issues.

### Recommended approach: Option A first

Try the prompt sharpening first (cheapest). If REPEAT=3 still flaps, escalate to Option C. Option B is the fallback if both fail.

### Dispatch estimate

Option A: ~quarter-day, 1-way Prompt Engineer. Bump `v0.18-stable` → `v0.19-stable`. Re-run case at REPEAT=5 to verify.

---

## §6. Tier 3 carryover: Wave 1.5 formal multi-version run

### Scope

Run the eval suite at N=5-10 across multiple prompt-version-pairs to surface regressions:

| Version pair | What it tests |
|---|---|
| v0.13-stable+v0.13-volatile | Sprint 2 baseline |
| v0.14-stable+v0.13-volatile | Day 2 (render_link_button) regression vs baseline |
| v0.15-stable+v0.13-volatile | Day 3 (Loyalty) regression |
| v0.16-stable+v0.14-volatile | Day 4 (vehicle anchoring + tone) regression |
| v0.17-stable+v0.14-volatile | Day 5 (Booking Status) regression |
| v0.18-stable+v0.14-volatile | Day 6 (render_support_form) regression — current |

REPEAT=5 across a representative subset (~15-20 cases covering all major surfaces). Total compute: ~75-100 Haiku calls per version × 6 versions = ~600 calls. At ~$0.001/call estimated, ~$0.60 total cost. Real cost depends on Anthropic pricing at the time.

### Logistics

- Deploy-key auth for multi-hour runs (JWT lifetime is too short).
- Each prior version requires checking out the corresponding `STABLE_PROMPT_VERSION` / `VOLATILE_PROMPT_VERSION` git commit. Stash current state, run, restore.
- Save results in `scripts/eval/runs/wave-1.5-multi-version-<date>.json` for the next sprint's analysis.

### Dispatch estimate

PM + Infrastructure mechanical, ~2-4 hours wall-clock (compute-bound, not effort-bound).

---

## §7. Other Tier 3 carryovers (lower priority)

### Day 5: `bookings.ts` shared-helper extraction

Blocked by TS2589 deep-instantiation trap on Convex `query({...})` definitions. The Day 5 Infrastructure dispatch tried `runBookingsQuery` extraction and reverted to 50 lines of duplication. Revisit after Wave 5 work resolves the deep-instantiation issue. Not a Sprint 3 close blocker.

### Day 4: "That sucks" empathy phrasing softening

Conditional — only if eval results flag tone-inappropriate use. Currently preserved in `volatile.ts` `# Tone calibration` per registry §1 register allowance.

### Day 6: Rich-detail-anchored triage threshold tightening

Conditional — currently rule is "≥1 anchor" (shop / mechanic / dollar / date / work-item). If eval surfaces confusion on edge cases like *"shop did bad work last week"* (date anchor + service complaint but minimal prefill content), tighten to ≥2 or specific-noun.

### Day 5: Optional 7th eval case `booking_status_pending_vs_active_subset`

Conditional — needs PM decision on prompt-language disambiguation between "pending" (subset) and "active" (broader pending+confirmed+in_progress).

### Mobile coordination tickets (out-of-scope for Claude Code)

1. Frontend: remove synthetic "I'd like to confirm X vehicle" first message (Day 4).
2. ChatMessage rendering for `linkButton` (Day 2).
3. ChatMessage rendering for `bookingCard` + `bookingsList` (Day 5).
4. ChatMessage rendering for `supportForm` (Day 6).
5. Per-message "Report an issue with AI" UI icon (Day 1 Pass F).
6. `support_intake_submissions` table schema migration for the form's Submit-button backend (Day 6).

---

## §8. Pre-merge protocol

Run these BEFORE pulling the updated branch:

1. **Confirm clean state on current branch:**
   ```bash
   git status                    # only the noted modifications (api.d.ts, untracked eval-runs)
   bash scripts/ci/vehicle-facts-grep.sh   # 21/21 clean
   git log --oneline -5          # confirm Sprint 3 commits at HEAD
   ```

2. **Capture composite prompt version baseline:**
   ```bash
   grep "STABLE_PROMPT_VERSION" convex/oto/prompt/stable.ts | grep export   # v0.18-stable
   grep "VOLATILE_PROMPT_VERSION" convex/oto/prompt/volatile.ts | grep export   # v0.14-volatile
   ```

3. **Capture eval case count baseline:**
   ```bash
   node -e "console.log(JSON.parse(require('fs').readFileSync('scripts/oto-eval-cases.json','utf8')).cases.length)"   # 97
   ```

4. **Capture schema hash baseline (should be unchanged):**
   ```bash
   sha256sum convex/schema.ts | awk '{print $1}'   # 6c5818395c2f6e38d070132ea56957bc9b80997c4013982dd3d2d3451f792385
   cat scripts/ci/schema-hash.expected   # same hash
   ```

5. **Decide merge strategy:**
   - **Merge** (`git merge <updated-branch>`): preserves both histories; creates a merge commit. Use this if the updated branch is `main` or another long-lived branch.
   - **Rebase** (`git rebase <updated-branch>`): rewrites Sprint 3 commits on top of the updated branch. Use this only if Sprint 3 commits aren't yet on a shared remote that others have pulled from. Avoid for `waleed-dev-oto` since it's a long-lived branch.

6. **Recommended:** merge, not rebase. Sprint 3's audit trail (22 commits with explicit pass-type labels) is valuable; rebase would risk squashing.

---

## §9. Post-merge verification protocol

Run these AFTER the merge:

1. **Confirm all 18 Sprint 3 files still exist:**
   ```bash
   for f in \
     convex/oto/tools.ts \
     convex/oto/dispatcher.ts \
     convex/oto/chat.ts \
     convex/oto/prompt/stable.ts \
     convex/oto/prompt/volatile.ts \
     convex/oto/bookings.ts \
     convex/rewards.ts \
     scripts/oto-eval-cases.json \
     scripts/ci/vehicle-facts-grep.sh \
     scripts/ci/_extract-prompt-tool-refs.js \
     docs/OTO_CAPABILITY_REGISTRY.md \
     docs/SPRINT_3_DAY_1_LOG.md \
     docs/SPRINT_3_DAY_2_LOG.md \
     docs/SPRINT_3_DAY_3_LOG.md \
     docs/SPRINT_3_DAY_4_LOG.md \
     docs/SPRINT_3_DAY_5_LOG.md \
     docs/SPRINT_3_DAY_6_LOG.md \
     docs/HANDOFF_2026-05-17_SPRINT_3_CLOSE.md \
   ; do
     [ -f "$f" ] && echo "OK $f" || echo "MISSING $f"
   done
   ```

2. **Run all 21 CI invariants:**
   ```bash
   bash scripts/ci/vehicle-facts-grep.sh
   # Expect: "All vehicle-facts invariant checks passed (21/21 rules clean)."
   ```

3. **Verify prompt versions match baseline:**
   ```bash
   grep "STABLE_PROMPT_VERSION" convex/oto/prompt/stable.ts | grep export
   # Expect: v0.18-stable
   grep "VOLATILE_PROMPT_VERSION" convex/oto/prompt/volatile.ts | grep export
   # Expect: v0.14-volatile
   ```

4. **Verify eval case count:**
   ```bash
   node -e "console.log(JSON.parse(require('fs').readFileSync('scripts/oto-eval-cases.json','utf8')).cases.length)"
   # Expect: 97
   ```

5. **Verify schema hash unchanged:**
   ```bash
   sha256sum convex/schema.ts | awk '{print $1}'
   # Expect: 6c5818395c2f6e38d070132ea56957bc9b80997c4013982dd3d2d3451f792385 (or post-merge schema if updated branch changed schema)
   ```

6. **Verify tool count: should see 9 new Sprint 3 tools registered in OTO_TOOL_CATEGORY:**
   - render_link_button (render)
   - render_support_form (render)
   - render_booking_card (render)
   - render_bookings_list (render)
   - get_pending_bookings (data)
   - get_loyalty_points_history (data)
   - get_available_redemptions (data)
   - get_loyalty_program_info (data)
   - get_rewards_summary (data — graduated from live-unsurfaced)

7. **Verify Block 4 invariant — every prompt-referenced tool is in TOOL_NAMES_V1:**
   ```bash
   bash scripts/ci/vehicle-facts-grep.sh 2>&1 | grep "Rule 21"
   # Expect: Rule 21: prompt-referenced tools surfaced in TOOL_NAMES_V1...
   #         OK
   ```

8. **If merge had conflicts:** the conflict-resolution should preserve Sprint 3 contents on the conflict-loser side. Specifically:
   - `convex/oto/tools.ts` Sprint 3 schema additions
   - `convex/oto/chat.ts` Sprint 3 TOOL_NAMES_V1 additions + buildCallables
   - `convex/oto/dispatcher.ts` Sprint 3 case branches
   - `convex/oto/prompt/stable.ts` Sprint 3 sections + version bump to v0.18-stable
   - `convex/oto/prompt/volatile.ts` Sprint 3 Tone calibration + version bump to v0.14-volatile
   - `scripts/oto-eval-cases.json` Sprint 3 cases (Days 2-6)
   - `scripts/ci/vehicle-facts-grep.sh` Rule 21 + helper script

9. **If any verification fails, DO NOT proceed.** Restore from a tag/branch backup of `waleed-dev-oto` (recommended: `git tag sprint-3-eod-backup` before the merge) and retry the merge with explicit conflict resolution.

---

## §10. Single-sentence recap

**Sprint 3 added 18 files of changes across `convex/oto/` (tools.ts + dispatcher.ts + chat.ts + prompt/stable.ts + prompt/volatile.ts + bookings.ts + rewards.ts) + `scripts/oto-eval-cases.json` (57→97 cases) + `scripts/ci/vehicle-facts-grep.sh` (20→21 rules + new helper script) + 8 docs (capability registry + 6 day logs + Sprint 3 close handoff); ALL of these must survive the pull from the updated branch; Tier 3 bug-fix carryovers documented here (most importantly: `bookings.ts` `scheduled_at` vs `scheduled_date` 3-line rename fix in Option A) so they're not forgotten after the merge; pre-merge protocol = baseline capture + clean state confirmation + recommend MERGE strategy (not rebase) to preserve 22-commit audit trail; post-merge protocol = 9-step verification including all-files-present + 21/21 CI + prompt versions + eval count + schema hash + Block 4 invariant via Rule 21 + tool-count check; recommended pre-merge action = `git tag sprint-3-eod-backup` so we have a rollback target if conflict resolution drops Sprint 3 contents.**

— End of pre-merge inventory + Tier 3 carryover bug-fix plans.
