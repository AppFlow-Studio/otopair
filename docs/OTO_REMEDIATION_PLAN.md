# Oto Remediation Plan — scenario trace + sequenced fixes

**Companion to** `docs/OTO_DEFECT_SEAM_MAP.md` (the six-seam hypothesis) and its §7 verification pass.
**Open questions blocking parts of this plan:** `docs/OTO_OPEN_QUESTIONS.md` — read that first.

This document does the second pass the seam map asked for: walk the actual test scenarios, trace each
to a code location, and sequence the fixes by leverage rather than by severity.

---

> **Update 2026-08-09 — Q1, Q2, Q3, Q9 answered. §0.1 below is superseded; kept for the record.**
> Waleed ruled **total prohibition** on prices: no pricing tool, hard block on currency in output.
> State inspection **is** bookable, so D-26 closes by rendering a booking rather than by getting the
> number right. Q9 dissolved — the Cars tab renders none of the enriched fields, so W0.1 is Oto-only.
> **Waves 0 and 1 are now unblocked and total roughly one day.**

---

## 0. Two findings that change everything below

### 0.1 A pricing table already exists, with the correct NY inspection fee in it
> **SUPERSEDED by Q1.** Retained because the reasoning still explains *why* fabrication happened.
> Two corrections: `seedPricing.ts` is legacy (Pricing v2, May 29 2026, replaced it and carries no
> `state_inspection` row), and whether it was ever seeded into `flippant-mink-750` is unverified —
> `run` is a manual `internalMutation` with no cron and no caller.

`convex/seeds/seedPricing.ts:209–235` defines `BASELINES` — low/high cents for 22 services:

```ts
diagnostic_scan:   { low_cents:  6000, high_cents: 12000 },   // $60–120
oil_change:        { low_cents:  6500, high_cents: 11000 },   // $65–110
brake_pad_replacement: { low_cents: 22000, high_cents: 38000 },
state_inspection:  { low_cents:  3700, high_cents:  3700, notes: "NY state cap" },
```

**D-26 said Oto quoted `$75–150` for a NY inspection whose real fee is ~$37.**
`$37.00` is sitting in the seed file, flagged as the NY cap. The right answer was already in the
database. Oto fabricated because **no tool exposes this table** — `tools.ts` has no pricing tool at all.

The report's prescription was to ban dollar figures harder. That is the wrong direction: the current
state is already *maximum prohibition* (`stable.ts:838` — "You do NOT quote full-service prices.
**Anywhere.**") and it produced fabrication anyway. Suppression without a legitimate alternative is what
creates the pressure.

Note also `p.5` of the notes, in Waleed's own voice:

> "the first line should say *'For your Sportage, brake pads usually land in the X–Y range — the exact
> number depends on which shop you pick, and you'll see it before you pay.'*"

That is a request for exactly the data in `BASELINES` (`$220–380` for brake pads). **The product owner's
stated preference and the report's stated rule are in direct conflict.** Q1 in the questions doc.

### 0.2 The warning-light vocabulary exists but carries no hazard data

`lib/warningLightVocab.ts:41` — `CANONICAL_WARNING_LIGHTS`, 9 ids:
`oil_pressure · battery_charging · temperature · abs · tpms · airbag_srs · transmission · check_engine · not_sure_which`

It is a pure module already imported by client hooks, `utils/`, and Convex server code. It has ids and
alias mappings and **no severity, no action, no hazard text**.

That is precisely the p.112 finding — *"named warning light, but the hazard mapping is wrong for this
specific light."* There is no hazard mapping to be wrong. The oil-pressure light and the TPMS light are
indistinguishable to every consumer of this module.

**This makes S1 much cheaper than "build a safety layer."** The table exists and is already wired
everywhere. It needs one more column.

---

## 1. Scenario trace

Each row: what the tester did → what Oto did → the code that caused it.

| # | Scenario | Observed | Code location | Class |
|---|---|---|---|---|
| T1.1 | "oil change" | Collapsed to prefilled picker, 1 turn | `stable.ts:346` routing rule 1 | ✅ works |
| p.3 | Booked oil change | Mechanic step came before shop step | mobile `BookServiceComponent` | UI order |
| T2.2 | Upset user, brake noise | 4 options in prose, no chips | terminal-render contention (§2.2) | S2 |
| E1 | Check-engine light | Logged to record; no scan offered | `stable.ts:447` routes light → `render_vehicle_update`, terminal — booking can't co-fire | S2 + S1 |
| E1 | Same | No steady-vs-flashing asked | `stable.ts:449` rule exists but lost the turn | S1 |
| T4.3 | Warranty question | Correctly refused | prompt guardrail | ✅ works |
| K5 | HV battery | Volunteered "10 years / 100,000 miles" | same guardrail, **not** enforced in code | S6-adjacent |
| T4.4 | Legal-adjacent | Rendered Contact Support | `render_link_button` | ✅ works |
| H2 | Complaint vs platform | No support button | dispatcher fine; prompt never routes grievance → `link_button` | S2 |
| C1 | Smoke under hood | Explained cause; never said "don't open the hood" | **no safety code exists** | S1 |
| E2 | Fuel smell + AC | Opened routine triage Q&A | not a named light → no branch → no check | S1 |
| — | AC smells weird | Asked about dash light instead | same | S1 |
| L1 | Soft brake pedal | Two diagnostic questions, zero safety framing, 3 turns | same | S1 |
| p.112 | Oil-pressure light ON | "Drive to a gas station, check the dipstick" | light IS named, but `warningLightVocab` has no severity → model improvises | S1 |
| T7.2 | Brake pull → "cool, book the oil change" | Brake symptom vanished | `established_facts` is `string[]`, no resolution status | S5 |
| L2 | 4 symptoms, "one at a time" | No queue, no return guarantee | same | S5 |
| J3/K2/K4/L1/p.112 | Oil timeline ×5 | `2mo → 2wk → 5mo → 2wk → 1mo` | **`URGENT_DETAILS` string constants** (§2.1) | S4 |
| K2 | "short trips are easier on brakes" | Mechanically false | pure model reasoning, no KB severe-service mapping | **new: S7** |
| K5 | "hybrid battery is in good shape" | No HV data exists | 5-type closed set, no scope declaration | S3 |
| K3 | "I think, like 6 months ago" | Written to record as dated fact | `render_vehicle_update` accepts `service_age_days` with no confidence field | S3 |
| J1 | "6.34 quarts… about 6" | Two figures, one sentence | over-precision, no rounding rule | S6-adjacent |
| T-4 | "you quoted me a price" | Accurate self-recall, held | — | ✅ best moment in set |
| M | "the KB is empty" | Named internal architecture unprompted | `stable.ts:83` bans it; **not enforced in code** | S6-class |
| p.109 | Camera button | Upload → "feature doesn't exist" | vision path unwired | ship-blocker |
| p.110 | "you've been offered X multiple times without booking" | Conversion-pressure script | source unconfirmed — Q7 | philosophy |
| p.107 | App resume | False "no internet" / "reconnecting" | `project_offline_connection_states` | infra |
| p.105 | One car | Still shows car chooser | mobile chat-create | UI |
| p.117 | After completing a diagnostic | No re-prompt for the symptom | flow gap | product |

### 1.1 The pattern the trace exposes

Sorting the trace by cause rather than by symptom, **the P0s collapse into three groups, not six**:

1. **Bad data reached a truthful model** — S4 (`URGENT_DETAILS`), S3 (closed 5-type set with no scope
   statement). Oto reported what it was given. Not an AI defect.
2. **No hazard model exists** — S1. Every safety miss (C1, E2, L1, AC, oil-pressure) is one absence.
3. **A rule exists in prose and nowhere else** — S6 prices, warranty, KB-naming, markdown. All four
   failure modes are "prompt says never, model does it anyway, nothing checks the output."

Group 3 is the important reframe. `stripVoiceMarkup` (`chat.ts:1913`) already exists precisely because
someone learned this lesson for markdown — its docstring says *"the prompt bans bold and headers, but
Haiku falls back to them under pressure. This is the belt-and-suspenders pass."* **The pattern is
established; it just has one member.** Prices, warranty terms, and internal nouns belong in the same pass.

### 1.2 New seam the first pass missed — S7, connective-tissue fabrication

p.90, the report's own words:

> "Where facts exist, Oto is accurate. Where it has to reason **across** them … it generates confident
> plausible content that isn't grounded in anything."

K2's *"short trips are easier on brakes and tires than on oil"* is not a number, not a price, not a spec.
It is an invented **causal claim**, used to justify skipping a service the record showed was 1.6 years
old. Stop-and-go is the *harshest* brake duty cycle — Kia's own severe-service definition says so.

None of S1–S6 catch this. It isn't a safety miss, isn't a price, isn't a stale field. It's the model
bridging two real data points with fabricated mechanics. **This is the hardest seam in the set and the
only one with no cheap fix** — it needs a KB of severe-service / duty-cycle mappings so the reasoning is
retrieved rather than generated. Yassin should own the mapping content.

---

## 2. The two fixes that are already fully specified

### 2.1 S4 — delete two keys from a constant

`utils/maintenanceEnrichment.ts:27` — `URGENT_DETAILS` is keyed on `(type, status)` and nothing else:

```ts
oil: { due_soon: { lastService: "~5 months ago",        // ← fabricated
                   urgency:     "Service within 2 weeks", // ← fabricated
                   impacts: [...],                        // ← fine, generic advice
                   recommendation: "..." } }              // ← fine, generic advice
```

`enrichUrgentItem:164` applies it as `return { ...item, ...details }` — **the constant spreads over the
real record**, so a genuine `lastServiceDate` is destroyed for any item at
`overdue | due_soon | needs_attention`.

`vehicleHealth.ts:524` strips `last_service` only when `isUnsourced` (provenance `inferred` OR status
`unknown`). A `self_reported` item at `due_soon` is neither → `"~5 months ago"` reaches the model as
this car's history.

`impacts` and `recommendation` are legitimate — they're generic advice and read as such.
`lastService` and `urgency` are **factual claims about a specific vehicle** and must come from the record.

**Blast radius is wider than Oto.** The file header says it's shared with `hooks/useMaintenanceData.ts`
and that the hook is "byte-identical" after the refactor — so the **Cars tab has been showing users
invented last-service dates for their own cars.** That reframes this from an AI bug to a data-integrity
bug, and it is the single cheapest P0 on the board.

Open product question before this lands: what the Cars card shows when there's no real date. Q9.

### 2.2 S2 — the chips inversion is turn-budget, not confidence

`dispatcher.ts:156–296` is a pure `switch`. No confidence value, no threshold, no suppression.
`mergeRenderDirectives:425` merges **all** render fields into one envelope. Nothing in code prevents
chips and a booking card from co-existing in a single message.

The exclusivity is prompt convention only — `stable.ts:763`:

> "This tool emits buttons that ARE your final response; **calling it ENDS YOUR TURN.**"

`render_vehicle_update:809` and `render_book_service:807` say the same. They are mutually exclusive
terminal renders, and hard turns are exactly when Oto is also logging a fault or firing a booking.
Chips lose every contention.

That is the whole inversion. Easy turn → chips are the only render in play → they appear.
Hard turn → another terminal render wins → enumerated options degrade to prose.
**Confidence was never the variable.**

This also explains E1 as a single cause: light gets logged (`render_vehicle_update`, terminal), so the
Diagnostic Scan offer and the flashing-vs-steady chips both lose the same turn. D-11 and D-12 are one bug.

---

## 3. Sequenced plan

Ordered by **leverage ÷ risk**, not by severity. Waves 0–1 touch no conversational behavior at all.

### Wave 0 — data integrity · no AI work · hours · **UNBLOCKED**

| | Change | Closes |
|---|---|---|
| W0.1 | Remove `lastService` + `urgency` from `URGENT_DETAILS`; let the record supply them | 5 unstable timelines, D-37 |
| W0.2 | Extend `stripVoiceMarkup` to single-asterisk italics (`*text*`) | D-21 |

Zero risk to conversation quality. **Q9 resolved 2026-08-09 — no UI impact.** `lastService`, `urgency`,
`impacts`, and `recommendation` are declared on `MaintenanceItem` but rendered by no component; the Cars
tab builds its copy from `item.signals` instead. W0.1 touches Oto only.

### Wave 1 — output guard · the S6 inversion · 1 day · **UNBLOCKED**

**Q1 resolved 2026-08-09 — total prohibition.** Oto may not quote a price under any circumstance. The
pricing tool is dropped; the guard has no allowlist and no sourced-price exception.

| | Change | Closes |
|---|---|---|
| ~~W1.1~~ | ~~`get_service_price_range` tool~~ — **dropped per Q1** | — |
| W1.2 | Currency guard in the `stripVoiceMarkup` pass — hard block on any `$N` | D-25, D-26, D-28, D-41, D-44 |
| W1.3 | Same pass: internal-noun guard (KB / Convex / pipeline / search) | D-46 |
| W1.4 | Same pass: warranty-term guard (`\d+ years?.{0,20}\d+,?\d* miles`) | D-19, K5 |
| W1.5 | Price question → **one-line decline + `render_book_service`**, never a prose explanation | D-26, D-39, D-9 |

**D-26 is closed differently than the report proposed.** Q3 confirmed state inspection is bookable, so
Oto never needs the correct $37 figure — it quotes nothing and renders
`render_book_service(["state_inspection"])`. The real defect was answering in prose where a booking
belonged, which makes D-26 an instance of *intelligence outrunning agency* rather than a pricing bug.

W1.5 is what keeps W1.2 from being pure suppression: the model gets an *action* to take instead of a
number to state. Without it, blocking currency just produces a refusal where the user wanted help.

**W1.5 is a length fix as much as a routing fix.** Per the Q1 screenshot (`IMG_0809.PNG`), Oto already
declines correctly — *"the real quote shows up when you select a mechanic inside the booking flow"* — it
just takes a paragraph to do it. p.77: *"It's too much text just to tell you I can't give you a price."*
Target shape, and the acceptance criterion for this item:

> Can't give you a number — it depends on the shop. Pick one and you'll see the real quote before you pay.
> `[Book brake service]`

**Why total prohibition rather than tool-sourced ranges** (Waleed → AB thread, 2026-08-08): a conditional
rule — *quote ranges, but only from the tool, only for catalog services* — is three clauses the model has
to hold mid-sentence. The report already shows Oto crossing an **unconditional** line five times under
pressure. A conditional line is strictly weaker, and only an unconditional one is decidable by a
deterministic guard. Reliability argument, not a policy one.

### Wave 2 — safety floor · the P0 liability · 3–5 days

| | Change | Closes |
|---|---|---|
| W2.1 | Add `severity` + `action` to `CANONICAL_WARNING_LIGHTS` (9 entries, existing shared module) | p.112 oil-pressure, ABS shrug |
| W2.2 | Pre-routing classifier in `sendMessageHandlerCore`, keyed on fumes/fire/smoke/steering/braking/visibility → injects `<safety_override>` envelope block | C1, E2, L1, AC smell, D-22, D-34 |
| W2.3 | Three-state termination rule in prompt (matched / unmatched → Diagnostic Scan / unsafe) | D-39, D-11 |
| W2.4 | Suppress `render_vehicle_update` while a safety override is active | D-13 stacked cards |

W2.2 must run **before** the model call and be tone-independent — that is the whole point of
*"Oto responds to alarm, not to danger."* Needs Q4 (deterministic vs model classifier) and Q5 (who
validates the severity mapping — Yassin per D-12).

### Wave 3 — agency · S2 + S5 · 3–5 days

| | Change | Closes |
|---|---|---|
| W3.1 | Allow `render_quick_replies` to co-exist with one other render; code already supports it | D-6, D-33, I2, L2, 7-light case |
| W3.2 | Typed `open_symptoms: [{ text, safety_relevant, status }]` on `ai_conversations` | D-43, D-15, "one at a time" |
| W3.3 | Pre-check open symptoms in the `render_book_service` prefill | D-43 (the bundling fix the report describes) |
| W3.4 | Route platform grievances → `render_link_button(customer_support)` alongside questions | H2 |

W3.1 needs a mobile-side confirmation that two render fields in one message render sanely. Q6.

### Wave 4 — scope honesty · S3 · 2–3 days

| | Change | Closes |
|---|---|---|
| W4.1 | Declare monitored vs unmonitored systems in `get_vehicle_health` | HV battery fabrication |
| W4.2 | Prompt rule: absence from the list is never evidence of health | same |
| W4.3 | Confidence field on `render_vehicle_update` service claims; "I think, like 6 months" must not clear a flag | K3, VHS integrity |

### Wave 5 — connective tissue · S7 · open-ended

| | Change | Closes |
|---|---|---|
| W5.1 | Severe-service / duty-cycle mappings in the KB (short trips → oil + brakes + hybrid cold-cycling) | K2 false claim |
| W5.2 | Hybrid-specific reasoning surfaced when the hybrid flag is set | K2 issue 2 |

No cheap fix. Needs domain-validated content, not engineering.

### Not sequenced here — other owners

Camera/vision path (Ahmad + Waleed, ship-blocking), voice input, behaviour-profiling removal (AB,
urgent — philosophy violation), offline false-positives, chat UX cluster (auto-scroll, container
sizing, X-button, text-animation pop, one-car chooser), map view for shops, p.117 post-diagnostic
re-prompt.

---

## 4. Best case — confirmed 2026-08-09

**Wave 0 + Wave 1 is roughly one day and closes nine defects including four P0s
(D-25, D-26, D-34-adjacent numerics, D-43-adjacent timelines) — touching no conversational behavior.**

All four blocking questions came back clean, and two of them made the work *smaller* than planned:

- **Q1 removed W1.1 entirely.** Total prohibition means no pricing tool to build, no `BASELINES` to
  validate, no allowlist to maintain. A hard block is less code than a filtered one.
- **Q9 removed the UI branch.** Nothing renders the enriched fields, so W0.1 is two deleted keys.
- **Q3 simplified D-26** from "teach Oto the right number" to "render the booking it should have
  rendered anyway."

Still better than either candidate from the first pass:

- Cheaper than S1, which the verification proved is build-from-zero.
- Cheaper than S2, which needs mobile coordination (Q6 still open).
- Every change is deterministic — constants and a regex pass. Nothing depends on model behavior, so
  nothing needs eval-suite runs at N=10 to prove it worked (cf. memory `feedback_haiku_variance`).

**One caveat worth stating before W1.2 lands.** A hard currency block is a *post-generation* strip: the
model still produces the sentence, and the guard removes the figure from it. That can leave mangled
copy ("a diagnostic runs around  to  depending on the shop"). W1.5 is the mitigation — give the model a
booking to fire instead of a number to state — but the guard needs a sentence-level rule, not a
token-level one: if a stripped figure would leave a broken clause, drop the clause. Worth deciding
during implementation rather than discovering in QA.

The strategic argument for going here first: **Waves 0–1 remove the fabrications that make the AI look
untrustworthy without asking the AI to behave differently.** Waves 2–5 all change what Oto says, which
means eval churn, Haiku variance, and regression risk. Do the deterministic work while the behavioral
work is still being specified.

Then **S1 (Wave 2)** — liability outranks conversion, and the verification showed there is no safety
layer to extend, so it needs the most lead time.

---

## 5. Standing constraints

- **Do not touch `convex/vehicleEnrichment/`** — otopair-web is canonical.
- **otopair-1 and otopair-web share Convex deployment `flippant-mink-750`** — last `npx convex dev`
  wins and overwrites the other repo's functions. Any schema change in Wave 3/4 must be coordinated.
- `utils/maintenanceEnrichment.ts` is shared with the mobile Cars page — W0.1 changes both surfaces.
- Registry governance: update `docs/OTO_CAPABILITY_REGISTRY.md` §19 as each wave lands.
