import { describe, expect, it } from "vitest";

import { deriveConnState } from "@/lib/connection/deriveConnState";

describe("deriveConnState", () => {
  it("is online whenever the websocket is connected", () => {
    expect(
      deriveConnState({ isWebSocketConnected: true, connectionRetries: 0, netReachable: true }),
    ).toBe("online");
  });

  it("stays online while NetInfo is unresolved if the socket is connected", () => {
    expect(
      deriveConnState({ isWebSocketConnected: true, connectionRetries: 0, netReachable: null }),
    ).toBe("online");
  });

  it("is offline when the device has no network, even if the socket still claims connected", () => {
    // A silently-dead link (elevator, parking garage, emulator airplane mode)
    // can leave a stale-"connected" websocket for minutes. The device's own
    // no-network verdict must win, or every mid-session offline surface stays
    // suppressed exactly when it's needed.
    expect(
      deriveConnState({ isWebSocketConnected: true, connectionRetries: 9, netReachable: false }),
    ).toBe("offline");
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
