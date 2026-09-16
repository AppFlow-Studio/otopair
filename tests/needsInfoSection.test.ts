/**
 * "Needs more info" — answering has to visibly do something.
 *
 * The label went through one revision: it was "ONE MORE DETAIL", which
 * promised a count the section cannot keep — sometimes more than one field is
 * missing (Ahmad, 2026-09-14).
 *
 * Yassin via Ahmad, 2026-09-14: "notice how nothing really changes on the
 * screen besides that little bit of text saying 'not enough info' — to a user
 * they will think the app isn't actually taking their input properly."
 *
 * He was right, and the cause was in the data rather than the styling. Four
 * different unknown states existed and all of them rendered identically, so
 * the tracker had no way to tell "we never asked" from "you answered and it
 * wasn't enough". `unknownReason` is that distinction; the section split is
 * what makes it visible — the row LEAVES the unknown list when answered.
 */
import { describe, expect, it } from "vitest";
import { buildMergedMaintenanceItems } from "@/utils/mergedMaintenance";
import { healthySectionChip, splitQuietItems } from "@/utils/healthySection";

const NOW = new Date(2026, 8, 14).getTime();
const CLASS_A = { vehicleClass: "A", drivetrain: "rwd", hasDifferential: true };

function catalogItems(records: unknown[]) {
  return buildMergedMaintenanceItems({
    userItems: new Map(),
    vehicleYear: 2018,
    now: NOW,
    currentOdometer: 120_000,
    scopeId: "v",
    classCtx: CLASS_A as never,
    records: records as never,
  }).filter((i) => i.id.startsWith("catalog-"));
}

/** A date-only answer on spark plugs — miles-only, so it cannot be measured. */
const ANSWERED_PLUGS = {
  type: "catalog_spark_plugs",
  lastServiceDate: new Date(2024, 2, 1).getTime(),
  customInputs: { answerType: "when" },
};

describe("the state the driver created by answering", () => {
  it("is marked as missing_mileage, not as no record", () => {
    const plugs = catalogItems([ANSWERED_PLUGS]).find((i) => i.id === "catalog-spark_plugs");
    expect(plugs?.status).toBe("unknown");
    expect(plugs?.unknownReason).toBe("missing_mileage");
  });

  it("carries their answer back for the row to echo", () => {
    // A row that only says what is MISSING reads as the input having been
    // ignored. Showing what landed first is what makes it read as progress.
    const plugs = catalogItems([ANSWERED_PLUGS]).find((i) => i.id === "catalog-spark_plugs");
    expect(plugs?.capturedAnswer).toBe("March 2024");
  });

  it("leaves untouched services marked as no record", () => {
    for (const i of catalogItems([ANSWERED_PLUGS])) {
      if (i.id === "catalog-spark_plugs") continue;
      expect(i.unknownReason).toBe("no_record");
      expect(i.capturedAnswer).toBeUndefined();
    }
  });
});

describe("the row moves", () => {
  it("lands in its own group rather than in unknown", () => {
    // This is the whole fix: something on the screen changes position, not
    // just a line of small grey text.
    const quiet = splitQuietItems(catalogItems([ANSWERED_PLUGS]) as never);
    expect(quiet.needsInfo).toHaveLength(1);
    const ids = (quiet.unknown as unknown as { id: string }[]).map((i) => i.id);
    expect(ids).not.toContain("catalog-spark_plugs");
  });

  it("is empty before anything is answered", () => {
    const quiet = splitQuietItems(catalogItems([]) as never);
    expect(quiet.needsInfo).toHaveLength(0);
    expect(quiet.unknown.length).toBeGreaterThan(0);
  });

  it("moves one row out of unknown rather than duplicating it", () => {
    const before = splitQuietItems(catalogItems([]) as never);
    const after = splitQuietItems(catalogItems([ANSWERED_PLUGS]) as never);
    expect(after.unknown.length).toBe(before.unknown.length - 1);
    expect(after.unknown.length + after.needsInfo.length).toBe(before.unknown.length);
  });
});

describe("the section chip", () => {
  it("names the ask without promising how much is missing", () => {
    // "One more detail" was the first label and it over-promised: the count
    // is not always one (Ahmad, 2026-09-14).
    expect(healthySectionChip("needsInfo", 2)).toBe("NEEDS MORE INFO · 2");
  });

  it("leaves the existing two alone", () => {
    expect(healthySectionChip("healthy", 3)).toBe("HEALTHY · 3");
    expect(healthySectionChip("unknown", 4)).toBe("UNKNOWN · 4");
  });
});

describe("a real answer still resolves the row completely", () => {
  it("stops being unknown once the mileage is supplied", () => {
    // The point of the prompt. With both axes measurable the row leaves the
    // quiet sections entirely.
    const plugs = catalogItems([
      { ...ANSWERED_PLUGS, lastServiceMileage: 90_000 },
    ]).find((i) => i.id === "catalog-spark_plugs");
    expect(plugs?.status).not.toBe("unknown");
    expect(plugs?.unknownReason).toBeUndefined();
  });
});
