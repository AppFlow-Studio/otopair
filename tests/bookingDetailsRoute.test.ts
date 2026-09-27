import { describe, expect, it } from "vitest";

import { bookingDetailsRoute } from "@/lib/bookingDetailsRoute";

describe("bookingDetailsRoute", () => {
  it("opens the Bookings tab with the exact booking selected", () => {
    expect(bookingDetailsRoute("k57v9s1d8m2q"))
      .toBe("/bookings?bookingId=k57v9s1d8m2q");
  });
});
