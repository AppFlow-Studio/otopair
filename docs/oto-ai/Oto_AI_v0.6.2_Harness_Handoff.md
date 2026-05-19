> **HISTORICAL DOCUMENT — v0.6.2.** Current runtime is v0.9. Read `Oto_AI_v0.9_Handoff.md` first. This document is kept for journey context (when the harness was first built + the Directive 7 vehicle_id lookup was fixed).

# Oto AI v0.6.2 — Harness Session Handoff

| | |
|---|---|
| **For** | The next Claude session continuing Oto AI work |
| **From** | Claude (Cowork mode, 2026-05-14, late afternoon) |
| **State** | Block 2 backend complete; prompt at v0.6.2; harness live and instrumented; mid-variation-suite iteration |
| **Founder** | Waleed Mansour (mrdogsog@gmail.com / AppFlow Studios) |
| **Canonical docs** | `docs/oto-ai/` in the workspace. Read those before anything else. |

---

## Read this first

The **canonical reference** for Oto AI lives in `docs/oto-ai/` in this workspace. The files in that folder are the source of truth for product framing, the four locked decisions (A/B/C/D), the twelve locked principles, the cached system prompt, and the engine inventory. Specifically:

- `docs/oto-ai/Oto_AI_Cached_System_Prompt_v0.md` — prompt source-of-truth (byte-identical to `convex/oto/system_prompt.ts`)
- `docs/oto-ai/oto-engine-inventory.md` — five-part inventory with the four locked decisions
- `docs/oto-ai/handoff-addendum.md` — locked Section 4.5
- `docs/oto-ai/tool-inventory.md` — rationale, rejected tools, gaps, open questions
- `docs/oto-ai/slug-drift-remediation.md` — kebab-case dead-taxonomy audit

This document layers session-level operational state on top of those. If anything in this doc conflicts with what's in `docs/oto-ai/`, the canonical doc wins — patch this one.

**Waleed's operating preferences** (locked across multiple sessions, observe strictly):

1. **One task per prompt.** Never bundle multiple fixes. One fix, verify, next fix.
2. **Direct answers, no padding.** No "great question!", no restating his prompt, no preamble.
3. **Push back when you disagree, but don't reflexively defer to Phase 2.**
4. **Don't over-engineer.** When a bug feels big, the fix is probably one line.
5. **Investigation before implementation.** Read code → report → propose → apply → verify.
6. **Use what's there.** Convex has its own patterns (SDK client, queries, auth). Don't reinvent.

---

## Diagnostic subsystem options — canonical per founder

The diagnostic form's subsystem picker offers five options. Founder-stated canonical list (2026-05-14):

| Option | Notes |
|---|---|
| **brake** | Singular. Brake-system specialty. |
| **tires** | Tire-system specialty. Does NOT include "& wheels." |
| **engine** | Engine specialty. Includes overheating, check-engine, rough idle, oil smell. |
| **Battery & electrical** | Battery, charging, dimming lights, slow crank. Note: lowercase "electrical." |
| **not sure** | The default when the user can't self-classify. Mechanic-side checklist for `not_sure` is designed for this case — ride-along symptom replication, exterior walk-around, OBD-II scan, test drive. |

**Codebase drift to close.** As of this session, `lib/diagnostic-checklist-templates.ts` and `components/ai-chat/AIDiagnosticForm.tsx` still carry the older labels: `"Brakes"`, `"Tires & Wheels"`, `"Battery & Electrical"`, `"Not Sure"`. Enum values are `brakes | tires_wheels | engine | battery_electrical | not_sure`. The next session should reconcile:
- Labels in `AIDiagnosticForm.tsx` (currently `'Brakes'`, `'Tires & Wheels'`, `'Battery & Electrical'`, `'Not Sure'`)
- Enum values in `lib/diagnostic-checklist-templates.ts` (currently `brakes | tires_wheels | battery_electrical | not_sure`)
- `DiagnosticSystem` type used by `bookings` schema and the `render_diagnostic_form` tool's `diagnostic_system` arg
- Decision B mapping table in `system_prompt.ts` (currently references the old enum)
- Decision B mapping table in `Oto_AI_Cached_System_Prompt_v0.md` (mirror of the above)
- Decision B section in `docs/oto-ai/oto-engine-inventory.md`

The label change ("brake" singular, "tires" without "wheels") is narrower than the old labels — confirm with founder whether the enum values should also rename (`brake`, `tires`), or stay as-is with only the user-facing labels changing. Either way, all five locations above need to move together to avoid configuration drift (Section 23 of the engine-inventory doc).

---

## What this session shipped

### 1. The harness — `scripts/oto-harness.html`

Single-file dev tool for driving Oto and inspecting every internal step. Replaces "guess at it from Convex dashboard logs" with structured per-iteration traces.

**To run:** `cd otopair && npx serve scripts` → open `http://localhost:3000/oto-harness.html`.

**Do NOT open via `file://`** — Clerk rejects `file://` as a redirect scheme and ESM imports get flaky. The harness now disables Sign in when it detects `file://` origin and shows a banner.

**Auth flow** (canonical Convex+Clerk pattern, mirrors `app/_layout.tsx`):

```js
import { Clerk } from "https://esm.sh/@clerk/clerk-js@5";
import { ConvexHttpClient } from "https://esm.sh/convex@^1.31/browser";

const clerk = new Clerk(EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY); // hardcoded from .env.local
await clerk.load();

const convex = new ConvexHttpClient(EXPO_PUBLIC_CONVEX_URL);
// CRITICAL: ConvexHttpClient.setAuth takes a STRING, NOT a fetcher.
// (ConvexReactClient takes a fetcher; HttpClient does not.)
// Before each call: pull a fresh token from Clerk, then setAuth(token).
async function stampAuth() {
  const token = await clerk.session.getToken({ template: "convex", skipCache: forceRefresh });
  convex.setAuth(token);  // string, not function
}
```

**The "Invalid value" trap.** I lost ~30 min to a `TypeError: Failed to execute 'fetch' on 'Window': Invalid value` from inside the Convex SDK. Root cause: I passed an async function to `setAuth` (the ReactClient pattern). HttpClient stringified the function source and put it in the Authorization header — `Bearer async ({ forceRefreshToken } = {}) =>...`. Headers rejected that as having `\n` characters. **Lesson for next session: `ConvexHttpClient.setAuth(string)`, period.**

**Dropdowns wired to existing queries:**
- Vehicles → `vehicles:getMyVehicles` (loads on Clerk sign-in)
- Conversations → `ai_conversations:getByUserId` (top 50 by creation desc)
- New convo → `ai_conversations:create` (auto-selects + refreshes list)

**Vehicle identification follows Waleed's "we don't do VIN, we do vehicle ID" directive.** Settings store the Convex `vehicles._id`. At send time the harness translates id → vin from the cached vehicles list and passes as `vehicleVin` (still the chat action's wire-level arg name). If you change the chat.ts arg to `vehicleId` directly, the harness translation step becomes redundant.

**The trace panel** shows, per turn:
- Envelope sent to Haiku
- System prompt (version + char count + body)
- Tools advertised (count + names)
- Per-iteration: branch (`data_continue` | `terminal` | `text_only`), latency, request messages, raw response content blocks, tool inputs, tool results
- Forced-final block if `hit_cap`
- Final outputs (text, quick_replies, show_diagnostic_form)
- Token totals

**`window.__oto` debug surface** — exposes `clerk`, `convex`, `vehiclesList`, `turns`, `settings`, `stampAuth`, `callConvex`, plus two helpers:

```js
// One-shot variation (fresh convo, debug_skip_persist=true, returns compact summary)
await window.__oto.runVariation("How is my car doing?");

// Suite runner (serial — ~3s per variation × N)
await window.__oto.runSuite([
  "How is my car doing?",
  "What's my health score?",
  "Anything I should worry about?",
]);
```

Returns `{ message, latency_ms, iters[{branch, data, terminal, stop}], tokens_in, tokens_out, hit_cap, text, quick_replies, show_diagnostic_form }`. Use this for variation surveys without filling chat history.

### 2. Backend — `convex/oto/chat.ts`

**Added `debug` + `debug_skip_persist` args, optional `trace` return.** Production callers (mobile app) pass neither and get the same shape back. Harness passes `debug: true` and captures structured per-iteration state. `debug_skip_persist` skips writes to `ai_messages` / `ai_conversations.message_count` so harness runs don't pollute history.

**`TOOL_NAMES_V1` now has 8 tools** (was 6):

```ts
[
  "list_services_for_vehicle",
  "get_service_details",
  "get_vehicle_health",
  "get_projected_health_score",
  "get_bookings",        // NEW — Block 2
  "get_due_services",    // NEW — Block 2
  "render_quick_replies",
  "render_diagnostic_form",
]
```

Module-load invariant updated to match. The advertised-vs-wired drift pattern this session closes is the configuration-drift footgun documented in `docs/oto-ai/oto-engine-inventory.md`.

### 3. Block 2 backend — `get_bookings` + `get_due_services`

Two new files:

- **`convex/oto/bookings.ts`** → `getBookings({ status_filter, limit? })`. Auth-scoped. Status filter: `active` (pending|confirmed|in_progress), `completed`, `all`. Newest first by `_creationTime`. Default limit 5, max 20. Returns flat shape with service slugs, service names, shop name, mechanic name, VIN tail, scheduled_at.

- **`convex/oto/dueServices.ts`** → `getDueServices({ vehicle_id })`. Same id-resolution pattern as `vehicleHealth.ts` (Directive 7) — `vehicle_id` is the Convex `vehicles._id`, NOT a VIN. Reads `vehicle_service_states`, filters to `overdue | due_soon`, joins `services` for slug + display name, sorts by urgency rank then `due_at_date` then `urgency_score`.

Both wired as callables in `chat.ts:buildCallables`. Both pass through the existing dispatcher (no dispatcher changes needed).

### 4. Directive 7 verified

`convex/oto/vehicleHealth.ts:loadVehicleContext` now correctly accepts the Convex `vehicles._id` from the envelope:

```ts
const vehicle = await ctx.db.get(vehicleId as Id<"vehicles">);
const owner = await ctx.db
  .query("vehicle_owners")
  .withIndex("by_vin_user", q => q.eq("vin", vehicle.vin).eq("user_id", user._id))
  .unique();
```

The handoff doc's literal recipe (`ctx.db.get(vehicle_id as Id<"vehicle_owners">)`) would have failed at runtime because the envelope passes `vehicles._id`, not `vehicle_owners._id`. The actual fix is one db.get + one indexed lookup — exactly the shape the directive intended, with the table cast corrected.

Verified end-to-end via harness: envelope shows `id: pn7cqddamnfpkfr6qqn1wnrx1h8329d1` (the BMW M550i's `vehicles._id`), iter 1 calls `get_vehicle_health` with that id, tool returns real data with `score: 80`, four items on_time, plus `known_issues` populated.

### 5. `known_issues` labels — `vehicleHealth.ts`

Caught via the harness on the first real trace: `get_vehicle_health` was returning `known_issues: ["other", "temperature"]` — the raw sentinel-prefixed array from `vehicle_owners.knownIssues`. Haiku dutifully parroted both strings back to the user as "temperature and something else under 'other'."

Fixed by adding `describeKnownIssues()` to `vehicleHealth.ts`. It mirrors `WARNING_LIGHT_TYPE_OPTIONS` from `app/quarterly-checkin.tsx` (the UI source-of-truth) and handles the sentinel:

| Sentinel | Returns |
|---|---|
| `no_all_clear` | `undefined` |
| `not_sure` | `["Driver isn't sure which warning light was on"]` |
| `check_engine` | `["Check engine light"]` |
| `other` / `different_light` | Translated lights, e.g. `["Temperature / overheating warning light"]` |

Response quality measurably better after the fix. Worth promoting `WARNING_LIGHT_TYPE_OPTIONS` to a shared constant in `convex/lib/` so the UI and the AI tool can't drift.

### 6. System prompt — v0.6.2

Bumped from v0.6 → v0.6.2 (skipped v0.6.1 mid-session). Three changes:

- **Tool entries added** for `get_bookings` and `get_due_services` (placed after `get_projected_health_score`, before `render_diagnostic_form`).
- **Markdown bold rule tightened** — bold reserved for safety-critical directives only. Banned for scores, statuses, service names, dates, mileages, dollar amounts. The bar is "if the user ignores this, they could get hurt."
- **Naming-findings-vs-speculating-on-causes rule added** in the Scope section. Banned phrasings list ("could be X or Y", "typically signals", "to rule out X", "thermostat or something else in the cooling circuit"). Allowed: name the finding operationally, note urgency tier, bridge to Diagnostic Scan, answer operational follow-ups. User-reported symptoms during narrowing get a single hedged hypothesis (≤2 candidates) because narrowing IS the diagnosis (Decision A) — but enumerating 3+ named parts is banned even there.

**The source-of-truth doc (`Oto_AI_Cached_System_Prompt_v0.md`) is NOT yet synced to v0.6.2.** Next session must mirror the changes there and add a changelog row. The byte-identity rule applies.

---

## Open issues from the variation suite

Group 1 was run (4 health-check phrasings); group 2+ pending. From the first group:

**Routing consistent across phrasings ✓.** All 4 of "How is my car doing?", "What's my health score?", "Is my car okay?", "Anything I should worry about?" routed identically: iter 1 `get_vehicle_health` → iter 2 text reply. Decision A holds.

**Quality issues that v0.6.2 was designed to fix (re-run pending):**
- Bold on `**80**` score (banned in v0.6.2)
- Cause speculation: "low coolant or a cooling-system issue", "to rule out a thermostat issue", "thermostat or something else in the cooling circuit" (banned in v0.6.2)
- Repair-procedure-adjacent instruction ("check your coolant level at the radiator first") — borderline operational vs mechanical. Tire pressure example (Example 1) gives a similar instruction, so this might be acceptable. Watch for it in re-runs.

**Open directive from founder mid-session:**

> "We're strictly only doing get_health but we're not inferring any vehicle service history to notify the user 'Hey, your next service is due soon' or maybe they want to check if they have a clean service history or know what they have done in the past couple months."

Haiku is calling `get_vehicle_health` for the current status, but not reaching for `get_due_services` (what's coming up) or `get_bookings` (recent history) — even though both are now wired and described in the prompt. The prompt mentions them in the Capability Honesty and Tools sections but lacks:

- Clear routing signals (which user phrasings hit which tool)
- Examples of chaining (`get_vehicle_health` + `get_due_services` for a fuller status answer)
- Permission to emit multiple tool_use blocks in one iteration (the chat.ts loop dispatches them in parallel via `Promise.all`)

**This is the next session's priority work.** Specific intents to wire up:

| User intent | Tools that should fire | Currently fires |
|---|---|---|
| "How is my car doing?" | `get_vehicle_health` + `get_due_services` | Only `get_vehicle_health` |
| "Anything coming up?" | `get_due_services` | (untested — likely `get_vehicle_health`) |
| "What have I done recently?" | `get_bookings(completed, 5)` | (untested) |
| "Do I have any bookings?" | `get_bookings(active)` | (untested) |
| "What did the shop do last time?" | `get_bookings(completed, 1)` | (untested) |

Most economical fix: add explicit routing guidance in the prompt's Vehicle Health & Service-Due section (or a new Service History section) plus 2-3 worked examples.

---

## Variation suite — remaining batches

Group 1 (health-check) ran. Five remaining groups, all via `window.__oto.runSuite([...])`:

**Group 2 — Symptom narrowing (Decision A):**
```
"My brakes are squealing"
"I hear a noise from the front when I stop"
"What's that grinding sound when I brake"
"My car shakes when I'm on the highway"
```

**Group 3 — Due / history:**
```
"What do I need to service?"
"Anything coming up?"
"What was my last service?"
"Do I have any bookings coming up?"
```

**Group 4 — Boundary cases:**
```
"Just book me a brake service"            // override → Decision A pushback
"How do I change my oil?"                  // mechanical refusal
"Should I file a lemon law claim?"         // legal-evaluation refusal
"How do I tie my shoes?"                   // out-of-scope refusal
```

**Group 5 — Capability edge cases:**
```
"Find me the closest shop"                 // capability honesty
"Book an appointment for tomorrow at 10am" // capability honesty
"How much will brake pads cost?"           // pricing capability gap
```

Capture each trace, look for:
- Wrong tool routing
- Hallucinated tools
- Capability promises ("Want me to find a shop?")
- Cause speculation
- Bold on data points
- Service-name discipline violations ("Brake Inspection" etc.)

---

## File map — what changed this session

```
scripts/oto-harness.html                          [NEW]   single-file dev harness
convex/oto/chat.ts                                [MOD]   debug/trace args, 2 new callables, invariant updated
convex/oto/vehicleHealth.ts                       [MOD]   describeKnownIssues() translation
convex/oto/bookings.ts                            [NEW]   getBookings query
convex/oto/dueServices.ts                         [NEW]   getDueServices query
convex/oto/system_prompt.ts                       [MOD]   v0.6.2 — bold rule, naming-vs-speculation, tool entries
docs/oto-ai/Oto_AI_v0.6.2_Harness_Handoff.md      [NEW]   this document
```

**Not modified but flagged for next session:**

```
docs/oto-ai/Oto_AI_Cached_System_Prompt_v0.md     needs v0.6.2 sync (byte-identity rule)
convex/lib/                                        consider extracting WARNING_LIGHT_TYPE_OPTIONS as shared constant
```

---

## What the next session should do, in order

1. **Verify v0.6.2 deployed** (Convex dev should auto-sync). In the harness, send "How is my car doing?", check trace's `system_prompt_version`. Confirm bold and cause speculation are gone.

2. **Sync `Oto_AI_Cached_System_Prompt_v0.md` to v0.6.2.** Byte-identical to the template literal in `system_prompt.ts`. Add changelog row.

3. **Add tool-chaining guidance to the prompt.** Address Waleed's directive. New examples for `get_due_services` and `get_bookings` usage. Maybe a new section "When to chain tools." Bump version to v0.6.3.

4. **Re-run group 1 variations.** Confirm fixes landed. Build the eval-grounded confidence the canonical doc demands (Locked Principle #8).

5. **Run groups 2–5.** Capture traces. Identify next iteration targets.

6. **Then continue the remaining Day 2 build blocks** (sequence per `docs/oto-ai/oto-engine-inventory.md`):
   - Block 3: wire `render_service_picker` as a real Haiku-callable tool
   - Block 4: tighten invariant to check prompt body → `TOOL_NAMES_V1` consistency
   - Block 5: `oto_telemetry` table (Locked Principle #12)
   - Block 6: `cache_control` prompt caching markers
   - Block 7: eval harness scaffold + 8 golden examples (Locked Principle #8)
   - Block 8: full smoke pass

7. **Then Phase 2** — Sonnet cascade, polite-exit counter, streaming, RAG scaffold. Scope and ordering are in the canonical docs in `docs/oto-ai/`.

Do not jump to Phase 2 work before the eval harness exists. Waleed has been explicit: "we never debate a prompt change based on vibes — only against the eval."

---

## Footguns that bit me this session

1. **`ConvexHttpClient.setAuth(fetcher)`** — that's the React client API. HttpClient takes a string. The SDK silently stringifies the function and puts the source code in the Authorization header. Always pull the token from Clerk first, then `setAuth(token)`.

2. **Hand-rolling the Clerk SDK script tag** — wasted ~20 min building script-injection + publishable-key-derivation infrastructure. The right pattern is `new Clerk(pubKey)` + `await clerk.load()`. The publishable key is in `.env.local` as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Just import the SDK from esm.sh and use it directly.

3. **`file://` for the harness** — Clerk rejects `file://` as a redirect URL scheme, ESM imports get flaky, OAuth callbacks have nowhere to go, modal sign-in redirects to `C:/`. Always serve via `npx serve scripts`.

4. **`afterSignInUrl: window.location.href`** — passing a `file://` URL gets rejected with "prohibited URL scheme". The modal flow doesn't need redirect URLs — the `addListener` handler picks up session changes. Don't pass redirect overrides unless you actually need them.

5. **Convex SDK version** — pin to a major range matching the deployment. Project uses `convex ^1.31.6`; harness imports `convex@^1.31/browser`.

6. **Chrome DevTools blocks JWT-like strings.** When inspecting via `javascript_tool`, anything that looks like a token comes back as `[BLOCKED: JWT token]`. Inspect via character-code introspection or length checks instead of direct logging.

7. **Vision-doc examples 8/10/11 enumerate causes** — they teach Haiku exactly the behavior the v0.6.2 cause-speculation rule forbids. The new rule has a carve-out for symptom narrowing (one hedged hypothesis, ≤2 candidates), so the examples are defensible. But if the rule needs to be stricter, the examples need updating too.

---

## Sources — canonical first

In reading order for someone picking this up cold:

- `docs/oto-ai/Oto_AI_Cached_System_Prompt_v0.md` — the cached system prompt, byte-identical to runtime
- `docs/oto-ai/oto-engine-inventory.md` — the five-part inventory with the four locked decisions (A/B/C/D), the twelve locked principles, and the Day 2 build plan
- `docs/oto-ai/handoff-addendum.md` — locked Section 4.5
- `docs/oto-ai/tool-inventory.md` — tool rationale, rejected tools, schema gaps, open questions
- `docs/oto-ai/slug-drift-remediation.md` — kebab-case dead-taxonomy audit (do not invent slugs)
- `convex/oto/system_prompt.ts` — v0.6.2 prompt body (runtime source)
- `scripts/oto-harness.html` — the harness itself (read top-to-bottom in ~10 min)
- `docs/OTO_AI_BUILD_ORDER.md`, `docs/OTO_AI_BACKEND_HANDOFF.md` — earlier-phase context, lower priority

---

*End of handoff. The harness works. The fixes are landing. Keep iterating against the trace, not against vibes. Read `docs/oto-ai/` first — that folder is canonical.*
