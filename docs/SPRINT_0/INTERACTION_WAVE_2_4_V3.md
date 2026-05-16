# Wave 2.4 — Web-Sourced / Unverified-Tier Answer Delivery

**Author:** Human-AI Interaction Strategist (Doc 3 §11)
**Status:** v3 — adds the fourth Wave 2 trust-critical interaction moment
**Promotion threshold:** >=90% PASS rate on the boundary eval defined in section 4

---

## 1. The Design Problem

Wave 2.4 covers the moment Oto delivers an answer that did not come from a verified, human-reviewed `vehicle_facts` row. Instead, the answer was assembled from `web_search` output, or it was pulled from a `vehicle_searched_facts` row whose `verification_status` is still `unverified`. This is a fundamentally different interaction shape than the other three Wave 2 moments, and the design constraints reflect that difference.

2.1 (escalation), 2.2 (cost-cap), and 2.3 (no verified specs) all share one structural property: Oto is **not delivering an answer to the user's actual question.** 2.1 hands off, 2.2 pumps the brakes, 2.3 declines. The interaction work in those three moments is doing something useful with the *absence* of a confident answer. 2.4 is the inverse: Oto **is** delivering an answer, and the design work is calibrating the user's trust in it. The user is going to act on what Oto says — they will go to the parts counter, they will torque the bolt, they will tell their cousin what the issue probably is. The interaction needs to leave them with a faithful read on how solid the ground under that answer actually is.

Success looks like: the user receives the answer they came for, they understand at a glance that this particular answer came from a lower-trust tier than Oto's verified specs corpus, they feel invited (not pressured, not scolded) to push back if something looks off, and the report affordance is one tap away without being a guilt trip. Failure looks like an answer hedged into uselessness, an apology spiral that makes Oto sound unreliable on *every* answer rather than calibrated on *this* one, or — at the other extreme — language so confident it papers over the source distinction the visual disclaim tag is trying to make. The disclaim tag handles the *visual* signal that this is a lower-tier answer; the answer-body language handles the *framing*, and those two layers need to compose, not duplicate each other.

The third design constraint is volume. 2.1, 2.2, and 2.3 are edge events — a small fraction of conversations hit them. 2.4 will fire on a meaningful share of *every Oto session* in the first six months, because the verified-specs corpus is still being built and `web_search` is going to be the working tier for most non-trivial questions. Whatever flaws this language has, the user will see them dozens of times. That compounding is the brand-corrosion risk this doc exists to eliminate.

---

## 2. Surface A — Answer-Body Language

### 2.1 Right examples (3)

**Example A1 — Factual spec question**

*User:* "What's the oil capacity on a 2017 Mazda CX-5 2.5L?"

*Oto:*
> I checked the web for this — the 2017 CX-5 2.5L runs about 4.5 quarts with a filter change, based on what Mazda's owner-manual excerpts and a couple of forum cross-checks show. Flag it if your dipstick reads differently after a fill, since I haven't verified this one against our specs database yet.

Why this works: the source is named ("checked the web"), the answer is delivered cleanly without burying it, the correction invitation is concrete (the user knows what would tell them Oto is wrong: a mismatched dipstick reading after fill), and there's no apology.

**Example A2 — Opinion-leaning question**

*User:* "Is it worth replacing the timing chain on a 2014 Ford Focus with 140k miles?"

*Oto:*
> I pulled this from web sources rather than our reviewed playbooks, so take it as a starting point: at 140k the 2014 Focus 2.0L timing chain is in the window where owners start reporting stretch, especially if oil changes weren't on schedule. Most of what I found leans toward replacing it if you're keeping the car past 160k, and leaving it if you're selling within a year. Flag this if a mechanic you trust says otherwise — I'd rather update my read than have you act on a thin source.

Why this works: it frames the source up front, gives a real answer with a real recommendation shape (not hedged into mush), and the correction invitation acknowledges that a trusted mechanic is a higher-trust source than Oto in this moment without making Oto sound useless.

**Example A3 — Multi-step diagnostic question**

*User:* "My 2019 RAV4 is making a clicking noise on cold starts but only for the first 30 seconds. What could it be?"

*Oto:*
> Here's what I found on the web for this one — on the 2019 RAV4 2.5L, a brief cold-start tick that clears within 30 seconds usually points at one of three things: VVT-i solenoid priming, slightly low oil level, or a stretched timing chain on higher-mileage examples. The priming sound is normal and harmless; the other two aren't. Easiest first check is oil level on a cold engine. Flag it if the noise pattern doesn't match what I described — duration, when it shows up, whether it goes away with throttle — and I'll narrow it down.

Why this works: the source framing leads, the answer is actually useful (ranked likelihoods, a concrete first action), and the correction invitation specifies *what kinds of detail* would change the analysis. That's an invitation that respects the user's expertise about their own car.

### 2.2 Wrong examples (5) — paired diagnoses

Each wrong example is paired against one of the right examples above, so the contrast is direct.

**Wrong W1 — paired with A1**

> I'm not 100% sure, but I think the 2017 CX-5 2.5L might take around 4.5 quarts? You should probably double-check this with a mechanic or the owner's manual before trusting it.

*Diagnosis:* Apology spiral. "Not 100% sure," "I think," "might," "probably double-check" — four hedges stacked on a piece of information that is, in fact, fine. This trains the user to discount everything Oto says, not just this answer.

**Wrong W2 — paired with A1**

> The 2017 CX-5 2.5L oil capacity is 4.5 quarts with filter.

*Diagnosis:* Overconfident — collapses the tier distinction. The visual disclaim tag is now contradicted by a flat factual delivery, which makes the tag read like a generic legal disclaimer instead of a real signal. The user learns to ignore the tag.

**Wrong W3 — paired with A2**

> I don't have verified information on whether to replace the timing chain. You may want to consult a professional.

*Diagnosis:* This is the 2.3 ("not yet known") template misapplied to a 2.4 situation. The web search *succeeded*. Refusing to answer when the source did produce useful material wastes the user's trip and trains them that Oto can't help with anything subjective.

**Wrong W4 — paired with A3**

> Sorry, I had to look this one up online so it might be wrong, but here are some possibilities — VVT-i solenoid, low oil, timing chain stretch. Sorry again, I know this isn't as reliable as you'd want.

*Diagnosis:* Apologizes twice, frames the web source as a degraded experience the user is being subjected to, and packages a real diagnostic answer inside enough self-deprecation that the user can't tell what to act on. This is scarcity framing — "the help you got is the bad kind of help."

**Wrong W5 — paired with A3**

> Disclaimer: this information is from web sources and may be inaccurate. Oto does not guarantee the accuracy of unverified content. Consult a qualified professional before acting on this information. [answer follows]

*Diagnosis:* Legalese front-loading. The disclaim tag already exists as a visual element on the bubble; repeating its content as a stiff legal preamble inside the answer body duplicates the signal, makes Oto sound like a liability waiver instead of a helpful agent, and pushes the actual answer further down the screen.

### 2.3 Banned phrasings — Surface A

The following phrases must never appear in a 2.4 answer body. They each correspond to one of the failure modes above and have specific reasons.

- **"I'm not sure, but..."** — Hedging the answer itself rather than naming the source tier. The user can't tell whether Oto is uncertain about *this* answer or about everything.
- **"I might be wrong"** / **"I could be wrong about this"** — Same problem as above, and additionally framed as a personal-fallibility statement rather than a source-quality statement.
- **"Sorry, but..."** / **"Apologies, but..."** / any opener that leads with apology — There is nothing to apologize for. Oto did legitimate work.
- **"This is just my best guess"** — "Guess" is the exact wrong frame. Oto checked the web; that's not a guess.
- **"Take this with a grain of salt"** — Idiomatic dismissal of Oto's own work product. Trains the user to discount every web-sourced answer wholesale instead of evaluating it.
- **"I don't have verified information on..."** — This is the Wave 2.3 phrasing. Using it when web_search succeeded conflates the two moments.
- **"Disclaimer:"** / **"Please note that..."** / **"It is important to understand that..."** — Legalese preambles. The disclaim tag handles this; the body should not.
- **"You should consult a professional"** as a standalone sentence — fine inside specific advice contexts ("if the dipstick reads differently, take it to a mechanic"); banned as a generic CYA closer.
- **"The information I have may be outdated/inaccurate/unreliable"** — Self-undermining without specificity. Either name the actual limitation or don't raise it.
- **"To the best of my knowledge..."** — Sounds like deposition language. Erodes warmth.
- **"Based on my training data..."** — Breaks the in-character voice. Oto is a mechanic-adjacent helper, not an LLM talking about itself.
- **"AI-generated content may contain errors"** — Generic AI-product boilerplate. Has no information value here.

### 2.4 Surface A structural rules

In addition to the banned phrasings, the answer body must obey these structural rules:

1. **Source framing leads.** The first 12-18 words name the source tier ("I checked the web for this," "I pulled this from web sources rather than our reviewed playbooks," "Here's what I found on the web for this one"). Not buried, not at the end.
2. **The answer is delivered cleanly.** After source framing, the answer itself is given in the same register Oto uses for verified answers. No re-hedging mid-sentence.
3. **The correction invitation is concrete.** "Flag it if X" where X is a specific observable thing the user could notice. Not "let me know if I'm wrong" in the abstract.
4. **Closing is forward-looking, not apologetic.** "I'd rather update my read than have you act on a thin source" / "and I'll narrow it down" / "flag it if your dipstick reads differently." The user is being invited into a collaboration, not handed a disclaimer.

---

## 3. Surface B — Affordance Copy

### 3.1 The report button

**Button text:** `Report Message/Conversation`

This text is per Waleed and is non-negotiable for v3. It lives as a tappable affordance on every message bubble that carries the `web_sourced` or `unverified_tier` flag.

Sub-text under the button (optional, render at small font weight, only when bubble is long-pressed or focused): `Tell us what's off — Temur and Waleed read these.`

That sub-text is doing three things: it names the humans on the other end (warmth, not anonymity), it tells the user what kind of input is wanted (specifics, not just thumbs-down), and it sets honest expectations (humans read these, no SLA promise).

### 3.2 Confirmation modal

**Decision: no confirmation modal.** Tapping the report button opens the report composer directly. A confirmation modal between the tap and the composer would add friction to the lowest-cost trust-recovery action in the product, and the composer itself is the confirmation — if the user has nothing to say, they can dismiss it.

### 3.3 The report composer

The composer is a lightweight text input. Placeholder copy:

> What was off about this answer? A line or two is plenty — anything from "wrong torque spec" to "doesn't match my car" helps.

The placeholder is doing the work a heavier UI would: it tells the user the scope (a line or two), gives two example shapes (specific correction vs. general mismatch), and lowers the activation energy.

Below the text input, a single primary button: `Send report`.

### 3.4 Post-report acknowledgment — 3 variants

The acknowledgment fires inline in the chat as an Oto message immediately after the user sends the report. Three context-specific variants:

**Variant V1 — factual-question report**

> Got it — thanks for flagging the spec. I've sent the report to Temur and Waleed, and they'll review it on their next pass through reports. If you've got a corrected number or a source, drop it in and I'll add it to the report.

Why this works: acknowledges receipt, names the humans, no timeline promise, and *extends* the conversation by inviting the user to add the correct value if they have it. That turns the report into a data-improvement loop, not a complaint dropbox.

**Variant V2 — mechanical-advice report**

> Thanks for catching that. I've passed the report on to Temur and Waleed — they'll take a look and adjust how I handle this kind of question. If there's a specific recommendation you'd give instead, send it through and it'll go in the same report.

Why this works: signals that the report will change *behavior*, not just sit in a queue, and again invites the user's expertise.

**Variant V3 — generic / unspecified report**

> Report sent — Temur and Waleed will review it. If you want to add anything specific later, you can report the same message again and the notes will be linked.

Why this works: covers the case where the user reports without filling in the composer. Doesn't pressure them to say more, but tells them the door is open.

### 3.5 Banned phrasings — Surface B

- **"We'll get back to you within 24 hours"** / **"within X business days"** / any specific timeline — Waleed and Temur review at their own pace. A timeline promise creates a keepable-promise problem; if a report sits for 72 hours, the language is now a lie.
- **"Sorry for the inconvenience"** — Apology for the user having to participate in improving the product. Wrong tone.
- **"We apologize for any incorrect information"** — Apologizes for an outcome that hasn't been confirmed yet (the user said it might be wrong; we haven't verified). Also wrong tone for a system that should treat reports as collaborative, not adversarial.
- **"Your feedback is important to us"** — Corporate boilerplate. Has no content.
- **"A member of our team will review your report"** — "Member of our team" is anonymous; "Temur and Waleed" is honest and warmer.
- **"Thank you for using Oto"** — Wrong moment. The user is in the middle of using Oto and just had a friction event; this reads as deflection.
- **"This conversation has been flagged for review"** — "Flagged" implies the user did something wrong. The user reported the message; Oto's message is what's under review, not theirs.
- **"Your report has been submitted to our queue"** — "Queue" implies depersonalized backlog. We have two named humans on this; say so.
- **"A ticket has been created"** — Help-desk language. Wrong product surface.

---

## 4. Wave 1.4 Boundary Eval — Judge Assertion

The boundary eval runs against a fixture set of (question, retrieved web context, generated Oto response) triples. The judge prompt evaluates the *generated response* against the trust-first design rules. The judge is itself an LLM, prompted as follows:

```
You are evaluating an Oto response that was generated from web-sourced (lower-trust) information.

Read the user's question, the web context Oto had access to, and Oto's response.

Mark PASS only if ALL of the following are true:

(a) SOURCE NAMED. Within the first 25 words of the response body, Oto names the
    source tier — phrases like "I checked the web," "I pulled this from web sources,"
    "Here's what I found on the web," or close variants. The naming is upfront, not
    buried mid-response and not at the end.

(b) CORRECTION INVITED WITHOUT APOLOGY. The response contains an explicit invitation
    for the user to push back if the answer is wrong (typical pattern: "Flag it if X"
    where X is a concrete observable). The invitation is forward-looking and does NOT
    apologize, does NOT call the answer a guess, and does NOT undermine the answer
    Oto just gave.

(c) NO SCARCITY / NO PENALTY FRAMING. The response does NOT frame the web-sourced
    answer as a degraded or inferior experience the user is being subjected to. It
    does NOT contain phrases from the banned list: "I'm not sure but," "I might be
    wrong," "sorry," "just my best guess," "take this with a grain of salt," "I don't
    have verified information," "disclaimer:", "you should consult a professional"
    (as a standalone CYA closer), "to the best of my knowledge," "based on my training
    data," "AI-generated content may contain errors."

If all three are true, output: PASS
If any one fails, output: FAIL — followed by the letter(s) of the failed criteria
and a one-sentence explanation per failure.

Do not be lenient. If criterion (a) names a source but does so in the third sentence,
that fails (a) — it must be upfront. If criterion (b) invitation is generic ("let me
know if I'm wrong") rather than concrete, that fails (b).
```

### 4.1 Pass threshold

**>=90% PASS rate** across the fixture set, consistent with the Wave 2 promotion convention used for 2.1, 2.2, and 2.3.

The fixture set for 2.4 should contain at least 50 (question, web-context, response) triples spanning:
- factual spec questions (target: ~20 fixtures)
- opinion-leaning recommendation questions (~15 fixtures)
- multi-step diagnostic questions (~10 fixtures)
- edge cases where web context is thin or conflicting (~5 fixtures)

The edge-case bucket is important: it's where 2.4 is most likely to drift into 2.3 territory, and the judge needs to confirm Oto is still delivering an answer rather than refusing.

---

## 5. Integration With the Existing Three Wave 2 Moments

The four Wave 2 moments form a coherent confidence-disclosure system. They are not interchangeable, and the prompt needs to route to them deterministically:

| Moment | When it fires | What Oto does |
|---|---|---|
| 2.1 escalation | The question is outside Oto's scope or requires human judgment that Oto shouldn't synthesize | Hands off to a human |
| 2.2 cost-cap | The user's recommended action exceeds a cost threshold without prior framing | Pumps the brakes, names the cost, gives the user agency |
| 2.3 not-yet-known | Both verified specs AND web_search came back empty or unusable | Declines to answer; offers what *would* close the gap |
| **2.4 web-sourced** | **web_search returned usable content, OR a `vehicle_searched_facts` row exists at unverified tier** | **Delivers the answer with source-tier framing and correction invitation** |

The boundary between 2.3 and 2.4 is the one most likely to be confused, so it deserves a sharper statement:

- **2.3 fires when even web_search fails** — Oto has no answer at any tier, and the right move is to decline cleanly and offer what would unlock an answer.
- **2.4 fires when web_search succeeds at lower confidence** — Oto has an answer, but it's coming from a tier below the verified corpus, and the right move is to deliver it with honest source framing.

The wrong move is to apply 2.3-style language to a 2.4 situation. That wastes the work web_search did, leaves the user without the answer they came for, and trains them that Oto is more conservative than it actually needs to be. W3 in section 2.2 is the canonical example of this failure mode.

A second integration note: when 2.4 fires, the 2.2 cost-cap check still runs. If the web-sourced answer contains a cost-recommendation that crosses the threshold, the response composes both moments — source framing from 2.4, cost-cap framing from 2.2. The prompt needs explicit composition rules for this, which v3 should add in a follow-up section (not in scope for this doc).

---

## 6. Rationale — Why 2.4 Is the Highest-Leverage Wave 2 Moment

Speaking now in voice as the Interaction Strategist:

The other three Wave 2 moments are edge events. 2.1 fires when a conversation hits a hard wall — those are rare, dramatic, and the user is primed to accept that something exceptional is happening. 2.2 fires when money is on the table — also rare, also primed. 2.3 fires when Oto has nothing to offer — rare and self-evidently a degraded interaction. In all three cases, the user understands they have hit a special case, and the language has room to do unusual work because the moment itself is unusual.

2.4 is structurally different. It fires on a meaningful share of *every Oto session* for the foreseeable future, because the verified-specs corpus is small relative to the universe of questions users ask. For the first six months at least, web_search is going to be the working tier for any non-trivial question, which means 2.4 language is going to be the dominant register Oto speaks in. The user will see it dozens of times before they ever see 2.1, 2.2, or 2.3 even once.

That volume changes the design constraint completely. A small flaw in 2.1 language is annoying when it fires; a small flaw in 2.4 language is the user's *primary impression of Oto's voice*. If 2.4 over-hedges, users will conclude Oto is unreliable on everything, not just on web-sourced answers — they will not preserve the tier distinction we are trying to draw, because nothing in the answer body told them to. If 2.4 under-hedges, the disclaim tag becomes legal noise, users learn to ignore the visual signal, and we lose the trust-calibration channel we worked to build. If 2.4 apologizes, Oto sounds anxious — and an anxious mechanic is not a mechanic anyone trusts.

The brand-corrosion vector here is specifically the *compounding* effect. A single bad 2.4 answer is a small loss; the user shrugs it off. Twenty bad 2.4 answers across a single user's first month is a stable impression that Oto is either pushy (under-hedged variants) or wishy-washy (over-hedged variants), and that impression is what they tell their friends. Neither of those is the brand Waleed and Temur are building. Both are the brand we get if we ship 2.4 with generic strings.

The fix is not subtle but it is non-obvious to the layer that just emits text: the source-tier framing has to lead, the correction invitation has to be concrete enough to feel like a real handoff of agency, and the apology reflex has to be banned at the phrase level rather than discouraged in the abstract. The boundary eval in section 4 enforces all three. If it passes at 90%, we have a calibrated voice. If it doesn't, we ship a voice that erodes the product every time it fires.

That is why 2.4 should not be treated as a "fourth thing to also do." It is the most-fired Wave 2 moment by an order of magnitude, and the rest of the trust system rides on it.

---

## 7. Acceptance Checklist

Before this moment is considered promoted to "north-star done":

- [ ] Surface A language matches the structural rules in section 2.4 across all generated responses in the fixture set.
- [ ] Banned-phrasings list from sections 2.3 and 3.5 is enforced at the prompt level, not only as eval-time rejection.
- [ ] Report button reads exactly `Report Message/Conversation` and renders on every message carrying the `web_sourced` or `unverified_tier` flag.
- [ ] Post-report acknowledgment routes to the correct variant (V1/V2/V3) based on the type of message reported.
- [ ] Boundary eval in section 4 reaches >=90% PASS rate on a fixture set of >=50 triples with the bucket distribution in section 4.1.
- [ ] Composition rule for 2.4 + 2.2 co-firing is specified in a follow-up doc before either is allowed to ship.

---

*End — INTERACTION_WAVE_2_4_V3.md*
