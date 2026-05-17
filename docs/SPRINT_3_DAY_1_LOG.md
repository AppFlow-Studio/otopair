# Sprint 3 Day 1 — Capability registry foundation

**Date:** 2026-05-17 (Sprint 3 Day 1 — same calendar day as Sprint 2 Day 11 close; the registry was authored immediately after Sprint 2 sealed per Waleed's Tier 1 ask)
**Authority:** Sprint 2 close handoff (`docs/HANDOFF_2026-05-17_SPRINT_2_CLOSE.md`) Tier 1 priority — "Capability Registry FIRST, before any new feature work."
**Owner:** PM orchestrator (mechanical doc work — the registry is a project-state contract analogous to a handoff doc, sits under the PM's documented write surface).

---

## 0. Day 1 in one sentence

**Sprint 3 opens with the capability registry: PM authored `docs/OTO_CAPABILITY_REGISTRY.md` (857 lines, 20 sections — §0 usage + §1 Identity/Voice cross-cutting + §2-§13 twelve operational domains [Vehicle / Diagnostic / Booking / Memory / Trust Protocol / Safety / Security / Reliability / Retrieval / Loyalty-basic / Account / Support] + §14 planned Sprint 3 Tier 2 surfaces [render_link_button + Loyalty expansion + Booking Status] + §15 ten cross-cutting MUST NOT meta-rules + §16 full tools registry (31 live + 9 planned + 3 missing-gap) + §17 backing-tables-by-domain + §18 eval-coverage matrix across 34 case prefixes + §19 governance + §20 single-sentence contract) capturing every Oto behavior the v3 architecture currently supports, every "Oto MUST NOT" line, every tool-status mapping (live / live-unsurfaced / planned / missing-gap), and every cross-reference from prompt section to tool to backing table to eval prefix; commit `56a59ab` ships the registry standalone with 20/20 CI clean and schema-hash unchanged (no code/schema touch — pure documentation); the registry is the answer to Waleed's Sprint-2-close concern ("the system was molded through core features of this sprint and if we add more features for the app it would break") — every Sprint 3 feature dispatch starts by authoring or updating the relevant domain entry FIRST, then dispatches implementation against the codified contract.**

---

## 1. Methodology — Day 1 timeline

Three passes (Pass A authored the registry, Pass B the log, Pass C corrected §14 scope after Waleed flagged that `render_link_button` was over-scoped at 6 destinations when the actual target list is 3):

| # | Pass | Owner | Surface | Type |
|---|---|---|---|---|
| A | Capability registry foundation | PM (mechanical) | `docs/OTO_CAPABILITY_REGISTRY.md` (NEW 857 lines) | Single-source-of-truth doc |
| B | Day 1 log | PM | `docs/SPRINT_3_DAY_1_LOG.md` (this file) | PM |
| C | §14 scope correction post-Waleed review | PM (mechanical) | `docs/OTO_CAPABILITY_REGISTRY.md` (§14.1 + §14.2 + §11 + §16 + §18) | Correction |

### 1.1 Why PM-mechanical, not a subagent dispatch

The `.claude/agents/_pm-orchestrator.md` write surface lists "Handoff docs" and "Day logs" — the capability registry is a parent-doc to those (handoff docs reference the registry going forward). The content was substantively derivable from existing code/prompt/eval state by reading; no subagent has unique domain expertise the PM lacks for the documentation layer. Sprint 2 Day 11's design-doc pass was dispatched to RAG Specialist because Wave 5 reranker math is a substantive RAG mandate; the registry is methodological and PM-mechanical. If Sprint 3's Tier 2 feature dispatches turn up undocumented behavior the registry misses, the next PM pass (or domain-owning subagent) updates the doc as part of that dispatch's deliverable list.

### 1.2 The inventory ground-truth method

Before authoring, the PM inventoried the AI surface from primary sources rather than recalling memory:

- `convex/oto/tools.ts` (994 lines) — every registered tool schema + the `OTO_TOOL_CATEGORY` map
- `convex/oto/dispatcher.ts` (379 lines) — every render-directive packaging branch + navigation handling
- `convex/oto/prompt/stable.ts` (933 lines) — every "MUST NOT" / "BANNED" / hard-rule section in the cached prefix
- `convex/oto/prompt/volatile.ts` (179 lines) — Examples block (14 worked conversations)
- `convex/schema.ts` (table inventory: 109 tables) — backing data sources per domain
- `scripts/oto-eval-cases.json` (57 cases — 49 active + 8 disabled) — case-prefix distribution to map domains to eval coverage

The ground-truth method surfaced two important findings the registry needed to capture:

1. **`render_support_form` is `planned`, not `live`.** It's referenced in `stable.ts` `# Support intake`, in `stable.ts` `# Tools` section, and in `volatile.ts` Example 5, AND it's listed in the capability-honesty section as missing ("File support tickets (the support form tool isn't built yet)"). The prompt and tool surface have been honest about the gap from Sprint 1 onward — the registry codifies it.

2. **`get_rewards_summary` is `live-unsurfaced`.** The tool is registered + dispatched + wired in chat.ts callables, but `stable.ts` has no dedicated prompt section explaining when Oto should call it. Oto can technically invoke it but may underuse it. The registry flags this as a Sprint 3 candidate when Loyalty Tier 2 dispatch (§14.2) lands.

### 1.3 Domain enumeration vs Waleed's mental model

The handoff explicitly listed 12 domains Waleed enumerated during Sprint 2 close: Vehicle / Diagnostic / Booking / Memory / Trust Protocol / Safety / Security / Reliability / Retrieval / Loyalty (basic) / Account / Support. The registry preserves this enumeration exactly — no inventing new top-level domains. Cross-cutting concerns (Identity / Voice, Pricing, Service-name discipline, Capability honesty, Operational-vs-Mechanical, Legal-adjacent, Tiers, Minors, Abuse, Tool batching, Model routing) live in §1 + §15 rather than as top-level domain entries, because they apply across multiple domains and aren't user-visible surfaces in their own right.

---

## 2. What landed (Pass A)

### 2.1 `docs/OTO_CAPABILITY_REGISTRY.md` (NEW, 857 lines)

**Section structure:**

| § | Title | Length | Purpose |
|---|---|---|---|
| §0 | What this doc is + per-domain template + status taxonomy | ~60 lines | Usage guide |
| §1 | Identity / Voice (cross-cutting contract) | ~40 lines | Voice/register, no-system-narration, adaptive shaping |
| §2 | Vehicle | ~50 lines | User's car + general car knowledge + KB lookups |
| §3 | Diagnostic | ~55 lines | Symptom routing protocol, vehicle health, polite exit |
| §4 | Booking | ~70 lines | 6-stage canonical flow + payment handoff |
| §5 | Memory | ~50 lines | within-session + cross-session, retraction pair |
| §6 | Trust Protocol | ~45 lines | record_provenance + render-confirm gate |
| §7 | Safety | ~30 lines | 988 lifeline + driving safety |
| §8 | Security | ~35 lines | Untrusted-input boundary + adversarial-input defense |
| §9 | Reliability | ~30 lines | Degradation ladder + observability |
| §10 | Retrieval | ~35 lines | Cascade + Wave 5 reranker v2 design link |
| §11 | Loyalty (basic) | ~25 lines | get_rewards_summary `live-unsurfaced` |
| §12 | Account | ~30 lines | User profile + onboarding state surfaces |
| §13 | Support | ~35 lines | 5 categories, `render_support_form` `planned` |
| §14 | Planned (Sprint 3 Tier 2) | ~70 lines | render_link_button + Loyalty full + Booking Status + post-Sprint-3 |
| §15 | Cross-cutting MUST NOT | ~80 lines | 10 meta-rules spanning domains |
| §16 | Tools registry — full inventory | ~50 lines | 31 live + 9 planned + 3 missing-gap |
| §17 | Backing tables by domain | ~40 lines | Convex table → domain map |
| §18 | Eval coverage matrix | ~50 lines | 34 case prefixes → domain scorecard |
| §19 | Governance | ~25 lines | Who updates, when, planned CI integration |
| §20 | Single-sentence contract | ~10 lines | The TL;DR |

**Per-domain template** (used in §2-§13):
```
Purpose. (paragraph)
User-visible behaviors. (bulleted)
Tools. (tool_name — STATUS — what it does)
Prompt rules. (where in stable.ts / volatile.ts)
Data sources. (Convex tables)
Oto MUST NOT. (negative space)
Eval coverage. (case categories)
```

**Status taxonomy:**
- `live` — registered + dispatched + wired
- `live-unsurfaced` — registered but no prompt section guiding use
- `planned` — spec'd in prompt or referenced, not yet registered
- `missing-gap` — surface area users could expect, no tool + no prompt section

### 2.2 Domain coverage scorecard (from §18)

| Domain | Coverage | Gap |
|---|---|---|
| Identity / Voice | Adequate (5 cases) | More adaptive-shaping cases would help |
| Vehicle | Strong (8 cases) | OK |
| Diagnostic | Strong (12 cases) | OK |
| Booking | Light (1-2 cases) | Add 6-stage canonical-flow coverage in Sprint 3 |
| Memory | Strong (14 cases incl. SPEC) | Cat M cases land in Sprint 3 |
| Trust Protocol | Light (1 case) | Add gate-trigger + record-update follow-through cases |
| Safety | Adequate (3 cases) | Self-harm dedicated case is missing |
| Security | Adequate (4 cases) | tag-smuggling case unstable — Sprint 3 priority |
| Reliability | None (infrastructure level) | OK — CI Rules 18-19 cover the substrate |
| Retrieval | Spec-only (7 disabled) | Cat M cases activate when Wave 5 reranker v2 lands |
| Loyalty (basic) | None | Add when Sprint 3 §14.2 lands |
| Account | Light (2 cases) | OK for now |
| Support | None | Add when §14 `render_support_form` lands |

This scorecard is itself a Sprint 3 prioritization signal — the "Light" and "None" rows indicate where eval coverage should grow as Tier 2 features land.

### 2.3 Pass C — §14 scope correction (post-Waleed review)

Post-Pass-A Waleed reviewed §14.1 and flagged: "app redirect pattern for only loyalty + TOS and Privacy policy. Right?" The Pass A draft over-scoped the `render_link_button` destination enum to six values (`privacy_policy` / `terms_of_service` / `customer_support` / `data_policy` / `accessibility` / `report_bug`) — drawn from the handoff text "Privacy / TOS / Customer Support redirect pattern" interpreted broadly. The actual scope is three destinations: **`loyalty` / `terms_of_service` / `privacy_policy`**.

Pass C ships these tightenings (no code/schema touch, registry doc only):

1. **§14.1 enum narrowed** to `loyalty` / `terms_of_service` / `privacy_policy` only. Other static-link asks (customer support, accessibility, data policy, bug report) are NOT in scope for this tool; they route through Support intake (§13) or remain `missing-gap`.

2. **§14.1 behavioral contract rewritten** with explicit per-destination phrasings. Loyalty redirect added as the primary destination (was previously framed only as a Support / TOS / Privacy static-link surface).

3. **§14.2 (Loyalty program) downgraded** from "full surface with 4 new data tools" (`get_loyalty_points_history`, `get_available_redemptions`, `get_loyalty_program_info`, `render_redemption_card`) to "redirect-only for Sprint 3". The 4 data tools are now `deferred` in §16 (post-Sprint-3, scope-change-gated) — they only land if product later decides parts of the Loyalty experience belong in chat. Sprint 3 Loyalty work is: redirect via `render_link_button(destination: "loyalty")` + `get_rewards_summary` graduation from `live-unsurfaced` to `live` for one-shot factual asks.

4. **§11 (Loyalty basic) rewritten** to set up the discrimination rule going into Sprint 3: factual one-shot in-chat via `get_rewards_summary`; browsing / multi-step / program-explanatory redirect to the Loyalty screen. Forward-references §14.1 and §14.2 graduation.

5. **§16 planned-tools table updated** — `render_link_button` row now shows the 3-destination enum inline; 4 deferred Loyalty data tools moved to a new "Deferred-indefinitely tools (post-Sprint-3, scope-change-gated)" sub-table.

6. **§18 eval-coverage scorecard updated** — Loyalty row's "gap" line now references the three planned eval prefixes (`loyalty_balance_oneshot` + `loyalty_browse_redirect` + `loyalty_program_explain_redirect`).

**Day 1 estimate adjustment.** §14.1 + §14.2 combined Sprint 3 dispatch is now ~half-day total (Pass A's split-half-day estimates compounded to ~1 day; the redirect-only correction removes ~half-day of data-tool implementation). Sprint 3 Tier 2 net-net Day-2 estimate: render_link_button + Loyalty redirect (~half-day) → Booking Status (~half-day) → small carryovers (multi-day).

**Methodology signal.** Pass C is exactly the kind of post-publication correction the registry's §19 governance section was authored to handle. The registry is a LIVING DOCUMENT; corrections from product / stakeholder review land as registry edits with a Day-log entry. The Day 1 log's table now reflects 3 passes, not 1; future Day-N dispatches should expect occasional Pass-C-style corrections from Waleed's review channel.

---

## 3. Sprint 3 Day 1 Verification

```
CI grep:                20/20 rules clean (Pass A — Rules 1-20 all green)
Brace-balance:          N/A (no convex/ touched)
Schema hash:            6c5818395c2f6e38d070132ea56957bc9b80997c4013982dd3d2d3451f792385 (unchanged)
Eval JSON:              57 cases unchanged
50 pre-existing cases:  byte-identical to HEAD (no eval edits)
Cat M starter cases:    7 cases still disabled (no Wave 5 implementation yet)
Registry:               857 lines (new file; committed at 56a59ab)
```

---

## 4. MVP capability progression (Sprint 3 Day 1 vs Sprint 2 Day 11 close)

The registry doesn't bump user-facing MVP — it's a methodological / contract bump. Distinguishing the two:

| Surface | Day 11 Sprint 2 close | **Day 1 Sprint 3** | Δ |
|---|---|---|---|
| User-visible MVP capability | ~94-95% | **~94-95%** | unchanged (no feature added) |
| **Architectural-discipline coverage** | partial (designs in scattered docs) | **100%** for current state | first time a single document covers every domain + every MUST NOT + every backing surface |
| Sprint-3 feature dispatch readiness | implicit | **explicit** | every Tier 2 dispatch now has a registry entry to reference |
| Eval coverage scorecard | implicit (case names) | **explicit** | §18 makes per-domain gaps visible |
| Tools status visibility | code-inspection-required | **registry-table-required** | §16 is the single tool-status surface |

**Weighted MVP estimate: Sprint 3 Day 1 EOD = ~94-95% capability + 100% architectural-discipline coverage.** Feature growth from Day 2 onward grows the capability number; the architectural-discipline number stays at 100% as long as every dispatch updates the registry.

---

## 5. Sprint 3 priority queue refresh (post-registry)

Per handoff §6, the Sprint 3 priority queue carries forward. The registry being live changes how priorities are dispatched, not the priorities themselves:

### Tier 2 — User-visible feature surfaces (next up)

1. **`render_link_button`** (§14.1 in registry) — Privacy / TOS / Customer Support redirect pattern. NEW AI tool + dispatcher branch + prompt rule + 3 eval cases + version bump v0.13 → v0.14. Half-day. Sets the app-redirect pattern.
2. **Loyalty full surface** (§14.2 in registry) — `get_loyalty_points_history`, `get_available_redemptions`, `get_loyalty_program_info`, `render_redemption_card`. Plus dedicated prompt section graduating Loyalty from `live-unsurfaced` to `live`. Half-day.
3. **Booking Status** (§14.3 in registry) — `get_pending_bookings`, `render_booking_card`, `render_bookings_list`. Half-day.

### Tier 3 — Sprint 2 carryovers (small, batchable; same as handoff §6 Tier 3)

5. `prompt_injection_tag_smuggling_rejected` sharpening (Day 11 finding; 1/3 PASS at REPEAT=3)
6. Wave 1.5 formal multi-version run (N=5-10 on representative subset v0.9 → v0.14)
7. Within-session per-case fixture-isolation hook
8. Volatile.ts examples for v0.13 untrusted-input rule
9. `fact_type` weighting in reranker (needs Cat M signal — Wave 5 prerequisite)
10. Confidence + age annotation in envelope (Day 8 flagged)
11. DRY `FORBIDDEN_ENVELOPE_TAGS` (between sanitizeSemanticPayload + memoryEquivalence)
12. Manual cleanup of accumulated near-duplicate rows on test user

### Tier 4-7 — same as handoff §6

### Process changes effective Day 2 forward

- **Every Tier 2 feature dispatch updates the registry as part of the deliverable list.** PM verifies the registry-update line before commit.
- **Eval cases added in a dispatch must map to a domain in §18.** If they don't, the dispatch authors a new domain entry first.
- **Registry CI guard (Sprint 3 planned)** — small dispatch, mirrors Wave 1.9 schema-hash guard. Verifies every tool in `OTO_TOOLS` appears in §16 with a status. Track as a Tier 3 carryover.

---

## 6. The Day 1 one-line summary

**Sprint 3 opens with the capability registry across 3 PM-mechanical passes: Pass A (commit `56a59ab`) shipped `docs/OTO_CAPABILITY_REGISTRY.md` (857 lines, 20 sections — §0 doc usage + per-domain template + status taxonomy / §1 Identity-Voice cross-cutting / §2-§13 twelve operational domains [Vehicle, Diagnostic, Booking, Memory, Trust Protocol, Safety, Security, Reliability, Retrieval, Loyalty-basic, Account, Support] / §14 planned Sprint 3 Tier 2 surfaces / §15 ten cross-cutting MUST NOT meta-rules / §16 full tools-registry table [31 live + planned + deferred] / §17 backing-tables-by-domain / §18 eval-coverage matrix / §19 governance + planned CI integration / §20 single-sentence contract); Pass B (commit `caac4fe`) shipped the Day 1 log; Pass C corrected §14 scope after Waleed flagged that the `render_link_button` enum was over-scoped at 6 destinations when the actual app-redirect target list is 3 — `loyalty` / `terms_of_service` / `privacy_policy` only — so §14.1 enum tightened, §14.2 Loyalty downgraded from "full surface with 4 new data tools" to "redirect-only for Sprint 3 + `get_rewards_summary` graduation from `live-unsurfaced` to `live`", §11 (Loyalty basic) rewritten with the in-chat-factual vs redirect-screen discrimination rule, §16 deferred-indefinitely sub-table added for the 4 Loyalty data tools (post-Sprint-3 scope-change-gated), §18 scorecard updated with the 3 planned Loyalty eval prefixes; 20/20 CI green; schema hash unchanged; no code/schema touch across all three passes; the registry is the contract every Sprint 3+ feature dispatch references before authoring implementation; effective Day 2 forward every dispatch updates the registry as part of its deliverable list, every new eval case maps to a §18 domain, and a Sprint 3 Tier 3 carryover plans a registry-CI guard (small dispatch, Wave-1.9-pattern); Sprint 3 Day 2 picks up Tier 2 — `render_link_button` (3-destination scope) + Loyalty redirect + `get_rewards_summary` graduation as a combined ~half-day dispatch, then Booking Status as a separate ~half-day.**

— End of Sprint 3 Day 1. The architecture-discipline foundation + first post-publication correction are in place; capability expansion starts Day 2.
