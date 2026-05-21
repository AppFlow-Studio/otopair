# Oto / Otopair — Holes & Gaps Report  *(UPDATED 2026-05-18 with fix status)*

**To:** Waleed
**From:** Temur (testing pass) → annotated by Claude after this session's fixes
**Purpose:** Original report's structure preserved. Each item now has a **STATUS** line tied to the actual code change.
**Scope filter for this update:** Oto AI backend + Oto AI behavior ONLY. Stripe / payments / UI / pricing-business-logic items are flagged **OUT OF SCOPE — not Oto backend.**
**Reference fix list:** see `OTO_AI_HANDOFF.md` §6 and `OTO_AI_TEST_PIPELINE.md` §8 for full file:line citations.

---

## PART A — CONFIRMED ISSUES (verified in Convex this pass)

### C1 — Vehicle-specific preference stored with no vehicle scope
- **What:** In `user_semantic_facts` (waleed), active (non-retracted) rows with `fact_type: "mechanic_preference"`, payload "User only trusts BMW specialists, never general shops", **`vehicle_id` = null/absent**. Example record id: `kn7p20yjktezf5xt9c4hd12gad86xx37`.
- **Where:** `user_semantic_facts` table; compare to correctly-scoped rows which carry `vehicle_id` = the BMW vehicle `pn7cqddamnfpkfr6qqn1wnrx1h8329d1`.
- **Why it's an issue:** The context loader pulling user facts will apply this BMW-only preference to **every** vehicle the user has. This is the literal mechanism that produced "recommend a BMW specialist" on a Mercedes conversation.
- **Confirm in 5 min:** Query `user_semantic_facts` for `fact_type in (mechanic_preference, service_preference, vehicle_quirk)` AND `vehicle_id` null/absent AND not retracted.

**STATUS — ✅ FIXED (three layers, this session):**
1. **Live offender retracted via Convex MCP:** `kn7p20yjktezf5xt9c4hd12gad86xx37` now has `retracted_at`, `retracted_at_floor_ms`, `retracted_reason: "unscoped_brand_specific_pollution_2026_05_18 — payload 'User only trusts BMW specialists' was recorded as user-level mechanic_preference without vehicle_id; would leak across all non-BMW vehicles (confirmed on AMG GT). Retracted manually pending write-side scoping fix in memoryEditing.ts."`. Only one live unscoped brand-specific row was found (the other live row `kn7v8cehm5n6s4prwqgebtxxv586wv5n` is `communication_style` which is appropriately user-level).
2. **Write-side guard (`convex/oto/memoryEditing.ts:510-547`):** `recordUserSemanticFact` now rejects writes where `fact_type` is `mechanic_preference` or `service_preference` AND payload matches `BRAND_TOKENS_RE` (35+ makes: BMW, Mercedes, Audi, VW, Porsche, Toyota, Honda, Tesla, Lincoln, Ram, etc.) AND `vehicle_id` is missing. Error message tells Haiku exactly how to retry — either pass `vehicle_id` to scope, or generalize the payload (e.g., "User prefers brand-specialist mechanics" instead of "User prefers BMW specialists"). Haiku self-corrects from the error text.
3. **Read-side silent-discard rule (`convex/oto/prompt/stable.ts:1202`):** New strict prompt section in `# Vehicle scoping` — when Oto detects a mis-scoped fact in `<recent_context>`, it discards silently. Never narrates the detection. 9 banned narration patterns enumerated including the exact Mercedes-screenshot wording. Worked WRONG/RIGHT examples included.

### C2 — Service-due claims possible with zero backing data
- **What:** For the AMG GT (VIN `WDDYK8AA2LA025764`, vehicle `pn74y2dpx313cf56gzhct00a0s83n8zv`, owner `ph70gz3evcjhef0f534w0gctqh83ma2f`): `maintenance_records` = empty, `vehicle_service_states` = empty deployment-wide, no mileage, no last-service anchor.
- **Why it's an issue:** Oto stated "oil due in 2 weeks" for this exact vehicle. There is no row from which a countdown could be derived.
- **Confirm in 5 min:** For any vehicle Oto gives a due date, check `vehicle_service_states by_vehicle_owner` and `maintenance_records by_vehicle_owner`. Both empty + Oto stated a date = fabrication path open.

**STATUS — ✅ FIXED (five layers, this session — F1 fix):**
1. **Fallback table corrected (`convex/oto/vehicleHealth.ts:326-340`):** Previously oil defaulted to `due_soon` while brakes/tires/battery defaulted to `on_time` — both fabrications, opposite directions. All four now default to `"unknown"` when no record exists.
2. **`computeOilStatus` no longer downgrades unknown (`utils/maintenanceStatus.ts:358-369`):** Previously when there WAS an oil record but it lacked `lastServiceDate`/`lastServiceMileage`, the function silently rewrote `"unknown"` to `"due_soon"`. Removed.
3. **`computeBrakeStatus`/`computeTireStatus`/`computeBatteryStatus` empty-record fallbacks (`utils/maintenanceStatus.ts:594, 743, 779`):** No longer claim `"on_time"` with text like "No brake concerns reported" / "No tire concerns reported" / "No battery concerns reported" when there's no service data — these were absence-of-data masquerading as confirmation. Now return `"unknown"` with "No X service history on file" / "Not on file".
4. **`toAiShape` defense-in-depth (`convex/oto/vehicleHealth.ts:374-390`):** When `record_provenance === "inferred"` OR `status === "unknown"`, the AI shape now strips `last_service`, `urgency_label`, `recommendation`. Even if an upstream path slipped fabricated copy (e.g., `URGENT_DETAILS.oil.due_soon = "Service within 2 weeks"`), Haiku can't read fields that aren't there.
5. **Prompt rule strengthened (`convex/oto/prompt/stable.ts:934`):** Replaced one-sentence rule with three paragraphs covering honest-on-unknown + proactive `render_record_confirmation` offer to invite the user to fill the gap + no-bundling discipline. Implements the "push the user to report" behavior you asked for.

**Note:** `vehicle_service_states` empty deployment-wide is confirmed — that means `dueServices.ts` is NOT a parallel fabrication source today. `vehicleHealth.ts` + `URGENT_DETAILS` was the sole F1 surface, and it's now closed at five layers.

### C3 — `ai_conversations` schema drift across deployments
- **What:** Field counts differ: `daniel`=8, `production`=15, `temurbek`=15, `ahmad`=15, `waleed`=16. `waleed` carries fields others lack (incl. `vehicle_id`, `diagnostic_turn_count`).

**STATUS — ⚠️ OUT OF SCOPE FOR ME (deployment management, not Oto backend behavior).** What I can confirm about MY changes:
- `vehicle_id` was added by my Batch B fix to `convex/schema.ts` (lines 1862-1872) along with `setVehicleId` mutation in `convex/ai_conversations.ts` and the precedence flip in `convex/oto/envelope.ts:105-129` and the wire-in at `convex/oto/chat.ts:682-700`.
- `diagnostic_turn_count` is pre-existing (Sprint 2 polite-exit counter, schema line 1853).
- Deployment propagation to production is your team's call. If production doesn't have these fields, my Batch B `setVehicleId` mutation will throw on write attempts to production. Surface-level mitigation: the chat.ts call site swallows failures (`try/catch + console.warn`) — turn won't fail, but the anchor won't persist either.

### C4 — Memory subsystem tables differ by deployment
- **What:** `user_semantic_facts`, `conversation_facts`, `conversation_episodic_control`, `oto_telemetry`, `conversation_audit`, `fact_reports` present in `waleed`/`ahmad`/`temurbek`, absent in `production` and `daniel`.

**STATUS — ⚠️ OUT OF SCOPE FOR ME (deployment management).** What I can confirm about Oto's code dependencies:
- `chat.ts` reads `getCrossConversationMemory` which queries `conversation_facts` + `user_semantic_facts` — wrapped in try/catch, degrades to empty array on failure (`chat.ts:726-738`). So if production lacks these tables, the `<recent_context>` block just doesn't render — no crash, but no cross-conv memory either.
- `recordUserSemanticFact` writes to `user_semantic_facts` — would throw on production if the table doesn't exist. The chat path catches and continues, but the durable user-level memory feature is dark on production.
- `recordTurn` writes to `oto_telemetry` — fire-and-forget; failure doesn't break turn.
- `recordReliabilityEvent` writes to `reliability_events` — same swallow pattern.

The code is defensive-by-design (every memory wire-in catches and continues), so production wouldn't crash. But the entire Wave-3 memory + Wave-7 reliability subsystems would silently no-op on production. Deploy-team confirmation needed.

### C5 — Conversation message-count vs message-row mismatch (verify intent)
- **What:** Many `eval-*`/`harness-*` `ai_conversations` rows have `message_count: 0` while `arc_summary`/`established_facts` are populated.

**STATUS — ✅ EXPLAINED (intentional, not a bug).** From my live audit (`OTO_AI_HANDOFF.md` §10.1 + `OTO_AI_TEST_PIPELINE.md` §5.1, §5.4):
- The 648/324/144/90 cascade across `ai_conversations`/`ai_messages`/`conversation_audit`/`oto_telemetry` shows many empty-row conversations.
- ALL `eval-*` and `harness-*` prefixed sessions are intentionally seeded by the eval harness (`convex/oto/migrations/evalTenantsSeed.ts` + `verifiedFactsSeed.ts`) with state but no messages — they're test fixtures for the cascade harness (`scripts/eval/wave_5_1_harness.ts`).
- Real `oto_*` session rows DO show matching counts when verified — confirmed by audit sampling.

**Residual concern (still open, low priority):** the 7x gap between `ai_conversations` (648) and `oto_telemetry` (90) for the same user is NOT fully explained by eval-fixtures. Logged as **§7.5 Telemetry write gap** in OTO_AI_TEST_PIPELINE.md — investigation candidate.

---

## PART B — UNHANDLED-SCENARIO GAPS (journey-traced; confirm each)

### Payments / booking journey

### G1 — Double-submit / network-retry on booking → double charge
**STATUS — ❌ OUT OF SCOPE — Stripe integration, not Oto backend.** Idempotency keys on Stripe PaymentIntents and the booking-create mutation surface are payment-platform concerns. Oto only renders a booking form (`render_book_service`); the actual booking-create mutation and payment authorization happen on the mobile booking flow + payment screen, owned by the booking/payments team.

### G2 — Auth amount vs capture amount drift
**STATUS — ❌ OUT OF SCOPE — Stripe integration, not Oto backend.** Same reason.

### G3 — Refund path and the 7% platform fee
**STATUS — ❌ OUT OF SCOPE — Stripe integration + business logic, not Oto backend.** Application fee reversal is owned by payments/finance.

### G4 — Walk-in 0% fee vs subsequent 7% — state that decides which
**STATUS — ❌ OUT OF SCOPE — pricing business logic, not Oto backend.** Per-customer fee-tier state is owned by the bookings/pricing team. Oto's `render_book_service` doesn't compute or display fees (per `stable.ts:738-757` Pricing rule: "Oto never composes, quotes, or estimates prices").

### Auth / data-access journey

### G5 — Prompt-driven user_id in a data query
**STATUS — ✅ HANDLED (verified in code).** Confirmed at:
- **Auth resolution (`convex/oto/chat.ts:497-507`):** `ctx.auth.getUserIdentity()` → Clerk subject → `api.users.getByClerkUserId({ clerkUserId: identity.subject })`. User_id derived from session, never from model output.
- **Conversation access check (`chat.ts:515`):** `if (conversation.user_id !== user._id) throw new Error("not authorized")` — every chat turn checks ownership.
- **Tool surface (`convex/oto/tools.ts` + `dispatcher.ts`):** No tool in the 24-tool catalog accepts a `user_id` argument. Every data tool (`get_vehicle_health`, `get_bookings`, `get_vehicle_facts`, etc.) takes only IDs/strings the user already owns or has access to. Auth check is INSIDE each handler via `ctx.auth.getUserIdentity()` — verified in `vehicleHealth.ts:167-173`, `bookings.ts:48-58` (`getBookings` requires Clerk identity, resolves to user via `by_clerkUserId`).
- **Mutations (`memoryEditing.ts`, `ai_conversations.ts` `setVehicleId`):** Same pattern — every mutation resolves the calling user via Clerk and asserts ownership before patching.

The model has zero influence on which user_id is queried. Cross-user data exposure via prompt injection is structurally impossible.

### G6 — Vehicle-owner scoping on shared/duplicate VINs
**STATUS — ✅ HANDLED (verified in code).** Confirmed in `convex/oto/vehicleHealth.ts:179-190`:
```ts
const vehicle = await ctx.db.get(vehicleId);     // vehicle by _id (not VIN)
const owner = await ctx.db
  .query("vehicle_owners")
  .withIndex("by_vin_user", (q) =>
    q.eq("vin", vehicle.vin).eq("user_id", user._id))   // USER_ID first via composite index
  .unique();
```
The `by_vin_user` index is `(vin, user_id)` composite. The query requires BOTH vin AND `user_id === current_user._id`. Two users with the same VIN won't cross-leak — each user's query only matches their own ownership row.

Same pattern in `bookings.ts` (`getByUserId`, `getByUserIdWithDetails`) — all reads scoped via `by_user_id` index, never VIN-first.

### G7 — PII echo (phone/email/address/card)
**STATUS — ✅ MOSTLY HANDLED (envelope is clean; one residual risk in semantic facts).** Verified in `convex/oto/envelope.ts:188-202`:
- **`<user>` block:** Renders ONLY `userFirstName` — no email, no phone, no address.
- **`<vehicle>` block:** Renders `display` (e.g., "2020 BMW M550i xDrive") + opaque `id` only. No VIN in the envelope (Ahmad's #1 fix on his branch may add VIN — when that merges in, VIN is non-sensitive identifier).
- **`<vehicle_facts>` block:** Specs only — engine, oil viscosity, tire size — no PII.
- **`<conversation_state>` block:** `mood`, `arc_summary`, `last_user_intent`, `established_facts[]`. The first three are short categorical strings; `established_facts` is free-text Haiku wrote — bounded by `sanitizeSemanticPayload` (Wave 7.1) which rejects payloads with envelope tags but doesn't filter PII strings.
- **`<recent_context>` block:** Same as established_facts — free-text from prior conversations, sanitizer-protected against tag injection but not PII content.

**Residual risk:** if the user volunteered their email/phone in a prior conversation and Haiku recorded it as a fact, that fact would surface in `<recent_context>` on future turns. The semantic-fact recording prompt section (`stable.ts:150-170`) doesn't currently include a PII-redaction rule. **Recommended hardening (not yet applied):** add a "never record PII in fact text" rule to the semantic fact recording section. Low-priority since the user has to volunteer the PII first.

**Card numbers:** never reach the prompt context — payment data lives entirely in Stripe + payment-screen, never touched by Oto.

### Conversation / memory journey

### G8 — Active-conversation handle on back-navigation
**STATUS — ✅ FIXED (this session).** This was the cross-conversation state leak you reported on May 18 evening. Root cause confirmed and fixed:
- **File:** `app/(main-tabs)/ai-chat/index.tsx:763-794`
- **Bug:** `handleSelectConversation` had two load paths (Zustand legacy + Convex). The Zustand-load early-return path (line 766-779) set local UI state but did NOT call `setConvexConversationId(newId)`. So the Convex pointer stayed on the PRIOR conversation. Next send used the stale id → server loaded the WRONG conversation's `<conversation_state>`.
- **Fix:** Added `setConvexConversationId(conversationId as Id<"ai_conversations">)` to the Zustand-load early-return path, with comment block documenting the bug.
- **Covered switch patterns:** Convex→Zustand, Zustand→Convex, Zustand→Zustand all now correctly sync the pointer. New chat path was already correct (`startNewChat` explicitly sets to null). Convex→Convex path was already correct (line 794 already had the sync).

Storage layer was always clean — `ai_messages` partition correctly by `conversation_id`. The fix is purely in the retrieval/handle layer as the original report predicted.

### G9 — Fact write missing vehicle_id (the write-side of C1)
**STATUS — ✅ FIXED for brand-specific writes; partial for general vehicle-specific writes.** Confirmed at `convex/oto/memoryEditing.ts:510-547`:

The new brand-token guard handles the highest-risk case — brand-specific payloads (BMW, Mercedes, Audi, etc.) written without `vehicle_id` to user-level fact types (`mechanic_preference`/`service_preference`). The mutation throws with a clear retry message; Haiku self-corrects.

**Not covered (yet) — the broader case where a `vehicle_quirk` is written without a brand token but is still vehicle-specific:** e.g., "User's car pulls left when cold" without `vehicle_id`. The prompt rule at `stable.ts:159` says "Pass `vehicle_id` for these" for `vehicle_quirk` — but it's prompt discipline, not server-enforced. **Recommended hardening (not yet applied):** make `vehicle_id` REQUIRED in the mutation when `fact_type === "vehicle_quirk"` (a one-line check). Low-effort follow-up.

### G10 — Conflicting/stale fact handling is narrated, not silent
**STATUS — ✅ FIXED (this session).** Added the strict Silent-discard rule at `convex/oto/prompt/stable.ts:1202` (~40 lines, top-level rule in the Vehicle scoping section). Covers:
- **9 banned narration patterns** with the EXACT screenshot wording marked WRONG: *"Your `<recent_context>` block has a recorded preference..."*, *"That was recorded for a BMW you own"*, *"future recordings will be cleaner"*, *"I caught the mechanic_preference being mapped across vehicles..."*, *"For this turn, I'm treating it as not applicable..."*, etc.
- **Worked failure example** reproducing the May 18 Mercedes screenshot verbatim, then the **RIGHT version** which makes NO reference to the BMW fact.
- **Extension to all context contradictions:** conflicting facts in `<recent_context>`, contradicting `established_facts`, contradicting tool results, dropped prior renders.
- **Why this rule exists:** explicit framing that narrating the machinery is the most trust-corrosive thing Oto can do, even when the underlying judgment is correct.

### G11 — Concurrent sessions / two devices
**STATUS — ⚠️ THEORETICAL GAP, PROBABLY DOES NOT FIRE IN PRACTICE. Not a priority.**

The literal mechanism is real — `convex/ai_conversations.ts:111-140` (`updateState` mutation) just does `ctx.db.patch(args.id, patch)` with no version check or merge. If two writers wrote to the same conversation_id concurrently, last write would silently overwrite the first.

But on closer inspection, the conditions for this to actually fire are narrow:

**Why the common case is safe:**
- Each `ai_conversations` row has a unique `_id`. Two separate conversations can't race — different rows, different writes.
- Each device has its own React-local `convexConversationId` (`app/(main-tabs)/ai-chat/index.tsx:166`). By default, a new device → new conversation → no shared row.
- **Single-device sequential sends are blocked** by `sendToOtoAI`'s `if (isProcessing) return;` guard (`index.tsx:376`). Turn N+1 can't fire until turn N completes. No same-device race on user-driven sends.

**The two narrow windows where it COULD fire:**

1. **Same conversation explicitly resumed on two devices.** User opens conv X on phone, walks to tablet, sidebar lists conv X (`useQuery getByUserId` is real-time), user taps to resume on tablet — now both devices have `convexConversationId = X`. User types from tablet while phone is also live. The Haiku turns process concurrently against the same row. Possible but requires deliberate dual-device use; uncommon usage pattern.

2. **`appendEstablishedFact` (mobile-side, ~50ms) vs `update_conversation_state` (Haiku-side, ~2s).** When user taps a render card (e.g., picks a mechanic), `pushFact` (`index.tsx:175-183`) fires `appendEstablishedFact` to write the selection to `established_facts[]`. If the in-flight Haiku turn's `update_conversation_state` then writes after, it whole-replaces the array and the appended fact disappears. The author of `pushFact` already acknowledged this race in the comment (*"Fire-and-forget — mutation is fast (~50ms) and the next Anthropic turn takes much longer to set up, so the race is benign"*) — the race is intentionally accepted because the timing makes it almost never win.

**Recommendation: don't fix this until it's observed in real data.** The defensive options are still available if needed later:
1. Server-side merge for `established_facts` (union + dedup + cap at 12) — cheapest hedge, removes the appendEstablishedFact race entirely.
2. Optimistic concurrency via `state_version` field — heavier, only worth it if multi-device usage emerges.

Worth instrumenting before fixing: add a counter that increments when `updateState` patches a row where `state_updated_at` is fresher than what the calling turn loaded. If that counter stays at zero in production, this never fires and the fix is wasted effort.

---

## Summary table

| ID | Item | Status | Files / records changed |
|---|---|---|---|
| C1 | Unscoped brand-specific facts | ✅ FIXED (3 layers) | `memoryEditing.ts:510-547`, `stable.ts:1202`, retracted `kn7p20yjktezf5xt9c4hd12gad86xx37` |
| C2 | Fabricated service-due claims | ✅ FIXED (5 layers — F1 fix) | `vehicleHealth.ts`, `maintenanceStatus.ts`, `maintenanceEnrichment.ts`, `stable.ts:934` |
| C3 | Schema drift across deployments | ⚠️ OUT OF SCOPE (deploy mgmt) | Code adds `vehicle_id` to schema; propagation is deploy team's call |
| C4 | Memory tables missing on prod | ⚠️ OUT OF SCOPE (deploy mgmt) | Code is defensive-by-design (try/catch) — won't crash if tables missing, but features dark |
| C5 | message_count = 0 with state | ✅ EXPLAINED (intentional eval fixtures) | Eval harness pre-seeds — not a bug |
| G1 | Double-submit charge | ❌ OUT OF SCOPE (Stripe, not Oto) | — |
| G2 | Auth/capture drift | ❌ OUT OF SCOPE (Stripe, not Oto) | — |
| G3 | Refund + platform fee | ❌ OUT OF SCOPE (Stripe + business, not Oto) | — |
| G4 | Walk-in vs returning fee tier | ❌ OUT OF SCOPE (pricing, not Oto) | — |
| G5 | Prompt-driven user_id query | ✅ HANDLED (verified) | Auth-derived `user_id`, model has no influence; verified in `chat.ts:497-515`, every tool handler |
| G6 | Shared/duplicate VIN scoping | ✅ HANDLED (verified) | `vehicle_owners.by_vin_user` composite index ensures user-scope before VIN |
| G7 | PII echo in context | ✅ MOSTLY HANDLED | Envelope clean (name only); residual risk if user volunteered PII into a recorded fact — recommend semantic-fact PII rule |
| G8 | Active-conversation handle on back-nav | ✅ FIXED (this session) | `app/(main-tabs)/ai-chat/index.tsx:768-775` — sync `setConvexConversationId` on Zustand-load path |
| G9 | Fact write missing vehicle_id (write side of C1) | ✅ FIXED for brand-specific; partial for generic vehicle_quirk | `memoryEditing.ts:510-547` brand-token guard; future hardening: require `vehicle_id` for `vehicle_quirk` |
| G10 | Stale fact narrated to user | ✅ FIXED (this session) | `stable.ts:1202` Silent-discard rule |
| G11 | Concurrent sessions / two devices | ⚠️ THEORETICAL — narrow conditions, probably doesn't fire in practice | `updateState` has no version check, but `isProcessing` guard prevents same-device races and dual-device same-conv resume is uncommon; instrument before fixing |

---

## What's left for you

**Already addressed this session — no further action on these:** C1, C2, C5, G5, G6, G7 (mostly), G8, G9 (brand-specific case), G10.

**Still open on Oto backend side (from this report):**
- **G7 residual** — PII-redaction rule in semantic fact recording. Envelope itself is clean; the only risk is if a user volunteered PII (email, phone, address) into a turn and Haiku recorded it as a fact. Recommend adding "never record PII in fact text" rule to `stable.ts:150-170`. Low effort.
- **G9 residual** — make `vehicle_id` REQUIRED in the mutation when `fact_type === "vehicle_quirk"`. Today it's a prompt rule (`stable.ts:159` says "Pass `vehicle_id` for these") but not server-enforced. One-line check in `recordUserSemanticFact`.
- **G11** — Theoretical, defer. See entry above — narrow conditions, `isProcessing` guard prevents the common case. Instrument with a counter before deciding to fix.

**Out of scope for Oto backend (route to other owners):**
- **C3** schema drift across deployments — deploy/ops management.
- **C4** memory tables missing on prod — deploy/ops management.
- **G1 / G2 / G3** Stripe integration — payments team.
- **G4** Walk-in vs returning fee tier — pricing/business logic.

**Action items requiring deploy:** push the uncommitted fixes (Batches A/B/C/D + `handleSelectConversation` fix + brand-token guard + silent-discard rule + Pivot respect section + `TOOL_NAMES_V1` fix). F1 was already committed by you. Verify deployment includes the `vehicle_id` field on `ai_conversations` (per C3) and the Wave-3 memory tables (per C4) — otherwise `setVehicleId`, `recordUserSemanticFact`, and cross-conv memory features are dark on prod.
