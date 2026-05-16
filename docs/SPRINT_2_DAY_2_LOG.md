# Sprint 2 Day 2 — Execution Log
**Date:** 2026-05-16 (same calendar day; Day 2 follows Day 1's parallel-dispatch model)
**Authority:** `docs/CLAUDE_CODE_HANDOFF.md` §8 candidate stack — items 2 + 3 + 4 (Sprint 2 Day 1 follow-ups).
**Owner:** PM (orchestrator), executing 2 parallel subagents.

---

## 0. Day 2 in one sentence

**Two parallel subagents shipped Wave 7.3 Option B's action-context wire-through (`bumpUserCounter` internalMutation + 5 chat.ts consumers migrated) and the QA Lead's verified-fact eval helpers follow-up (new `verifiedFactsSeed.ts` + `multiTenantSetup.ts` API surface) — 9/9 CI clean throughout; two real divergences surfaced (query-context residual + TS2589 cascade from `queryMoat` import) and resolved without inventing new API surface; the Day 1 commits (`d521e5b` Sprint 1 + `60b65ae` Sprint 2 Day 1) landed at the head of the day.**

---

## 1. Methodology — Day 2 dispatch pattern

Day 1 used 5 parallel subagents; Day 2 collapsed to 2 because handoff §8 items 2 + 3 share owner (Security Analyst) and both touch `chat.ts` — safer in one dispatch than two parallel ones racing the same file. Item 4 (Memory Engineer) writes only in `scripts/eval/lib/` + `convex/oto/migrations/` — no overlap with Security Analyst's surface.

| Agent | Primary write surface | Read surface |
|---|---|---|
| Security Analyst | `convex/oto/queryMoat.ts`, `convex/oto/chat.ts`, `convex/oto/vehicleFactsEditing.ts` (EXEMPT annotation only) | Wave 7.3 design + query-context decision; lookupVehicleSpec.ts grandfather precedent |
| Memory Engineer | `convex/oto/migrations/verifiedFactsSeed.ts` (NEW), `scripts/eval/lib/multiTenantSetup.ts` | MEMORY_SCHEMA_V3_CONSOLIDATED, PM Ruling §4, vehicleFactsEditing.ts surface, evalTenantsSeed.ts pattern |

No agent touched another agent's primary surface. Both used bash for file writes with `wc -l` + `tail -3` verification per methodology rule §5.2.

### 1.1 PM-side divergence — custom agent slugs not registered

The handoff prescribes dispatching via `Task` with `subagent_type: <slug>` where slugs are the role names in `.claude/agents/<role>.md` frontmatter (`name: ai-security-analyst`, etc.). At dispatch time the harness rejected the custom slugs — only built-in slugs (`general-purpose`, `Explore`, `Plan`, `codebase-explorer`, etc.) are registered. The `.claude/agents/` files exist on disk and define mandates/constraints, but their `name:` frontmatter isn't being read as a dispatch-type registration.

**PM ruling (in this log):** dispatch via `subagent_type: general-purpose` with the role specification embedded in the prompt. The prompts direct each subagent to read its role file (`.claude/agents/<role>.md`) FIRST and follow its mandate + constraints. This preserves the methodology with one extra line of prompt overhead; the role spec is unchanged, the constraints are unchanged, the convening discipline is unchanged.

**Promotion path:** investigate whether Claude Code custom agent loading needs a `/agents` registration step or a different frontmatter key. Not blocking; the embedded-role-spec pattern works.

---

## 2. What landed (by subagent)

### 2.1 Security Analyst — Wave 7.3 Option B wire-through (§8 items 2 + 3)

**Files modified:**

| File | Before | After | Delta |
|---|---|---|---|
| `convex/oto/queryMoat.ts` | 307 | 410 | +103 (bumpUserCounter internalMutation + MIGRATION POSTURE header update) |
| `convex/oto/chat.ts` | 1352 | 1424 | +72 (user._id threading through buildCallables; bumpMoat closure; 5 callable wirings) |
| `convex/oto/vehicleFactsEditing.ts` | 456 | 468 | +12 (per-call EXEMPT annotation — see divergence below) |

**`bumpUserCounter` internalMutation:**

Exported from `queryMoat.ts`. Signature: `{ userId: v.id("users"), rowsDelta: v.number(), threshold: v.optional(v.number()) }` returning `{ decision: "ok" | "soft_block" | "hard_block" }`. Performs the same window / threshold / admin-exempt logic as the internal `applyBumpAndDecide` function. Default threshold = `getMoatThresholdN() * MOAT_P95_DEFAULT`. Callable via `ctx.runMutation(internal.oto.queryMoat.bumpUserCounter, ...)` from action context.

**Action-context design pick: Option (ii) — caller-explicit wiring.** Reason: chat.ts already resolves `user._id` at line 340 for auth and uses explicit `ctx.runMutation` for every other side effect (telemetry, ai_messages, polite-exit counter). A `queryMoatFromAction` wrapper would hide the bump behind another layer for no surface-area saving and make per-call-site audit harder. Documented in the queryMoat.ts header (extension of the existing MIGRATION POSTURE block).

**Consumers migrated through the action-side bump (5 callables in chat.ts):**

| # | Callable | Table(s) | Bump pattern |
|---|---|---|---|
| 1 | `list_services_for_vehicle` | `services` | `await bumpMoat("services", all?.length ?? 0)` after `ctx.runQuery(api.services.list, {})` |
| 2 | `get_service_details` | `services` | same pattern (rowsDelta from runQuery result length) |
| 3 | `get_vehicle_facts` | `trim_specs` | `await bumpMoat("trim_specs", result ? 1 : 0)`. **Point lookups via `ctx.db.get(id)` are NOT counted** — design intent is wide-scan exfiltration deterrence, not PK lookups. |
| 4 | `lookup_vehicle_spec` | `vehicle_configs+models+makes` | `await bumpMoat(..., cands + matched)` (conservative attribution) |
| 5 | `retrieve_vehicle_facts` | `vehicle_facts` | `await bumpMoat("vehicle_facts", result?.facts?.length ?? 0)` after `cascadeTier2` action returns |

**Divergence 1 — `vehicleFactsEditing.ts` migration NOT applied through `queryMoat()`.**

Importing `queryMoat` into `vehicleFactsEditing.ts` triggered a file-wide TS2589 ("Type instantiation excessively deep") cascade across the other `mutation({...})` declarations (`insertFact`, `editVehicleFact`, `reportVehicleFact`, `resolveFactReport`, `recordVehicleFact`). The import widens the api-tree resolution depth past the TS compiler's limit, breaking type narrowing for every handler body. Per the dispatch's STOP-and-report guidance for chains that can't migrate cleanly, the Security Analyst added a per-call EXEMPT annotation instead. **Inbound call attribution preserved:** chat.ts's `record_vehicle_fact` callable still bumps the action-side counter via `bumpUserCounter` before the inner mutation runs, so the read is counted at the user-visible boundary.

**Promotion path (Day 3 candidate):** rewrite `queryMoat` to break the union dependency (parameterize on `TableName extends MoatTable` more loosely, or factor the helper into a sibling file with narrower imports). Not blocking; Wave 7.3 Option B is functionally complete with this caveat.

**Divergence 2 — query-context residual on moat reads.**

Most moat-table reads in `convex/oto/` are in `query` context (`vehicleFacts.ts`, `vehicleFactsKB.ts`, `lookupVehicleSpec.ts`). Convex platform invariant: queries cannot patch — they cannot self-bump via `queryMoat()`. This is the explicitly-accepted Adv-1 hole per `WAVE_7_3_QUERY_CONTEXT_DECISION.md` §6.1.

The Security Analyst did NOT add EXEMPT annotations to these sites because:
- (a) CI Rule 7 regex is single-line `ctx.db.query("<table>")`; multi-line `ctx.db\n  .query("<table>")` doesn't match.
- (b) The design already accepts this hole; no enforcement gap.
- (c) The user-visible inbound chat.ts paths already bump via the action-side wiring added in Part 1.

**PM acceptance:** consistent with WAVE_7_3_QUERY_CONTEXT_DECISION §6.1 and the farm-case precedent (§C.4.1). No additional annotation work needed this sprint.

---

### 2.2 Memory Engineer — Verified-fact eval helpers (§8 item 4)

**Files created/modified:**

| File | Status | Lines |
|---|---|---|
| `convex/oto/migrations/verifiedFactsSeed.ts` | NEW | 346 |
| `scripts/eval/lib/multiTenantSetup.ts` | +119 (append) | 176 → 295 |

**Convex-side internalMutations (in `verifiedFactsSeed.ts`):**

- `seedEvalVerifiedFact({ scope, scope_key, topic, fact_text, source, confidence })` — creates a vehicle_facts row via `ctx.runMutation(api.oto.vehicleFactsEditing.recordVehicleFact, ...)` (canonicalize question, clamp confidence ≤ 0.7, `written_by: "system"`, initial status `unverified`), then immediately flips to `verification_status: "verified"` via `ctx.runMutation(api.oto.vehicleFactsEditing.editVehicleFact, ...)` with action `"verify"`. Audit row writes atomically inside the helper per CI Rule 1. Returns `{ fact_id: Id<"vehicle_facts"> }`. Idempotent on re-run.
- `cleanupEvalVerifiedFact({ fact_id })` — deletes `fact_reports` rows for this fact (via `by_fact` index) then deletes `vehicle_facts_audit` rows for this fact (via `by_fact` index) then deletes the `vehicle_facts` row. Idempotent (missing row at any stage is a no-throw noop). Audit-row deletion is allowed by CI Rule 3 only because the entire fact is being torn down — audit history is meaningless without its parent.

**HTTP-client wrappers (in `multiTenantSetup.ts`):**

- `export async function seedVerifiedFact(client, args): Promise<{ fact_id }>` — POSTs to `oto/migrations/verifiedFactsSeed:seedEvalVerifiedFact`.
- `export async function cleanupVerifiedFact(client, args): Promise<void>` — POSTs to `oto/migrations/verifiedFactsSeed:cleanupEvalVerifiedFact`.

Style-matches the existing `seedTenants` / `teardownTenants` pattern: Bearer auth via `postMutation` helper, JSDoc header on each export.

**Part 3 (optional harness refactor) DEFERRED.**

Memory Engineer inspected `scripts/eval/wave_1_4_v3_harness.ts` lines 622-710 and found the `crosstenant-d-002` / `crosstenant-d-003` cases currently use `passed = mode === "mock" ? assertionsOk : false` with `[DEFERRED: requires recordVehicleFact+editVehicleFact setup wiring]` tags — NOT inline mutation calls as the dispatch prompt assumed. Wiring the new helpers in would require:
1. ConvexClient injection through the test runner
2. Teardown plumbing
3. Flipping the assertion gate from `mode === "mock"` to `assertionsOk`

This is greater-than-20 LOC and touches assertion plumbing in surprising ways — hits the STOP condition. Deferred to Day 3 (or a dedicated QA-Lead-led dispatch given the assertion-gate change).

**Decisions made by Memory Engineer (PM acceptance below):**

1. **Helper-reachability:** `recordVehicleFact` / `editVehicleFact` are public `mutation` exports, so the internalMutations call them via `ctx.runMutation(api.oto.vehicleFactsEditing.<name>, ...)` — same pattern as `chat.ts:1278`. Direct import isn't possible from a mutation handler (Convex requires the FunctionReference protocol). **PM accepted.**
2. **TS2589 workaround in arg validators:** Dropped `v.union(v.literal(...))` for `scope` arg and `v.literal("web_search")` for `source` in favor of `v.string()` + runtime `assertScope` / `assertSource` helpers. Trades a thin slice of Convex-layer validation for shallower TS instantiation depth. Runtime assertion is functionally equivalent. **PM accepted** — pragmatic given the codebase-wide TS2589 baseline; the workaround is reversible if the SDK improves.
3. **`scope_key` arg kept on API surface but unused in body:** Carried through for harness-side authoring convenience. **PM accepted** — better to fail loudly later if the field becomes wired than to amputate the API now.

---

## 3. CI grep status

```
Rule 1: forbidden direct patches on vehicle_facts...               OK
Rule 2: forbidden direct replace on vehicle_facts...               OK
Rule 3: forbidden direct insert into vehicle_facts_audit...        OK
Rule 4: no new embedding writes...                                 OK
Rule 5: retired vehicle_searched_facts name must not reappear...   OK
Rule 6: chat-tool moat reads must filter EvalTest...               OK
Rule 7: moat-table reads must route through queryMoat helper...    OK
Rule 8: prompt-split discipline (shim integrity + section import boundary)... OK
Rule 9: MOAT_TABLES list integrity (28 entries; matches architecture amendment)... OK
All vehicle-facts invariant checks passed (9/9 rules clean).
```

9/9 throughout Day 2.

---

## 4. TypeScript compile status

Errors on the agents' write surfaces:

| File | Count | Type | Status |
|---|---|---|---|
| `convex/oto/migrations/verifiedFactsSeed.ts` | 2 | TS2589 (deep instantiation) | NEW file emits same baseline pattern as sibling migration files (`evalTenantsSeed.ts`, `backfillV3Lifecycle.ts`, `vehicleFactsReconciliation.ts`). Codebase baseline approximately 471 TS2589 errors. |
| `convex/oto/queryMoat.ts` | 1 | TS2345 (helper-internal type mismatch) | Pre-existing; was at line 200 before header expansion, now line 231 after the ~30-line MIGRATION POSTURE addition. Same logical site. |
| `convex/oto/vehicleFactsEditing.ts` | 20 | TS2589 + TS2339 + TS2538 | Pre-existing baseline; unchanged delta from the EXEMPT-annotation addition. |
| `convex/oto/chat.ts` | 0 new | — | Clean; the `@ts-expect-error TS2589` pattern at line 252 absorbs the bump-mutation reference. |
| `scripts/eval/lib/multiTenantSetup.ts` | 0 new | — | Clean. |

`convex/` total: 754 errors (codebase baseline). `app/` + `components/` total: approximately 197 (frontend baseline). None of Day 2's work introduced new logic-bug TS errors; all incrementals are the well-known Convex v-validator TS2589 generic-depth pattern.

Schema brace-balance: open=128, close=128, delta=0. Schema untouched this day.

---

## 5. Decisions applied (PM leans)

| # | Decision | Applied | Reversal cost |
|---|---|---|---|
| 1 | Action-context wiring style: caller-explicit (Option ii) vs wrapper (Option i) | **Option ii** (chat.ts-aligned) | Add `queryMoatFromAction` wrapper later; ~1h |
| 2 | `vehicleFactsEditing.ts` migration through `queryMoat` | **DEFERRED via per-call EXEMPT** (TS2589 blocker) | Promotion-path work: refactor queryMoat to break union dependency; ~2-3h, requires Day 3 dispatch |
| 3 | Query-context moat reads (`vehicleFactsKB.ts` etc.) | **NOT annotated** (consistent with §6.1 acceptance + Rule 7 single-line regex) | Add EXEMPT annotations if Rule 7 ever extends to multi-line; trivial |
| 4 | Verified-fact API validators: `v.literal` vs runtime assert | **Runtime assert** (TS2589 reduction) | Switch to `v.literal` when SDK improves; ~10min |
| 5 | Harness refactor (crosstenant-d-002/003) | **DEFERRED** (greater-than-20 LOC, assertion-gate change) | Schedule QA-Lead-led dispatch; 1 day |
| 6 | Custom agent slugs not registering as dispatch types | **Embed role spec in general-purpose prompt** | Investigate `/agents` registration or different frontmatter key; ~30min |

---

## 6. Decisions still on Waleed's plate

### Blocking the first end-to-end Wave 1.5 protocol run (unchanged from Day 1)
1. **Wave 5.2 baseline measurement** (10-min manual op — `docs/SPRINT_1/WAVE_5_2_BASELINE_RUNBOOK.md`)
2. **Wave 2.4 token budget** (200 / 290 / 540 / 865 tokens)
3. **A/B start percentage** for first protocol run (100% direct vs 25% canary)
4. **Run `runBackfillV3Lifecycle`** against live Convex

### New from Day 2
5. Confirm Option (ii) action-context wiring as the canonical pattern for future moat-read sites (PM lean: yes — it matches chat.ts; eliminates wrapper-API maintenance)
6. Confirm acceptance of query-context residual (PM lean: yes — already accepted in §6.1; nothing new)
7. Confirm Day 3 priority: `vehicleFactsEditing.ts` queryMoat refactor (TS2589 unblock) vs harness refactor (crosstenant-d-002/003 wire-up) vs new Wave (3 / 7.1 / 7.2)

---

## 7. Sprint 2 Day 3 candidate stack

| # | Item | Owner | Notes |
|---|---|---|---|
| 1 | Refactor `queryMoat` to break union dependency; migrate `vehicleFactsEditing.ts` through it | Security Analyst | Day 2 divergence 1 promotion path. ~2-3h. Surfaces a structural fix to the TS2589 helper-internal limit. |
| 2 | Wire crosstenant-d-002/003 through new `seedVerifiedFact` helpers + flip assertion gate | QA Lead | Day 2 Part 3 deferral. Requires ConvexClient injection through harness runner. |
| 3 | Investigate custom-agent-slug registration | PM | Day 2 PM-side divergence. ~30min. Promotion path: if registration works, future dispatches use slugs directly. |
| 4 | Wave 2.4 prompt PR (first real user of Wave 1.5 protocol) | Interaction Strategist + Principal Prompt Engineer | **BLOCKED on Waleed #2/#3.** PR draft: `docs/SPRINT_1/WAVE_2_4_PR_DRAFT.md`. |
| 5 | Wave 3 memory keystone (5 tables + written_by + 120d exp decay) | Memory Engineer | North-star Wave 3 — biggest swing. Multi-day. |
| 6 | Wave 7.1 untrusted-input wrapping | Security Analyst | Security Analyst's hill-to-die-on per their role file. |
| 7 | Wave 7.2 degradation ladder | LLM Reliability Engineer | North-star Sprint 2+ scope. |
| 8 | Wave 1.9 schema-hash CI guard | Principal Prompt Engineer / PM | North-star — Prompt Engineer's request. |
| 9 | Wave 4 split v2 — finer boundary (interleaved volatile from stable) | Principal Prompt Engineer | Defer until Wave 2.4 lands cleanly. |

**Recommended Day 3 pick:** items 1 + 2 in parallel — both are Day 2 follow-ups, no surface overlap (Security Analyst on `convex/oto/`, QA Lead on `scripts/eval/`). Item 3 is mechanical (PM-side). Items 4-9 are bigger swings that should ride their own days.

---

## 8. The Day 2 one-line summary

**Two subagents in parallel shipped Wave 7.3 Option B's action-context wire-through (5 chat.ts callables migrated through `bumpUserCounter` internalMutation) and the verified-fact eval helpers (`seedEvalVerifiedFact` / `cleanupEvalVerifiedFact` + HTTP wrappers), surfaced two real divergences (queryMoat TS2589 cascade blocking vehicleFactsEditing.ts migration; query-context residual confirmed accepted), and applied PM-lean defaults on 6 reversible decisions including the action-context wiring style — 9/9 CI clean throughout, schema brace-balanced delta=0, no new logic-bug TS errors, plus a PM-side finding: the 11 custom agent slugs in `.claude/agents/` aren't registered as dispatch types so subagents ran as `general-purpose` with the role spec embedded in the prompt.**

— End of Sprint 2 Day 2.
