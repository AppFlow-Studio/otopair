/**
 * Oto (Haiku 4.5) sometimes writes its polite-exit mechanics into the reply:
 * the <polite_exit_required> envelope block (envelope.ts) and the stable
 * prompt's polite-exit rule, read back as a to-do list. The four replies in
 * the first test are ones Oto sent in the 2026-10-01 harness runs; the other
 * leaks come from the saved eval runs. stripBannedClaims (chat.ts) drops the
 * sentences that narrate the mechanics and keeps the rest. Replies that use
 * the same words in their everyday sense must come through untouched.
 */
import { describe, expect, it } from "vitest";
import { stripBannedClaims } from "../convex/oto/chat";

const guard = (reply: string) => stripBannedClaims(reply, { allowCurrency: false });

describe("polite-exit narration", () => {
  it("drops the narrating sentence and keeps the rest", () => {
    expect(
      guard(
        "Perfect — I have the health snapshot and I can see the temperature light is live. The polite-exit threshold (3 narrowing turns) has been reached, and I need to prefill the diagnostic booking now.",
      ),
    ).toEqual({
      text: "Perfect — I have the health snapshot and I can see the temperature light is live.",
      dropped: ["internal_noun"],
    });
    // The opener announces a plan but names no mechanics, so it stays.
    expect(
      guard(
        "I need to handle this in the right order. The user is stating a completed service (oil change, Sept 22) AND we're at the polite-exit threshold on the steering-pull narrowing.",
      ),
    ).toEqual({ text: "I need to handle this in the right order.", dropped: ["internal_noun"] });
  });

  it("empties a reply that is all narration", () => {
    // Each of these turns carried a card, so chat.ts puts the card's framing
    // line in place of the empty reply.
    for (const reply of [
      "I need to handle two things here: log the oil service you just mentioned, and reach a terminal on the pulling symptom per the polite-exit rule.",
      "I need to handle this in two parts: log the oil change, then address the steering pull per the polite-exit requirement.",
      "I need to gather vehicle-health data before reaching the terminal state on this vibration symptom.",
    ]) {
      expect(guard(reply)).toEqual({ text: "", dropped: ["internal_noun"] });
    }
  });

  it("drops the model talking about the user in the third person", () => {
    expect(
      guard(
        "Let me address the brake question first (the user asked for a safety assessment), then surface the temperature light.\n\nMorning squeak that clears after a few stops is usually condensation on the rotors—moisture that evaporates as the brakes warm.",
      ),
    ).toEqual({
      text: "Morning squeak that clears after a few stops is usually condensation on the rotors—moisture that evaporates as the brakes warm.",
      dropped: ["internal_noun"],
    });
  });
});

describe("everyday uses of the same words", () => {
  it("keeps them", () => {
    for (const reply of [
      "You're right at that mileage threshold, so it's a good time to book it.",
      "Mercedes recommends rotating every 5,000 to 7,500 miles on the G63 — you're right at that threshold with 5,000 miles on it.",
      "Got it — brake squeal first thing in the morning is worth narrowing down.",
      "Let me ask one clarifying question to narrow it: does the clunk happen only over big bumps and potholes, or do you feel it hitting almost every little dip?",
      "White crust on a battery terminal is corrosion, and it can cause a slow crank.",
      "The user manual lists the tire pressures too, and so does the sticker on the driver's door jamb.",
    ]) {
      expect(guard(reply)).toEqual({ text: reply, dropped: [] });
    }
  });
});
