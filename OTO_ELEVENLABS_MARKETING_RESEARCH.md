# Oto + ElevenLabs — Marketing Website Voice Agent

**Audience:** Waleed / OtoPair leadership
**Purpose:** Should we put an "Oto" voice agent on the OtoPair flagship marketing site, powered by ElevenLabs? What does it cost, what does it look like, what does it ship in?
**Authoring date:** 2026-05-18
**Sources at end.** Live ElevenLabs docs + pricing reviewed.

---

## TL;DR

**Yes — this is a strong marketing play, and ElevenLabs is the right vendor.** You can ship a credible "talk to Oto on our website" demo in 1–2 weeks (Option A below) that:

- Picks up the phone (figuratively) with sub-500ms first-turn latency, which feels uncannily human.
- Answers ~80% of common car-owner questions ("what does this warning light mean", "is squealing serious", "how often should I rotate tires") using ElevenLabs' built-in RAG over a curated Otopair knowledge base.
- Demonstrates Oto's personality — the same "calm expert concierge" voice you've been tuning in the mobile app — without needing to wire up Convex, Clerk auth, or 24 production tools.
- Captures leads (email / phone / "text me the app") at the moment the visitor is most engaged.
- Costs $0.08–$0.12 per visitor-minute. For a marketing site at 1,000 monthly demo conversations averaging 3 minutes, that's **$240–$360/mo** in ElevenLabs spend — trivial compared to the conversion lift if it works.

**The strategic angle:** ElevenLabs voice quality is the closest thing to "talking to a real shop advisor" anywhere on the market today. Putting that on your marketing page is a category-defining experience for an automotive product. Your competitors have static text. You'd have a voice that listens, interrupts, and reasons.

**Two things to decide:**

1. **Option A** (pure ElevenLabs — knowledge base + their LLM) for a fast MVP, OR **Option B** (hybrid — ElevenLabs handles voice, your Convex action handles brains, full Oto parity).
2. **Voice choice** — pick from ElevenLabs' premade library (free, generic) OR commission a custom Oto voice ($300–$1500 one-time, brand-defining).

Recommended: **Option A for v1 ship + custom voice. Migrate to Option B for v2 once the demo proves itself.**

---

## 1. ElevenLabs capability map (as of May 2026)

ElevenLabs rebranded their conversational product to **"ElevenAgents"** (formerly "Conversational AI"). The platform delivers four integrated pieces:

| Component | What it does | Why it matters for OtoPair |
|---|---|---|
| **Voice synthesis (TTS)** | Ultra-realistic neural voices, 70+ languages, sub-100ms generation latency | Premium product impression on first contact |
| **Speech-to-Text (Scribe)** | Custom ASR, <100ms latency vs ~300ms for Whisper | Conversations feel responsive, not laggy |
| **Turn-taking model** | Proprietary model handles pauses, interruptions, natural rhythm | Visitor can interrupt, ask follow-ups, talk over Oto naturally |
| **LLM orchestration** | Pick from GPT-4o, Claude 3.7 Sonnet, GPT-3.5-turbo, or BYO custom LLM | Lets you choose cost/quality trade-off OR plug in your own Convex backend |

**The 4-tier latency stack:**
- First-turn latency: **<500ms** (industry-leading; OpenAI Realtime is ~800ms)
- TTS-only latency: **~75–100ms**
- ASR-only latency: **<100ms**

For comparison, the original Brief's behavioral goals (calm concierge, doesn't push, listens carefully) map well to ElevenLabs' premium tier — slower-paced, more deliberate voice = perceived as more trustworthy.

### 1.1 Function calling / tools

ElevenAgents supports three integration mechanisms:

1. **Webhook tools** — agent makes HTTP calls mid-conversation to external endpoints. Standard request/response shape. Use for lead capture, CRM writes, calendar lookups.
2. **MCP server connections** — agent can connect to any MCP server you operate, getting access to whatever tools that MCP exposes. Direct parallel to what we use in Claude Desktop.
3. **System tools** — built-in primitives for common patterns (end_call, transfer_to_human, schedule_callback).

For an OtoPair marketing demo, webhook tools are likely all you need (1 webhook for lead capture, maybe a 2nd for "find nearest shop"). MCP is overkill for marketing but available if you scale.

### 1.2 Knowledge base / RAG

ElevenAgents has **built-in RAG** out of the box:

- **Sources:** Upload PDFs, TXT, DOCX, HTML, EPUB; OR paste URLs (they scrape); OR paste raw text.
- **Indexing:** Automatic embedding + vector store on upload. Indexes in minutes for typical document sizes.
- **Retrieval:** Configurable embedding model, max chunks per query, max vector distance threshold.
- **Re-index:** Manual today. They've announced auto-reindex coming.

**Limitations to know:**
- **No recursive URL scraping today.** If you paste `otopair.com/services`, it scrapes that page only — not its links. You'd need to feed individual URLs OR upload sitemap-derived content.
- **No streaming updates.** You re-upload + reindex when content changes.

For a marketing demo, you'd build a knowledge base from:
- Otopair marketing pages (services, pricing transparency, FAQ)
- A curated set of car-maintenance Q&A you already write internally
- Optionally a digest of Oto's `stable.ts` prompt as ground-truth on personality + scope
- (Optionally) per-popular-vehicle data — top 50 most-asked-about cars in your demographic

### 1.3 Custom LLM (the hybrid path)

ElevenAgents has a **"Custom LLM URL"** setting. You point it at any HTTP endpoint that speaks OpenAI's Chat Completions API format. The agent then routes its brain calls to your endpoint.

**What this unlocks for OtoPair:**

You can wrap your existing `convex/oto/chat.ts` action in a thin OpenAI-shaped adapter and let ElevenAgents call IT instead of GPT-4o or Claude. The agent inherits your full Oto behavior — all 24 tools, the prompt, the trust gates, the memory — while ElevenLabs handles voice in/out.

The adapter is small (50–100 LoC of TypeScript): receive OpenAI-format `messages[]`, translate to Oto's input shape, call `api.oto.chat.sendMessage`, translate the response back to OpenAI streaming format. Convex actions can serve HTTP via `httpAction`, so the endpoint stays on Convex.

This is **Option B** below. It's the right long-term play. Save it for v2.

### 1.4 Widget embed for the marketing site

Three ways to put the agent on `otopair.com`:

| Method | Effort | Customization | When to use |
|---|---|---|---|
| **CDN web component** — drop `<elevenlabs-convai agent-id="...">` into HTML, load script from `unpkg`. Done. | Lowest (15 min) | Limited to widget attributes (avatar, button text, colors via CSS) | MVP, A/B testing different placements |
| **`@elevenlabs/react` SDK** — npm install, drop in a React component. | Low (couple hours) | Full styling control, custom UI around the conversation | When your marketing site is React/Next.js (it is) |
| **Custom integration via `@elevenlabs/client`** — speak the WebSocket protocol directly. | Medium (1–2 days) | Total control over UX, custom animations, native-feel | When you want the voice agent to FEEL like part of the page, not a chat bubble |

For OtoPair flagship marketing site, I'd recommend the React SDK with custom UI — drop the canned chat bubble and instead make the agent feel like a co-pilot button that activates when scrolled past the hero, sits inline with content, and visually morphs as it listens/speaks.

### 1.5 Multimodal — voice AND text

The widget supports both voice and text input in the same session. Visitors who don't want to talk (in public, in a meeting, etc.) can type. Same agent, same context. The data flows through the same place.

This matters for an automotive product because real-world testing scenarios include people in cars (voice natural) and people on lunch break at their desk (text more practical).

### 1.6 Testing / simulation

ElevenAgents has a built-in agent simulation tool — run the agent against scripted conversations or past transcripts, check whether tool calls fired correctly, whether responses met success criteria, ALL before deploy. This is unusual for vendor platforms and aligns well with the eval-discipline approach you've built into the mobile Oto.

---

## 2. ElevenLabs vs current Oto (production mobile)

Apples-to-apples comparison. Mobile Oto is more capable; the question is what you NEED for marketing.

| Capability | Mobile Oto today | ElevenLabs marketing demo (Option A) | Gap matters for marketing? |
|---|---|---|---|
| **Voice in/out** | None (text only via mic transcription → text-only chat) | Yes — full duplex voice with sub-500ms turn latency | ✓ This is the entire point |
| **LLM** | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Choice of GPT-4o, Claude 3.7 Sonnet, GPT-3.5, or custom | Roughly equivalent; Claude 3.7 Sonnet probably best match for the same "calm concierge" tone |
| **Tool surface** | 24 tools (vehicle facts, health, bookings, KB, loyalty, etc.) | Webhook tools — you can wire as many as you want | Marketing doesn't need 24. 2–3 will do |
| **Vehicle knowledge** | Real Convex `vehicle_facts` KB + 3-tier cascade + web search | RAG over your curated knowledge base | Acceptable for marketing — you'd seed it with the top 50 vehicles' specs |
| **Memory** | Wave-3 cross-conv memory, decay, user_semantic_facts | Per-conversation only (no cross-visitor memory) | Marketing visitors are mostly first-time anyway — no memory expected |
| **Auth / user accounts** | Clerk → Convex users table | Anonymous (no login) | Marketing should be no-friction — anonymous is right |
| **Real bookings** | render_book_service flow → mobile component → Stripe | None — replace with lead-capture webhook ("text me when this is available", "email me a quote") | Marketing pages don't book — they convert. Lead capture is the right CTA |
| **Render directives** | 7 render tools (book_service, record_confirmation, link_button, etc.) | Voice only + optional widget UI | None of those map to a marketing-site UX anyway |
| **Trust gates** | render_record_confirmation, polite-exit, F1 fallback logic | Out of scope (no user data to trust-gate against) | Not needed for marketing |
| **Telemetry** | oto_telemetry, conversation_audit, reliability_events | ElevenLabs dashboard + simulation history | ElevenLabs' observability is fine for marketing scope |
| **Eval harness** | scripts/eval/ wave_5_1_harness.ts + oto-eval-cases.json | ElevenAgents simulation tool | Theirs is less rigorous than yours, but adequate for marketing |
| **Cost model** | Per-Anthropic-token + Convex compute | $0.08–$0.12/min + LLM tokens | Marketing budget is willing to pay per-conversation; mobile is amortized differently |

**The asymmetry that matters:** Mobile Oto has 18+ months of tuning, real user data, deep tool integration. Marketing Oto needs 90 days of tuning, no real users (just visitors), shallow tool integration. **The two products serve different jobs.** Don't try to make the marketing demo into a full mobile Oto — that's a year of work for marginal marketing return.

---

## 3. The marketing demo — design

### 3.1 What the marketing-site Oto SHOULD do

Three primary jobs, ranked by frequency:

1. **Answer "what does X mean?"** — warning lights, weird noises, smells, vibrations. Generic enough to RAG over. This is the meat of value.
2. **Demo the diagnostic conversation style** — show the "calm concierge" personality in action. Visitor asks "my brakes squeal when I stop", agent responds with the SAME tone as mobile Oto (one splitting question, no upsell, real reasoning). This is the brand.
3. **Capture intent** — "Want this on your car all the time? Download the app / get a text reminder / let me email you our nearest shop." Conversion to lead OR app install.

Secondary jobs:
4. Spec lookup for ~50 most-popular vehicles ("What oil does a 2020 Toyota Camry take?"). Acceptable to hardcode in the RAG knowledge base.
5. Pricing transparency questions ("How does your 7% fee work?", "What's a fair price for X service?"). Anchored in your existing Otopair marketing copy.
6. Trust-building ("Why should I use OtoPair vs. dealer / vs. local shop"). Reinforce the value prop conversationally.

### 3.2 What it should NOT do

- **No real bookings.** Don't try to wire Stripe + mechanic availability into a marketing demo. Lead capture only.
- **No real user-specific data.** Don't pretend to know "your" car. Visitor is anonymous; agent can ask year/make/model conversationally and use that within the session only.
- **No cross-session memory.** Each visitor gets a fresh agent. Don't try to remember "John was here last week."
- **No real diagnostics that imply liability.** "I can't tell you to drive on that — get it checked by a real mechanic" is the right disclaimer. Marketing demo, not medical advice.

### 3.3 Voice + persona

ElevenLabs has thousands of premade voices in their library. For OtoPair, you want:

- **Gender + age:** matters less than tone. The mobile Oto is gender-neutral in prompt; voice can lean either way.
- **Accent:** US accent for primary market. (Multilingual support is there for later expansion.)
- **Pace:** slower than typical voice agents. Premium ($0.12/min) tier with intentional pacing reads as "trustworthy expert" instead of "rushed call center".
- **Warmth:** mid-range. Not bubbly customer service. Not robotic transactional. Closer to a good mechanic who explains things.

**Two voice paths:**

**A) Premade library:** Browse, pick, ship. Cost: $0. Risk: another product might use the same voice and erode brand distinction.

**B) Custom voice (Professional Voice Cloning):** Hire a voice actor (or use a team member with the right sound), do a recording session, ElevenLabs trains a custom voice. Cost: voice actor fee ($300–$1500) + ElevenLabs Pro plan ($99/mo, includes Voice Lab). Result: a unique Oto voice no competitor can replicate.

**Recommendation:** start with premade for v1 ship. Plan custom voice for v2 once the demo's value is proven. The custom voice becomes the brand identity (think Siri, Alexa — once people know the voice, it's yours).

### 3.4 Sample conversation (target behavior)

Verbatim sample of what a good marketing-site interaction looks like — pulled directly from the mobile Oto's behavior bar (per `stable.ts` Diagnostic Protocol section):

```
VISITOR: (taps microphone) "Hey, my car makes this weird grinding sound
         when I brake."

OTO (voice): "Usually one of two things — either the brake pads have worn down
              to the metal indicator, or you've got debris caught between the
              pad and rotor. Quick question to narrow it down: does the grinding
              happen the whole time you're pressing the brake, or only at the
              very start?"

VISITOR: "Only at the start, then it goes away."

OTO (voice): "That's almost always the wear indicator doing its job — the pads
              are telling you they're due for replacement. It's not dangerous
              yet, but you'll want them done soon, ideally in the next week or
              two, before they damage the rotors.

              If you tell me your zip code, I can text you a few OtoPair shops
              near you that can do it — usually 80 to 200 dollars for the pads,
              an hour or so of labor. Or if you want to keep exploring the app,
              just head to otopair.com slash download."

VISITOR: "Yeah text me, 94110."

OTO (voice): "Got it. What's a good number to text?"

(visitor provides → agent fires the lead-capture webhook → marketing CRM
 receives the lead with context: "Asked about brake squealing on M550i,
 zip 94110, agent recommended Brake Pad Replacement, $80–$200 estimate,
 lead requested SMS follow-up.")
```

This conversation demonstrates everything mobile Oto does (diagnostic protocol, calm tone, no pressure, helpful resolution) in 4 turns — and ends with a captured lead. That's marketing gold.

### 3.5 Lead capture webhook spec

The one webhook tool the demo agent needs. Schema:

```typescript
POST /api/oto-demo-lead
{
  conversation_id: string,         // ElevenAgents-provided
  session_started_at: number,
  channel: "voice" | "text",
  vehicle_context: {
    year?: number,
    make?: string,
    model?: string,
    trim?: string,
  },
  diagnostic_context: {
    symptom_described: string,
    recommended_service?: string,   // canonical slug if matched
    urgency_level?: "immediate" | "soon" | "preventive",
    estimated_cost_range?: string,
  },
  lead: {
    name?: string,
    email?: string,
    phone?: string,
    zip?: string,
    preferred_contact_method: "sms" | "email" | "callback",
    consent_marketing: boolean,
  },
  conversation_transcript: Array<{role: "user"|"agent", text: string, ts: number}>,
}
```

This payload gives your marketing CRM (HubSpot, Salesforce, custom Convex table — your call) enough context to follow up intelligently. The agent already gathered the relevant info; the lead is hot.

---

## 4. Implementation options — pick one

### Option A — Pure ElevenLabs (recommended for v1)

**Stack:** ElevenAgents agent + their LLM (Claude 3.7 Sonnet or GPT-4o) + RAG knowledge base + one lead-capture webhook + React SDK on otopair.com.

**Build time:** 1–2 weeks for a polished v1.

**Pros:**
- Ships fast.
- No new infrastructure on your side (Convex stays mobile-only).
- ElevenLabs handles voice, ASR, turn-taking, LLM, RAG — single vendor, single bill.
- Easy to A/B test different system prompts and voices.

**Cons:**
- Marketing Oto and mobile Oto are TWO separate agents with separate prompts. Drift over time unless you align manually.
- No reuse of your mobile Oto's 24 tools, F1 fix, trust gates, etc.
- LLM costs paid TWICE (ElevenLabs charges per minute including LLM; you pay Anthropic for mobile Oto separately).

**Cost example** (1,000 demos/month × 3 min avg, Premium tier):
- ElevenAgents: 3,000 min × $0.12 = **$360/mo**
- (Optional) custom voice: $99/mo Pro plan to maintain it
- **Total: ~$460/mo** for the marketing AI bill

### Option B — Hybrid (Custom LLM = your Convex action)

**Stack:** ElevenAgents handles voice + ASR + RAG. Their "Custom LLM URL" points at a thin OpenAI-shaped adapter you build on Convex (`httpAction`) which wraps `api.oto.chat.sendMessage`.

**Build time:** 3–5 weeks.

**Pros:**
- Single Oto brain across mobile AND web. Prompt changes propagate automatically.
- Reuse all 24 tools — visitors can actually fire `get_vehicle_facts` against your real KB and get real specs back.
- Aligns marketing demo with what they'll experience after downloading the app — no rude surprise.
- LLM cost is yours (Anthropic), not paid 2x via ElevenLabs.

**Cons:**
- More engineering. You're building an OpenAI-adapter, handling streaming, handling tool-call round-trips through ElevenLabs' protocol.
- Tool calls on a marketing demo could leak sensitive info if not sandboxed (e.g., `get_bookings` returns real bookings if you don't gate by anonymity).
- Marketing demo would need its own auth gate (anonymous-user sentinel that Convex handles distinctly from real users) — additional plumbing.

**Cost example** (1,000 demos/month × 3 min avg, Custom LLM tier — ElevenLabs charges less when they're not running the LLM):
- ElevenAgents (voice + STT + orchestration only): ~3,000 min × $0.05–$0.07 = **$150–$210/mo**
- Anthropic Haiku tokens (~3,000 turns at avg 2,000 input + 500 output): ~$15–$30/mo
- Convex compute: negligible
- **Total: ~$165–$240/mo** + one-time engineering investment

### Option C — Fully custom (OpenAI Realtime API or Twilio + LLM stack)

Not recommended. Loses ElevenLabs' voice quality (which IS the marketing point). Higher engineering cost. No clear upside.

---

## 5. Pricing & ROI math

### 5.1 Per-conversation cost (Option A)

| Tier | Cost/min | 3-min visitor | Best for |
|---|---|---|---|
| Standard ($0.08/min) | $0.24 | Order-taking, FAQ-style, simple lookups | A/B test baseline |
| Turbo ($0.10/min) | $0.30 | Faster response, less premium feel | Probably not right for OtoPair |
| Premium ($0.12/min) | $0.36 | gpt-4o + Flash v2.5 voice, "where brand matters" | **Recommended for OtoPair** |

### 5.2 Monthly cost projections

| Monthly demos | Avg duration | Premium tier cost | Cost per lead (at 10% conversion) |
|---|---|---|---|
| 100 | 2 min | $24 | $2.40 |
| 500 | 3 min | $180 | $3.60 |
| 1,000 | 3 min | $360 | $3.60 |
| 5,000 | 3 min | $1,800 | $3.60 |
| 10,000 | 3 min | $3,600 | $3.60 |

For comparison: **paid search cost per lead for automotive services is typically $15–$50.** If the demo converts at even 5% to a real lead (email/phone captured), you're at $7–$8 cost per lead — half of paid search, and the lead is warmer because they've already had a conversation.

### 5.3 What it costs to NOT ship this

Static text on a marketing page converts at maybe 1–2%. Adding a voice agent that demonstrates the product's actual value proposition is the difference between "automotive app" and "automotive app you can TRY before downloading."

Time-to-value: visitors hit the page, hear Oto's voice, ask one question, get a real answer in 5 seconds. Compare to: visitors hit the page, read three paragraphs, fill out a "Request a demo" form, wait 2 days for someone to email them back.

The unfair advantage isn't the AI — it's the **immediacy**.

---

## 6. What you'd actually build (v1 spec)

Concrete deliverables for Option A v1. Engineering ticket-grade.

### 6.1 ElevenLabs agent configuration

- **Agent name:** Oto Demo
- **LLM:** Claude 3.7 Sonnet (best match for the "calm concierge" tone you've tuned in mobile)
- **Voice:** Premade library, picked by team (Pro plan if custom)
- **First message:** *"Hey — I'm Oto. Got a question about your car? Tell me what's going on and I'll help you figure it out."*
- **System prompt:** Adapted from `convex/oto/prompt/stable.ts`, stripped of tool references that don't exist in the demo. Keep: voice section, diagnostic protocol, restraint rules, no-fabrication rule, pivot respect, response format. Strip: render_* tool descriptions, booking-flow specifics, vehicle anchoring (since visitor has no anchored vehicle), loyalty, app-navigation redirects.
- **Knowledge base:**
  - Otopair marketing pages (Services, Pricing, FAQ, About) — uploaded as HTML
  - Top 50 most-common-symptom-questions Q&A doc — your team writes this
  - 50 most-popular vehicle quick-specs (year/make/model/trim → engine/oil/wiper sizes/common issues) — derive from your existing Convex vehicle_facts KB, export to CSV/PDF
  - "How OtoPair works" one-pager
- **Tools:**
  - `capture_lead` — webhook to `POST /api/oto-demo-lead`
  - (Optional v1.1) `find_nearest_shop` — webhook that takes zip + service slug, returns 3 nearby shops by name
- **Turn-taking:** premium settings for natural pacing
- **End conditions:** auto-hangup on 15s silence (default); end_call tool available

### 6.2 Marketing site integration

- Replace whatever's there with a prominent "Talk to Oto" CTA on the hero section
- Use `@elevenlabs/react` SDK, build a custom UI component (not the default chat bubble — make it feel native to your brand)
- Visual states: idle (pulsing mic), listening (waveform), thinking (subtle animation), speaking (waveform + text caption optional)
- Captions on by default for accessibility and for visitors in public spaces who can't use audio
- "Pause" button → recording stops, conversation paused; resume when ready
- "Get the app" button persistent in the corner for fast conversion

### 6.3 Lead-capture backend

- New endpoint: `POST /api/oto-demo-lead` (could be Convex `httpAction` for consistency, or a separate Next.js route — your call)
- Validates payload schema, writes to a dedicated `marketing_leads` table OR pushes to HubSpot/Salesforce
- Triggers an automated SMS/email per the visitor's selected channel within 60 seconds
- Notifies internal Slack channel for human follow-up on high-intent leads ("user described $500+ symptom, wants callback")

### 6.4 Analytics + iteration

- Wire ElevenAgents conversation logs to your analytics (Mixpanel/Amplitude/PostHog)
- Track: conversation duration, turn count, abandon point, intent classification, lead capture rate, post-conversation app download rate
- Use ElevenAgents simulation feature to regression-test prompt changes against the top 20 conversation patterns

---

## 7. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Voice agent hallucinates a fact and tells a visitor wrong info | Medium | High (trust damage) | Aggressively RAG-ground; explicit refusal rule for things outside knowledge base; clear "I'm a demo — get real advice from a mechanic before acting" disclaimer in agent persona |
| Latency spikes / connection issues during demo | Low-Medium | Medium (visitor abandons) | ElevenLabs SLA on first-turn latency; fallback to text mode automatically on connection issues |
| Cost runs hot if a single visitor stays for 30+ min | Medium | Low ($3.60 per long conversation) | Auto-hangup on silence (default 15s); max conversation duration cap (e.g., 10 min) configurable |
| Marketing Oto contradicts mobile Oto on something (drift) | High over time | Medium (trust damage) | Bi-weekly review cycle: pull a sample of demo conversations, compare to mobile Oto's behavior on same question; align prompts |
| Privacy / compliance: voice recordings, transcripts | Medium | Medium-High | Privacy policy update; explicit consent in first message ("this conversation is recorded and used to improve our service"); GDPR/CCPA compliance via lead-capture flow |
| Prompt injection — visitor tries to make agent say something brand-damaging | Medium | Medium | The same untrusted-input boundary rules you've built into mobile Oto's stable.ts apply; ElevenLabs has its own safety layer; combined with the RAG-grounded scope, attack surface is small |
| Voice picked sounds dated or off-brand in 6 months | Medium | Low | Voice swap is a config change in ElevenAgents — no engineering required; treat voice as a brand asset that gets refreshed |
| Visitor confused — thinks they're talking to a real person | Low (premade voices are clearly AI) | Low | First message identifies as Oto, your AI assistant. ElevenLabs voices are realistic but not deceptive |

---

## 8. Comparison: ElevenLabs vs OpenAI Realtime vs Twilio + custom

For completeness — if you decided NOT to go with ElevenLabs, the alternatives:

| Vendor | Voice quality | Latency | Custom LLM | RAG built-in | Widget embed | Pricing | Verdict |
|---|---|---|---|---|---|---|---|
| **ElevenLabs (recommended)** | Best in class | <500ms first turn | Yes (custom URL) | Yes | Yes (React SDK + web component) | $0.08–$0.12/min | The right call for a brand-defining demo |
| OpenAI Realtime API | Good (OpenAI voices, fewer choices) | ~800ms | OpenAI only | No (you build) | No (you build) | ~$0.06/min input, $0.24/min output | Cheaper but you build a lot more |
| Twilio + LLM + custom TTS | Variable (depends on TTS choice) | 1000ms+ | Yes | No | No | Per-component | Most flexible, most engineering — overkill for marketing |
| Vapi.ai | Good | <500ms | Yes (any) | Yes | Yes | ~$0.05–$0.15/min | Real competitor; smaller voice library, less established |
| Retell AI | Good | <500ms | Yes | Yes | Yes | ~$0.07/min | Phone-first; weaker web embed story |

**ElevenLabs wins on voice quality + integration ergonomics + established brand association** (their voices are known in the industry; "powered by ElevenLabs" is a positive signal for early adopters). For an OtoPair flagship marketing demo, where the WHOLE point is to wow the visitor, voice quality is the differentiator.

---

## 9. Recommended next steps

In execution order:

1. **Sign up for ElevenLabs Pro plan ($99/mo).** Required for Voice Lab + ElevenAgents at scale. Free tier is for trying.
2. **Build the knowledge base (week 1).** Curate the docs your team would hand a new mechanic-trainee. Upload to ElevenAgents. Iterate the RAG settings until the agent answers reliably from your content vs. hallucinating.
3. **Adapt `stable.ts` for marketing context (week 1).** Strip the mobile-only sections (render tools, vehicle anchoring, loyalty). Keep the personality + diagnostic protocol + restraint rules.
4. **Build the lead-capture webhook (week 1).** Convex `httpAction` or Next.js route. Wire to whatever CRM you use.
5. **Configure the agent in ElevenAgents dashboard (week 1).** LLM = Claude 3.7 Sonnet. Voice = pick from library. Connect knowledge base + webhook tool. Set conversation flow params.
6. **Build the React SDK component (week 2).** Custom UI, not default widget. Match OtoPair brand.
7. **Run 50 internal test conversations (week 2).** Refine prompt. Check for failure modes from your existing Oto eval cases — F1 fabrication, pivot respect, system leak, bundling restraint. The mobile Oto's eval discipline applies.
8. **Soft launch on a feature-flagged version of the marketing site (week 2).** Watch analytics, watch transcripts, iterate.
9. **Full launch (week 3).** Monitor cost vs. conversion. If conversion is real, plan Option B migration.

**If the demo converts at 5%+ on email-capture and 1%+ on app-download, the math works at $360/mo for 1,000 demos.** That's the threshold.

---

## 10. Open questions for you

These I can't answer without your input:

1. **Voice gender / personality** — do you have a sense of what Oto sounds like? Are we leaning Sara (warm professional female), David (calm expert male), something else, or commissioning custom?
2. **Marketing site stack** — is `otopair.com` Next.js? React? Static site? Drives the SDK choice (React SDK vs web component vs custom).
3. **CRM / lead destination** — where do captured leads go? HubSpot, Salesforce, custom Convex table, Notion DB, email-to-team?
4. **Brand tone trade-off** — should the demo be slightly more upbeat/sales-y than mobile Oto (since it's a marketing context) OR stay perfectly consistent with the mobile concierge tone (since the value is "this is what you get after download")? My recommendation: stay consistent. The "exactly what you'll get" promise is more powerful than "polished demo that doesn't match reality."
5. **Knowledge base scope** — how aggressive should we be? Top 50 vehicles, or top 200? Symptoms only, or also pricing transparency deep-dives? I'd start narrow and expand based on transcript analysis.
6. **Disclosure pattern** — do we explicitly say "this is an AI demo" upfront, or let visitors infer it from the conversation? I'd recommend a one-sentence disclosure in the first turn for legal safety + trust building.

---

## Sources

- [ElevenLabs Conversational AI / Voice Chat platform](https://elevenlabs.io/conversational-ai)
- [ElevenAgents Documentation overview](https://elevenlabs.io/docs/eleven-agents/overview)
- [Widget customization docs](https://elevenlabs.io/docs/eleven-agents/customization/widget)
- [ElevenLabs Agents SDK on GitHub](https://github.com/elevenlabs/packages)
- [Embedding Guide (DeepWiki)](https://deepwiki.com/elevenlabs/packages/5.3-embedding-guide)
- [System tools documentation](https://elevenlabs.io/docs/agents-platform/customization/tools/system-tools)
- [Knowledge base + RAG docs](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag)
- [Knowledge base setup](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base)
- [Integrate your own model — Custom LLM](https://elevenlabs.io/docs/eleven-agents/customization/llm/custom-llm)
- [Models / LLM choices for agents](https://elevenlabs.io/docs/agents-platform/customization/llm)
- [Claude 3.7 Sonnet voice integration announcement](https://elevenlabs.io/blog/introducing-claude-37-sonnet-in-elevenlabs-conversational-ai)
- [Conversation flow / turn-taking docs](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow)
- [Latency optimization for Conversational AI](https://elevenlabs.io/blog/how-do-you-optimize-latency-for-conversational-ai)
- [Pricing — ElevenLabs](https://elevenlabs.io/pricing)
- [ElevenLabs Pricing 2026: Every Plan + Agents Per-Minute Cost (pxlpeak)](https://pxlpeak.com/blog/ai-tools/elevenlabs-pricing-guide)
- [ElevenLabs in 2026 Complete Guide (Medium)](https://medium.com/the-ai-entrepreneurs/elevenlabs-in-2026-the-complete-guide-to-v3-agents-music-and-scribe-7f3c3bdfd201)
- [ElevenAgents Conversational AI Voice Agents Guide 2026 (Sacesta)](https://www.sacesta.com/our-work/blog/elevenlabs-agents-conversational-ai-guide-2026)
- [ElevenLabs Conversational AI 2.0 (DigitalbyDefault)](https://digitalbydefault.ai/blog/elevenlabs-conversational-ai-voice-agents-2026)
- [Building a Voice Agent with Claude Code and ElevenLabs (MindStudio)](https://www.mindstudio.ai/blog/build-voice-agent-claude-code-elevenlabs)
- [How to Embed an AI Voice Agent Widget on Your Website (MindStudio)](https://www.mindstudio.ai/blog/embed-ai-voice-agent-widget-website-elevenlabs)
