import { describe, expect, it } from "vitest";

import { shouldShowCantLoad } from "@/lib/connection/offlineGuard";

describe("shouldShowCantLoad", () => {
  it("fires when an unresolved query is stuck offline", () => {
    expect(shouldShowCantLoad({ queryUnresolved: true, conn: "offline" })).toBe(true);
  });

  it("does not fire once the query has resolved (data is cached)", () => {
    expect(shouldShowCantLoad({ queryUnresolved: false, conn: "offline" })).toBe(false);
  });

  it("does not fire while online, even if the query is still loading", () => {
    expect(shouldShowCantLoad({ queryUnresolved: true, conn: "online" })).toBe(false);
  });

  it("does not fire while reconnecting (give the socket a chance)", () => {
    expect(shouldShowCantLoad({ queryUnresolved: true, conn: "reconnecting" })).toBe(false);
  });
});
