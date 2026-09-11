/**
 * Tutorial step data — the parts that can be wrong silently.
 *
 * The animation can be eyeballed on a simulator; the counting cannot. The dots
 * a sighted user sees and the "Step 2 of 4" a screen reader hears are derived
 * from the same function on purpose, so the failure this guards against is the
 * two disagreeing after someone adds a step — which nobody would notice by
 * looking.
 */
import { describe, expect, it } from "vitest";
import {
  COUNTED_STEP_COUNT,
  TUTORIAL_STEPS,
  countedIndexOf,
  isLastStep,
  progressLabel,
} from "@/components/tutorial/steps";

describe("shape", () => {
  it("is a title card, four teaching steps and a closing card", () => {
    expect(TUTORIAL_STEPS).toHaveLength(6);
    expect(COUNTED_STEP_COUNT).toBe(4);
  });

  it("only counts the steps that teach something", () => {
    // The cards at either end carry no dots: "1 of 6" under a title card
    // promises a longer sit than the tour delivers.
    expect(TUTORIAL_STEPS[0].counted).toBe(false);
    expect(TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1].counted).toBe(false);
  });

  it("gives every counted step a crop and every card its own art", () => {
    for (const s of TUTORIAL_STEPS) {
      if (s.counted) expect(s.crop).not.toBeNull();
      else expect(s.crop).toBeNull();
    }
  });

  it("has a unique id per step", () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives the cards a secondary action and the steps none", () => {
    // A step has the header Skip; a card needs its exit spelled out, because
    // there is no header Skip on the first or last screen.
    for (const s of TUTORIAL_STEPS) {
      if (s.counted) expect(s.secondaryCta).toBeNull();
      else expect(s.secondaryCta).toBeTruthy();
    }
  });
});

describe("counting", () => {
  it("numbers the teaching steps 0..3 in order", () => {
    expect(TUTORIAL_STEPS.map((_, i) => countedIndexOf(i))).toEqual([-1, 0, 1, 2, 3, -1]);
  });

  it("returns -1 for the cards rather than a bogus position", () => {
    expect(countedIndexOf(0)).toBe(-1);
    expect(countedIndexOf(5)).toBe(-1);
  });

  it("survives an out-of-range index", () => {
    expect(countedIndexOf(-1)).toBe(-1);
    expect(countedIndexOf(99)).toBe(-1);
  });
});

describe("what a screen reader hears matches what the dots show", () => {
  it("announces a position for every step that draws dots", () => {
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      const hasDots = countedIndexOf(i) >= 0;
      expect(progressLabel(i) !== null).toBe(hasDots);
    }
  });

  it("counts from one, not from zero", () => {
    expect(progressLabel(1)).toBe("Step 1 of 4");
    expect(progressLabel(4)).toBe("Step 4 of 4");
  });

  it("says nothing on the cards", () => {
    expect(progressLabel(0)).toBeNull();
    expect(progressLabel(5)).toBeNull();
  });

  it("never announces a total that disagrees with COUNTED_STEP_COUNT", () => {
    // The regression this exists for: add a fifth teaching step, forget to
    // touch the dots, and the two silently diverge.
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      const label = progressLabel(i);
      if (label) expect(label.endsWith(`of ${COUNTED_STEP_COUNT}`)).toBe(true);
    }
  });
});

describe("the end", () => {
  it("is the closing card and nothing else", () => {
    expect(isLastStep(TUTORIAL_STEPS.length - 1)).toBe(true);
    for (let i = 0; i < TUTORIAL_STEPS.length - 1; i++) expect(isLastStep(i)).toBe(false);
  });

  it("ends on the real first task, not a dead Done", () => {
    // A tour that closes on "Done" spends the intent it just built.
    expect(TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1].primaryCta).toBe("Add my car");
  });
});
