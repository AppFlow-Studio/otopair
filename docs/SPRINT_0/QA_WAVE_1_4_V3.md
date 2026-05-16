# QA Wave 1.4 — v3 Eval Spec (Three-Tier Retrieval Era)

**Owner:** AI QA & Evaluation Lead (subagent, Doc 3 §6)
**Status:** Sprint 0 deliverable — supersedes Wave 1.4 v2 by addition (boundary charter unchanged, five new categories layered on)
**Scoring context:** Current eval platform = 3.5/10. North-star = 8.0/10. v3 is the bridge: it turns the three-tier retrieval architecture from "trust the code review" into "trust the green CI gate."
**Brand-risk thesis (unchanged):** The failure mode that destroys Oto is not "Oto didn't know." It is "Oto confidently said the wrong thing about something it shouldn't have answered." Every category below is a tripwire against that failure mode.

---

## 1. Recap — Wave 1.4 Boundary-Adherence Charter (Unchanged)

The Wave 1.4 boundary-adherence suite, as originally chartered, remains in force exactly as written: a corpus of adversarial user messages designed to lure Oto outside its product surface (DIY repair walkthroughs, medical/legal advice, competitor recommendations, pricing guarantees, safety-critical torque specs without a sourced citation, and "just between us" off-the-record framings). Each case has a judge-based assertion that scores YES/NO on whether Oto declined or deflected to the mechanic-discovery / appointment-booking surface, with a ≥90% pass threshold across N=10 repeats per case. v3 does not soften, remove, or relax any boundary case — it adds five new programmatic categories on top, because the three-tier retrieval architecture introduced five new ways for Oto to lie confidently that did not exist when the boundary suite was written.

---

## 2. The Five v3 Categories

### Category (a) — Three-Tier Read Order Correctness

**Purpose:** Verify that each query type is resolved by the correct retrieval tier, because tier misrouting is the root cause of nearly every downstream failure (wrong disclaim tag, wrong audit trail, wrong cross-tenant behavior).

**Assertion type:** Programmatic. The eval harness inspects the response envelope's `resolved_tier` field (Tier 1 | Tier 2 | Tier 3) and compares it to `expected_tier`. No judge LLM involved.

**Repeat count:** N=10 per case (Doc 4 Wave 1.1 baseline).

**Pass threshold:** ≥95% (deterministic; the only acceptable failures are infrastructure flakes — Convex cold start, retrieval timeout fallback).

#### Eval cases

| case_id | input (scenario) | expected behavior | judge assertion (programmatic) | pass threshold |
|---|---|---|---|---|
| `tier-a-001` | User owns a 2019 Honda Civic LX with VIN already enriched (Tier 1 has `engine_oil_capacity_quarts = 4.4`). User asks: "How much oil does my car take?" | Resolves at Tier 1. Response cites the enrichment-owned structured table. No web call. No disclaim tag. | `assert response.resolved_tier == "tier_1"` AND `assert response.disclaim_tag == false` AND `assert response.web_search_invoked == false` | ≥95% |
| `tier-a-002` | User owns a 2014 Subaru Forester. Tier 1 has no entry for `transmission_fluid_change_interval_miles`. `vehicle_searched_facts` has a row for `(2014_subaru_forester, transmission_fluid_change_interval_miles)` with `verification_status: verified`. User asks: "When should I change the transmission fluid?" | Resolves at Tier 2. No web call. No disclaim tag (verified). | `assert response.resolved_tier == "tier_2"` AND `assert response.disclaim_tag == false` AND `assert response.web_search_invoked == false` | ≥95% |
| `tier-a-003` | User owns a 2008 Mazda MX-5. Neither Tier 1 nor Tier 2 has any row for `headlight_bulb_part_number`. User asks: "What headlight bulb does my Miata use?" | Resolves at Tier 3. Web search fires. Result is written into `vehicle_searched_facts` with `verification_status: unverified`. Disclaim tag renders. | `assert response.resolved_tier == "tier_3"` AND `assert response.web_search_invoked == true` AND `assert response.disclaim_tag == true` AND a `vehicle_searched_facts` row was inserted with `verification_status == "unverified"` | ≥95% |
| `tier-a-004` | User owns a 2021 Tesla Model 3. Tier 1 has `tire_pressure_front_psi = 42`. User asks: "What's the correct tire pressure for the front tires?" | Resolves at Tier 1. Structured value returned verbatim. | `assert response.resolved_tier == "tier_1"` AND `assert response.disclaim_tag == false` | ≥95% |
| `tier-a-005` | User owns a 2016 Ford F-150 XLT. Tier 1 missing. Tier 2 has `(2016_ford_f150_xlt, recommended_fuel_octane)` with `verification_status: unverified`. User asks: "What octane gas should I run?" | Resolves at Tier 2. No web call. Disclaim tag renders (unverified). | `assert response.resolved_tier == "tier_2"` AND `assert response.web_search_invoked == false` AND `assert response.disclaim_tag == true` | ≥95% |
| `tier-a-006` | Brand-new vehicle config the platform has never seen: 2007 Mitsubishi Lancer Evolution IX. No Tier 1, no Tier 2 rows. User asks: "What's the spark plug gap on this thing?" | Resolves at Tier 3. Web search fires. Inserts into `vehicle_searched_facts` as unverified. Disclaim tag renders. | `assert response.resolved_tier == "tier_3"` AND `assert response.web_search_invoked == true` AND `assert response.disclaim_tag == true` | ≥95% |

**Why six cases instead of three:** The minimum is three, but the tier matrix has three states (T1 hit, T2 hit, T3 fallback) crossed with two sub-states each (verified/unverified for T2; structured/missing for T1). Six cases give us one per cell.

---

### Category (b) — Disclaim-Tag Render Correctness

**Purpose:** Verify that the "Oto may be incorrect" render flag on the message bubble fires if and only if the data source warrants it — never silently when it shouldn't, never missing when it should.

**Assertion type:** Programmatic. The eval harness inspects the message envelope's `disclaim_tag: boolean` render flag. This is the bubble-level UI flag, NOT a sentence the model writes into the answer body. (If the model writes "I might be wrong" in prose but the render flag is `false`, that's a FAIL — we are testing the UI affordance, not the prose hedge.)

**Repeat count:** N=10 per case.

**Pass threshold:** ≥95% (deterministic).

#### Eval cases

| case_id | input (scenario) | expected behavior | judge assertion (programmatic) | pass threshold |
|---|---|---|---|---|
| `disclaim-b-001` | Tier 2 row exists for `(2018_toyota_camry_le, cabin_air_filter_part_number)` with `verification_status: unverified`. User asks: "What's the cabin air filter part number for my Camry?" | Answer renders with disclaim tag = true. | `assert response.disclaim_tag == true` AND `assert response.resolved_tier == "tier_2"` AND inspect message-bubble render envelope: `bubble.flags.disclaim == true` | ≥95% |
| `disclaim-b-002` | Tier 2 row exists for the same key with `verification_status: verified` (Waleed or Temur previously approved it). Same user message: "What's the cabin air filter part number for my Camry?" | Answer renders with disclaim tag = false. | `assert response.disclaim_tag == false` AND `assert response.resolved_tier == "tier_2"` AND `bubble.flags.disclaim == false` | ≥95% |
| `disclaim-b-003` | No Tier 1 or Tier 2 hit. User asks: "How do I reset the maintenance light on a 2012 Acura TL?" Tier 3 web search fires fresh. | Answer renders with disclaim tag = true. New Tier 2 row inserted with `verification_status: unverified`. | `assert response.disclaim_tag == true` AND `assert response.resolved_tier == "tier_3"` AND `bubble.flags.disclaim == true` | ≥95% |
| `disclaim-b-004` | Tier 1 hit for `(2020_kia_telluride, towing_capacity_pounds)` — structured enrichment data. User asks: "How much can my Telluride tow?" | Answer renders with disclaim tag = false. | `assert response.disclaim_tag == false` AND `assert response.resolved_tier == "tier_1"` AND `bubble.flags.disclaim == false` | ≥95% |
| `disclaim-b-005` | Tier 2 row exists with `verification_status: unverified` AND `report_count: 3` (multiple users reported it). User asks the question that hits this row. | Answer renders with disclaim tag = true (unchanged — disclaim is bound to verification_status, not report_count; reports affect review queue priority, not user-facing render). | `assert response.disclaim_tag == true` AND verify the render does NOT mention report count to the user | ≥95% |
| `disclaim-b-006` | Tier 3 fallback but the underlying web search returned no usable answer (low-confidence retrieval). | Oto declines politely ("I don't have a reliable source for that — want me to flag it for review?"). No fake Tier 2 row written. Disclaim tag is not applicable because no factual answer was rendered. | `assert response.resolved_tier == "tier_3"` AND `assert response.factual_answer_rendered == false` AND `assert no new vehicle_searched_facts row was inserted` | ≥95% |

---

### Category (c) — Report-Flow End-to-End

**Purpose:** Verify the user-initiated "report this answer" pathway actually writes to the database and increments the right counters, because a silently-broken report button is worse than no report button (it teaches users we don't listen).

**Assertion type:** Programmatic. Eval harness simulates the report mutation and queries the resulting DB state.

**Repeat count:** N=10 per case.

**Pass threshold:** ≥95% (deterministic).

#### Eval cases

| case_id | input (scenario) | expected behavior | judge assertion (programmatic) | pass threshold |
|---|---|---|---|---|
| `report-c-001` | Simulated user receives a Tier 2 answer with `fact_id = vsf_abc123`, `verification_status: unverified`. User taps "Report this answer" and submits with reason: "This part number doesn't match my VIN." | A new `fact_reports` row is created with `fact_id == "vsf_abc123"`, `disposition == "open"`, `reason` field populated. `vehicle_searched_facts.report_count` for `vsf_abc123` increments by 1. `last_reported_at` is set to current timestamp (within tolerance ±5s). | `assert fact_reports.findOne({fact_id: "vsf_abc123"}).disposition == "open"` AND `assert vehicle_searched_facts.findById("vsf_abc123").report_count == prior_count + 1` AND `assert vehicle_searched_facts.findById("vsf_abc123").last_reported_at` is within 5 seconds of mutation timestamp | ≥95% |
| `report-c-002` | Same fact reported by a second different user (different `reporting_user_id`) within the same minute. | Second `fact_reports` row is created (NOT deduped — each report is a separate row). `report_count` increments to prior_count + 2 total across both reports. `last_reported_at` updates again. | `assert count(fact_reports.where({fact_id})) == 2` AND `assert vehicle_searched_facts.report_count == prior_count + 2` AND each `fact_reports` row has distinct `reporting_user_id` | ≥95% |
| `report-c-003` | User attempts to report a Tier 1 answer (which has no `fact_id` because Tier 1 is structured enrichment data, not a `vehicle_searched_facts` row). | The report UI either (i) does not surface a report button for Tier 1 answers, or (ii) if it does, the mutation gracefully rejects with a typed error. No malformed row is written. No counter increments anywhere. | `assert no fact_reports row was created` AND `assert no vehicle_searched_facts row was mutated` AND the response envelope returns a structured error code `REPORT_NOT_APPLICABLE_TIER_1` | ≥95% |
| `report-c-004` | User reports the same fact twice (same `reporting_user_id`, same `fact_id`, two separate taps within 10 seconds). | Idempotency: only one `fact_reports` row exists for this (user, fact) pair. `report_count` increments by exactly 1, not 2. Second tap is a no-op or returns the existing report row. | `assert count(fact_reports.where({fact_id, reporting_user_id})) == 1` AND `assert vehicle_searched_facts.report_count == prior_count + 1` | ≥95% |
| `report-c-005` | User reports a Tier 3 fresh-web-search answer whose `vehicle_searched_facts` row was just written by the same query (race condition: report fires within the same session as the Tier 3 write). | Report row references the freshly-written `fact_id`. Counter increments correctly even though the row is seconds old. | `assert fact_reports row exists with the freshly-written fact_id` AND `assert vehicle_searched_facts.report_count == 1` (first report on a brand-new fact) | ≥95% |

---

### Category (d) — Cross-Tenant Read

**Purpose:** Verify that enrichment data is bound to the vehicle config (year/make/model/trim/VIN-derived key), not to the user who happened to trigger the enrichment — so any user asking about the same vehicle config gets the same Tier 1 answer without a disclaim tag, even if they don't "own" the originating enrichment.

**Assertion type:** Programmatic.

**Repeat count:** N=10 per case.

**Pass threshold:** ≥95% (deterministic).

#### Eval cases

| case_id | input (scenario) | expected behavior | judge assertion (programmatic) | pass threshold |
|---|---|---|---|---|
| `crosstenant-d-001` | User A previously enriched a 2017 Hyundai Elantra SE. Tier 1 has `engine_oil_capacity_quarts = 4.2` populated by User A's enrichment run. User B (different `user_id`, no relationship to User A) adds a 2017 Hyundai Elantra SE to their garage and asks: "How much oil does my Elantra take?" | User B's response resolves at Tier 1 with the value populated by User A's enrichment. No disclaim tag. No re-enrichment fires (the row already exists for this config). | `assert response.resolved_tier == "tier_1"` AND `assert response.disclaim_tag == false` AND `assert response.value == 4.2` AND `assert no new enrichment job was triggered` AND `assert no audit log entry was created for User B's read` | ≥95% |
| `crosstenant-d-002` | User A's garage contains a 2019 Ram 1500 Big Horn that was fully enriched. User B's garage does NOT contain this vehicle. User B uses the AI chat to ask a hypothetical: "What's the bed length of a 2019 Ram 1500 Big Horn?" (not tied to a vehicle they own). | If the platform supports config-keyed Tier 1 lookup for hypotheticals, the answer is Tier 1 with no disclaim. If the platform restricts Tier 1 to vehicles in the asking-user's garage, the answer falls through to Tier 2/3 with the appropriate render. **Either is acceptable — the assertion is that the behavior matches the documented product spec, not that one specific behavior occurs.** | `assert response.resolved_tier matches product spec for unowned-config queries` AND if Tier 1: `disclaim_tag == false` AND if Tier 2/3: `disclaim_tag` follows category (b) rules | ≥95% |
| `crosstenant-d-003` | User A and User B both own a 2015 Honda Accord EX-L. User A's enrichment populated `recommended_oil_viscosity = 0W-20`. User B asks the question. Then User A's record is soft-deleted (User A removes the vehicle from their garage). User B asks again. | User B's second query still resolves at Tier 1 with the same value. Tier 1 rows are config-keyed, not user-keyed — User A removing their copy of the vehicle does NOT orphan the enrichment data. | `assert response.resolved_tier == "tier_1"` on both queries AND `assert response.value == "0W-20"` on both AND `assert the Tier 1 row was not deleted when User A removed their vehicle` | ≥95% |
| `crosstenant-d-004` | User B asks about a config that has a `vehicle_searched_facts` (Tier 2) row populated by User A's prior query, with `verification_status: unverified`. User B's question hits the same key. | User B's response resolves at Tier 2 with the disclaim tag rendered (unverified). Both users see the same data because it's keyed on the vehicle config. | `assert response.resolved_tier == "tier_2"` AND `assert response.disclaim_tag == true` AND `assert the same fact_id is referenced for both users` | ≥95% |

---

### Category (e) — Audit-Log Invariant

**Purpose:** Verify that every state mutation on `vehicle_searched_facts` performed via the admin review queue (Waleed or Temur flipping `unverified → verified`, or editing the answer text, or marking a fact as `rejected`) writes a corresponding row to `vehicle_searched_facts_audit` with the action, the prior values, and the actor — because without this, we have no story for "who approved this fact" and no rollback path.

**Assertion type:** Programmatic.

**Repeat count:** N=10 per case.

**Pass threshold:** ≥95% (deterministic — this is an invariant that should be near-100% by construction; any failure is a bug in the mutation handler, not a retrieval flake).

#### Eval cases

| case_id | input (scenario) | expected behavior | judge assertion (programmatic) | pass threshold |
|---|---|---|---|---|
| `audit-e-001` | Admin (simulated as Waleed's user_id with admin role) opens the review queue. A `vehicle_searched_facts` row `vsf_xyz789` has `verification_status: unverified`. Admin clicks "Verify." | The row's `verification_status` is flipped to `verified`. `updated_at` is bumped. A new `vehicle_searched_facts_audit` row is created with: `fact_id == "vsf_xyz789"`, `action == "verify"`, `actor_user_id == waleed_user_id`, `previous_values.verification_status == "unverified"`, `new_values.verification_status == "verified"`, `timestamp` set. | `assert vehicle_searched_facts.findById("vsf_xyz789").verification_status == "verified"` AND `assert vehicle_searched_facts_audit.findOne({fact_id: "vsf_xyz789", action: "verify"})` exists AND `assert audit.previous_values.verification_status == "unverified"` AND `assert audit.actor_user_id == waleed_user_id` | ≥95% |
| `audit-e-002` | Admin (Temur) edits the `answer_text` of an unverified fact AND flips status to verified in the same atomic action. | Single audit row written with `action == "verify_and_edit"` (or two audit rows if the design separates them — assertion checks the documented design). `previous_values` contains both the prior `verification_status` AND the prior `answer_text`. | `assert audit row(s) exist matching the documented action schema` AND `assert previous_values.verification_status == "unverified"` AND `assert previous_values.answer_text == prior_text` AND `assert actor_user_id == temur_user_id` | ≥95% |
| `audit-e-003` | Admin rejects a fact (status flips to `rejected` instead of `verified`). | Audit row with `action == "reject"`, `previous_values.verification_status == "unverified"`, `new_values.verification_status == "rejected"`. The fact remains in the DB (soft-state, not deleted) so that future identical queries don't re-trigger Tier 3 and re-write the bad answer. | `assert vehicle_searched_facts.findById(fact_id).verification_status == "rejected"` AND `assert audit row exists with action == "reject"` AND `assert the fact is not hard-deleted` | ≥95% |
| `audit-e-004` | Admin attempts to verify a fact that was already verified (idempotent click). | Either (i) the mutation is a no-op and no new audit row is written, or (ii) the mutation writes an audit row with `action == "verify"` and `previous_values.verification_status == "verified"` (no actual state change). Assertion checks that no orphan/malformed audit row appears. | `assert vehicle_searched_facts.findById(fact_id).verification_status == "verified"` (unchanged) AND `assert audit invariant holds: if an audit row was written, previous_values == new_values is allowed; if no row was written, that's also allowed; what's NOT allowed is a row with mismatched fact_id or missing actor_user_id` | ≥95% |
| `audit-e-005` | Non-admin user_id attempts the verify mutation directly via the Convex function (bypassing the UI). | Mutation rejects with auth error. No state change. No audit row. | `assert mutation throws auth error` AND `assert vehicle_searched_facts.findById(fact_id).verification_status` is unchanged AND `assert no audit row was created` | ≥95% |

---

## 3. Continuous Production Checks (P1 Alerts, Not Just Eval)

Some invariants are too important to live only in CI. They must fire as production alerts because a silent regression here means trust damage that compounds before the next PR lands. These are not eval cases — they are scheduled jobs that run against the live `vehicle_searched_facts` and `vehicle_searched_facts_audit` tables and page the on-call (Waleed by default) on violation.

| invariant_id | check | cadence | severity | escalation |
|---|---|---|---|---|
| `prod-inv-001` | **Audit-row existence for every mutated fact.** Every `vehicle_searched_facts` row with `updated_at != created_at` MUST have at least one corresponding `vehicle_searched_facts_audit` row. SQL-equivalent: `SELECT vsf.id FROM vehicle_searched_facts vsf WHERE vsf.updated_at != vsf.created_at AND NOT EXISTS (SELECT 1 FROM vehicle_searched_facts_audit a WHERE a.fact_id = vsf.id)` — if this returns any rows, alert. | Every 15 min | P1 | Page Waleed; create GitHub issue tagged `audit-invariant-violation`; freeze admin review queue UI until cleared. |
| `prod-inv-002` | **No verified fact without an actor.** Every `vehicle_searched_facts` row with `verification_status == "verified"` MUST have at least one audit row with `action IN ("verify", "verify_and_edit")` and a non-null `actor_user_id`. | Every 15 min | P1 | Page Waleed. |
| `prod-inv-003` | **Disclaim-tag/verification-status coherence.** For every message rendered to a user in the last 24h whose source was Tier 2: `bubble.flags.disclaim == (source_fact.verification_status != "verified")`. Sampled (not exhaustive) via message-render logs. | Hourly, 100-message sample | P2 | Slack alert to #oto-quality; auto-open issue if >2% mismatch in any 6h window. |
| `prod-inv-004` | **Report-count drift.** `vehicle_searched_facts.report_count` must equal `count(fact_reports WHERE fact_id = X AND disposition != 'duplicate')`. Drift indicates a missed increment or a double-increment. | Daily, full-table scan | P2 | Slack alert; reconcile job auto-runs and reports delta. |
| `prod-inv-005` | **Tier-3 write integrity.** Every `vehicle_searched_facts` row created in the last 24h MUST have a populated `source_web_search_id` and a non-null `created_at`. Rows missing these are orphans from a partial write — a sign the Tier 3 → Tier 2 promotion pathway crashed mid-transaction. | Hourly | P1 | Page on-call. |
| `prod-inv-006` | **Cross-tenant leak canary.** A synthetic vehicle config (`year=9999, make=CANARY, model=LEAK_TEST`) is enriched once by a synthetic User A. A scheduled task as synthetic User B queries it every hour. Assertion: User B always gets the canary answer at Tier 1 with no disclaim. If this ever breaks, cross-tenant logic regressed. | Hourly | P1 | Page Waleed. |

The audit-log invariant (`prod-inv-001`) is the load-bearing one. If we lose it, we lose the rollback story, and the trust posture v3 was supposed to fix collapses silently.

---

## 4. Integration With Wave 1.4 CI/PR Diff

Wave 1.4 introduced a per-PR pass-rate delta: every PR runs the full eval suite, computes pass rates per category, and surfaces a delta vs. `main`. The v3 categories plug into this report as follows:

| category | typical baseline pass rate (post-stabilization) | regression risk profile | what a red diff means |
|---|---|---|---|
| **(a) Tier routing** | 99–100% | Very low under steady state. Should be near-100% by construction. A red diff almost always indicates a logic bug in the retrieval router (wrong tier selected) or a schema migration that broke a key. | Treat as build-breaker. Do not merge. |
| **(b) Disclaim-tag render** | 98–100% | Low-medium. Render-flag wiring can drift if someone touches the message envelope without realizing the flag is load-bearing for UI. | Treat as build-breaker. Do not merge. |
| **(c) Report flow** | 99–100% | Very low. Mutations are deterministic. A red diff means a bug in the report mutation handler or counter logic. | Treat as build-breaker. |
| **(d) Cross-tenant read** | 99–100% | Very low under steady state. A red diff means tenant scoping logic regressed — this is a P0 because it implies either data leak risk OR users seeing stale/wrong data from another tenant's enrichment. | Block merge. Escalate to Waleed. |
| **(e) Audit-log invariant** | 100% | Should be 100% by construction. A red diff means a mutation pathway forgot to write an audit row. | Block merge. This is the load-bearing trust invariant. |
| **Boundary adherence (1.4 unchanged)** | 90–95% | This is where the LLM nondeterminism lives. Pass rate drifts with model updates, prompt edits, and corpus growth. | A drop of >3 percentage points triggers a re-baseline review, not an automatic block. |

**Net effect on per-PR delta:** Categories (a), (c), (d), (e) should contribute near-zero variance to the delta — they are programmatic and deterministic. Their job is to catch the rare engineering regression. Category (b) is also programmatic but has one soft edge: if a designer changes the message-bubble component without coordinating with the eval team, the render-flag inspection could break. We mitigate this with a snapshot test on the bubble component itself. **Category (boundary) is where the real signal/noise tradeoff lives** — that's where judge variance and prompt drift produce per-PR jitter, and that's where the 90% threshold (rather than 95%) gives us room to absorb LLM nondeterminism without paging on every PR.

---

## 5. Rationale (QA Lead Voice)

I picked these five categories because each one corresponds to a distinct way the three-tier retrieval architecture introduces a new lying surface — a new place where Oto can confidently say something false without anyone noticing until a user reports it (or, worse, until a user does NOT report it and just quietly loses trust in the product).

- **Tier routing (a)** is the foundation. If we route wrong, every downstream check is operating on the wrong data, and the disclaim tag becomes a coin flip. We score it programmatically because tier identity is a discrete machine-readable signal — there is no excuse for a judge LLM here.

- **Disclaim-tag render (b)** is the user-facing contract: when Oto is uncertain, the user must see it. The render flag — not a prose hedge — is the contract, because prose hedges are sampled stochastically by the model and prose hedges in unverified answers create the worst possible failure mode: an answer that *sounds* hedged but the user reads as authoritative. The bubble flag is non-negotiable; the prose is incidental.

- **Report flow (c)** is the user's escape hatch when (b) fails. If the report button is broken, we have no signal that (b) is failing, and trust erodes silently. Reports are the input to the admin review queue, which is the input to verification, which is the input to (e). The whole loop hinges on this mutation being correct.

- **Cross-tenant read (d)** is the architectural property that lets enrichment scale: every user benefits from every other user's enrichment, because data is keyed on the vehicle config, not the user. If we regress on this, we lose the network effect AND introduce the risk of false personalization ("Oto says my car has X" when X was actually some other user's edge-case answer).

- **Audit-log invariant (e)** is the rollback story. Every fact that becomes "verified" needs a name attached and a previous-state snapshot, because the day a verified fact turns out to be wrong (and that day will come), we need to know who approved it, when, and what the prior state was. Without (e), verification is theater.

**What a missing category would look like (so a reviewer can challenge gaps):**

A reviewer should challenge this spec if they think I'm missing one of the following. I've considered each and either folded it into the five above or explicitly deferred it:

1. **Latency / SLA correctness.** Not in scope for QA Wave 1.4 v3 — that's Doc 5's load-test wave. Tier routing pass-rate doesn't tell us if Tier 1 is fast enough; that's an SRE concern.

2. **Web-search source-quality scoring.** Tier 3 fires a web search, but I'm not asserting "the answer is correct" — I'm asserting "the disclaim tag rendered." Source quality is a separate eval category (call it "v3.f, retrieval-grounded factuality") and it should be its own wave because it requires a different judge architecture (citation verification, not behavior verification).

3. **Multi-vehicle disambiguation.** If a user has three vehicles in their garage and asks "what oil does my car take?" without specifying which one, does Oto ask which vehicle or pick the wrong one? This is a separate boundary-like category about query grounding, not retrieval correctness. I'd add it as v3.g if pre-launch UX testing shows users do this often.

4. **Audit-row completeness on automated (non-admin) writes.** Currently (e) only covers admin edits via the review queue. The Tier 3 → Tier 2 promotion is also a state-change on `vehicle_searched_facts` (insert, not update) and arguably deserves its own audit trail with `action == "tier_3_promote"` and `actor: "system"`. I considered adding this as a sixth case in (e) but deferred — the production invariant `prod-inv-001` catches it (any updated_at != created_at without an audit row alerts), so the eval coverage isn't load-bearing.

5. **Stale enrichment detection.** A 2019 Civic's tire-pressure spec doesn't change, but a 2023 model-year vehicle's recall list does. We don't yet have a TTL story for Tier 1. Not in v3 scope. Flagging for the next wave.

If a reviewer points to a sixth gap I haven't anticipated, that's exactly the conversation this spec is meant to provoke before we lock CI gates around it.

---

## 6. Summary Table — All v3 Categories at a Glance

| category | assertion type | N | threshold | CI behavior on red | production alert |
|---|---|---|---|---|---|
| (a) Tier routing | programmatic | 10 | ≥95% | block merge | — |
| (b) Disclaim-tag render | programmatic | 10 | ≥95% | block merge | prod-inv-003 (P2) |
| (c) Report flow | programmatic | 10 | ≥95% | block merge | prod-inv-004 (P2) |
| (d) Cross-tenant read | programmatic | 10 | ≥95% | block merge + escalate | prod-inv-006 (P1 canary) |
| (e) Audit-log invariant | programmatic | 10 | ≥95% | block merge | prod-inv-001, 002 (P1) |
| (Wave 1.4 boundary) | judge-based | 10 | ≥90% | re-baseline review, not auto-block | — |

---

**End of QA_WAVE_1_4_V3.md**
