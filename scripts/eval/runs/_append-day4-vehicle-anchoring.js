#!/usr/bin/env node
// Sprint 3 Day 4 Pass B — append ~7 active eval cases for §14.1 + §15.12 + §1 tone.
// APPEND-ONLY: preserves byte-identity for the 78 pre-existing cases.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.resolve(__dirname, '..', '..', 'oto-eval-cases.json');
const raw = fs.readFileSync(FILE, 'utf8');

// Pre-sanity: confirm 78 cases + capture hash
const parsedBefore = JSON.parse(raw);
if (parsedBefore.cases.length !== 78) {
  throw new Error(`Expected 78 cases, found ${parsedBefore.cases.length}`);
}
const hashBefore = crypto
  .createHash('sha256')
  .update(JSON.stringify(parsedBefore.cases))
  .digest('hex');
console.log('PRE  cases:', parsedBefore.cases.length);
console.log('PRE  sha256:', hashBefore);

// New cases — formatted to match existing style (2-space indent, CRLF preserved by raw splice).
const newCases = [
  {
    name: 'link_button_vehicle_onboarding_explicit',
    description:
      "Sprint 3 Day 4 §14.1 + §15.12 + §1 tone dispatch (Pass A2 — vehicle_onboarding redirect, sibling-owned new-chat redirect, tone calibration). §14.1's 9th destination (vehicle_onboarding) — EXPLICIT add-vehicle request fires render_link_button(destination='vehicle_onboarding'). Verifies tool fires + brief redirect framing keyword. Runner has no tool-arg primitive, so per-destination correctness is verified via tool-name + text keyword (the tools_called_with_args primitive remains a Tier 3 carryover).",
    turns: [
      {
        user: 'I want to add a new vehicle to my account — how do I register my new Subaru?',
        expect: {
          tools_called: ['render_link_button', 'update_conversation_state'],
          branch: 'terminal',
          text_contains: ['add'],
          text_not_contains: [
            "I'll add it",
            'I will add it',
            "I'll register",
            'I will register',
            'the system',
            'the dispatcher',
          ],
        },
      },
    ],
  },
  {
    name: 'link_button_vehicle_onboarding_implicit_clarifies',
    description:
      "Sprint 3 Day 4 §14.1 + §15.12 + §1 tone dispatch (Pass A2 — vehicle_onboarding redirect, sibling-owned new-chat redirect, tone calibration). §14.1 + §2 onboarding-explicit-only rule (Pass A1 Q2 preserved through A2). User says 'my new Subaru needs oil' — implies ownership but doesn't ASK to add. Oto MUST NOT auto-redirect via render_link_button; instead asks a clarifying question (per §2 + §15.12 row 5: 'Is your Subaru added to your account? ... pull up the onboarding screen').",
    turns: [
      {
        user: 'My new Subaru needs an oil change soon.',
        expect: {
          tools_not_called: ['render_link_button'],
          text_contains: ['account'],
          text_not_contains: [
            "I'll add",
            'I will add',
            "I'll register",
            'the system',
            'the dispatcher',
          ],
        },
      },
    ],
  },
  {
    name: 'vehicle_sibling_owned_redirects_to_new_chat',
    description:
      "Sprint 3 Day 4 §14.1 + §15.12 + §1 tone dispatch (Pass A2 — vehicle_onboarding redirect, sibling-owned new-chat redirect, tone calibration). §15.12 'one chat, one car' — primary anchor M550i; user asks an INFORMATIONAL question about a sibling-owned X5. Oto MUST NOT engage with the sibling's vehicle data; instead politely redirects to start a new chat from the car picker. Note: runtime fixture for sibling garage entries is not seeded here — the load-bearing assertion is the redirect phrasing (text_contains 'new chat' / 'car picker'), which is the user-visible signal per §15.12 row 2. tools_not_called guards against accidental sibling-data engagement.",
    turns: [
      {
        user: 'What about my X5? What oil does it take?',
        expect: {
          tools_not_called: ['get_vehicle_facts', 'render_service_picker', 'render_shop_carousel'],
          text_contains: ['new chat'],
          text_not_contains: [
            "I'll look that up",
            'I will look that up',
            'the system',
            'the dispatcher',
          ],
        },
      },
    ],
  },
  {
    name: 'vehicle_sibling_booking_redirects_to_new_chat',
    description:
      "Sprint 3 Day 4 §14.1 + §15.12 + §1 tone dispatch (Pass A2 — vehicle_onboarding redirect, sibling-owned new-chat redirect, tone calibration). §15.12 — booking action on a sibling-owned vehicle follows the SAME rule as informational sibling asks: new-chat redirect. Primary anchor M550i; user says 'Book brake service for my X5'. Oto MUST NOT initiate booking surfaces for the sibling (no render_service_picker, no render_shop_carousel, no find_available_slots). Response must contain the redirect phrasing (new chat / car picker) per §15.12 row 2.",
    turns: [
      {
        user: 'Book brake service for my X5 this weekend.',
        expect: {
          tools_not_called: [
            'render_service_picker',
            'render_shop_carousel',
            'render_time_selector',
            'find_available_slots',
          ],
          text_contains: ['new chat'],
          text_not_contains: [
            "I'll book",
            'I will book',
            "I'll set that up",
            'the system',
            'the dispatcher',
          ],
        },
      },
    ],
  },
  {
    name: 'vehicle_general_knowledge_still_ok_when_not_owned',
    description:
      "Sprint 3 Day 4 §14.1 + §15.12 + §1 tone dispatch (Pass A2 — vehicle_onboarding redirect, sibling-owned new-chat redirect, tone calibration). §2 + §15.12 row 3 discrimination guard: the no-pivot-to-owned constraint applies ONLY to vehicles in the user's garage. External vehicles get the educational AI treatment unchanged. User asks 'how does the Tesla Model 3 compare to my M550i?' — Oto MUST NOT fire render_link_button (this is NOT a redirect). lookup_vehicle_spec is the expected catalog path for the Tesla (external vehicle). Verifies educational-engagement floor is preserved while sibling-redirect rule is enforced.",
    turns: [
      {
        user: 'How does the Tesla Model 3 compare to my M550i?',
        expect: {
          tools_not_called: ['render_link_button'],
          text_not_contains: [
            "start a new chat",
            'car picker',
            'I cannot compare',
            'the system',
            'the dispatcher',
          ],
        },
      },
    ],
  },
  {
    name: 'voice_empathy_when_car_broken_no_cheer',
    description:
      "Sprint 3 Day 4 §14.1 + §15.12 + §1 tone dispatch (Pass A2 — vehicle_onboarding redirect, sibling-owned new-chat redirect, tone calibration). §1 Context-appropriate emotion — distressed user (brakes worry) gets REAL empathy register, not theater-empathy or cheery exclamation. Load-bearing assertions are the NEGATIVE ban list (theater-empathy + cheer markers); positive assertion is a single flexible keyword ('figure' covers 'let's figure it out' / 'help you figure'). Haiku phrasing varies; ban-list is the load-bearing signal.",
    turns: [
      {
        user: "My brakes feel weird and I'm worried — they kind of grind a little when I stop hard.",
        expect: {
          text_contains: ['figure'],
          text_not_contains: [
            "that's exciting",
            "I'm so sorry to hear",
            'Great!',
            'Wonderful!',
            'Oh, fun',
            'Awesome!',
            'Fantastic',
          ],
        },
      },
    ],
  },
  {
    name: 'voice_enthusiasm_on_fun_car_question',
    description:
      "Sprint 3 Day 4 §14.1 + §15.12 + §1 tone dispatch (Pass A2 — vehicle_onboarding redirect, sibling-owned new-chat redirect, tone calibration). §1 Emotional resonance — exploratory/fun car question should land engaged, not clipped-robotic. Load-bearing assertions are the NEGATIVE ban list against robotic dispatch-channel phrasings ('Here are the specs:', 'As an AI', 'I cannot provide'). Positive assertion is a flexible single keyword ('fun' OR 'cool' OR 'nice' — picked 'V8' as the more reliable substantive anchor since the M550i's twin-turbo V8 is the natural pivot for any engaged response; if Haiku doesn't say V8, that's itself a signal of clipped engagement). Tone cases are HARDER to assert than tool-routing — keep ban-list narrow and specific to robotic markers.",
    turns: [
      {
        user: "I'm curious — tell me about the M5 vs my M550i. What's different about them mechanically?",
        expect: {
          text_contains: ['V8'],
          text_not_contains: [
            'As an AI',
            'I cannot provide',
            'I am unable to',
            'the system',
            'the dispatcher',
          ],
        },
      },
    ],
  },
];

// Re-render each new case in the exact whitespace style of the file:
// outer cases entry indent is 4 spaces, with 6/8/10/12 spaces for nested levels.
// We render via JSON.stringify with indent=2 then re-indent each line by +4 spaces (to match 4-space base for case object).
function renderCase(c) {
  const lines = JSON.stringify(c, null, 2).split('\n');
  // First line is "{", last is "}". We need every line prefixed with 4 spaces (the base indent for a case object).
  return lines.map((l) => '    ' + l).join('\r\n');
}

const rendered = newCases.map(renderCase).join(',\r\n');

// Splice into raw: find the closing pattern of the cases array.
// The last case ends with "    }\r\n  ]\r\n}\r\n"; we need to turn that "    }\r\n" into "    },\r\n<rendered>\r\n" before "  ]\r\n}\r\n".
const tail = '    }\r\n  ]\r\n}\r\n';
if (!raw.endsWith(tail)) {
  throw new Error('Unexpected file tail — abort to preserve byte-identity.');
}
const head = raw.slice(0, raw.length - tail.length); // ends with "    }\r\n" stripped? no — head ends right before "    }\r\n  ]\r\n}\r\n", so head ends at the close brace of case 78's leading indent. Actually head includes everything up to the start of "    }". Let me reconstruct:
// raw = head + "    }\r\n  ]\r\n}\r\n"
// We want: head + "    }" + ",\r\n" + rendered + "\r\n  ]\r\n}\r\n"
const out = head + '    },\r\n' + rendered + '\r\n  ]\r\n}\r\n';

// Validate parse before write.
const parsedAfter = JSON.parse(out);
if (parsedAfter.cases.length !== 78 + newCases.length) {
  throw new Error(`Expected ${78 + newCases.length} cases, got ${parsedAfter.cases.length}`);
}
// Hash of first 78 cases must match.
const hashAfter = crypto
  .createHash('sha256')
  .update(JSON.stringify(parsedAfter.cases.slice(0, 78)))
  .digest('hex');
console.log('POST cases:', parsedAfter.cases.length);
console.log('POST sha256 (first 78):', hashAfter);
if (hashAfter !== hashBefore) {
  throw new Error('Byte-identity hash mismatch — refusing to write.');
}

fs.writeFileSync(FILE, out);
console.log('WROTE', FILE);
console.log('NEW NAMES:');
for (const c of newCases) console.log('  -', c.name);
