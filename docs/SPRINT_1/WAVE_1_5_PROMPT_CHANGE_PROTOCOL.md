# Wave 1.5 — Prompt-Change Protocol

**Author:** Principal Prompt Engineer (Doc 3 §1)
**Status:** v1 — Sprint 1 Day 5 deliverable. Effective immediately. First user is the queued Wave 2.4 prompt-language PR (`docs/SPRINT_0/INTERACTION_WAVE_2_4_V3.md`).
**Authority:** Doc 3 §1 ("never change the prompt on vibes, only against the eval" — P-9) + Doc 4 Wave 1.5.
**Owner of this protocol:** Principal Prompt Engineer. Ratification: Waleed.
**Non-negotiable:** Hill P-9. This document is the mechanism that makes P-9 enforceable.

---

## 0. What this protocol is for

The system prompt at `convex/oto/system_prompt.ts` is a **living artifact that gets edited frequently and breaks subtly**. A wording change in the Voice section can pull pass-rate down on Cat F refusal cases. A hedging-language tweak in the Wave 2.4 region can change `disclaim_tag_correctness` on the labeled set. A "let me just rephrase the locked principle" edit can quietly invalidate Locked Principle #4 across an entire production cohort.

The fix is not "be careful." The fix is **a process that uses the eval to detect regressions before merge** and **a production observation window before 100% rollout**. P-9 says: never change the prompt on vibes, only against the eval. This document is how that gets enforced.

The five-step protocol below is the entire mechanism. Nothing else is in scope for this doc. The eval infrastructure (Wave 5.1 labeled set, Wave 1.4 v3 cases, the `scripts/eval/` harness, `lib/metrics.ts` with Wilson CI) is already built — Wave 1.5 is the **human protocol** that wraps it.

---

## 1. The Five Steps

### Step 1 — PR shape

A prompt change MUST be proposed as a pull request whose only `convex/oto/` change is to `convex/oto/system_prompt.ts`. PRs that bundle a prompt change with code changes are split before review; the prompt half goes through this protocol, the code half through normal review.

**Required commit-message format** (also the PR description):

```
prompt: <one-line description, present-tense imperative>

Rationale:
<2–6 sentences. Why this change. What user-visible problem it fixes
or what production observation triggered it. NOT "feels better" —
P-9 is the whole point of this protocol.>

Expected eval delta:
<Per-case prediction. What categories should improve, which should
hold, which are at risk. Express as "Cat E pass-rate +0.10, Cat F
hold ≥ 0.95, no regression on Locked Principle #4." If you can't
predict at least directionally, the change is vibes — go back and
think harder.>

Locked principles touched:
<List the principle numbers (e.g., "P-4, P-9") if the diff touches
them. "none" if not. Touching a locked principle requires the
escape hatch in §4.>

Region: stable | volatile | mixed | unknown
```

Mark the PR with the GitHub label `prompt-change`. CI keys off the label.

**Required reviewer count:**

| Change scope | Required reviewers | Notes |
|---|---|---|
| volatile-only edit, no locked-principle touch | 1 (any of: Waleed, Temur, Principal Prompt Engineer) | Standard flow |
| Mixed or stable touch | 2: Waleed AND (Temur OR Principal Prompt Engineer) | Stable changes invalidate cache for every active user; cost story changes too |
| Locked-principle edit | Escape hatch in §4 — protocol does not handle this directly |

The Principal Prompt Engineer can review their own PR if and only if a second human (Waleed or Temur) is also on the review thread. Self-review without external is a P-9 violation.

**Bot review:** the CI flow (Step 2) auto-comments the eval delta report. The PR author MUST address every per-case regression flagged by the bot before requesting human review.

---

### Step 2 — CI eval invocation

When the PR opens or pushes a new commit and has the `prompt-change` label, CI runs:

```bash
# Baseline = the PR's merge-base on main.
# Candidate = the HEAD of the PR branch.
npx tsx scripts/eval/wave_1_5_compare.ts \
  --baseline "${BASELINE_COMMIT}" \
  --candidate "${CANDIDATE_COMMIT}" \
  --repeats 10 \
  --out scripts/eval/runs/compare/${PR_NUMBER}/
```

`wave_1_5_compare.ts` runs both `wave_5_1_harness` (Cat A–I retrieval + tier routing + disclaim-tag) and `wave_1_4_v3_harness` (programmatic v3 cases) against each prompt version, then computes per-case + aggregate deltas. The CI flow chooses the prompt version by setting `OTO_PROMPT_VERSION_OVERRIDE` for each run — both runs share the same labeled set, the same cascade plumbing, and the same `cascadeTier2` deterministic substrate; the only delta is the prompt string.

**Required env vars** for live mode (set in the CI workflow's secrets, not committed):

- `OTO_EVAL_CONVEX_URL` — `https://<deployment>.convex.cloud`
- `OTO_EVAL_CONVEX_KEY` — bearer token for the eval principal
- `OTO_PROMPT_VERSION_OVERRIDE` — set by the comparator, not by the operator

**Outputs** (artifacts uploaded to the PR comment):

- `scripts/eval/runs/compare/<PR>/baseline.json` — raw harness output, baseline
- `scripts/eval/runs/compare/<PR>/candidate.json` — raw harness output, candidate
- `scripts/eval/runs/compare/<PR>/delta.json` — machine-readable delta, structured below
- `scripts/eval/runs/compare/<PR>/delta.md` — human-readable summary, posted as a PR comment

The delta JSON shape (consumed by Step 3's gate):

```jsonc
{
  "baseline_version": "v0.9",
  "candidate_version": "v0.10",
  "repeats": 10,
  "per_case": [
    {
      "id": "tier-a-003",
      "category": "E",
      "baseline_pass_rate": 1.0,
      "baseline_ci": [0.72, 1.0],
      "candidate_pass_rate": 0.8,
      "candidate_ci": [0.49, 0.94],
      "delta": -0.20,
      "regression": true,
      "regression_reason": "drop > 0.05 AND CIs disjoint"
    }
  ],
  "aggregate": {
    "baseline_pass_rate": 0.92,
    "candidate_pass_rate": 0.86,
    "delta": -0.06,
    "wilcoxon_p": 0.011,
    "regression": true
  },
  "gate": "FAIL",
  "regressing_cases": ["tier-a-003", "disclaim-b-005"]
}
```

**N ≥ 10 repeats per case** is the Doc 4 Wave 1.1 floor and is enforced by `wave_1_5_compare.ts` (it warns under 10 and the CI workflow sets it to 10 as default; for stable-half edits the operator may raise to 30 — see §3 footnote).

---

### Step 3 — Merge gate

A PR with the `prompt-change` label CANNOT merge unless ALL of:

**(a) Per-case threshold check.** For every labeled case AND every Wave 1.4 v3 programmatic case:

> NOT a regression iff: `(baseline_pass_rate − candidate_pass_rate) ≤ 0.05` OR the two Wilson 95% CIs overlap.

That is — a per-case regression fires iff the drop is more than 5 percentage points AND the candidate's CI ceiling is below the baseline's CI floor (disjoint CIs). Either condition alone is insufficient; both must be true. The 5-point drop without CI evidence is noise; CI separation without a meaningful drop is statistical pedantry.

> **Decision flagged for Waleed:** the 5% per-case drop threshold is a starting number. Cat F (refusal) is more sensitive than Cat A (T1 hit) — a 5-point drop on refusal is a P-9 violation; a 5-point drop on T1 retrieval may be acceptable if Cat E (T3 fallback) gains. The protocol uses 5% uniformly for v1 because per-category thresholds will require labeled-set re-tuning. Ratify or revise after the first 3 PRs run through this protocol.

**(b) Aggregate statistical test.** Across all Cat A–I cases (excluding Cat F because its metric is binary), run a Wilcoxon signed-rank test on the per-case pass-rate deltas (paired by case-id). The test must NOT reject the null at p < 0.05 with the alternative `candidate < baseline`. In plainer English: the candidate's pass-rates, paired across cases, must not be systematically lower than baseline.

Wilcoxon was chosen over paired t-test because pass-rate at N=10 is bounded in [0,1] and non-Gaussian — the rank-based test is robust to the floor/ceiling effects.

**(c) Locked-principle invariants.** The seven Wave 5.3 graduation-bar metrics from `scripts/eval/wave_5_1_harness.ts` (precision@3 ≥ 0.70, recall@5 ≥ 0.80, MRR ≥ 0.65, tier_misclass ≤ 0.10, disclaim_correct ≥ 0.95, under_disclaim ≤ 0.02, refusal_violation ≤ 0.05) MUST still pass on the candidate. These are the locked floors for the Wave 5.3 graduation; a prompt change cannot push them below the floor regardless of whether the per-case test says "no regression."

**(d) No new test failures.** Any Wave 1.4 v3 programmatic case that went from PASS at baseline to FAIL at candidate is a hard block, regardless of pass-rate math.

**Gate output:** `wave_1_5_compare.ts` exits 0 if all four pass, 1 if any fail. The CI workflow's `required` check key is `prompt-change-gate`; GitHub branch protection rejects merges if `prompt-change-gate` is failing.

**Override path:** the only way to merge a PR that failed the gate is a written approval from Waleed in the PR thread including the phrase `OVERRIDE PROMPT GATE: <reason>`. This is logged in `prompt_changelog.rationale` at merge time. The override exists for cases where the eval set is wrong, not the prompt; if Waleed thinks the eval is wrong, the same PR also bumps the labeled set and re-runs the gate — fix the meter, not the wall.

---

### Step 4 — A/B rollout

After the PR merges, the new prompt version is NOT immediately served to 100% of traffic. The rollout layer at `convex/oto/chat.ts` reads a `prompt_rollout_pct` config value; merging a prompt PR sets it to **5** for the new version.

**Observation window: 48 hours.**

48 hours is the chosen window because:
- Diurnal usage patterns differ — morning checks in NY look different from evening (commute vs. weekend prep)
- A 24h window risks calling success on a single low-volume night
- A 7-day window delays compounding wins; for a product that ships prompt changes weekly, a week-per-rollout pipeline stalls everyone behind a slow one
- 48h gives two full diurnals + a partial weekend touch — enough signal without becoming a release bottleneck

> **Decision flagged for Waleed:** 48h is the v1 default. If three sequential rollouts complete with stable 48h windows, consider compressing to 24h for low-risk volatile-only edits. Stable-half edits stay at 48h minimum. Hard floor is 24h regardless of perceived risk.

**Measured during the window:**

1. **Same eval metrics, re-computed from production traffic.** `wave_5_1_harness --live` runs nightly during the window and writes its delta against the previous-version baseline.
2. **Production-only health checks** (these don't show up in the eval because they require real users):
   - p95 latency on `convex/oto/chat.ts` (per `oto_telemetry.latency_ms`). Threshold: no more than 15% above baseline p95.
   - Token cost per turn. Threshold: no more than 20% above baseline median.
   - Error rate. Threshold: error_rate (HTTP 5xx or model API failure) ≤ 1.5× baseline.
   - Conversation completion rate. Threshold: not more than 5pp below baseline.

**Auto-rollback** fires if ANY of:

- The nightly live eval comes back with `gate: FAIL` against the pre-rollout baseline.
- p95 latency > 1.15 × baseline for two consecutive hours.
- Error rate > 1.5 × baseline for any single hour.
- Token cost per turn > 1.2 × baseline median, sustained 6 hours.
- Conversation completion rate < (baseline − 5pp), sustained 12 hours.

Auto-rollback runs the rollback script (§5) and pages the on-call rotation. If no auto-rollback fires for the full 48h, the rollout layer promotes the new version to 100% and writes the `ab_window_outcome: "promoted"` row on the `prompt_changelog`.

**Who watches A/B:** the on-call rotation between Waleed and Temur. Day-of-merge author is on point for the first 24h; on-call takes the second 24h. The dashboard lives at `/admin/prompt-ab` (separate slice, not in scope for Wave 1.5).

---

### Step 5 — Changelog

Every merged prompt PR — including the override-merge path — writes one row to `prompt_changelog` (schema in `convex/schema.ts`, mutation in `convex/oto/promptChangelog.ts`). The row is written by a CI step that runs the `oto.promptChangelog:recordPromptChange` mutation after the merge commit lands on main.

**Required fields, source:**

| Field | Source |
|---|---|
| `prompt_version` | `SYSTEM_PROMPT_VERSION` constant value on the merge commit |
| `prev_version` | `SYSTEM_PROMPT_VERSION` constant value on the merge-base commit |
| `diff_summary` | Auto-populated: first ~200 chars of `git diff --stat` + first changed line of `system_prompt.ts` |
| `rationale` | Auto-populated: the PR description's `Rationale:` section text |
| `expected_eval_delta` | Auto-populated: the PR description's `Expected eval delta:` section text |
| `actual_eval_delta` | Auto-populated: the contents of `delta.json` from Step 2 (stringified) |
| `author` | Auto-populated: GitHub username of the merging committer |
| `merged_at` | Auto-populated: `Date.now()` at the moment of the changelog mutation |
| `ab_window_started_at` | Set when rollout layer promotes to 5% |
| `ab_window_completed_at` | Set when rollout promotes to 100% (or rolls back) |
| `ab_window_outcome` | `"promoted"` or `"rolled_back"` — set by rollout layer |
| `rollback_reason` | Set by rollback script ONLY when outcome is `rolled_back` |

**Append-only by convention.** The protocol says so; no CI enforcement (the threat model is internal trust and the volume is small enough that a misbehaving author would be obvious in `git log` + `prompt_changelog` parity). Editing a `prompt_changelog` row after merge is a P-9 violation — the audit story doesn't bend.

**Auto-generated GitHub release notes.** A separate CI step (out of scope for this protocol) reads the latest `prompt_changelog` row and posts a GitHub release tagged `prompt-vX.Y` with the diff summary and rationale. The release-note formatter lives in `scripts/release/prompt_release_notes.ts` (future work, not Wave 1.5).

---

## 2. Roles and Authority

| Role | Who | Authority |
|---|---|---|
| **Proposer** | Anyone — Principal Prompt Engineer, Interaction Strategist, Waleed, Temur, future hires | Opens the PR. Writes Rationale + Expected eval delta. |
| **Reviewer (volatile-only)** | One of: Waleed, Temur, Principal Prompt Engineer | Approves merge after gate passes. |
| **Reviewer (stable / mixed)** | Two of: Waleed (required) + Temur OR Principal Prompt Engineer | Approves merge after gate passes. Stable changes invalidate cache for every active user; both reviewers must consciously accept the cost story. |
| **Merger** | Same person as the last reviewer to approve (squash-merge to keep `prompt_changelog.diff_summary` clean) | Pushes the merge button. |
| **A/B watcher** | Day-of-merge: PR author. Second 24h: on-call rotation between Waleed and Temur. | Monitors the dashboard. Authorized to trigger manual rollback at any time without a meeting. |
| **Rollback trigger** | A/B watcher, or any of Waleed / Temur / Principal Prompt Engineer at any time. Auto-rollback per §4 criteria. | Runs `scripts/eval/rollback_prompt.sh` with a reason string. |
| **Override merge approver** | Waleed only (Temur is NOT authorized to override the gate — keeps the override hard) | Must write `OVERRIDE PROMPT GATE: <reason>` in the PR thread. |
| **Locked-principle ratifier** | Waleed AND Temur jointly. See §4. | A locked-principle edit requires both. |

**GitHub team handles** (set up by the repo admin; placeholder names for now):

- `@otopair/prompt-reviewers` — Waleed, Temur, Principal Prompt Engineer. Auto-requested on any PR labeled `prompt-change`.
- `@otopair/prompt-stable-reviewers` — Waleed, Temur. Auto-requested on PRs that touch the stable region (CODEOWNERS rule keyed on the `// STABLE` marker comment in `system_prompt.ts`, once Wave 4 split lands; until then, on any PR labeled `prompt-stable`).

Until the GitHub teams are configured, fall back to: tag Waleed and Temur by username in the PR description.

---

## 3. The `stable` vs `volatile` Split

### 3.1 Current state (as of v0.9, 2026-05-16)

`convex/oto/system_prompt.ts` is **not yet split into `stable.ts` + `volatile.ts`**. The entire prompt body is a single `SYSTEM_PROMPT` const wrapped between BEGIN/END markers in the source-of-truth doc. The cache invalidation comment in the file makes the cost story explicit:

> "Any byte change in `SYSTEM_PROMPT` invalidates the cache for every active user on their next request."

The Doc 4 Wave 4 cache-zone split has NOT shipped. When it does ship, the file's structure becomes:

```
convex/oto/system_prompt.ts          (re-export shim, keeps SYSTEM_PROMPT identity)
convex/oto/prompt/stable.ts          (Locked Principles + Voice + System narration rule + Locked Principle 1–12)
convex/oto/prompt/volatile.ts        (Wave 2.x interaction language, edge-case examples, tone calibration)
```

Until that split lands, the protocol applies **the stricter discipline by default** for any edit to `system_prompt.ts`:

- 2-reviewer rule treats the whole file as if it were the stable half.
- Cache invalidation is acknowledged in every merged PR (Rationale section MUST mention "this invalidates cache for every active user — cost impact accepted").
- A/B window is 48h, no compression.

This is intentional friction. It exists to make sure prompt edits don't get treated as routine code edits during the pre-split period.

### 3.2 Post-split rule (when Wave 4 ships)

Once the split exists, the PR's `Region:` header (Step 1) routes the change:

| Region: tag | What it means | Reviewers | A/B start % | A/B window |
|---|---|---|---|---|
| `volatile` | Only `prompt/volatile.ts` changed | 1 (standard flow) | 5% | 48h (24h after 3 stable rollouts) |
| `stable` | Any byte in `prompt/stable.ts` | 2 (Waleed + Temur, NOT Principal Prompt Engineer alone) | 100% direct OR 25% / 48h, author choice — but 5% is NOT permitted (the cache hit is paid either way) | 48h minimum |
| `mixed` | Both halves touched | 2, treat as stable | Same as stable | 48h minimum |

The asymmetry on A/B start% for stable-only changes is deliberate: a 5% rollout for a stable change has the worst of both worlds — the cache for the 95% of unrolled-out users is also invalidated when the new prompt is built and the cache key changes. Either roll out wide (100% direct, accept the cache hit once) or use a 25% canary (cache hit for 25% only, with rollback option). 5% canary on stable is wasted cache pressure.

> **Decision flagged for Waleed:** the 25%-canary-for-stable rule is a v1 stance. Re-evaluate after the Wave 4 split ships and we have cache-hit-rate telemetry from `oto_telemetry`.

### 3.3 What goes in stable vs. volatile

Stable (lives in `stable.ts` post-split):

- `# Who you are` opening identity paragraph
- Locked Principles #1–#12 in their entirety
- `# Voice` headers and tone-hierarchy ordering
- The "No system narration — hard rule" section
- Tool name strings (any change is a tool-contract change, not a prompt change — different protocol)

Volatile (lives in `volatile.ts` post-split):

- Wave 2.1 / 2.2 / 2.3 / 2.4 interaction language and examples
- Adaptive shaping bullet points
- "What 'friendly' sounds like in practice" examples
- "Forbidden phrasings (illustrative, not exhaustive)" list — this is illustrative by design, expected to be expanded
- Edge-case calibration notes

If you can't tell which half an edit belongs in, mark the PR `Region: unknown` and the reviewer assigns. Default-to-stable in that case.

---

## 4. Locked-Principle Escape Hatch

The system prompt contains Locked Principles #1–#12. They are not negotiable through the standard 5-step protocol. Editing one requires:

1. **A Decision Log entry** in `docs/SPRINT_X/DECISION_LOG.md` describing the architectural change. The change has to be defensible at the level of "what is Oto" — not "what does Oto say."
2. **Joint ratification by Waleed AND Temur** in the Decision Log entry. Both must explicitly sign off (initials + date in the doc).
3. **A separate PR** that touches ONLY the locked principle text, with `Locked principles touched:` listing the principle(s) and `Region: stable` mandatory. Even if Wave 4 has not split the file, this PR is reviewed as stable.
4. **N ≥ 30 eval repeats**, not N ≥ 10. Locked principles drive the gating behavior of the entire labeled set; small-N noise on a locked principle is unsafe.
5. **The eval gate applies normally** (Step 3) AND a separate human review of the 10 worst-performing per-case deltas, even if none individually trip the threshold.
6. **A/B rollout at 25% canary, 96h window** (not 5%/48h). Locked-principle drift compounds slowly; 48h is too short.
7. **Changelog row carries `rationale` text quoting the Decision Log entry verbatim.** This is the audit trail that lets a future reader see WHY a locked principle was loosened.

### What counts as a locked-principle edit?

If the diff modifies a line within the `# Locked Principles` section header and a subsequent `## Principle #N` subheader, it's a locked-principle edit. If the diff modifies a line outside that section that explicitly references a locked principle by number ("Principle #4 says..."), it's a locked-principle edit. Anything else is a normal prompt change.

When in doubt: open the PR, mark `Locked principles touched: unsure`, and the first reviewer assigns the path. Default-to-locked in that case.

---

## 5. Emergency Rollback Procedure

Production prompt change has shipped, A/B is at 5%, dashboards are red. What do you do?

**One command, from a machine with Convex CLI auth:**

```bash
bash scripts/eval/rollback_prompt.sh "production error rate spiked at 18:42 UTC"
```

The script (defined at `scripts/eval/rollback_prompt.sh`):

1. Reads the second-newest `prompt_changelog` row's `prompt_version` (the version before the current rollout).
2. Calls `npx convex run oto/promptChangelog:setActivePromptVersion --version "<prev_version>"` to flip the rollout layer back.
3. Writes a new `prompt_changelog` row marking the current (rolled-back) version with `ab_window_outcome: "rolled_back"` and the supplied `rollback_reason`.
4. Prints a one-line confirmation: `Rolled back from v0.10 to v0.9. Reason: production error rate spiked at 18:42 UTC. Changelog row written.`

The script is intentionally simple. It does NOT:
- Try to diagnose why the rollback fired.
- Notify anyone (Slack hooks are separate).
- Halt CI on the rolled-back version's branch.

Diagnosis is a human's job. The script's only job is to **make the rollback fast enough that no one hesitates to use it.** If running the rollback feels like a big decision, the protocol has failed.

**Anyone authorized to rollback:** Waleed, Temur, Principal Prompt Engineer, A/B watcher of record, on-call. No meeting required. Document the reason in the script invocation; the post-mortem is async.

**Auto-rollback** runs the same script with `rollback_reason` filled by the monitoring system (e.g., `"auto: p95_latency > 1.15x baseline for 2 consecutive hours"`).

---

## 6. What this protocol is NOT

- It is **not** a code-style guide for prompt-writing. The Voice and "What friendly sounds like" sections of the prompt itself are the style guide. This document is the *change-management* process.
- It is **not** a substitute for thinking. The eval catches regressions, not stupidity. A prompt change that passes the gate can still be a bad idea — reviewers are expected to read the diff, not just check the bot's green light.
- It is **not** a place to argue about whether the eval is correct. If the eval is wrong, fix the eval in a separate PR. Don't override the gate just because the labeled set is missing your favorite edge case.
- It is **not** binding on locked-principle edits. Those go through §4 instead — a deliberately heavier process.

---

## 7. Open questions for Waleed

1. **Per-case threshold drop number.** §3(a) uses 5% uniformly. Is per-category tuning worth the labeled-set re-work, or do we hold uniform 5% for v1?
2. **A/B window length.** §4 uses 48h. Does Waleed want a 24h fast path for low-risk volatile edits after we've seen the first three rollouts behave?
3. **Override threshold for stable changes.** §3 lets Waleed override the gate for any PR. Should stable-region overrides require Temur co-sign (a higher bar)?
4. **GitHub team handles vs. named individuals.** Until the prompt-reviewers team exists, the protocol falls back to tagging by username. When does Waleed want to formalize the team?
5. **Locked-principle list location.** The protocol references "Locked Principles #1–#12" but the current `system_prompt.ts` does not have a `# Locked Principles` section header — they're embedded throughout. Should Wave 4's split also factor out a `prompt/locked_principles.ts` for explicit indexing?

These are not blockers. The protocol is operable today with the v1 stances above. The questions are for the first review-cycle after one or two PRs ride the rails.

---

## 8. The first user

The Wave 2.4 prompt-language PR queued by the Interaction Strategist (`docs/SPRINT_0/INTERACTION_WAVE_2_4_V3.md`) is the first PR scheduled to ride this protocol. When that PR opens:

- It will touch the Wave 2.4 (web-sourced answer delivery) language — that's `volatile` region.
- One reviewer required.
- 5% / 48h A/B window.
- Expected eval delta: improvement on Cat E (T3 fallback with disclaim tag), no regression on Cat A (T1 hit), Cat F (refusal) holds.
- It writes the first `prompt_changelog` row.

That PR is the protocol's smoke test. If anything in this document breaks on it, the protocol gets revised before the second PR. v1 is intentionally a starting point — iterate on it.

---

**End — Wave 1.5 prompt-change protocol v1.**
