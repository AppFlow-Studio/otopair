# Oto AI Agent — Engineering Plan (Apr 2026)

Replacing rule-based patterns with a Claude-powered conversational agent built on Convex — server-side, secure, and deeply aware of your vehicles.

**4 Phases · 3 Weeks · 3 Files to launch Phase 1**

---

## From Rules to Intelligence

| | Current State | Target State |
|---|---|---|
| Intelligence | Rule-based pattern matching | claude-sonnet-4-6 with tool use |
| State | Client-side only, no persistence | Server-side, persisted in `ai_conversations` |
| Data access | Mock data + Convex queries in components | Claude calls Convex tools (auth enforced) |
| Scenarios | 7 hardcoded (oil change, brake noise…) | Open-ended natural language understanding |
| Actions | Frontend triggers `useBookingStore` | Claude invokes `create_booking` → mutation |
| Permissions | None — fully client-side | Write for appointments only, no delete |

---

## How Oto AI Works

```
User message → Convex Action → Claude → tool loop → persisted response
```

1. **User Message** — AI chat tab sends `useMutation("otoAI:chat")`
2. **Convex Action** — Load user context, build messages array
3. **Claude API Call** — `claude-sonnet-4-6` with 7 defined tools
4. **Tool Loop** — Claude calls tools until answer is ready
5. **Response Persisted** — `ai_messages` saved, structured JSON returned

> **Key constraint:** Claude NEVER touches the DB directly — every read and write goes through a Convex tool handler that enforces auth + permission rules.

---

## 7 Tools Claude Can Call

Defined in `convex/otoAITools.ts` — READ-only + controlled WRITE, no delete tools, ever.

| Type | Tool | Description |
|---|---|---|
| READ | `get_user_vehicles` | Returns user's vehicles with health score |
| READ | `search_mechanics` | Find mechanics by service, location, distance |
| READ | `search_shops` | Find shops with labor rate + rating |
| READ | `get_available_slots` | Open time slots for a shop/mechanic |
| READ | `get_user_bookings` | Last 10 bookings for the authenticated user |
| READ | `get_service_catalog` | All available services with cost estimates |
| WRITE | `create_booking` | Create appointment (auth + ownership validated) |

---

## Security & Guardrails

- **Auth on every tool call** — `ctx.auth.getUserIdentity()` in every Convex tool handler, reject if unauthenticated
- **Ownership validation** — `create_booking` checks `vehicle_owners.user_id === authenticatedUser` before inserting
- **No delete tools — ever** — Claude literally cannot call what doesn't exist
- **Rate limiting** — Max 50 AI chat messages per user per day (enforced in `otoAI.ts`)
- **Prompt injection detection** — Detect `ignore previous instructions`, `system:` patterns → log and short-circuit with safe reply
- **Topic guardrail** — Claude only discusses auto repair, vehicle health, OtoPair services. Off-topic → redirect
- **API key never in frontend** — `ANTHROPIC_API_KEY` in Convex env variables only, never exposed to client
- **Input cap + sanitization** — Max 2000 chars per user message, strip HTML and dangerous patterns before sending to Claude

---

## Delivery Roadmap

### Phase 1 — Backend Core (Week 1)
**Files to create:** `convex/otoAIPrompts.ts` · `convex/otoAITools.ts` · `convex/otoAI.ts`

- `convex/otoAIPrompts.ts` — System prompt builder: domain rules, vehicle context, tool descriptions, guardrails, few-shot booking examples
- `convex/otoAITools.ts` — 6 READ-only tool definitions + Convex query handlers
- `convex/otoAI.ts` — Main action: load user context → call Claude → tool loop → persist to `ai_messages` → return response

**Success criteria:** Claude answers "What cars do I have?" with real Convex data

---

### Phase 2 — Booking Creation (Week 1–2)
**Files to modify:** `convex/otoAITools.ts` extended

- Add `create_booking` tool with auth + ownership validation
- Add `update_booking` (reschedule only, no delete)

**Success criteria:** Full booking flow end-to-end in Convex

---

### Phase 3 — Frontend Integration (Week 2)
**Files to modify:** `app/(main-tabs)/ai-chat/index.tsx`

- Replace all `processUserMessage()` calls → `useMutation("otoAI:chat")`
- Handle all action types returned: `show_mechanics`, `show_vehicles`, `show_slots`, `booking_created`, `ask_question`, `text_only`
- Remove `services/ai/scenarioEngine.ts` import

**Success criteria:** User completes booking from AI tab, no scenario engine code running

---

### Phase 4 — Deprecation Cleanup + Safety (Week 3)

**Cleanup:**
- DELETE stub files: `vehicle_specs.ts` · `service_insights.ts` · `manual_review_queue.ts` · `ai_enrichment_logs.ts`
- REMOVE dead helpers: `enrichVehicleSpecs` + dead helper functions from `vehicle_pipeline.ts`
- MIGRATE: Run `migrateToChassisSpecs` — move all `@deprecated` fields to `chassis_specs` table (one-time migration action, preserve history)
- AUDIT: Find + remove all references to deprecated tables in `vehicle_mutations.ts` before schema field removal
- REMOVE: `@deprecated` schema fields from `convex/schema.ts` after migration confirmed

*Outcome: Fewer files means Claude's context window focuses on live, relevant code — faster onboarding for new devs too.*

**Safety:**
- Prompt injection detection (full implementation)
- Topic guardrail + competitor block

**Success criteria:** Production-ready security + quality gates

---

## Why This Matters

| | Impact |
|---|---|
| Better User Experience | ∞ scenarios vs. 7 hardcoded · open-ended NL replaces brittle pattern matching · proactive follow-up questions · vehicle-specific recommendations · booking flow completes in one conversation thread |
| Smarter Enrichment | ≥80% fill agent target per config · Claude refines its own answers before committing · sibling bootstrap cuts FireCrawl calls per run · `write_fields` centralizes data quality · token savings from fixed denominator + dedup fields |
| Engineering Velocity | 3 files to ship Phase 1 · no schema changes needed (ai_conversations already exists) · Anthropic SDK already installed · deprecation cleanup removes ~4 stale stub files · one integration test (Kia Seltos) validates the whole chain |
