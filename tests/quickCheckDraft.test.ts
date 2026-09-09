/**
 * Draft rehydration — Quick Check v2 §7 step 10.
 *
 * The failure this guards against is silent, which is why it is tested rather
 * than eyeballed: a v1 draft rehydrates as five ticked tiles that write nothing
 * on Complete. The driver answers, sees confirmation, and no record lands.
 */
import { describe, expect, it } from "vitest";
import { hydrateServiceHistoryDraft } from "@/utils/quickCheckDraft";

const FIRED = ["warningLights", "oil", "tires", "brakes", "battery"] as const;
type Tile = (typeof FIRED)[number] | "biggerServices";

const v2 = { answerType: "never" as const };

describe("nothing to rehydrate", () => {
  it("survives null, undefined and junk", () => {
    for (const raw of [null, undefined, {} as never, { answers: null } as never]) {
      expect(hydrateServiceHistoryDraft<Tile>(raw, FIRED))
        .toEqual({ answers: {}, progress: {}, completed: [] });
    }
  });
});

describe("v1 drafts", () => {
  it("drops a per-question answer map entirely", () => {
    // This is the shape the old overlay saved. It has no `answerType`, so
    // persistAnswers would skip it — but the tile would still show a tick.
    const out = hydrateServiceHistoryDraft<Tile>(
      { answers: { oil: { oilRecency: "few_months", oilMiles: 42_000 } }, completed: ["oil"] },
      FIRED,
    );
    expect(out.answers).toEqual({});
    expect(out.completed).toEqual([]);
  });

  it("does not let the stored completed list resurrect a dropped answer", () => {
    // Completion is derived from answers that survived, never taken on trust —
    // the answers are what write records, so they decide what counts as done.
    const out = hydrateServiceHistoryDraft<Tile>(
      { answers: { oil: { recency: "recently" } }, completed: ["oil", "tires", "brakes"] },
      FIRED,
    );
    expect(out.completed).toEqual([]);
  });

  it("keeps the v2 answers in a half-migrated draft and drops the rest", () => {
    const out = hydrateServiceHistoryDraft<Tile>(
      { answers: { oil: v2, tires: { tireRecency: "over_6mo" } }, completed: ["oil", "tires"] },
      FIRED,
    );
    expect(Object.keys(out.answers)).toEqual(["oil"]);
    expect(out.completed).toEqual(["oil"]);
  });

  it("ignores a v1 question index rather than choking on it", () => {
    const out = hydrateServiceHistoryDraft<Tile>(
      { answers: { oil: v2 }, questionIndex: { oil: 2 } },
      FIRED,
    );
    expect(out.answers.oil).toEqual(v2);
    expect(out).not.toHaveProperty("questionIndex");
  });
});

describe("tiles that no longer fire", () => {
  it("drops an answer for a tile this car is not being asked about", () => {
    // The firing rules are per-vehicle and mileage moves. A tile answered when
    // the car was older-looking must not inflate "N of M" past its own total.
    const out = hydrateServiceHistoryDraft<Tile>(
      { answers: { oil: v2, battery: v2 }, completed: ["oil", "battery"] },
      ["warningLights", "oil"],
    );
    expect(Object.keys(out.answers)).toEqual(["oil"]);
    expect(out.completed).toEqual(["oil"]);
  });

  it("cannot return more completed tiles than were fired", () => {
    const fired = ["warningLights"] as const;
    const out = hydrateServiceHistoryDraft<Tile>(
      { answers: { warningLights: v2, oil: v2, tires: v2, brakes: v2, battery: v2 } },
      fired,
    );
    expect(out.completed.length).toBeLessThanOrEqual(fired.length);
  });
});

describe("v2 drafts", () => {
  it("round-trips every answer type", () => {
    const answers = {
      warningLights: { answerType: "when", lights: ["abs"] },
      oil: { answerType: "never" },
      tires: { answerType: "unsure", symptom: "losing_air" },
    };
    const out = hydrateServiceHistoryDraft<Tile>({ answers }, FIRED);
    expect(out.answers).toEqual(answers);
    expect(out.completed.sort()).toEqual(["oil", "tires", "warningLights"]);
    expect(out.progress).toEqual({ warningLights: 1, oil: 1, tires: 1 });
  });

  it("rejects an answerType it does not recognise", () => {
    const out = hydrateServiceHistoryDraft<Tile>(
      { answers: { oil: { answerType: "sometime_last_year" } } },
      FIRED,
    );
    expect(out.answers).toEqual({});
  });
});

describe("Bigger Services", () => {
  it("is the one tile that can be done without an answer", () => {
    // Its rows write catalog records directly, so "the driver looked" only
    // exists in the completed list.
    const out = hydrateServiceHistoryDraft<Tile>(
      { completed: ["biggerServices"] },
      ["warningLights", "biggerServices"],
    );
    expect(out.completed).toEqual(["biggerServices"]);
    expect(out.progress).toEqual({ biggerServices: 1 });
  });

  it("still has to be a tile this car is asked about", () => {
    const out = hydrateServiceHistoryDraft<Tile>(
      { completed: ["biggerServices"] },
      ["warningLights"],
    );
    expect(out.completed).toEqual([]);
  });

  it("is not listed twice when it somehow also carries an answer", () => {
    const out = hydrateServiceHistoryDraft<Tile>(
      { answers: { biggerServices: v2 }, completed: ["biggerServices"] },
      ["biggerServices"],
    );
    expect(out.completed).toEqual(["biggerServices"]);
  });
});
