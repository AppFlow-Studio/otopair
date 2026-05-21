# ElevenLabs Setup + Convex/Clerk Wiring — Runbook

**Audience:** Engineering (you / whoever's standing this up)
**Goal:** Get the marketing Oto voice agent live with a hot wire into Convex (data) and Clerk (identity).
**Authoring date:** 2026-05-20
**Status of upstream artifacts:**
- ✅ Knowledge base doc compiled (`Oto Knowledge Base v1.docx`), uploaded to ElevenLabs
- ✅ Launch plan locked (`OTO_MARKETING_LAUNCH_PLAN.md`)
- ⏳ This guide: actually wire it up

---

## 0. What you'll build

```
┌────────────────────────────────────────────────────────────────────────┐
│  otopair.com — visitor talks to Oto                                     │
└────────────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket (audio + transcript)
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│  ElevenLabs (ElevenAgents)                                              │
│   ▸ Voice (male, Premium tier)                                          │
│   ▸ LLM (Claude 3.7 Sonnet)                                             │
│   ▸ Knowledge base (Oto Knowledge Base v1 + maintenance Q&A)            │
│   ▸ System prompt (marketing-adapted from convex/oto/prompt/stable.ts)  │
│   ▸ Tools (webhook → Convex)                                            │
└────────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS POST webhooks
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Convex (.convex.site/<endpoint>) — your existing deployment            │
│   ▸ POST /decode_vin              → NHTSA / vehicleEnrichment            │
│   ▸ POST /save_warm_account       → Clerk user + Convex rows + seed      │
│   ▸ POST /capture_lead            → marketing_leads table                │
│   ▸ POST /partner_signup_interest → partner_leads table                  │
└────────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       ┌────────────┐                  ┌────────────┐
       │  Clerk     │                  │  Mobile    │
       │  (identity │                  │  app picks │
       │  creation) │                  │  up warm   │
       └────────────┘                  │  account   │
                                       └────────────┘
```

You'll set up four webhook tools, four Convex endpoints, and one Clerk integration point. ~3 hours of work end-to-end.

---

## 1. ElevenLabs Agent Setup (Dashboard, ~45 min)

### 1.1 Account + plan
1. Sign in at <https://elevenlabs.io>
2. Upgrade to **Creator plan** ($22/mo) or **Pro plan** ($99/mo). Pro is recommended for Voice Lab access + higher concurrent conversation limits.
3. Navigate to **Agents** (left sidebar) → **Create a new agent**

### 1.2 Basic config
Fill in the create-agent form:

| Field | Value |
|---|---|
| **Agent name** | `Oto - Otopair Demo` |
| **First message** | `Hey, I'm Oto — Otopair's car concierge. Ask me anything about your car, or tell me what's going on with it.` |
| **System prompt** | (built in §1.4 below — paste after) |
| **LLM** | Claude 3.7 Sonnet (best tone match per the KB voice spec — "calm, never pushy") |
| **Voice** | (selected in §1.3 below) |
| **Knowledge base** | Already configured ✓ |

### 1.3 Voice selection (locked: male per KB)
1. From the agent config, click **Voice** → **Browse library**
2. Filter: **Gender = Male**, **Accent = American**, **Age = Middle aged**
3. Listen to 5–8 candidates against this script (paste it into the preview):

> "Loud wiper noise in heavy rain usually means the blades are glazed or worn — the rubber is chattering across the glass instead of gliding. Pop the hood and look at the rubber edge. Cracked, peeling, or hardened means they need replacement. Want me to set you up with a shop, or you good from here?"

The voice should sound: **trustworthy, calm, mid-pace, slightly warm, NOT pushy or salesy.** Avoid voices that sound either too formal (corporate boardroom) or too casual (radio DJ).

4. **Recommended starting candidates** (browse, audition, pick whichever sounds most like a knowledgeable friend):
   - "Brian" — middle-aged, warm, conversational
   - "Daniel" — calm, professional
   - "Liam" — mid-pace, friendly
   - "Adam" — confident, deliberate

5. Once picked: **Voice settings → Stability: 0.5 / Similarity: 0.75 / Style: 0.2 / Speaker boost: ON**. These produce a natural-sounding mid-pace delivery.

### 1.4 System prompt (paste into Agent → System prompt)

This is adapted from `convex/oto/prompt/stable.ts` for the marketing context. Strip mobile-only tool references, keep the personality + diagnostic protocol + restraint rules, add the demo-mode framing from your KB.

```
You are Oto, the voice on the Otopair marketing website (otopair.com). You are a marketing and conversion agent. You do NOT manage real bookings or access any specific user account. What you CAN do is walk a visitor through a full preview of how Otopair works — decode their car from a VIN, talk through the right service, run a demo booking flow with example shops and slots, build their car profile in the app behind the scenes via a tool call, and hand them off to the app where the real booking happens with the visitor's car already loaded.

# Voice and tone
Casual, friendly, knowledgeable. Plain English. Short sentences. No jargon. Confident, never pushy. Trust-first. You talk the way a friend who happens to know cars would — clear, helpful, never selling.

# Disclosure (first turn only)
If asked "are you a real person" or anything similar, answer honestly: "I'm Oto, Otopair's AI car concierge. I can answer car questions and show you how the app works." Do not lead with the disclosure — only if asked.

# Answer structure
- Lead with the answer or the most-likely explanation FIRST. Never open with questions.
- Reassure when true ("nothing wrong with the car itself").
- Then ask AT MOST ONE question, and only if its answer changes what you'd say next.

# Diagnostic traversal
- You hold the decision tree internally. NEVER list multiple possible causes and ask "which applies to you?" That makes the user do the diagnosis. It is a failure.
- Ask the single question whose answer eliminates the MOST causes, not one that confirms a single cause. Before asking, check: "Does this answer rule out roughly half the possibilities?"
- One question per message. Resolve most issues in 2-3 questions total.
- If the user has already given you enough to determine the cause, DO NOT ask another question. State the conclusion and move on.

# Truth gate (non-negotiable)
- You may state a fact specific to THIS vehicle (its make, a spec, a service-due date, last service, mileage) ONLY if it came from the decode_vin tool result OR the user told you directly in this conversation. If you don't have it, say you don't.
- A maintenance interval ("every 12 months") is NOT a due date. Never convert recurrence into "due in X weeks."
- General automotive knowledge is open — answer freely. The restriction is ONLY on facts specific to this car.

# Restraint
- Answer what was asked. Do not volunteer bookings, maintenance verdicts, or service menus the user didn't ask about.
- Offer the app handoff only when the conversation has reached a point where the user clearly wants action ("how do I book", "I'm ready", "find me a shop"). Even then it is ONE calm, optional line.
- Accept "no" in one turn. Do not re-pitch.

# Pivot respect
The user can change direction at any point. The CURRENT turn's intent always wins.
- BANNED phrasings: "but first you confirmed...", "I hear you, but let me get that booked anyway", "before we do X, let's finish Y".
- If the user pivots, honor the pivot immediately. Drop the prior intent gracefully.

# Wording
- Never expose internal architecture. No "catalog", "pipeline", "record row", "service state", "vehicle context", "knowledge base". Say the true thing in plain language.
- Concise. No stacked questions. No filler. No emoji. No exclamation marks except in actual exclamations.

# The conversion mechanism — VIN handoff
When a visitor asks a car-specific question ("how much for brake pads", "do you service my Audi", "my check engine light is on"), you cannot answer with real numbers until you know the car. Ask for the VIN. Phrasing: "I'd love to give you a real answer — what's the VIN on your car? Or just tell me the year, make, and model and I'll work with that."

When you have a VIN, call the decode_vin tool. Use the returned year/make/model/trim/engine/oil/etc. to give a real, anchored answer. As you walk through the question, mention casually: "I'm building your car in the app as we talk — when we're done, you can hop into Otopair and pick up right where we left off."

# The demo booking flow
You can run a full demo of how booking works. This is the marketing showpiece. The visitor experiences picking a service, seeing a shop and a mechanic, picking a time slot, and seeing a transparent price breakdown — all live in conversation. Shops, mechanic names, slot times, and prices in the demo are illustrative examples. If a visitor asks directly "is this a real shop?" or "is this a real booking?", be honest: "This is a preview of how the app works — real shops and live slots are in the app. Want me to set you up there?"

You can quote example prices in the demo: transparent labor + parts + 7% fee, all broken out. Use plausible numbers. Reference the KB pricing rules: labor = shop hourly rate × labor time for that car, parts = OEM/equivalent quoted at the high end, plus 7% platform fee. Tires are quoted live by shops — not pre-priced.

# The warm-account handoff (your most important tool call)
When the visitor:
- Has shared a VIN AND
- Has expressed interest in booking, downloading the app, or "trying it for real"

...call save_warm_account with what you've gathered (email if you have it, VIN, vehicle, symptom if discussed, recommended service if relevant). The tool creates their Otopair account, loads the car, seeds the conversation context for the mobile app, and triggers an email magic-link.

Phrasing: "I've got your car ready in the app and a $25 credit set up for when you book your first service. I'll send the download link to your email — should I use [email]?" If they give you an email different from one already provided, use the new one.

If the user has not given an email yet, ask for it gently after you've delivered value, never as the first thing.

# Lead capture (lighter touch, no signup)
If the visitor doesn't want an account but seems interested, call capture_lead with just email or phone. Phrasing: "Want me to send you the app link and a heads-up when we launch in your area? Just need an email." This is the soft path for visitors not ready to sign up.

# Partner / mechanic signup
If the visitor identifies as a mechanic or shop owner, call partner_signup_interest with their info. Phrasing: "If you run a shop and want to learn more about being on Otopair, the team handles vetting in person — let me grab your contact info and they'll reach out."

# What you do NOT do
- No real bookings. The booking demo is a preview. Real bookings are in the app.
- No real user data access. You don't see anyone's account.
- No medical / legal / diagnostic advice. "If you're not sure what's wrong, the right move is to book a diagnostic with an Otopair mechanic — they look at the car in person."
- No claims about services Otopair doesn't currently offer. Per the KB: every gap is "in testing" or "coming soon" or "on the roadmap as we expand."
- No naming of real specific mechanics. Demo names are illustrative; clarify if asked.
- No PII collection beyond VIN and email. No full name, no address, no payment info.
- Never mention NHTSA, Convex, Clerk, ElevenLabs, Anthropic, or any vendor. The framing is always "Otopair's internal vehicle intelligence" or "our system."

# Tools available
- decode_vin: pass a VIN string, get back year/make/model/trim/engine/oil specs
- save_warm_account: create the user's Otopair account with their car pre-loaded
- capture_lead: lighter — just email/phone capture
- partner_signup_interest: for mechanics or shop owners

Call tools when they help. Don't narrate the call. Don't say "let me check our database" — just call it and use the result naturally.

# Geography
Otopair launches in Staten Island first, then Brooklyn, Queens, Bronx, Manhattan in that order. Outside NYC: "on the roadmap, sign up to hear when we get there." Never claim coverage we don't have.

# Tone safeguard
If at any point a visitor seems frustrated, confused, or annoyed: acknowledge it briefly, drop any sales motion, answer their question as cleanly as possible. Trust comes from doing the right thing in friction moments.
```

### 1.5 Knowledge base RAG config (already uploaded, tune settings)
1. Agent config → **Knowledge base**
2. Confirm `Oto Knowledge Base v1.docx` is listed and shows status: **Indexed** ✓
3. Click **Advanced settings** under "Use RAG":
   - **Embedding model:** `text-embedding-3-large` (best quality)
   - **Max document chunks:** `6` (good balance — enough context, not too noisy)
   - **Max vector distance:** `0.6` (semantic similarity threshold; tighter = more on-topic but might miss tangents)
4. Toggle **Use RAG** to **ON**

**Recommendation:** add 2 more docs to the KB for better coverage:
- A **Symptoms Q&A doc** — 50 common car symptom questions with concierge-grade answers (you/your team writes this; aim for ~2 pages)
- A **Top 50 vehicle specs doc** — export from your Convex `vehicle_facts` for the most common cars in NYC (Toyota Camry, Honda Civic, Ford F-150, etc.). One paragraph per vehicle covering engine, oil, common issues. Exports to PDF/HTML.

These give the agent grounded answers for "what oil does X take" type questions without needing the `decode_vin` tool every turn.

### 1.6 Conversation flow settings
Agent config → **Conversation flow** tab:

| Setting | Value | Why |
|---|---|---|
| Max conversation duration | `600` (seconds = 10 min) | Cost guardrail |
| Idle timeout | `15` seconds | Hang up if visitor stops talking |
| Turn timeout | `30` seconds | Hang up if the model can't respond in 30s |
| Server VAD | ON | Better turn-taking |
| Interruption sensitivity | Medium | Lets visitor interrupt naturally |

---

## 2. Convex webhook endpoints (~90 min)

Build four `httpAction` endpoints. These live at `https://<your-deployment>.convex.site/<endpoint>` once deployed.

### 2.1 Schema additions (run first)
Add to `convex/schema.ts`:

```typescript
// Marketing-acquired user fields (extend existing users table)
   marketing_acquired: v.optional(v.boolean()),
   marketing_acquired_at: v.optional(v.number()),
   marketing_acquired_source: v.optional(v.string()),  // "voice_demo" | "static_signup"
   first_app_open_at: v.optional(v.number()),
   marketing_utm: v.optional(v.object({
     source: v.optional(v.string()),
     medium: v.optional(v.string()),
     campaign: v.optional(v.string()),
   })),

// New table: marketing_leads (light lead capture, no signup)
marketing_leads: defineTable({
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  zip: v.optional(v.string()),
  source: v.string(),                                // "voice_demo_lead_capture" etc
  vehicle_described: v.optional(v.object({
    year: v.optional(v.number()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
  })),
  symptom_described: v.optional(v.string()),
  voice_conversation_id: v.optional(v.string()),
  consent_marketing: v.boolean(),
  converted_to_user_id: v.optional(v.id("users")),
  created_at: v.number(),
})
  .index("by_email", ["email"])
  .index("by_phone", ["phone"])
  .index("by_created_at", ["created_at"]),

// New table: partner_signup_interest
partner_signup_interest: defineTable({
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  shop_name: v.optional(v.string()),
  borough: v.optional(v.string()),
  shop_size: v.optional(v.string()),       // "1-3 bays" | "4-8" | "9+"
  voice_conversation_id: v.optional(v.string()),
  contacted_at: v.optional(v.number()),
  created_at: v.number(),
})
  .index("by_email", ["email"])
  .index("by_created_at", ["created_at"]),
```

Run `npx convex dev` to push the schema.

### 2.2 The router file: `convex/http.ts`

If you don't have this yet, create it. This registers HTTP endpoints to Convex:

```typescript
import { httpRouter } from "convex/server";
import { decodeVinHttp } from "./marketingVin";
import { captureLeadHttp } from "./marketingLeads";
import { saveWarmAccountHttp } from "./marketingWarmAccount";
import { partnerSignupHttp } from "./marketingPartner";

const http = httpRouter();

http.route({
  path: "/decode_vin",
  method: "POST",
  handler: decodeVinHttp,
});

http.route({
  path: "/capture_lead",
  method: "POST",
  handler: captureLeadHttp,
});

http.route({
  path: "/save_warm_account",
  method: "POST",
  handler: saveWarmAccountHttp,
});

http.route({
  path: "/partner_signup_interest",
  method: "POST",
  handler: partnerSignupHttp,
});

export default http;
```

### 2.3 `convex/marketingVin.ts` — VIN decode

```typescript
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

export const decodeVinHttp = httpAction(async (ctx, request) => {
  // Verify the request is from ElevenLabs (see §2.7 below for shared secret)
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.ELEVENLABS_WEBHOOK_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: { vin?: string };
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const vin = (payload.vin || "").trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return new Response(JSON.stringify({
      ok: false,
      error: "invalid_vin",
      message: "VIN must be 17 characters, letters and digits only (no I, O, Q).",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  try {
    // Reuse your existing NHTSA wrapper. If you have a different decode path,
    // swap this call accordingly.
    const decoded = await ctx.runAction(api.vehicleEnrichment.decodeVin, { vin });

    // Return a shape the voice agent can speak naturally
    return new Response(JSON.stringify({
      ok: true,
      vin,
      year: decoded.year ?? null,
      make: decoded.make ?? null,
      model: decoded.model ?? null,
      trim: decoded.trim ?? null,
      engine: decoded.engine_display ?? null,
      drivetrain: decoded.drivetrain ?? null,
      oil_spec: decoded.oil_viscosity ?? null,
      // Don't include internal IDs — the agent should never see Convex _ids
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[decode_vin] error", err);
    return new Response(JSON.stringify({
      ok: false,
      error: "decode_failed",
      message: "Couldn't decode this VIN. Double-check it's 17 characters with no spaces.",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});
```

### 2.4 `convex/marketingLeads.ts` — Lead capture (no signup)

```typescript
import { httpAction, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const create = mutation({
  args: {
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    zip: v.optional(v.string()),
    source: v.string(),
    vehicle_described: v.optional(v.object({
      year: v.optional(v.number()),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
    })),
    symptom_described: v.optional(v.string()),
    voice_conversation_id: v.optional(v.string()),
    consent_marketing: v.boolean(),
  },
  handler: async (ctx, args) => {
    const leadId = await ctx.db.insert("marketing_leads", {
      ...args,
      created_at: Date.now(),
    });
    // Optional: trigger Slack notification, email follow-up, etc.
    return leadId;
  },
});

export const captureLeadHttp = httpAction(async (ctx, request) => {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.ELEVENLABS_WEBHOOK_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await request.json();
  const leadId = await ctx.runMutation(internal.marketingLeads.create, {
    email: payload.email,
    phone: payload.phone,
    zip: payload.zip,
    source: payload.source || "voice_demo_lead_capture",
    vehicle_described: payload.vehicle_described,
    symptom_described: payload.symptom_described,
    voice_conversation_id: payload.voice_conversation_id,
    consent_marketing: payload.consent_marketing ?? true,
  });

  return new Response(JSON.stringify({ ok: true, leadId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### 2.5 `convex/marketingWarmAccount.ts` — The big one: create user + load car + seed context

This is where Convex meets Clerk. The Convex side calls Clerk's Backend API to create the user, then writes the Convex rows that the mobile app will read.

```typescript
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

export const saveWarmAccountHttp = httpAction(async (ctx, request) => {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.ELEVENLABS_WEBHOOK_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const {
    email,
    vehicle,           // { year, make, model, trim?, vin? }
    symptom,
    recommended_service,
    estimated_cost_range,
    conversation_id,
    consent_marketing,
  } = await request.json();

  if (!email || typeof email !== "string") {
    return new Response(JSON.stringify({
      ok: false,
      error: "email_required",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // ─── 1. Create Clerk user (returns clerk_user_id) ─────────────────────
  // Clerk Backend API: https://clerk.com/docs/reference/backend-api/tag/Users
  // POST https://api.clerk.com/v1/users  with email_address[]
  let clerkUserId: string;
  try {
    const clerkRes = await fetch("https://api.clerk.com/v1/users", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: [email],
        skip_password_requirement: true,  // Clerk allows passwordless signup
      }),
    });
    if (!clerkRes.ok) {
      const body = await clerkRes.text();
      // If user already exists, look up the existing one
      if (clerkRes.status === 422) {
        const lookup = await fetch(
          `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
          { headers: { "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}` } }
        );
        const users = await lookup.json();
        if (Array.isArray(users) && users.length > 0) {
          clerkUserId = users[0].id;
        } else {
          throw new Error(`Clerk user lookup failed: ${body}`);
        }
      } else {
        throw new Error(`Clerk create failed: ${clerkRes.status} ${body}`);
      }
    } else {
      const created = await clerkRes.json();
      clerkUserId = created.id;
    }
  } catch (err) {
    console.error("[save_warm_account] Clerk error", err);
    return new Response(JSON.stringify({
      ok: false,
      error: "clerk_failed",
      message: "Couldn't create the account. The email might already be in use — try signing in instead.",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // ─── 2. Create / find Convex users row ────────────────────────────────
  // Your existing Clerk webhook may already create the user when Clerk fires
  // its `user.created` event. To avoid races, we look up first then create.
  let userId = await ctx.runQuery(api.users.getByClerkUserId, {
    clerkUserId,
  }).then(u => u?._id);

  if (!userId) {
    userId = await ctx.runMutation(internal.users.createMarketingAcquired, {
      clerkUserId,
      email,
      marketing_acquired: true,
      marketing_acquired_at: Date.now(),
      marketing_acquired_source: "voice_demo",
    });
  } else {
    // Existing user — just stamp marketing fields
    await ctx.runMutation(internal.users.markMarketingAcquired, {
      userId,
      source: "voice_demo",
    });
  }

  // ─── 3. Resolve / create vehicle row ──────────────────────────────────
  // If we have a VIN, use the VIN decode path. If only YMM, use the
  // YMM-lookup path. Both already exist in your enrichment pipeline.
  let vehicleId: string | undefined;
  if (vehicle?.vin) {
    vehicleId = await ctx.runMutation(internal.vehicles.addByVinForUser, {
      user_id: userId,
      vin: vehicle.vin.toUpperCase(),
      marketing_source: "voice_demo",
    });
  } else if (vehicle?.year && vehicle?.make && vehicle?.model) {
    vehicleId = await ctx.runMutation(internal.vehicles.addByYMMForUser, {
      user_id: userId,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      marketing_source: "voice_demo",
    });
  }

  // ─── 4. Seed conversation_facts so mobile Oto has context on first turn ──
  if (vehicleId && symptom) {
    const seedText = recommended_service
      ? `User reported "${symptom}" during web voice demo; recommended ${recommended_service}${estimated_cost_range ? ` (estimated ${estimated_cost_range})` : ""}.`
      : `User reported "${symptom}" during web voice demo.`;

    await ctx.runMutation(internal.oto.memoryEditing.recordSeedFact, {
      user_id: userId,
      vehicle_id: vehicleId,
      payload_text: seedText,
      written_by: "marketing_web",
    });
  }

  // ─── 5. Issue $25 welcome credit (optional, per launch plan §0.6) ─────
  // If you have a credits table; skip if not yet built.
  try {
    await ctx.runMutation(internal.credits.issueWelcomeCredit, {
      user_id: userId,
      amount_cents: 2500,
      reason: "marketing_voice_demo_signup",
    });
  } catch (err) {
    console.warn("[save_warm_account] credits not configured, skipping", err);
  }

  // ─── 6. Send magic-link email via Clerk ───────────────────────────────
  try {
    await fetch(`https://api.clerk.com/v1/users/${clerkUserId}/send_magic_link`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        redirect_url: "https://otopair.com/onboard/success",
      }),
    });
  } catch (err) {
    console.warn("[save_warm_account] magic link send failed", err);
  }

  // ─── 7. Mark any related marketing_leads as converted ─────────────────
  if (conversation_id) {
    await ctx.runMutation(internal.marketingLeads.markConvertedByConvId, {
      voice_conversation_id: conversation_id,
      converted_to_user_id: userId,
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    message: "Account created. We've emailed you a sign-in link.",
    user_id: userId,
    has_credit: true,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
```

### 2.6 `convex/marketingPartner.ts` — Partner / mechanic signup

```typescript
import { httpAction, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const createPartnerInterest = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    shop_name: v.optional(v.string()),
    borough: v.optional(v.string()),
    shop_size: v.optional(v.string()),
    voice_conversation_id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("partner_signup_interest", {
      ...args,
      created_at: Date.now(),
    });
  },
});

export const partnerSignupHttp = httpAction(async (ctx, request) => {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.ELEVENLABS_WEBHOOK_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await request.json();
  const id = await ctx.runMutation(internal.marketingPartner.createPartnerInterest, payload);

  // Slack notification (optional, recommended for partner leads)
  if (process.env.SLACK_PARTNER_LEADS_WEBHOOK) {
    fetch(process.env.SLACK_PARTNER_LEADS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🔧 Partner lead from voice demo:\n` +
              `*Name:* ${payload.name || "—"}\n` +
              `*Shop:* ${payload.shop_name || "—"}\n` +
              `*Borough:* ${payload.borough || "—"}\n` +
              `*Email:* ${payload.email || "—"}\n` +
              `*Phone:* ${payload.phone || "—"}`,
      }),
    }).catch(() => {});  // fire-and-forget
  }

  return new Response(JSON.stringify({
    ok: true,
    message: "Thanks — the team will reach out within 1-2 business days.",
    id,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
```

### 2.7 Set env vars in Convex

```bash
npx convex env set ELEVENLABS_WEBHOOK_SECRET <random-32-char-string>
npx convex env set CLERK_SECRET_KEY <your-clerk-secret-key>
npx convex env set SLACK_PARTNER_LEADS_WEBHOOK <optional-slack-url>
```

Generate the webhook secret with:
```bash
openssl rand -hex 32
```

This shared secret authenticates the ElevenLabs → Convex direction so randos on the internet can't hit your endpoints.

### 2.8 Push to Convex

```bash
npx convex deploy
```

Your endpoints are now live at:
- `https://<deployment>.convex.site/decode_vin`
- `https://<deployment>.convex.site/capture_lead`
- `https://<deployment>.convex.site/save_warm_account`
- `https://<deployment>.convex.site/partner_signup_interest`

---

## 3. Wire the webhooks into ElevenLabs (~30 min)

For each Convex endpoint, you create a corresponding tool in ElevenAgents.

### 3.1 Tool: decode_vin

ElevenAgents dashboard → your agent → **Tools** tab → **Add tool** → **Webhook**:

| Field | Value |
|---|---|
| **Name** | `decode_vin` |
| **Description** | `Decode a vehicle identification number (VIN) and return year, make, model, trim, engine, and oil specifications. Call this whenever the visitor shares a VIN — typically a 17-character alphanumeric string.` |
| **URL** | `https://<deployment>.convex.site/decode_vin` |
| **Method** | POST |
| **Auth header** | `Authorization: Bearer <ELEVENLABS_WEBHOOK_SECRET>` |
| **Body parameters** | `vin` (string, required) |

### 3.2 Tool: capture_lead

| Field | Value |
|---|---|
| **Name** | `capture_lead` |
| **Description** | `Capture a lead — visitor's contact info plus any context from the conversation — without creating a full account. Use when the visitor wants to "hear more" or "be notified" but isn't ready to sign up. Always confirm consent before calling.` |
| **URL** | `https://<deployment>.convex.site/capture_lead` |
| **Method** | POST |
| **Auth header** | `Authorization: Bearer <ELEVENLABS_WEBHOOK_SECRET>` |
| **Body parameters** | `email` (string, optional), `phone` (string, optional), `zip` (string, optional), `vehicle_described` (object, optional), `symptom_described` (string, optional), `consent_marketing` (boolean, required) |

### 3.3 Tool: save_warm_account

| Field | Value |
|---|---|
| **Name** | `save_warm_account` |
| **Description** | `Create the visitor's Otopair account with their car pre-loaded so they can pick up in the app where the conversation left off. Requires email plus vehicle (year/make/model OR VIN). Pass any symptom and recommended service from the conversation as context — these will be visible to the in-app Oto when the user opens it. Returns a confirmation message to relay to the user.` |
| **URL** | `https://<deployment>.convex.site/save_warm_account` |
| **Method** | POST |
| **Auth header** | `Authorization: Bearer <ELEVENLABS_WEBHOOK_SECRET>` |
| **Body parameters** | `email` (string, required), `vehicle` (object: `{year, make, model, trim?, vin?}`, required), `symptom` (string, optional), `recommended_service` (string, optional), `estimated_cost_range` (string, optional), `consent_marketing` (boolean, required) |

### 3.4 Tool: partner_signup_interest

| Field | Value |
|---|---|
| **Name** | `partner_signup_interest` |
| **Description** | `Capture interest from a mechanic or shop owner who wants to learn about joining Otopair as a partner shop. The Otopair team handles vetting in person, so this just routes a lead to the partnerships team — no automated onboarding.` |
| **URL** | `https://<deployment>.convex.site/partner_signup_interest` |
| **Method** | POST |
| **Auth header** | `Authorization: Bearer <ELEVENLABS_WEBHOOK_SECRET>` |
| **Body parameters** | `name` (string, optional), `email` (string, optional), `phone` (string, optional), `shop_name` (string, optional), `borough` (string, optional), `shop_size` (string, optional) |

### 3.5 Per-tool description tips

The `description` field is the most important. ElevenLabs feeds these straight to the LLM as tool descriptions, and the LLM decides when to call based on them. Rules:

- **Start with the verb.** "Decode a VIN…" not "This tool decodes…"
- **Describe what it does, not how.** No mention of Convex or NHTSA.
- **Mention the trigger.** "Call this when the visitor shares a VIN" tells the model when to fire.
- **Be honest about side effects.** If a tool creates an account, say it creates an account. The LLM won't call it surprise-style if it knows.

---

## 4. The Clerk connection — what it is, what to do

Two integration points for Clerk in this setup:

### 4.1 Clerk → Convex (already exists on your mobile side)

When Clerk creates a user (via signup OR via the `save_warm_account` Backend API call above), it fires a webhook to your Convex deployment. Your existing Clerk webhook handler in `convex/users.ts` (likely an `httpAction` named something like `clerkWebhook` or `handleClerkUser`) listens for `user.created` events and creates the corresponding `users` row in Convex.

**Verify this exists.** If it doesn't, the warm-account flow will create a Clerk user but no Convex row, and the mobile app won't find them on sign-in.

To check:
```bash
grep -r "user.created" convex/
grep -r "svix" convex/
grep -r "clerk" convex/users.ts
```

If found: good, it's wired.
If not found: you'll need to wire the Clerk webhook. Clerk docs: <https://clerk.com/docs/integrations/webhooks/sync-data>.

### 4.2 Convex → Clerk (new, for warm signup)

The `save_warm_account` endpoint in §2.5 calls Clerk's Backend API directly to create the user. This requires `CLERK_SECRET_KEY` in your Convex env. Steps:

1. Clerk dashboard → **API keys** → copy the **Secret key** (starts with `sk_live_` or `sk_test_`)
2. Set it in Convex: `npx convex env set CLERK_SECRET_KEY sk_...`
3. The `save_warm_account` code already uses `process.env.CLERK_SECRET_KEY`

**One subtle thing:** when Convex creates a Clerk user via the Backend API, Clerk *also* fires its `user.created` webhook to your existing Clerk webhook handler in §4.1 — which would try to create another Convex `users` row. That's why the code in §2.5 does a lookup first via `api.users.getByClerkUserId` before creating. Idempotent.

---

## 5. Embed on the marketing site (~30 min)

In your Next.js / React marketing site:

```bash
npm install @elevenlabs/react
```

Then a component:

```typescript
"use client";

import { useConversation } from "@elevenlabs/react";
import { useState } from "react";

export function OtoVoiceAgent() {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "ended">("idle");

  const conversation = useConversation({
    onConnect: () => setStatus("connected"),
    onDisconnect: () => setStatus("ended"),
    onError: (err) => console.error("[OtoAgent]", err),
  });

  const start = async () => {
    setStatus("connecting");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      // User denied mic — fall back to text mode (not shown)
      console.warn("Mic denied — should fall back to text input");
      return;
    }
    await conversation.startSession({
      agentId: process.env.NEXT_PUBLIC_ELEVENLABS_OTO_AGENT_ID!,
    });
  };

  const stop = async () => {
    await conversation.endSession();
    setStatus("ended");
  };

  return (
    <div className="oto-voice-widget">
      <button
        onClick={status === "connected" ? stop : start}
        className="oto-mic-button"
      >
        {status === "idle" && "Talk to Oto"}
        {status === "connecting" && "Connecting..."}
        {status === "connected" && (conversation.isSpeaking ? "Oto is speaking..." : "Listening...")}
        {status === "ended" && "Start again"}
      </button>
    </div>
  );
}
```

Get the agent ID from the ElevenAgents dashboard → your agent → **Settings** → **Agent ID** (top right). Set as `NEXT_PUBLIC_ELEVENLABS_OTO_AGENT_ID` in `.env.local`.

---

## 6. Testing checklist (~30 min)

Walk through these scenarios in the ElevenAgents dashboard's **Test** tab before going live:

### 6.1 Tool call sanity
| Scenario | Expected tool call |
|---|---|
| "Hey, my VIN is 5UXKR0C53J0Y12345" | `decode_vin({vin: "5UXKR0C53J0Y12345"})` |
| "My brakes are squealing — can I get the app?" | After collecting email: `save_warm_account` |
| "Just send me the app link, email is test@x.com" | `capture_lead` |
| "I own a repair shop, want to join" | `partner_signup_interest` |

### 6.2 Restraint + truth gate
| Scenario | Expected behavior |
|---|---|
| "What oil does my car take?" (no VIN given) | Asks for VIN OR year/make/model. Does NOT make up a number. |
| "How much for brake pads?" (no car given) | Asks for VIN. Does NOT quote a number. |
| "Are you a real person?" | "I'm Oto, Otopair's AI car concierge..." (honest disclosure) |
| User pivots mid-conversation ("never mind, can I see the app?") | Drops prior thread, surfaces app handoff. No "but first..." |
| "Do you have a warranty?" | Per KB: warranties depend on shop and part. Otopair doesn't provide platform-wide warranty. |

### 6.3 Demo booking flow
- Visitor shares VIN → Oto decodes
- Visitor: "I need an oil change, how much?"
- Oto: walks through demo with example shop, example mechanic name, transparent price breakdown
- Visitor: "Is this a real booking?" → Oto: "This is a preview — real booking is in the app. Want me to set you up?"
- → `save_warm_account` fires with collected info

### 6.4 Live data verification

After a test session that fires `save_warm_account`:
1. Check Convex `users` table — new row with `marketing_acquired: true`?
2. Check Convex `vehicles` + `vehicle_owners` — new row linked to that user?
3. Check Convex `conversation_facts` — seed row with the symptom?
4. Check Clerk dashboard → Users — new user with the email?
5. Check email inbox — Clerk magic link arrived?

If all 5: 🎉 you're wired correctly.

If anything missing: check Convex function logs (`npx convex logs`) for errors from the webhook. Most likely: `CLERK_SECRET_KEY` env var not set, or one of the existing internal mutations (`internal.users.createMarketingAcquired`, `internal.vehicles.addByVinForUser`, etc.) doesn't exist yet under that name — adapt the code in §2.5 to match your actual mutation names.

---

## 7. What's left after this guide

Once §1–§6 are done, the voice agent is live and wired. Pre-launch checklist:

- [ ] Add the 2 additional KB docs (Symptoms Q&A, Top 50 vehicle specs) for stronger RAG coverage
- [ ] Add at least 3 paid test sessions to make sure billing meter works correctly
- [ ] Set ElevenLabs budget alert at 50% / 80% / 100% of monthly cap
- [ ] Add a feature flag on the marketing site so you can roll out to 10% → 100% gradually
- [ ] Decide on AI disclosure pattern in the FIRST turn — current prompt does it "if asked"; some teams prefer always-explicit
- [ ] Write the email magic-link template in Clerk dashboard to match Otopair brand
- [ ] Test on iOS Safari (the most common mobile browser, often has WebRTC quirks)
- [ ] Test on a slow 4G connection — voice agents degrade badly under packet loss

After launch:
- Set up a weekly review: pull 20 random conversation transcripts, score against expected behavior
- Watch the funnel: voice click → conversation start → lead/account capture → app download → first booking
- Iterate: add KB content for any topics the agent says "I don't know that" on

---

## Appendix A — One small KB doc fix

Your KB doc header says `Surface: autopair.com` but every CTA, the shop portal, and the partner sign-up all say `otopair.com`. Worth a one-character fix to the doc before final ingestion so the agent's grounded URL references are consistent.

## Appendix B — Cost summary at expected scale

| Item | Monthly cost (1,000 demos × 3 min avg) |
|---|---|
| ElevenLabs ElevenAgents — Premium tier ($0.12/min) | $360 |
| ElevenLabs Pro plan (Voice Lab + concurrent quota) | $99 |
| Clerk (existing — no additional cost for marketing path) | $0 |
| Convex compute for webhooks | <$10 |
| **Total** | **~$469/month** |

Per warm-account creation: ~$3 in voice + ~$0.25 in Clerk + $0 in Convex = ~$3.25.
At 30% conversation→warm-account conversion → 300 warm accounts/mo at ~$1.56/account total cost.
For automotive, paid acquisition cost averages $40–$80 per signup. So **$1.56/account is ~50× cheaper than paid search** at the same intent level.
