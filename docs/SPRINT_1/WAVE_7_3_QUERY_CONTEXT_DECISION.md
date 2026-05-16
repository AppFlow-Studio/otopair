# Wave 7.3 — Query-Context Moat-Read Gap: Decision Doc

**Date:** 2026-05-16 (Sprint 1 Day 7)
**Author:** AI Security Analyst
**Hill:** KB exfiltration rate-limit (Wave 7.3) — close the one design gap surfaced in `WAVE_7_3_RATE_LIMIT_DESIGN §10.3`.
**Authority:** `docs/SPRINT_1/WAVE_7_3_RATE_LIMIT_DESIGN.md` §§2.2, 10.3 (prior spec); `docs/ARCHITECTURE_v3_AMENDMENTS.md` §C.4 + §C.4.1 (R-3 risk + Waleed's explicit acceptance of the residual farm-case risk).
**Scope:** This is a design + decision doc. There is no runnable code here. The implementing engineer for the chosen option writes the code in the next wave.

---

## 0. What this document is, in one paragraph

The Wave 7.3 rate-limit design specified a per-user moat-read counter that bumps inside the same Convex transaction as each moat-table read. The counter bump is a `ctx.db.patch(userId, …)` — which Convex permits inside **mutation** and **action** contexts, but **not inside a `query`**. The chat-agent attack vector runs in action context and bumps cleanly, but Convex `query` functions that read moat tables (the ones exposed to mobile via `useQuery`) cannot bump and therefore go uncounted. Today's doc resolves this gap: I evaluate three options (A: accept the gap; B: action-side aggregation; C: re-route all moat reads through actions), pick one with rationale, surface decisions for Waleed, and update the R-3 status table.

---

## 1. The gap in plain terms

### 1.1 Why Convex's query/action distinction matters for the counter

Convex's runtime separates three function shapes:

| Shape | Reads DB? | Writes DB? (`patch`, `insert`, `delete`) | Calls external APIs? | Where it runs |
|---|---|---|---|---|
| `query` | Yes | **No** | No | Reactive cache; auto-re-runs on dependency change |
| `mutation` | Yes | Yes | No | Transactional; serialized per-document |
| `action` | Indirect (via `ctx.runQuery`/`ctx.runMutation`) | Indirect (via `ctx.runMutation`) | Yes | Non-transactional; the only place HTTP/Anthropic/OpenAI calls happen |

The Wave 7.3 counter bump is `ctx.db.patch(userId, { moat_reads_window: newCount })` — a write. Inside a `query`, this method does not exist. Inside a `mutation` or `action` (via a wrapped `internalMutation`), it does.

This is not a Convex bug or an unforeseen edge — it is the platform's deliberate read/write separation that makes queries cheap to re-run and cacheable. The constraint applies to every Convex app, not just ours.

### 1.2 Why this matters for moat-table reads on the mobile

Mobile screens fetch live data via React's `useQuery(api.X.list)` hook. That hook binds to a Convex **`query`** function — by definition. The query function reads the moat table and returns rows; the mobile renders them; if the table changes, the query re-runs reactively. None of this fan-out path passes through a mutation or action, so the Wave 7.3 helper's bump step (which IS a write) cannot fire on those reads.

The blast radius of these `useQuery`-bound moat reads in the current codebase (verified by grep against the 28-table union from `WAVE_7_3_RATE_LIMIT_DESIGN §1.2`):

| Call site | Moat table read | Volume |
|---|---|---|
| `hooks/useServicesFromConvex.ts` → `api.services.list` | `services` | One call per Services screen mount |
| `hooks/useServiceCategoriesFromConvex.ts` → `api.service_categories.list` | `service_categories` | One call per Services screen mount |
| `hooks/useServiceVehicleSpecsForEngine.ts` → `api.service_vehicle_specs.getSpecsForEngineAndServices` | `service_vehicle_specs` | Per vehicle-engine selection |
| `hooks/useServiceOptionsForSelected.ts` → `api.service_options.getByServiceIds` | `service_options` | Per service selection |
| `app/demo.tsx` (5 calls — dev-only screen) | `makes`, `models`, `trims`, `engines`, `services` | Demo only; not user-facing |

That is **four user-facing call sites + one demo screen**. All other mobile `useQuery` hooks (verified with `useQuery\(api\.` grep across the repo — 58 occurrences across 37 files) point to non-moat tables (`users`, `bookings`, `shops`, `vehicles`, `ai_conversations`, `mechanics`, `reviews`, `rewards`, etc., all of which are asker-owned or vendor records per §1.3 of the prior spec).

This number — four — is load-bearing for the cost analysis below.

---

## 2. Threat model under each option

I use three concrete adversaries:

- **Adv-1 — "the curious developer."** Someone with a legitimate user account who reverse-engineers the Convex API surface (the api object is shipped to the client; the bundled JS reveals the public function names). They write a Node script that calls `api.services.list` in a loop with their own auth token. **No farm; one account.** This is the cheapest attack against R-3 — no infrastructure, no money, just a competitor engineer with a Saturday.
- **Adv-2 — "the chat-agent driver."** A scraper who runs queries through the chat-agent (sendMessage action) at high volume, trying to fan-out moat reads via `retrieve_vehicle_facts`, `get_vehicle_facts`, and `lookup_vehicle_spec`. Single account.
- **Adv-3 — "the scraper farm."** A funded competitor with N fake accounts ($500-2,500 cost per `WAVE_7_3_RATE_LIMIT_DESIGN §4.3`), each running either Adv-1 or Adv-2 attack patterns. Out of scope for Wave 7.3; explicitly accepted by Waleed in Architecture Amendments §C.4.1. Listed here only for completeness in the threat-model table.

### 2.1 Option A — Accept the gap

**What it does:** the helper bumps only in mutation/action context (current spec). Mobile `useQuery` moat reads are uncounted by design; documented as known.

| Adversary | Attack succeeds? | Why |
|---|---|---|
| Adv-1 (curious dev, query API) | **YES** | Hits `api.services.list` etc. directly via the public Convex client. No counter bump fires. Extracts at full network speed. |
| Adv-2 (chat-agent driver) | NO | Chat-agent runs in action context; counter bumps; soft-block at 1× threshold; hard-block at 2×. Per §3 of prior spec. |
| Adv-3 (farm) | YES — by §C.4.1 acceptance | Same as Adv-2 across N accounts; the per-account counter is irrelevant once N is large enough. Out of scope. |

**The sobering scenario.** A competitor obtains the public api manifest (it's literally shipped to every client), writes 50 lines of Node that calls `api.services.list`, `api.service_categories.list`, `api.service_vehicle_specs.getSpecsForEngineAndServices` (looping over every (engine, service) tuple), and `api.service_options.getByServiceIds` (looping over every service). With one legitimate account, they extract the entire Service Definitions Moat (§1.2.D of prior spec — 7 tables, ~50K rows on order). The counter does not move. No telemetry event fires. No admin investigation triggers. The exfiltration is invisible until we notice the moat's competitive distinctiveness erode by other means.

The four moat tables reachable this way (`services`, `service_categories`, `service_vehicle_specs`, `service_options`) are **the Service Definitions Moat sub-set** of the 28. They are not the highest-value moat (`vehicle_facts` and the structural-vehicle moat are higher), but they are a meaningful slice (~6.5K rows, more if `service_vehicle_specs` is large — its per-config rows multiply out).

Honest framing: Option A leaves a deliberate hole in the R-3 mitigation specifically against the cheapest adversary (Adv-1, single competitor engineer, zero infrastructure cost). The hole is bounded — it covers only the four `useQuery`-bound moat tables, not the structural moat or `vehicle_facts` — but the hole exists and we are choosing to leave it.

### 2.2 Option B — Action-side aggregation

**What it does:** the chat-agent's tool handlers in `convex/oto/chat.ts` already call moat reads via `ctx.runQuery(api.X.Y, ...)` (verified at lines 1112-1117, 1123-1127, 1155-1203 of `convex/oto/chat.ts`). Wrap **those calls** through a small adapter `queryMoatViaAction(ctx, "tableName", apiRef, args)` that (i) runs the underlying query, (ii) inspects the row count of the returned result, (iii) calls `ctx.runMutation(internal.oto.queryMoat.bumpUserCounter, { userId, rowsDelta })` to increment the counter. The mobile `useQuery` direct paths remain uncounted but the chat-agent-mediated reads (which are the dominant moat-fan-out volume per turn) ARE counted.

| Adversary | Attack succeeds? | Why |
|---|---|---|
| Adv-1 (curious dev, query API) | **YES** | Same as Option A — the four `useQuery` call sites still bypass the counter. Option B does not improve Adv-1's defense relative to A. |
| Adv-2 (chat-agent driver) | NO | Same as A — chat-agent reads bump cleanly. |
| Adv-3 (farm) | YES (out of scope) | Same as A. |

**Subtle effect on what the counter MEASURES.** In the prior spec, the counter sums "moat rows the user incurred." Under Option B, it actually sums "moat rows the chat-agent surfaced to the user." The mobile screen mounts (Services tab, demo screen) that fan out 50-500 rows of `services`/`service_categories` are NOT in the counter. The two numbers are close but not identical; legitimate-user p95 calibration (§2.5 of prior spec) needs to be re-anchored on the "chat-agent-mediated" definition. This is a minor calibration concession, not a structural one — the counter is still meaningful, it just measures a slightly narrower thing.

**The honest assessment of Option B.** It does not actually close the gap. Adv-1 (the cheapest adversary) is still wide open against the four moat tables exposed via `useQuery`. Option B's name "Action-side aggregation" is true but misleads on what defense it adds — the action-side path is **already counted** under the helper's mutation-context bump as specified in `WAVE_7_3_RATE_LIMIT_DESIGN §2.2`. What Option B explicitly adds is: a guarantee that the action-context call sites in `chat.ts` (which use `ctx.runQuery` to a query function, rather than a direct `ctx.db.query`) are not silently uncounted by virtue of being `runQuery`-mediated.

That guarantee matters — it's the difference between "the spec assumes the helper sits inside the query function" (which would mean the query function still can't bump) and "the spec is implemented such that the bump fires from the action-context caller." Either pattern works for Adv-2; only one of them is buildable given Convex's query write-prohibition. Option B is the buildable shape of the prior spec's action-context counting, not new defense. **Option B is the prior spec, restated more honestly.**

### 2.3 Option C — Push moat reads into action context

**What it does:** every mobile `useQuery(api.X.Y)` call against a moat table is replaced. The mobile calls `ctx.useAction(api.X.Y)` (or a thin wrapper hook `useActionQuery`) which invokes an action that internally reads the moat table AND bumps the counter. The four mobile call sites (plus the demo screen) change. The Convex API on the moat-read paths flips from `query` to `action`.

| Adversary | Attack succeeds? | Why |
|---|---|---|
| Adv-1 (curious dev, query API) | NO | The `api.services.list` query function is removed (or kept as a thin shell that delegates). The only callable path is an action that bumps the counter. Adv-1 trips the counter as they enumerate. |
| Adv-2 (chat-agent driver) | NO | Same as A/B — already counted. |
| Adv-3 (farm) | YES (out of scope) | Same as A/B. |

**What changes structurally.**

1. **Mobile-side hooks:** the four hooks switch from `useQuery(api.X.Y, args)` to a wrapper that invokes the action. React Query / Convex's reactive `useQuery` returns a cached result and updates reactively when the underlying table changes. Actions are imperative — they return a result once. To preserve the reactive UX (Services screen updates when an admin adds a service), one of two compromises:
   - (a) Replace reactivity with manual refresh + invalidation. The Services tab no longer hot-updates; user pull-to-refresh or screen-focus triggers a re-read. UX regression.
   - (b) Keep a tiny query that returns a read-token (random nonce), and have the mobile re-invoke the action on every token change. Adds plumbing.
2. **Latency:** an action invocation has ~50-200ms additional p50 overhead vs. a query (queries hit the reactive cache; actions cold-start a function). The Services tab cold-mount is currently ~120ms (Convex query cache hit); under Option C it becomes ~250-350ms.
3. **Billing:** Convex's actions are billed at a different rate than queries. Order-of-magnitude: 4 user-facing query calls per Services screen mount become 4 action invocations. At 10K screen mounts/day (rough current order), that's 40K additional action invocations/day. Convex pricing for actions ~5-10× per-call vs. queries.
4. **Reactivity loss is not trivial.** The whole `useXFromConvex` pattern in our hooks/ directory is built on Convex's reactive-query model. Inverting that for moat reads creates an inconsistent pattern — some hooks reactive, some imperative — and the discipline cost ripples through onboarding.

**Mobile call sites that change (exhaustive — verified by grep):**

| File | Current call | Replacement |
|---|---|---|
| `hooks/useServicesFromConvex.ts` | `useQuery(api.services.list)` | `useActionWrapper(api.oto.moatReads.servicesList)` |
| `hooks/useServiceCategoriesFromConvex.ts` | `useQuery(api.service_categories.list)` | `useActionWrapper(api.oto.moatReads.serviceCategoriesList)` |
| `hooks/useServiceVehicleSpecsForEngine.ts` | `useQuery(api.service_vehicle_specs.getSpecsForEngineAndServices, …)` | `useActionWrapper(api.oto.moatReads.specsForEngine, …)` |
| `hooks/useServiceOptionsForSelected.ts` | `useQuery(api.service_options.getByServiceIds, …)` | `useActionWrapper(api.oto.moatReads.optionsByServiceIds, …)` |
| `app/demo.tsx` (5 calls) | `useQuery(api.{makes,models,trims,engines,services}.{…})` | Either same wrapper, OR keep demo screen exempt under `// DEMO_EXEMPT` |

Five user-facing files; five new action-wrapper functions in `convex/oto/moatReads.ts` (new file). Engineering cost: order of **2-3 engineering days** for the action wrappers + hook migration + reactivity-loss handling. The hooks/ tree pattern violation is the soft cost.

**Backend-side new files:**

- `convex/oto/moatReads.ts` — one action per moat-read-shape currently exposed via `useQuery`. Each action: (i) call the original query via `ctx.runQuery`, (ii) bump counter via `ctx.runMutation`, (iii) return result. Five actions for four hooks + the demo.
- Optionally: keep the query functions and mark them `internal.X.Y` (Convex's `internalQuery` is callable only from server-side, not from the client). This is the **cleanest closure** of Adv-1 — the Convex platform itself refuses to dispatch a client call to an internalQuery. Adv-1's reverse-engineered script gets `Function not found` and the attack stops at the platform layer, not the helper layer. **Strongly recommended if we pick Option C.**

---

## 3. Cost analysis (Option-by-Option)

| Dimension | Option A | Option B | Option C |
|---|---|---|---|
| Engineering cost (effort) | 0 | ~0.5 day (re-state spec wording, no code change beyond what's already specced) | ~2-3 days (5 hooks rewritten + 5 new actions + reactivity handling + demo screen exempt) |
| Mobile call sites changed | 0 | 0 | 5 (4 user-facing hooks + 1 demo screen) |
| New Convex files | 0 | 0 | 1 (`convex/oto/moatReads.ts`) |
| Mobile pattern violations | 0 | 0 | 5 hooks deviate from the `useXFromConvex` reactive pattern |
| Operational ops/day (extra) | 0 | 0 | ~40K extra action invocations/day (10K screen mounts × ~4 moat hooks per mount) |
| Per-call latency hit | 0 | 0 | +130-230ms p50 per call (action cold-start vs. query cache) |
| Convex bill delta | 0 | 0 | Order-of-magnitude: ~$15-50/month depending on action pricing tier (low absolute, but a recurring line item) |
| Reactivity preserved | Yes | Yes | **No** (moat-read screens lose reactive auto-refresh) |
| R-3 single-account closure | Partial (chat-action only) | Partial (chat-action only) | Full (chat-action + mobile `useQuery` paths both counted) |
| Adv-1 blocked? | NO | NO | YES |
| Adv-2 blocked? | YES | YES | YES |

**The cost cliff between B and C is real.** Option C is 4-5× the engineering effort of Option B, regresses the reactive UX on moat-read screens, adds a recurring Convex line item, and breaks the `useXFromConvex` hook-pattern uniformity that the codebase deliberately maintains (per CLAUDE.md "useXFromConvex pattern" rule).

**The defense cliff between B and C is also real.** Adv-1 (zero-cost, zero-infrastructure adversary) is blocked under C and wide open under B. This is precisely the cheapest adversary class — the one every R-3 control should at least notice.

---

## 4. Recommendation: **Option B** — with eyes open and a concrete tripwire for promotion to Option C if Adv-1 ever shows up

### 4.1 The pick

Option B. The action-side aggregation pattern is the buildable shape of the Wave 7.3 spec's action-context counting. It does not close the Adv-1 gap; it does honestly resolve the spec ambiguity that §10.3 of the prior doc flagged.

### 4.2 The honest framing (Doc 3 §9 hill — "honest gaps over papered-over claims")

The clean way to write this recommendation would be "Option B is enough." That would be a papered-over claim. What's actually true:

- **For Adv-2 (chat-agent driver),** Option B is sufficient. The chat-agent is the realistic R-3 attack vector — the model is what makes the moat distinctive (curated, surfaced through chat, evidence-tied), and the chat-agent is where a determined scraper invests effort because it gets richer joins (the agent reasons across structural + KB + lookup tools).
- **For Adv-1 (curious dev, direct query),** Option B is **insufficient**. The four `useQuery`-bound moat tables are exfiltrable at full speed with no counter signal. We have explicitly chosen to leave that hole.
- **The hole is bounded.** It covers the Service Definitions Moat sub-set (4 tables: `services`, `service_categories`, `service_vehicle_specs`, `service_options`) — not `vehicle_facts`, not the structural-vehicle moat, not the parts moat, not the tire moat. Of the 28 moat tables, four are exposed to `useQuery` today. Exfiltrating those four does not get the adversary the full moat — it gets them a slice.
- **The hole is not architecturally fixed.** A future feature that exposes `vehicle_configs` or `vehicle_facts` via `useQuery` (a mobile car-config browse, a mobile FAQ index, etc.) widens the hole. Option B does not prevent that; only Option C does. We mitigate this with a CI grep rule (§5.3) that flags any new `useQuery` call against a moat table — so widening the hole requires explicit acknowledgement.

### 4.3 Why not C

The cost is real and the defense improvement is partial (Adv-1 fixed; Adv-3 still open because of farm). The cost we'd pay (~2-3 days, reactivity regression on Services tab, recurring Convex bill) buys defense against an adversary class that, on prior estimates, is one engineer-Saturday level. That's a real cost for a real defense, but **it is not the right cost-defense ratio given that Adv-3 (the farm) is the higher-severity, already-accepted residual.** If we are willing to accept Adv-3 (a $500-2,500 farm exfiltrating 1.1M rows in 1.1-5.3 hours), accepting Adv-1 (one engineer-Saturday exfiltrating ~6.5K rows from Service Definitions over a weekend) is on the same risk axis at a strictly lower magnitude.

The right rule of thumb: **don't pay structural code-pattern cost (reactive→imperative inversion) to defend against an adversary class that's strictly less severe than an already-accepted one.** That is the gold-plating trap.

### 4.4 Why not A

Option A is essentially "do nothing and write a justification." That's defensible against Adv-1 only if we have a tripwire that promotes Adv-1 from "theoretical" to "observed" so we can react. Option B IS Option A with the action-side path explicitly counted (which the spec already required) — i.e., Option B is Option A's bare-minimum implementation, not an additional control on top of A. The framing difference is just doc honesty.

### 4.5 The tripwire for promotion to C

Adopt Option B for Sprint 1; instrument the Convex query layer to surface a low-cost macro signal that we'd see if Adv-1 starts hitting us:

- **Server-side metric:** track `api.services.list` / `api.service_categories.list` / `api.service_vehicle_specs.getSpecsForEngineAndServices` / `api.service_options.getByServiceIds` daily call volume per user. Convex Cloud exposes per-function call counts in its ops dashboard.
- **Trigger:** any single user (by Clerk identity or Convex `users._id`) exceeding 10× the p95 of legitimate daily call volume for any of those four functions, sustained 24h. We get this from Convex's built-in metrics — no new instrumentation.
- **Response when tripped:** promote Option C from "deferred" to "P1 — ship within 7 days." Re-route the four hooks through actions.

This is the same posture as the cross-account-farm tripwire in `WAVE_7_3_RATE_LIMIT_DESIGN §7.1` — instrument the macro signal, react when it fires, don't pre-build infrastructure against phantoms.

---

## 5. Implementation sketch — Option B

### 5.1 Files affected (no full implementation today; sketches only)

**New file: `convex/oto/queryMoat.ts`** (already specced in `WAVE_7_3_RATE_LIMIT_DESIGN §2.2`; Option B does not change its contract). The helper continues to expose:

```typescript
// queryMoat — for direct in-context calls (mutation/action ctx only)
export async function queryMoat<T>(ctx, tableName, build): Promise<T[]>

// queryMoatViaRunQuery — for action ctx that dispatches to a query function
// via ctx.runQuery; the action receives the row count back and bumps.
export async function queryMoatViaRunQuery<T>(
  ctx: ActionCtx,
  tableName: MoatTableName,
  apiRef: FunctionReference<"query">,
  args: any,
): Promise<T[]> {
  const rows = await ctx.runQuery(apiRef, args);
  // Action ctx CAN dispatch a mutation — this is the legal bump path.
  if (await getCallingUserIdOrNull(ctx) !== null) {
    await ctx.runMutation(internal.oto.queryMoat.bumpUserCounter, {
      userId: ...,
      rowsDelta: Array.isArray(rows) ? rows.length : (rows ? 1 : 0),
    });
  }
  return rows;
}
```

The new `queryMoatViaRunQuery` variant is the action-context shape. The bump runs via `ctx.runMutation` — Convex's only legal write path from an action.

**Modified file: `convex/oto/chat.ts`** — the moat-read tool handlers wrap their `ctx.runQuery` calls in `queryMoatViaRunQuery`. Three call sites verified:

- Line ~1114 `get_vehicle_facts` → `ctx.runQuery(api.oto.vehicleFacts.getVehicleFacts, …)` wraps to `queryMoatViaRunQuery(ctx, "vehicle_configs", api.oto.vehicleFacts.getVehicleFacts, …)` (or whichever moat tables the underlying query reads — the implementing engineer audits).
- Line ~1125 `lookup_vehicle_spec` → `ctx.runQuery(api.oto.lookupVehicleSpec.lookupVehicleSpec, …)` wraps similarly.
- Line ~1182 `retrieve_vehicle_facts` → `ctx.runAction(api.oto.vehicleFactsKB.cascadeTier2, …)` — this is action-to-action; the called action `cascadeTier2` does its own moat-table reads internally; the counter bump must happen INSIDE `cascadeTier2` (action context). The implementing engineer adds the wrapper there.

**Modified file: `convex/oto/vehicleFactsKB.ts`** (Tier-2 cascade — RAG Specialist's deliverable) — the three sub-strategies (T2_HASH, T2_STRUCT, T2_TEXT) read `vehicle_facts` and structural tables. Each read wraps through `queryMoat` (since `cascadeTier2` is itself an action, it has mutation-dispatch capability and uses the in-context form via a `ctx.runMutation` bump after each sub-strategy returns).

**Updated CI rule: Rule 6 in `scripts/ci/vehicle-facts-grep.sh`** — the rule from §6 of the prior spec is extended to also forbid `ctx.runQuery(api.X)` where X is a moat-table-reading query function, outside `queryMoatViaRunQuery`. The implementing engineer enumerates the moat-reading query function names (small list — `api.services.list`, `api.service_categories.list`, `api.makes.list`, etc.) and adds them to the regex.

**New CI rule: Rule 7** — forbid `useQuery\(api\.(services|service_categories|service_vehicle_specs|service_options|makes|models|engines|trims|generations|transmissions|chassis_variants|chassis_specs|vehicle_configs|drivetrain_configs|trim_specs|oem_parts|part_fitments|part_prices|service_intervals|labor_times|mechanic_verifications|tire_brands|tire_size_cache|tire_models|tire_pricing|model_year_cache|trim_year_cache|vehicle_facts)\.` in the mobile codebase (app/, components/, hooks/) — **except** for the four currently-known sites, which are grandfathered with a `// MOAT_USEQUERY_EXEMPT: Option B — Adv-1 known gap` comment. Any new mobile `useQuery` call against a moat table fails CI and forces an explicit Waleed sign-off to extend the gap.

### 5.2 No mobile changes

This is the load-bearing simplicity of Option B. The four `useQuery` call sites stay exactly as they are. No hook migration. No reactivity loss. No latency hit. The mobile shipping cost is zero.

### 5.3 Telemetry addition

Add a daily aggregation that pulls per-user call counts for the four uncovered query functions from Convex's ops metrics (or, if those metrics aren't queryable from user-code, add a thin `oto_telemetry` row on each call from inside the query function — note this would itself require a mutation context for the insert, which a query can't do; so the telemetry has to be sampled at the function-level metrics tier, not the per-call data tier).

The metric to alert on: per-user 24h call count > 10× p95(legitimate). One-pager runbook lives at `docs/SPRINT_1/MOAT_USEQUERY_TRIPWIRE.md` (separate deliverable, not in scope today; flagged for the implementing engineer).

### 5.4 What the implementing engineer reads first

- `WAVE_7_3_RATE_LIMIT_DESIGN.md` §§2.2, 9 (helper API + checklist).
- This doc §5.1.
- `convex/oto/chat.ts` lines 1080-1300 (the moat-read tool handlers).
- `scripts/ci/vehicle-facts-grep.sh` (existing CI rules; Rules 6 + 7 extend that script).

---

## 6. Decisions flagged for Waleed

This section is the explicit ask. I produce the recommendation; Waleed ratifies before the implementing engineer starts.

### 6.1 (D-Q1) Adv-1 acceptance — do you accept the four-table single-account hole?

**Question.** Option B leaves four moat tables (`services`, `service_categories`, `service_vehicle_specs`, `service_options`) reachable at full speed by a single legitimate user account via the public Convex query API, with no counter signal. The hole is bounded (these 4 of 28 tables; the Service Definitions Moat sub-set) but is a strictly weaker R-3 mitigation than the chat-agent path receives.

**Frame I recommend.** Same posture as your Architecture Amendments §C.4.1 framing for the cross-account farm: "rate-limiting is a cost-floor against casual scraping, not a wall against a resourced adversary." Adv-1 here is the casual scraper. Accepting them is consistent with the prior acceptance of Adv-3 (which is strictly worse).

**Sign-off needed.** Explicit yes/no. If yes, the design is locked at Option B with the §5 sketch. If no (you want Adv-1 closed), we promote to Option C and re-scope the wave.

### 6.2 (D-Q2) The tripwire criterion

**Question.** I propose the Convex per-function-per-user call-count macro signal (§4.5) as the tripwire for promoting Option C from "deferred" to "P1." Threshold: any user exceeding 10× p95(legitimate) on any of the four moat-`useQuery`-bound functions, sustained 24h.

**Alternative framings you might prefer.** (a) Lower threshold (5× p95) — more sensitive, more false positives. (b) Per-table absolute threshold (e.g., 10K rows of `services` returned in 24h to a single user, regardless of multiplier) — simpler, doesn't require p95 calibration on this signal. (c) No automated tripwire; quarterly manual review of the four function metrics.

**Sign-off needed.** Either confirm 10×p95 sustained 24h, or specify the threshold/framing you want.

### 6.3 (D-Q3) CI Rule 7 — `useQuery` moat-table grandfather list

**Question.** I propose CI Rule 7 fails any new `useQuery(api.X.Y)` call against a moat table in `app/`, `components/`, `hooks/`, with a grandfathered exemption for the four current sites. Future moat-`useQuery` calls require explicit security review (= extending the gap) before merge.

**Alternative.** No CI rule; relying on schema-review-time vigilance. (Argued against: the gap-widening risk is real — every new mobile feature pulls a moat table into `useQuery` if not flagged.)

**Sign-off needed.** Confirm the CI rule lands; confirm or amend the four-site grandfather list.

---

## 7. R-3 status update

Per `WAVE_7_3_RATE_LIMIT_DESIGN §10` (decisions flagged for Waleed), the prior doc's open items were:

| ID | Item | Status before this doc | Status after this doc |
|---|---|---|---|
| §10.1 | `mechanic_verifications` inclusion in the 28-table count | OPEN (awaiting Waleed) | OPEN — unchanged here |
| §10.2 | `is_admin_exempt` flag vs. allowlist-only | OPEN (awaiting Waleed) | OPEN — unchanged here |
| **§10.3** | **Convex query-context moat reads uncounted** | **OPEN (known gap, flagged for visibility)** | **RESOLVED via Option B** (this doc) — with acceptance of Adv-1 four-table hole per §6.1 below |
| §10.4 | N=50 starting point for threshold formula | DEFERRED to Sprint 2 calibration | DEFERRED — unchanged here |

### 7.1 R-3 row in `RISK_REGISTER.md` — updated wording

Per `WAVE_7_3_RATE_LIMIT_DESIGN §4.5` (the ship-time amendment), and now extended to incorporate the Option B selection:

> **R-3 — KB moat exfiltration. Severity: Irreversible.**
>
> **Single-account exposure via chat-agent (action context):** mitigated. Per-user rate-limit caps a lone adversary at ~10K rows/24h, raising solo extraction time of the full moat to ~3.5 months.
>
> **Single-account exposure via direct `useQuery` on four `useQuery`-bound moat tables (`services`, `service_categories`, `service_vehicle_specs`, `service_options`):** unmitigated. A single legitimate-account adversary can exfiltrate this four-table slice at full network speed. Hole is bounded — does not include `vehicle_facts`, structural vehicle moat, parts moat, or tire moat. Promotion trigger: Convex per-function-per-user 24h call count > 10× p95 sustained = promote Option C re-routing to P1.
>
> **Cross-account exposure (scraper farm):** unmitigated. Per Architecture Amendments §C.4.1, Waleed explicitly accepted the R-3 farm-case residual; rate-limiting is a cost-floor, not a wall.
>
> **Strategic premise:** moat is defensible under R-3 only if adversary attention lags behind defensive maturation. Quarterly moat-growth-rate vs. theoretical-extraction-rate metric retained.

### 7.2 Cross-reference to Architecture Amendments

`ARCHITECTURE_v3_AMENDMENTS §C.4` and §C.4.1 — Waleed's acceptance of the farm-case residual is the precedent for Adv-1 acceptance under §6.1 here. The two acceptances live on the same risk axis (resourced-vs-casual adversary continuum); the Adv-1 acceptance is the strictly-lower-magnitude case.

---

## 8. The honest residual after this decision

After Option B ships and §6.1 is ratified, the R-3 residual exposure is:

1. **Adv-1 four-table single-account hole.** Bounded; macro-signal tripwire monitors for promotion to Option C.
2. **Adv-3 cross-account farm.** Per Architecture Amendments §C.4.1; explicitly accepted by Waleed; out of scope until cross-account behavioral correlation work lands.
3. **New mobile features that add moat tables to `useQuery`** — CI Rule 7 catches at PR time; widening the hole requires explicit acknowledgement.

This is the honest map of where R-3 stands. None of these is a paper-over. (1) is a chosen acceptance with a tripwire. (2) is a prior chosen acceptance. (3) is a procedural control with CI enforcement.

What's NOT residual (closed by this design + prior spec):

- The chat-agent attack vector (Adv-2). Closed.
- The KB write-path (web_search-derived facts hitting `vehicle_facts`). Closed by the `record_vehicle_fact` helper + confidence-floor enforcement (per `vehicleFactsEditing.ts`).
- The "I read the moat but didn't count it" Convex-context ambiguity from §10.3 of the prior spec. Resolved here.

---

## 9. Cross-references

| Concept | This doc | Prior docs |
|---|---|---|
| The §10.3 gap (Convex query can't patch) | §1.1 | `WAVE_7_3_RATE_LIMIT_DESIGN` §§2.2, 10.3 |
| Option A / B / C threat model | §2 | (new in this doc) |
| Option A / B / C cost analysis | §3 | (new in this doc) |
| Recommendation: Option B | §4 | (new in this doc) |
| Implementation sketch (Option B) | §5 | extends `WAVE_7_3_RATE_LIMIT_DESIGN` §§2.2, 6, 9 |
| Decisions flagged for Waleed | §6 | extends `WAVE_7_3_RATE_LIMIT_DESIGN` §10 |
| R-3 status table | §7 | `WAVE_7_3_RATE_LIMIT_DESIGN` §§4.5, 10; `ARCHITECTURE_v3_AMENDMENTS` §C.4, §C.4.1 |
| Honest residual | §8 | extends `ARCHITECTURE_v3_AMENDMENTS` §C.4.1 framing |

---

— AI Security Analyst, Sprint 1 Day 7 deliverable.
