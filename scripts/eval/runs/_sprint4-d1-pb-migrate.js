#!/usr/bin/env node
// Sprint 4 Day 1 Pass B — booking-flow consolidation migration.
// MIGRATES existing cases that reference the 6 deprecated render-* booking tools
// to fire render_book_service, and APPENDS 6 new cases per §4 eval coverage.
//
// Run from repo root:  node scripts/eval/runs/_sprint4-d1-pb-migrate.js

const fs = require('fs');
const path = require('path');

const CASES_FILE = path.join(__dirname, '..', '..', 'oto-eval-cases.json');

const json = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));
const cases = json.cases;

const findIdx = (name) => {
  const i = cases.findIndex(c => c.name === name);
  if (i < 0) throw new Error(`case not found: ${name}`);
  return i;
};

const migrationNote = "Sprint 4 Day 1 Pass B §4 dispatch (booking-flow consolidation; render_book_service).";

// ---------- Part 1: migrate existing cases ----------

// idx 2 -- brake_record_confirmed_routes_to_diagnostic
{
  const c = cases[findIdx('brake_record_confirmed_routes_to_diagnostic')];
  c.description = "Trust protocol completion path: after the user confirms the self_reported record is correct, Oto's next turn routes to render_book_service (record was right, symptom is the surprise - let a mechanic look). Turn 3 simulates the mobile component's synthetic follow-up message that fires after the user taps 'Yes, that's right'. " + migrationNote;
  const turn3 = c.turns[2];
  turn3.expect.tools_called = turn3.expect.tools_called.map(
    t => t === 'render_diagnostic_form' ? 'render_book_service' : t
  );
  // form_system was "brakes" — retain since render_book_service accepts diagnostic_system arg.
  // The runner asserts render_diagnostic_form.initialSystem; this is now stale.
  // Keep it for now (judgment call: harmless if render_book_service does not have initialSystem;
  //   runner will skip the assertion when the tool name differs). Actually re-reading runner doc:
  //   form_system asserts render_diagnostic_form.initialSystem === value. With diag-form gone,
  //   this assertion will fail. Drop it; the diagnostic_system arg is unobservable from the runner.
  delete turn3.expect.form_system;
}

// idx 21 -- polite_exit_after_vague_narrowing (disabled, but migrate intent)
{
  const c = cases[findIdx('polite_exit_after_vague_narrowing')];
  c.description = "Symptom routing safety valve: when narrowing fails to converge after several vague exchanges, fire render_book_service with diagnostic_scan + diagnostic_system='not_sure' (per the polite-exit rule). " + migrationNote;
  const lastTurn = c.turns[c.turns.length - 1];
  lastTurn.expect.tools_called = lastTurn.expect.tools_called.map(
    t => t === 'render_diagnostic_form' ? 'render_book_service' : t
  );
  delete lastTurn.expect.form_system;
}

// idx 22 -- direct_routine_oil_change_request
{
  const c = cases[findIdx('direct_routine_oil_change_request')];
  c.description = "Direct booking path: explicit request for routine service skips diagnostic narrowing entirely; should route through render_book_service with service_slugs=['oil_change'] prefill, NOT a diagnostic-scan render. " + migrationNote;
  // text_not_contains had 'render_diagnostic_form' — Oto must not narrate tool names at all.
  // Replace with 'render_book_service' (still guard against tool-name narration).
  const turn1 = c.turns[0];
  if (turn1.expect.text_not_contains) {
    turn1.expect.text_not_contains = turn1.expect.text_not_contains.map(
      s => s === 'render_diagnostic_form' ? 'render_book_service' : s
    );
  }
}

// idx 24 -- oil_symptom_triggers_record_confirmation
{
  const c = cases[findIdx('oil_symptom_triggers_record_confirmation')];
  c.description = (c.description || "") + " " + migrationNote;
  const lastTurn = c.turns[c.turns.length - 1];
  if (lastTurn.expect.text_not_contains) {
    lastTurn.expect.text_not_contains = lastTurn.expect.text_not_contains.map(
      s => s === 'render_diagnostic_form' ? 'render_book_service' : s
    );
  }
}

// idx 80 -- vehicle_sibling_owned_redirects_to_new_chat
{
  const c = cases[findIdx('vehicle_sibling_owned_redirects_to_new_chat')];
  c.description = (c.description || "") + " " + migrationNote;
  const t = c.turns[0];
  t.expect.tools_not_called = t.expect.tools_not_called
    .filter(x => x !== 'render_service_picker' && x !== 'render_shop_carousel');
  if (!t.expect.tools_not_called.includes('render_book_service')) {
    t.expect.tools_not_called.push('render_book_service');
  }
}

// idx 81 -- vehicle_sibling_booking_redirects_to_new_chat
{
  const c = cases[findIdx('vehicle_sibling_booking_redirects_to_new_chat')];
  c.description = (c.description || "") + " " + migrationNote;
  const t = c.turns[0];
  t.expect.tools_not_called = t.expect.tools_not_called
    .filter(x => !['render_service_picker', 'render_shop_carousel', 'render_time_selector'].includes(x));
  if (!t.expect.tools_not_called.includes('render_book_service')) {
    t.expect.tools_not_called.push('render_book_service');
  }
}

// idx 85-88 -- booking_status_* viewing cases: drop deprecated tools from tools_not_called,
//   add render_book_service to guard against accidental create-booking surface firing.
for (const name of [
  'booking_status_pending',
  'booking_status_next_appointment',
  'booking_status_list_view',
  'booking_status_confirmation_check',
]) {
  const c = cases[findIdx(name)];
  c.description = (c.description || "") + " " + migrationNote;
  const t = c.turns[0];
  t.expect.tools_not_called = t.expect.tools_not_called
    .filter(x => !['render_service_picker', 'render_shop_carousel', 'render_time_selector'].includes(x));
  if (!t.expect.tools_not_called.includes('render_book_service')) {
    t.expect.tools_not_called.push('render_book_service');
  }
}

// idx 89 -- booking_status_vs_booking_flow_discrimination
{
  const c = cases[findIdx('booking_status_vs_booking_flow_discrimination')];
  c.description = "Sprint 3 Day 5 §14.3 discrimination test (post-Sprint-4-Pass-A migration) — 'I want to book a brake service' is a CREATE-NEW-BOOKING intent (§4 consolidated single-component flow), NOT a VIEW-EXISTING-BOOKING intent (§14.3). Oto MUST route to render_book_service (the single terminal booking surface), NOT to the §14.3 viewing tools (get_pending_bookings / render_booking_card / render_bookings_list — all for viewing existing, not creating). Load-bearing assertion: tools_called includes render_book_service AND tools_not_called excludes the three §14.3 viewing tools. " + migrationNote;
  const t = c.turns[0];
  t.expect.tools_called = t.expect.tools_called.map(
    x => x === 'render_service_picker' ? 'render_book_service' : x
  );
  // tools_not_called already excludes the §14.3 viewing tools (unchanged).
  // Optional: assert branch terminal since render_book_service is terminal.
  if (!t.expect.branch) t.expect.branch = 'terminal';
}

// ---------- Part 2: append 6 new cases per registry §4 eval coverage ----------

const newCases = [
  {
    name: "book_service_single_diagnostic",
    description: "Sprint 4 Day 1 Pass B §4 dispatch (booking-flow consolidation; render_book_service). Single-service diagnostic-scan booking: user reports a symptom that converges on 'needs eyes-on' (multi-cause ambiguity); after Oto's narrowing turn, user confirms 'yes book a diagnostic'. Expect render_book_service fires as the SINGLE terminal booking surface with diagnostic-scan prefill. Booking-ask phrasing must avoid the BANNED 'pull up details' pattern (§1 Voice update).",
    turns: [
      {
        user: "My brakes have been squealing pretty bad when I brake hard on the highway.",
        expect: {
          tools_called: ["update_conversation_state"],
          text_not_contains: ["pull up details", "pull that up"]
        }
      },
      {
        user: "Yeah let's book a diagnostic, I want a mechanic to look at it.",
        expect: {
          tools_called: ["render_book_service", "update_conversation_state"],
          tools_not_called: [
            "render_service_picker",
            "render_shop_carousel",
            "render_time_selector",
            "render_booking_confirmation",
            "render_diagnostic_form",
            "navigate_to_payment"
          ],
          branch: "terminal",
          text_contains: ["book"],
          text_not_contains: [
            "pull up details",
            "pull that up",
            "the system",
            "the dispatcher",
            "render_book_service"
          ]
        }
      }
    ]
  },
  {
    name: "book_service_single_routine",
    description: "Sprint 4 Day 1 Pass B §4 dispatch (booking-flow consolidation; render_book_service). Single-service direct-routine booking: user explicitly asks for an oil change (a canonical service). Oto fires render_book_service with service_slugs=['oil_change'] (text_contains 'oil' proxies the prefill since the runner has no tool-arg primitive). Deprecated 6-stage tools must NOT fire.",
    turns: [
      {
        user: "Can you book me an oil change for next week?",
        expect: {
          tools_called: ["render_book_service", "update_conversation_state"],
          tools_not_called: [
            "render_service_picker",
            "render_shop_carousel",
            "render_time_selector",
            "render_booking_confirmation",
            "render_diagnostic_form",
            "navigate_to_payment"
          ],
          branch: "terminal",
          text_contains: ["oil"],
          text_not_contains: [
            "pull up details",
            "pull that up",
            "the system",
            "the dispatcher",
            "render_book_service",
            "diagnostic scan first"
          ]
        }
      }
    ]
  },
  {
    name: "book_service_multi_bundle",
    description: "Sprint 4 Day 1 Pass B §4 dispatch (booking-flow consolidation; render_book_service). Multi-service bundle: user explicitly asks to bundle an oil change and a tire rotation. Oto fires render_book_service ONCE with service_slugs=['oil_change','tire_rotation'] (the bookings.service_ids array already supports multi-service per §4 schema check). Runner-caveat: array-arg values are unobservable; text_contains 'oil' AND 'tire' proxies that both services appear in Oto's framing.",
    turns: [
      {
        user: "Can you book me an oil change and a tire rotation together?",
        expect: {
          tools_called: ["render_book_service", "update_conversation_state"],
          tools_not_called: [
            "render_service_picker",
            "render_shop_carousel",
            "render_time_selector",
            "render_booking_confirmation",
            "render_diagnostic_form",
            "navigate_to_payment"
          ],
          branch: "terminal",
          text_contains: ["oil", "tire"],
          text_not_contains: [
            "pull up details",
            "pull that up",
            "the system",
            "the dispatcher",
            "render_book_service"
          ]
        }
      }
    ]
  },
  {
    name: "book_service_diagnostic_phrasing_correct",
    description: "Sprint 4 Day 1 Pass B §4 dispatch (booking-flow consolidation; render_book_service). Booking-action phrasing per §1 Voice update + §4 booking-action phrasing rule. User reports a symptom; Oto's narrowing turn (or single-turn recommendation) MUST ask to BOOK directly, not offer to 'pull up details'. BANNED phrasings (text_not_contains): 'pull up details', 'pull that up', 'pull up a diagnostic'. Required: 'book' AND 'diagnostic' must appear in Oto's framing. This case asserts PHRASING, not the render fire — the render only fires on user confirm; depending on Haiku's pacing, render_book_service may or may not fire on this single-user-turn case, so we do NOT assert tools_called against render_book_service here. We assert that the 6 deprecated tools also don't fire (no fallback to legacy flow).",
    turns: [
      {
        user: "Lately when I go over a speed bump I hear a clunk from the front. Pretty repeatable.",
        expect: {
          tools_not_called: [
            "render_service_picker",
            "render_shop_carousel",
            "render_time_selector",
            "render_booking_confirmation",
            "render_diagnostic_form",
            "navigate_to_payment"
          ],
          text_contains: ["book", "diagnostic"],
          text_not_contains: [
            "pull up details",
            "pull that up",
            "pull up a diagnostic",
            "the system",
            "the dispatcher",
            "render_book_service"
          ]
        }
      }
    ]
  },
  {
    name: "book_service_polite_exit_not_sure",
    description: "Sprint 4 Day 1 Pass B §4 dispatch (booking-flow consolidation; render_book_service). Polite-exit safety valve: after 6 unconverged narrowing turns, Oto fires render_book_service with service_slugs=['diagnostic_scan'] + diagnostic_system='not_sure'. Tool-arg assertion proxied via text_contains 'diagnostic' (the runner has no tool-arg primitive). Replaces the prior polite_exit_after_vague_narrowing intent under the consolidated flow. NOTE: this case may inherit the same disabled_reason as polite_exit_after_vague_narrowing (the diagnostic_turn_count counter is gated by skipPersist in chat.ts and the harness defaults skipPersist=true; the 6th-turn polite-exit envelope block never fires under harness conditions). Disabling explicitly with the same reason as the legacy case so the migration is symmetric — re-enable once the counter is decoupled from skipPersist OR a pre_seed_mutations seed advances the counter.",
    disabled: true,
    disabled_reason: "Sprint 2 / Wave 7.x: the polite-exit counter (ai_conversations.diagnostic_turn_count, threshold=6) is incremented in chat.ts inside `if (!skipPersist)`. The harness defaults to debug_skip_persist=true, so the counter never advances and the 6th turn never fires the <polite_exit_required> envelope block. Same disabled_reason as legacy polite_exit_after_vague_narrowing. Re-enable when counter decouples from skipPersist OR a pre_seed_mutations seed advances the counter.",
    turns: [
      { user: "Something feels weird with my car", expect: { tools_called: ["update_conversation_state"] } },
      { user: "Hard to say, just doesn't feel right", expect: { tools_called: ["update_conversation_state"] } },
      { user: "Maybe when driving, sometimes when stopping, I dunno", expect: { tools_called: ["update_conversation_state"] } },
      { user: "It's been doing it for a while I guess", expect: { tools_called: ["update_conversation_state"] } },
      { user: "Could be anything really, that's why I'm asking", expect: { tools_called: ["update_conversation_state"] } },
      {
        user: "I really can't pin it down",
        expect: {
          tools_called: ["render_book_service", "update_conversation_state"],
          tools_not_called: [
            "render_service_picker",
            "render_shop_carousel",
            "render_time_selector",
            "render_booking_confirmation",
            "render_diagnostic_form",
            "navigate_to_payment"
          ],
          branch: "terminal",
          text_contains: ["diagnostic"],
          text_not_contains: [
            "pull up details",
            "pull that up",
            "render_book_service"
          ]
        }
      }
    ]
  },
  {
    name: "book_service_deprecated_tools_not_fired",
    description: "Sprint 4 Day 1 Pass B §4 dispatch (booking-flow consolidation; render_book_service). Deprecation-enforcement negative case: under any narrowing scenario, Haiku must NEVER fire the 6 deprecated tool names (render_service_picker, render_shop_carousel, render_time_selector, render_booking_confirmation, render_diagnostic_form, navigate_to_payment). This single-turn case feeds a symptom that should produce a narrowing question (not a booking surface) and asserts ONLY the negative — tools_not_called covers all 6 deprecated tools. Note: tools_called assertion is intentionally minimal (only update_conversation_state) because the converge-vs-still-narrowing branch depends on Haiku's pacing; the load-bearing assertion is the 6-tool deprecation guard.",
    turns: [
      {
        user: "My tires feel a bit weird going around corners — kind of mushy.",
        expect: {
          tools_called: ["update_conversation_state"],
          tools_not_called: [
            "render_service_picker",
            "render_shop_carousel",
            "render_time_selector",
            "render_booking_confirmation",
            "render_diagnostic_form",
            "navigate_to_payment"
          ],
          text_not_contains: [
            "pull up details",
            "pull that up",
            "the system",
            "the dispatcher",
            "render_book_service",
            "render_diagnostic_form"
          ]
        }
      }
    ]
  }
];

for (const nc of newCases) {
  if (cases.find(c => c.name === nc.name)) {
    throw new Error(`duplicate case name on append: ${nc.name}`);
  }
  cases.push(nc);
}

fs.writeFileSync(CASES_FILE, JSON.stringify(json, null, 2) + '\n');
console.log(`Done. Total cases: ${cases.length}`);
