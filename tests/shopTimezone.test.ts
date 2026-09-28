import { describe, expect, test } from "vitest";

import {
  formatShopTime,
  shopTodayISO,
} from "../lib/shopTimezone";

describe("shop timezone formatting", () => {
  test("labels an appointment using the shop's daylight-saving abbreviation", () => {
    expect(formatShopTime("15:00", "2026-09-21", "America/New_York")).toBe("3:00 PM EDT");
  });

  test("uses standard time outside daylight saving time", () => {
    expect(formatShopTime("15:00", "2026-01-21", "America/New_York")).toBe("3:00 PM EST");
  });

  test("uses the shop's business date instead of the viewer's date", () => {
    expect(shopTodayISO("America/New_York", new Date("2026-09-22T00:30:00Z"))).toBe("2026-09-21");
  });
});
