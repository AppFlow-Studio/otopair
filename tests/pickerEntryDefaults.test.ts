import { describe, expect, test } from "vitest";

import {
  findFirstAvailableDate,
  getPickerFloor,
  getPickerInitialMechanicId,
} from "../utils/timeSlotUtils";

describe("date and mechanic picker entry defaults", () => {
  test("manual quote scheduling starts with Any mechanic", () => {
    expect(
      getPickerInitialMechanicId({
        autoConfirmEarliest: false,
        quoteMechanicId: "LUKE",
        routeMechanicId: null,
      }),
    ).toBeNull();
  });

  test("normal scheduling honors the mechanic chosen on the previous screen", () => {
    expect(
      getPickerInitialMechanicId({
        autoConfirmEarliest: false,
        quoteMechanicId: null,
        routeMechanicId: "JAMES",
      }),
    ).toBe("JAMES");
  });

  test("earliest-time fast path keeps the shop's quoted mechanic", () => {
    expect(
      getPickerInitialMechanicId({
        autoConfirmEarliest: true,
        quoteMechanicId: "LUKE",
        routeMechanicId: null,
      }),
    ).toBe("LUKE");
  });

  test("manual quote scheduling ignores the quoted date-time floor", () => {
    expect(
      getPickerFloor(
        { date: "2026-08-28", time: "14:00" },
        { date: "2026-09-01", time: "16:15" },
        false,
      ),
    ).toEqual({ date: "2026-08-28", time: "14:00" });
  });

  test("earliest-time fast path keeps the later quote floor", () => {
    expect(
      getPickerFloor(
        { date: "2026-08-28", time: "14:00" },
        { date: "2026-09-01", time: "16:15" },
        true,
      ),
    ).toEqual({ date: "2026-09-01", time: "16:15" });
  });

  test("selects the true first available date across a month boundary", () => {
    expect(
      findFirstAvailableDate(
        ["2026-08-28", "2026-08-29", "2026-09-01"],
        ["2026-08-28", "2026-09-01"],
        "2026-08-28",
      ),
    ).toBe("2026-08-28");
  });

  test("waits for availability instead of provisionally selecting next month", () => {
    expect(
      findFirstAvailableDate(
        ["2026-08-28", "2026-08-29", "2026-09-01"],
        [],
        "2026-08-28",
      ),
    ).toBeNull();
  });
});
