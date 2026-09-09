// Day 3 Pass A — append 7 Loyalty eval cases.
// Verifies byte-identity of the pre-existing 71 cases by deep-sorted SHA-256.
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const FILE = path.resolve(__dirname, "..", "..", "oto-eval-cases.json");

function sortKeys(o) {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === "object") {
    return Object.keys(o)
      .sort()
      .reduce((acc, k) => {
        acc[k] = sortKeys(o[k]);
        return acc;
      }, {});
  }
  return o;
}

function hashCases(cases) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(sortKeys(cases)))
    .digest("hex");
}

const orig = fs.readFileSync(FILE, "utf8");
const j = JSON.parse(orig);
const beforeCount = j.cases.length;
const beforeHash = hashCases(j.cases);
console.log("before count:", beforeCount);
console.log("before SHA-256 (cases, sorted keys):", beforeHash);

const DOC =
  "Sprint 3 Day 3 §11 + §14.2 dispatch (Loyalty — in-chat informational surface, no claim flow).";

const newCases = [
  // Group A — 4 tool-routing positives (one per Loyalty data tool)
  {
    name: "loyalty_balance_oneshot",
    description:
      DOC +
      " Tool-routing positive: get_rewards_summary. User asks for credit balance / tier — Oto fires get_rewards_summary in a single shot (one tool returns the full snapshot per §11 / §14.2). Other Loyalty data tools (get_loyalty_points_history, get_available_redemptions, get_loyalty_program_info) MUST NOT fire — they're for distinct intents (history / redemption inquiry / program rules) and chaining is forbidden per §11 MUST-NOT.",
    turns: [
      {
        user: "What's my rewards balance? How many credits do I have and what tier am I?",
        expect: {
          tools_called: ["get_rewards_summary", "update_conversation_state"],
          tools_not_called: [
            "get_loyalty_points_history",
            "get_available_redemptions",
            "get_loyalty_program_info",
            "render_link_button",
          ],
          text_contains: ["credit"],
          text_not_contains: [
            "the system",
            "the dispatcher",
            "I'll redeem",
            "I will redeem",
            "I'll claim",
          ],
        },
      },
    ],
  },
  {
    name: "loyalty_history_lookup",
    description:
      DOC +
      " Tool-routing positive: get_loyalty_points_history. User asks where a recent credit came from / what they earned this month — Oto fires get_loyalty_points_history alone (one-shot history; does NOT also need get_rewards_summary, per §14.2 behavioral contract that points history is its own intent). Distinct from balance-snapshot intent.",
    turns: [
      {
        user: "Where did my last credit come from? What have I earned this month?",
        expect: {
          tools_called: [
            "get_loyalty_points_history",
            "update_conversation_state",
          ],
          tools_not_called: [
            "get_available_redemptions",
            "get_loyalty_program_info",
            "render_link_button",
          ],
          text_not_contains: [
            "the system",
            "the dispatcher",
            "I'll redeem",
            "I will redeem",
            "I'll claim",
          ],
        },
      },
    ],
  },
  {
    name: "loyalty_program_info_request",
    description:
      DOC +
      " Tool-routing positive: get_loyalty_program_info. User asks how the loyalty program works / what the tier breakpoints are — Oto fires get_loyalty_program_info to explain rules. Distinct from balance (get_rewards_summary), history (get_loyalty_points_history), and redemption inquiry (get_available_redemptions).",
    turns: [
      {
        user: "How does the loyalty program work? What are the tier breakpoints and how do I earn points?",
        expect: {
          tools_called: [
            "get_loyalty_program_info",
            "update_conversation_state",
          ],
          tools_not_called: [
            "get_loyalty_points_history",
            "get_available_redemptions",
            "render_link_button",
          ],
          text_contains: ["tier"],
          text_not_contains: [
            "the system",
            "the dispatcher",
            "I'll redeem",
            "I will redeem",
            "I'll claim",
          ],
        },
      },
    ],
  },
  {
    name: "loyalty_redeem_inquiry_describes_only",
    description:
      DOC +
      " Tool-routing positive: get_available_redemptions. User asks what they can get with points / what's available — Oto fires get_available_redemptions to surface options as INFORMATION only (no claim affordance per §14.2 Constraint 2). MUST NOT fire any claim-executing tool (none exists; render_quick_replies with a 'Confirm redemption' affordance would be wrong — soft-asserted via text_not_contains for promise phrasings). The response should describe options and point to the Loyalty screen for the actual claim.",
    turns: [
      {
        user: "What can I get with my points? What's available to redeem right now?",
        expect: {
          tools_called: [
            "get_available_redemptions",
            "update_conversation_state",
          ],
          tools_not_called: ["render_link_button"],
          text_not_contains: [
            "want me to redeem",
            "should I redeem",
            "I'll redeem",
            "I will redeem",
            "I'll set up that redemption",
            "I'll claim",
            "I will claim",
            "done",
            "the system",
            "the dispatcher",
          ],
        },
      },
    ],
  },
  // Group B — 2 no-claim-flow cases (the load-bearing §14.2 Constraint 2)
  {
    name: "loyalty_redeem_request_pointer_to_screen",
    description:
      DOC +
      " §14.2 Constraint 2 (no-claim-flow): user explicitly says 'I want to redeem my points' / 'claim the 10% off' — Oto MUST NOT execute a claim in chat. Response must point conversationally to the Loyalty screen (per pattern 'Redeeming happens on the Loyalty screen in your account'). Oto MAY fire get_available_redemptions to show options. Banned phrasings (text_not_contains) cover the load-bearing claim-promise vocabulary: 'I'll redeem', 'I'll claim', 'I'll set up', 'done', 'completed', 'applied'.",
    turns: [
      {
        user: "I want to redeem my points — claim the 10% off reward for me.",
        expect: {
          tools_called: ["update_conversation_state"],
          tools_not_called: ["render_link_button"],
          text_contains: ["Loyalty screen"],
          text_not_contains: [
            "I'll redeem",
            "I will redeem",
            "I'll claim",
            "I will claim",
            "I'll set up that redemption",
            "I will set up that redemption",
            "I'll set up the redemption",
            "let me redeem",
            "done",
            "completed",
            "applied",
            "the system",
            "the dispatcher",
          ],
        },
      },
    ],
  },
  {
    name: "loyalty_no_claim_promise",
    description:
      DOC +
      " §14.2 Constraint 2 (no-claim-flow) — adversarial framing. User says 'go ahead and redeem' / 'just claim it for me' — Oto MUST briefly acknowledge and point to the Loyalty screen, NOT promise the claim happened. Banned phrasings cover both first-person-future and first-person-perfect: 'I'll redeem', 'I'll set up', 'I'll claim', 'done', 'completed', 'applied'. No tool MUST execute a claim (none exists; verified by tools_not_called for render_link_button and render_support_form to ensure Oto doesn't mis-route to another surface either).",
    turns: [
      {
        user: "Go ahead and redeem the next available reward — just claim it for me.",
        expect: {
          tools_called: ["update_conversation_state"],
          tools_not_called: ["render_link_button", "render_support_form"],
          text_contains: ["Loyalty screen"],
          text_not_contains: [
            "I'll redeem",
            "I will redeem",
            "I'll set up",
            "I will set up",
            "I'll claim",
            "I will claim",
            "let me redeem",
            "let me claim",
            "done",
            "completed",
            "applied",
            "the system",
            "the dispatcher",
          ],
        },
      },
    ],
  },
  // Group C — 1 discrimination case (Loyalty is in-chat, not a redirect)
  {
    name: "loyalty_not_a_redirect_destination",
    description:
      DOC +
      " §14.1 enum + §14.2 Constraint 1: Loyalty is its own in-chat domain, NOT a render_link_button destination (the §14.1 enum has 8 values; loyalty is not among them). When the user asks 'take me to the loyalty screen' / 'open my rewards', Oto handles in-chat (surfacing rewards balance via get_rewards_summary) — does NOT fire render_link_button at all. Complementary to Day 2's link_button_invalid_destination_rejected (which verified the negative — that no render_link_button fires); this case verifies the positive — that get_rewards_summary DOES fire and the user's intent is served in chat. Oto MAY mention the Loyalty screen conversationally; it MUST NOT redirect there via render_link_button.",
    turns: [
      {
        user: "Open my rewards — take me to the loyalty screen.",
        expect: {
          tools_called: ["get_rewards_summary", "update_conversation_state"],
          tools_not_called: ["render_link_button"],
          text_not_contains: [
            "I'll redirect",
            "I will redirect",
            "tap to open",
            "the system",
            "the dispatcher",
          ],
        },
      },
    ],
  },
];

// Validate: every new case has unique name and required fields.
const existingNames = new Set(j.cases.map((c) => c.name));
for (const c of newCases) {
  if (!c.name) throw new Error("case missing name");
  if (existingNames.has(c.name))
    throw new Error("duplicate case name: " + c.name);
  if (!c.description) throw new Error("case missing description: " + c.name);
  if (!Array.isArray(c.turns) || c.turns.length === 0)
    throw new Error("case missing turns: " + c.name);
  existingNames.add(c.name);
}

// Append, write back.
j.cases.push(...newCases);
const out = JSON.stringify(j, null, 2) + "\n";
fs.writeFileSync(FILE, out);

// Re-read and verify byte-identity for the first N cases.
const j2 = JSON.parse(fs.readFileSync(FILE, "utf8"));
const afterCount = j2.cases.length;
const preservedCases = j2.cases.slice(0, beforeCount);
const afterHashPreserved = hashCases(preservedCases);
console.log("after total count:", afterCount);
console.log(
  "after SHA-256 (first 71 cases, sorted keys):",
  afterHashPreserved
);
console.log(
  "byte-identity for pre-existing 71 cases:",
  beforeHash === afterHashPreserved ? "PASS" : "FAIL",
);
console.log("new cases appended:", newCases.length);
console.log("new case names:");
for (const c of newCases) console.log("  -", c.name);
