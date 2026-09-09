# Handoff to Claude Code — Sprint 2 continuation
**Date:** 2026-05-16
**From:** Cowork PM (orchestrator agent in Cowork mode)
**To:** Claude Code (CLI agent running in Waleed's terminal)
**Status:** Sprint 1 + Sprint 2 Day 1 work is on disk, uncommitted. Everything compiles, 9/9 CI invariants clean. Your job is to commit it, then orchestrate Sprint 2 Day 2.

---

## 0. The five things you must know before anything else

1. **You are the PM orchestrator** for an 11-subagent team (defined in `.claude/agents/`). You do not write code yourself for substantive work — you dispatch the right subagent via the `Task` tool. The exception is small mechanical edits (renames, brace balance fixes, commit messages, day logs).
2. **End-of-day commits are mandatory.** Sprint 1 went uncommitted for 7 days; a corruption fix on Day 8 had no rollback point. Commit per logical pass, not per sprint. See §3 for the workflow.
3. **Read these before you do anything else** (~ 30 min read budget):
   - `docs/SPRINT_1_HANDOFF.md` — what shipped through Sprint 1 Day 7 + the open decisions
   - `docs/SPRINT_2_DAY_1_LOG.md` — what shipped Sprint 2 Day 1, including PM-lean decisions applied
   - `docs/PM_RULING_2026-05-16_seam_and_kb_persistence.md` — the v3 architecture ruling
   - `docs/ARCHITECTURE_v3_AMENDMENTS.md` — Decision Log + Migration Plan + Risk Register amendments
   - `.claude/agents/_pm-orchestrator.md` (your own role) — methodology
4. **The 7 CI invariants are load-bearing.** Run `bash scripts/ci/vehicle-facts-grep.sh` after EVERY substantive change. All 7 rules must stay green. Sprint 2 Day 2 may add Rules 8 + 9 — see §6.
5. **Edit/Write tools have a Windows-mount truncation bug — use bash for file writes**. The original Cowork PM lost three files to silent truncation in Sprint 1 Day 4. The pattern that works: `cat > file <<'EOF' ... EOF`, `sed -i`, or `python3` heredoc. Then verify: `wc -l file && tail -3 file`. Note: this constraint applied to the Cowork sandbox; Claude Code may be unaffected — test once and proceed accordingly. Even if Edit works, ALWAYS verify with `wc -l` + `tail -3`.

---

## 1. State on disk right now (uncommitted)

Two passes of work are on disk, in separate logical groups. Sprint 1 should commit as one commit; Sprint 2 Day 1 as a separate commit on top.

### Sprint 1 files (per `docs/SPRINT_1_HANDOFF.md` §2)

**Modified (7 files with real content changes):**
- `convex/schema.ts` (2400 lines — was 2125)
- `convex/oto/chat.ts`
- `convex/oto/vehicleFacts.ts`
- `convex/oto/vehicleFactsKB.ts`
- `convex/oto/vehicleHealth.ts`
- `convex/oto/lookupVehicleSpec.ts`
- `convex/crons.ts`

**New (27 untracked paths):**
- `convex/oto/canonicalize.ts` + test
- `convex/oto/evalHarness.ts`
- `convex/oto/evalTestFilter.ts`
- `convex/oto/factReports.ts`
- `convex/oto/migrations/` (3 files)
- `convex/oto/promptChangelog.ts`
- `convex/oto/searchedFacts.ts`
- `convex/oto/vehicleFactsEditing.ts`
- `docs/ARCHITECTURE_v3_AMENDMENTS.md`, `docs/PM_RULING_2026-05-16_seam_and_kb_persistence.md`, `docs/SUBSTRATE_NOTES.md`
- `docs/SPRINT_0/`, `docs/SPRINT_0_PLAN.md`, `docs/SPRINT_1/`
- `docs/SPRINT_1_DAY_{1..7}_LOG.md`, `docs/SPRINT_1_DAY_1_CORRECTION_LOG.md`, `docs/SPRINT_1_HANDOFF.md`
- `scripts/ci/{vehicle-facts-grep.sh,searched-facts-grep.sh}`
- `scripts/eval/` (full tree)

**WARNING — CRLF churn.** `git status --short` reports ~565 modified files. **557 of those are pure line-ending (CRLF↔LF) churn — zero real content changes.** Verify with `git diff --shortstat -w --ignore-cr-at-eol` (should show only 7-8 files real). DO NOT commit the CRLF churn — only stage the 7 modified files listed above.

### Sprint 2 Day 1 files (per `docs/SPRINT_2_DAY_1_LOG.md`)

**New:**
- `convex/oto/prompt/{stable.ts,volatile.ts,index.ts}` (1069 lines total — Wave 4 split)
- `convex/oto/queryMoat.ts` (307 lines — Wave 7.3 Option B helper)
- `docs/SPRINT_2/WAVE_4_PROMPT_SPLIT.md`
- `docs/SPRINT_2_DAY_1_LOG.md`
- `docs/CLAUDE_CODE_HANDOFF.md` (this file)
- `.claude/agents/_pm-orchestrator.md` + 11 role files

**Modified:**
- `convex/oto/system_prompt.ts` (993 → 28 lines — now a shim)
- `convex/schema.ts` (+8 lines on `users` table — 3 optional moat-counter fields)
- `convex/oto/lookupVehicleSpec.ts` (+3 lines — EXEMPT annotation for Rule 7)
- `scripts/ci/vehicle-facts-grep.sh` (+61 lines — Rule 7)
- `scripts/eval/wave_1_4_v3_harness.ts` (+147 lines — Cat (d) cross-tenant cases)
- `docs/SPRINT_1/WAVE_7_3_RATE_LIMIT_DESIGN.md` (+46 lines — §12 Implementation Status)

---

## 2. Verify before committing

```bash
cd C:\Users\manso\Desktop\otopair-1
bash scripts/ci/vehicle-facts-grep.sh     # expect: 9/9 rules clean
git diff --shortstat -w --ignore-cr-at-eol  # expect: ~14 files, ~2500 lines changed (real content only)
npx tsc --noEmit 2>&1 | findstr /V "_generated _expo node_modules"  # expect: only .expo/types/router.d.ts auto-gen errors
```

If any of these don't match, STOP and investigate before committing. Truncated or corrupted files have happened twice in this codebase (Sprint 1 Day 4 + Day 5); the CI grep + tsc + wc -l + tail -3 discipline catches them.

---

## 3. Commit workflow (do this NOW, before any new work)

You have real git CLI. Use it. Two commits, separated.

### Commit 1 — Sprint 1

```bash
cd C:\Users\manso\Desktop\otopair-1

# Stage real Sprint 1 content only (skip the 557-file CRLF churn)
git add convex/schema.ts \
        convex/oto/chat.ts \
        convex/oto/vehicleFacts.ts \
        convex/oto/vehicleFactsKB.ts \
        convex/oto/vehicleHealth.ts \
        convex/oto/lookupVehicleSpec.ts \
        convex/oto/searchedFacts.ts \
        convex/oto/vehicleFactsEditing.ts \
        convex/oto/canonicalize.ts \
        convex/oto/canonicalize.test.ts \
        convex/oto/factReports.ts \
        convex/oto/evalHarness.ts \
        convex/oto/evalTestFilter.ts \
        convex/oto/promptChangelog.ts \
        convex/oto/migrations/ \
        convex/crons.ts \
        scripts/ci/vehicle-facts-grep.sh \
        scripts/ci/searched-facts-grep.sh \
        scripts/eval/ \
        docs/PM_RULING_2026-05-16_seam_and_kb_persistence.md \
        docs/ARCHITECTURE_v3_AMENDMENTS.md \
        docs/SUBSTRATE_NOTES.md \
        docs/SPRINT_0_PLAN.md \
        docs/SPRINT_0/ \
        docs/SPRINT_1/ \
        docs/SPRINT_1_DAY_1_LOG.md \
        docs/SPRINT_1_DAY_1_CORRECTION_LOG.md \
        docs/SPRINT_1_DAY_2_LOG.md \
        docs/SPRINT_1_DAY_3_LOG.md \
        docs/SPRINT_1_DAY_4_LOG.md \
        docs/SPRINT_1_DAY_5_LOG.md \
        docs/SPRINT_1_DAY_6_LOG.md \
        docs/SPRINT_1_DAY_7_LOG.md \
        docs/SPRINT_1_HANDOFF.md

# Sanity check stage list
git diff --cached --stat | tail -10

# Commit
git commit -m "Sprint 1: v3 KB consolidation + eval infrastructure (Days 1-8)

v3 architecture: one vehicle_facts KB table (source-typed trust,
verification lifecycle, audit log, fact reports). Embedding column +
vectorIndex removed (D-3.12). Three-tier read cascade (T1 enrichment
tables -> T2 vehicle_facts -> T3 web_search). Wave 1.5 prompt-change
protocol + comparator + rollback. Reconciliation cron + 6-rule CI
invariant grep. 11-subagent team methodology (see daily logs)."
```

### Commit 2 — Sprint 2 Day 1

```bash
# New files
git add convex/oto/prompt/ \
        convex/oto/queryMoat.ts \
        docs/SPRINT_2/ \
        docs/SPRINT_2_DAY_1_LOG.md \
        docs/CLAUDE_CODE_HANDOFF.md \
        .claude/agents/

# Modified files
git add convex/oto/system_prompt.ts \
        convex/schema.ts \
        convex/oto/lookupVehicleSpec.ts \
        scripts/ci/vehicle-facts-grep.sh \
        scripts/eval/wave_1_4_v3_harness.ts \
        docs/SPRINT_1/WAVE_7_3_RATE_LIMIT_DESIGN.md

git diff --cached --stat | tail -15

git commit -m "Sprint 2 Day 1: Wave 4 prompt split + Wave 7.3 Option B + Wave 1.4 cat (d)

Five parallel subagents:
- Principal Prompt Engineer: split system_prompt.ts into prompt/stable.ts
  (880L) + prompt/volatile.ts (155L) composed via prompt/index.ts;
  byte-identical output verified.
- AI Security Analyst: Wave 7.3 Option B - queryMoat.ts helper, 3 user-table
  fields, CI Rule 7 with 4-site grandfather list, EXEMPT annotation pattern.
- AI QA Lead: 3 Wave 1.4 v3 cross-tenant cases (was deferred Sprint 1 Day 3).
- Reading agent: verified 11-subagent roster + P-1..P-10 + Sprint 2+ scope.
- RAG Specialist: stopped on PM-Ruling/code divergence (no standalone
  web_search action; PM ruled skip T3 in eval harness).

PM-lean defaults applied: Wave 7.3 D-Q1/Q2/Q3 (services-moat hole accepted,
10x p95 24h tripwire, 4-site grandfather list).

9/9 CI invariants clean. Schema brace-balanced delta=0. TS clean modulo
pre-existing .expo auto-gen artifact.

Adds .claude/agents/ definitions for the 11-subagent team."
```

If you ever see `fatal: Unable to create .git/index.lock: File exists`, that's the stale lock from a prior process. Just delete it: `Remove-Item .git\index.lock -Force` (PowerShell) or `rm -f .git/index.lock` (Git Bash / WSL). Then retry.

---

## 4. The 11-subagent team (defined in `.claude/agents/`)

Each role has its own file. Invoke via `Task` tool with `subagent_type: <slug>`. Roles + slugs:

| Role | Slug | Mandate (one line) |
|---|---|---|
| Memory Systems Engineer | `memory-systems-engineer` | Schemas, audit logs, mutations, migrations, canonicalization |
| RAG Optimization Specialist | `rag-optimization-specialist` | Three-tier cascade, retrieval eval, chat-tool reads |
| AI QA & Evaluation Lead | `ai-qa-evaluation-lead` | Eval cases, judges, pass thresholds, Wilson 95% CI |
| Human-AI Interaction Strategist | `human-ai-interaction-strategist` | Designed prompt language, contrastive examples |
| AI Infrastructure Architect | `ai-infrastructure-architect` | Substrate, performance, capacity, batched reads |
| AI Security Analyst | `ai-security-analyst` | R-3, rate limits, injection, PII boundaries |
| Automation Workflow Architect | `automation-workflow-architect` | Async subsystems, enrichment seam (Confirm-and-pass in v3) |
| Multi-Agent Systems Engineer | `multi-agent-systems-engineer` | Agent boundaries, written_by, role discipline |
| Principal Prompt Engineer | `principal-prompt-engineer` | Wave 1.5 protocol, prompt structure, stable/volatile split |
| Context Engineering Specialist | `context-engineering-specialist` | Token budgets, what enters the prompt |
| LLM Reliability Engineer | `llm-reliability-engineer` | Failure modes, retries, fallbacks, degradation |

Plus `_pm-orchestrator.md` — your role. Read it first.

**Dispatch pattern (parallel):** send ONE message with multiple Task tool calls. Sprint 1 Day 3 + Day 7 + Sprint 2 Day 1 all used 3-5 parallel agents successfully. The constraint: no two agents write to the same file. `convex/schema.ts` is the only commonly-touched file; serialize agents that touch it, or hand them disjoint sections.

---

## 5. Methodology (the rules that survived Sprint 1)

1. **Parallel dispatch when surfaces don't overlap.** Saves wall time; coordination cost is the same as sequential.
2. **Bash for writes; Edit/Write only as fallback.** Always verify with `wc -l` and `tail -3` immediately after any write. The Sprint 1 day-4 corruption took 4 files quietly.
3. **CI grep is the safety net.** Run `bash scripts/ci/vehicle-facts-grep.sh` after every substantive change. 9/9 must stay green.
4. **Brace-balance verification on schema edits.** After any `convex/schema.ts` change: `awk 'BEGIN{o=0;c=0}{for(i=1;i<=length($0);i++){c1=substr($0,i,1); if(c1=="{") o++; if(c1=="}") c++}} END{print "open="o, "close="c, "delta="(o-c)}' convex/schema.ts` — delta must be 0.
5. **Byte-identity for refactors.** When splitting/refactoring (e.g., the prompt split), prove byte-identity via `cmp` or Python binary diff before committing.
6. **Commit per logical pass.** Not per file, not per sprint. A logical pass = one agent's deliverable, or one day's work.
7. **Day log per dispatch round.** `docs/SPRINT_N_DAY_M_LOG.md` captures: agents dispatched, deliverables, CI status, decisions applied (with reversibility cost), open items for Waleed. Sprint 1 has 7 logs + 1 correction log; Sprint 2 has 1 so far.
8. **Trust Waleed's reality over the sandbox.** When in doubt, ask him to run `git status` / `tsc` on Windows and report back. (Less of a concern for Claude Code than for Cowork; you have the real filesystem.)
9. **Convene subagents for consolidation calls.** A schema decision touching multiple mandates should convene the relevant agents in parallel and have them reach consensus, NOT be drafted by the PM alone. Sprint 1 Day 1 violated this and produced a parallel-table mistake Waleed corrected same-day.
10. **Strangler discipline applies to paths, not commitments.** If v3 says no embedding, the embedding goes — in three deploys with a proper backfill, not deferred to "Wave 7." Sprint 1 Day 1 violated this and was corrected.

---

## 6. The 9 CI invariants

Located at `scripts/ci/vehicle-facts-grep.sh`. Each rule fails the build on violation.

| Rule | Defends |
|---|---|
| **1** No direct `ctx.db.patch` on `vehicle_facts` outside the helper | All mutations go through `vehicleFactsEditing.ts` → audit row written atomically |
| **2** No `ctx.db.replace` on `vehicle_facts` anywhere | Stronger semantic mutation; never legal |
| **3** No direct insert into `vehicle_facts_audit` outside the helper | Audit log forgery prevention |
| **4** No new embedding writes | D-3.12 — KB has no embedding model |
| **5** Retired `vehicle_searched_facts` name must not reappear | v3 consolidation — one KB table |
| **6** Chat-tool moat reads must filter `EvalTest` | Synthetic eval data never serves real users |
| **7** Moat-table reads must route through `queryMoat` helper (Wave 7.3) | Rate-limit counter bumped per read |

### Rules 8 + 9 (added in this handoff)

| Rule | Defends |
|---|---|
| **8** `convex/oto/system_prompt.ts` must remain a ≤30-line shim; `STABLE_PROMPT_SECTION` / `VOLATILE_PROMPT_SECTION` may only be imported within `convex/oto/prompt/` | Wave 4 split discipline — prevents silent re-merging or boundary leak. Sanity-tested: passes at 28 lines, fails at 38. |
| **9** `MOAT_TABLES` const in `queryMoat.ts` must contain exactly 28 entries (the architecturally-documented count) | Architectural change-management — moat-table list is load-bearing. Sanity-tested: passes at 28, fails at 29. Modifications require an amendment in `ARCHITECTURE_v3_AMENDMENTS.md` AND updating `EXPECTED_MOAT_COUNT` in the CI script.

---

## 7. Open decisions on Waleed's plate

PM leans documented per item; reversibility cost noted. Waleed's call to override.

### Blocking the first end-to-end Wave 1.5 protocol run

| # | Decision | PM lean | Reversal cost |
|---|---|---|---|
| 1 | **Wave 5.2 baseline measurement** (10-min manual op) | Waleed must run — `docs/SPRINT_1/WAVE_5_2_BASELINE_RUNBOOK.md` | — |
| 2 | **Wave 2.4 token budget** (200/290/540/865) | 865 (full version), compress later if production cost justifies | Edit prompt PR; small |
| 3 | **A/B start %** | 25% canary for first protocol run (process matters more than landing fast) | Edit changelog row; trivial |
| 4 | **Run `runBackfillV3Lifecycle`** against live Convex | Waleed manual — `npx convex run oto/migrations/backfillV3Lifecycle:runBackfillV3Lifecycle '{"batchSize":256}'` | — |

### Already applied by Sprint 2 Day 1 PM (reversible)

| # | Decision | Applied | Reversal cost |
|---|---|---|---|
| 5 | Wave 7.3 D-Q1 (4-table services-moat hole) | ACCEPTED per §C.4.1 farm-case precedent | Remove from MOAT_TABLES + tighten wrapper, ~1h |
| 6 | Wave 7.3 D-Q2 (tripwire criterion) | 10× p95 sustained 24h | Edit constant; trivial |
| 7 | Wave 7.3 D-Q3 (Rule 7 grandfather list) | SHIPPED | Edit script; trivial |
| 8 | T3 web_search in eval harness | SKIPPED (production path is canonical T3) | Build `webSearch.ts` action (~100 LOC) |

### Defer (calibration, not blocking)

9. 5% per-case drop threshold tuning (after first 3 PRs)
10. 48h A/B window compress to 24h (after 3 clean rollouts)
11. Stable-prompt co-signer = Temur?
12. GitHub team handle formalization
13. Wave 4 split v2 — move interleaved volatile content from stable

---

## 8. Sprint 2 Day 2 candidate stack (recommended next dispatch)

| # | Item | Owner | Notes |
|---|---|---|---|
| ~~1~~ | ~~Add CI Rule 8 + Rule 9~~ | **DONE in this handoff** | Rules 8 (shim integrity + section import boundary) + 9 (MOAT_TABLES count) live and sanity-tested. |
| 2 | Migrate existing `ctx.db.query("<moat>")` reads through `queryMoat()` | AI Security Analyst | Sprint 2 Day 1 shipped the helper; reads aren't migrated yet. The 4 services-moat sites stay grandfathered. |
| 3 | `internalMutation` wrapper for action-context counter bumps | AI Security Analyst | Currently action-context returns null userId. Blocks full Option B from being wired through chat.ts. |
| 4 | `seedVerifiedFact` / `cleanupVerifiedFact` in `multiTenantSetup.ts` | Memory Systems Engineer | QA Lead's Sprint 2 Day 1 follow-up |
| 5 | Wave 2.4 prompt PR (after Waleed answers #2/#3 above) | Human-AI Interaction Strategist + Principal Prompt Engineer | First real user of Wave 1.5 protocol. PR draft already exists at `docs/SPRINT_1/WAVE_2_4_PR_DRAFT.md`. |
| 6 | Wave 2.1 / 2.2 / 2.3 designed language (other Wave-2 moments) | Human-AI Interaction Strategist | North-star scope. Bigger swing. |
| 7 | Wave 3 memory keystone (5 tables + written_by + 120d exp decay) | Memory Systems Engineer | North-star Wave 3 — biggest swing. |
| 8 | Wave 7.1 untrusted-input wrapping | AI Security Analyst | North-star Sprint 2+ scope; Fight 4 resolution |
| 9 | Wave 7.2 degradation ladder | LLM Reliability Engineer | North-star Sprint 2+ scope |
| 10 | Wave 1.9 schema-hash CI guard | Principal Prompt Engineer or PM | North-star — Prompt Engineer's request |

**Recommended Sprint 2 Day 2 order:**
- **Immediate (mechanical, ~30min total):** Item 1 — DONE in this handoff pass. Rules 8 + 9 are live; both sanity-tested.
- **Parallel dispatch (3 agents, ~1h wall time):** Items 2 + 3 + 4 — all Sprint 2 Day 1 follow-ups, no contention.
- **Defer until Waleed unblocks:** Items 5, 6 (need Wave 2.4 decisions), then 7+.

---

## 9. The literal copy-paste prompt to give Claude Code

When you start Claude Code in `C:\Users\manso\Desktop\otopair-1\`, paste this as your first message:

```
You are the PM orchestrator for OtoPair's v3 AI architecture sprint.

Read these files in this order before doing anything else:
1. docs/CLAUDE_CODE_HANDOFF.md (this is the master handoff)
2. .claude/agents/_pm-orchestrator.md (your role definition)
3. docs/SPRINT_1_HANDOFF.md
4. docs/SPRINT_2_DAY_1_LOG.md
5. docs/PM_RULING_2026-05-16_seam_and_kb_persistence.md

After reading, do this in order:
1. Run `bash scripts/ci/vehicle-facts-grep.sh` to confirm 9/9 invariants are green
2. Run `git diff --shortstat -w --ignore-cr-at-eol` to confirm only the ~14 real-content files have changes (the 557 CRLF-churn files are an artifact)
3. Commit Sprint 1 per docs/CLAUDE_CODE_HANDOFF.md §3 Commit 1 (one commit, exact message specified)
4. Commit Sprint 2 Day 1 per docs/CLAUDE_CODE_HANDOFF.md §3 Commit 2 (one commit, exact message specified)
5. Show me `git log --oneline -5` so we can confirm the two new commits

Then propose the Sprint 2 Day 2 dispatch plan per docs/CLAUDE_CODE_HANDOFF.md §8. Ask me to confirm before dispatching subagents.

Methodology rules (non-negotiable):
- Parallel-dispatch subagents via the Task tool when their write surfaces don't overlap
- Use bash for file writes (Edit/Write may truncate per the Sprint 1 day-4 corruption pattern) — verify every write with wc -l + tail -3
- Run the CI grep after every substantive change
- Commit at the end of each logical pass — not at end of sprint
- For schema edits: brace-balance check after, delta must be 0
- For refactors that should be content-preserving: prove byte-identity before committing
- Convene subagents for consolidation calls; do not draft schema changes solo
- Write a docs/SPRINT_2_DAY_N_LOG.md after each day's dispatch capturing: agents, deliverables, CI status, decisions, open items
```

That's it. Claude Code reads, commits, then asks you to confirm Sprint 2 Day 2 before continuing.

---

## 10. The single most important sentence in this handoff

**Read the five docs in §0.3, commit per §3, then dispatch the Sprint 2 Day 2 stack in §8 — using the 11-subagent definitions in `.claude/agents/`, the methodology rules in §5, and the CI invariants in §6 as your guardrails.**

— End of handoff.
