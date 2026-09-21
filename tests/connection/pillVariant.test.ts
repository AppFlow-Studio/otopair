import { describe, expect, it } from "vitest";

import { computePillVariant, isPillAllowedBeforeFirstConnect } from "@/lib/connection/pillVariant";

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

describe("isPillAllowedBeforeFirstConnect", () => {
  it("shows the pill in the cached offline mode, where nothing else says so", () => {
    // Offline cold start with saved data boots straight into the app. Before
    // this, the pill stayed hidden until the first connection, so the user saw
    // their last-visit data with no hint it was not live.
    expect(isPillAllowedBeforeFirstConnect({ conn: "offline", bootCache: "valid" })).toBe(true);
  });

  it("stays hidden when the full-screen OfflineScreen is already showing", () => {
    // No saved data means OfflineBootGate shows OfflineScreen; a pill on top
    // would say the same thing twice.
    expect(isPillAllowedBeforeFirstConnect({ conn: "offline", bootCache: "none" })).toBe(false);
  });

  it("never flashes on a healthy start, which briefly reads as reconnecting", () => {
    expect(isPillAllowedBeforeFirstConnect({ conn: "reconnecting", bootCache: "valid" })).toBe(false);
    expect(isPillAllowedBeforeFirstConnect({ conn: "online", bootCache: "valid" })).toBe(false);
  });

  it("waits for the boot-cache check rather than guessing", () => {
    expect(isPillAllowedBeforeFirstConnect({ conn: "offline", bootCache: "checking" })).toBe(false);
  });
});
