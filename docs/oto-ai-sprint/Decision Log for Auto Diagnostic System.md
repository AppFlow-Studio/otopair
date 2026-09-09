# Oto AI — Doc 5 of 6: The Decision Log

**Author:** Principal AI Engineering, acting on AB / Temur's behalf  
**Date:** May 15, 2026  
**Purpose:** Every architecturally consequential decision across Docs 1–4, recorded so it can be argued against on the *reasoning*, not just the conclusion. A decision with no recorded alternative is a decision no one can revisit intelligently.  
**Status convention:** `LOCKED` (decided, owner signed off) · `OPEN` (decided-by-default, owner has not ruled, blocks something) · `STANDING` (a principle, not a point decision) · `CORRECTED` (a prior doc was wrong; this records the correction).

---

## 0. How to use this document

This is not a summary of Docs 1–4. It is the *decision substrate* beneath them. Each entry has the same shape:

- **Decision** — the call, stated as a sentence
- **Alternatives** — what else was on the table, stated fairly (not strawmanned)
- **Why this and not those** — the reasoning, attackable
- **Owner** — who can overturn it
- **Status** — LOCKED / OPEN / STANDING / CORRECTED
- **Revisit trigger** — the specific condition under which this should be reopened

The single most important property of this document: **a decision you disagree with should be arguable here without re-reading 50,000 words.** If an entry's "why" doesn't survive your scrutiny, that entry is the conversation to have — not the whole architecture.

Entries are grouped: strategic decisions (§1), the four escalated fights (§2), architectural decisions (§3), corrections to prior docs (§4), and standing principles (§5). The escalated fights (§2) are where the live disagreement is — read those first if you read nothing else.

---

## 1. Strategic decisions

These shape what Oto *is*, not how it's built. They were made (or confirmed) across the engagement and are the load-bearing strategic calls.

### D-1.1 — Oto stays single-agent through v1 and v2

- **Decision:** Oto remains one agent with many tools, not a fleet of specialized agents coordinated by an orchestrator. Memory is designed as the future integration bus so a split is additive if ever needed.
- **Alternatives:** (a) Split into diagnostic/booking/maintenance agents now, mapping to prompt sections. (b) Orchestrator + specialist sub-agents pattern. (c) Single agent forever, no seam designed.
- **Why this and not those:** Task-based splitting (a) is the most common expensive mistake at Oto's stage — the flows share user, vehicle, and conversation arc, and diagnostic→booking is the *primary* success path, so splitting it makes every successful conversion a lossy context handoff. (b) adds inter-agent communication overhead, debugging ambiguity, and per-agent cost for a benefit Oto's workload doesn't need. (c) leaves no seam for the one evolution that *is* plausible (a proactive async health-monitor with a different *lifecycle*, not just a different task). This decision takes the cheap middle: stay single, design the seam.
- **Owner:** Temur (product/strategy).
- **Status:** LOCKED. Confirmed via Doc 2 §14, endorsed by the Multi-Agent Systems Engineer (Doc 3 §3, 9.0/10).
- **Revisit trigger:** A flow appears whose *lifecycle* differs from the synchronous chat loop (proactive monitoring is the predicted first candidate). Not a *task* difference — a *lifecycle* difference. If someone proposes splitting on task, this entry is the rebuttal.

### D-1.2 — The KB moat is real strategy, and the architecture must protect it from bulk reads, not just bad writes

- **Decision:** Treat the vehicle-reference KB as a defensible asset. Protect it from AI corruption (read-only for the model — Doc 2 §3.7) *and* from systematic exfiltration by authenticated users (rate-limited reference-fact reads — Doc 4 Wave 7.3).
- **Alternatives:** (a) Protect from bad writes only (Doc 2's original posture). (b) Don't treat the KB as a moat; it's just a cache. (c) Make the KB fully public (commodity-data argument).
- **Why this and not those:** (a) was Doc 2's blind spot, caught by the Security Analyst (Doc 3 §9): the moat is readable one conversation at a time by any authenticated user, and cost-velocity anomaly detection won't catch a scraper because reads are cheap. If leadership is betting the company on the KB being defensible (which it is, across multiple meetings), then "defensible against writes but trivially scrapable" is not defensible. (b) contradicts stated strategy. (c) forfeits the bet.
- **Owner:** Temur (it's a bet-sizing question about the moat).
- **Status:** LOCKED as direction; the specific rate-limit design is OPEN (Doc 4 Wave 7.3, no prior art, needs its own small design).
- **Revisit trigger:** Evidence the moat doesn't actually confer advantage (e.g., frontier models ship with sufficient automotive-spec coverage that the KB stops being differentiating). This is also a Doc 6 risk.

### D-1.3 — Three interaction moments are launch-scope, not migration backlog

- **Decision:** The escalation handoff, the cost-cap message, and the "not-yet-known" moment receive prompt-caliber designed language *before launch* (Doc 4 Wave 2).
- **Alternatives:** (a) Treat them as post-launch polish (the implicit Doc 2 posture). (b) Ship generic strings now, design later. (c) This — design them before launch.
- **Why this and not those:** This was Fight 5, resolved by Temur. The reasoning the Human-AI Interaction Strategist made (Doc 3 §11, §15) and Temur accepted: eleven of twelve north-star subsystems are invisible to the user; these three moments are where a trust-first brand actually earns or loses trust; perfecting the invisible while shipping these undesigned is "optimizing the measurable over the mattering." (a) and (b) defer the brand-critical work behind the brand-invisible work.
- **Owner:** Temur.
- **Status:** LOCKED. Restructured Doc 4 Wave 2 to sit ahead of all engineering migrations.
- **Revisit trigger:** None expected. This is a values decision, not a tradeoff; reopening it would mean reopening "is Oto trust-first," which is not in question.

---

## 2. The four escalated fights

The live disagreements. Three are resolved by Temur; one is still OPEN and blocks a wave. These are recorded with the losing position stated as strongly as the winning one, because a decision is only revisitable if the alternative is preserved honestly.

### D-2.1 — Five tables, not six (Fight 1) — LOCKED

- **Decision:** The memory architecture uses five tables. Episodic memory and control state are merged into one table (`conversation_episodic_control`), with write-authority enforced at the field level.
- **The position that lost (stated fairly):** Doc 2's six-table design separated episodic (model-influenced: mood, arc, flow) from control (system-only: model, budget, escalation) on the principle "one kind of state per table." This is a clean, legible principle. A six-table model is easier to reason about — each table has an unambiguous purpose, and a new engineer can look at the schema and understand the memory model without reading prose. There is real value in that legibility, and it should not be dismissed.
- **The position that won:** The Memory Systems Engineer (Doc 3 §5) argued episodic and control have *identical lifetime and access pattern* (per-conversation, single-row, read once at turn start, written once at turn end). The distinction Doc 2 drew is a write-authority distinction, which can be enforced at the field level *within* one table — Doc 2 already requires single-writer mutations anyway. Merging is a free ~17% reduction in per-turn state-read operations, and the AI Infrastructure Architect (Doc 3 §2) established per-turn operation count as the binding constraint at the scale leadership is betting on.
- **Why Temur ruled this way:** Operational cost at the bet-on scale beats schema legibility. The legibility loss is mitigated by field-level write-authority being explicit in the mutation layer.
- **Owner:** Waleed (he owns per-turn-cost reality; Temur ruled on the principle).
- **Status:** LOCKED. Carried into Doc 4 Wave 3 as `conversation_episodic_control`.
- **Revisit trigger:** If field-level write-authority enforcement proves error-prone in practice (a system-only field gets written by a model-driven path due to the merge), the legibility argument regains force and the split should be reconsidered. Monitor via the Wave 3 memory-behavior eval cases.

### D-2.2 — The vector-DB divergence is a monitored risk with a numeric trigger, not a footnote (Fight 2) — LOCKED

- **Decision:** Holding Convex's vector index constant is correct *for now*, but the decision is recorded in the Risk Register (Doc 6) with a specific numeric trigger that forces a proactive revisit, rather than left as a footnote in Doc 2 §1.2.
- **The position that lost (stated fairly):** Doc 2 §1.2 held the substrate constant and characterized the vector-DB advantage as "years away," reasoning that Oto's vector workload is small, Convex's transactional consistency is a genuine asset for the memory redesign, and a dedicated vector DB's advantages don't materialize at Oto's scale for a long time. This is correct under the assumption that growth is moderate.
- **The position that won:** The AI Infrastructure Architect (Doc 3 §2) argued "years" assumes the moat *fails*. The KB-as-moat is a *growth* strategy; if it works, the vector count grows with both traffic and the enrichment pipeline simultaneously, making Convex's vector index a constraint within 12–18 months, not years. Doc 2's substrate call is correct for the pessimistic case and wrong for the case leadership is betting on. The resolution isn't "switch now" — it's "stop treating this as a footnote; make it a monitored risk with a trigger."
- **Why Temur ruled this way:** A bet-sized risk deserves a tripwire, not a footnote. Proactive revisit at a defined threshold beats reactive migration when it hurts.
- **Owner:** Temur (moat bet-sizing).
- **Status:** LOCKED as direction. Becomes Doc 6's headline migration risk with a numeric trigger (candidate trigger: reference-fact vector count crosses a threshold OR p95 retrieval latency crosses a threshold — exact numbers set in Doc 6).
- **Revisit trigger:** *Is* the trigger — defined numerically in Doc 6. This is the one decision whose revisit condition is itself the deliverable.

### D-2.3 — `last_response_confidence` is struck from the v1 router (Fight 3) — CORRECTED

- **Decision:** The deterministic router (Doc 2 §7) ships using only observable signals (turn-count-in-flow, explicit model escalation request as a weighted input, repeated-clarifying-question detection, budget state). The confidence-floor input is removed.
- **The position that was wrong (Doc 2 §7):** Doc 2's router escalated to Sonnet when `last_response_confidence` dropped below a floor. This presented as a principled rule.
- **Why it was wrong:** The LLM Reliability Engineer (Doc 3 §10) established that this signal does not exist. Haiku does not emit calibrated confidence natively. The options for obtaining it (model self-report, behavioral derivation, separate classifier) are all either unbuilt or themselves the metacognition problem in a new costume. Shipping a threshold against an undefined number is a routing decision made on noise, dressed as a rule. Consistent failure against a meaningless signal is not better than random failure — it's just more confidently wrong.
- **Why this was resolved by the principal, not escalated:** It is a correctness error in Doc 2, not a tradeoff. A principal who escalates a clear error to avoid the appearance of fiat is abdicating. Doc 2 §7 was corrected, not defended.
- **Owner:** Resolved at the architecture level; Waleed implements.
- **Status:** CORRECTED. Doc 4 Wave 6.4 explicitly ships the router without it. A confidence signal becomes a separate future wave gated on building and validating a real estimator.
- **Revisit trigger:** A confidence estimator is built and validated against outcomes (not against the model's self-assessment). Only then does a confidence-based routing input return, and it returns as its own eval-gated wave.

### D-2.4 — Untrusted-input handling is a today control, not a Phase 2 feature (Fight 4) — CORRECTED

- **Decision:** The `<untrusted_input>` structural wrapping + the prompt-section instruction to treat wrapped content as data applies to the *current user's own message*, not only to future mechanic notes.
- **The position that was wrong (Doc 2 §11):** Doc 2 deferred untrusted-input structural separation to "trust-protocol Phase 2 when mechanic notes flow into context."
- **Why it was wrong:** The Security Analyst (Doc 3 §9) established that the user's own message *is* untrusted input today. Deferring the control because the *second* untrusted source is future is convention-over-control thinking — the exact pattern that produced every auth finding in Doc 1. "The model is robust to injection" is a mitigation, not a control.
- **Why this was resolved by the principal, not escalated:** Like D-2.3, a correctness error, not a tradeoff. Corrected, not defended.
- **Owner:** Resolved at architecture level; Waleed implements; placement is Waleed's judgment.
- **Status:** CORRECTED. Doc 4 places the actual control in Wave 7.1 with explicit rationale (it's a security control, not an interaction moment; cleanest once the prompt is layered in Wave 4) — but explicitly flagged that Waleed may pull it forward onto Wave 4 if he judges the risk high enough. The *correction* (it's not deferred to a mythical Phase 2) is locked; the *placement* is Waleed's call.
- **Revisit trigger:** Waleed's risk judgment on Wave 4 vs. Wave 7 placement. Also: any production evidence of a successful extraction/manipulation attempt accelerates this to immediate.

### D-2.5 — The enrichment-miss UX (a/b/c) — OPEN, blocks Wave 5 completion

- **Decision:** **NOT YET MADE.** This is the one decision in the engagement that is genuinely open and that Temur owns.
- **The decision required:** When retrieval misses a reference fact and enrichment is triggered async, the user is gone before the answer arrives (enrichment is a multi-second, $0.30, adversarially-verified pipeline). What does the user experience?
  - **(a) Notify-me follow-up:** Oto says "I'll have this for you — want me to notify you when I do?" and the notification system actually follows up when the fact lands. *Pro:* the individual user is served, not just the aggregate. *Con:* requires notification-system integration; introduces a "promise Oto must keep" with a failure mode (notification never fires).
  - **(b) Silent degrade:** Oto says "you'd want to confirm exact specs with your mechanic" and moves on; the fact enriches in the background for future users. *Pro:* simplest, no new failure mode, the flywheel still works for the aggregate. *Con:* the asking user gets nothing; for a factual question that's a soft trust ding.
  - **(c) Blocking fast-path enrichment:** A stripped-down single-web-search (no adversarial verification, lower confidence, marked as such) runs synchronously while the user waits. *Pro:* the asking user gets an answer now. *Con:* latency hit on that turn; lower-confidence data enters the conversation; a second data-quality tier exists.
- **Why it's open:** It is a product decision disguised as an architecture gap (Doc 3 §8). Each option is legitimate. Defaulting it by engineering choice (Waleed picking under deadline) is the exact failure mode this engagement exists to prevent.
- **Owner:** Temur.
- **Status:** OPEN. Doc 4 Wave 5 ships the *in-moment language* (the "I won't guess where wrong is worse than 'let me get it right'" framing) regardless — that's the Wave 2.3 work. But the *follow-up mechanism* (which of a/b/c) cannot be wired until Temur rules. **Wave 5 cannot reach its completion criterion while this is open.**
- **Revisit trigger:** N/A — it needs an initial ruling, not a revisit. The principal's honest lean, since the engagement asked for opinionated guidance: **(b) for launch, (a) post-launch.** (b) has no new failure mode and the flywheel still compounds for the aggregate; (a) is the right long-term answer but introduces a promise-keeping dependency that is better added when the notification system is hardened. (c) is the worst of the three — it reintroduces the exact Haiku-web-search data-quality risk the north-star deliberately removed (Doc 1 §3.4), just with a latency cost attached. This is a lean, not a ruling. Temur owns the call.

---

## 3. Architectural decisions

Calls that shape *how* Oto is built. These were made within the engagement and are LOCKED unless a revisit trigger fires. Stated compactly; the full reasoning is in the cited doc.

### D-3.1 — Substrate held constant: Convex + Anthropic, no LLM gateway, no dedicated vector DB

- **Decision:** Keep Convex + Anthropic. No multi-model gateway (LiteLLM/Portkey). No dedicated vector DB. No external observability platform for now.
- **Alternatives:** Greenfield-ideal would diverge on two of these (dedicated vector DB; external observability platform — Doc 2 §1.2 stated this honestly).
- **Why this and not those:** Convex's transactional consistency is a genuine asset for the five-table memory model (race conditions that need careful locking elsewhere are eliminated by mutation serialization). Anthropic-only is correct because Oto's task is in Claude's strength zone — the cost lever that matters is caching+routing *within* the Claude family, not cross-provider arbitrage, so a gateway adds an operational layer for a benefit Oto doesn't need. The vector-DB and observability divergences are real and accepted as conscious trades.
- **Owner:** Temur (substrate is a foundational bet).
- **Status:** LOCKED, with two explicit caveats: D-2.2 (vector-DB tripwire) and the observability-platform revisit below.
- **Revisit trigger:** (1) The D-2.2 numeric trigger fires (vector DB). (2) Team grows past ~3 engineers OR conversation volume exceeds what an hourly aggregation cron comfortably handles → revisit external observability platform (Langfuse/Braintrust). (3) Oto's task expands beyond Claude's strength zone → revisit the gateway. None expected near-term; all recorded so the decision is conscious.

### D-3.2 — Memory: append-only facts with soft-retract is load-bearing and must not be "optimized" into a mutable table

- **Decision:** `conversation_facts` and `user_semantic_facts` are append-only with soft-retract (set `retracted_at`, never hard-delete). This is a correctness guarantee, not an implementation detail.
- **Alternatives:** A mutable facts table (update/delete in place) — superficially simpler, avoids "wasted" retracted rows.
- **Why this and not those:** The Memory Systems Engineer (Doc 3 §5) put this on record specifically so it is not re-litigated. Conversations are bounded; facts per conversation are double-digit; filtering retracted facts on an indexed double-digit set is free. The append-only design's guarantee (no concurrent-write race — the literal fix for Doc 1's "benign" race; full audit trail; clean retraction semantics) is worth infinitely more than a micro-optimization on a tiny row count. A future engineer will be tempted to "clean this up." This entry is the rebuttal.
- **Owner:** Waleed.
- **Status:** LOCKED. Doc 4 Wave 3.
- **Revisit trigger:** None legitimate. If fact-per-conversation count somehow became unbounded (a design change elsewhere), revisit — but that design change would itself be the problem to fix, not this.

### D-3.3 — Two retrieval pipelines, not one (precision-tuned reference, recall-tuned user-semantic)

- **Decision:** Reference-fact retrieval and user-semantic retrieval are separate pipelines with different reranker weights and different confidence thresholds, selected by the Stage-1 classifier.
- **Alternatives:** Doc 2 §4's single weighted reranker serving both.
- **Why this and not those:** The RAG Specialist (Doc 3 §4) established they have opposite optimization targets. Reference facts optimize precision — a confident wrong oil capacity is a trust catastrophe; below threshold, return "let me check," not a guess. User-semantic optimizes recall with graceful degradation — a missed preference is a mild personalization miss. One reranker with one weight vector cannot serve both; a single design produces confidently-wrong factual answers, the exact failure the trust protocol exists to prevent.
- **Owner:** Waleed.
- **Status:** LOCKED (this is an adopted correction to Doc 2). Doc 4 Wave 5.4.
- **Revisit trigger:** If the labeled retrieval eval set (Wave 5.1) shows a single unified reranker matching or beating the two-pipeline design on both precision (reference) and recall (user-semantic) — unlikely given the opposing targets, but the eval set makes it falsifiable.

### D-3.4 — `compressHistory` operates only on residual conversational texture; facts are extracted to the facts layer first

- **Decision:** History compression runs *after* structured facts are extracted to `conversation_facts`. Compression may lose phrasing; it may never lose a fact, because facts are not in the compressible layer.
- **Alternatives:** Compress raw history including facts (Doc 2 §3.2's underspecified version) — simpler, one step.
- **Why this and not those:** The Context Engineering Specialist (Doc 3 §7) identified `compressHistory` as the single most likely source of silent quality degradation in the north-star. Summarization is lossy in invisible ways; "squeal at low speed on right turns when cold" compressed to "user reported brake noise" destroys exactly what the diagnostic needs — reintroducing the amnesia the memory redesign exists to eliminate. The contract makes the loss survivable: facts live in a different layer and survive compression structurally.
- **Owner:** Waleed.
- **Status:** LOCKED (adopted correction). Doc 4 Wave 3.9, ordered explicitly *after* the facts layer is authoritative (3.2–3.8).
- **Revisit trigger:** The Wave 3.9 compression eval case (long convo → compress → ask turn-3-detail question → assert still correct) failing would indicate the contract isn't being honored — fix the implementation, not the decision.

### D-3.5 — Confidence-decay function: exponential, 120-day half-life, floor 0.1, asymptotic reinforcement

- **Decision:** User-semantic fact confidence decays exponentially with a 120-day half-life, floors at 0.1 (never auto-retracts on decay alone — retraction requires explicit contradiction), and reinforcement sets `confidence = 1 − (1 − confidence) × 0.5` (asymptotic toward 1.0, never reaching it).
- **Alternatives:** Linear decay; no floor (auto-retract at zero); reinforcement-resets-to-1.0.
- **Why this and not those:** The Memory Systems Engineer (Doc 3 §5) noted Doc 2 specified decay as a concept, not a function, and that the choice changes behavior materially. Exponential-with-half-life models "older = weaker but not worthless" better than linear. The floor prevents a stale-but-still-true preference from vanishing entirely. Asymptotic reinforcement means a fact observed 10 times is stronger than one observed twice, but neither is ever "certain" — which is epistemically honest and prevents over-confident personalization.
- **Owner:** Waleed (tunable; eval-gated).
- **Status:** LOCKED as the starting function. Doc 4 Wave 3.8.
- **Revisit trigger:** Production data on personalization quality. These constants are explicitly tunable; the *shape* (exponential, floored, asymptotic) is the decision, the *constants* (120 days, 0.1, 0.5) are starting points to calibrate.

### D-3.6 — `written_by` field added to fact tables now, defaulted to `chat_agent`

- **Decision:** `conversation_facts` and `user_semantic_facts` get a `written_by` field now, defaulting to `chat_agent`.
- **Alternatives:** Add it later, when the second agent (health-monitor) actually appears.
- **Why this and not those:** The Multi-Agent Systems Engineer (Doc 3 §3) showed Doc 2 §14's claim that the multi-agent seam "falls out for free" was wrong — it falls out *cheaply* only if this field exists before the seam is used. A one-field addition is trivial today and a migration later. It is the cheapest possible insurance against the one architectural evolution the engagement itself predicts (D-1.1's revisit trigger).
- **Owner:** Waleed.
- **Status:** LOCKED (adopted). Doc 4 Wave 3.2.
- **Revisit trigger:** None. It's a defaulted field; it costs nothing until used.

### D-3.7 — Eval platform first; nothing migrates without its gate

- **Decision:** The eval platform + observability spine (Doc 4 Wave 1) is built before any subsystem migration (Waves 3–6).
- **Alternatives:** Migrate first, build the gate as you go.
- **Why this and not those:** Doc 1 §3.10 and Doc 3 §6 both named "probabilistic system tested deterministically" a top systemic concern, and the AI QA Lead called a green-but-single-shot eval suite a *negative* asset (false confidence is worse than no confidence). Migrating without the gate means Waves 3–6 are validated by hope. The cost (Wave 1 ships no features) is the price of every later wave being safe. This is the single most important sequencing decision in the engagement.
- **Owner:** Temur ratified; Waleed sequences within.
- **Status:** LOCKED. Doc 4 Wave 1, with item 1.6 (prompt-version stamp) riding into Wave 0 because its value is retroactive.
- **Revisit trigger:** None. Reversing this means accepting faith-based migration, which the entire engagement argues against.

### D-3.8 — Boundary-adherence is a first-class eval category, and it's a hard dependency of the interaction-moment work

- **Decision:** "Did Oto correctly refuse/escalate at the edge of its capability" is a dedicated eval category (Doc 4 Wave 1.4), and it must exist before Wave 2 (the interaction moments are themselves boundary behavior).
- **Alternatives:** Keep testing only in-scope correct behavior (the current suite's blind spot, inherited by Doc 2 §6).
- **Why this and not those:** The AI QA Lead (Doc 3 §6) called this the single highest-ROI eval addition. Oto's brand-killing failure is not "didn't know" — it's "confidently said the wrong thing about something it shouldn't have answered." That failure mode had zero coverage in both the current system and Doc 2. And the Wave 2 moments (escalation, cost-cap, not-yet-known) can't be eval-gated without it.
- **Owner:** Waleed.
- **Status:** LOCKED (adopted gap-fill). Doc 4 Wave 1.4, dependency of Wave 2.
- **Revisit trigger:** None. It's a permanent category.

### D-3.9 — The Oto↔enrichment seam gets a versioned schema contract

- **Decision:** The interface between Oto (reads `vehicle_reference_facts`) and the enrichment pipeline (writes it) becomes a versioned schema contract — which fields, which confidence floor, which freshness guarantee — the same way the mobile↔backend seam got one.
- **Alternatives:** Continue sharing the table by convention (the current state).
- **Why this and not those:** The Automation Workflow Architect (Doc 3 §8) noted every Oto boundary governed by convention has produced a Doc 1 finding, and this is the last untyped one. Two systems sharing a table by convention is the same anti-pattern as the auth model and the old memory model.
- **Owner:** Waleed (coordinates with the enrichment pipeline, also Waleed's).
- **Status:** LOCKED (adopted gap-fill). Doc 4 Wave 5.9.
- **Revisit trigger:** None. Typing a boundary is not a reversible-experiment decision.

---

## 4. Corrections to prior documents

Recorded explicitly so the document set is self-honest. A consulting engagement that doesn't log its own errors is propaganda.

| ID | Document | What it got wrong | Correction | Where recorded |
|----|----------|-------------------|------------|----------------|
| C-1 | v1 spec | Proposed a greenfield 6-step pipeline; the architecture wasn't greenfield | v1/v2 retracted in favor of hardening Waleed's actual architecture | v3 plan §1 |
| C-2 | v2 spec | "Two surfaces" treated as launch-scope; Inline Oto isn't built | Inline Oto is v1.1, Chat is the launch product | v3 plan §1 |
| C-3 | v2 adversarial lens | Missed the auth-gap class entirely | Acknowledged as a real prompt-engineering-judgment demerit | v3 rating revision (8.5, not 9.0) |
| C-4 | Doc 2 §7 | Router used `last_response_confidence`, a nonexistent signal | Struck (D-2.3) | This doc D-2.3, Doc 4 Wave 6.4 |
| C-5 | Doc 2 §11 | Deferred untrusted-input handling to "Phase 2" | Corrected: user's message is untrusted input today (D-2.4) | This doc D-2.4, Doc 4 Wave 7.1 |
| C-6 | Doc 2 §4 | Single reranker for two opposite retrieval targets | Corrected: two pipelines (D-3.3) | This doc D-3.3, Doc 4 Wave 5.4 |
| C-7 | Doc 2 §3.2 | `compressHistory` underspecified, would reintroduce amnesia | Corrected: fact-extraction-first contract (D-3.4) | This doc D-3.4, Doc 4 Wave 3.9 |
| C-8 | Doc 2 §6 | No boundary-adherence eval category | Corrected: added as first-class (D-3.8) | This doc D-3.8, Doc 4 Wave 1.4 |
| C-9 | Doc 2 self-score | Self-assessed 9.0; subagents scored 8.1 | The 0.9 gap is the value of the adversarial review; recorded honestly | Doc 3 §13, §15 |
| C-10 | Doc 2 §14 | "Multi-agent seam falls out for free" | Corrected: falls out *cheaply* only with `written_by` now (D-3.6) | This doc D-3.6, Doc 4 Wave 3.2 |

Ten recorded corrections across the engagement. The presence of this table is the point: a document set that produced zero self-corrections across a forensic audit, a north-star, an eleven-lens adversarial review, and a migration plan would be a document set that wasn't actually adversarial.

---

## 5. Standing principles

Not point decisions — the rules that govern future decisions. When a new decision is needed and isn't covered above, these break the tie.

| ID | Principle | Origin |
|----|-----------|--------|
| P-1 | Typed boundaries, always. No bare string crosses a table, system, or process boundary. | Doc 2 §1.1, Doc 1 Systemic Concern #1 |
| P-2 | One owner, one lifecycle per state table. No table holds two kinds of state; no field has two writers. | Doc 2 §1.1, Doc 1 Systemic Concern #2 |
| P-3 | The system is probabilistic; the engineering around it is deterministic and testable. | Doc 2 §1.1, Doc 1 Systemic Concern #3 |
| P-4 | Cost is a first-class architectural constraint, gated before every model call. | Doc 2 §1.1, Doc 1 Systemic Concern #4 |
| P-5 | The model proposes; the system disposes. No model unilateral authority over cost, mutation, or model selection. | Doc 2 §1.1, generalizes the render-trigger architecture |
| P-6 | Documentation is generated from code annotations, not maintained beside code. | Doc 2 §1.1, Doc 1 Systemic Concern #5 |
| P-7 | Every layer is independently evaluable. No layer is "tested by hoping the whole thing works." | Doc 2 §1.1 |
| P-8 | Reversible before irreversible. Nothing is deleted until its replacement has served real production traffic in parallel and been measured. | Doc 4 §0 |
| P-9 | Never change the prompt on vibes — only against the eval. (The existing "Locked Principle #8," now enforceable because the eval platform exists.) | system_prompt.ts, made real by Doc 4 Wave 1 |
| P-10 | A decision with no recorded alternative is not revisitable. Every consequential call gets a Decision Log entry. | This document |

P-9 deserves a note: it already exists in the production prompt as a cited principle but was, per Doc 1 §3.1, *unenforceable* because the eval couldn't detect a regression. The engagement's single most important infrastructural outcome (Doc 4 Wave 1) is what makes P-9 go from aspiration to enforced rule. If only one thing from this entire document set ships, the Principal Prompt Engineer (Doc 3 §1) and the AI QA Lead (Doc 3 §6) independently agreed it should be the thing that makes P-9 real.

---

## 6. The decision that matters most

If a reader takes one entry from this document: **D-2.5, the enrichment-miss UX, is the only consequential decision still open, and it is Temur's.** Every other decision is either locked, corrected, or a standing principle. This one is open, it is a product decision wearing an architecture costume, it blocks Wave 5's completion criterion, and defaulting it by engineering convenience is precisely the failure mode this engagement was commissioned to prevent.

The principal's lean is recorded honestly in D-2.5 ((b) for launch, (a) post-launch, (c) never). It is a lean, not a ruling. The ruling is Temur's, and Doc 4 Wave 5 cannot close without it.

Doc 6 — the Risk Register — is the final document. It carries the twelve highest-severity risks, headlined by the D-2.2 vector-DB tripwire with its numeric trigger now made concrete, plus the Wave 3 backfill risk, the KB exfiltration gap, and the process risk that D-2.5 staying open creates. It starts on your next turn.

— End of Doc 5.
