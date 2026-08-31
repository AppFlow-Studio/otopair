import { describe, expect, it } from "vitest";

import {
  getQuoteTileState,
  getQuoteUnavailableCopy,
  readQuoteUnavailableReason,
} from "../utils/quoteAvailability";

describe("quote availability messages", () => {
  it("requires a new request after expiration", () => {
    expect(getQuoteUnavailableCopy("expired")).toEqual({
      title: "This quote is no longer available",
      message: "If you'd like another quote, please create a new quote request.",
      actionLabel: "Continue",
    });
  });

  it("keeps an expired quote tile for 24 hours, then hides it", () => {
    const expiresAt = Date.UTC(2026, 7, 29, 20, 0);

    expect(getQuoteTileState("ready", expiresAt, expiresAt - 1)).toBe("ready");
    expect(getQuoteTileState("ready", expiresAt, expiresAt)).toBe("expired");
    expect(getQuoteTileState("expired", expiresAt, expiresAt + 24 * 60 * 60_000 - 1)).toBe(
      "expired",
    );
    expect(getQuoteTileState("expired", expiresAt, expiresAt + 24 * 60 * 60_000)).toBe(
      "hidden",
    );
  });

  it("hides a quote tile as soon as every shop quote is cancelled", () => {
    expect(getQuoteTileState("cancelled", null, Date.now())).toBe("hidden");
  });

  it("allows another shop quote after cancellation", () => {
    expect(getQuoteUnavailableCopy("cancelled").message).toBe(
      "Please select another quote or create a new quote request.",
    );
  });

  it("does not expose revision language after a modification", () => {
    const copy = getQuoteUnavailableCopy("modified");
    expect(copy.message).toBe("Please select a new quote to continue.");
    expect(`${copy.title} ${copy.message}`.toLowerCase()).not.toContain("revision");
    expect(`${copy.title} ${copy.message}`.toLowerCase()).not.toContain("modified");
  });

  it("reads structured Convex quote errors", () => {
    expect(
      readQuoteUnavailableReason({
        data: { code: "QUOTE_UNAVAILABLE", reason: "cancelled" },
      }),
    ).toBe("cancelled");
    expect(readQuoteUnavailableReason(new Error("network"))).toBeNull();
  });
});
