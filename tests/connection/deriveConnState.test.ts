import { describe, expect, it } from "vitest";

import { deriveConnState } from "@/lib/connection/deriveConnState";

describe("deriveConnState", () => {
  it("is online whenever the websocket is connected", () => {
    expect(
      deriveConnState({ isWebSocketConnected: true, connectionRetries: 0, netReachable: true }),
    ).toBe("online");
  });

  it("stays online even if NetInfo reports no network (socket wins)", () => {
    expect(
      deriveConnState({ isWebSocketConnected: true, connectionRetries: 9, netReachable: false }),
    ).toBe("online");
  });

  it("is reconnecting on a healthy startup (socket down, no retries, NetInfo unresolved)", () => {
    expect(
      deriveConnState({ isWebSocketConnected: false, connectionRetries: 0, netReachable: null }),
    ).toBe("reconnecting");
  });

  it("is reconnecting while retries are within the ceiling and a network exists", () => {
    expect(
      deriveConnState({ isWebSocketConnected: false, connectionRetries: 2, netReachable: true }),
    ).toBe("reconnecting");
  });

  it("is offline immediately when the device has no network", () => {
    expect(
      deriveConnState({ isWebSocketConnected: false, connectionRetries: 0, netReachable: false }),
    ).toBe("offline");
  });

  it("is offline once the reconnect ceiling is exceeded", () => {
    expect(
      deriveConnState({ isWebSocketConnected: false, connectionRetries: 4, netReachable: true }),
    ).toBe("offline");
  });
});
