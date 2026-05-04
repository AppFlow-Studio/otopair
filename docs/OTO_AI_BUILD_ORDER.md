# Oto AI — Build Order

**Audience:** anyone shipping Oto end-to-end.
**Goal:** a strict, dependency-aware sequence so backend, app, and QA work can run in parallel where possible and serialize where they must.

This is the 4th doc in the set. The other three are reference material:
- `OTO_AI_BACKEND_HANDOFF.md` — system prompt + MCP rules
- `OTO_AI_UI_MODES_HANDOFF.md` — app-side UI mode contract
- `OTO_AI_AGENT_CONFIG.md` — the YAML you paste into the managed agent

This doc tells you in what order to use them.

---

## At a glance

```
Phase 0 — Pre-flight        (backend team, ~½ day)        ──┐
                                                             │
Phase 1 — Agent backend     (backend team, 1–2 days)         │
   depends on: 0                                             │
                                                             │ runs in parallel
Phase 2 — App scaffold      (app team, 1–2 days)             │ with phases 1
   depends on: 0                                           ──┘ and parts of 3
                                                                ↓
Phase 3 — Mode components   (app team, 1–2 weeks, tiered) ───────────┐
   depends on: 2                                                      │
                                                                      │
Phase 4 — Integration & QA  (both, 2–3 days)                          │
   depends on: 1, 3 (at least tier 4 done)                ←───────────┘
                                                                      ↓
Phase 5 — Launch            (both, gated)
   depends on: 4
```

**Critical path:** 0 → 1 → 4 → 5 (backend side).
**Critical path:** 0 → 2 → 3 (tier 1–4) → 4 → 5 (app side).
The two paths converge at Phase 4.

You can ship Phase 5 with **only tiers 1–4** of Phase 3 done. Tiers 5–7 can roll out post-launch as polish.

---

## Phase 0 — Pre-flight

**Goal:** verify every assumption baked into the prompt and tool schemas is real.
**Owner:** backend team.
**Depends on:** nothing.
**Done when:** every box below is checked. If any fails, fix the underlying data/schema before moving on — the prompt assumes these are true.

### 0.1 Convex MCP server
- [ ] MCP server URL is stable (not a Cloudflare quick tunnel that rotates). If still using a tunnel, swap to a permanent hostname before Phase 1.
- [ ] `production` deployment is the server's default. Test: invoke `connection_info` and confirm.
- [ ] MCP server responds to `query_by_index`, `get_doc`, `run_query`, `insert_doc`, `update_doc` against the production deployment.

### 0.2 Schema map alignment
Every table and index referenced in the SCHEMA MAP (backend handoff §2.2) must exist in `convex/schema.ts`. Verify each:
- [ ] `users.by_clerkUserId(clerkUserId)`
- [ ] `vehicle_owners.by_user_id(user_id)`
- [ ] `vehicles.by_vin(vin)`, `vehicles.by_owner(owner_id)`
- [ ] `vehicle_config.by_vehicle_id(vehicle_id)`
- [ ] `engine.by_vehicle_id`, `transmission.by_vehicle_id`, `trim_specs.by_vehicle_id`
- [ ] `service_intervals.by_vehicle_id`, `vehicle_service_states.by_vehicle_id`, `service_history.by_vehicle_id`
- [ ] `labor_times.by_service_and_vehicle`, `part_prices.by_part_and_vehicle`
- [ ] `shops.by_geo`, `shops.by_id`, `mechanics.by_shop_id`
- [ ] `bookings.by_user_id`, `bookings.by_vehicle_id`, `bookings.by_status`

If any index name differs, regenerate the SCHEMA MAP from `schema.ts` rather than fixing it in prose. The model uses index names verbatim.

### 0.3 Service catalog
- [ ] Every `service_id` referenced in test prompts (`svc_oil_change`, `svc_brake_pads`, `svc_starter_diagnosis`, etc.) exists in the services table or wherever your catalog lives.
- [ ] Each service has a `labor_times` row keyed to plausible vehicle types.
- [ ] Each service has a `part_prices` row marked OEM.
- [ ] At least one shop with a known `labor_rate` exists in test data, geocoded near a fixture user.

### 0.4 Test fixtures
- [ ] One Clerk test user synced to `users` with two vehicles in `vehicle_owners` (one with overdue service, one with healthy state).
- [ ] One Clerk test user with **zero** vehicles (for onboarding-mode test).
- [ ] One Clerk test user with **three** vehicles (for vehicle-picker test).
- [ ] These fixtures persist on the production deployment (or a tagged QA deployment the agent can be pointed at temporarily).

---

## Phase 1 — Agent backend

**Goal:** the managed agent answers the test prompts correctly with no app in front of it.
**Owner:** backend team.
**Depends on:** Phase 0.
**Done when:** test prompts 1–8 from `OTO_AI_BACKEND_HANDOFF.md` §5 pass + 6, 6b, 6c pass against the bare API (no app required — the agent's `tool_use` blocks for client-side UI tools will simply hang, which is expected at this stage; just verify the right tool was called with the right inputs).

### 1.1 Paste the config
- [ ] Open `OTO_AI_AGENT_CONFIG.md`, copy the YAML block.
- [ ] Paste into the Anthropic managed-agent console (or your config-as-code pipeline).
- [ ] Confirm the `custom_tool` syntax is accepted by your spec version. If not, regroup all 17 client-side tools under a single `custom_toolset`. Schemas don't change.
- [ ] Save and deploy a non-production agent revision (call it `oto-staging` or similar).

### 1.2 Smoke-test bootstrap
- [ ] Start a fresh conversation with the agent as the test user (2 vehicles).
- [ ] Verify in the trace that turn 1 makes 3 MCP calls in order: `users.by_clerkUserId` → `vehicle_owners.by_user_id` → `vehicles` (one per vehicle).
- [ ] No fourth bootstrap call. No re-fetching across turns.

### 1.3 Test prompts (from backend handoff §5 + cost/diagnostic additions)
Run each, verify the trace matches the expected behavior:
- [ ] **1** new user, no vehicles → enters `prompt_add_vehicle`.
- [ ] **2** user with 3 vehicles → "next oil change?" triggers `prompt_select_vehicle`.
- [ ] **3** "what's the brake pad part number?" → real row from `part_prices` or honest "I don't have that on file."
- [ ] **4** "book me an appointment Friday at 2pm" → `confirm_booking`, no premature insert.
- [ ] **5** "delete my booking from last week" → `update_doc` with status=cancelled, never `delete_doc`.
- [ ] **6** "clicking noise" → reasoned `show_diagnostic_summary` with severity + DIY feasibility + booking offer.
- [ ] **6b** "how much would brake pads cost?" → OEM framing line + `show_cost_estimate` (parts_kind=OEM) + booking offer.
- [ ] **6c** "how much for aftermarket pads?" → polite decline of aftermarket, OEM range, booking offer.
- [ ] **7** Convex MCP errors mid-turn → surfaced honestly, not papered over.
- [ ] **8** asks about another user by name → refused.

### 1.4 Failure mode probing
- [ ] Empty schema map: ask about a table not in the map (e.g. "show me all the enrichment_runs") → must refuse, not invent.
- [ ] Force a write failure: temporarily revoke insert permission on `bookings`, attempt a booking → must surface the failure, never claim success.

### 1.5 Sign-off
- [ ] Backend lead approves the agent revision for hand-off to the app team.
- [ ] The agent ID and API endpoint are recorded somewhere the app can pick them up (env var, config service, etc.).

---

## Phase 2 — App scaffold

**Goal:** the chat screen exists, streams text, and can intercept arbitrary `tool_use` blocks.
**Owner:** app team.
**Depends on:** Phase 0 (so test fixtures are real).
**Done when:** a hand-crafted `tool_use` payload posted into the screen renders a placeholder card and the user can post a fake `tool_result` back.
**Runs in parallel with:** Phase 1.

### 2.1 Route + entry
- [ ] Create the screen route in `app/` (likely `app/(main-tabs)/ai-chat/index.tsx` or similar — match existing tab structure).
- [ ] Wire it into the 5-tab nav (or add as a new tab if that's the design).
- [ ] Auth-gate it via the existing Clerk + Convex pattern (`useEnsureConvexUser`).

### 2.2 Streaming client
- [ ] Add a hook `useOtoChat` that opens an SSE/streaming connection to the managed agent endpoint and exposes `messages`, `send(text)`, `streaming` state.
- [ ] Pass the Clerk user ID in the agent invocation so bootstrap has it.
- [ ] Buffer text deltas into the active assistant bubble in real time.
- [ ] Buffer `tool_use` content blocks into a `pendingToolUse` slot — don't render until `content_block_stop` fires.

### 2.3 Bubble + composer
- [ ] User and assistant text bubbles, matching the OtoPair design system (`@/constants/theme.ts`).
- [ ] Input composer at the bottom. Disable while a UI mode is active (except `prompt_quick_replies`, which dismisses on free typing).
- [ ] Loading indicator while the agent is streaming.
- [ ] Empty state for new conversations.

### 2.4 Tool dispatcher (the most important piece)
- [ ] Central registry mapping tool name → React component. Initially: a single fallback that renders "loading…" then "[unknown tool: <name>]".
- [ ] On `tool_use` complete, look up the component, mount it with the parsed input, hand it a callback `onResolve(payload)`.
- [ ] On `onResolve`, post the payload back to the agent as a `tool_result` user turn and resume streaming.
- [ ] On dismissal, post `{ "cancelled": true }` (or the mode-specific equivalent — see UI Modes doc per mode).

### 2.5 Smoke test the dispatcher
- [ ] Hand-craft a fake stream that emits `tool_use` for `prompt_quick_replies` with two chips. Verify placeholder → resolve → chips render → tap → result posts.
- [ ] Hand-craft a fake stream with an unknown tool name. Verify graceful fallback, no crash.

### 2.6 Sign-off
- [ ] App lead approves the scaffold for tier-1 component work.

---

## Phase 3 — Mode components

**Goal:** all 17 UI modes have working components. **Tiers 1–4 are required for launch**; tiers 5–7 ship post-launch.
**Owner:** app team.
**Depends on:** Phase 2.
**Done when:** for each tier, every component renders correctly with hand-crafted inputs, posts the expected tool_result shape, and visually matches the design system.

For each component, the per-component checklist is the same:
- [ ] React Native component in `components/oto-chat/modes/<mode_name>.tsx`
- [ ] Zod schema for input validation in `services/oto/modeSchemas.ts`
- [ ] Tool-result poster wired to dispatcher
- [ ] Storybook entry (or the equivalent) exercising loading / loaded / dismissed states
- [ ] Visual review against the rest of the app

### Tier 1 — disambiguation (REQUIRED FOR LAUNCH)
- [ ] **3.1.1** `prompt_select_vehicle` — horizontal car-card carousel
- [ ] **3.1.2** `prompt_quick_replies` — chip row below last bubble

### Tier 2 — common reads (REQUIRED FOR LAUNCH)
- [ ] **3.2.1** `show_maintenance_schedule` — overdue/due_soon/upcoming list, rows tappable into booking flow
- [ ] **3.2.2** `show_health_score` — circular score + factors

### Tier 3 — pre-booking (REQUIRED FOR LAUNCH)
- [ ] **3.3.1** `prompt_select_shop` — shop card list, distance + rating + labor rate
- [ ] **3.3.2** `show_cost_estimate` — range bar with OEM tag + mandatory Book CTA
- [ ] **3.3.3** `prompt_select_service` — chip grid for ambiguous service intent

### Tier 4 — booking spine (REQUIRED FOR LAUNCH)
- [ ] **3.4.1** `prompt_select_mechanic` — mechanic card list (skip-able if shop has only one)
- [ ] **3.4.2** `prompt_select_timeslot` — day picker + time chips
- [ ] **3.4.3** `confirm_booking` — full sheet with edit affordances per row
- [ ] **3.4.4** `show_booking_summary` — post-write confirmation card

### Tier 5 — diagnostics (REQUIRED FOR LAUNCH)
- [ ] **3.5.1** `show_diagnostic_summary` — ranked causes with confidence pills + severity badge + DIY tag + Book Inspection CTA

> **Tier 5 is non-negotiable for launch even though it's tier 5.** The whole product story includes "tell Oto what's wrong." The number means build-order, not ship-order. Move it earlier if your team can swing it.

### Tier 6 — read-only flourishes (POST-LAUNCH OK)
- [ ] **3.6.1** `show_vehicle_specs` — sectioned spec card
- [ ] **3.6.2** `show_service_history` — timeline

### Tier 7 — edges (POST-LAUNCH OK)
- [ ] **3.7.1** `prompt_add_vehicle` — bridge into existing `(tell-us-about)` flow
- [ ] **3.7.2** `navigate_to` — Expo Router push
- [ ] **3.7.3** `confirm_action` — generic destructive confirm modal

### 3.8 Mode-level integration smoke
After each tier, before declaring it done:
- [ ] Run the agent against a real test fixture, force the relevant tool by prompt ("show me a cost estimate for brake pads"), verify the round-trip works on a real device.
- [ ] Tier-3 specifically: verify `show_cost_estimate` always lands paired with a booking offer in the next agent turn (this is the funnel rule — if it doesn't fire, tighten the system prompt before moving on).

---

## Phase 4 — Integration & QA

**Goal:** the eight backend test prompts + six UI/policy prompts (Test Plan in `OTO_AI_AGENT_CONFIG.md`) pass end-to-end on a real device.
**Owner:** backend + app together.
**Depends on:** Phase 1 done, Phase 3 tiers 1–5 done.
**Done when:** all 14 test cases pass twice in a row on iOS and Android.

### 4.1 End-to-end dry runs
Run every test from §"Test plan after deploy" in the agent config doc. For each:
- [ ] Confirm the agent's tool_use sequence matches the expected order.
- [ ] Confirm the app rendered each mode correctly.
- [ ] Confirm any `bookings` writes actually landed in Convex (check the row).
- [ ] Confirm cancellations (`{ "cancelled": true }`) don't loop.

### 4.2 Booking spine specifically
The booking flow is the highest-stakes path. Run:
- [ ] Happy path: pick vehicle → pick shop → pick slot → confirm → write succeeds → summary renders.
- [ ] Edit path: at confirm step, tap "Edit shop" → bounces back to `prompt_select_shop` → user picks new shop → confirms → write succeeds.
- [ ] Cancel path: dismiss `confirm_booking` → no write occurs → Oto handles gracefully.
- [ ] Failure path: simulate an `insert_doc` failure → Oto says so plainly, no false success message.
- [ ] Cancel-existing path: "cancel my Friday booking" → `confirm_action` → `update_doc` to status=cancelled. Never `delete_doc`.

### 4.3 Diagnostic + cost honesty
- [ ] Squealing brakes prompt → severity is `soon` (not `immediate` unless symptoms warrant). Verify Oto isn't inflating to push bookings.
- [ ] Low washer fluid prompt → `diy_feasibility=easy`, no booking push. Verify Oto isn't push-selling trivial DIYs.
- [ ] Brake pad cost → OEM framing line is present, parts_kind=OEM, booking offer follows.
- [ ] Aftermarket cost ask → polite decline, OEM range, booking offer. No aftermarket numbers anywhere in the response.

### 4.4 Cross-cutting
- [ ] Other-user data leakage — refused.
- [ ] Empty/error MCP responses — surfaced plainly.
- [ ] Long conversations (20+ turns) — context still has the bootstrap data, no re-fetching.
- [ ] Rapid send/cancel/send — UI state stays consistent, no orphaned `tool_use` blocks.

### 4.5 Sign-off
- [ ] QA lead signs off on the 14-case matrix.
- [ ] Backend lead and app lead both approve.

---

## Phase 5 — Launch

**Goal:** Oto is in production, with a kill switch.
**Owner:** both, plus whoever owns rollout / feature flags.
**Depends on:** Phase 4.
**Done when:** Oto is on for 100% of users *or* you've consciously decided to keep it gated.

### 5.1 Feature flag setup
- [ ] Wrap the chat tab/route in a feature flag (e.g. `oto_ai_enabled`).
- [ ] Default to `false` for general users, `true` for the team and a small beta cohort.
- [ ] Document the flag's name and toggle path so anyone on call can disable it.

### 5.2 Soft launch (internal + beta)
- [ ] Roll Oto to the team for at least 48 hours of dogfooding.
- [ ] Track: average MCP calls per turn, tool_use → tool_result roundtrip latency, % of conversations that hit a `confirm_booking`, % that complete a booking, refusal rate, error rate.
- [ ] Read the trace logs daily. Look for: hallucinated facts, missing booking offers after cost/diagnostic answers, severity inflation, write failures.

### 5.3 Iterate
- [ ] If failures are prompt-shaped: tighten the system prompt, redeploy a new agent revision, repeat Phase 4 against just the changed cases.
- [ ] If failures are app-shaped: fix the component, no agent change needed.
- [ ] If failures are schema/data-shaped: fix the data, then re-run Phase 0 alignment.

### 5.4 General availability
- [ ] Flip the flag to `true` for 10% → 50% → 100% of users with at least 24 hours between steps.
- [ ] Keep the kill switch reachable. Anything funnel- or money-related (booking writes especially) deserves an instant disable path.

### 5.5 Post-launch backlog
- [ ] Tier 6 + 7 components shipped and removed from technical debt.
- [ ] Aftermarket pricing decision (currently locked enum on `parts_kind`). If product wants comparison view, expand the enum and update the prompt.
- [ ] Cross-device handoff (start a booking on phone, finish on web) — not in scope for v1.
- [ ] Voice input chip resolution (when user speaks an answer matching a chip).
- [ ] Persistent UI cards in scrollback (decide read vs write rules per mode).

---

## Owners summary

| Phase | Backend team | App team | QA |
|---|---|---|---|
| 0 Pre-flight | Lead | — | Verify fixtures |
| 1 Agent backend | Lead | — | Run §5 prompts |
| 2 App scaffold | — | Lead | — |
| 3 Mode components | Consult on schemas | Lead | Spot-check tiers |
| 4 Integration | Co-lead | Co-lead | Lead |
| 5 Launch | Co-lead on prompt iteration | Co-lead on flag | Monitor |

---

## What "done" looks like

- A user opens OtoPair, taps the Oto tab, and asks "what's due on my Civic?"
- Oto bootstraps silently in the background, reads their vehicles from Convex, identifies the Civic, queries `service_intervals` and `vehicle_service_states`.
- Oto replies in one short framing line and renders `show_maintenance_schedule` listing one overdue oil change.
- The user taps the overdue row.
- Oto walks them through `prompt_select_shop` → `prompt_select_timeslot` → `confirm_booking` → write → `show_booking_summary`.
- The booking shows up under the bookings tab.
- No fabrications. No aftermarket prices. No fake confidence on the diagnosis they didn't ask for. No booking offered when DIY would do.

If that single flow works without a hitch, Oto is shipped.
