# Oto AI — Doc 6 of 6: The Risk Register

**Author:** Principal AI Engineering, acting on AB / Temur’s behalf  
**Date:** May 15, 2026  
**Purpose:** The twelve highest-severity risks the Oto architecture and its migration carry. Each is specified so it can be *monitored*, not just noted. A risk without a detection signal is a worry; a risk with one is something you can manage.  
**This closes the six-document engagement.** Docs 1–5 diagnose, design, challenge, sequence, and decide. This one is the thing the team keeps open on a screen.

-----

## 0. How to read this register

A risk register that is read once and filed is useless. This one is built to be *monitored*. Every entry has:

- **Severity** — what it costs if it fires (Critical / High / Medium)
- **Likelihood** — how probable, given the mitigations in place (High / Medium / Low)
- **Detection signal** — the *specific, measurable* thing that tells you it’s happening or about to. This is the most important field. A risk you can’t detect is a risk you can only post-mortem.
- **Mitigation** — what’s already designed to reduce it, and what isn’t
- **Irreversibility class** — `Reversible` (recoverable with effort) / `Costly` (recoverable, expensive) / `Irreversible` (some permanent loss). This determines how much pre-emptive paranoia is justified.
- **Owner** — who watches the signal

Risks are ordered by **Severity × Likelihood × Irreversibility**, not by subsystem. The top of this list is where attention goes first.

The single most important framing: **most of these risks are not failures of the architecture — they are the architecture’s known edges, made explicit so they’re managed rather than discovered.** A system with no risk register isn’t safe; it’s just unmonitored.

-----

## R-1 — The eval gate ships late or weak, and the migration proceeds on faith anyway

|                   |        |
|-------------------|--------|
|**Severity**       |Critical|
|**Likelihood**     |Medium  |
|**Irreversibility**|Costly  |
|**Owner**          |Waleed  |

**The risk.** Doc 4 Wave 1 (eval platform) is the gate every later wave depends on. It ships no features, so under delivery pressure it is the most tempting wave to ship thin (“we’ll add the statistical rigor later”) or to skip in favor of starting the visible migrations. If the gate is weak when Waves 3–6 cut over, every migration is validated by hope — the exact failure Doc 1 §3.10 and Doc 3 §6 named as a top systemic concern, re-committed at the worst possible moment.

**Why it’s the #1 risk.** It is the risk that *disables the detection of every other risk in this register.* A weak eval gate doesn’t just fail itself — it removes the instrument that would catch R-3, R-4, R-7, R-9. It is the single point whose failure is silent and compounding.

**Detection signal.** Concrete and binary: *can the platform produce the sentence “version B regresses case X by Y% with statistical confidence Z” before any Wave 3+ cutover?* If that sentence is not producible, the gate is not done, regardless of what the wave board says. Secondary signal: per-case repeat count in CI < 10, or zero LLM-judge assertions in the trust-protocol and boundary categories.

**Mitigation.** Designed: Wave 1 is sequenced first explicitly (Doc 5 D-3.7, “the single most important sequencing decision”). Item 1.6 (prompt-version stamp) rides into Wave 0 so version attribution is retroactive. Not designed, and the gap: there is no *structural* enforcement that Waves 3–6 cannot start before Wave 1’s promotion criterion is met — it relies on Waleed holding the line. **Recommended addition:** a literal CI check that fails any Wave 3+ PR if the eval platform’s self-test (the “can it produce the sentence” check) doesn’t pass. Make the dependency a build failure, not a discipline.

-----

## R-2 — Wave 3 backfill corrupts memory state

|                   |                                     |
|-------------------|-------------------------------------|
|**Severity**       |Critical                             |
|**Likelihood**     |Low                                  |
|**Irreversibility**|Costly (not Irreversible — by design)|
|**Owner**          |Waleed                               |

**The risk.** Wave 3 step 3.4 is the migration’s *only one-way data move*: existing `ai_conversations` state is backfilled into the five new memory tables. A wrong transformation (a fact mis-typed, a mood mis-mapped, an arc truncated) corrupts the memory of every existing conversation simultaneously. Memory corruption is the worst class of bug in a conversational system because it’s silent — the model behaves plausibly on corrupted memory, just wrongly.

**Why it’s not Irreversible.** Doc 4’s strangler sequence is engineered specifically so this risk is *Costly, not Irreversible*: step 3.5 (shadow-read validation) runs working-memory construction from BOTH old and new tables, diffs them, and **serves from old** until the mismatch rate is ~0. The old tables are retained through Wave 7. The backfill being wrong is recoverable because the source of truth doesn’t move until the new path is proven. This is the entire reason the strangler sequence exists.

**Detection signal.** The shadow-read mismatch rate (step 3.5). It must trend to ~0 before the 3.7 flip. A mismatch rate that plateaus above zero, or spikes after looking clean, is the backfill being wrong. This signal exists *before* any user is affected — that’s the design working.

**Mitigation.** Designed: dual-write + shadow-read + old-path-authoritative-until-proven + old-tables-retained-until-Wave-7. This is one of the better-protected risks in the register *because* Doc 4 treated Wave 3 as the highest-risk wave and built the sequence around exactly this. The residual risk: the shadow-read diff itself could be too lenient (comparing the wrong fields, or normalizing away a real difference). **Recommended:** the diff’s own correctness gets a small eval — inject a known-bad backfill into a test deployment, confirm the shadow-read diff catches it. Test the detector, not just the thing detected.

-----

## R-3 — The KB moat is silently exfiltrated

|                   |                                                                  |
|-------------------|------------------------------------------------------------------|
|**Severity**       |High (Critical if the moat is the company’s primary defensibility)|
|**Likelihood**     |Medium                                                            |
|**Irreversibility**|Irreversible                                                      |
|**Owner**          |Temur (strategic) / Waleed (control)                              |

**The risk.** The vehicle-reference KB — the asset leadership is betting the company on — is readable by any authenticated user, one conversation at a time. An authenticated competitor (or a scraper farm of fake accounts) can reconstruct it by asking Oto questions. Doc 2 protected the KB from *bad writes* (AI-read-only, Doc 2 §3.7) and never considered protecting it from *bulk reads*. Cost-velocity anomaly detection (Doc 2 §9) won’t catch it — reading cached reference facts is cheap, so a scraper doesn’t trip a cost alarm.

**Why it’s Irreversible.** Exfiltrated data cannot be un-exfiltrated. If the moat is reconstructed, the strategic advantage is permanently gone — there is no recovery action, only prevention. This is the only Irreversible-class risk that is also Medium-likelihood, which is why it ranks above several higher-severity-but-reversible items.

**Detection signal.** Per-user reference-fact read volume over a rolling window, compared against a legitimate-use ceiling. A legitimate user asks a handful of factual spec questions per conversation. A scraper asks hundreds, or thousands across many accounts. The signal: any account (or any cluster of accounts with correlated behavior) whose reference-fact read count exceeds N× the 95th-percentile legitimate user. The hard part — and the honest gap — is the *cross-account* version (a scraper farm spreading reads thin across many fake accounts to stay under any single-account threshold). That requires account-cluster behavioral correlation, which is harder and is not yet designed.

**Mitigation.** Designed: Doc 4 Wave 7.3 (per-user reference-fact read rate limit) and Doc 5 D-1.2 (the strategic decision to protect bulk reads, not just bad writes). The gap, stated honestly: Wave 7.3 has *no prior art in the codebase* and the cross-account scraper-farm case is unsolved. **Recommended:** the single-account rate limit ships in Wave 7 as designed. The cross-account detection is flagged as a *known unsolved problem* — not pretended-solved. For a company-defining moat, “we rate-limit single accounts and we know the farm case is open” is honest; “we have exfiltration controls” would be the convention-over-control thinking this whole engagement argues against.

-----

## R-4 — Prompt regression ships invisibly post-launch

|                   |                                            |
|-------------------|--------------------------------------------|
|**Severity**       |High                                        |
|**Likelihood**     |High (without R-1 mitigated) / Low (with it)|
|**Irreversibility**|Reversible                                  |
|**Owner**          |Waleed / whoever owns prompt changes        |

**The risk.** The prompt is the core IP and the most-edited artifact. A prompt change that improves one behavior and silently degrades another (the classic LLM prompt-tuning failure) ships, and because the current eval runs each case once, the regression is indistinguishable from dice. Users experience “Oto got worse” with no attributable cause. This is the risk the existing “Locked Principle #8” was meant to prevent and currently *cannot*, because the eval can’t detect a regression (Doc 1 §3.1, Doc 3 §1).

**Why likelihood is conditional on R-1.** This risk is High *if the eval gate is weak* and Low *if it’s strong*. It is almost entirely a derivative of R-1. The reason it’s listed separately: it’s the risk users actually *feel*, so it’s the one whose business impact is most direct, and it’s worth tracking the user-facing symptom independently of the infrastructural cause.

**Detection signal.** Two layers. Pre-production: the eval platform’s per-case pass-rate delta on every prompt PR (this is R-1’s deliverable doing its job). Post-production: the session-quality composite (Doc 2 §10.1) showing a sustained drop correlated in time with a prompt-version change — which is detectable *because* item 1.6 stamps prompt version into every conversation. The post-production signal is the safety net for whatever the pre-production gate misses.

**Mitigation.** Designed: the prompt-change protocol (Doc 4 Wave 1.5 — PR → CI eval → A/B at 5% → 100% → changelog), prompt versioning (1.6), the A/B framework. This is well-mitigated *conditional on R-1*. No additional mitigation needed beyond ensuring R-1 doesn’t fire — which is why R-1 is #1.

-----

## R-5 — The deterministic router mis-calibrates, and it fails consistently instead of randomly

|                   |          |
|-------------------|----------|
|**Severity**       |High      |
|**Likelihood**     |Medium    |
|**Irreversibility**|Reversible|
|**Owner**          |Waleed    |

**The risk.** Doc 5 D-2.3 corrected Doc 2 by removing the fictional confidence signal — a real fix. But the LLM Reliability Engineer’s deeper point (Doc 3 §10) stands: deterministic routing doesn’t *eliminate* the calibration problem, it *relocates* it from runtime to configuration. A mis-set `SONNET_DIAG_THRESHOLD` over-escalates (cost burn) or under-escalates (quality loss on hard turns) — and now it fails *consistently*. Consistent failure is more debuggable but no less real, and a register that pretends the router fix closed this risk would be repeating Doc 2’s oversell.

**Detection signal.** Sonnet escalation rate vs. the calibration target, from the (now-fixed, post-Wave-0) telemetry: escalation rate sustained well above target → over-escalation (cost). Escalation rate near zero combined with a drop in session-quality on long diagnostic conversations → under-escalation (the hard turns aren’t getting the better model). The second signal is the dangerous one because low escalation *looks* like a cost win until you correlate it with quality.

**Mitigation.** Designed: deterministic, observable-signal-only router (Doc 4 Wave 6.4–6.6), shadow-mode before live (6.5), server-side budget caps so the worst case is bounded (6.7). The thresholds are explicitly tunable and eval-gated. The honest residual: the thresholds’ *initial* values are guesses until TestFlight/production data exists — Doc 3 §10 said this plainly and it remains true. **Recommended:** ship the router with deliberately conservative thresholds (err toward under-escalation, since over-escalation is a direct cost burn while under-escalation degrades gracefully), then tune up using production data. Conservative-then-loosen is safer than aggressive-then-tighten for a cost-bearing routing decision.

-----

## R-6 — `compressHistory` reintroduces the amnesia the memory redesign exists to eliminate

|                   |          |
|-------------------|----------|
|**Severity**       |High      |
|**Likelihood**     |Medium    |
|**Irreversibility**|Reversible|
|**Owner**          |Waleed    |

**The risk.** The Context Engineering Specialist (Doc 3 §7) named `compressHistory` the single most likely source of silent quality degradation in the north-star. Summarization is lossy in invisible ways. If the fact-extraction-first contract (Doc 5 D-3.4) is implemented incorrectly — facts compressed alongside texture rather than extracted first — Oto starts “forgetting what the user just told it,” which is the *exact* failure the entire memory redesign was built to eliminate, reintroduced through the compression layer at the moment the redesign was supposed to fix it. The cruelest version of this risk: the memory redesign ships, looks successful, and quietly fails through its own compression step.

**Detection signal.** The specific eval case mandated in Doc 4 Wave 3.9: a long conversation → compress → ask a question whose answer depends on a turn-3 detail → assert the answer is still correct. This case failing is the direct signal. It must be a *gating* case (Wave 3.9 cannot promote without it passing), not an advisory one. Secondary production signal: a rise in users re-stating information within a conversation (the behavioral fingerprint of “Oto forgot”), detectable from conversation transcripts.

**Mitigation.** Designed: the fact-extraction-first contract is structurally enforced by sequencing (Wave 3.9 is ordered *after* the facts layer is authoritative, 3.2–3.8) and gated by the eval case above. This is well-mitigated *if the gating case is real and strict*. The residual risk folds into R-1 (a weak eval gate means a weak compression gate). No separate mitigation needed beyond R-1 holding.

-----

## R-7 — Retrieval is confidently wrong on a factual question

|                   |                                                     |
|-------------------|-----------------------------------------------------|
|**Severity**       |High                                                 |
|**Likelihood**     |Medium                                               |
|**Irreversibility**|Reversible (per incident) / Costly (cumulative trust)|
|**Owner**          |Waleed                                               |

**The risk.** A user asks “what oil does my engine take,” retrieval returns a plausible-but-wrong reference fact (wrong variant, stale data, a fragmented-topic mismatch), and Oto states it confidently. For a trust-first brand, a confident wrong factual answer is worse than “I don’t know” — it’s the failure the trust protocol exists to prevent, occurring upstream of the trust protocol in the retrieval layer where the protocol can’t catch it. Each incident is individually reversible (correct the fact); cumulatively, confident-wrong-answers erode the exact thing the brand is built on.

**Detection signal.** Pre-production: the labeled retrieval eval set’s precision@3 on the *reference* pipeline (Doc 4 Wave 5.1–5.2). The reference pipeline’s precision is the direct measure of “how often is a confident factual answer wrong.” Doc 4 Wave 5.2 explicitly measures *current* retrieval against this set for the first time — Doc 3 §4 warned “the number may be uncomfortable.” That discomfort is the signal doing its job. Post-production: thumbs-down rate on factual-answer turns specifically, segmented from diagnostic/booking turns.

**Mitigation.** Designed: two-pipeline retrieval with the reference pipeline precision-tuned and high-threshold (Doc 5 D-3.3) — below threshold it returns “let me check,” not a guess. The labeled eval set gates reranker tuning (Wave 5.1 before 5.5). The miss-path feeds enrichment rather than guessing (Wave 5.7). This is well-designed. The residual risk lives in R-12 (the open enrichment-miss UX decision) and in the honest fact that precision is being measured for the first time and the baseline is unknown until Wave 5.2 runs.

-----

## R-8 — The vector-DB substrate constraint arrives faster than “years” (Fight 2, made concrete)

|                   |                                                          |
|-------------------|----------------------------------------------------------|
|**Severity**       |High                                                      |
|**Likelihood**     |Medium (conditional: High *if the moat strategy succeeds*)|
|**Irreversibility**|Costly                                                    |
|**Owner**          |Temur (the bet) / Waleed (the signal)                     |

**The risk.** Doc 5 D-2.2 (Temur’s Fight-2 ruling) established this as a monitored risk with a numeric trigger rather than a Doc 2 footnote. The substance: Convex’s vector index is held constant on the assumption the vector workload stays small. That assumption fails *precisely if the KB-moat strategy works* — because then the vector count grows with traffic AND with enrichment-pipeline output simultaneously. Doc 2’s substrate call is correct for the pessimistic case and wrong for the case leadership is betting on. The risk isn’t “Convex is bad” — it’s “the substrate decision is correct under failure and wrong under success, and success is the plan.”

**The numeric trigger (this is the Fight-2 deliverable, now concrete).** Revisit the vector-DB substrate decision (Doc 5 D-3.1) when *either* of these crosses threshold, whichever first:

1. **Scale trigger:** `vehicle_reference_facts` row count with populated embeddings exceeds **250,000**. Rationale: Convex’s vector index performs well into the low-hundreds-of-thousands; 250K is the conservative shoulder where dedicated-vector-DB advantages (better ANN algorithms, metadata-filtered search at scale, reindex tooling) begin to materially outperform. This is a leading indicator — it fires before users feel pain.
1. **Latency trigger:** p95 retrieval latency (the hybrid structural+vector path, measured at Doc 2 §10’s aggregation layer) exceeds **400ms** sustained over a rolling 7-day window. Rationale: this is a lagging indicator — it fires when users *are* feeling it. If the latency trigger fires before the scale trigger, the scale assumption was wrong and the migration is now urgent rather than planned.

Either trigger firing moves the vector-DB migration from “monitored risk” to “active planning.” Both numbers are explicitly first-cut estimates to be calibrated once production retrieval telemetry exists (Doc 4 Wave 1.7 makes p95 retrieval latency measurable; the row-count is trivially queryable). The *existence* of a numeric trigger is the Fight-2 decision; the *exact numbers* are tunable starting points, recorded so the revisit is proactive instead of reactive.

**Detection signal.** The two triggers above, computed by the Wave 1.7 aggregation cron, surfaced on the observability dashboard with the thresholds drawn as lines. The team should *see* the row count and p95 latency climbing toward the lines months before they cross — that’s the entire point of making it a monitored number instead of a footnote.

**Mitigation.** The migration itself is Costly-not-Irreversible: a vector-DB swap is a well-understood (if laborious) migration, and the strangler discipline (P-8) applies — dual-read against both indices, validate, cut over. The mitigation *is* the early warning: a planned migration triggered at 250K rows is a project; a reactive one triggered by a production latency incident at unknown scale is a fire. The numeric trigger converts a fire into a project.

-----

## R-9 — Boundary failures: Oto confidently answers what it should refuse

|                   |                                                      |
|-------------------|------------------------------------------------------|
|**Severity**       |High (brand-defining)                                 |
|**Likelihood**     |Medium                                                |
|**Irreversibility**|Reversible (per incident) / Costly (brand, cumulative)|
|**Owner**          |Waleed / prompt owner                                 |

**The risk.** The AI QA Lead (Doc 3 §6) identified this as the failure mode with zero eval coverage in both the current system and Doc 2: not “Oto didn’t know” but “Oto confidently said the wrong thing about something it shouldn’t have answered” — a mechanical-repair walkthrough, a diagnostic certainty claim, a lemon-law case evaluation. For a brand whose entire premise is “the honest co-pilot that knows its limits,” this is the single most brand-corrosive failure class. The prompt has extensive scope-boundary rules; nothing currently tests whether they hold.

**Detection signal.** The boundary-adherence eval category (Doc 4 Wave 1.4, Doc 5 D-3.8) — inputs deliberately positioned at the capability edge, each with a judge assertion “did Oto stay inside its boundary?” Pass threshold ≥90%. This category is also a hard dependency of Wave 2 (the interaction moments are boundary behavior), so it cannot be skipped without blocking launch-scope work. Post-production: a sampled human review of turns flagged by the judge as boundary-adjacent.

**Mitigation.** Designed: the boundary eval category is first-class and gates Wave 2. The prompt’s existing scope rules are strong (Doc 1 §3.1 rated the prompt 8.5 partly for this). The mitigation is solid *once Wave 1.4 exists*; again a derivative of R-1. The honest residual: boundary cases are adversarial by nature and the eval set will never be exhaustive — there will always be an unanticipated edge. The mitigation is not “cover every edge” (impossible) but “the category exists, is gating, and grows every time production surfaces a new edge.” A boundary failure in production is acceptable *once*; the same one twice means the eval set didn’t learn.

-----

## R-10 — Feature work during Waves 3–6 creates new old-path debt

|                   |          |
|-------------------|----------|
|**Severity**       |Medium    |
|**Likelihood**     |High      |
|**Irreversibility**|Reversible|
|**Owner**          |Waleed    |

**The risk.** Doc 4 §10 named this the discipline risk: the migration explicitly does not halt feature development, but features built during Waves 3–6 against the *old* interfaces (old memory fields, old tool catalog, old retrieval) create fresh debt that Wave 7 must then clean — potentially faster than Wave 7 can clean it. The strangler migration assumes the old paths stop accreting new dependents; ongoing feature work violates that assumption unless disciplined.

**Detection signal.** A simple, mechanical one: count of new references to deprecated-path symbols (old `ai_conversations` state fields, `OTO_TOOLS`/`TOOL_NAMES_V1`, old retrieval functions) introduced *after* the corresponding new path went live in shadow. This is grep-able and could be a CI warning. A nonzero and growing count is the risk firing.

**Mitigation.** Designed: Doc 4 §10’s stated discipline (“new features built during Waves 3–6 should target the new architecture’s interfaces where they exist”). The honest weakness: “should” is discipline, not enforcement. **Recommended:** once a new path is live in shadow, add a CI lint that *warns* (not blocks — blocking would halt legitimate work) on new references to the superseded symbols, with the warning naming the new interface to use instead. Make the right path the path of least resistance by making the wrong path noisy.

-----

## R-11 — The interaction moments ship as engineering, not as designed language

|                   |                                     |
|-------------------|-------------------------------------|
|**Severity**       |Medium (High for a trust-first brand)|
|**Likelihood**     |Medium                               |
|**Irreversibility**|Reversible                           |
|**Owner**          |Temur                                |

**The risk.** Temur ruled Fight 5: the three interaction moments (escalation handoff, cost-cap message, not-yet-known) are launch-scope (Doc 5 D-1.3). The risk is that under delivery pressure they ship *functionally* — a working escalation, a working cap, a working miss-message — but with generic language rather than the prompt-caliber designed language the ruling intended. A working-but-generic cost-cap message (“You’ve reached your limit”) technically satisfies “the moment exists” while completely failing the brand intent (“the moment protects the user and preserves trust”). The Human-AI Interaction Strategist’s core warning (Doc 3 §15): this is the finding most likely to be ignored *because* it doesn’t fit in a schema.

**Detection signal.** Each of the three moments has a boundary-category eval case with a *qualitative* judge assertion, not just a functional one. Not “did the cap message appear” but “did the cap message provide a next action and avoid scarcity/penalty framing” (Doc 4 Wave 2.2). The judge assertion failing — or, more insidiously, not existing because someone wrote a functional assertion instead of a qualitative one — is the signal. **The meta-signal:** if the Wave 2 eval cases test *presence* rather than *quality*, the risk has already fired silently.

**Mitigation.** Designed: Wave 2 sits ahead of all engineering migrations precisely so it isn’t deprioritized; each moment requires contrastive examples and a qualitative judge assertion ≥90%. The residual is cultural, not technical: the team must hold that “the moment works” is not “the moment is done.” Temur owns this because it’s a product-completeness judgment, and the engagement’s strongest single recommendation (Doc 3 §15) is that he weight it accordingly. No further technical mitigation — this one is held by judgment, and naming it here is the mitigation.

-----

## R-12 — The enrichment-miss UX stays open and gets defaulted by deadline

|                   |                                                 |
|-------------------|-------------------------------------------------|
|**Severity**       |Medium (process risk with a product-quality tail)|
|**Likelihood**     |Medium                                           |
|**Irreversibility**|Reversible                                       |
|**Owner**          |Temur                                            |

**The risk.** Doc 5 D-2.5 is the one consequential decision still OPEN. It blocks Wave 5’s completion criterion. The risk is not the decision itself (all three options are legitimate) — it’s that it stays open until Wave 5 is under pressure, and then gets defaulted by *engineering convenience* (Waleed picks the easiest-to-build option under deadline) rather than *product judgment*. That is the precise failure mode the entire six-document engagement was commissioned to prevent: a product decision made by accident because it was disguised as an architecture gap.

**Detection signal.** Binary and unambiguous: is D-2.5 marked LOCKED with Temur as the recorded owner of the ruling, *before* Wave 5 reaches step 5.8? If Wave 5 development reaches the enrichment-miss-path wiring and D-2.5 is still OPEN, the risk has fired — whatever gets built at that point is the default-by-deadline outcome, regardless of how it’s labeled.

**Mitigation.** Designed: Doc 4 explicitly structured Wave 5 so the *in-moment language* ships regardless (the Wave 2.3 work), decoupling the brand-critical part from the open decision — so even if D-2.5 lags, Oto doesn’t *guess at facts*, it gracefully says “I won’t guess where wrong is worse.” The follow-up *mechanism* (a/b/c) is what’s gated. The principal’s lean is on record (D-2.5: (b) launch, (a) post-launch, (c) never) so a decision can be made quickly when Temur is ready. **The mitigation is to make the call now or explicitly schedule when it will be made.** It is the cheapest risk on this register to close — it requires a sentence from Temur, not engineering. Leaving it open is a choice, and this entry exists so it’s a *visible* choice.

-----

## Risk summary matrix

|ID  |Risk                                    |Sev |Lik |Irrev     |The one signal that matters                  |
|----|----------------------------------------|----|----|----------|---------------------------------------------|
|R-1 |Eval gate ships weak                    |Crit|Med |Costly    |Can it produce “B regresses X by Y% conf Z”? |
|R-2 |Wave 3 backfill corrupts memory         |Crit|Low |Costly    |Shadow-read mismatch rate → ~0               |
|R-3 |KB moat exfiltrated                     |High|Med |**Irrev** |Per-user reference-read volume vs. ceiling   |
|R-4 |Prompt regression ships invisibly       |High|Med*|Rev       |Per-PR pass-rate delta + post-hoc quality    |
|R-5 |Router mis-calibrates consistently      |High|Med |Rev       |Escalation rate vs. target, both directions  |
|R-6 |compressHistory reintroduces amnesia    |High|Med |Rev       |The turn-3-detail gating eval case           |
|R-7 |Retrieval confidently wrong             |High|Med |Rev/Costly|Reference-pipeline precision@3               |
|R-8 |Vector-DB constraint arrives early      |High|Med*|Costly    |250K embedded rows OR p95 > 400ms/7d         |
|R-9 |Boundary failures                       |High|Med |Rev/Costly|Boundary eval category ≥90%                  |
|R-10|New old-path debt during migration      |Med |High|Rev       |Count of new deprecated-symbol refs          |
|R-11|Interaction moments ship generic        |Med*|Med |Rev       |Qualitative (not functional) judge assertions|
|R-12|Enrichment-miss UX defaulted by deadline|Med |Med |Rev       |Is D-2.5 LOCKED before Wave 5.8?             |

* conditional likelihood — see entry.

**Two structural observations from the matrix:**

1. **R-1 is the keystone risk.** R-4, R-6, R-9, and partially R-7 are all derivatives — their likelihood collapses from Medium/High to Low the moment R-1 is genuinely mitigated. The single highest-leverage risk action in the entire register is making the eval gate real and structurally enforced (R-1’s recommended CI-dependency). Doing that one thing de-risks four others.
1. **The only Irreversible risk (R-3) is also the only one with an honestly-unsolved component** (the cross-account scraper-farm case). Every other risk is either reversible or has a complete mitigation designed. R-3 is the one place the register says, plainly, “this is not fully solved and pretending otherwise would be the exact failure this engagement exists to prevent.” For a company-defining moat, that honesty is the most important sentence in this document.

-----

## Closing — the engagement, in one page

Six documents. The arc:

- **Doc 1** found the current system is a thoughtful prompt on a fragile substrate — aggregate 5.4/10, with cost governance (2.5) and model routing (3.0) as the exposed edges, and five systemic concerns: untyped boundaries, conflated state, probabilistic-system-treated-deterministically, cost-as-afterthought, docs-as-oral-tradition.
- **Doc 2** designed the north-star — twelve subsystems, keystone being a six-table memory architecture — and honestly self-assessed 9.0.
- **Doc 3** convened eleven hostile specialists who marked the north-star down to 8.1, corrected two of its errors outright, and surfaced five real fights. The current-state mean (5.3) independently corroborated Doc 1’s 5.4 within 0.1.
- **Doc 4** sequenced the migration as a strangler fig — no wave breaks the system, no wave halts features, the highest-risk wave (memory) has no point of no return until production proves the new path.
- **Doc 5** logged every decision with its alternatives, recorded ten self-corrections, and isolated the one decision still genuinely open (D-2.5, Temur’s).
- **Doc 6** — this — made the architecture’s known edges monitorable rather than discoverable, and made the Fight-2 vector-DB tripwire concrete (250K rows OR p95 > 400ms/7d).

The honest synthesis across all six: **Oto’s architecture is fixable, the fixes are well-bounded, and the single most important thing in 50,000 words is small** — build the eval gate first and enforce it structurally (R-1, Doc 4 Wave 1, Doc 5 D-3.7, P-9). It de-risks four other risks, makes “never change the prompt on vibes” finally enforceable, and is the difference between a migration that’s safe and one that’s faith-based.

The single most important thing only Temur can do is rule on D-2.5 (R-12) and hold the line on R-11 (interaction moments shipping as designed language, not generic strings). Neither is an engineering task. Both are the product-judgment calls the engineering was built to serve.

Everything else is execution, and execution is Waleed’s.

— End of Doc 6. End of the engagement.