# Oto AI — Doc 4 of 6: The Migration Plan

**Author:** Principal AI Engineering, acting on AB / Temur's behalf  
**Date:** May 15, 2026  
**Scope:** How to walk from current-state (Doc 1) to north-star (Doc 2, as amended by Doc 3) without halting feature work and without a big-bang rewrite.  
**Constraint from Temur:** No calendar timelines. No delivery-date estimation. Pacing and coordination are Waleed's. This document specifies **sequence and dependency**, not schedule.  
**Decisions locked by Temur (from Doc 3):** Five tables (Fight 1). Vector-DB → Risk Register tripwire (Fight 2). Three interaction moments are launch-scope (Fight 5).

---

## 0. The migration philosophy

A migration plan for a system that is about to launch and must keep shipping features has exactly one correct shape: **strangler fig.** New architecture grows around the old one. Old paths are cut only after new paths are proven in production. There is never a moment where the system is half-migrated and non-functional. No wave in this plan requires the system to be down, and no wave requires feature work to stop.

Three rules govern every wave:

1. **Reversible before irreversible.** Every wave that can be feature-flagged is feature-flagged. The new path runs in shadow or behind a flag, is validated against the old path, and only then becomes the default. The old path is deleted last, in its own wave, never in the wave that introduced the replacement.

2. **Typed boundary before behavior change.** Where a wave both introduces a type and changes behavior, the type lands first as a no-op (the new typed structure exists, nothing reads it yet), then a later step flips consumers over. This means a type migration can never break behavior — the behavior change is a separate, independently revertible step.

3. **Eval gate before promotion.** No new path becomes the default until the eval platform (which is itself an early wave) can prove it doesn't regress. This is circular only in appearance: the eval platform is Wave 1 precisely so every subsequent wave has a gate.

The waves are ordered by **dependency**, not priority. Wave N cannot start until Wave N's dependencies (stated explicitly per wave) are met. Within a wave, items are parallelizable unless a dependency is noted.

---

## 1. The dependency graph

The whole migration, as a dependency DAG. Read top to bottom; arrows are "must precede."

```
WAVE 0 ── Safety floor (launch-blocking, from v3 plan)
   │       auth builders · ai_messages.list · schema unions · mobile renderers
   │       Sonnet telemetry fix · cap counter · slug-drift
   ▼
WAVE 1 ── Eval platform + observability spine
   │       (every later wave needs this as its gate)
   │       Node CLI eval · N-repeat stats · LLM-judge · baseline commit
   │       aggregation cron · prompt-change protocol · prompt versioning
   ▼
WAVE 2 ── The launch interaction layer  (Fight 5 — launch-scope)
   │       escalation-handoff language · cost-cap message · not-yet-known moment
   │       (depends on Wave 1: each is eval-gated before it ships)
   ▼
   ├──────────────┬─────────────────┬──────────────────┐
   ▼              ▼                 ▼                  ▼
WAVE 3         WAVE 4            WAVE 5             WAVE 6
Memory         Tool Registry     Retrieval (RAG)    Cost + Routing
(5 tables,     (single source,   (hybrid, two       (budget gate,
 typed,         versioned,        rerankers,         deterministic
 single-        lifecycle)        miss-path,         router, no
 writer)                          enrichment seam)   confidence floor)
   │              │                 │                  │
   └──────────────┴────────┬────────┴──────────────────┘
                           ▼
WAVE 7 ── Hardening + the deletes
          untrusted-input wrapping · degradation ladder · written_by field
          delete old paths (the strangler's last step)
          KB exfiltration control · enrichment contract
```

Wave 0 is the v3 launch plan — already specified, not re-derived here. Waves 1–7 are the north-star migration. The fan-out after Wave 2 (Waves 3–6 in parallel) is real: once the eval gate and the interaction layer exist, the four core subsystem migrations are independent and can proceed concurrently if Waleed has the capacity, or serially in any order if he doesn't. The dependency is on Waves 0–2, not on each other.

---

## 2. Wave 0 — Safety floor (the v3 launch plan)

Not re-specified here — it is the AutoAI Master Plan v3 (Blocks A–D). Listed only to anchor the dependency graph. **The north-star migration does not begin until Wave 0 ships, with one exception** (Wave 1's prompt-versioning stamp, which is a Wave 0 ride-along — see §3).

The relevant Wave 0 outputs that later waves depend on:

| Wave 0 output | Depended on by |
|---------------|----------------|
| `requireAuthedUser` / `authedQuery` builders | Wave 3 (memory tables use them), Wave 7 |
| Schema unions locked (5 string→enum fixes) | Wave 3 (the pattern extends to all memory tables) |
| Sonnet telemetry records `turnModel` | Wave 6 (router calibration reads this) |
| Cap counter (basic per-user) | Wave 6 (upgraded to full budget gate) |
| Slug-drift remediation | Wave 3 (trust-protocol data integrity) |
| Eval CLI wrapper (Wave 0 C1) | Wave 1 (extended into the full platform) |

Wave 0's eval CLI (a Node wrapper around `runEval` with JSON baseline) is the seed Wave 1 grows. This is deliberate — Wave 0 plants it for launch; Wave 1 makes it the platform every later wave gates against.

---

## 3. Wave 1 — Eval platform + observability spine

**Why first:** Every subsequent wave's promotion criterion is "the eval proves no regression." Without the eval platform, every migration is faith-based — the exact failure Doc 1 §3.10 and the AI QA Lead (Doc 3 §6) identified. This wave is the gate that makes the rest of the migration safe. It ships no user-facing behavior change, which is why it can run concurrently with late Wave 0 hardening.

**Dependencies:** Wave 0's eval CLI seed. Nothing else.

**Items (parallelizable):**

| Item | What it is | Adopted from |
|------|------------|--------------|
| 1.1 | Per-case N≥10 repeats with pass-rate thresholds + statistical regression detection | Doc 3 §6, §1 |
| 1.2 | LLM-judge assertions (binary verdict + rationale, separate eval account) | Doc 2 §6, Doc 3 §6 |
| 1.3 | Baseline-commit + per-PR diff (pass-rate delta per case) | Doc 2 §6 |
| 1.4 | **Boundary-adherence eval category** (the highest-ROI addition — Doc 3 §6) | Doc 3 §6 |
| 1.5 | Prompt-change protocol (the 5-step PR→CI→A/B→rollout→changelog sequence) | Doc 3 §1 |
| 1.6 | Prompt versioning: `SYSTEM_PROMPT_VERSION` constant + stamped into audit | Doc 1 §3.1, Doc 2 §12 |
| 1.7 | Aggregation cron over `oto_telemetry` → hourly rollup table | Doc 2 §10 |
| 1.8 | Rate-based alerting (baseline-deviation, not event-based) → Slack | Doc 2 §10 |
| 1.9 | Schema-hash/description-file CI guard | Doc 3 §1 |

**Ride-along into Wave 0:** Item 1.6 (prompt-version stamp) is one constant + one telemetry field. It costs nothing and it means *every conversation from launch onward is version-attributable*. Without it, the first post-launch prompt regression can't be tied to a version. Waleed should fold 1.6 into Wave 0 even though the rest of Wave 1 follows launch. This is the only Wave 1 item that jumps the queue, and it's because the cost is trivial and the value is retroactive (you can't add version attribution to conversations that already happened).

**Promotion criterion for Wave 1:** the platform can take two prompt versions and produce a statistically-defensible "version B regresses case X by Y% with confidence Z." When that sentence is producible, Wave 1 is done and every later wave has its gate.

**The boundary-adherence category (1.4) gets special note.** Doc 3 §6 called this the single highest-ROI addition. It is also a Wave 1 item rather than a Wave 2+ item for a specific reason: the Wave 2 interaction-moment work (escalation, cost-cap, not-yet-known) is *itself* boundary behavior. You cannot eval-gate Wave 2 without the boundary category existing first. So 1.4 is not optional polish — it is a hard dependency of Wave 2.

---

## 4. Wave 2 — The launch interaction layer

**Why here, why launch-scope:** Temur's Fight-5 decision. The three moments where a trust-first brand earns or loses trust are launch-scope, not migration backlog. They depend on Wave 1 (each is eval-gated via the boundary category, 1.4) but precede the engineering subsystem migrations (Waves 3–6) because they are user-facing and the engineering migrations are not.

**Dependencies:** Wave 1 item 1.4 (boundary eval category) and 1.5 (prompt-change protocol). These three moments are prompt changes; they go through the protocol like any prompt change.

**The three moments, each specified as a design problem, not a code task:**

### 2.1 The escalation handoff

The moment Oto routes a user to a human. Doc 3 §11 (Human-AI Interaction Strategist): "the handoff moment is where a frustrated user either feels caught or feels dropped."

The design problem, stated precisely: the user has reached the edge of what Oto can do, often while already frustrated. The handoff language must do three things simultaneously — acknowledge the limit without apology-spiraling, transfer agency to the human path without making the user feel dumped, and preserve the conversational context so the user doesn't feel they have to re-explain. The prompt already demonstrates the team can produce language at this caliber (the banned-phrasings discipline). This moment needs the same treatment: a small set of contrastive right/wrong examples, baked into the prompt's escalation section, eval-gated by the boundary category.

What "done" looks like: an eval case where a frustrated user hits the escalation boundary, and the judge assertion is "did Oto's handoff language transfer the user to a human path while (a) not apologizing more than once, (b) not making the user feel they failed, (c) signaling the human will have context." Pass threshold ≥90%.

### 2.2 The cost-cap message

The moment Oto tells the user it is rationed. Doc 3 §11: "for a trust-first brand this is dangerous — handled wrong it feels like a bait-and-switch."

The design problem: the user has been receiving help, and now the help stops because of a budget the user never knew existed. The naive message ("I've hit my limit for today") frames the AI as metered, which for a trust-first brand reads as the helpful assistant being secretly on a leash. The reframe: the cap is *protective* (it saved the conversation, the user's progress is not lost, the human path is open now). The message must never imply the user did something wrong, never imply the service is degrading, and always provide the next action.

What "done" looks like: the message is in the prompt as designed language (not a generic string injected by `chat.ts`), it has contrastive examples, and an eval case asserts the cap message provides a next action and does not use scarcity/penalty framing. This is also where Doc 2 §9's "the cap message is a designed surface" promise gets cashed — it was one sentence in Doc 2; here it becomes real.

### 2.3 The "I don't have verified specs yet" moment

The moment Oto admits a *new kind* of ignorance — not "I don't know" (the prompt handles that well) but "I don't have this *yet*, it's coming" (created by the Wave 5 enrichment-miss path; see §7). Doc 3 §8 + §11.

The design problem: this is a promise with a latency. The user asks a factual spec question, retrieval misses, enrichment is triggered async, and the answer will exist in ten minutes when the user is gone. The interaction must set a truthful expectation. The three options Doc 3 §8 surfaced — (a) notify-me follow-up, (b) silent degrade to "confirm with mechanic," (c) blocking fast-path enrichment — are a product decision Temur owns (escalated, see Doc 5). **Wave 2 cannot fully ship 2.3 until that decision is made.** What Wave 2 *can* ship regardless: the in-the-moment language that handles the miss gracefully ("I don't have verified specs for your exact engine variant yet — and I won't guess on something where wrong is worse than 'let me get it right'"). The follow-up mechanism (option a/b/c) is wired in Wave 5 once Temur decides.

**Promotion criterion for Wave 2:** all three moments are designed language in the prompt, each has contrastive examples, each has a boundary-category eval case passing ≥90%, and 2.1/2.2 are fully shipped. 2.3's in-moment language ships; its follow-up mechanism is flagged as Wave-5-pending-Temur-decision.

---

## 5. Wave 3 — Memory (the keystone migration)

**Why here:** The largest architectural change. It depends on Wave 0 (auth builders, schema-union pattern) and Wave 1 (eval gate). It does not depend on Waves 4–6 and can run parallel to them. Temur locked **five tables** (Fight 1) — episodic and control merged.

**Dependencies:** Wave 0 (auth builders, schema-union discipline). Wave 1 (eval gate, specifically memory-behavior cases — see 3.6).

**The strangler sequence (this is the most delicate wave; the sub-ordering matters):**

| Step | What | Reversible? | Note |
|------|------|-------------|------|
| 3.1 | Create the 5 new tables, **nothing reads or writes them** | Fully — they're inert | `conversation_episodic_control` (merged per Fight 1), `conversation_facts`, `user_semantic_facts`, `vehicle_reference_facts`, `conversation_audit`. Plus `kb_topics`. |
| 3.2 | Add `written_by` field to `conversation_facts` + `user_semantic_facts` now | N/A — new field, defaulted | Doc 3 §3 cheap insurance. Costs nothing now; saves a migration when the health-monitor agent appears. |
| 3.3 | **Dual-write:** every place that writes old state also writes the new tables | Reversible — old path still authoritative | New tables populate in shadow. Nothing reads them yet. |
| 3.4 | Backfill: migrate existing `ai_conversations` state into the new tables | One-way data move, but old data untouched | Old tables remain the source of truth through this step. |
| 3.5 | Shadow-read validation: build working memory from BOTH old and new, diff them, log mismatches, **serve from old** | Fully reversible | This is the proving step. Run until mismatch rate is ~0. |
| 3.6 | Memory-behavior eval cases (retraction stops steering; decay changes ranking; concurrent-write no-race) pass | Gate, not a change | Doc 3 §6 gap, adopted. These must pass before 3.7. |
| 3.7 | **Flip:** working memory builds from new tables; old path runs in shadow | Reversible — flag flip | The cutover. Old path still writing, as rollback. |
| 3.8 | Confidence-decay function goes live (exp, 120-day half-life, floor 0.1, asymptotic reinforcement) | Tunable, eval-gated | Doc 3 §5 specification, adopted. |
| 3.9 | `compressHistory` with the fact-extraction-first contract | Eval-gated | Doc 3 §7. **Facts are extracted to `conversation_facts` BEFORE history compression runs.** Compression touches only residual conversational texture. The eval case from Doc 3 §7 (long convo → compress → ask turn-3-detail question → assert still correct) gates this. |
| 3.10 | The mobile-tap fact path: mobile calls `recordSelectionFact` (append-only), NOT `appendEstablishedFact` (shared array) | Reversible per flag | This is the concrete race-condition kill. Both write paths append; neither overwrites; Convex serializes inserts. |
| 3.11 | Old `ai_conversations` state fields stop being written (dual-write off) | The point of no easy return | Only after 3.7 has been stable in production. Old fields remain readable (not deleted) for one more wave. |

**The critical ordering insight:** 3.9 (compressHistory) must come after 3.2–3.8 (the facts layer exists and is authoritative), because the entire safety of compression depends on facts already being extracted to a separate layer before compression runs. Doc 3 §7's hill-to-die-on. If 3.9 ran before the facts layer was live, compression would be summarizing facts-plus-texture together — exactly the amnesia failure the memory redesign exists to eliminate. The sequence enforces the contract structurally.

**Promotion criterion for Wave 3:** shadow-read mismatch rate ~0 for a sustained production window, all memory-behavior eval cases passing, the compression eval case passing, and the mobile-tap path showing zero dropped facts under a concurrent-write load test. Only then does 3.11 (dual-write off) happen. The old tables are *not deleted in this wave* — that's Wave 7.

---

## 6. Wave 4 — Tool Registry

**Why here:** Independent of memory. Depends on Wave 1 (eval gate). Parallelizable with Waves 3, 5, 6.

**Dependencies:** Wave 1 (eval gate, schema-hash/description CI guard from 1.9).

**The strangler sequence:**

| Step | What | Reversible? |
|------|------|-------------|
| 4.1 | Build `TOOL_REGISTRY` as the single source; derive `ACTIVE_TOOLS`, `DISPATCH_MAP`, `ANTHROPIC_TOOLS` from it — but the live system still uses the old `OTO_TOOLS`/`TOOL_NAMES_V1` | Fully — registry is built but unused |
| 4.2 | Assertion test: derived `ANTHROPIC_TOOLS` and `DISPATCH_MAP` are byte-identical to the current hand-maintained sets | Gate | If they don't match, the registry has captured a real current inconsistency — investigate before proceeding (this will likely surface the "28 defined, 12 wired" ghosts as explicit `state` values). |
| 4.3 | Flip the live system to source from the registry | Reversible — flag |
| 4.4 | Mark the 16 ghost tools `state: "proposed"` (was de-facto active-but-unwired) | Reversible | They stop being advertised to the model. The silent-hallucination footgun (Doc 1 §3.2) closes here. |
| 4.5 | Cache-zone split: `stable` vs `volatile` tools get separate cache breakpoints | Reversible | Doc 2 §5 + §12. Editing a volatile tool stops invalidating the stable cache for every user. |
| 4.6 | Tool descriptions move to external `registry/descriptions/*.md`, referenced by registry; the schema-hash CI guard (1.9) enforces they stay in sync | Reversible | Doc 2 §5. DRY; the CI guard from Wave 1 prevents the new drift risk Doc 3 §1 flagged. |
| 4.7 | Delete old `OTO_TOOLS` / `TOOL_NAMES_V1` / `OTO_TOOL_CATEGORY` | Irreversible — strangler's cut | Wave 7, not here. Listed for completeness. |

**Promotion criterion:** 4.2's byte-identity assertion passes (or the discrepancies it finds are explicitly triaged into `state` values), the model sees only `state: "active"` tools, and the cache-zone split shows the stable cache surviving a volatile-tool edit in production telemetry.

---

## 7. Wave 5 — Retrieval (real RAG)

**Why here:** Independent of memory and registry. Depends on Wave 1 (eval gate) and specifically on the labeled retrieval eval set, which Doc 3 §4's hill-to-die-on says must exist *before* tuning anything.

**Dependencies:** Wave 1. Wave 3's `vehicle_reference_facts` and `user_semantic_facts` tables existing (Wave 3 step 3.1) — retrieval reads them. This is the one cross-wave dependency: Wave 5 can start its non-reading work in parallel with Wave 3, but Wave 5's cutover depends on Wave 3 step 3.1 (tables exist) and ideally 3.7 (tables authoritative).

**The strangler sequence:**

| Step | What | Reversible? |
|------|------|-------------|
| 5.1 | **Build the labeled retrieval eval set first** (query, expected_facts pairs). Precision@3, recall@5, MRR harness. | Gate, not a change | Doc 3 §4 hill. Nothing else in Wave 5 has meaning without this. |
| 5.2 | Measure the *current* retrieval against the labeled set | Diagnostic | This is the first time anyone will know if current retrieval works. The number may be uncomfortable. That's the point. |
| 5.3 | `kb_topics` controlled vocabulary table populated; `vehicle_reference_facts.topic` becomes an FK | Reversible — new path unused | Kills KB fragmentation structurally (Doc 1 §3.8). |
| 5.4 | Two retrieval pipelines built (precision-tuned reference, recall-tuned user-semantic), each own reranker weights + threshold, selected by the Stage-1 classifier | Reversible — built, not live | Doc 3 §4 design fix, adopted. The single-reranker design from Doc 2 §4 is replaced here. |
| 5.5 | Shadow-run: new retrieval runs alongside old, results diffed against the labeled set, **old still serves** | Fully reversible | Prove new beats old on precision (reference) and recall (user-semantic) before flipping. |
| 5.6 | Flip to hybrid-always + two-reranker, old path in shadow | Reversible — flag |
| 5.7 | The reference-fact miss-path: structural miss → vector miss → **enrichment-queue feed + the Wave-2 "not-yet-known" language** | Reversible | Doc 3 §4 + §8. The enrichment seam. |
| 5.8 | **Temur's a/b/c decision on the enrichment-miss UX is wired here** | Depends on Temur | Option (a) notify-follow-up / (b) silent degrade / (c) blocking fast-path. Escalated in Doc 5. Wave 5 ships the in-moment language (from Wave 2.3) regardless; this step wires whichever follow-up mechanism Temur picks. |
| 5.9 | Versioned schema contract for the Oto↔enrichment seam | Reversible | Doc 3 §8 gap, adopted. The last untyped boundary gets typed. |

**Promotion criterion:** new retrieval beats current retrieval on the labeled set (precision@3 for reference, recall@5 for user-semantic), measured, not asserted. The miss-path has a complete loop (no dangling "I'll check" with no mechanism). Temur's a/b/c decision is made and 5.8 is wired accordingly.

---

## 8. Wave 6 — Cost governance + deterministic routing

**Why here:** Independent of memory, registry, retrieval. Depends on Wave 0's basic cap counter (upgraded here) and Wave 1's aggregation cron (the budget gate reads aggregates, not raw scans — the AI Infrastructure Architect's §2 concern).

**Dependencies:** Wave 0 (cap counter, Sonnet telemetry fix). Wave 1 (aggregation cron — the budget gate must read pre-aggregated counters, never per-turn-scan the telemetry table).

**The strangler sequence:**

| Step | What | Reversible? |
|------|------|-------------|
| 6.1 | Budget gate reads `conversation_control.budget_spent_usd` (a counter), never scans telemetry | Reversible — runs in log-only mode first | Directly answers Doc 3 §2: no per-turn table scan. |
| 6.2 | Budget gate in log-only mode: computes the cap decision, logs it, **does not enforce** | Fully reversible | Validates the gate's decisions against real traffic before it can block a real user. |
| 6.3 | Enforce: daily/per-conversation/platform caps go live, with the Wave-2 cost-cap message | Reversible — flag | The cost-cap message (Wave 2.2) is the user-facing half; this is the enforcement half. They ship together. |
| 6.4 | Deterministic router replaces the model-self-routing cascade — **using only observable signals** | Reversible — runs in shadow | turn-count-in-flow, explicit escalation request (weighted input), repeated-clarifying-question detection, budget state. **`last_response_confidence` is NOT used** (Fight 3, resolved — it's a fictional signal). |
| 6.5 | Router shadow-mode: it computes the model decision, the old cascade still decides, decisions are diffed | Fully reversible | |
| 6.6 | Router live: deterministic decision is authoritative; model's escalation request is an *input*, never a *command* | Reversible — flag | Doc 2 §7 as corrected by Doc 3 Fight 3. |
| 6.7 | Sonnet turn-budget + hard caps enforced server-side (no model-trust for cost control) | Reversible | Doc 1 §3.6, Doc 2 §7. |
| 6.8 | Cost attribution: every dollar tagged (user, conversation, outcome) → "cost per booking" becomes computable | Additive | The north-star metric stops being aspirational. |

**Promotion criterion:** the budget gate's log-only decisions match expected behavior on real traffic (6.2 validated before 6.3 enforces), the router's shadow decisions are sane against real conversations (6.5 before 6.6), and a confidence estimator is explicitly **out of scope for this wave** — the router ships without it, as Fight 3 resolved. A confidence signal is a separate future wave gated on building and validating a real estimator.

---

## 9. Wave 7 — Hardening and the deletes

**Why last:** The strangler's final cut. Old paths are deleted only after every new path has been production-proven in Waves 3–6. Plus the hardening items that depend on the new architecture being in place.

**Dependencies:** Waves 3–6 cutovers stable in production.

**Items:**

| Item | What | From |
|------|------|------|
| 7.1 | Untrusted-input wrapping applied to the current user's message | Fight 4 (resolved) — this is a today-vulnerability, not Phase 2 |
| 7.2 | Degradation ladder specified and implemented (full → degraded → minimal → down) | Doc 3 §10 gap, adopted |
| 7.3 | KB exfiltration control (rate-limit on reference-fact reads per user) | Doc 3 §9 — the moat has no bulk-read protection |
| 7.4 | Delete old `ai_conversations` state fields (Wave 3 made them unwritten; now unread, now gone) | Strangler cut |
| 7.5 | Delete old `OTO_TOOLS`/`TOOL_NAMES_V1` (Wave 4 superseded them) | Strangler cut |
| 7.6 | Delete old retrieval path (Wave 5 superseded it) | Strangler cut |
| 7.7 | Delete the model-self-routing cascade code (Wave 6 superseded it) | Strangler cut |

**On 7.1 — note it's in Wave 7, not Wave 2, despite Fight 4 resolving it as a "today" concern.** The resolution was that the user's message *is* untrusted input now and the *deferral framing* was wrong. But the actual control (envelope-structure wrapping + a prompt-section instruction) is itself a prompt change that must go through the Wave 1 prompt-change protocol and is cleanest to land once the prompt architecture is layered (Wave 4's cache-zone work touches the same prompt structure). It is not Wave 2 because it is not a user-facing interaction moment — it's a security control. It is "early" in the sense that it is not deferred to a mythical Phase 2; it is correctly placed in the hardening wave with a clear rationale. If Waleed judges the risk high enough to pull forward, it can ride Wave 4 — the dependency is "layered prompt structure exists," which Wave 4 provides. Flagged for his call.

**On 7.3 — the KB exfiltration control is the one item with no clean prior art in the codebase.** Doc 3 §9 (Security Analyst) raised it as a strategic gap: the moat is readable by any authenticated user one conversation at a time, and cost-velocity anomaly detection won't catch it because reads are cheap. This needs its own small design (per-user read-rate limit on reference facts, with a threshold well above legitimate use but below systematic scraping). It is in Wave 7 because it depends on the Wave 5 retrieval rebuild being live (the rate limit attaches to the new reference-fact path). It is flagged in Doc 6 as a strategic risk with its own monitoring.

---

## 10. The migration as a whole — what never breaks

A migration plan is only as good as its guarantee that the system never enters a broken intermediate state. Here is the explicit guarantee, wave by wave:

| Wave | Can the system serve users throughout? | Rollback mechanism |
|------|----------------------------------------|--------------------|
| 0 | Yes — these are fixes, not rewrites | Per-fix revert |
| 1 | Yes — eval/observability is offline infra; zero user-path change | N/A — nothing user-facing changes |
| 2 | Yes — prompt changes go through the protocol; A/B at 5% before 100% | Prompt version rollback (Wave 1.6) |
| 3 | Yes — dual-write + shadow-read; old path authoritative until 3.7 flip | Flag flip back to old path; old tables still written until 3.11 |
| 4 | Yes — registry built unused until 4.3; byte-identity asserted | Flag flip back to `OTO_TOOLS` |
| 5 | Yes — shadow-run until 5.6; old retrieval serves until flip | Flag flip back to old retrieval |
| 6 | Yes — log-only (6.2) and shadow-mode (6.5) before any enforcement | Flag flip; gate reverts to no-op |
| 7 | Yes — deletes only what's been superseded and proven | The thing being deleted has been dead-but-present for a full wave |

**There is no wave in which the system is down. There is no wave in which feature work must stop** — every wave is either offline infrastructure (1), feature-flagged shadow work (3–6), protocol-gated prompt change (2), or supersede-then-delete (7). Feature development proceeds on the old paths until the new paths are proven, then moves to the new paths. The only constraint feature work inherits: new features built during Waves 3–6 should be built against the new architecture's interfaces where they exist, so they don't create new old-path debt that Wave 7 then has to clean. That's a discipline, not a halt.

---

## 11. The ordering rationale, defended

Three ordering choices that a reviewer would reasonably challenge, defended explicitly:

**Why Wave 1 (eval) before everything except the launch floor.** Because the alternative — migrate first, build the gate later — means Waves 3–6 are validated by hope. Doc 1 §3.10 and Doc 3 §6 both identified "probabilistic system, deterministic testing illusion" as a top systemic concern. Building the gate first is the structural answer. The cost (Wave 1 ships no features) is the price of every later wave being safe. This is non-negotiable and it is the single most important sequencing decision in the document.

**Why Wave 2 (interaction) before Waves 3–6 (engineering), given the engineering is "more foundational."** Because Temur resolved Fight 5 as launch-scope, and because Doc 3 §11's meta-finding stands: the engineering subsystems are invisible; the interaction moments are where a trust-first brand actually wins or loses. Sequencing the invisible perfection before the visible trust moments would be optimizing the measurable over the mattering — the exact error Doc 3 §15 named as most-likely-to-be-ignored. Putting Wave 2 ahead of 3–6 is the structural refusal of that error.

**Why memory (Wave 3) is not split across multiple waves despite being the largest change.** Because memory's correctness depends on the *whole* model being coherent — the facts layer, the compression contract, the mobile-tap path, and the single-writer guarantee are one interlocking design. Splitting it across waves would mean running with a half-built memory model in production, which reintroduces exactly the conflated-state failure (Doc 1 §3.3) the redesign exists to eliminate. The strangler sub-sequence *within* Wave 3 (3.1–3.11) provides the incrementality; splitting the wave itself would not.

---

## 12. What Doc 4 hands to Doc 5 and Doc 6

**To Doc 5 (Decision Log):** every escalated decision that this migration plan is structured around but does not itself decide:

- Fight 1 (five tables) — resolved by Temur, recorded as decided.
- Fight 2 (vector-DB tripwire) — resolved by Temur as a Doc 6 risk item.
- Fight 5 (interaction moments launch-scope) — resolved by Temur, restructured Wave 2.
- The enrichment-miss UX a/b/c (Wave 5.8) — **still open, Temur owns it**, blocks Wave 5 completion.
- The substrate-held-constant trade (Doc 2 §1.2) — recorded as a conscious, revisitable choice with the vector-DB tripwire as its revisit trigger.
- The 7.1-in-Wave-7-vs-Wave-4 placement — flagged for Waleed's risk judgment.

**To Doc 6 (Risk Register):** the migration-specific risks this plan creates or carries:

- The vector-DB tripwire (Fight 2) with its numeric trigger — the headline migration risk.
- Wave 3's backfill (3.4) — the one one-way data move; if the backfill is wrong, shadow-read (3.5) catches it, but the risk is real and needs the explicit detection signal.
- The KB exfiltration gap (7.3) — strategic risk, no prior art, own monitoring.
- The enrichment-miss UX being unresolved blocking Wave 5 completion — a process risk, not a technical one.
- Feature-work-creating-new-old-path-debt during Waves 3–6 — the discipline risk from §10.

---

## 13. Closing read

This migration has one property worth stating plainly: **it is boring on purpose.** Strangler-fig migrations are not clever. They are slow, redundant (dual-write, shadow-read), and unsatisfying to engineers who want to delete the old code immediately. That redundancy is the entire value. The current system's worst failures (Doc 1) came from confidence that the new way worked without proving it against the old way. This plan refuses that confidence structurally — nothing is deleted until its replacement has served real production traffic in parallel and been measured to not regress.

The single highest-risk wave is Wave 3 (memory), because it is the only wave with a one-way data move (the backfill) and the only wave whose correctness is holistic rather than incremental. The strangler sub-sequence within it (shadow-read before flip, flip before dual-write-off, old tables retained until Wave 7) is engineered specifically so that even the highest-risk wave has no point of no return until production has proven the new path.

The single most important *ordering* decision is Wave 1 before everything. The single most important *scope* decision is Temur's: Wave 2's interaction moments are launch-scope, not backlog. The first protects the migration from itself. The second protects the brand from the migration's natural tendency to perfect the invisible.

Doc 5 — the Decision Log — records every consequential call with its alternatives and its owner, so any of them can be argued against on the reasoning, not just the conclusion. It starts on your next turn.

— End of Doc 4.
