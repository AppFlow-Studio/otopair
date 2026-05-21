# OtoPair Marketing — Voice Agent + Warm Account Onboarding

**Audience:** Waleed + marketing/engineering leads
**Goal:** Ship a marketing-site experience that (a) lets visitors talk to an Oto voice demo, and (b) creates their account + onboards their cars BEFORE they ever download the app.
**Timeline:** 3 weeks to v1 soft launch, 5 weeks to full launch with the voice-agent-as-onboarding combo.
**Read order:** §0 (decisions to lock today) → §1 (overall strategy) → §2-6 (phased build) → §7 (the combo that makes this unfair).

---

## 0. Decisions to lock TODAY (you, 1 hour)

These six unblock everything downstream. Pick now, refine later:

| # | Decision | Options | My recommendation |
|---|---|---|---|
| 0.1 | **Voice direction** | (a) premade library voice ($0, ship fast) / (b) custom voice ($300–$1500 + voice actor) | (a) for v1, plan (b) for v1.5 |
| 0.2 | **Marketing site stack** | Existing site? Next.js / React / static? | (Tell me — drives auth + SDK choice) |
| 0.3 | **Lead CRM** | HubSpot / Salesforce / custom Convex table / Notion / direct-to-Slack | Convex table — keeps everything in one place; CRM export later if needed |
| 0.4 | **Auth provider on web** | Clerk (same as mobile — recommended) / Auth0 / Supabase | **Clerk** — reuses your existing mobile identity, zero re-onboarding |
| 0.5 | **Vehicle onboarding UX** | VIN entry / YMM dropdown / both / "snap a photo" | Both VIN + YMM. VIN faster for those who know it; YMM fallback. Photo-snap later. |
| 0.6 | **Pre-app account incentive** | None / "First service fee waived" / "$25 credit on first booking" / "Free diagnostic scan" | "$25 booking credit" — concrete, easy to budget, converts |

After these six, the team can start building Monday.

---

## 1. The unified strategy

Two product surfaces, same outcome: **convert anonymous visitor → warm authenticated user with their car already in the system.**

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                          otopair.com flagship site                              │
│                                                                                 │
│  ┌──────────────────────┐         ┌──────────────────────────────────────────┐│
│  │  STATIC HERO         │         │  Talk to Oto (ElevenLabs voice agent)    ││
│  │  + CTA "Get $25"     │         │  "Hey, I'm Oto. Got a car question?"     ││
│  │  + Brand copy        │         │   ↓                                       ││
│  └──────────┬───────────┘         │  Voice conversation → diagnostic / spec ││
│             │                     │  lookup / answer                          ││
│             │                     │   ↓                                       ││
│             │                     │  "Want to save this so you don't repeat  ││
│             │                     │   it in the app? Just need your email."  ││
│             │                     └───────────┬──────────────────────────────┘│
│             │                                 │                                │
│             └──────────┬──────────────────────┘                                │
│                        ▼                                                       │
│            ┌──────────────────────────────────┐                                │
│            │  CLERK SIGNUP (web SDK)          │                                │
│            │  Email / phone / social          │                                │
│            └────────────────┬─────────────────┘                                │
│                             ▼                                                  │
│            ┌──────────────────────────────────┐                                │
│            │  VEHICLE ADD (Convex mutations)  │                                │
│            │  VIN → NHTSA decode → confirm    │                                │
│            │  OR Year/Make/Model dropdown     │                                │
│            └────────────────┬─────────────────┘                                │
│                             ▼                                                  │
│            ┌──────────────────────────────────┐                                │
│            │  "Almost there — download the    │                                │
│            │   app to claim your $25 credit"  │                                │
│            │  SMS deep-link to App Store      │                                │
│            └────────────────┬─────────────────┘                                │
└─────────────────────────────┼──────────────────────────────────────────────────┘
                              ▼
                ┌──────────────────────────────┐
                │  Mobile app                  │
                │  User opens → signs in via   │
                │  Clerk → SAME Convex user    │
                │  → SAME vehicles already     │
                │  there → $25 credit applied  │
                │  → ready to book on day 1    │
                └──────────────────────────────┘
```

**Why this works:** The biggest drop-off in any app's funnel is the gap between "interested" and "actually using". Today: user downloads app → has to create account → has to enter their car → has to figure out what to do. Three friction points before value. With this plan: user gets value FIRST (voice demo), creates account WHILE engaged, has their car ALREADY in the system, opens the app and is ready to book.

**The infrastructure makes this nearly free.** Clerk + Convex already exist on mobile. Reusing them on web is mostly UI work, not new backend.

---

## 2. Phase 1 — Foundations (Week 1)

### 2.1 Accounts & access (Day 1)

| Task | Owner | What it unlocks |
|---|---|---|
| Sign up for ElevenLabs Pro ($99/mo) | Marketing | Voice Lab access, ElevenAgents quota |
| Generate ElevenLabs API key, share via 1Password | Marketing | All agent config + webhook integrations |
| Confirm Clerk plan supports web + mobile in same project | Engineering | Single identity across surfaces |
| Confirm Convex deployment allows web SDK writes from a new origin (otopair.com) | Engineering | Vehicle adds from web work |
| Set up `marketing_leads` table in Convex schema | Engineering | Lead capture destination |
| Create `marketing_acquired: boolean` flag on `users` table | Engineering | Attribution + downstream cohort analysis |

### 2.2 Schema additions to support web onboarding

Add to `convex/schema.ts`:

```ts
// ===== Marketing-acquired user flag =====
// On the `users` table, add:
   marketing_acquired: v.optional(v.boolean()),
   marketing_acquired_at: v.optional(v.number()),
   marketing_acquired_source: v.optional(v.string()),  // "voice_demo" | "static_signup" | "blog" etc.
   marketing_utm: v.optional(v.object({
     source: v.optional(v.string()),
     medium: v.optional(v.string()),
     campaign: v.optional(v.string()),
     content: v.optional(v.string()),
     term: v.optional(v.string()),
   })),

// ===== New table for marketing leads (people who interacted but didn't sign up) =====
marketing_leads: defineTable({
  // Identity (any one is enough to follow up)
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  name: v.optional(v.string()),
  zip: v.optional(v.string()),

  // Source
  source: v.union(
    v.literal("voice_demo_lead_capture"),
    v.literal("static_form_submit"),
    v.literal("exit_intent_modal"),
    v.literal("blog_subscribe"),
  ),
  utm: v.optional(v.object({
    source: v.optional(v.string()),
    medium: v.optional(v.string()),
    campaign: v.optional(v.string()),
  })),

  // Context (from voice agent or form)
  vehicle_described: v.optional(v.object({
    year: v.optional(v.number()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    trim: v.optional(v.string()),
  })),
  symptom_described: v.optional(v.string()),
  recommended_service: v.optional(v.string()),
  estimated_cost_range: v.optional(v.string()),

  // Conversation (if voice demo)
  voice_conversation_id: v.optional(v.string()),  // ElevenAgents conv ID
  conversation_transcript: v.optional(v.array(v.object({
    role: v.string(),
    text: v.string(),
    ts: v.number(),
  }))),

  // Lifecycle
  preferred_contact_method: v.optional(v.string()),  // "sms" | "email" | "callback"
  consent_marketing: v.boolean(),
  followed_up_at: v.optional(v.number()),
  converted_to_user_id: v.optional(v.id("users")),
  converted_at: v.optional(v.number()),

  created_at: v.number(),
})
  .index("by_email", ["email"])
  .index("by_phone", ["phone"])
  .index("by_source", ["source"])
  .index("by_created_at", ["created_at"]),
```

### 2.3 Lead capture webhook (Convex `httpAction`)

Wire the voice agent's `capture_lead` tool to a new endpoint. Lives in `convex/marketingLeads.ts`:

```ts
export const captureLead = httpAction(async (ctx, request) => {
  const payload = await request.json();
  // Validate, then insert into marketing_leads
  // Trigger downstream: SMS via Twilio, email via Resend/Postmark, Slack notification
  const leadId = await ctx.runMutation(internal.marketingLeads.create, { ... });
  return new Response(JSON.stringify({ ok: true, leadId }), { status: 200 });
});
```

The ElevenAgents tool definition points at `https://<your-convex-deployment>.convex.site/captureLead` — Convex routes HTTP actions on the `.convex.site` subdomain.

---

## 3. Phase 2 — Content (Week 1, parallel with Phase 1)

### 3.1 Knowledge base build

Three buckets, ranked by leverage:

**Bucket 1 — Symptoms Q&A (highest priority).** Your team writes a doc of the top 50 most-common car-symptom questions with concierge-grade answers. Format: question → likely-causes-with-prevalence → diagnostic question → recommended-service. This is the bread and butter of the voice agent.

Example entries:
- "Why does my car shake when I brake?"
- "What does the orange engine light mean?"
- "How long do brake pads last?"
- "Can I drive with the TPMS light on?"
- "My car squeals on cold mornings"
- "Burning smell after driving"
- ... (50 of these)

**Bucket 2 — Top 50 vehicles spec sheet.** Export from your existing Convex `vehicle_facts` KB or `trim_specs` table. One paragraph per vehicle covering: engine type, recommended oil, common issues at high mileage, typical service intervals. Lets the agent answer "What oil does a 2020 Honda Civic take?" without making it up.

**Bucket 3 — OtoPair specifics.** Pricing transparency one-pager, how the 7% fee works, what "OtoPair-vetted mechanic" means, service categories offered. Reuse your existing marketing copy.

Total: ~30–50 documents. ElevenLabs RAG handles 100+ docs easily. Indexing takes minutes.

### 3.2 Prompt adaptation

Start from `convex/oto/prompt/stable.ts`. Strip the mobile-only sections (anything referencing `render_book_service`, `render_record_confirmation`, `render_quick_replies`, `update_conversation_state`, vehicle anchoring, the 24-tool catalog, polite-exit, trust gate against `self_reported` records). Keep:

- `# Who you are` identity paragraph
- `# Voice` (tone-hierarchy)
- `## No system narration — hard rule`
- `# Untrusted user input — structural boundary`
- `# Pivot respect`
- `# Recommendations — the three-beat frame`
- `# Symptom routing — reason, narrow, then recommend` (minus the tool-specific bits)
- `# Vehicle Health & Service-Due` (cut tool refs, keep the honesty rules)
- `# Capability honesty`
- `# Response format`
- `# Vehicle scoping — every car-specific query is scoped to the anchored vehicle` (re-cast for a single-conversation context)
- The silent-discard rule (added today, S0 important)

Add NEW sections specific to marketing context:

- `# Mode: marketing demo` — clarify Oto is a demo on a website, NOT the full mobile app
- `# Lead capture protocol` — when to ask for email/phone, how to ask (gracefully, after value delivered)
- `# Onboarding offer` — when the visitor has described a real concern, offer to save the context: *"Want me to save what we just talked about so you don't have to repeat yourself in the app? Just need an email — I'll set up your account and you'll have a $25 credit waiting."*
- `# Disclosure` — one-sentence "this is an AI demo" in the first turn

Estimated final marketing prompt: ~250 lines (vs mobile's 1,200). Tighter scope = easier to reason about.

### 3.3 Voice selection (premade for v1)

Browse ElevenLabs' voice library. For OtoPair brand, recommended characteristics:
- US accent
- Mid-pace (premium tier intentional pacing)
- Mid-range warmth (not bubbly, not robotic)
- 30–45 sound

Pick 3 candidates, run identical scripts through each via ElevenLabs studio, share with team for vote. Lock the choice within Day 5.

---

## 4. Phase 3 — Web build (Week 2)

### 4.1 Marketing site stack assumption

Assuming Next.js (the most common modern React stack). If it's something else (Astro, plain React, WordPress), the SDK choice changes but the architecture is identical.

Three new pages / sections needed:

```
app/
├── page.tsx                    # Marketing landing (existing + voice agent embed)
├── signup/
│   └── page.tsx                # Clerk web auth flow
├── onboard/
│   ├── page.tsx                # Vehicle add (VIN or YMM)
│   └── success/page.tsx        # "Download the app to claim your $25"
└── api/
    └── claim-lead/route.ts     # Optional: server-side lead handling
```

### 4.2 Clerk web integration

Single Clerk project, two surfaces (mobile already exists, web is new).

```typescript
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      {children}
    </ClerkProvider>
  );
}
```

Clerk's web SDK handles the entire signup UI (email/phone/Google/Apple). Their `<SignUp>` component drops in. Same Clerk user IDs flow to Convex on both mobile and web via the existing Clerk webhook → `api.users.create` mutation.

**Critical:** the user account created on web must be findable on mobile. This works automatically because:
1. Web user signs up → Clerk creates a user with Clerk ID `clerk_abc123`
2. Clerk webhook fires → existing handler in `convex/users.ts` creates a `users` row with `clerkUserId: "clerk_abc123"`
3. User downloads app, signs in with same email → Clerk recognizes the same user ID
4. Mobile uses `api.users.getByClerkUserId({clerkUserId: "clerk_abc123"})` → finds the row → user has all their previous setup

Zero new mobile code needed. The continuity comes for free.

### 4.3 Vehicle onboarding flow

```typescript
// app/onboard/page.tsx — sketch
import { useUser } from '@clerk/nextjs';
import { useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';

function VehicleOnboard() {
  const { user } = useUser();
  const addVehicle = useMutation(api.vehicles.addByVin);  // existing mobile mutation
  const decodeVin = useAction(api.vehicleEnrichment.decodeVin);  // existing NHTSA wrapper
  const [vin, setVin] = useState('');
  const [decoded, setDecoded] = useState(null);

  const handleVinSubmit = async () => {
    const result = await decodeVin({ vin });
    setDecoded(result);  // show "2020 BMW M550i xDrive — is this right?"
  };

  const handleConfirm = async () => {
    await addVehicle({ vin, marketing_source: 'web_onboarding' });
    router.push('/onboard/success');
  };

  // UI: VIN input + "I don't know my VIN" fallback to YMM dropdown
}
```

Reuse existing mutations. The flag `marketing_source: 'web_onboarding'` on the vehicle add is the only marketing-specific addition.

**Fallback YMM (year/make/model) flow** for visitors who don't know their VIN: cascading dropdowns sourced from your existing `makes` / `models` / `trims` tables in Convex.

### 4.4 ElevenLabs voice agent embed

Using their React SDK:

```typescript
// components/OtoVoiceAgent.tsx
import { useConversation } from '@elevenlabs/react';

export function OtoVoiceAgent() {
  const conversation = useConversation({
    agentId: process.env.NEXT_PUBLIC_OTO_AGENT_ID,
    onConnect: () => console.log('Connected'),
    onDisconnect: () => console.log('Disconnected'),
    onMessage: (msg) => console.log('Message:', msg),
    onError: (err) => console.error('Error:', err),
    clientTools: {
      capture_lead: async (params) => {
        // Forward to your captureLead endpoint
        const res = await fetch('/api/claim-lead', { 
          method: 'POST', 
          body: JSON.stringify(params) 
        });
        return res.json();
      },
    },
  });

  return (
    <div className="oto-voice-widget">
      <button onClick={() => conversation.startSession()}>
        {conversation.status === 'connected' ? 'End conversation' : 'Talk to Oto'}
      </button>
      <div>{conversation.isSpeaking ? 'Oto is speaking…' : 'Listening'}</div>
    </div>
  );
}
```

Custom UI on top of the SDK lets you match the OtoPair visual brand instead of using the default chat bubble.

### 4.5 Voice-agent-as-onboarding (THE COMBO — see §7)

The agent's `capture_lead` tool can do MORE than just capture — it can trigger account creation. See §7 for the full spec.

---

## 5. Phase 4 — Test & calibrate (Week 2, Days 4–7)

### 5.1 Internal eval pass

Apply the same eval discipline you've built for mobile Oto. Run the agent through 30 scripted scenarios covering:

- F1 fabrication test: ask about service-due on a vehicle the KB doesn't know about. Agent must say "I don't have that on file" — not invent a date.
- Pivot respect: mid-conversation, change topic. Agent must honor pivot.
- System leak: ask agent how it works internally. Must not narrate prompt / KB / tool internals.
- Bundling restraint: ask about wipers; vehicle context has unrelated issues. Agent must NOT offer unrelated services.
- Honesty: ask the agent to do something outside its capabilities (e.g., "Book me an appointment right now"). Must redirect to app gracefully.
- Lead capture trigger: after a substantive conversation, agent must offer the account-creation prompt naturally.
- Onboarding handoff: when visitor agrees, agent must capture email + vehicle context cleanly.

Reuse the test cases from `scripts/oto-eval-cases.json` where applicable — most of the diagnostic-protocol cases transfer directly.

### 5.2 Conversion funnel instrumentation

Wire to your analytics (PostHog/Mixpanel/Amplitude — your choice):

- Page view → voice agent button click rate
- Click → conversation start rate
- Conversation start → completion (>1 turn)
- Completion → lead capture rate
- Lead capture → signup completion
- Signup → vehicle add
- Vehicle add → app download (via SMS link click-through)
- App download → first booking (the final conversion)

The full funnel from "anonymous visitor" to "booked customer" is now traceable end-to-end. This is the marketing dashboard.

### 5.3 Cost calibration

Run 50 internal test conversations at average length. Check:
- Per-conversation ElevenLabs cost
- Per-conversation Anthropic cost (if Option B)
- Per-conversation Convex compute cost (negligible)

Extrapolate to 100, 1,000, 10,000 monthly demos. Set a budget alert in ElevenLabs dashboard at 50% / 80% / 100% of monthly cap.

---

## 6. Phase 5 — Launch (Week 3)

### 6.1 Soft launch (Day 1–4)

Feature-flag the voice agent + signup flow to:
- 10% of marketing-site visitors
- Internal team always
- Anyone with `?demo=true` query param (for direct shareable previews)

Monitor:
- Conversation completion rate
- Lead capture rate
- Bug reports
- Cost trajectory
- Voice quality complaints (e.g., "voice sounds robotic" — flag for voice swap)

### 6.2 Iterate (Day 4–7)

Pull transcripts of failed conversations (abandoned before lead capture, or "I don't know" responses from the agent). Either:
- Add to knowledge base
- Refine prompt
- Add an explicit fallback ("I don't have that info — but the app does, want me to text you the link?")

### 6.3 Full launch (Week 3 end)

Roll to 100%. Announce on social. Email existing waitlist if you have one.

Set up weekly review: pull 20 random conversations, score against eval criteria, flag drift.

---

## 7. The COMBO — voice agent IS the onboarding (the unfair advantage)

This is what makes the whole strategy uniquely OtoPair. Most marketing voice agents are FAQ bots. Yours collects intent + vehicle context + email + saves the user account, all in a natural conversation.

### 7.1 The flow, end-to-end

```
VISITOR: (taps "Talk to Oto" on otopair.com)

OTO: "Hey, I'm Oto — Otopair's car concierge demo. What's going on with your car?"

VISITOR: "My brakes are squealing when I stop at lights."

OTO: "Probably the wear indicators — the pads have a little metal tab that
      makes that sound when they get thin. Quick question — does it happen
      the first time you brake from cold, or every time?"

VISITOR: "Every time."

OTO: "Yeah, that's the wear indicator doing its job. You've got maybe a
      couple weeks to a month before they really need to be done. Brake pad
      replacement on most cars runs $150-$300 depending on the model.
      What kind of car?"

VISITOR: "2020 BMW M550i."

OTO: "Nice — German performance pads run a bit more, maybe $250-$400 with
      OEM. Want me to set you up with a $25 credit you can use when you book
      the service through Otopair? Just need an email — I'll have your car
      and what we just talked about ready when you open the app."

VISITOR: "Yeah, sure. it's me@example.com."

OTO: (fires save_warm_account tool with email + vehicle + symptom context)
     "Got it. Check your email — there's a one-tap link to claim your
      account and download the app. Your M550i and the brake context will be
      there. Anything else I can help with right now?"
```

What just happened in the backend:
1. Voice agent collected: email, vehicle (year/make/model), symptom, recommended service, cost estimate
2. Agent fires `save_warm_account` tool → webhook on Convex `httpAction`
3. Webhook creates a Clerk user with the email (Clerk handles email magic-link)
4. Webhook creates a Convex `users` row with `marketing_acquired: true`, `marketing_acquired_source: "voice_demo"`
5. Webhook creates a `vehicles` + `vehicle_owners` row with the year/make/model (VIN-lookup-deferred until user confirms in app — or use NHTSA's YMM lookup to pre-fill)
6. Webhook creates a `marketing_leads` row with the conversation context (linked to the new user_id via `converted_to_user_id`)
7. Webhook also creates a record_anchored `conversation_facts` entry — when the user opens the app, mobile Oto's `getCrossConversationMemory` already has context: "user reported brake squealing on first turn, recommended Brake Pad Replacement, $250-$400 estimate"
8. Webhook fires the email magic link via Clerk
9. User taps email link → lands on /onboard/success → SMS deep-link to App Store
10. User opens mobile app → Clerk recognizes them → vehicles + credit + diagnostic context all already there

**End result:** the user's FIRST mobile-app experience is "wow, it already knows my car and remembers what I asked about". That's not onboarding — that's continuity.

### 7.2 The `save_warm_account` tool spec

Define this as a webhook tool in ElevenAgents pointing at a new Convex `httpAction`:

```typescript
// convex/marketingWarmAccount.ts
export const saveWarmAccount = httpAction(async (ctx, request) => {
  const {
    email,
    vehicle,        // { year, make, model, trim? }
    symptom,        // user-described
    recommended_service,
    estimated_cost_range,
    conversation_id,
    consent_marketing,
  } = await request.json();

  // 1. Create Clerk user (returns clerk_user_id)
  const clerkUserId = await ctx.runAction(internal.clerk.createUserByEmail, { email });
  
  // 2. Create Convex users row
  const userId = await ctx.runMutation(internal.users.createMarketingAcquired, {
    clerkUserId,
    email,
    marketing_acquired: true,
    marketing_acquired_at: Date.now(),
    marketing_acquired_source: 'voice_demo',
  });

  // 3. Resolve / create vehicle row (decode YMM → vehicle_config_id)
  const vehicleConfig = await ctx.runQuery(api.vehicleConfigs.findByYMM, vehicle);
  const vehicleId = await ctx.runMutation(internal.vehicles.createForUser, {
    user_id: userId,
    vehicle_config_id: vehicleConfig?._id,
    year: vehicle.year,
    metadata: { make: vehicle.make, model: vehicle.model, trim: vehicle.trim },
    marketing_source: 'voice_demo',
  });

  // 4. Create vehicle_owners row (links user to vehicle)
  await ctx.runMutation(internal.vehicleOwners.create, {
    user_id: userId,
    vehicle_id: vehicleId,
    is_primary: true,
    added_at: Date.now(),
  });

  // 5. Seed conversation_facts so mobile Oto has context on first turn
  if (symptom && recommended_service) {
    await ctx.runMutation(internal.oto.memoryEditing.recordSeedFact, {
      user_id: userId,
      vehicle_id: vehicleId,
      payload_text: `User reported "${symptom}" during web voice demo; recommended ${recommended_service}, estimated ${estimated_cost_range}.`,
      written_by: 'marketing_web',
    });
  }

  // 6. Issue $25 credit (Stripe or Convex-internal credit balance)
  await ctx.runMutation(internal.credits.issueWelcomeCredit, {
    user_id: userId,
    amount_cents: 2500,
    reason: 'marketing_voice_demo_signup',
  });

  // 7. Send magic-link email via Clerk (or Resend)
  await ctx.runAction(internal.clerk.sendMagicLink, { email });

  // 8. Update marketing_leads row to mark converted
  await ctx.runMutation(internal.marketingLeads.markConverted, {
    voice_conversation_id: conversation_id,
    converted_to_user_id: userId,
  });

  return new Response(JSON.stringify({
    ok: true,
    user_id: userId,
    next_step: 'magic_link_sent',
  }), { status: 200 });
});
```

This is ~80 lines of glue code that reuses 6+ existing mutations. The infrastructure is already there.

### 7.3 The mobile-app first-open experience

User opens the app after getting the email. Two paths:

**Path A — Clerk magic-link deep-link:** SMS includes a deep-link like `otopair://signin?token=abc123`. User taps → app opens → Clerk auto-signs-in via the magic-link token → user is on the home screen logged in, no signup friction.

**Path B — Fallback email/password:** User enters email + magic code → signed in.

In both cases, mobile Oto's first turn for this user will look like:

```
OTO: "Welcome to OtoPair! I see you talked to me on the website — 
      I've got your 2020 BMW M550i set up and your $25 booking credit 
      ready when you need it. Want to pick up where we left off with the 
      brake situation, or something else?"
```

That's not an app onboarding — that's a continuation. Massively higher activation rate than the default cold-start.

### 7.4 What changes in mobile code

Almost nothing. The mobile app already:
- Uses Clerk for auth
- Reads `users` table by `clerkUserId`
- Reads `vehicles` + `vehicle_owners` for the user's garage
- Reads `getCrossConversationMemory` which already pulls `conversation_facts` for context

The ONLY changes:
1. **First-turn welcome message** when `users.marketing_acquired === true` AND `users.first_app_open_at` is unset — show the warm welcome above. After first app open, set `first_app_open_at` so the welcome doesn't repeat. ~20 lines of code in the home screen.
2. **Credit display** if you implement the $25 — show it on the booking flow. Probably already in your roadmap.

Everything else flows through your existing mobile architecture.

---

## 8. Metrics & success criteria

### 8.1 Funnel KPIs

| Stage | Target conversion (v1) | Target conversion (v3, optimized) |
|---|---|---|
| Marketing site visit | (baseline) | (baseline) |
| Voice agent click | 8% of visits | 15% of visits |
| Conversation start (>0 turns) | 70% of clicks | 90% of clicks |
| Conversation completion (>3 turns) | 50% of starts | 70% of starts |
| Lead capture (email/phone provided) | 15% of completions | 30% of completions |
| Account creation (Clerk signup completed) | 80% of lead captures | 95% of lead captures |
| Vehicle added | 70% of accounts | 90% of accounts |
| App download | 40% of accounts | 60% of accounts |
| First booking | 15% of app downloads (within 7 days) | 30% of app downloads |

For 10,000 visitors/month: ~$24 = ~24 first bookings/month at v1 conversion. ~$24 × cost-per-booking = real revenue contribution.

### 8.2 Voice agent quality KPIs

| Metric | Target |
|---|---|
| Average conversation length | 2.5–4 minutes |
| Visitor satisfaction (5-star post-conversation prompt) | 4.5+ average |
| "I don't know" responses (RAG miss) | <5% of turns |
| Bug reports per 1k conversations | <2 |
| Cost per conversation | <$0.50 |

### 8.3 Cohort comparison

Critical metric for sizing the win:

| Cohort | First-booking conversion (within 30d of app install) | LTV (12-month) |
|---|---|---|
| Cold install (no marketing-site interaction) | (baseline X%) | (baseline $Y) |
| Marketing-site visit, no signup | X+~5% | $Y |
| Marketing-site signup, no voice | X+~15% | $Y+~25% |
| **Marketing-site signup VIA voice agent (vehicle + context saved)** | **X+~40%** | **$Y+~60%** |

These are estimates — measure your actual numbers. But the THEORY is that warm signups with their car + diagnostic context already loaded convert dramatically better than cold installs.

---

## 9. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Voice agent says something wrong about a service / price / car | High | RAG-grounded answers only; explicit "general estimate, real price at booking" disclaimer; quarterly KB audit |
| ElevenLabs cost spikes from a single chatty visitor | Low | Auto-hangup at 15s silence; 10-min max conversation cap; budget alerts |
| Clerk signup completion abandoned mid-flow | Medium | Save partial state to `marketing_leads` immediately on email entry; follow up via email even if signup not completed |
| Vehicle YMM doesn't match a real `vehicle_config_id` in our catalog | Medium | Fallback: store year/make/model/trim as metadata strings; resolve to `vehicle_config_id` later when user adds VIN in the app |
| User created on web never downloads the app | High | Email drip campaign — day 1, day 3, day 7 with the $25 credit reminder + "your brake pads are still squealing — here's how to book" |
| Voice quality degrades over time (vendor drift) | Low | Lock voice version in ElevenAgents config; review on every dashboard update |
| Two web users with same email collision | Medium | Clerk handles this — second signup with same email errors; UI catches and prompts sign-in instead |
| User's webcam/mic blocked → voice agent dead | Medium | Detect permission error, automatically fall back to text-input mode in the same agent |
| Privacy: voice recordings stored | Medium-High | Privacy policy update; explicit consent on first turn; provide deletion endpoint per GDPR/CCPA |
| ElevenLabs outage | Low | Static fallback — page shows email-only signup form when agent is unreachable; lead still captured |

---

## 10. Open questions for you

Before kickoff, decide:

1. **Marketing site stack** — Next.js? React? Static? Drives SDK choice. (asked in §0)
2. **Lead CRM** — Convex table + later export? Or direct HubSpot? (asked in §0)
3. **$25 credit mechanism** — Stripe coupon? Convex-internal credit balance + apply at booking? Both work; pick simpler. Probably Convex-internal.
4. **Vehicle catalog completeness** — does your YMM dropdown cover enough cars that 95% of US visitors can find theirs? If not, VIN-first is mandatory; YMM is fallback. If yes, either path works.
5. **Voice agent placement on the site** — hero CTA? Sticky bottom-right widget? Modal triggered by exit-intent? Each has different conversion characteristics.
6. **AI disclosure pattern** — explicit in first turn ("Hey, I'm Oto, an AI assistant") OR let visitors infer? Most legal teams prefer explicit. I recommend explicit.
7. **What happens after the first conversation if the visitor doesn't signup?** — Cookie-based "Oto remembers you" on return visit? Or fresh start each time? Cookie is unfair-advantage UX but adds GDPR scope.
8. **Internationalization** — US-only at v1? Multi-language requires multi-voice (ElevenLabs supports it) but more KB work.

---

## 11. Summary — what you're approving

By signing off on this plan, you're committing to:

- **3 weeks of build time** to v1 soft launch (1 week foundations, 1 week content + build, 1 week test + launch)
- **~$460/mo** ElevenLabs spend at 1,000 demos/month
- **~$25/user** in credit liability for converted signups (budget $1,250/mo if 50 conversions, $25,000/mo if 1,000 conversions — set guardrail)
- **~1 week of engineering time** for the Convex schema additions + webhook + mobile welcome-message change
- **~1 week of content team time** for the knowledge base + prompt adaptation
- **~3 days of design time** for the voice agent UI on the marketing site

In return:
- A category-defining marketing experience (no automotive competitor has this today)
- Significantly higher first-booking conversion from marketing traffic
- Warm leads with full context — not cold form submissions
- A migration path to Option B (full Oto brain via Custom LLM) once value is proven

**Next step:** lock the §0 decisions, then kick off Phase 1.
