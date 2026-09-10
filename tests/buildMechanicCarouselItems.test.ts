import { expect, test } from "vitest";

import { formatMechanicAvailabilityLabel } from "../lib/buildMechanicCarouselItems";

test("adds the calendar date on a second line when a mechanic's earliest slot is seven or more days away", () => {
  const today = new Date(2026, 8, 4);

  expect(
    formatMechanicAvailabilityLabel(
      { dayOfWeek: "Fri", day: "11", time: "4:00 PM", scheduledDate: "2026-09-11" },
      today,
    ),
  ).toBe("Fri, Sep 11\n4:00 PM");
  expect(
    formatMechanicAvailabilityLabel(
      { dayOfWeek: "Thu", day: "10", time: "4:00 PM", scheduledDate: "2026-09-10" },
      today,
    ),
  ).toBe("Thu 4:00 PM");
});
