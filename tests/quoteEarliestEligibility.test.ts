import { describe, expect, test } from "vitest";

import { isQuotedSlotBookable } from "../utils/timeSlotUtils";

describe("isQuotedSlotBookable", () => {
  test("rejects a quoted slot in the past", () => {
    const now = new Date(2026, 7, 26, 21, 0);

    expect(isQuotedSlotBookable("2026-08-25", "22:00", true, now)).toBe(false);
  });

  test("rejects a same-day slot before the rounded one-hour notice floor", () => {
    const now = new Date(2026, 7, 26, 21, 1);

    expect(isQuotedSlotBookable("2026-08-26", "22:00", true, now)).toBe(false);
  });

  test("accepts a same-day slot at the rounded one-hour notice floor", () => {
    const now = new Date(2026, 7, 26, 21, 1);

    expect(isQuotedSlotBookable("2026-08-26", "22:15", true, now)).toBe(true);
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
