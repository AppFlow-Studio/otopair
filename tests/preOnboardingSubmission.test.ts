import { describe, expect, it } from "vitest";

import { completePreOnboarding } from "../lib/pre-onboarding-submission";

describe("completePreOnboarding", () => {
  it("does not advance when the final save fails", async () => {
    let advanced = false;

    const error = await completePreOnboarding(
      async () => {
        throw new Error("offline");
      },
      () => {
        advanced = true;
      },
    );

    expect(advanced).toBe(false);
    expect(error).toBe("Couldn’t finish saving your vehicle details. Try again.");
  });

  it("advances only after the final save succeeds", async () => {
    const events: string[] = [];

    const error = await completePreOnboarding(
      async () => {
        events.push("saved");
      },
      () => {
        events.push("advanced");
      },
    );

    expect(error).toBeNull();
    expect(events).toEqual(["saved", "advanced"]);
  });
});
