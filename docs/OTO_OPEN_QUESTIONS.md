# Oto — Open Questions for Waleed

Questions raised by the 117-page test report (`Otopair oto testing.pdf`) that I cannot resolve from the
codebase. Each one blocks or redirects a specific item in `docs/OTO_REMEDIATION_PLAN.md`.

Answer inline under each question — no particular format needed.

---

## BLOCKING — these gate Wave 0 / Wave 1, the cheapest work on the board

### Q1. The price policy contradicts itself. Which one is the real rule?

**The report's rule (p.68, D-25):**
> "Oto may never state, estimate, or compare a dollar figure it did not retrieve from the pricing
> engine. Argue with relative magnitude — 'far more than,' 'a fraction of' — never with invented numbers."

**Your note on p.5, about a response you otherwise liked:**
> "the first line should say *'For your Sportage, brake pads usually land in the X–Y range — the exact
> number depends on which shop you pick, and you'll see it before you pay.'*"

These want opposite things. The first says never quote a range; the second asks for one.

The current prompt implements the strictest possible reading (`stable.ts:838`: *"You do NOT quote
full-service prices. **Anywhere.**"* plus six reinforcements) — and Oto fabricated prices anyway, five times.

Relevant: **a price table already exists.** `convex/seeds/seedPricing.ts:209` has low/high cents for 22
services, including `brake_pad_replacement: $220–380` — which is exactly the "X–Y range" your p.5 note
asks for.

Which do you want?
- **(a)** Total prohibition. No dollar figure ever, enforced by an output guard.
- **(b)** Ranges from `BASELINES` only, via a tool, phrased as your p.5 line. Anything not from the tool
  gets stripped.
- **(c)** Something else.

I'd argue **(b)**: the fabrication is happening *because* there's no legitimate way to answer a
reasonable question. Suppression alone has already been tried at maximum strength and failed. But this
is a product-trust call, not an engineering one.

**Answer — (a), total prohibition.** Waleed, 2026-08-09: *"this is something we want the AI to be
prohibited from quoting a price."*

**Provenance — iMessage thread with Abubeckr, 2026-08-08** (screenshot `IMG_0809.PNG`). The p.5 note was
Waleed's first instinct; the thread is where it was overturned:

> **Waleed:** "The AI model cant really pick between quoting a range and not quoting at all"
> **AB:** "So then it should not give any numbers and prompt them to book it with a shop to see the numbers"

**The rationale is model reliability, not policy purity — and it refutes my recommendation on a ground I
didn't weigh.** I argued for (b) as a product-trust question: *is it fair to withhold a number the user
reasonably wants?* Waleed's objection is a different and better one: **(b) is a conditional rule, and a
conditional is exactly what the model cannot hold.** "Quote ranges, but only from the tool, and only for
catalog services" has three clauses to keep straight mid-sentence. The report already proved Oto crosses
an *unconditional* line under pressure five times; a conditional line is strictly weaker.

Total prohibition is the only version that is (a) statable in one clause and (b) enforceable by a
deterministic guard, because "any currency token" is decidable without knowing intent. That is the real
argument for (a), and it's stronger than the one I made against it.

**Consequences:** W1.1 (pricing tool) dropped. W1.2 becomes a hard block — any currency figure stripped,
no allowlist, no sourced-price exception. Q2 moot. The p.5 note is superseded.

**One more requirement from the same screenshot.** The visible Oto response at the top is *already doing
the right thing* — refusing to quote and pointing at the booking flow (*"…number I can give you — it
depends on which shop you pick. The real quote shows up when you select a mechanic inside the booking
flow."*). The behaviour isn't missing; it's **verbose**. This is p.77's note verbatim: *"It's too much
text just to tell you I can't give you a price."*

So W1.5 is not "teach Oto to decline" — it's "make the decline one line plus a booking render." Target
shape:

> Can't give you a number — it depends on the shop. Pick one and you'll see the real quote before you pay.
> `[Book brake service]`

Length is a hard part of this fix, not a nice-to-have (see D-9, escalated to P1).

---

### Q2. Is `seedPricing.ts` actually seeded in the live deployment, or is it dev scaffolding?

Everything in Q1 option (b) depends on this. If `BASELINES` isn't in `flippant-mink-750`, a pricing tool
has nothing to read and Wave 1 collapses back to option (a).

Also: are those Camry-anchored baselines considered accurate enough to show a user, or were they
placeholder numbers for pipeline testing? The header says "Toyota Camry T1 anchor prices."

**Answer — self-resolved 2026-08-09. Moot, and the file is legacy.**

Moot because Q1 came back as total prohibition: no pricing tool will be built, so nothing needs to read
`BASELINES`.

For the record, two things I found while checking:

1. **It can only have been run by hand.** `seedPricing.run` is an `internalMutation` with no cron
   registration and no caller anywhere in `convex/` or `scripts/`. Whether it ever ran against
   `flippant-mink-750` is not knowable from the repo — only from the deployment.
2. **`seedPricing.ts` is superseded.** `convex/seeds/seedPricingV2.ts` is *"Pricing System v2 (spec
   May 29 2026, locked)"*, orchestrated by `setupPricingV2.ts`. V2 seeds only the parts/labor
   multiplier tables and defers the anchor prices to `seedCamryBaseline.ts`. It contains **no
   `state_inspection` row and no `$37`** — that value exists only in the v1 file.

So my earlier framing — *"the correct NY fee is already in the database"* — should be narrowed to
**"the correct NY fee exists in a legacy seed file."** Whether it's in the live deployment is unverified,
and under Q1 it no longer matters.

---

### Q3. `state_inspection` — bookable service, or informational only?

D-26 is the sharpest defect in the report (legally fixed price, quoted wrong, Staten-Island-first
product). The correct value is already in the seed:

```ts
state_inspection: { low_cents: 3700, high_cents: 3700, notes: "NY state cap" },
```

`state_inspection` is in the Oto-facing slug list (`tools.ts:961`) but **not** in the enrichment-facing
one. Can a user actually book a state inspection through Otopair, or should Oto only ever cite the fee
and send them elsewhere?

**Answer — yes, it's bookable.** Waleed, 2026-08-09: *"Yes we offer state inspection, it's part of
booking flow."*

Combined with Q1 this fully specifies the D-26 fix, and it's simpler than the report proposed. Oto does
**not** need to learn the correct $37 figure. It quotes nothing and fires
`render_book_service(service_slugs: ["state_inspection"])` — the booking component shows the real price.

The report framed D-26 as "Oto stated a wrong number." The actual defect is "Oto answered with prose
where it should have rendered a booking." That makes it an instance of the report's own through-line —
*intelligence outrunning agency* — rather than a pricing bug, and it's closed by W1.2 plus the routing
rule, with no pricing data involved.

---

### Q9. When we stop fabricating `lastService`, what should the card show?

Wave 0.1 removes `lastService: "~5 months ago"` from `URGENT_DETAILS`, because it's a hardcoded constant
that overwrites the real record — and it's showing on the **Cars tab**, not just in Oto.

Items with no real service record will then have nothing to display. Options:
- **(a)** Omit the "last service" row entirely
- **(b)** Show "Unknown"
- **(c)** Show "No record on file" with a tap-to-add affordance

This is product-visible on the Cars card, so it's your call — and it decides whether W0.1 is a
delete-two-keys change or a small UI branch.

**Answer — self-resolved 2026-08-09. The question dissolves: the Cars tab never shows these fields.**

I traced every consumer of `MaintenanceItem`:

| Component | Fields it actually renders |
|---|---|
| `MaintenanceTracker.tsx` | `serviceName`, `description`, `status`, `mechanicProvenance`, `id` |
| `MaintenanceDetailView.tsx` | `serviceName`, `status`, `signals`, `triggeredBy`, `id` |
| `utils/maintenanceExplanation.ts` | `signals`, `status`, `triggeredBy`, `serviceName`, `id` |

`lastService`, `urgency`, `impacts`, and `recommendation` are **declared** on the interface
(`MaintenanceTracker.tsx:95`) and **rendered by nothing**. The Cars tab builds its copy from
`item.signals` — the real computed time/mileage/interval values — not from `URGENT_DETAILS`.

**Correction to an earlier claim.** I previously wrote that the Cars tab "has been showing users
fabricated last-service dates." That was wrong. I inferred it from the shared-module header comment in
`maintenanceEnrichment.ts` (*"shared between hooks/useMaintenanceData.ts and
convex/oto/vehicleHealth.ts"*) without checking whether the client actually renders the enriched fields.
It computes them and drops them on the floor. The Cars tab is honest.

Two consequences, both good:

1. **W0.1 is Oto-only.** No UI branch, no product decision, no mobile ticket. Delete two keys from a
   constant; the only consumer affected is `vehicleHealth.ts` → Oto.
2. **W0.1 is unblocked** and can start immediately.

---

## SCOPE / OWNERSHIP — needed before Wave 2 (safety) can be specified

### Q4. Safety classifier — deterministic or model-based?

The report's rule (p.69): *"a safety classifier runs before routing. Fire, fumes, steering, braking,
visibility → warn first, triage second, regardless of how calmly the user phrased it."*

Two implementations:
- **Deterministic keyword/pattern match** — zero added latency, zero cost, fully testable, but brittle
  against phrasings nobody listed ("it smells like a gas station in here").
- **A cheap model call before the main one** — catches paraphrase, but adds latency to every turn and
  another failure mode.

Given the whole point is that it must fire when the user sounds *calm*, I lean deterministic-first with
a generous pattern list, because it's auditable and you can prove it fired. Your call on whether the
latency of a second model call is acceptable.

**Answer:**

---

### Q5. Who owns and validates the warning-light severity mapping?

D-12 is assigned to "Waleed / Yassin." `lib/warningLightVocab.ts:41` already has the 9 canonical lights
but carries **no severity data at all** — which is why the oil-pressure light got "drive to a gas
station and check the dipstick" (p.112).

Adding a `severity` + `action` column is trivial. Getting the *content* right is a domain-authority
question — an incorrect mapping here is worse than none, because it will be stated with confidence.

Does Yassin sign off on the 9 mappings before they ship? Same question for the severe-service /
duty-cycle mappings in Wave 5 (the "short trips are easier on brakes" fix).

**Answer (2026-08-13, Waleed): Yassin is not a mechanic — there is no domain authority to sign
off.** So the question is answered by replacing the authority with published sources rather than
by finding a different person. The mapping is now grounded in AAA's consumer roadside guidance,
which is the right register: it is written for drivers deciding whether to keep driving, not for
technicians. Sources are cited per-light in the header of `lib/warningLightVocab.ts`.

What the re-grounding changed (all deployed 2026-08-13, 60/60 unit assertions):

| Light | Was | Now | Why |
|---|---|---|---|
| `oil_pressure` | stop_now, unconditional tow | stop_now, **conditional** tow | Our text was *stricter* than AAA and would send a truck to a driver a quart low. AAA: stop → shut off → check level → top up → tow only if the level was fine or the light returns. The p.112 defect was *driving* to a gas station, not checking the oil. |
| `abs` | urgent, "your normal brakes still work" | urgent, leads with the red-lamp reading | **The worst finding.** `ALIAS_TO_CANONICAL` folds `brake_warning` onto `abs`, so a red brake lamp — low fluid, failed hydraulic circuit — was being told its brakes were fine. Severity stays `urgent`: `soon` would be right for ABS alone and wrong for the merged bucket. |
| `airbag_srs` | urgent | **soon** | AAA says have it inspected; it does not say stop or hurry. The fault is to passive protection in a crash, not to control of the car, so it should not lead a turn with a hazard instruction. Most debatable line in the table. |
| `check_engine` | soon (flashing only in prose) | soon + **flashing escalates to stop_now** in `safety.ts` | The canonical vocabulary has no flashing variant, so "my check engine light is flashing" produced **no escalation at all** for an active misfire. Escalated on raw wording where it is still available. |
| `tpms` | soon, "check at the next stop" | soon + explicit stop-conditions | Added the trade-standard thresholds: nearest air source, and stop sooner if it pulls, vibrates, thumps, or looks flat. |

Still judgment, and labelled as such in the file: the `airbag_srs` tier boundary, and the wording
of every `action` string. The severities and the drive-vs-tow calls are sourced.

**Wave 5 duty-cycle mappings are NOT covered by this** and remain unsourced — AAA guidance does not
extend to "short trips are easier on brakes"-class claims. S7 stays open.

**Follow-on filed:** see Q5b below.

---

### Q5b. Should `brake_warning` be split from `abs`? (filed 2026-08-13)

`lib/warningLightVocab.ts` states in its own header that "Crucially `brake_warning != abs`", then
maps `brake_warning → abs` in `ALIAS_TO_CANONICAL`. Four label maps call the bucket "ABS / brake",
and `tests/warningLightVocab.test.ts:39` asserts the fold — so the conflation is deliberate design,
not an oversight.

It is still wrong on the evidence: the amber ABS lamp means anti-lock assist is disabled and base
hydraulic braking is unaffected, while the red brake lamp means low fluid or a failed circuit —
reduced ability to stop the car. Different tiers, different actions.

Wave 2's *text* classifier already treats a described brake failure ("pedal goes to the floor") as
`stop_now`, so the gap is specifically the **named-light** path.

Mitigated for now by rewriting the `abs` action to lead with the red-lamp reading rather than
asserting the base brakes are fine. A real split needs a 10th canonical id plus entries in:
`WARNING_LIGHT_HAZARD`, `utils/healthScore.ts` (penalty + label maps), `convex/maintenance_pipeline.ts`
(penalty map), `lib/warningLightItems.ts`, `convex/oto/vehicleHealth.ts`, `convex/checkin.ts`
(`WARNING_FLAGS`), `convex/lib/serviceSymptoms.ts`, a `PAIRED_WARNING_LIGHTS` decision, an updated
test, and a new option in the `app/quarterly-checkin.tsx` picker — i.e. a user-visible change.

**Answer:**

---

### Q6. Can the mobile chat render two interactive components in one message?

Wave 3.1 fixes the chips inversion by letting `render_quick_replies` co-exist with another render tool.
The **backend already supports this** — `mergeRenderDirectives` merges all render fields into one
envelope, and `ai_messages.render` persists whatever is there. The exclusivity is prompt convention only.

But I don't know whether the mobile message component handles two render fields gracefully or picks one
and drops the other. If it can't, this becomes a mobile ticket rather than a prompt change.

**Answer (2026-08-13): it picked one and dropped the chips — a mobile ticket, exactly the fork this
question anticipated.** `app/(main-tabs)/ai-chat/index.tsx` computed one `terminalKind` per message and
did `{ ...message, quickReplies: undefined }` whenever any card was present, so "the exclusivity is
prompt convention only" was wrong — it was enforced client-side. That strip is now removed (layout per
Waleed: chips above the card, which needs no new layout code since the bubble renders first). Precedent
that a bubble carries several renders: `reasoning` + `sources` always co-existed with chips.

**Answered ≠ closed, though.** With the client strip gone AND the prompt permitting the pairing
(v0.43's "what terminal means" carve-out), Haiku still fired `render_vehicle_update` alone in 3/3
device runs — the exclusivity also lives somewhere in the model's steering (volatile exemplars and/or
the API-level tool descriptions in `tools.ts` are the suspects). W3.1's plumbing is done; its behavior
is being closed separately, likely with a deterministic server-side chip fallback rather than more
prompt persuasion.

(Note: the competence-assumption work of 2026-08-13 was briefly mislabeled "Q6" in the handoff and
artifact — renumbered Q5c.)

---

### Q7. Where did the behaviour-profiling message come from?

p.110 — flagged as a philosophy violation, "AB, urgently":
> "You've been offered oil changes and brake diagnostics multiple times over the last few days without
> booking. Before I suggest anything else, what's actually going on?"

I need to know which surface produced the "multiple times over the last few days" history before I can
remove it. Candidates: `record_semantic_fact` durable memory, `established_facts` replay, `arc_summary`,
or the model inferring it from raw message history.

If it came from a memory tool, the fix is a write-side rule. If it was inferred from history, it's a
prompt rule. Different fixes — do you know which, or should I trace it?

**Answer:**

---

### Q8. Two different `OTOPAIR_SERVICE_SLUGS` exports exist. Which is canonical?

- `convex/lib/vehicleDatabases.ts:446` — enrichment-facing. Has `ac_recharge`, `serpentine_belt`,
  `wiper_blade_replacement`, `transfer_case_service`, `multi_point_inspection`, `engine_intake_cleaning`.
  **No** `diagnostic_scan`, **no** `state_inspection`.
- `convex/oto/tools.ts:955` — Oto-facing. Has `diagnostic_scan`, `state_inspection`, `check_engine_light`,
  `pre_purchase_inspection`, `emissions_test`, `tire_replacement`. **No** `ac_recharge`.

Same export name, same rough size, different contents. Two things follow:

1. The report's "23-service catalog" means the Oto one — worth confirming.
2. **`ac_recharge` is not bookable by Oto.** The AC-smell scenario (p.71) and E2 (fuel smell with AC
   running) had nothing to route to. That's part of why D-34/D-39 look like a safety gap — it's also a
   catalog gap. Should `ac_recharge` be added to the Oto list, or is Diagnostic Scan the intended answer?

**Answer:**

---

## SMALLER — won't block anything, but affect specific defects

### Q10. D-18 — is there a user-facing spec-correction path?

Your own open question from p.17, still unanswered:
> "There's a mechanic-side edit flow and a director-panel report-wrong-data button, but I don't know of a
> user-facing spec correction path. If it doesn't exist, Oto just promised a feature."

If it doesn't exist, the fix is a prompt rule; if it does, no fix needed. I didn't find one, but I only
searched the backend.

**Answer:**

---

### Q11. Warranty — is there ever a valid answer, or is it always a refusal?

Two separate leaks: D-19 (*"I can give you a straight answer about warranty coverage"*) and K5 (*"10
years or 100,000 miles"* on the HV battery, stated as fact).

The KB rule reads as absolute. Confirming: is warranty **always** a refuse-and-redirect, with no
exception for manufacturer powertrain terms even when they're publicly documented? I'd like to make the
Wave 1.4 output guard a hard block rather than a soft one, and that only works if the answer is "always."

**Answer:**

---

### Q12. The "Tracking:" symptom list — chat UI element or Oto text?

p.72's fix for the dropped-symptom problem:
> "rendered a small persistent list — Tracking: no-start · dash light · AC smell · brake squeak"

Is that a persistent UI affordance pinned in the chat header (mobile work), or a line Oto writes into a
message (prompt + state work)? Wave 3.2 builds the backing state either way, but the surface changes who
owns the ticket.

**Answer:**

---

### Q13. Camera button — wire it up or remove it?

p.109 calls it ship-blocking: the affordance exists, upload returns "feature doesn't exist," and photos
(≤3) are a defined Oto input per the Settings spec. Same for voice.

For MVP: is the vision path meant to work, or should both buttons come out until they do? The report's
suggested copy — *"I can't read images yet — describe what you're seeing and I can help from there"* —
implies removal is acceptable short-term.

Not my call and not in my scope (Ahmad + Waleed), but it changes whether Oto needs a prompt rule for
image requests in the meantime.

**Answer:**

---

### Q14. p.117 — the post-diagnostic re-prompt

> "The app had been recommending me to do this diag service. Once I did go ahead and do it, it should've
> prompted me again to put what was wrong. Because the reason for the prompt was a warning light in my
> car that I had put into Oto."

You noted this is "app facing and site facing." Is this in scope for the Oto work, or is it a booking-flow
ticket? It reads like a booking-completion hook rather than a chat behavior.

**Answer:**
