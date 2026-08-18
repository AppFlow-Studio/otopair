# Oto Defect Seam Map

**Source:** `Otopair oto testing.pdf` — 117-page manual test report by Waleed (delivered 2026-08-08).
**Artifacts (outside the repo, not committed):**
- `C:\Users\manso\Downloads\Otopair oto testing.pdf` — 72.7 MB, validated complete (`%%EOF` present)
- `C:\Users\manso\Downloads\Otopair oto testing - EXTRACTED TEXT.txt` — 47.8 KB, page-tagged text

Text was extracted with PyMuPDF (`import fitz`), which is installed. The PDF is 44K chars of text
plus 136 screenshots; pages alternate between written notes and screenshot-only pages. To re-render
any screenshot page as an image, use `fitz` — `pdftoppm`/poppler is **not** installed on this machine,
so the Read tool cannot page through the PDF directly.

**Status:** Seam attribution is a **hypothesis** derived from behavioral evidence only.
No Oto source file has been opened yet. Nothing here is a confirmed code defect.
Per project rule (see memory `feedback_verify_domain_claims`): verify each seam against
ground truth in `convex/oto/` before acting.

**Cross-reference:** `docs/OTO_CAPABILITY_REGISTRY.md` §19 governance — this map should update
the registry once seams are confirmed.

---

## 1. Headline finding (report's own words)

> "Oto's intelligence consistently outruns its agency."

Most-repeated finding across the test set. Oto identifies the correct action, then hands the
work back to the user instead of taking it (D-14, D-31, D-32).

Second, unifying finding:

> "Oto responds to alarm, not to danger."

When the user sounds worried it escalates correctly; when the user sounds calm it matches
their tone regardless of what they described. Backwards — the dangerous cases are the ones
where the driver doesn't know to be worried. Unifies D-34 + D-43.

---

## 2. The six seams

### S1 — Safety runs *after* intent routing, not before
**Priority: P0 · Owner: Waleed (+ Yassin on mappings)**

Safety appears to be a hardcoded lookup on *named warning lights*, not a reasoning layer.
Anything off-catalog falls through into casual Q&A. The 23-service catalog appears to define
not just what Oto can book but what it treats as serious.

Defects: **D-11, D-12, D-22, D-34, D-43** + oil-pressure light, soft pedal, fuel smell, AC smell.

Worst instance: oil-pressure light received a DIY workaround ("drive to a gas station, check the
dipstick") instead of *stop the engine now*. That instruction could seize an engine.

Report's prescribed fix — a safety classifier that runs **before** routing, keyed on
fumes / fire / smoke / steering / braking / visibility, and trips regardless of user tone.

Also from the report, the three-state termination rule for every symptom conversation
(max two clarifying turns before reaching one):
1. **Matched** → symptom maps to a catalog service → prefill and book
2. **Unmatched** → Diagnostic Scan, framed as "a mechanic needs to see this"
3. **Unsafe** → safety warning first, support + roadside rendered, booking offered for post-tow

Recommendation in report: make **Diagnostic Scan the universal fallback** rather than trying to
close the catalog gap.

### S2 — Render-tool dispatch gated on model confidence, not answer shape
**Priority: P1 · Owner: Waleed / Ahmad**

Chips demonstrably work (T5.2, T7.1). They appear when Oto is *confident* and vanish when the
user is *struggling* — exactly inverted. Four-plus tests where Oto enumerated a closed answer
set in prose (T2.2, I2, L2, the seven-warning-light case).

Defects: **D-6 (P1), D-32, D-33, D-39** + "no chips on the hardest possible input."

D-6 is a **conditional-rendering problem, not a missing feature** — the components exist and
shipped in other flows. This branch just doesn't call them.

Proposed rule: any clarifying question with a closed/enumerable answer set renders as chips.
"Cranks / silent" is two chips. "Gas / exhaust / mildew / burning" is four. Dashboard lights
should be a tappable icon grid (half of drivers can't name them).

### S3 — Single confidence register
**Priority: P0 · Owner: Waleed (+ Daniel on VHS integrity)**

No type distinction between **measured**, **derived**, and **absent**. Facts enter the prompt
without provenance or uncertainty, and exit in one uniform voice.

Defects: **D-13, D-15** + the HV-battery claim, K3 record overwrite, `6.34 quarts`.

Evidence:
- "Nothing flagged" → *"the hybrid battery is in good shape — the system has that covered"* on a
  $4,000+ component Oto has **no data for**. Report calls this the most consequential fabrication.
- *"I think, like 6 months ago"* → `Log Brake Pad Replacement as done (6 months ago)` — an
  unverified guess written to VHS, clearing a flag. Per the Jul 25 lock only hard measurements or
  service events may clear a flag. Anyone can reset their own health score by asserting service.
- `6.34 quarts` then "about 6" in the same sentence — hedging its own number.

Report's summary: **"no data and good data are indistinguishable in Oto's output."**

### S4 — Unstable derived values
**Priority: P0 · Owner: Waleed**

Oil timeline, same car, same day, no intervening data:
`2 months` (K2) → `2 weeks` (K4) → `5 months since service` (J3) → `2 weeks` (L1) → `a month` (L2).

Five values, 4× spread, all stated with equal confidence. Mileage was removed from VHS scoring
in the Jul 25 lock and there is no odometer feed (Smartcar is post-MVP) — so this is a
time-based decay curve being presented as a measurement. Whatever produces the number is
**not reading a stable field**.

### S5 — No durable thread state
**Priority: P0 · Owner: Waleed**

Conversation history is the only state. There is no symptom queue.

Defects: **D-15, D-43** + "two symptoms parked with no guarantee of return."

- D-43: user said "cool, book the oil change" after an unresolved brake-pull discussion. Oto read
  "cool" as closure and dropped the safety symptom. Driver leaves with an oil change booked and a
  possible stuck caliper nobody is looking at.
- "One at a time" is a promise Oto has no mechanism to keep — the user has to remember on
  Oto's behalf.
- Orphaned pending vehicle-update cards stay live and bound to the wrong car after context shifts.

Proposed fix: pin unresolved symptoms to the thread as visible state
(`Tracking: no-start · dash light · AC smell · brake squeak`) and pre-check every one in the
service picker when a booking is built.

### S6 — Unconstrained numerics *(the one that is mostly a prompt fix)*
**Priority: P0 · Owner: Waleed**

Well-bounded by testing. Corrected diagnosis from the report:

> "Oto never fabricates when asked for a price — regardless of tone. It fabricates when it decides
> a number would support an argument it is already making."

Five confirmed instances. Held clean under direct, neutral, and hostile questioning (T7.1, H1) —
cracked only when a number served Oto's own argument.

Defects: **D-25, D-26, D-28, D-41, D-44**.

- D-26 is the worst: quoted `$75–150` for a NY state inspection whose fee is **set by law**
  (~$37 in NYC, safety + emissions). Staten-Island-first product, legally fixed, trivially checkable.

Proposed rules:
- Oto may never state, estimate, or compare a dollar figure it did not retrieve from the pricing
  engine. Argue with relative magnitude — "far more than", "a fraction of" — never invented numbers.
- If it is not in the 23-service catalog, Oto does not price it, **not even loosely**.
- No labor-time claims either (labor time × rate = price). Let the service card own duration.

---

## 3. Defect index

| ID | Pri | Seam | Summary | Owner |
|---|---|---|---|---|
| D-2 | — | S1 | Bundling honesty (referenced, defined in prior report) | — |
| D-6 | P1 | S2 | Four enumerated options in prose; chips exist but don't render | Waleed |
| D-9 | P1 | UX | Length. Direct request → 1–2 sentences; anything emotional → 200+ words | Waleed |
| D-10 | P2 | AB | "I hear you" verbal tic; psychoanalyzing the user | AB |
| D-11 | P0 | S1 | Symptom report classified into vehicle-record-update, not diagnostic-service | Waleed |
| D-12 | P0 | S1 | No safety triage on warning light. **Reopened — hardcoded, not reasoned** | Waleed / Yassin |
| D-13 | P1 | S3 | VHS write without user intent; stacked Confirm cards during emergency | Daniel / AB / Ahmad |
| D-14 | P1 | S2 | Knows the user wants a car switch, makes them navigate | Waleed |
| D-15 | P2 | S5 | Orphaned pending action bound to the wrong car | Waleed |
| D-18 | P3 | — | Volunteered a data-correction path that may not exist | Waleed |
| D-19 | P1 | S6 | "Straight answer about warranty coverage" — a promise it cannot keep | Waleed |
| D-20 | P2 | — | Dispute path is email-only and Oto doesn't say so; residual legal engagement offer | Waleed |
| D-21 | P3 | UI | Markdown leaking into rendered output (literal asterisks) | Ahmad |
| D-22 | P0 | S1 | Did not say "do not open the hood" on a smoke report | Waleed |
| D-23 | P2 | — | "Where are you right now" — asks for location it cannot act on | Waleed |
| D-24 | P3 | AB | "RIGHT NOW" in caps — justified here, must not be copied to non-emergency | AB |
| D-25 | P0 | S6 | Price fabrication when a number supports Oto's own argument (×5) | Waleed |
| D-26 | P0 | S6 | NY inspection fee factually wrong — legally fixed price | Yassin + Waleed |
| D-27 | P1 | S3 | "Rotors and drums" on a four-wheel-disc Sportage — enrichment-trust failure | Waleed |
| D-28 | P2 | S6 | "$200 budget" arithmetic ignores that the repair won't fit | Waleed |
| D-29 | P1 | — | Promised SMS results; SMS is blocked (funds + unregistered 10DLC) | Waleed |
| D-31 | P2 | S2 | Did not notice the user was mid-flow | Waleed |
| D-32 | P2 | S2 | Diagnosed the UI problem, then made the user fix it | Waleed |
| D-33 | P2 | S2 | Numbered lists in a chat bubble — should be chips or a card | Waleed |
| D-34 | P0 | S1 | **No safety floor on off-catalog symptoms** — largest untested surface | Waleed |
| D-36 | P3 | AB | Shifts outcome responsibility onto the driver's research | AB |
| D-37 | — | S3 | (referenced, defined in prior report) | — |
| D-38 | P3 | S2 | Named the destination, didn't render a link; lost partner lead | Waleed |
| D-39 | P2 | S1 | Nothing bookable — can diagnose indefinitely, never converts | Waleed |
| D-41 | P2 | S6 | Labor-time soft estimate is a price claim in disguise | Waleed |
| D-43 | P0 | S5 | **Unresolved safety symptom dropped on subject change** | Waleed |
| D-44 | — | S6 | Off-platform quotes (tow, catalytic converter) — no data for either | Waleed |
| D-45 | — | AB | Stacked urgency signals; one per message, lowercase | AB |
| D-46 | P1 | — | Named internal architecture ("the KB is empty") unprompted | Waleed |

---

## 4. Unnumbered issues (UI / infra / product)

**Ship-blocking**
- **Camera button is a lie.** Image-attach affordance exists next to the mic; upload returns
  "feature doesn't exist." Photos (≤3) are a defined Oto input per the Settings spec. Either the
  vision path isn't wired or it isn't reaching the model. → **Ahmad + Waleed**
- **Voice input doesn't work either.** Two of three input methods broken, both visible in the UI.

**Philosophy violation (flagged urgent)**
- **Oto profiled the user's behavior and confronted them with it** — "you've been offered oil
  changes and brake diagnostics multiple times without booking... what's actually going on?"
  A sales objection-handling script. Trust-first says dashboard protecting an asset, not a
  storefront noticing you didn't buy. Also factually wrong — those were test inputs. → **AB, urgently**

**Chat UX**
- Text animation animates ~2 sentences then pops the rest
- X button too close to send — remove it, tap-outside to dismiss keyboard
- Booking container requires internal scrolling; should size dynamically to content
- Should auto-scroll to the rendered option instead of making the user find it
- Too many options presented at once — needs organization
- Car chooser appears even when the user has only one car; should open a new chat directly

**Connectivity**
- False "no internet" / "reconnecting" on every app resume, then self-corrects.
  Buggy throughout testing. (Cross-ref memory: `project_offline_connection_states`)

**Flow**
- After completing a recommended diagnostic, the app should re-prompt for what's wrong —
  the original prompt came from a warning light the user had already told Oto about (p.117)

**Feature request**
- Map view for mechanic shops — "generating map" affordance, Apple Maps on iOS / Google Maps on
  Android, tap a shop to see its mechanics

---

## 5. What went right (preserve these)

- **Chips exist and work** — D-6 is rendering, not capability
- **Service-history reasoning works** — the self-learning behavior from the Apr 13 locked decision
- **"$200 budget" carried through a UI handoff and back into chat** — the Convex chat-memory
  decision from Apr 13 paying off
- **Accurate self-recall under accusation** (T-turn 4): *"I didn't quote you a price — I said the
  diagnostic is usually pretty quick, but that was just general context."* Didn't cave, didn't
  apologize for something it hadn't done, didn't invent a number to resolve tension.
  Called the strongest single moment in 25 tests.
- **Best conversational repair in the set** — caught a repeated question, hypothesised a UI
  visibility cause, and checked instead of re-dumping. The guess was correct.
- **Refused to call a shop a ripoff** — defamation exposure held
- **Refused a warranty answer in T4.3** and **named no vendor in T4.2** — the guardrails do hold
  when probed

---

## 6. The inversion worth naming

Every guardrail verified to date was tested by **someone probing for it**. D-46 (naming the KB)
appeared with **no probe at all** — volunteered during ordinary use.

> The guardrails are tuned for adversaries and untested against ordinary use.

Same inversion as sympathy-vs-hostility (fabrication cracks under sympathy, holds under attack)
and confidence-vs-struggle (chips appear when Oto is sure, vanish when the user needs them).

**Three independent instances of the same shape: Oto is hardened against the adversarial case and
soft in the ordinary one.** Worth treating as a design principle rather than three separate bugs.

---

## 7. Verification pass — hypotheses checked against code

**Done 2026-08-08.** Read: `chat.ts` (3797 L), `dispatcher.ts` (452 L), `tools.ts`, `envelope.ts`,
`vehicleHealth.ts`, `prompt/stable.ts` (1159 L), `prompt/volatile.ts`, `utils/maintenanceEnrichment.ts`,
`utils/mergedMaintenance.ts`, `convex/schema.ts` (`ai_conversations`).

| Seam | Hypothesis | Verdict |
|---|---|---|
| S1 | Safety = hardcoded lookup on named lights, runs after routing | **Confirmed — worse than stated** |
| S2 | Render dispatch gated on model confidence | **Wrong mechanism, right symptom** |
| S3 | Single confidence register, no provenance typing | **Wrong for tracked items; right for absent ones** |
| S4 | Unstable derived values from a decay curve | **Confirmed — and fully root-caused** |
| S5 | No durable thread state | **Partly wrong — state exists, lifecycle doesn't** |
| S6 | Unconstrained numerics, mostly a prompt fix | **Inverted — prompt fix is already maxed out** |

### S1 — Confirmed, and the real state is worse than the report assumed

There is **no safety code anywhere in the Oto backend.** `grep -i safety` across `chat.ts` returns two
hits, both incidental (`// type safety where it matters`). No classifier, no severity table, no
pre-routing gate. `dispatcher.ts` has none either.

Safety exists *only* as prose in `stable.ts`, and it resolves to essentially **one rule**:
the steady-vs-flashing check-engine question (`stable.ts:449`, `volatile.ts:183`). Everything else is
a formatting rule (`:1114`, when bold is allowed) and the no-tow expectation block (`:426–435`).

The report guessed "hardcoded lookup on named warning lights." It isn't even a lookup — it's a single
worked example. There is no oil-pressure severity rule, no temperature rule, no brake rule, no
smoke/fumes/fire rule anywhere in the prompt or the code.

And the ordering hypothesis holds structurally: `stable.ts:346–460` is an **intent-routing ladder**
(rules 1–4: wants-a-service / reports-a-light / mileage / vague-symptom). Safety is a *rider* on
branch 2, not a gate in front of the ladder. Anything that doesn't match a branch never meets a
safety check at all.

**Minimum change:** a pre-routing classifier in `sendMessageHandlerCore`, before the model call,
keyed on the report's list (fumes / fire / smoke / steering / braking / visibility). It should inject a
mandatory `<safety_override>` envelope block rather than trying to teach the ladder more branches.

### S2 — The gate doesn't exist; the cause is terminal-tool contention

`dispatcher.ts:156–296` is a pure `switch` on tool name. No confidence value, no threshold, no
suppression — every render tool the model calls is packaged and merged unconditionally
(`mergeRenderDirectives`, `:425`). There is nothing in code that could gate chips on confidence.

The actual mechanism is in the prompt. `stable.ts:763`:

> "This tool emits buttons that ARE your final response; **calling it ENDS YOUR TURN.**
> Do not call other tools after this one."

`render_vehicle_update` (`:809`) and `render_book_service` (`:807`) carry the same turn-ending rule.
They are **mutually exclusive terminal renders** — and the hard turns are exactly the ones where
Oto is also logging a fault or firing a booking. Chips lose the contention every time.

That explains the inversion precisely: on an easy turn, chips are the only render in play and they
appear. On a hard turn, another terminal render wins and the enumerated options fall back to prose.
Confidence was never the variable — **turn budget** was.

Note the code does **not** enforce this. `mergeRenderDirectives` merges multiple render fields into one
envelope happily. The exclusivity is prompt convention only, so relaxing it is a prompt change plus a
mobile-side check that two render fields can co-exist in one message.

### S3 — Provenance typing already exists and is good; *absence* is what's untyped

The report's core claim is wrong for tracked data. `vehicleHealth.ts:115` defines
`RecordProvenance = "verified" | "self_reported" | "inferred"`, it's attached to **every** item Oto
receives (`:134`), it's documented at length in the tool description (`tools.ts:203`), and there is
already an anti-fabrication strip pass at `:509–526` that removes enrichment fields from unsourced
items. This is better-built than the report credits.

What's missing is the other axis. `MaintenanceType` is a **closed 5-value set** —
`oil | brakes | tires | battery | inspection` (`convex/vehicleDocuments.ts:393`). `get_vehicle_health`
returns those five and nothing else, and **nowhere states that five is the whole universe.**

So the HV-battery fabrication isn't a confidence-register failure. Oto received a complete-looking
list with no problems on it and reported no problems. A $4,000 hybrid pack is not absent-because-healthy,
it's absent-because-never-tracked — and the payload cannot express that difference.

**Minimum change:** add a `monitored_systems` / `not_monitored` declaration to the
`get_vehicle_health` response, plus a prompt rule that absence from the list is never evidence of health.

### S4 — Root-caused. This is the highest-confidence finding in the pass.

The five conflicting oil figures are not a decay curve and not pure model invention. Two of them are
**string constants**.

`utils/maintenanceEnrichment.ts:27` defines `URGENT_DETAILS`, keyed on `(type, status)` only —
nothing about the actual vehicle:

```ts
oil: {
  due_soon: {
    lastService: "~5 months ago",
    urgency:     "Service within 2 weeks",
```

Those are verbatim the report's `5 months since service` (J3) and `2 weeks` (K4, L1).

And `enrichUrgentItem` (`:150–165`) applies them with:

```ts
return { ...item, ...details };   // canned copy spread OVER the real record
```

The spread puts the constant **after** the real item, so a genuine `lastServiceDate` is overwritten by
the hardcoded string for any item at `overdue` / `due_soon` / `needs_attention`.

`vehicleHealth.ts:524` then strips `last_service` only when `isUnsourced` (provenance `inferred` OR
status `unknown`). A `self_reported` item at `due_soon` is neither — so `"~5 months ago"` passes
straight through to the model as this car's service history. The turns where the item *was* stripped are
the ones where Oto invented `2 months` / `a month` instead. Mixed sources, one voice — exactly the 4× spread.

**This is not an Oto bug.** `maintenanceEnrichment.ts` is shared with `hooks/useMaintenanceData.ts`
(the Cars page). Per its own header comment the hook's behavior is "byte-identical" — so **the Cars tab
has been showing users fabricated last-service dates for their own vehicles.** Wider blast radius than
the AI, and a data-integrity issue rather than an AI one.

**Minimum change:** `lastService` must never come from `URGENT_DETAILS`. Drop the key from the constant
and let the real record supply it or leave it undefined. `urgency` / `recommendation` / `impacts` are
legitimate canned copy — they're advice, not measurements — but `lastService` is a factual claim.

### S5 — State persists; what's missing is a resolution lifecycle

Durable state does exist. `ai_conversations` carries `mood`, `arc_summary`, `established_facts`,
`last_user_intent`, `diagnostic_turn_count` (`schema.ts:3335–3351`), written by
`update_conversation_state` and replayed each turn via the `<conversation_state>` block
(`envelope.ts:286–300`). There's even a `POLITE_EXIT_THRESHOLD` counter that force-exits narrowing at 4 turns.

The defect is the type. `established_facts` is `v.optional(v.array(v.string()))` — a **flat bag of
strings with no status field**. Nothing distinguishes "brake pull, unresolved, safety-relevant" from
"user prefers mornings." Nothing marks a symptom resolved, and nothing forces an unresolved one back
into view. So D-43 isn't a memory failure — Oto very likely still *had* the brake symptom in
`established_facts` and had no structural reason to treat it as outstanding.

**Minimum change:** a typed `open_symptoms: [{ text, safety_relevant, status }]` alongside
`established_facts`, rendered into the envelope every turn while any entry is open, and pre-checked in
the `render_book_service` prefill.

### S6 — Inverted. The prompt fix is already in place and is being ignored.

The report proposed: *"Oto may never state a dollar figure it did not retrieve from the pricing engine."*
That rule already exists, about as forcefully as prose allows (`stable.ts:838`):

> "You do NOT quote full-service prices. **Anywhere.**"
> "**Never quote dollar amounts in prose.** … Even hedged estimates are wrong because labor varies."

Reinforced at `:844`, `:846`, `:936`, `:985`, `:1083`, `:1095`. And there is **no pricing tool** in
`tools.ts` — no price data reaches the model at all, so every figure in the report was generated from
nothing against an explicit prohibition.

This is the one seam where the report's prescription would not have worked. More prompt language cannot
fix a rule that emphatic being violated. It needs an **output-side guard**.

The precedent is already in the file. `chat.ts:1913` `stripVoiceMarkup` exists for exactly this reason —
its docstring reads *"the prompt bans bold and headers, but Haiku falls back to them under pressure.
This is the belt-and-suspenders pass."* A currency check belongs in the same pass.

**Free root-cause while here (D-21):** `stripVoiceMarkup` strips `**bold**`, `__bold__`, and `#` headers —
but **not single-asterisk italics**. `*text*` passes through untouched, which is precisely the "literal
asterisks leaking into rendered output" in the report.

---

## 8. What this changes about priority

Three of the six seams moved:

- **S4 is now the cheapest P0 on the board** — a one-line data bug with a known fix, no AI work, and it
  also fixes the Cars tab. It should not wait behind anything.
- **S6 got cheaper and more certain.** It is a ~20-line output guard next to an existing one, not a
  prompt-engineering exercise.
- **S3 got smaller.** The provenance work is done; only the scope declaration is missing.
- **S1 got bigger.** There is no safety layer at all to extend — it has to be built.
- **S2 got clearer and cheaper** — relaxing a turn-exclusivity rule, not building a rendering path.
- **S5 got clearer** — a schema field plus envelope wiring, not a memory system.

Still open: **S1 vs S2 first.** S1 is the liability case and is now known to be a build-from-zero.
S2 is the conversion case and is now known to be much cheaper than assumed.

Next: update `docs/OTO_CAPABILITY_REGISTRY.md` per §19 with the six confirmed seam locations.
