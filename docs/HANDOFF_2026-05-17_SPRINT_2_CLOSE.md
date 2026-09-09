# Sprint 2 → Sprint 3 handoff — v3 AI architecture closed at MVP
**Date:** 2026-05-17 (Sprint 2 Day 11 EOD)
**From:** Claude Code (Sprint 2 run; 11 days of dispatches Day 1 → Day 11 inclusive)
**To:** Next Claude Code (Sprint 3 — capability expansion + feature build-out)
**Status:** Sprint 2 substantively complete at ~94-95% MVP for the v3 AI architecture. Wave 3 (memory keystone) at 9/11 user-facing helpers (admin-only 2/11 deferable). Wave 7 substrate at near-max. Wave 5 design-doc shipped + Cat M starter cases queued. Sprint 3 picks up CAPABILITY EXPANSION (registry + new feature surfaces) + Wave 5 implementation + Wave 1.5 statistical baseline + Wave 6 deterministic router.

---

## 0. The 8 things you must know before anything else

1. **You are the PM orchestrator** for an 11-subagent team (defined in `.claude/agents/`). Dispatch substantive work via `subagent_type: "general-purpose"` and have each agent `Read` its own role file at `.claude/agents/<role>.md` first. The custom-agent slugs are NOT registered in this Claude Code harness.

2. **Surface-partitioned parallel dispatching is the proven pattern.** 11 days of Sprint 2 ran 2-way and 3-way parallel dispatches without merge conflicts. The discipline: each dispatch brief explicitly names what the OTHER dispatch is writing to + forbids cross-surface edits. The pattern scales.

3. **Per-pass commits are mandatory.** End of each logical pass / dispatch round. Sprint 1 went 8 days uncommitted; Sprint 2 maintained ~1-3 commits per day with zero rollback regret.

4. **20 CI invariants are LOAD-BEARING.** Run `bash scripts/ci/vehicle-facts-grep.sh` after EVERY substantive change. **20/20 rules must stay green.** Rules 1-11 (Sprint 1 + 2) defend `vehicle_facts` + `queryMoat`. Rules 12-17 (Wave 3) defend memory-keystone helper boundaries. Rules 18-19 (Day 9) defend `reliability_events`. Rule 20 (Wave 1.9, Day 10) is the SHA-256 schema-hash drift guard.

5. **Schema changes require updating `scripts/ci/schema-hash.expected`.** Rule 20 will fail loudly otherwise. AND you must verify any prompt rules referencing the touched enums are still accurate.

6. **Two distinct auth surfaces.** Convex deploy key (`Authorization: Convex <key>`) for `internalQuery` / `internalMutation` / `npx convex` commands. User JWT (`Authorization: Bearer <token>`) for chat:sendMessage + public mutations + queries. ~1-hour JWT life. The teardown script (`scripts/eval/runs/_teardown-fixtures.ts`) uses deploy-key auth.

7. **Do NOT deploy `waleed-dev-oto` to prod** without explicit re-validation. Sprint 1-3 substrate is on dev (`flippant-mink-750`); prod is locked at the cylinders-hotfix-only state.

8. **Auto-memory at `C:\Users\manso\.claude\projects\C--Users-manso-Desktop-otopair-1\memory\`** persists. Read `MEMORY.md` on session start. Note: the `project_diagnostic_form_is_booking_customer_notes.md` memory clarifies a product-flow misunderstanding that bit twice — `render_diagnostic_form` doesn't draw a separate UI; it parameterizes the booking flow's Service Options screen.

---

## 1. Sprint 2 commit timeline (final)

```
Day 11:  62ef4f5  Sprint 2 Day 11 Pass B: Wave 5 design + 7 Cat M starter cases
         fe06867  Sprint 2 Day 11 Pass A: fixture-isolation teardown script

Day 10:  f1e5f81  Sprint 2 Day 10 log
         3aa3c8f  Sprint 2 Day 10: Wave 7.3 enforcement + Wave 7.2 ladder + Wave 1.9 + equivalence v2 + CI rules 18-20

Day 9:   2fdeb7c  Sprint 2 Day 9 log
         1052ece  Sprint 2 Day 9: Wave 7.2 ladder design + 20-site observability + Wave 7.3 PII rate-limit + schema index fix

Day 8:   de6a1d4  Sprint 2 Day 8 log
         105f18e  Sprint 2 Day 8 fix: getCrossConversationMemory ReturnsValidationError
         f097c0d  Sprint 2 Day 8: v0.13 untrusted-input rule + testing modernized + cascade strangler + cross-conv personalization

Day 7:   95d37cf  Sprint 2 Day 7 log
         5c5647d  Sprint 2 Day 7: retract pair (9/11) + Wave 7.1 wrapping + sanitizer + 3 adversarial cases

Day 6:   7d0bac0  Sprint 2 Day 6 log
         74f746e  Sprint 2 Day 6 Pass B+C: wire reinforceUserSemanticFact + memoryDecay.ts + eval rigor
         f3c17ad  Sprint 2 Day 6 Pass A: 2 chat-turn-killer reliability bugs + args:any cleanup

Day 5:   37d1e9b  Sprint 2 Day 5: 5 semantic-fact eval cases + CASE_FILTER runner + Option B declined

Day 4 (Sprint 1→2 bridge):
         b22f34f  Handoff doc for next Claude Code session after /clear
         f8ee607  Wave 3 step 6: wire recordUserSemanticFact via new AI tool record_semantic_fact
         54b169d  chat.ts: retry+backoff on Anthropic 5xx/429 + friendly fallback
         85f4528  Wave 3 integration step 5: wire recordSelectionFact at render-tool dispatch
         28bfea1  Wave 3 integration step 4: working-memory READ path (cross-conversation memory)
         5f56f93  Wave 3 integration step 3: wire commitEpisodic + commitControl
         6fe08ba  Wave 3 integration step 2: wire recordConversationFact
         912ebe2  Wave 3 integration: wire memoryEditing.recordTurn into chat.ts (dual-write)
         80a20a4  Wave 3 Day 4: 14 eval cases (cat-g/h/i) + LabeledEntry extension
         dfd0f0b  Wave 3 Day 3: CI Rules 12-17 — defend the 5 memory-keystone tables
         c7463f6  Wave 3 Day 2 + cross-mandate review
         1aa36ea  Wave 3 Day 1: 5 memory-keystone tables + memoryEditing.ts helper skeleton
         (Sprint 2 entered at commit `b22f34f` post-`/clear`)
```

**Sprint 2 net contribution:** 11 days, ~20 commits, ~8000 lines added across `convex/oto/` + `scripts/` + `docs/`. Wave 3 (6/11 → 9/11), Wave 4 (split done), Wave 5 (cascade strangler complete + design doc), Wave 7.1 (full), Wave 7.2 (design + impl), Wave 7.3 (defense-in-depth + enforcement), Wave 1.9 (CI guard).

---

## 2. What's deployed where (final)

| Deployment | URL | Has Sprint 1? | Has Sprint 2? |
|---|---|---|---|
| Dev (flippant-mink-750) | `https://flippant-mink-750.convex.cloud` | YES | **YES** (current HEAD — 9/11 helpers wired, v0.13, Wave 5 cascade strangler complete, Wave 7.1+7.2+7.3 live, Wave 1.9 guard) |
| Prod (mellow-cat-431) | `https://mellow-cat-431.convex.cloud` | **NO** (only cylinders hotfix) | **NO** |

Prod stays unvalidated for Sprint 1-3. Hotfixes branch from `806403a` (pre-Sprint-1).

---

## 3. Wave-by-wave status (final Sprint 2 close)

| Wave | Status | Sprint 3 work |
|---|---|---|
| **Wave 1.4** v3 KB consolidation | ✓ Sprint 1 done | — |
| **Wave 1.5** statistical comparator protocol | Primitive shipped Day 8 (REPEAT env in runner); **formal multi-version run NOT YET DONE** | Run N=5-10 on v0.9 → v0.13 on representative subset. Day 11 demo showed 1 unstable adversarial case at 1/3 PASS. |
| **Wave 1.9** schema-hash CI guard | ✓ Day 10 (Rule 20 + `scripts/ci/schema-hash.expected`) | — |
| **Wave 2.4** token budget | Open carryover — no progress | Carryover to Sprint 3 |
| **Wave 3** memory keystone | **9/11 user-facing helpers wired** (admin-only 2/11 deferable): `recordTurn`, `recordConversationFact`, `commitEpisodic`, `commitControl`, `recordSelectionFact`, `getCrossConversationMemory`, `recordUserSemanticFact` + `reinforce*` + `retract*` pair; `memoryDecay.ts` 120-day pure function; equivalence v2 (Day 10) | Admin-only `registerKbTopic` / `deprecateKbTopic` if needed |
| **Wave 4** prompt split | ✓ Sprint 2 Day 1; v0.13 currently | Wave 4 split v2 (finer boundary) deferred |
| **Wave 5** retrieval rebuild | **DESIGN COMPLETE Day 11** (`docs/SPRINT_2/WAVE_5_RETRIEVAL_REBUILD.md` 254 lines, 9 sections); 7 Cat M starter cases SPEC-only | **Implementation is Sprint 3 priority** |
| **Wave 6** deterministic router | NOT STARTED | Sprint 3 (multi-day) — addresses Haiku tool-batching variance |
| **Wave 7.1** untrusted-input wrapping | ✓ Day 7 (envelope) + Day 7 (sanitizer) + Day 8 (v0.13 semantic rule) | Day 11 found tag-smuggling case at 1/3 PASS — Sprint 3 sharpen prompt OR relax test |
| **Wave 7.2** degradation ladder | ✓ Day 9 (design doc + observability infra) + Day 10 (state-decision impl + pre-turn gate) | §9 PM-review checkboxes need ratification; success-event recording (v2 promotion) is Sprint 3 |
| **Wave 7.3** PII rate-limit | ✓ Day 9 (primitive) + Day 10 (full enforcement) | Soft-block tier (DECISION-C) optional |

---

## 4. Eval suite state (final)

```
Total cases:       57 (49 active + 8 disabled — 1 polite-exit + 7 Cat M)
Runner primitives: tools_called, tools_not_called, branch,
                   text_contains, text_not_contains, form_system,
                   envelope_contains, envelope_not_contains,
                   pre_seed_mutations (per-case),
                   CASE_FILTER env, REPEAT env
Pre-existing 50 cases: byte-identical to HEAD (SHA-256 d9ea515b…)
Cat M cases:       7 SPEC cases for Wave 5 reranker v2 implementation
                   (all disabled until impl lands)
Decay self-test:   4/4 PASS (memoryDecay.ts)
Equivalence v2 self-test: 24/24 PASS (memoryEquivalence.ts, 7 taxonomies)
Teardown utility:  scripts/eval/runs/_teardown-fixtures.ts (deploy-key auth)
```

**Known eval flap (Sprint 3 priority):**
- `prompt_injection_tag_smuggling_rejected` — Day 11 REPEAT=3 shows 1/3 PASS. Same case PASSed Day 8, FAILed Day 9. Haiku sometimes echoes `<system>` / `record_semantic_fact` from the user's injection content. Backend defense holds; user-visible response leaks.

---

## 5. The single most important thing in this handoff

**Sprint 2 closed at MVP-capability. Sprint 3's first priority is NOT more architecture — it's the CAPABILITY REGISTRY (`docs/OTO_CAPABILITY_REGISTRY.md`).** Waleed explicitly raised the concern that "the system was molded through core features of this sprint and if we add more features for the app it would break." The capability registry is the answer: a single source of truth for every domain Oto supports, what tools/tables/render components back each, and what Oto MUST NOT do per domain (negative space). Author it FIRST before any new feature work.

After the registry, Sprint 3 builds: `render_link_button` (smallest new feature, sets the app-redirect pattern) → Loyalty program tools (3-4 new data tools + prompt section) → Booking Status surface (extend get_bookings + render_booking_card) → any other features Waleed enumerates during the brain-dump phase.

---

## 6. Sprint 3 priority queue (refreshed; ordered by leverage)

### Tier 1 — Capability foundation (FIRST)
1. **Capability Registry** (`docs/OTO_CAPABILITY_REGISTRY.md`) — single source of truth for everything Oto supports. ~1 hour PM mechanical doc work. Brain-dump session with Waleed for `planned` items.

### Tier 2 — User-visible feature surfaces
2. **`render_link_button`** — Privacy / TOS / Customer Support redirect pattern. New AI tool + dispatcher + prompt rule + eval case + version bump v0.13 → v0.14. ~half-day.
3. **Loyalty program tools** — `get_loyalty_points_history`, `get_available_redemptions`, `get_loyalty_program_info`, possibly `render_redemption_card`. Plus prompt section explaining the loyalty domain. ~half-day.
4. **Booking Status surface** — extend `get_bookings` with filters or add `get_pending_bookings`; render_booking_card or render_bookings_list; prompt routing + eval cases. ~half-day.

### Tier 3 — Sprint 2 carryovers (small, batchable)
5. **`prompt_injection_tag_smuggling_rejected` sharpening** — either tighten v0.13 → v0.14 stable.ts rule OR relax test assertions. Small dispatch. Day 11 finding makes this Sprint 3 priority.
6. **Wave 1.5 formal multi-version run** — N=5-10 on representative subset across v0.9 → v0.14 (after #5 bumps). ~2-4 hr Anthropic compute; can run with deploy-key auth for multi-hour windows.
7. **Within-session per-case fixture-isolation hook** — runner-level `--teardown-before-each` flag. Closes the Day 11 limitation (negative-control flap). ~30 min PM mechanical OR small dispatch.
8. **Volatile.ts examples for v0.13 untrusted-input rule** — contrastive example pair. Small Prompt Engineer dispatch.
9. **`fact_type` weighting in reranker** — needs Cat M eval signal (Wave 5 implementation prerequisite).
10. **Confidence + age annotation in envelope** — RAG Day 8 flagged; Sprint 3 envelope work.
11. **DRY `FORBIDDEN_ENVELOPE_TAGS`** — currently duplicated between `sanitizeSemanticPayload` (Day 7) + `memoryEquivalence.isAdversarialEither` (Day 10). Small mechanical.
12. **Manual cleanup of accumulated near-duplicate rows** in test user's `user_semantic_facts` table — equivalence v2 prevents new ones; existing rows persist. Use `_teardown-fixtures.ts`.

### Tier 4 — Wave 5 implementation
13. **Wave 5 reranker v2 implementation** per `docs/SPRINT_2/WAVE_5_RETRIEVAL_REBUILD.md` — multiplicative score composition (`base_weight × decay × recency × adversarial`), top_K=5 clamp [0, 1.5], floor 0.1. 1-day RAG Specialist.
14. **20-30 additional Cat M cases** beyond the 7 starter cases — RAG Specialist or QA Lead. Multi-day.
15. **Wave 5 weight tuning** against Cat M pass rate — iterative. Multi-day with eval signal feedback loop.

### Tier 5 — Wave 6 deterministic router
16. **Wave 6 deterministic router** — addresses multi-tool batching + meta-narration regressions. Multi-day, multi-agent.

### Tier 6 — Wave 7.2 v2 + observability extension
17. **Wave 7.2 §9 PM-review checkboxes** ratification (4 vs 3 threshold; MINIMAL canned-message copy; v2 success-event recording for explicit consecutive-success promotion).
18. **Soft-block tier on PII counter** (Security DECISION-C, optional, trivial).
19. **Mobile UI handling** of new `error_kind` values: `"minimal_mode"`, `"ladder_down"` (surface to mobile team).

### Tier 7 — Smaller carryovers (deferred since Day 4-5)
20. Wave 5.2 baseline measurement on prod (prod-deploy gate)
21. Wave 2.4 token budget
22. A/B start percentage for first protocol run
23. `runBackfillV3Lifecycle` against live Convex
24. Rotate prod deploy key
25. Duplicate BMW M550i G30 2020 configs on dev
26. Custom-agent-slug native registration experiment
27. Project hygiene: `scripts/eval/runs/` ephemeral output cleanup

---

## 7. Methodology lessons (carried forward to Sprint 3)

1. **Surface-partitioned parallel dispatching scales.** 2-way → 3-way → 4-way works as long as the brief explicitly names cross-surface restrictions.
2. **Static checks PASS != runtime correctness.** Day 8 ReturnsValidationError + Day 11 fact_id-vs-_id bug both caught by first-run validation, not by CI/brace/TS. Always validate at runtime before declaring done.
3. **Wave 1.5 protocol primitive (REPEAT env) is shipped + works** — Day 11 demo proved real Haiku variance on 1/4 adversarial cases. Don't draw conclusions from N=1.
4. **JWT lifetime is the binding constraint on multi-step validation.** ~60-min sessions fit dispatch + commit + small smoke; they don't fit full 50-case sweeps OR multi-version Wave 1.5 runs. Use deploy-key auth for long-running validation.
5. **CI invariants 18-20 (Day 9-10) extend the schema-discipline pattern.** Any new tables go through the same pattern: define table + add helper-only-write CI rule + update schema-hash baseline.
6. **`render_diagnostic_form` is NOT a separate UI** (saved as project memory). It parameterizes the booking flow's Service Options screen. Don't get this wrong a third time.

---

## 8. The literal copy-paste prompt for Sprint 3

When you start Claude Code in `C:\Users\manso\Desktop\otopair-1\` after `/clear`, paste this:

```
You are the PM orchestrator for OtoPair's Sprint 3 (capability expansion phase), continuing from Sprint 2 Day 11 close (commit 62ef4f5 + Day 11 log). Sprint 2 closed the v3 AI architecture at ~94-95% MVP capability. Sprint 3 picks up: capability registry FIRST (Waleed's explicit request), then new feature surfaces (render_link_button + Loyalty + Booking Status), then Wave 5 implementation + Wave 1.5 formal multi-version run + Wave 6 router.

Read these in order before doing anything else:
1. docs/HANDOFF_2026-05-17_SPRINT_2_CLOSE.md — the Sprint 2 close handoff. State of every wave, commit timeline, what's deployed where.
2. docs/SPRINT_2_DAY_11_LOG.md — Day 11 specifics + the tag-smuggling variance finding
3. docs/SPRINT_2/WAVE_5_RETRIEVAL_REBUILD.md — Wave 5 design doc; Sprint 3 implements this
4. .claude/agents/_pm-orchestrator.md — your role definition
5. CLAUDE.md + REFERENCES.md — project context

After reading, verify state:
1. `git log --oneline -10` — should start with 62ef4f5 (Wave 5 design) or later
2. `bash scripts/ci/vehicle-facts-grep.sh` — expect 20/20 rules clean (Day 10+ added 18-20)
3. `awk` brace-balance check on convex/schema.ts — expect open=140, close=140, delta=0
4. Schema hash check: `sha256sum convex/schema.ts | awk '{print $1}'` must match scripts/ci/schema-hash.expected (Wave 1.9 Rule 20)
5. Eval cases count: `node -e "console.log(JSON.parse(require('fs').readFileSync('scripts/oto-eval-cases.json','utf8')).cases.length)"` — should be 57 (49 active + 8 disabled)

Then START with the CAPABILITY REGISTRY (Tier 1 priority per HANDOFF §6). Author `docs/OTO_CAPABILITY_REGISTRY.md` covering every current Oto behavior (Vehicle / Diagnostic / Booking / Memory / Trust Protocol / Safety / Security / Reliability / Retrieval / Loyalty (basic) / Account / Support) + add `planned` sections for Waleed's queued features. Use the structure outlined in the prior conversation (Domain → User-visible behaviors → Tools (status) → Data sources → Oto MUST NOT → Eval coverage).

DO NOT START FEATURE WORK before the registry. The registry IS the contract Sprint 3 feature dispatches reference.

Methodology rules (non-negotiable, same as Sprint 2):
- Dispatch via Task tool with subagent_type: "general-purpose"; tell each agent to Read .claude/agents/<role>.md first
- Surface-partitioned parallel dispatching (see HANDOFF §7)
- 20 CI invariants must stay green (`bash scripts/ci/vehicle-facts-grep.sh`)
- Schema-hash drift guard (Rule 20) — update scripts/ci/schema-hash.expected on intentional schema changes
- Per-pass commits
- Day logs (docs/SPRINT_3_DAY_N_LOG.md) after each dispatch round
- The `project_diagnostic_form_is_booking_customer_notes` memory has the correct product mental model for the diagnostic flow

Operational keys (unchanged from Sprint 2):
- Dev deploy key: dev:flippant-mink-750|eyJ2MiI6ImNlNTk3ZDE1N2QxZjQyYzA5ZmRhYzFmYzIxOGU4MGQ5In0=
- Dev Convex URL: https://flippant-mink-750.convex.cloud
- Prod Convex URL: https://mellow-cat-431.convex.cloud — DO NOT DEPLOY waleed-dev-oto here
- User JWT for chat:sendMessage: ~1-hour validity, fresh per session. `await window.__oto.clerk.session.getToken({template:"convex"})` in browser console at localhost:8000
- Test user._id: md7fjepfczgwtpn0vpas2y3rrh83ggb3
- Test M550i full VIN: WBAJS7C01LBN96146 (eval default, tail "N96146")
- 57-case eval suite + REPEAT env for N=K statistical runs
- Fixture teardown utility: scripts/eval/runs/_teardown-fixtures.ts (deploy-key auth)

Do NOT:
- Deploy waleed-dev-oto to prod
- Skip the capability registry
- Touch convex/_generated/
- Bypass Wave 1.9 schema-hash CI guard
- Trust subagent claims without verifying against ground truth
- Write features into the AI surface without first adding the registry entry
```

That's the prompt. Sprint 3 starts at the capability registry.

---

## 9. The single one-sentence summary

**Sprint 2 closed at ~94-95% MVP capability for OtoPair's v3 AI architecture: Wave 3 memory keystone user-facing complete (9/11 helpers; 2 admin-only deferable), Wave 4 stable+volatile prompt split shipped (v0.13), Wave 5 cascade strangler complete in production + retrieval-rebuild design doc shipped (`docs/SPRINT_2/WAVE_5_RETRIEVAL_REBUILD.md` with 254-line 9-section reranker v2 spec + 7 Cat M starter SPEC cases queued), Wave 7.1 untrusted-input wrapping + helper sanitizer + v0.13 semantic rule live (defense-in-depth fully active; 1 case `prompt_injection_tag_smuggling_rejected` confirmed unstable at 1/3 under REPEAT=3 — Sprint 3 sharpening priority), Wave 7.2 degradation ladder design + observability infra + state-decision implementation + pre-turn gate fully live (4-state FULL/DEGRADED/MINIMAL/DOWN auto-gating active), Wave 7.3 PII rate-limit defense-in-depth + full enforcement live, Wave 1.9 schema-hash CI guard live (Rule 20 + baseline at `scripts/ci/schema-hash.expected`), Wave 1.5 statistical primitive (REPEAT env in runner) shipped, equivalence v2 (`convex/oto/memoryEquivalence.ts` 24/24 self-test) shipped, between-session fixture-isolation teardown utility (`scripts/eval/runs/_teardown-fixtures.ts`) shipped; 20 CI invariants up from 17 (added reliability_events write/delete protection + schema-hash drift guard); 57 eval cases (49 active + 8 disabled including 7 Cat M for Sprint 3); Sprint 3 first priority per Waleed's explicit ask is the capability registry (`docs/OTO_CAPABILITY_REGISTRY.md`) as the single source of truth before any new feature surface lands.**

— End of Sprint 2 handoff. Ready for Sprint 3.
