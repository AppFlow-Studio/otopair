# Sprint 3 Day 3 — Loyalty in-chat surface (4 tools live; no claim flow)

**Date:** 2026-05-17 (Sprint 3 Day 3 — logical work-day demarcation: Day 1 = registry foundation across 6 passes, Day 2 = render_link_button lands, Day 3 = Loyalty lands + Day 2 defect fix)
**Authority:** `docs/OTO_CAPABILITY_REGISTRY.md` §11 + §14.2 (Loyalty contract — in-chat informational surface; no claim flow per Day 1 Pass F).
**Owner:** PM orchestrator (defect fix + dispatch + verify + commit + log) + 3 subagent dispatches in surface-partitioned parallel.

---

## 0. Day 3 in one sentence

**Sprint 3 Day 3 lands the second Tier 2 feature surface — Loyalty in-chat — with 4 Loyalty data tools live (3 new + `get_rewards_summary` graduated from `live-unsurfaced` to `live`) and the load-bearing no-claim-flow constraint enforced via prompt + eval; the day opens with a defect-fix Pass A0 (commit `a0248d7`) catching a Day 2 Infrastructure miss where `render_link_button` was registered in `tools.ts` + `dispatcher.ts` but NOT added to `TOOL_NAMES_V1` in `chat.ts` — the Block 4 module-load invariant would have logged CONFIG ERROR at Convex startup because the prompt referenced a tool that wasn't surfaced to Haiku — caught by Day 3 pre-flight inventory; Pass A (commit `f65f42e`) is the substantive Loyalty dispatch across 3 surface-partitioned parallel subagents — Infrastructure registered 3 new data tools + the `get_rewards_summary` graduation across 4 file surfaces (`convex/oto/tools.ts` +53 with schemas + OTO_TOOL_CATEGORY entries, `convex/oto/chat.ts` +186 with TOOL_NAMES_V1 sub-group + DATA_TOOL_CALLABLE_NAMES drift-check + 4 buildCallables entries, `convex/rewards.ts` +105 with the new `getProgramInfo` query exposing earn-rate / tier-threshold / expiry constants mirroring `addCreditForCompletedBooking` inline values), Prompt Engineer added a new `# Loyalty — rewards balance, history, redemption browsing` section to `convex/oto/prompt/stable.ts` (+56 lines, lines 970-1011 in the domain-rules cluster) with discrimination rules per user intent + load-bearing no-claim-flow constraint + screen-pointer pattern + a "This is not a refusal" framing paragraph to head off Haiku going apology-cold + 5 illustrative MUST-NOTs + Capability honesty graduation (4 CAN-DO bullets + 1 CANNOT bullet) + `STABLE_PROMPT_VERSION` v0.14-stable → v0.15-stable (composite v0.15-stable+v0.13-volatile), QA Lead appended 7 new active eval cases (4 tool-routing positives + 2 no-claim-flow cases + 1 discrimination case) for total 78 cases (70 active + 8 disabled) with the 71 pre-existing cases byte-identical at SHA-256 `2606910c…`; commits `a0248d7` (Pass A0 surgical defect fix) + `f65f42e` (Pass A Loyalty dispatch + registry status updates §11/§14.2/§16) + this log (Pass C); 20/20 CI invariants clean throughout; schema hash unchanged; tool live count 32 → 36; Sprint 3 Tier 2 is now 2/4 done — `render_link_button` + Loyalty live, Booking Status (§14.3) + `render_support_form` 3-category dispatch (§13) remaining.**

---

## 1. Methodology — Day 3 timeline

Four passes (Pass A0 surgical defect fix + Pass A 3-way parallel feature dispatch + Pass B verify+commit + Pass C log):

| # | Pass | Owner | Surface | Type |
|---|---|---|---|---|
| A0 | Fix Day 2 defect — render_link_button → TOOL_NAMES_V1 | PM (mechanical) | `convex/oto/chat.ts` (1-line addition) | Defect fix |
| A | Loyalty dispatch (3-way parallel) | 3 subagents — Infrastructure + Prompt Engineer + QA Lead | `convex/oto/tools.ts` + `convex/oto/chat.ts` + `convex/rewards.ts` + `convex/oto/prompt/stable.ts` + `scripts/oto-eval-cases.json` + `docs/OTO_CAPABILITY_REGISTRY.md` | Substantive feature dispatch |
| B | Verify + commit | PM (mechanical) | git commits `a0248d7` + `f65f42e` | PM |
| C | Day 3 log | PM | `docs/SPRINT_3_DAY_3_LOG.md` (this file) | PM |

### 1.1 Pass A0 — the Day 2 defect that pre-flight inventory caught

Day 3 began with a pre-flight inventory of the chat.ts surface (`grep -n "rewards_summary\|loyalty\|redemption" convex/oto/chat.ts`) to understand the Loyalty wiring patterns before drafting the Infrastructure dispatch. The inventory surfaced two findings:

1. `get_rewards_summary` is NOT in `TOOL_NAMES_V1` (lines 84-115 in chat.ts) — confirms its `live-unsurfaced` status per the registry. Expected.
2. **`render_link_button` is ALSO NOT in `TOOL_NAMES_V1`** — UNEXPECTED. Day 2 Pass A landed the tool schema in `tools.ts` and the dispatcher branch in `dispatcher.ts`, but never added the tool name to `TOOL_NAMES_V1`. Without that entry, the tool is filtered out at line 132 (`TOOLS_FOR_HAIKU = OTO_TOOLS.filter((t) => (TOOL_NAMES_V1 as readonly string[]).includes(t.name))`) and Haiku never sees it.

Root cause analysis: the Day 2 Infrastructure brief said *"DO NOT touch `convex/oto/chat.ts` — render tools don't have callables."* That was wrong on two counts:

- TRUE: render tools don't need callables (the dispatcher handles them in `packageRenderDirective`).
- MISSED: render tools DO need TOOL_NAMES_V1 entries (the filter at line 132 applies to ALL tool categories).

The Block 4 invariant at lines 198-216 would have caught this at Convex module load — it scans the system prompt for backtick-wrapped tool references and logs CONFIG ERROR if any are missing from TOOL_NAMES_V1. The prompt (`v0.14-stable`) references `render_link_button`, but TOOL_NAMES_V1 didn't include it.

Pass A0 fix: surgical 4-line addition in `chat.ts:TOOL_NAMES_V1` (with a brief comment marking it as Sprint 3 Day 2 §14.1). Commit `a0248d7`. 20/20 CI green; brace-balance delta=0.

**Methodology lesson promoted to a new entry in Day-2 carryover:** the dispatch brief must enumerate ALL four surface requirements per tool category — for render tools that's schema + category + TOOL_NAMES_V1 + dispatcher branch (NO callable). Same for state + data + navigation with their respective surface lists. The next dispatch brief (Day 3 Pass A Infrastructure) included the full enumeration.

### 1.2 Pass A — Loyalty 3-way parallel dispatch

Surface partitioning (mirroring Day 2 pattern):

| Subagent | Owns (writes) | Reads but forbidden to write |
|---|---|---|
| Infrastructure | `convex/oto/tools.ts` + `convex/oto/chat.ts` + `convex/rewards.ts` | prompt/, scripts/, schema.ts |
| Prompt Engineer | `convex/oto/prompt/stable.ts` | tools.ts, chat.ts, rewards.ts, scripts/ |
| QA Lead | `scripts/oto-eval-cases.json` | tools.ts, chat.ts, prompt/, rewards.ts |

The contract was registry §11 + §14.2. All three subagents operated against it independently. No cross-talk needed because Day 1's registry foundation codified scope.

**Notable Infrastructure decisions** (under 400 words):

- `get_rewards_summary` composed 3 queries client-side (`getWallet` + `getMembershipStats` + `getPrimaryVehicleTier`) rather than adding a new aggregate query. Reasoning: `getMembershipStats` alone returns only `{milesSafe, services, shops}` — not balance or tier. Composing 3 queries is fewer Convex changes than adding a new aggregate. Tool result shape: `{credit_balance, auto_apply_to_booking, miles_safe, services_completed, shops_visited, primary_vehicle_tier}`. PM accepted.
- NEW `getProgramInfo` query added to `rewards.ts`. No existing query returns program-level constants (tier breakpoints + earn rates + expiry rules). The constants were inline-embedded in `addCreditForCompletedBooking` (driver 1%, preferred 1.5%, elite 2% earn rates; $750/$1500 thresholds; 180-day expiry with elite exemption). Infrastructure exposed them as a query with a "must-match" doc comment so future drift is caught. PM accepted. Future cleanup candidate: extract to `convex/constants/rewards.ts` so both call sites share one source.
- `get_available_redemptions` wraps `getAllDeals` + client-side category filter rather than `getSuggestedDeals` (which limits to 5). All-deals + client-side filter gives Haiku the full surface to inform from. PM accepted.

**Notable Prompt Engineer decisions** (under 400 words):

- Section placement at lines 970-1011 — domain-rules cluster between `# Service History` (ends line 968) and `# General car knowledge` (starts line 1013). Other adjacent sections: `# Vehicle Health & Service-Due` (933), `# Loyalty` (970). Clean placement.
- Added a "This is not a refusal" framing paragraph at line 999. Preempts the failure mode where Haiku reads the no-claim constraint as "I can't help" and goes apology-cold. PM accepted.
- Pointer pattern: kept the registry canonical *"You can pick one to claim from the Loyalty screen in your account"* and explicitly listed 2 natural-tone alternatives in the prompt (`"That gets done from the Loyalty screen in your account — pick the one you want and confirm it there"` / `"Heading over to your Loyalty screen is the move; that's where the actual claim happens."`). Haiku has register-flexibility. PM accepted.
- Tool registry placement in `# Tools` block: data-tool cluster after `get_due_services` rather than KB cluster. Sensible.

**Notable QA Lead decisions** (under 400 words):

- Claim-promise ban list in `text_not_contains`: `I'll redeem` / `I will redeem` / `I'll claim` / `I will claim` / `I'll set up` / `let me redeem` / `let me claim` + perfect-tense leak words `done` / `completed` / `applied`. Aggressive on `done` — Oto could conceivably say "...once you're done on that screen" benignly; QA accepted that as acceptable false-positive risk because the load-bearing assertion is catching false-promise leaks.
- Did NOT bar `render_quick_replies` in claim-related cases via `tools_not_called` — Oto routinely fires `render_quick_replies` for benign follow-ups; blanket ban would over-fire. Instead text-side bans cover the user-visible signal.
- For `loyalty_redeem_inquiry_describes_only` (A4): did NOT bar the other 3 Loyalty data tools in `tools_not_called`. The user asking "what can I get" could plausibly also need `get_loyalty_program_info` for context. Soft constraint.
- Added "tap to open" ban in C7 (`loyalty_not_a_redirect_destination`) — prevents redirect-style framing leakage even when the tool isn't fired.
- Same Day 2 Tier 3 carryover: runner has no `tools_called_with_args` primitive; per-tool correctness via tool-name + text-contains is acceptable for Sprint 3.

### 1.3 The Day 2 defect → Day 3 Pass A0 → Day 3 Pass A0 brief refresh feedback loop

Sprint 2's Day 8 lesson ("Static checks PASS != runtime correctness") fired on Day 3. The Day 2 commit had 20/20 CI green + brace-balance delta=0 + 0 TS errors on touched files — all static checks passed. The runtime defect (Block 4 invariant failure at Convex module load) was silent in the static-check regime; it would have surfaced only when the prompt section started referencing the un-wired tool in a real chat session.

What worked:
- Pre-flight inventory before drafting Day 3's Infrastructure brief
- The Block 4 invariant exists in the codebase precisely for this drift class (chat.ts:198-216 documents the failure mode it catches)

What needs strengthening:
- Day 3's Infrastructure brief enumerates ALL surface requirements per tool category, not just the most-visible 2
- A future CI guard (Sprint 3 Tier 3) could lint that every tool in `OTO_TOOLS` appears in `TOOL_NAMES_V1` — explicit instead of relying on the Block 4 runtime invariant which only fires when chat.ts is loaded

### 1.4 The TOOL_NAMES_V1 / DATA_TOOL_CALLABLE_NAMES drift-check pattern

Day 3 Pass A's Infrastructure brief made the full surface enumeration explicit. Result: every new Loyalty tool name appears in BOTH `TOOL_NAMES_V1` AND `DATA_TOOL_CALLABLE_NAMES` (the Block 4 drift-check set). The invariant runs at module load and would log if either was missed.

Future surface additions should follow the same explicit enumeration. Adding to the dispatch brief template:

- **Data tools** need: schema (tools.ts) + category (OTO_TOOL_CATEGORY) + TOOL_NAMES_V1 entry + DATA_TOOL_CALLABLE_NAMES entry + callable in buildCallables
- **State tools** need: schema + category + TOOL_NAMES_V1 entry + STATE_TOOL_CALLABLE_NAMES entry + callable in buildCallables
- **Render tools** need: schema + category + TOOL_NAMES_V1 entry + dispatcher case branch (NO callable)
- **Navigation tools** need: schema + category + TOOL_NAMES_V1 entry + dispatcher navigation handling (NO callable)

---

## 2. What landed (Pass A0 + Pass A)

### 2.1 Pass A0 — defect fix (commit `a0248d7`)

`convex/oto/chat.ts` — 4-line addition to `TOOL_NAMES_V1`:

```typescript
// Render tools — app-navigation redirects (§14.1, Sprint 3 Day 2 Pass A).
// 8-destination enum; terminal render; dispatcher packages into
// ChatMessage.linkButton.
"render_link_button",
```

Closes the Day 2 defect. 20/20 CI green; brace-balance delta=0.

### 2.2 Pass A — Loyalty dispatch (commit `f65f42e`)

#### `convex/oto/tools.ts` (+53 lines)

- 3 new data-tool schemas in DATA_TOOLS array: `get_loyalty_points_history`, `get_available_redemptions`, `get_loyalty_program_info`.
- `get_rewards_summary` description enriched for graduation.
- 3 new entries in OTO_TOOL_CATEGORY (all `"data"`).

#### `convex/oto/chat.ts` (+186 lines)

- TOOL_NAMES_V1: new commented sub-group "Data tools — Loyalty / rewards (Sprint 3 Day 3 §11 + §14.2)" with 4 tool names (3 new + get_rewards_summary).
- DATA_TOOL_CALLABLE_NAMES drift-check set: 4 entries added (matching TOOL_NAMES_V1).
- 4 callables added in buildCallables:
  - `get_rewards_summary` → composed `Promise.all` over `api.rewards.getWallet` + `api.rewards.getMembershipStats` + `api.rewards.getPrimaryVehicleTier`
  - `get_loyalty_points_history` → `api.rewards.getCreditHistory(userId, limit)` with defensive clamp 1..20
  - `get_available_redemptions` → `Promise.all` over `api.rewards.getWallet` + `api.rewards.getAllDeals` with client-side category filter; tool result includes `claim_flow_note` reinforcing §14.2 Constraint 2
  - `get_loyalty_program_info` → `api.rewards.getProgramInfo(scope?)`

#### `convex/rewards.ts` (+105 lines)

NEW `getProgramInfo` query exposing program constants:
- Earn rates: driver 1%, preferred 1.5%, elite 2%
- Tier thresholds: $750 (preferred), $1500 (elite)
- Expiry: 180-day with elite exemption

Constants mirror those inline in `addCreditForCompletedBooking`. Doc comment flags the must-match invariant.

#### `convex/oto/prompt/stable.ts` (+56 lines, v0.14-stable → v0.15-stable)

NEW `# Loyalty — rewards balance, history, redemption browsing` section at lines 970-1011:
- 4-tool registry with per-tool description
- Discrimination rules per user intent (balance/tier → get_rewards_summary; history → get_loyalty_points_history; browsing → get_available_redemptions; program rules → get_loyalty_program_info)
- LOAD-BEARING CONSTRAINT: no claim flow in chat. When user asks to redeem, Oto acknowledges + optionally describes options + ends with the canonical conversational pointer.
- 2 natural-tone pointer alternatives provided alongside the canonical.
- "This is not a refusal" framing paragraph to head off apology-cold mode.
- Constraint reminder: Loyalty NOT in §14.1's render_link_button 8-destination enum.
- 5 illustrative MUST NOTs (no claim promise, no claim affordance, no pretend-claim, no forensic register, no chained rewards lookups).

`# Tools` registry block updated: 4 new entries (3 new tools + `get_rewards_summary`).
`# Capability honesty` updated: 4 CAN-DO bullets added (one per Loyalty tool); 1 CANNOT bullet added ("Execute a redemption claim from chat — the user picks the reward and confirms it on the Loyalty screen…").
`STABLE_PROMPT_VERSION` bumped `v0.14-stable` → `v0.15-stable`.

#### `scripts/oto-eval-cases.json` (71 → 78 cases, +7 active)

Group A — 4 tool-routing positives:
- `loyalty_balance_oneshot`
- `loyalty_history_lookup`
- `loyalty_program_info_request`
- `loyalty_redeem_inquiry_describes_only`

Group B — 2 no-claim-flow cases:
- `loyalty_redeem_request_pointer_to_screen` (asserts "Loyalty screen" pointer phrase in text)
- `loyalty_no_claim_promise` (bans 9-string ban list of false-promise phrasings)

Group C — 1 discrimination:
- `loyalty_not_a_redirect_destination` (counterpart to Day 2's `link_button_invalid_destination_rejected`)

71 pre-existing cases byte-identical (deep-sorted SHA-256 `2606910cf26b086f7a938b800572a969120a07d67321ad8332ae66ca67b074db`).

#### `docs/OTO_CAPABILITY_REGISTRY.md` (status updates)

- §11 Loyalty (basic): rewritten with LIVE status — 4-tool behavior contract + prompt rules + data sources + 7 MUST NOTs + 7 eval cases.
- §14.2 status: `planned` → **LIVE as of Sprint 3 Day 3 Pass A**.
- §16 live-tools table: `get_rewards_summary` graduated from `live-unsurfaced`; 3 new Loyalty data tools added.
- §16 planned-tools table: 3 Loyalty rows marked **live**.

---

## 3. Sprint 3 Day 3 Verification

```
CI grep:                20/20 rules clean throughout
Brace-balance:          tools.ts delta=0, chat.ts delta=0, rewards.ts delta=0
                        stable.ts open=1 close=1 delta=0 (template-literal — expected)
Schema hash:            6c5818395c2f6e38d070132ea56957bc9b80997c4013982dd3d2d3451f792385 (unchanged)
Eval JSON:              78 cases (70 active + 8 disabled — 7 new + 71 prior)
71 pre-existing cases:  byte-identical (deep-sorted SHA-256 2606910c…)
Stable prompt:          v0.15-stable
Composite prompt:       v0.15-stable+v0.13-volatile
Block 4 invariant:      passes (all 4 new tools in BOTH TOOL_NAMES_V1 AND
                        DATA_TOOL_CALLABLE_NAMES)
TypeScript:             0 errors on Day 3 touched code (5 pre-existing TS18048
                        in unrelated rewards.ts handlers line-shifted but
                        otherwise identical — NOT Day 3 work)
Files touched (Pass A): 6 (tools.ts, chat.ts, rewards.ts, stable.ts, eval JSON, registry doc)
Files touched (Pass A0): 1 (chat.ts)
Commits:                a0248d7 (Pass A0 defect fix) + f65f42e (Pass A Loyalty dispatch)
```

---

## 4. MVP capability progression (Day 2 close → Day 3 close)

| Surface | Day 2 EOD | **Day 3 EOD** | Δ |
|---|---|---|---|
| User-visible MVP capability | ~95-96% | **~96-97%** | +0.5-1% (Loyalty in-chat lands; 2/4 Tier 2 done) |
| Architectural-discipline coverage | 100% | **100%** | maintained |
| Tools live | 32 | **36** | +4 (`get_rewards_summary` graduation + 3 new Loyalty data tools) |
| Three-channel Support architecture | Channel 2 live | **Channel 2 live** (no change — Channel 1 form path next) | — |
| Loyalty domain | live-unsurfaced (snapshot only) | **fully in-chat** (4 tools + prompt section + 7 eval cases) | major bump |
| Stable prompt version | v0.14-stable | **v0.15-stable** | bumped |
| Eval cases | 71 (63 active + 8 disabled) | **78 (70 active + 8 disabled)** | +7 |
| CI invariants | 20 rules | **20 rules** | maintained |
| Day-2 defects open | 1 (TOOL_NAMES_V1 miss) | **0** (fixed Pass A0) | resolved |

---

## 5. Sprint 3 priorities — refresh post-Day-3

### Tier 2 — remaining feature surfaces

1. **Booking Status surface** (§14.3) — `get_pending_bookings` + `render_booking_card` + `render_bookings_list` + prompt section. ~half-day. Same 3-way parallel pattern. **Next dispatch.**
2. **`render_support_form` 3-category dispatch** (§13 Channel 1) — completes the three-channel Support architecture. ~half-day. May benefit from waiting on backend schema decisions (whether to add `support_intake_submissions` table or use an existing table).

### Tier 3 — Sprint 2 carryovers + Day 2/3 findings

3. **Runner primitive `tools_called_with_args`** (Day 2 finding, still open) — tightens per-tool correctness from text_contains keyword matching to actual tool-arg assertion. Small dispatch.
4. **NEW: Registry-CI guard** (Day 3 surfaces this) — lint that every tool in `OTO_TOOLS` appears in `TOOL_NAMES_V1`. Catches the Day 2 defect class explicitly instead of relying on the Block 4 runtime invariant which only fires at module load. Small dispatch; follows the Wave 1.9 schema-hash CI guard pattern.
5. **NEW: Extract rewards program constants** (Day 3 Infrastructure decision flagged) — Infrastructure added `getProgramInfo` with hardcoded constants mirroring `addCreditForCompletedBooking`. Doc comment flags the must-match invariant. Future cleanup: extract to `convex/constants/rewards.ts` so both call sites share one source. Small dispatch; low priority.
6. **`prompt_injection_tag_smuggling_rejected` sharpening** (Day 11 finding).
7. **Wave 1.5 formal multi-version run** — now at v0.15-stable; a multi-version run across v0.9 → v0.15 surfaces any regression from the v0.13 → v0.14 → v0.15 series.
8. **Volatile.ts examples for v0.14 + v0.15 rules** — Examples for the new redirect / Loyalty rules. Small Prompt Engineer dispatch when Sprint 3 stabilizes.
9. **Mobile coordination: `ChatMessage.linkButton` rendering** (Day 2) — flagged for mobile team.
10. **Mobile coordination: per-message AI-feedback icon UI** (Day 1 Pass F) — flagged for mobile team.

### Tier 4-7 — same as Sprint 2 close handoff (Wave 5 reranker v2 implementation, Wave 6 deterministic router, etc.)

---

## 6. The Day 3 one-line summary

**Sprint 3 Day 3 lands Loyalty in-chat (the second Tier 2 feature surface) across 4 file surfaces via 3-way parallel dispatching, after Pass A0 surgical defect-fix for a Day 2 Infrastructure miss (`render_link_button` was registered in tools.ts + dispatcher.ts but missed `TOOL_NAMES_V1` in chat.ts — Block 4 module-load invariant would have caught it at Convex startup; pre-flight inventory caught it before any session); 4 Loyalty data tools live as of commit `f65f42e` (`get_rewards_summary` graduated from `live-unsurfaced` to `live` via composed Promise.all over getWallet+getMembershipStats+getPrimaryVehicleTier, plus 3 new tools — `get_loyalty_points_history` wrapping getCreditHistory, `get_available_redemptions` wrapping getAllDeals+category-filter with informational-only constraint, `get_loyalty_program_info` wrapping a new `getProgramInfo` query exposing inline-constants from `addCreditForCompletedBooking`); prompt section (`# Loyalty — rewards balance, history, redemption browsing`) authored at `stable.ts` lines 970-1011 with discrimination rules + LOAD-BEARING no-claim-flow constraint + screen-pointer pattern + "This is not a refusal" framing paragraph + 5 illustrative MUST-NOTs + Capability honesty graduation + `STABLE_PROMPT_VERSION` v0.14-stable → v0.15-stable (composite v0.15-stable+v0.13-volatile); 7 new active eval cases (4 tool-routing + 2 no-claim-flow + 1 discrimination) bringing total to 78 cases with 71 pre-existing byte-identical at SHA-256 `2606910c…`; commits `a0248d7` (Pass A0 defect) + `f65f42e` (Pass A Loyalty + registry status updates §11/§14.2/§16) + this log; 20/20 CI clean throughout; Block 4 invariant passes; brace-balance delta=0 across all touched files; tool live count 32 → 36; Sprint 3 Tier 2 progress 2 of 4 done — render_link_button + Loyalty live, Booking Status (§14.3) + render_support_form 3-category dispatch (§13 Channel 1) remaining; Day 4 picks up Booking Status with the same 3-way parallel pattern.**

— End of Sprint 3 Day 3. Loyalty in-chat surface lands. Pass A0 catches the Day-2 defect class that future dispatch briefs will avoid via explicit per-category surface enumeration.
