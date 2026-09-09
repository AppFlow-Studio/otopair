# Trust Protocol — In-Flight Handoff

| | |
|---|---|
| **Owner** | Waleed Mansour |
| **Branch** | `Waleed-Dev` |
| **Date** | 2026-05-14 |
| **Status** | Backend + frontend wired; **system prompt + eval case rewrite still pending** |
| **Touched in this session** | 10 files (3 new, 7 modified) |
| **Scope** | Symptom-vs-record trust gating for `get_vehicle_health` outputs |

> ⚠ This branch contains a **lot** of unrelated in-flight work (system_prompt revisions, vehicleEnrichment scraper changes, schema tweaks, doc edits, etc.). This handoff documents **only** the changes from the trust-protocol session — see the file-by-file section for exact paths.

---

## TL;DR

The v0.9 eval baseline (7/8 passing) flagged `brake_narrowing_on_time_to_diagnostic` as failing. Investigation revealed the failure isn't a model regression — it's a **tool-surface gap**. The `get_vehicle_health` tool was stripping the `confidence` / `serviceSource` / booking-link fields from `maintenance_records` before returning them to Oto, so Oto could only see "brakes: on_time" with no way to tell whether that status was backed by a verified booking or just a checkbox the user clicked during onboarding three months ago.

This session built the foundation for a **symptom-vs-record trust protocol**: when a user's described symptom contradicts what the health record says, the record's *trustworthiness* gates whether Oto trusts the status or surfaces the record to the user for confirmation. The work shipped in this session covers the **read-side** (Oto can now see provenance) and the **write-side** (a render-confirm UI exists that lets the user verify or correct a record without Oto autonomously editing user data).

What's **not yet shipped**: the system-prompt update that teaches Oto when to fire the new render tool, and the eval-case rewrite that exercises the full flow. Until the prompt update lands (task #6), Haiku has the new tool in its inventory but no instructions for when to use it.

---

## Why this session happened

### Problem 1 — eval baseline regression

A baseline run of the v0.9 eval suite scored 7/8. The failing case was `brake_narrowing_on_time_to_diagnostic`, written to validate the v0.7 loophole closure (Decision A: on-time brakes + symptom should route to a diagnostic form, not a direct service booking).

User said: *"My brakes have been squealing for a few weeks"* → *"Mostly when I first hit the brakes, then it goes quiet"*

Expected: `render_diagnostic_form` fires, branch = `terminal`, `form_system = "brakes"`.

Actual: model identified the wear-indicator pattern in text, named "Brake Pad Replacement," skipped the diagnostic form. Branch came back `text_only`.

### Problem 2 — the eval case was checking for the wrong ideal behavior

Conversation revealed the actual right behavior is more nuanced than "always force diagnostic form on symptom":

> User-onboarded vehicle health is soft data. Users misremember service dates, click through onboarding quickly, or report items as fine when they aren't. *Data form hallucination* is the human equivalent of LLM hallucination.

When a symptom contradicts a maintenance record, the **record itself** might be the wrong side of the contradiction — not the symptom. Oto needs a way to:

1. Recognize the contradiction
2. Detect whether the record is verified (third-party-backed) or self-reported (soft)
3. If soft, surface the record to the user for confirm/deny
4. Update the record if user denies, then continue the protocol with the corrected data

### Problem 3 — Oto was reasoning blind

Audit of `convex/oto/vehicleHealth.ts` showed `loadVehicleContext` (line 181-188 pre-edit) was stripping `confidence`, `serviceSource`, and `confirmedHealthyAt` fields when normalizing `maintenance_records` for downstream use. The trust signal **existed in the database** (verified by inspecting the schema's `confidence: "verified" | "unverified" | "self_reported"` field) but never reached Oto's reasoning surface.

---

## Architectural decisions made this session

### 1. New AI-tool field: `record_provenance`

Added to every item returned by `get_vehicle_health`. Three values:

- **`verified`** — backed by third-party evidence (a completed OtoPair booking, an uploaded service record, mechanic-onboarded data). Treat status as truth.
- **`self_reported`** — user-provided via onboarding or check-in without backing documentation. Soft data — may be stale or wrong.
- **`inferred`** — no maintenance_record exists; status came from a fallback path (warning light mapping, vehicle-age heuristic, per-type default).

`confirmedHealthyAt` does **not** promote to verified — that's user attestation via the quarterly check-in, which is the same path being guarded against.

### 2. Symptom-vs-record trust protocol (sketched, not yet in prompt)

When a user-described symptom contradicts a maintenance item:

- If `record_provenance === "verified"` → the symptom is the surprise. Ask narrowing questions about the symptom itself.
- If `record_provenance === "self_reported"` → the record is suspect. Fire `render_record_confirmation` so the user can verify or correct.
- If `record_provenance === "inferred"` → no record exists; route to diagnostic form directly.

### 3. Locked Principle: "Suggest, don't mutate"

Working name for a new architectural rule:

> **Derived data — autonomous write OK** (e.g., `vehicle_facts` via `record_vehicle_fact` — shared KB, no single user owns it).
> **User-personal data — render-confirm required** (e.g., `maintenance_records`, `vehicle_owners`, anything keyed to a `user_id`. Oto suggests via a render tool, the frontend mutates only on explicit user confirmation).

This protects against an entire class of future bugs — anyone tempted to give Oto a `set_user_phone` or `update_vehicle_mileage` direct-write action will hit this rule. Belongs in the Locked Principles list once formally adopted.

### 4. Trust-source mapping (writer table)

The `confidence: "verified"` label is set by multiple writers:

| Writer | confidence | serviceSource |
|---|---|---|
| Onboarding flow | `self_reported` | `onboarding` |
| Quarterly check-in | `self_reported` | `checkin` (+ `confirmedHealthyAt` on Q4b "fine") |
| Completed booking | `verified` | `booking` |
| Service-record upload | `verified` | `uploaded_record` |
| Mechanic onboarding | `verified` | `mechanic_onboarded` |
| AI chat correction | `self_reported` | `ai_chat_correction` |

---

## File-by-file changes (this session only)

### NEW: `convex/oto/vehicleHealth.ts`

> Note: this file shows as **untracked** in git — it's brand-new in this branch. The diff includes both the original v0.8 file scaffolding *and* this session's trust-signal additions.

This-session contributions:

- Added `RecordProvenance` type union with full docstring explaining the trust mapping.
- Added required `record_provenance: RecordProvenance` field to `VehicleHealthItem` interface.
- Extended `LoadedContext` interface with `provenanceByType: Map<MaintenanceType, RecordProvenance>`.
- Built the `provenanceByType` map inside `loadVehicleContext` from the raw `maintenance_records` collection (parallel to the existing `recordInputs` mapping, doesn't touch the pure builders).
- Updated `toAiShape(item, provenanceByType)` to compute `record_provenance` per item using the id-prefix convention (`user-*` → look up in map; `unknown-*` / `smartcar-*` → `"inferred"`).
- Wired the map through `getVehicleHealth` handler.

Why: pure-additive change to the read path. Existing consumers (mobile UI) don't break — they just see the new field they can ignore until they want to use it.

Verified live by calling `getVehicleHealth` directly through the harness; M550i returned all four maintenance items with `record_provenance: "self_reported"` (correct, since none have completed bookings).

### NEW: `convex/oto/recordConfirmation.ts`

Single-purpose helper query used by the AIRecordConfirmation component.

Exports `getRecordForConfirmation({ vehicle_id, maintenance_type })` which:

1. Resolves the active user via Clerk auth.
2. Resolves the vehicle by `_id`, then the per-user `vehicle_owners` row via `(vin, user_id)`.
3. Fetches the single `maintenance_records` row matching `(vehicleOwnerId, maintenance_type)`.
4. Returns `{ vehicleOwnerId, record: { _id, type, lastServiceDate, lastServiceMileage, confidence, serviceSource, confirmedHealthyAt } | null }`.

Why a separate helper instead of reusing `maintenance:getRecordsByVehicle`?
- The component knows `vehicle_id` (from envelope) but not `vehicleOwnerId` — this query handles the join in one round-trip.
- Returns only ONE record (not the whole list).
- Auth + ownership check happens here once, mirroring `vehicleHealth.ts:loadVehicleContext` pattern.

Returning `record: null` is the legitimate "no record on file" case — the component should still render and let the user add one.

### NEW: `components/ai-chat/AIRecordConfirmation.tsx`

React Native component rendered when `message.showRecordConfirmation` is set on an assistant message.

Two-step state machine:
- **`prompt` step** — shows the maintenance label, the record summary line ("Our records show your brakes were serviced in March 2025 at 32,000 mi. Is that still right?"), with two buttons: `[Yes, that's right]` / `[No, update it]`.
- **`form` step** — appears after user taps "No, update it." Shows a `DatePickerMonthYear` (reused from the existing onboarding component) plus a numeric mileage input plus a Save button. Pre-fills with the existing values so the user tweaks rather than starts from scratch.

Mutations called by the component itself:
- **Confirm path** → `upsertRecord({ ..., confirmedHealthyAt: Date.now() })`. Locks status to `on_time` for 90 days per `CONFIRMED_HEALTHY_TTL_MS`. Existing `confidence` / `serviceSource` are preserved.
- **Update path** → `upsertRecord({ ..., lastServiceDate: <new>, lastServiceMileage: <new>, serviceSource: "ai_chat_correction", confidence: "self_reported" })`.

After either mutation, fires `onDecision(decision)` callback. Parent uses this to send a synthetic user message back to Oto so the next assistant turn reacts to the outcome.

Resolved state: shows "Got it — thanks for confirming" banner; component stops accepting input.

Styling matches the existing `AIDiagnosticForm` glass-light palette (raw hex constants for neutrals; `BrandColors` only has primary/secondary/white/black/background, so design tokens are inlined).

### MODIFIED: `convex/maintenance.ts`

Extended `upsertRecord` mutation to accept three new optional args: `confidence`, `serviceSource`, `confirmedHealthyAt`.

Critical detail: the patch path uses spread on a conditionally-built `trustFields` object so that **omitting** a field preserves the prior value (Convex `ctx.db.patch` semantics treat missing keys as "no change"). Callers that don't pass these fields won't clobber existing values.

Added a comprehensive docstring listing the trust-source mapping (which writer sets which labels — see "Trust-source mapping" section above).

Coordinated with **Ahmad** (owner of `convex/maintenance.ts`) — he confirmed the extension is fine.

### MODIFIED: `convex/oto/tools.ts`

Three additions:

1. Updated `get_vehicle_health` tool description to teach Haiku about the new `record_provenance` field — what each value means and when to use it for the trust protocol.

2. Added new tool schema `render_record_confirmation` next to `render_diagnostic_form`. Input schema requires `vehicle_id` (Convex `vehicles._id`) and `maintenance_type` (one of `oil` | `brakes` | `tires` | `battery` | `inspection`). Description explains the gating rules: only call for `self_reported` items, never for `verified` or `inferred`.

3. Added `render_record_confirmation: "render"` to the `TOOL_CATEGORY_MAP`.

Updated the field-parity contract comment block to include the new tool's envelope mapping.

### MODIFIED: `convex/oto/dispatcher.ts`

Added a new case `"render_record_confirmation"` in `packageRenderDirective` that emits `renderD("showRecordConfirmation", { vehicle_id, maintenance_type })`. Includes a comprehensive comment documenting the trigger-only contract and the two write paths (confirm → confirmedHealthyAt; update → new date+mileage with ai_chat_correction source).

### MODIFIED: `convex/oto/chat.ts`

Three additions:

1. Added `"render_record_confirmation"` to `TOOL_NAMES_V1` array (so Haiku gets the tool in its schema).
2. Added `showRecordConfirmation: v.optional(v.any())` to the action's `returns` validator (otherwise the action would strip the field on the way out).
3. Added `showRecordConfirmation?: { vehicle_id: string; maintenance_type: string }` to the handler's TypeScript return type.

### MODIFIED: `services/ai/types.ts`

Three additions:

1. Imported `MaintenanceType` from `@/utils/maintenanceStatus`.
2. Added `showRecordConfirmation?: { vehicle_id: string; maintenance_type: MaintenanceType }` to `ChatMessage` interface.
3. Added the same field to `ScenarioResponse` interface (parallel to `showDiagnosticForm`).

### MODIFIED: `components/ai-chat/index.ts`

Exported the new component:

```ts
export {
  AIRecordConfirmation,
  type RecordConfirmationDecision,
} from "./AIRecordConfirmation";
```

### MODIFIED: `app/(main-tabs)/ai-chat/index.tsx`

Four changes:

1. Imported `AIRecordConfirmation` and `RecordConfirmationDecision` type from `@/components/ai-chat`.
2. Destructured `showRecordConfirmation` from the `sendMessageAction` response and stored it on the assistant `aiMessage` envelope.
3. Added `handleRecordDecision` callback — translates the user's decision into a synthetic user message (`"Confirmed — brakes record is correct as-is."` OR `"Updated — last brakes service was actually in March 2025 at 32,000 mi."`) and pushes it into Oto via the existing `sendToOtoAI` flow.
4. Added a render block in the message renderer (next to the existing `showDiagnosticForm` block) that mounts `<AIRecordConfirmation />` whenever `message.showRecordConfirmation` is set.

### AUTO-GENERATED: `convex/_generated/api.d.ts`

Convex auto-regenerated this when the new `recordConfirmation.ts` query landed. No manual edits.

---

## What's NOT done yet (still pending)

| # | Task | Why blocking |
|---|---|---|
| 6 | Add symptom-vs-record trust protocol to system prompt | **Without this, Haiku won't actually USE the new render tool.** The tool exists in the schema but the prompt has no instructions on when to fire it. Smoke test confirmed Haiku currently improvises text answers when the contradiction is detected. |
| 7 | Rewrite `brake_narrowing_on_time_to_diagnostic` eval case | The current case checks for the wrong ideal behavior. Needs to expect `render_record_confirmation` on turn 2 (not `render_diagnostic_form`), with branching on the user's turn-3 confirm/deny. May require eval-runner enhancement to support branching expectations. |
| 3 | Build flywheel-compliance transcript analyzer | Independent — measures KB-hit rate, web_search → record_vehicle_fact compliance. Not blocked by trust protocol. |
| 4 | Verify baseline + analyzer findings | Blocked by #3. |
| 9 | Merge `diagnostic_form` step type into `service_options` | Architectural cleanup queued during this session. Not urgent. |

---

## How to test what's shipped

### Verify provenance surfacing (task #5)

In the harness DevTools console, with a signed-in user:

```js
const r = await window.__oto.callConvex("query", "oto/vehicleHealth:getVehicleHealth", {
  vehicle_id: "<vehicles._id>"
});
console.log(r.items.map(i => ({ type: i.type, status: i.status, prov: i.record_provenance })));
```

Each item should now have `record_provenance` of `"verified"`, `"self_reported"`, or `"inferred"`. For an account that's never completed an OtoPair booking and never uploaded a service record, all user-backed items should be `"self_reported"`.

### Verify the new tool is registered (task #8 backend)

Send any chat turn through the harness. The action should run cleanly without "unknown tool" errors. The tool will appear in the model's available tools array (visible in `r.trace.iterations[].tools_available` if you instrument it). Haiku won't fire it yet without the prompt update.

### Verify the render component (task #8 frontend)

Once task #6 lands and Haiku starts firing `render_record_confirmation`, the mobile chat will render the inline confirm/deny UI. To test before the prompt update, you can manually craft an envelope by directly calling `sendToOtoAI` with a trigger phrase or by editing a test branch of the eval-cases JSON.

### End-to-end (full protocol)

Will work once #6 + #7 land. Test plan:

1. Send "My brakes have been squealing on first stop for a few weeks."
2. Expect: Haiku calls `get_vehicle_health`, sees brakes are `on_time` + `record_provenance: "self_reported"`, fires `render_record_confirmation` for `brakes`.
3. Tap "No, update it" → enter a date 14 months ago → submit.
4. Expect: maintenance_record updates, pipeline recomputes health score, Oto's next turn acknowledges the correction and routes to brake-pad replacement service (since the record is now overdue).

---

## Coordination notes

- **Ahmad** signed off on the `upsertRecord` extension. No further coordination needed there.
- The Locked Principle "Suggest, don't mutate" needs formal adoption — should be added to `docs/oto-ai/oto-engine-inventory.md` Locked Principles list. **Not done in this session** — left as a follow-up after the prompt update lands.
- The "data form hallucination" framing is Waleed's term — recommended for inclusion in glossary / system prompt comments so future maintainers understand the design rationale.

---

## Open questions for next session

1. **Eval runner branching** — task #7 needs the runner to support per-turn branching (turn 3 expectations differ based on what the user did in turn 2). Either extend `runEval` in `scripts/oto-harness.html` or model this as two separate eval cases.

2. **Sonnet escalation policy for trust-protocol turns** — should turns where Oto detects a symptom-vs-record contradiction escalate to Sonnet automatically? Trust gating involves nuanced phrasing ("our records show X — is that still right?") and the polite-but-non-accusatory tone is exactly the kind of thing Sonnet handles better. Worth considering as an addition to the cascade rules.

3. **Cap-counter interaction** — the current cap counter is parked until launch prep. The trust protocol adds 1-2 extra turns (clarification + decision). Should the cap counter weight these differently? Probably not — same protocol, same cost — but flag for the cap-counter design.

4. **Multi-vehicle accounts** — `vehicleId` is passed explicitly through the envelope, so multi-vehicle should work. Untested. Worth a manual eval against a test account with 2+ vehicles.
