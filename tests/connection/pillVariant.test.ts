import { describe, expect, it } from "vitest";

import { computePillVariant } from "@/lib/connection/pillVariant";

describe("computePillVariant", () => {
  it("shows nothing when steadily online", () => {
    expect(
      computePillVariant({ conn: "online", showRecovery: false, retrying: false }),
    ).toBeNull();
  });

  it("shows reconnecting when the socket is retrying on its own", () => {
    expect(
      computePillVariant({ conn: "reconnecting", showRecovery: false, retrying: false }),
    ).toBe("reconnecting");
  });

  it("shows offline when there is no connection", () => {
    expect(
      computePillVariant({ conn: "offline", showRecovery: false, retrying: false }),
    ).toBe("offline");
  });

  it("shows the recovery flash when just back online", () => {
    expect(
      computePillVariant({ conn: "online", showRecovery: true, retrying: false }),
    ).toBe("recovering");
  });

  it("shows reconnecting right after Retry is pressed, even while still offline", () => {
    // The whole point of the fix: tapping Retry gives immediate 'Reconnecting…'
    // feedback instead of silently staying on 'No connection'.
    expect(
      computePillVariant({ conn: "offline", showRecovery: false, retrying: true }),
    ).toBe("reconnecting");
  });

  it("lets the recovery flash win over a pending retry once actually online", () => {
    // If the retry succeeds, 'Back online' must not be masked by the transient
    // retry feedback.
    expect(
      computePillVariant({ conn: "online", showRecovery: true, retrying: true }),
    ).toBe("recovering");
  });
});
