import { describe, expect, test } from "vitest";

import { isQuotedSlotBookable } from "../utils/timeSlotUtils";

describe("isQuotedSlotBookable", () => {
  test("rejects a quoted slot on a past day", () => {
    const now = new Date(2026, 7, 26, 21, 0);

    expect(isQuotedSlotBookable("2026-08-25", "22:00", true, now)).toBe(false);
  });

  test("rejects a same-day slot that has already started", () => {
    const now = new Date(2026, 7, 26, 22, 1);

    expect(isQuotedSlotBookable("2026-08-26", "22:00", true, now)).toBe(false);
  });

  // A shop-held slot (serverAvailable) is a shop commitment, so it is exempt
  // from the customer's 1-hour advance-notice window. The reported case: at
  // 11:59 the shop's held 12:30 slot (31 min out) must still be one-tap
  // bookable, where the old notice floor hid it.
  test("accepts a same-day held slot inside the one-hour notice window", () => {
    const now = new Date(2026, 7, 26, 11, 59);

    expect(isQuotedSlotBookable("2026-08-26", "12:30", true, now)).toBe(true);
  });

  test("accepts a same-day held slot starting this very minute", () => {
    const now = new Date(2026, 7, 26, 12, 30);

    expect(isQuotedSlotBookable("2026-08-26", "12:30", true, now)).toBe(true);
  });

  test("accepts a future-day slot when the server says it is available", () => {
    const now = new Date(2026, 7, 26, 23, 30);

    expect(isQuotedSlotBookable("2026-08-27", "09:00", true, now)).toBe(true);
  });

  test("rejects a slot the server says is unavailable", () => {
    const now = new Date(2026, 7, 26, 9, 0);

    expect(isQuotedSlotBookable("2026-08-26", "11:00", false, now)).toBe(false);
  });
});
