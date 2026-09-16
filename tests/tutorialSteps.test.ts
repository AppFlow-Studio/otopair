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
  it("is four teaching steps and a closing card", () => {
    // The opening "Take the tour / Skip for now" card was removed 2026-09-15;
    // the tour now starts on the first teaching step.
    expect(TUTORIAL_STEPS).toHaveLength(5);
    expect(COUNTED_STEP_COUNT).toBe(4);
  });

  it("opens on a teaching step, not a card", () => {
    expect(TUTORIAL_STEPS[0].counted).toBe(true);
    expect(TUTORIAL_STEPS[0].crop).not.toBeNull();
  });

  it("only counts the steps that teach something", () => {
    // The closing card carries no dots: a filled progress bar next to "that's
    // the tour" tells the driver something they can already see.
    expect(TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1].counted).toBe(false);
    expect(TUTORIAL_STEPS.filter((s) => s.counted)).toHaveLength(4);
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
    expect(TUTORIAL_STEPS.map((_, i) => countedIndexOf(i))).toEqual([0, 1, 2, 3, -1]);
  });

  it("returns -1 for the closing card rather than a bogus position", () => {
    expect(countedIndexOf(TUTORIAL_STEPS.length - 1)).toBe(-1);
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
    expect(progressLabel(0)).toBe("Step 1 of 4");
    expect(progressLabel(3)).toBe("Step 4 of 4");
  });

  it("says nothing on the closing card", () => {
    expect(progressLabel(TUTORIAL_STEPS.length - 1)).toBeNull();
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
