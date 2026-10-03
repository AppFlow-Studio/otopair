import { describe, expect, test } from "vitest";

import { normalizeBufferMinutes } from "../lib/schedule-overlap";
import { formatJobMinutes, slotFitNote } from "../utils/timeSlotUtils";

// Bug #392: the picker hid a 75-minute gap between two bookings because a
// 1-hour job also needs the shop's gap on each side. The caption says so.
describe("slotFitNote", () => {
  test("names the job length and the shop's gap between jobs", () => {
    expect(slotFitNote(60, 15)).toBe("Times fit your ~1 hr job plus 15 min between jobs.");
  });

  test("an unset shop buffer reads as the server's 10-minute default", () => {
    expect(slotFitNote(45, normalizeBufferMinutes(undefined))).toBe(
      "Times fit your ~45 min job plus 10 min between jobs.",
    );
  });

  test("leaves the gap out when the shop isn't loaded", () => {
    expect(slotFitNote(90, null)).toBe("Times fit your ~1 hr 30 min job.");
  });

  test("says nothing when the job length is unknown", () => {
    expect(slotFitNote(0, 15)).toBeNull();
  });
});

describe("formatJobMinutes", () => {
  test("formats minutes, whole hours, and hours with minutes", () => {
    expect(formatJobMinutes(30)).toBe("30 min");
    expect(formatJobMinutes(120)).toBe("2 hr");
    expect(formatJobMinutes(75)).toBe("1 hr 15 min");
  });
});
