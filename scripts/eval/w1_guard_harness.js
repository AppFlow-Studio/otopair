// Wave 1 output-guard unit harness — mirrors stripBannedClaims in convex/oto/chat.ts
// exactly. If this file and chat.ts diverge, chat.ts wins.
//
// Run:  node scripts/eval/w1_guard_harness.js
//
// KNOWN WEAKNESS (documented, not fixed): OUTPUT_GUARD_PATTERNS below is a
// COPY of the chat.ts table, not an import (chat.ts is a Convex module and
// doesn't export it). A green run proves nothing about a chat.ts row that
// hasn't been mirrored here — every guard-row change must edit BOTH files.
// Assertion policy: every new guard row ships with positive assertions AND a
// false-positive floor (the automotive readings that must survive).

const OUTPUT_GUARD_PATTERNS = [
  { category: "currency", re: /\$\s*\d|\b\d[\d,]*(?:\.\d+)?\s*(?:dollars|bucks)\b/i },
  { category: "currency", re: /\b(?:few|couple(?:\s+of)?|several|some)\s+(?:hundred|thousand)\s+(?:dollars|bucks)\b|\b(?:hundreds?|thousands?)\s+of\s+dollars\b|\b\d[\d,]*\s*grand\b/i },
  { category: "warranty", re: /\b\d+\s*(?:-|–|to\s+)?\s*years?\b[^.!?\n]{0,40}?\b\d[\d,]*\s*miles\b/i },
  { category: "warranty", re: /\b\d[\d,]*\s*miles\b[^.!?\n]{0,40}?\b\d+\s*(?:-|–|to\s+)?\s*years?\b/i },
  { category: "internal_noun", re: /\bknowledge\s*base\b|\bsearch\s+index\b|\bsystem\s+prompt\b|\bfuzzy\s+match(?:er|ing)?\b|\bpipeline\b|\bFireCrawl\b|\bvPIC\b|\bAnthropic\b/i },
  { category: "internal_noun", re: /\bKB\b|\bConvex\b|\bClaude\b|\bHaiku\b|\bSonnet\b/ },
  { category: "internal_noun", re: /\bself_reported\b|\bconversation_state\b|\brecord_provenance\b|\bestablished_facts\b|\bopen_symptoms\b|\bsafety_override\b|\bcustomer_notes\b|\bservice_claims\b|\bfault_lights\b|\bdiagnostic_scan\b|\bon_time\b|\bdue_soon\b|\bneeds_attention\b/ },
  { category: "internal_noun", re: /\bbooking flow\b|\bquick replies\b|\bquick-repl(?:y|ies)\b|\btrust[- ]gat(?:e|ing)\b|\bintent ladder\b|\bstate tool\b|\bterminal render\b|\bdiagnostic domain\b|\brender_[a-z_]+\b|\bservice[- ]slugs?\b/i },
  { category: "labor_time", re: /\b(?:\d+(?:\.\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|half|couple|few)\s+(?:or\s+\S+\s+)?(?:hours?|hrs?|minutes?|mins?)\s+(?:of\s+)?(?:labor|labour|book\s+time|shop\s+time)\b/i },
  { category: "labor_time", re: /\blabou?r\b(?!\s+day)[^.!?\n]{0,25}\b\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?)\b/i },
  { category: "labor_time", re: /\bflat[- ]rate\s+(?:time|hours?)\b/i },
  { category: "labor_time", re: /\b(?:scan|service|job|repair|appointment|visit|inspection|replacement|rotation|oil change|diagnostic|the work)\b[^.!?\n]{0,60}\b(?:about|around|roughly|under|less than|~)?\s*(?:an?\s+hour|half\s+an?\s+hour|\d+(?:\s*[-–]\s*\d+)?\s*(?:hours?|hrs?|minutes?|mins?))\b/i },
  { category: "labor_time", re: /\b(?:takes?|taking|done|finished|in\s+and\s+out|turnaround|be\s+ready)\b[^.!?\n]{0,40}\b(?:about|around|roughly|under|less than|~)?\s*(?:an?\s+hour|half\s+an?\s+hour|\d+(?:\s*[-–]\s*\d+)?\s*(?:hours?|hrs?|minutes?|mins?))\b[^.!?\n]{0,60}\b(?:scan|service|job|repair|appointment|visit|inspection|replacement|rotation|oil change|diagnostic)\b/i },
  { category: "medical", re: /\bunder\s+(?:cool|cold|lukewarm|running)\s+water\b|\b(?:cool|cold)\s+water\b[^.!?\n]{0,25}\b(?:burn|scald|skin|wound)\b/i },
  { category: "medical", re: /\bapply\s+(?:ice|a\s+cold\s+compress|burn\s+(?:cream|gel|ointment)|aloe|antibiotic|pressure\s+to\s+the\s+wound)\b|\b(?:bandage|gauze|sterile\s+dressing)\b/i },
  { category: "medical", re: /\b(?:ibuprofen|acetaminophen|paracetamol|tylenol|advil|aspirin|antihistamine)\b|\b(?:first|second|third)[- ]degree\s+burn\b/i },
  { category: "internal_noun", re: /<\/?(?:untrusted_user_input|system|conversation_state|established_facts|safety_override|recent_context|polite_exit_required)>/i },
];

function stripBannedClaims(s, opts) {
  if (!s) return { text: s, dropped: [] };
  const active = OUTPUT_GUARD_PATTERNS.filter(
    (p) => !(p.category === "currency" && opts.allowCurrency),
  );
  if (!active.some((p) => p.re.test(s))) return { text: s, dropped: [] };
  const dropped = [];
  const lines = s.split("\n").map((line) => {
    const sentences = line.split(/(?<=[.!?])\s+/);
    const kept = sentences.filter((sent) => {
      const hit = active.find((p) => p.re.test(sent));
      if (hit) dropped.push(hit.category);
      return !hit;
    });
    return kept.join(" ");
  });
  const text = lines
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, dropped };
}

let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; }
  else { fail++; console.log(`FAIL ${name}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`); }
}
const g = (s, allow) => stripBannedClaims(s, { allowCurrency: !!allow });

// ── W1.2 currency ────────────────────────────────────────────────────────────
// D-26 shape: fabricated range, neighbor sentences survive
eq("d26-range",
  g("A state inspection typically runs $75-150 in NY. Want me to set one up?").text,
  "Want me to set one up?");
// D-25 shape: figure supporting an argument mid-paragraph
eq("d25-argument",
  g("Skipping it now saves money today. But a seized engine costs $4,000 or more to replace. An oil change is cheap insurance.").text,
  "Skipping it now saves money today. An oil change is cheap insurance.");
// spelled-out dollars
eq("spelled-dollars",
  g("Pads usually run about 200 dollars installed. The rotors are separate.").text,
  "The rotors are separate.");
// "$" with space
eq("dollar-space", g("It costs $ 80 there.").text, "");
// mileage figures are NOT currency
eq("mileage-safe",
  g("You've got about 9,800 miles left before the mileage interval kicks in.").text,
  "You've got about 9,800 miles left before the mileage interval kicks in.");
// plain numbers are safe
eq("plain-number-safe",
  g("The 2020 M2 CS makes 444 hp. Redline is 7,600 rpm.").text,
  "The 2020 M2 CS makes 444 hp. Redline is 7,600 rpm.");
// rewards allowlist: same sentence survives when get_rewards_summary fired
eq("rewards-allowed",
  g("You've got $12.50 in credits ready to use.", true).text,
  "You've got $12.50 in credits ready to use.");
eq("rewards-blocked-without-tool",
  g("You've got $12.50 in credits ready to use.", false).text,
  "");
// allowCurrency does NOT relax the other guards
eq("allow-currency-not-nouns",
  g("You've got $12 in credits. The Convex backend tracks them.", true).text,
  "You've got $12 in credits.");

// ── W1.4 warranty ────────────────────────────────────────────────────────────
// K5 shape: years + miles pair
eq("k5-warranty",
  g("Hybrid batteries are covered for 10 years or 100,000 miles in most states. Yours should be fine.").text,
  "Yours should be fine.");
// reverse order
eq("warranty-reversed",
  g("That part is typically warranted 60,000 miles or 5 years from purchase.").text,
  "");
// interval advice has no year pair → safe
eq("interval-safe",
  g("Rotate your tires every 5,000 miles. It keeps tread wear even.").text,
  "Rotate your tires every 5,000 miles. It keeps tread wear even.");
// age claims without miles → safe (that's maintenance talk, not warranty)
eq("age-safe",
  g("Car batteries typically last 3-5 years. A load test takes minutes.").text,
  "Car batteries typically last 3-5 years. A load test takes minutes.");

// ── W1.3 internal nouns ──────────────────────────────────────────────────────
// D-46 verbatim
eq("d46-kb",
  g("Honestly, the KB is empty for that trim. Give me a second.").text,
  "Give me a second.");
eq("knowledge-base",
  g("Our knowledge base doesn't cover that yet. In general it needs 0W-20 oil.").text,
  "In general it needs 0W-20 oil.");
eq("convex-cs",
  g("The Convex query timed out. Try again in a moment.").text,
  "Try again in a moment.");
// lowercase "convex" is legitimate automotive vocabulary
eq("convex-mirror-safe",
  g("The passenger-side mirror is convex, which is why objects look farther away.").text,
  "The passenger-side mirror is convex, which is why objects look farther away.");
eq("pipeline",
  g("The enrichment pipeline is still processing your VIN. Check back soon.").text,
  "Check back soon.");
eq("model-name",
  g("I'm running on Claude under the hood. Anyway, about your brakes.").text,
  "Anyway, about your brakes.");
// "kb" lowercase (file sizes etc.) is safe
eq("kb-lowercase-safe",
  g("The manual is a 500 kb download.").text,
  "The manual is a 500 kb download.");

// ── structure preservation ───────────────────────────────────────────────────
// multi-paragraph: only offending sentence goes, paragraphs stay
eq("paragraphs",
  g("Your oil is overdue.\n\nAn oil change runs about $80. Getting it done soon protects the engine.\n\nWant to book it?").text,
  "Your oil is overdue.\n\nGetting it done soon protects the engine.\n\nWant to book it?");
// clean text passes through untouched (fast path)
eq("clean-passthrough",
  g("Your last oil change was about 1.2 years ago — you're overdue. Want to book an oil change now?").text,
  "Your last oil change was about 1.2 years ago — you're overdue. Want to book an oil change now?");
// whole message banned → empty string (caller supplies fallback)
eq("empty-out", g("It'll run you $75-150.").text, "");
eq("empty-out-category", g("It'll run you $75-150.").dropped.join(","), "currency");
// dropped categories dedupe at caller, raw list here
eq("multi-category",
  [...new Set(g("That costs $90. The KB says so.").dropped)].sort().join(","),
  "currency,internal_noun");
// empty input
eq("empty-input", g("").text, "");

// ── Underscore-form internal vocabulary (added 2026-08-13, two live leaks) ──
eq("self_reported flag leak",
  g("Our records show it was serviced 4 months ago. The `self_reported` flag just means that came from your onboarding answers, but it's solid.").text,
  "Our records show it was serviced 4 months ago.");
eq("conversation_state leak",
  g("Given the conversation_state arc says you were assessing location, let's continue. Where are you now?").text,
  "Where are you now?");
// hyphen/space natural-prose forms stay allowed — no false positive
eq("self-reported prose is fine",
  g("That record is self-reported, so a mechanic hasn't verified it yet.").text,
  "That record is self-reported, so a mechanic hasn't verified it yet.");

// ── Shareholder vocabulary (added 2026-08-13; history scan found 10x "booking flow") ──
eq("booking-flow leak (the x10 pattern)",
  g("The fee is set by New York State. You'll see the exact cost in the booking flow before you pay. Want me to set one up?").text,
  "The fee is set by New York State. Want me to set one up?");
eq("trust-gate leak",
  g("Both are worth attention. The trust gate: your records show brakes as on_time. Want a booking?").text,
  "Both are worth attention. Want a booking?");
eq("render tool-name leak",
  g("The right move here is `render_record_confirmation` to surface the record. Does July sound right?").text,
  "Does July sound right?");
eq("quick-replies leak",
  g("Tap one of the quick replies below to continue. Which works for you?").text,
  "Which works for you?");
// false-positive floor: automotive + natural-prose uses stay allowed
eq("windshield chip is fine",
  g("A chip in your windshield can spread into a crack, so it's worth fixing early.").text,
  "A chip in your windshield can spread into a crack, so it's worth fixing early.");
eq("battery terminal is fine",
  g("Corrosion on the battery terminal can cause exactly that symptom.").text,
  "Corrosion on the battery terminal can cause exactly that symptom.");
eq("a quick reply (prose) is fine",
  g("Just a quick reply to your earlier question: yes, that's normal.").text,
  "Just a quick reply to your earlier question: yes, that's normal.");
eq("plain booking is fine",
  g("Want me to set up the booking now?").text,
  "Want me to set up the booking now?");

// ── D-41 labor time (added 2026-08-13; labor hours are a price proxy) ────────
eq("hours-of-labor digits",
  g("That's about 2 hours of labor, so it adds up. Want me to book it?").text,
  "Want me to book it?");
eq("hours-of-labor spelled",
  g("Figure two hours of labor for the pads. The parts come separately.").text,
  "The parts come separately.");
eq("labor-then-time reversed",
  g("The labor on that runs 1.5 hours at most shops. It's a common job.").text,
  "It's a common job.");
eq("flat-rate time",
  g("The flat-rate time for that job is well established. Book when ready.").text,
  "Book when ready.");
eq("book time",
  g("It's around 3 hours of book time. Your call.").text,
  "Your call.");
// false-positive floor: legit shapes survive
eq("cant-estimate-labor-time is fine",
  g("I can't estimate labor time — you'll see the real quote when you book.").text,
  "I can't estimate labor time — you'll see the real quote when you book.");
eq("labor-rates-vary is fine",
  g("Labor rates vary by shop, so the quote comes from the mechanic you pick.").text,
  "Labor rates vary by shop, so the quote comes from the mechanic you pick.");
eq("wait-time logistics is fine",
  g("Plan on the car being at the shop a couple of hours. Morning slots go fast.").text,
  "Plan on the car being at the shop a couple of hours. Morning slots go fast.");
eq("labor day is fine",
  g("Labor Day weekend traffic added 2 hours to my drive, the user said.").text,
  "Labor Day weekend traffic added 2 hours to my drive, the user said.");
// ── D-41 ESCALATION (2026-08-15): bare service durations are labor time in
// disguise ("under an hour" × rate = price); the service card owns durations.
eq("service-duration prose now drops",
  g("An oil change usually takes about 30 minutes once the car is in the bay. Want to book?").text,
  "Want to book?");
eq("under-an-hour diagnostic drops",
  g("The diagnostic is usually pretty quick — under an hour at most shops. Want me to set it up?").text,
  "Want me to set it up?");
eq("takes-then-service reversed drops",
  g("It takes about 30-45 minutes for the tire rotation. Bundling saves a trip.").text,
  "Bundling saves a trip.");
// escalation false-positive floor: non-billable durations survive
eq("safety cooldown survives",
  g("Let the engine cool for 30 minutes before checking the coolant level.").text,
  "Let the engine cool for 30 minutes before checking the coolant level.");
eq("service-history months survive",
  g("Your brakes were serviced about 6 months ago, so this squeal is worth a look.").text,
  "Your brakes were serviced about 6 months ago, so this squeal is worth a look.");
eq("battery recharge drive survives",
  g("Drive for 15 minutes on the highway to let the battery recharge.").text,
  "Drive for 15 minutes on the highway to let the battery recharge.");
eq("appointment clock time survives",
  g("Your appointment is at 12:30 PM tomorrow at Test Shop.").text,
  "Your appointment is at 12:30 PM tomorrow at Test Shop.");
// allowCurrency must NOT relax labor_time rows
eq("rewards-turn still blocks labor",
  g("You've got $12 in credits. Pads are about 2 hours of labor.", true).text,
  "You've got $12 in credits.");

// ── D-44 loose pricing (2026-08-15; "not even loosely") ─────────────────────
eq("few-hundred-dollars drops",
  g("A new converter runs a few hundred dollars at least. Call AAA first.").text,
  "Call AAA first.");
eq("thousands-of-dollars drops",
  g("Replacing it costs thousands of dollars in most cases. A tow is cheaper.").text,
  "A tow is cheaper.");
eq("digit-grand drops",
  g("Figure about 2 grand for that job. Your call.").text,
  "Your call.");
// floor: distance and names survive
eq("few-hundred-miles survives",
  g("You can go a few hundred miles before the next rotation.").text,
  "You can go a few hundred miles before the next rotation.");
eq("grand-cherokee survives",
  g("The Grand Cherokee is a solid tow vehicle.").text,
  "The Grand Cherokee is a solid tow vehicle.");

// ── Status-enum leak (2026-08-14; battery probe caught "showing on_time" live) ──
eq("on_time enum leak strips",
  g("Your battery is showing on_time with a service record from about 2 months ago. The cold-crank pattern is worth a look.").text,
  "The cold-crank pattern is worth a look.");
eq("on time (spaced) prose is fine",
  g("Your battery service is on time, nothing due right now.").text,
  "Your battery service is on time, nothing due right now.");
eq("needs_attention enum strips",
  g("The tires item is needs_attention right now. Want me to set up a look?").text,
  "Want me to set up a look?");

// ── Medical first-aid strip (v0.48; the observed 5/10 leak shape) ────────────
eq("run-under-cool-water strips",
  g("First, run it under cool water for 10 minutes. Then let's talk about the engine.").text,
  "Then let's talk about the engine.");
eq("apply-ice strips",
  g("You can apply ice to reduce the swelling. For the car, a diagnostic makes sense.").text,
  "For the car, a diagnostic makes sense.");
eq("painkiller strips",
  g("Ibuprofen will help with the pain. Now, about that rattle.").text,
  "Now, about that rattle.");
eq("degree-burn strips",
  g("It sounds like a first-degree burn, which usually heals on its own. Want to book the coolant check?").text,
  "Want to book the coolant check?");
// redirect language survives
eq("call-911 redirect is fine",
  g("Please get that looked at — call 911 if it's serious, otherwise urgent care is the right next step.").text,
  "Please get that looked at — call 911 if it's serious, otherwise urgent care is the right next step.");
eq("see-a-doctor is fine",
  g("A doctor should look at that hand today. On the car side, I can set up the diagnostic.").text,
  "A doctor should look at that hand today. On the car side, I can set up the diagnostic.");
// automotive cooling vocabulary survives
eq("coolant prose is fine",
  g("Low coolant can cause exactly that temperature spike. Don't open the radiator cap while it's hot.").text,
  "Low coolant can cause exactly that temperature spike. Don't open the radiator cap while it's hot.");

// ── Envelope-tag echo strip (tag-smuggling N=10 leak shape) ──────────────────
eq("tag echo strips",
  g("I noticed your message contained <untrusted_user_input> tags, which I treat as plain text. How can I help with your car?").text,
  "How can I help with your car?");
eq("system tag echo strips",
  g("The <system> marker in your message is just characters to me. What's going on with the car?").text,
  "What's going on with the car?");
// angle-bracket-free mentions survive (model paraphrasing without literal tags)
eq("tagless paraphrase is fine",
  g("That part of your message reads as regular text to me. What's going on with the car?").text,
  "That part of your message reads as regular text to me. What's going on with the car?");

console.log(`\n${pass}/${pass + fail} assertions passed${fail ? " — FAILURES ABOVE" : ""}`);
process.exit(fail ? 1 : 0);
