/**
 * "What was the mileage when you got it?" and "What's on the odometer right
 * now?" are consecutive steps in the vehicle setup questionnaire, and nothing
 * compared the two answers — 10,000 at purchase then 5,000 today advanced
 * straight to the next question (Kareem, Android).
 */
import { describe, expect, it } from "vitest";
import {
  checkCurrentMileage,
  currentMileageBelowPurchaseMessage,
  parseMileageInput,
} from "../lib/pre-onboarding-mileage";

/** A used purchase — the only path that collects a mileage-at-purchase. */
function boughtUsed(mileageAtPurchaseInput: string, currentMileageInput: string) {
  return checkCurrentMileage({
    ownershipType: "owned",
    ownedSinceNew: false,
    mileageAtPurchaseNotSure: false,
    mileageAtPurchaseInput,
    currentMileageInput,
  });
}

describe("checkCurrentMileage", () => {
  it("rejects an odometer below the mileage at purchase", () => {
    expect(boughtUsed("10000", "5000")).toEqual({
      status: "below_purchase",
      mileageAtPurchase: 10000,
    });
  });

  it("allows equal values — they may have just picked the car up", () => {
    expect(boughtUsed("10000", "10000")).toEqual({ status: "ok" });
  });

  it("allows an odometer above the mileage at purchase", () => {
    expect(boughtUsed("10000", "10001")).toEqual({ status: "ok" });
    expect(boughtUsed("10000", "45000")).toEqual({ status: "ok" });
  });

  it("has nothing to compare when the purchase mileage is 'Not sure'", () => {
    expect(
      checkCurrentMileage({
        ownershipType: "owned",
        ownedSinceNew: false,
        mileageAtPurchaseNotSure: true,
        mileageAtPurchaseInput: "10000",
        currentMileageInput: "5000",
      }),
    ).toEqual({ status: "ok" });
  });

  it("has nothing to compare when the car was bought new", () => {
    expect(
      checkCurrentMileage({
        ownershipType: "owned",
        ownedSinceNew: true,
        mileageAtPurchaseNotSure: false,
        mileageAtPurchaseInput: "10000",
        currentMileageInput: "5000",
      }),
    ).toEqual({ status: "ok" });
  });

  it("has nothing to compare when the vehicle is leased", () => {
    // The leased path skips both the bought-new and mileage-at-purchase
    // steps, so a stale purchase answer from a reverted choice must not
    // trap the user behind a field they can no longer reach.
    expect(
      checkCurrentMileage({
        ownershipType: "leased",
        ownedSinceNew: false,
        mileageAtPurchaseNotSure: false,
        mileageAtPurchaseInput: "10000",
        currentMileageInput: "5000",
      }),
    ).toEqual({ status: "ok" });
  });

  it("has nothing to compare before the ownership question is answered", () => {
    expect(
      checkCurrentMileage({
        ownershipType: undefined,
        ownedSinceNew: undefined,
        mileageAtPurchaseNotSure: false,
        mileageAtPurchaseInput: "",
        currentMileageInput: "",
      }),
    ).toEqual({ status: "ok" });
  });

  it("defers an empty or non-numeric answer to the step's own required gate", () => {
    expect(boughtUsed("10000", "")).toEqual({ status: "ok" });
    expect(boughtUsed("10000", "   ")).toEqual({ status: "ok" });
    expect(boughtUsed("10000", "abc")).toEqual({ status: "ok" });
    expect(boughtUsed("", "5000")).toEqual({ status: "ok" });
    expect(boughtUsed("abc", "5000")).toEqual({ status: "ok" });
  });

  it("compares pasted values that carry separators or padding", () => {
    expect(boughtUsed("10,000", "5,000")).toEqual({
      status: "below_purchase",
      mileageAtPurchase: 10000,
    });
    expect(boughtUsed(" 10000 ", " 45000 ")).toEqual({ status: "ok" });
    // A space used as a separator is not a number the screen can read.
    expect(boughtUsed("10 000", "5000")).toEqual({ status: "ok" });
  });
});

describe("parseMileageInput", () => {
  it("reads digits, separators and padding; rejects everything else", () => {
    expect(parseMileageInput("45000")).toBe(45000);
    expect(parseMileageInput("45,000")).toBe(45000);
    expect(parseMileageInput("  45000  ")).toBe(45000);
    expect(parseMileageInput("")).toBeUndefined();
    expect(parseMileageInput("   ")).toBeUndefined();
    expect(parseMileageInput("abc")).toBeUndefined();
    expect(parseMileageInput("45k")).toBeUndefined();
  });
});

describe("currentMileageBelowPurchaseMessage", () => {
  it("prints the purchase mileage with thousands separators", () => {
    expect(currentMileageBelowPurchaseMessage(10000)).toBe(
      "That's lower than the mileage when you got it (10,000 mi). Double-check both numbers.",
    );
    expect(currentMileageBelowPurchaseMessage(1250000)).toContain("(1,250,000 mi)");
    expect(currentMileageBelowPurchaseMessage(900)).toContain("(900 mi)");
  });
});
