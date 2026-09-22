import { describe, expect, it } from "vitest";

import { resolveSelectedOptionId } from "@/lib/onboarding-selected-option";

const OPTIONS = [
  { id: "referral", label: "Friend or family recommended it" },
  { id: "planning_ahead", label: "I'm planning ahead for upcoming maintenance" },
  { id: "other", label: "Other" },
];

describe("resolveSelectedOptionId", () => {
  it("THE BUG: finds the option from the label Convex hands back", () => {
    // Stepping back re-mounted the step with the saved answer text in the
    // store — Continue stayed enabled and no option was highlighted.
    expect(resolveSelectedOptionId(OPTIONS, "Friend or family recommended it")).toBe("referral");
  });

  it("still accepts the id the step itself wrote", () => {
    expect(resolveSelectedOptionId(OPTIONS, "planning_ahead")).toBe("planning_ahead");
  });

  it("treats an unanswered question as unanswered", () => {
    expect(resolveSelectedOptionId(OPTIONS, null)).toBeNull();
    expect(resolveSelectedOptionId(OPTIONS, undefined)).toBeNull();
    expect(resolveSelectedOptionId(OPTIONS, "")).toBeNull();
  });

  it("drops an answer no current option matches, so Continue cannot submit an invisible choice", () => {
    expect(resolveSelectedOptionId(OPTIONS, "An option that was since reworded")).toBeNull();
  });
});
