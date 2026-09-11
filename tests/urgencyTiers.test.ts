/**
 * Which section an item lands in — and what still decides its order.
 *
 * Ahmad, 2026-09-04: the tracker's sections now mirror Yassin's four interval
 * bands one-to-one, so the section a driver sees is exactly what the ratio
 * said. Before this, the section came from the urgency SCORE, which blends
 * status severity with the category weight — and that produced a genuinely
 * confusing result: an overdue brake job scored 85 and led NOW while an
 * overdue state inspection scored 59 and sat in SOON. Same band, same "past
 * due" fact, two different headings.
 *
 * The score did not go away. It still ranks items inside a section, which is
 * the right place for "brakes matter more than an inspection sticker".
 */
import { describe, expect, it } from "vitest";
import { compareUrgency, computeUrgency } from "@/utils/urgency";

const at = (id: string, status: string, percentUsed = 100) =>
  computeUrgency({ id, status: status as never, percentUsed });

describe("status decides the section", () => {
  it("maps each band to its own tier", () => {
    expect(at("oil-1", "overdue").tier).toBe("now");
    expect(at("oil-1", "needs_attention").tier).toBe("attention");
    expect(at("oil-1", "due_soon").tier).toBe("soon");
    expect(at("oil-1", "on_time", 20).tier).toBe("resting");
  });

  it("files unknown under resting, not a tier of its own", () => {
    // The tracker splits UNKNOWN out downstream into its own quiet section,
    // and the RECOMMENDED diagnostic-scan card is what acts on it. Giving it
    // an urgency tier here would produce two competing homes for one item.
    expect(at("oil-1", "unknown", 0).tier).toBe("resting");
  });

  it("puts brakes and an inspection in the SAME section when they share a band", () => {
    // The regression this change exists to prevent. These two used to split
    // across NOW and SOON purely because of their category weights.
    expect(at("brakes-1", "needs_attention").tier)
      .toBe(at("inspection-1", "needs_attention").tier);
  });

  it("does not let a heavy category jump an item up a section", () => {
    // Brakes at DUE SOON stays in SOON, however loud it scores. Under the old
    // score-bucketed rule a high enough score could cross the NOW cutoff.
    expect(at("brakes-1", "due_soon").tier).toBe("soon");
  });
});

describe("the score still ranks within a section", () => {
  it("keeps brakes above an inspection in the same band", () => {
    const brakes = at("brakes-1", "needs_attention");
    const inspection = at("inspection-1", "needs_attention");
    expect(brakes.score).toBeGreaterThan(inspection.score);
    expect(compareUrgency(
      { urgency: brakes.score },
      { urgency: inspection.score },
    )).toBeLessThan(0); // brakes sorts first
  });

  it("still rewards proximity within a band", () => {
    expect(at("oil-1", "due_soon", 95).score)
      .toBeGreaterThan(at("oil-1", "due_soon", 60).score);
  });
});
