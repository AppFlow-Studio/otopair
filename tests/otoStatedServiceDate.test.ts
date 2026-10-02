/**
 * #376 (Oyelade, Sep 25): "My Jeep Cherokee had an oil change at Damis shop
 * on September 22" produced a save card reading "Log Oil Change as done (24
 * months ago)". Reproduced on Android 2026-10-01: the model sent
 * service_date 1726963200000, which is Sep 22 2024. Oto is never told the
 * current date, so it guessed the year.
 */
import { describe, expect, it } from "vitest";
import { executeTool } from "../convex/oto/dispatcher";
import { buildEnvelope } from "../convex/oto/envelope";
import {
  correctNamedWeekdayDates,
  correctYearlessServiceDates,
  mostRecentPastDate,
  pastWeekdaysNamed,
  serviceDateToMs,
  yearlessDates,
} from "../convex/oto/statedServiceDate";

const TODAY = "2026-10-01";
const SEP_22_2024 = 1726963200000; // what the model sent
const SEP_22_2026 = Date.UTC(2026, 8, 22, 16);

describe("finding dates said without a year", () => {
  it("reads the common ways people say a date", () => {
    expect(yearlessDates("My M5 had an oil change at Damis shop on September 22")).toEqual([{ month: 9, day: 22 }]);
    expect(yearlessDates("did the brakes on Sept. 22nd")).toEqual([{ month: 9, day: 22 }]);
    expect(yearlessDates("changed it the 22nd of September")).toEqual([{ month: 9, day: 22 }]);
  });

  it("finds nothing when the user names a year or no date", () => {
    expect(yearlessDates("oil change on September 22, 2025")).toEqual([]);
    expect(yearlessDates("oil change last week")).toEqual([]);
  });

  it("reads a numeric month/day, and day/month when the first number can't be a month", () => {
    expect(yearlessDates("also had an oil change done on 9/18")).toEqual([{ month: 9, day: 18 }]);
    expect(yearlessDates("tyres done 18/9")).toEqual([{ month: 9, day: 18 }]);
    expect(yearlessDates("oil change 9/18/24")).toEqual([]);
  });
});

describe("the date Oto writes on a save card", () => {
  it("turns YYYY-MM-DD into the card's timestamp", () => {
    expect(serviceDateToMs("2026-09-22")).toBe(SEP_22_2026);
    expect(serviceDateToMs(SEP_22_2024)).toBe(SEP_22_2024);
  });

  it("drops dates that aren't real or aren't YYYY-MM-DD", () => {
    expect(serviceDateToMs("2026-02-30")).toBeUndefined();
    expect(serviceDateToMs("September 22")).toBeUndefined();
    expect(serviceDateToMs(Number.NaN)).toBeUndefined();
  });

  it("reaches the card as a timestamp", async () => {
    const res = await executeTool(
      {
        type: "tool_use",
        id: "t1",
        name: "render_vehicle_update",
        input: { service_claims: [{ service_slug: "oil_change", kind: "completed", service_date: "2026-09-22" }] },
      },
      {},
    );
    expect(JSON.parse(res.content).data.value.service_claims[0].service_date).toBe(SEP_22_2026);
  });
});

describe("picking the year", () => {
  it("uses this year when the date has already passed", () => {
    expect(mostRecentPastDate({ month: 9, day: 22 }, TODAY)).toBe("2026-09-22");
    expect(mostRecentPastDate({ month: 10, day: 1 }, TODAY)).toBe("2026-10-01");
  });

  it("uses last year when this year's date is still ahead", () => {
    expect(mostRecentPastDate({ month: 12, day: 5 }, TODAY)).toBe("2025-12-05");
  });
});

describe("correcting the save card", () => {
  const claim = { service_slug: "oil_change", kind: "completed", service_date: SEP_22_2024 };

  it("moves a guessed year to the most recent September 22", () => {
    const [fixed] = correctYearlessServiceDates([claim], "oil change at Damis shop on September 22", TODAY);
    expect(fixed.service_date).toBe(SEP_22_2026);
  });

  it("leaves the date alone when the user said the year", () => {
    const [kept] = correctYearlessServiceDates([claim], "oil change on September 22, 2024", TODAY);
    expect(kept.service_date).toBe(SEP_22_2024);
  });

  it("moves a guessed year for a numeric date too", () => {
    const sep18 = { service_slug: "oil_change", kind: "completed", service_date: Date.UTC(2024, 8, 18, 16) };
    const [fixed] = correctYearlessServiceDates([sep18], "also had an oil change done on 9/18", TODAY);
    expect(fixed.service_date).toBe(Date.UTC(2026, 8, 18, 16));
  });

  it("leaves claims alone that don't match the date the user said", () => {
    const relative = { service_slug: "oil_change", kind: "completed", service_age_days: 7 };
    const otherDay = { ...claim, service_date: Date.UTC(2026, 8, 1) };
    const due = { service_slug: "oil_change", kind: "due", service_date: SEP_22_2024 };
    const out = correctYearlessServiceDates([relative, otherDay, due], "oil change on September 22", TODAY);
    expect(out).toEqual([relative, otherDay, due]);
  });
});

// Asked on Thursday Oct 1, "last saturday" came back as Sep 27 (a Sunday) or
// "7 days ago". It was Sep 26.
describe("\"last Saturday\"", () => {
  const SEP_26 = Date.UTC(2026, 8, 26, 16);

  it("is the most recent Saturday before today", () => {
    expect(pastWeekdaysNamed("i swapped the engine air filter last saturday", TODAY)).toEqual([
      { said: "last saturday", date: "2026-09-26", weekday: "Sat" },
    ]);
    expect(pastWeekdaysNamed("did it this past Tues", TODAY)[0].date).toBe("2026-09-29");
    expect(pastWeekdaysNamed("last thursday", TODAY)[0].date).toBe("2026-09-24");
    expect(pastWeekdaysNamed("oil change last month", TODAY)).toEqual([]);
  });

  it("comes worked out in the <user> block", () => {
    const envelope = buildEnvelope({
      userFirstName: "Waleed",
      vehicle: null,
      history: [],
      userMessage: "i swapped the engine air filter last saturday",
      localNow: { date: TODAY, time: "07:32", weekday: "Thursday" },
    });
    expect(envelope).toContain(`  "last saturday" in the message: Sat 2026-09-26\n`);
  });

  it("corrects a claim the model put a day or two off, or gave as an age", () => {
    const message = "i swapped the engine air filter last saturday";
    const offByOne = { service_slug: "engine_air_filter_replacement", kind: "completed", service_date: Date.UTC(2026, 8, 27, 16) };
    const aged = { service_slug: "engine_air_filter_replacement", kind: "completed", service_age_days: 7 };
    expect(correctNamedWeekdayDates([offByOne], message, TODAY)[0].service_date).toBe(SEP_26);
    expect(correctNamedWeekdayDates([aged], message, TODAY)).toEqual([
      { service_slug: "engine_air_filter_replacement", kind: "completed", service_date: SEP_26 },
    ]);
  });

  it("leaves claims alone when the message has another way of saying when", () => {
    const claim = { service_slug: "oil_change", kind: "completed", service_age_days: 7 };
    const far = { service_slug: "oil_change", kind: "completed", service_date: Date.UTC(2026, 8, 18, 16) };
    expect(correctNamedWeekdayDates([claim], "oil a week ago, air filter last saturday", TODAY)).toEqual([claim]);
    expect(correctNamedWeekdayDates([claim], "brakes on friday and the filter last saturday", TODAY)).toEqual([claim]);
    expect(correctNamedWeekdayDates([far], "air filter last saturday", TODAY)).toEqual([far]);
  });
});

describe("the <user> block tells Oto today's date", () => {
  it("includes the New York date and weekday", () => {
    const envelope = buildEnvelope({
      userFirstName: "Waleed",
      vehicle: null,
      history: [],
      userMessage: "My M5 had an oil change on September 22",
      localNow: { date: TODAY, time: "15:00", weekday: "Thursday" },
    });
    expect(envelope).toContain("today: Thursday 2026-10-01, 15:00 New York time");
  });

  it("lists the week either side, so weekdays are read off rather than counted", () => {
    const envelope = buildEnvelope({
      userFirstName: "Waleed",
      vehicle: null,
      history: [],
      userMessage: "I swapped the air filter last Saturday",
      localNow: { date: TODAY, time: "15:00", weekday: "Thursday" },
    });
    expect(envelope).toContain("Sat 2026-09-26, Sun 2026-09-27");
    expect(envelope).toContain("Thu 2026-10-01 (today), Fri 2026-10-02, Sat 2026-10-03");
    expect(envelope).toMatch(/calendar: Thu 2026-09-24, .* Thu 2026-10-08\n/);
  });
});
