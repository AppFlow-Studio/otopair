# Sprint 1 Day 6 — Execution Log
**Date:** 2026-05-16 (same calendar day; Days 1 → 6 all shipped today)
**Authority:** PM Ruling v3 (consolidated) + Day 5 candidate stack + Waleed's "continue, use your judgment" steer
**Owner:** PM, executing via 2 parallel subagents.

---

## 0. Day 6 in one sentence

**Memory Engineer restored the 11-line backfill truncation cleanly (309 lines, brace-delta = 0, tsc clean), Interaction Strategist delivered the Wave 2.4 PR-ready draft — but with one surprise that needs Waleed's call: the prompt addition came in at ~865 tokens vs. the 200-token budget I specified.**

---

## 1. The truncation, fixed

`convex/oto/migrations/backfillV3Lifecycle.ts` — Memory Engineer's surgical restore:

| Property | Before (Day 5 end) | After (Day 6 end) |
|---|---|---|
| Line count | 298 | 309 |
| Ends with | `// Optional patch field: only includ` (mid-word) | proper closing braces + trailing newline |
| Brace delta (code-only, comment-and-string-aware) | +2 | 0 |
| `npx tsc --noEmit` on this file | errors | clean |
| Day 4 conditional-spread fix | present | **preserved** (verbatim) |

The restoration added 11 lines of completion: the rest of the inline comment ("Optional patch field: only include when defined"), the Day-4 conditional-spread patch field (`...(args.lastCursorMs !== undefined ? { last_cursor_ms: args.lastCursorMs } : {})`), the close of the `ctx.db.patch(row._id, {...})` call, the close of the handler arrow body, and the close of the `internalMutation({...})` export. No other file touched. No new exports. No schema changes.

The system-reminder "intentional change" pattern was honored — the Day 4 conditional-spread is intact; only the accidental truncation was repaired.

---

## 2. Wave 2.4 PR-ready draft, delivered with a budget surprise

[`docs/SPRINT_1/WAVE_2_4_PR_DRAFT.md`](computer://C:\Users\manso\Desktop\otopair-1\docs\SPRINT_1\WAVE_2_4_PR_DRAFT.md) — the Interaction Strategist's PR-ready content. Everything the Wave 1.5 protocol needs for the first real prompt PR:

| Section | Status |
|---|---|
| PR title + commit-message in Wave 1.5 §1 format | ready |
| Exact `system_prompt.ts` diff (old → new, line-numbered) | ready |
| Stable/volatile classification + rationale | recommend **stable, 100% direct** (cache cost paid either way pre-Wave-4-split; language is content-safe; trust register should land everywhere fast) |
| Expected eval delta for Wave 1.5 §2 comparator | spelled out |
| 8 new Wave 1.4 v3 eval cases | written |
| `prompt_changelog` row content | composed |
| Rollback criterion (specific to this PR) | 5 production signals named with thresholds |

**Slot in `system_prompt.ts`:** new subsection "Web-sourced answer framing — how the answer body itself reads" inserted between line 555 and 557 of the current prompt, with `SYSTEM_PROMPT_VERSION` bumped v0.9 → v0.10. Sister subsection "After the user reports a web-sourced answer" covers Surface B (post-report acknowledgment language).

[`scripts/eval/fixtures/wave_2_4_cases.jsonl`](computer://C:\Users\manso\Desktop\otopair-1\scripts\eval\fixtures\wave_2_4_cases.jsonl) — 8 eval cases:
- **3 right-example answer-body cases** (A1 factual / A2 opinion / A3 multi-step)
- **3 wrong-example answer-body cases** (W1 apology spiral / W4 scarcity framing / W5 legalese preamble) — must FAIL the judge
- **2 post-report cases** (V1 right factual / W timeline-promise wrong)

Each case has the verbatim INTERACTION_WAVE_2_4_V3.md judge prompt with three PASS criteria (source named in first 25 words, correction invited without apology, no scarcity/penalty framing). Post-report cases use a 5-criterion judge (acknowledges receipt, names Temur+Waleed, no timeline, no apology spiral, invites next turn).

### 2.1 The token-budget surprise

I specified a 200-token budget for the new prompt section. The Interaction Strategist's draft came in at **~865 tokens** — 4.3× over budget.

Their reasoning, honestly stated in the PR draft:
> "Wave 2.4 fires on a meaningful share of every session; getting the language wrong has compounding brand cost. The budget assumed a single paragraph and a tag mention; the design actually needs right/wrong contrastive examples + a banned-phrasings list + a sister subsection for the post-report acknowledgment. Compressing below ~500 tokens drops the contrastive examples, which are the load-bearing part of the trust-register transmission."

They provided **three compression options** as follow-up commits if budget is hard:

| Option | Tokens | What's lost |
|---|---|---|
| **Full version (recommended)** | ~865 | nothing |
| Drop BANNED lists | ~540 | the explicit "don't apologize-spiral / scarcity / penalty / timeline" guardrails (relies on examples alone to convey them) |
| Further compress paragraphs | ~290 | nuance in the trust-first framing rationale |
| Drop examples entirely | ~170 | the contrastive transmission mechanism — leaves abstract rules with no concrete demonstration |

**This is Waleed's call.** I leaned 200 tokens out of cache-economics caution; the Interaction Strategist leaned 865 tokens out of brand-cost caution. Both are legitimate. The right answer depends on:
- How often Wave 2.4 actually fires in production (the cache hit pays whether the section is 200 or 865 tokens)
- How much you trust the model to keep the trust-register without explicit BANNED examples
- Whether the ~665-token delta is meaningful at Oto's traffic shape

**PM lean:** ship the full ~865-token version on first PR (the contrastive examples are the load-bearing part — see Doc 3 §11 hill), then compress in a follow-up PR if production cost data justifies it. The eval gate catches any regression either way.

---

## 3. CI grep status

```
Rule 1: forbidden direct patches on vehicle_facts...               OK
Rule 2: forbidden direct replace on vehicle_facts...               OK
Rule 3: forbidden direct insert into vehicle_facts_audit...        OK
Rule 4: no new embedding writes...                                 OK
Rule 5: retired vehicle_searched_facts name must not reappear...   OK
Rule 6: chat-tool moat reads must filter EvalTest...               OK
All vehicle-facts invariant checks passed (6/6 rules clean).
```

Clean throughout Day 6 — verified after each agent.

---

## 4. Decisions flagged for Waleed (Day 6 additions + carryover)

### New from Day 6

1. **Wave 2.4 token budget — 200 / 290 / 540 / 865?** PM lean: 865 (full version), compress later if production cost justifies. Interaction Strategist's PR draft argues for 865.
2. **Post-report timeline messaging tone.** Open-ended "their next pass" or softer "next review session"? Interaction Strategist preference: open-ended.
3. **Named-reviewers durability.** Hardcoded "Temur and Waleed" in the post-report acknowledgment today. Add a follow-up note that when the reviewer roster changes, a new PR updates the prompt + acknowledgment language.
4. **Wave 2.4 loader ordering.** Land the prompt PR first and the JSONL-judge loader second, or the reverse? PM lean: land the loader first (it's a code change with no user-visible effect) so the prompt PR can run through the full Wave 1.5 protocol with real eval cases.
5. **A/B start percentage for Wave 2.4.** Interaction Strategist proposes 100% direct (stable region, content-safe); could argue 25% canary for the first prompt PR through the protocol as a stress test. **PM lean: 25% canary on the first protocol run** — getting the process right matters more than landing fast.

### Wave 1.5 carryover (Day 5)

6. 5% uniform per-case drop threshold (consider per-category tuning later)
7. 48h A/B window (consider compress to 24h for volatile-only later)
8. Stable-prompt co-signer = Temur?
9. GitHub team handle formalization timing
10. Wave 4 split — separate `locked_principles.ts` file?

### Carryover Day 2–4

11. **Wave 5.2 baseline measurement.** Mechanical now; one command from Day 4 log §5. Capture the uncomfortable number.
12. Sec Analyst query-context-uncounted gap — defer or address?

---

## 5. Day 7 candidate stack

| # | Item | Owner | Notes |
|---|---|---|---|
| 1 | **Waleed runs Wave 5.2 baseline measurement** | Waleed (manual op) | Now actually mechanical — no more file-corruption blockers. The PR for Wave 2.4 needs a baseline to compare against in Step 2 of Wave 1.5. |
| 2 | **Decide token budget for Wave 2.4 (#1 above) and open the PR** | Waleed | First real test of the Wave 1.5 protocol end-to-end |
| 3 | Wave 4 prompt stable/volatile split | Principal Prompt Engineer | Big-cost cache-invalidation work; should ride its own PR through the protocol; unblocks cheaper volatile-only edits going forward |
| 4 | Wave 2.4 JSONL-judge loader in `scripts/eval/wave_1_4_v3_harness.ts` | RAG Specialist | So the eval can consume the new `wave_2_4_cases.jsonl` fixture |
| 5 | T3 web_search wiring in `evalHarness.runFullCascade` | RAG Specialist | Currently stubbed |
| 6 | Sec Analyst query-context-uncounted decision | Security Analyst | Defer or design |
| 7 | First user of `wave_1_5_compare.ts` — actually run it against the Wave 2.4 PR | QA Lead | Validates the comparator + the protocol end-to-end |

**Recommended Day 7 order:** items 1 + 2 + 4 in parallel (Waleed runs baseline manually, kicks off the Wave 2.4 PR; RAG Specialist wires the loader so the PR's eval cases can actually run). Items 3 + 5 + 6 fan out Day 8+.

---

## 6. The one-line summary

**Day 6 unblocked the deploy path (truncation fix) and shipped a complete Wave 2.4 PR draft ready for the Wave 1.5 protocol — with one honest budget surprise (865 vs. 200 tokens) that's now Waleed's call before the PR ships.**

— End of Day 6.
