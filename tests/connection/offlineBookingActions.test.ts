import { describe, expect, it } from "vitest";

import {
  isBookingActionAllowed,
  type BookingAction,
} from "@/lib/connection/offlineBookingActions";

describe("isBookingActionAllowed", () => {
  it("blocks Cancel Booking while offline", () => {
    expect(isBookingActionAllowed("cancelBooking", false)).toBe(false);
  });

  it("blocks Reschedule while offline", () => {
    expect(isBookingActionAllowed("reschedule", false)).toBe(false);
  });

  it("blocks Message Mechanic while offline", () => {
    // In-app chat needs the backend; there is no offline send queue.
    expect(isBookingActionAllowed("messageMechanic", false)).toBe(false);
  });

  it("blocks Leave a Review while offline", () => {
    // Convex would silently queue the mutation and post it on reconnect —
    // the user must never think a review landed while offline.
    expect(isBookingActionAllowed("leaveReview", false)).toBe(false);
  });

  it("keeps View Details available while offline (data is cached)", () => {
    expect(isBookingActionAllowed("viewDetails", false)).toBe(true);
  });

  it("keeps Directions available while offline (hands off to the maps app)", () => {
    expect(isBookingActionAllowed("directions", false)).toBe(true);
  });

  it("keeps Contact available while offline (hands off to the phone app)", () => {
    expect(isBookingActionAllowed("contact", false)).toBe(true);
  });

  it("keeps Add to Calendar available while offline (device-local write)", () => {
    expect(isBookingActionAllowed("addToCalendar", false)).toBe(true);
  });

  it("allows every action while online", () => {
    const all: BookingAction[] = [
      "viewDetails",
      "cancelBooking",
      "reschedule",
      "messageMechanic",
      "leaveReview",
      "directions",
      "contact",
      "addToCalendar",
    ];
    for (const action of all) {
      expect(isBookingActionAllowed(action, true)).toBe(true);
    }
  });
});
