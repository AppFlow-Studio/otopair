// Sprint 3 Day 6 Pass A — append 6 render_support_form eval cases.
// Byte-identity preserved for pre-existing 91 cases.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.resolve(__dirname, '../../oto-eval-cases.json');
const original = fs.readFileSync(FILE, 'utf8');
const parsed = JSON.parse(original);

const sortObj = (o) => {
  if (Array.isArray(o)) return o.map(sortObj);
  if (o && typeof o === 'object') {
    const out = {};
    for (const k of Object.keys(o).sort()) out[k] = sortObj(o[k]);
    return out;
  }
  return o;
};
const preHash = crypto.createHash('sha256').update(JSON.stringify(parsed.cases.map(sortObj))).digest('hex');
console.log('PRE  91-case sorted SHA-256:', preHash);
console.log('PRE  case count:', parsed.cases.length);

const newCases = [
  {
    name: "support_form_mechanic_dispute",
    description: "Sprint 3 Day 6 §13 dispatch (render_support_form 3-category — substantive intake form). Category: mechanic_dispute. Rich-detail dispute with specific shop + specific charge + specific date → render_support_form fires (terminal render). Asserts the form-channel path is taken (NOT the lightweight render_link_button redirect). text_contains keyword 'dispute' validates the right-category framing — runner has no tool-arg primitive (Tier 3 carryover) so we can't assert category='mechanic_dispute' directly; the text-keyword is our proxy.",
    turns: [
      {
        user: "The mechanic at Joe's Shop charged me for a part I never approved on Tuesday.",
        expect: {
          tools_called: [
            "render_support_form",
            "update_conversation_state"
          ],
          tools_not_called: [
            "render_link_button"
          ],
          branch: "terminal",
          text_contains: [
            "dispute"
          ],
          text_not_contains: [
            "I'll let the shop know",
            "I will let the shop know",
            "I'll file this",
            "I will file this",
            "I've sent this to the team",
            "the system",
            "the dispatcher"
          ]
        }
      }
    ]
  },
  {
    name: "support_form_service_complaint",
    description: "Sprint 3 Day 6 §13 dispatch (render_support_form 3-category — substantive intake form). Category: service_complaint. Rich-detail service quality complaint (bad brake job, brakes still squeak) — no billing dispute, no mechanic-specific call-out → render_support_form fires. Caveat: we can't assert category='service_complaint' (no tool-arg primitive); text_contains 'complaint' is our category-framing proxy. The substantive-intake-form path is the load-bearing assertion vs. the lightweight redirect channel.",
    turns: [
      {
        user: "The shop did my brake job but the brakes still squeak — I think the work was bad.",
        expect: {
          tools_called: [
            "render_support_form",
            "update_conversation_state"
          ],
          tools_not_called: [
            "render_link_button"
          ],
          branch: "terminal",
          text_contains: [
            "complaint"
          ],
          text_not_contains: [
            "I'll let the shop know",
            "I will let the shop know",
            "I'll file this",
            "I will file this",
            "I've sent this to the team",
            "the system",
            "the dispatcher"
          ]
        }
      }
    ]
  },
  {
    name: "support_form_billing_issue",
    description: "Sprint 3 Day 6 §13 dispatch (render_support_form 3-category — substantive intake form). Category: billing_issue. Rich-detail billing discrepancy (charged $300, booking said $100) — specific amounts on both sides → render_support_form fires. Caveat: we can't assert category='billing_issue' (no tool-arg primitive); text_contains 'billing' is the category-framing proxy. Asserts substantive-intake-form path is taken vs. lightweight redirect.",
    turns: [
      {
        user: "I was charged $300 for an oil change but the booking only said $100 — what happened?",
        expect: {
          tools_called: [
            "render_support_form",
            "update_conversation_state"
          ],
          tools_not_called: [
            "render_link_button"
          ],
          branch: "terminal",
          text_contains: [
            "billing"
          ],
          text_not_contains: [
            "I'll let the shop know",
            "I will let the shop know",
            "I'll file this",
            "I will file this",
            "I've sent this to the team",
            "I'll get this refunded",
            "I will get this refunded",
            "the system",
            "the dispatcher"
          ]
        }
      }
    ]
  },
  {
    name: "support_form_vs_redirect_lightweight",
    description: "Sprint 3 Day 6 §13 dispatch (render_support_form 3-category — substantive intake form). Three-channel discrimination: lightweight 'I need help' (no rich detail) → render_link_button (customer_support redirect channel), NOT render_support_form (the substantive intake form channel). Caveat: we can't assert destination='customer_support' on the link_button (no tool-arg primitive); the load-bearing assertion is the channel split — render_link_button fires, render_support_form does NOT.",
    turns: [
      {
        user: "I need help.",
        expect: {
          tools_called: [
            "render_link_button",
            "update_conversation_state"
          ],
          tools_not_called: [
            "render_support_form"
          ],
          branch: "terminal",
          text_not_contains: [
            "the system",
            "the dispatcher"
          ]
        }
      }
    ]
  },
  {
    name: "support_form_no_for_ai_feedback",
    description: "Sprint 3 Day 6 §13 dispatch (render_support_form 3-category — substantive intake form). Three-channel discrimination — AI-feedback channel ownership (§15.11). User complains about Oto's last response ('that last answer was wrong'). Oto MUST NOT fire render_support_form (form channel is wrong) AND MUST NOT fire render_link_button (bug_report redirect is for general app bugs, NOT AI-conversation issues — §15.11). Correct surface is the per-message UI icon next to each Oto response; Oto's role is to point to it conversationally. Complements Day 2 ai_feedback_distinguishes_from_bug_report case — that one tests positive routing; this one asserts NEITHER substrate fires.",
    turns: [
      {
        user: "Oto, that last answer was wrong — you got that backwards.",
        expect: {
          tools_called: [
            "update_conversation_state"
          ],
          tools_not_called: [
            "render_support_form",
            "render_link_button"
          ],
          text_contains: [
            "icon"
          ],
          text_not_contains: [
            "I'll let the team know",
            "I will let the team know",
            "I'll flag this",
            "I will flag this",
            "I'll file a report",
            "I will file a report",
            "I'll send this to the team",
            "I've sent this to the team",
            "I'll pass it along",
            "the system",
            "the dispatcher"
          ]
        }
      }
    ]
  },
  {
    name: "support_form_no_invented_details",
    description: "Sprint 3 Day 6 §13 dispatch (render_support_form 3-category — substantive intake form). Prefilled-fields constraint (§13 + tool-spec): Oto must populate render_support_form.prefilled_fields ONLY from what the user actually said; never invent shop names, mechanic names, dollar amounts, or dates. User says 'I have a billing issue but I don't remember which shop' — intentional info-gap. Form must fire (user wants the form), but Oto's framing sentence must NOT invent a specific shop name, mechanic name, dollar amount, or date the user did not mention. Caveat: we can't directly inspect prefilled_fields argument (no tool-arg primitive); the text_not_contains ban list catches the most likely invention patterns — specific fictional shop names ('Joe's Shop' / 'Mike's Garage' / 'Auto Zone'), specific dollar amounts ($100 / $200 / $300 / $500 — common AI-completion defaults the user did NOT mention), and specific weekday names ('Monday'…'Friday' / 'yesterday' / 'last week') the user did not provide. Judgment call: we ban specific dollar figures rather than '$' in general because Oto might legitimately echo back the word 'billing' (category framing); we ban weekday names because the user gave no date signal at all.",
    turns: [
      {
        user: "I have a billing issue but I don't remember which shop.",
        expect: {
          tools_called: [
            "render_support_form",
            "update_conversation_state"
          ],
          branch: "terminal",
          text_not_contains: [
            "Joe's Shop",
            "Mike's Garage",
            "Auto Zone",
            "$100",
            "$200",
            "$300",
            "$500",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "yesterday",
            "last week",
            "the system",
            "the dispatcher"
          ]
        }
      }
    ]
  }
];

function stringifyCase(c) {
  const raw = JSON.stringify(c, null, 2);
  return raw.split('\n').map((line) => '    ' + line).join('\n');
}

const newBlocks = newCases.map(stringifyCase).join(',\n');

const tail = '\n  ]\n}\n';
if (!original.endsWith(tail)) {
  throw new Error('Unexpected file ending: ' + JSON.stringify(original.slice(-40)));
}
const head = original.slice(0, original.length - tail.length);
const newContent = head + ',\n' + newBlocks + tail;

const reparsed = JSON.parse(newContent);
console.log('POST case count:', reparsed.cases.length);
console.log('POST active count:', reparsed.cases.filter((x) => !x.disabled).length);
console.log('POST disabled count:', reparsed.cases.filter((x) => x.disabled).length);

const first91Hash = crypto
  .createHash('sha256')
  .update(JSON.stringify(reparsed.cases.slice(0, 91).map(sortObj)))
  .digest('hex');
console.log('POST first-91 sorted SHA-256:', first91Hash);
console.log('Identity preserved:', preHash === first91Hash);

if (preHash !== first91Hash) {
  console.error('ABORT: byte identity violated');
  process.exit(1);
}

fs.writeFileSync(FILE, newContent, 'utf8');
console.log('WROTE', FILE, 'newLen:', newContent.length);
