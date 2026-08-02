import { describe, it, expect } from "vitest";
import { computeVehicleHealthScore } from "@/utils/healthScore";

// The warning-light penalty must apply regardless of the knownIssues shape or
// vocabulary. It only moves the 15-pt warning reserve, so the score delta
// between "no light" and "light on" equals the light's penalty exactly.
// Before the fix, warningLightPenalty read knownIssues[0] as a sentinel, so a
// light in the flat shape (or after a stale no_all_clear, or in the symptom
// vocabulary) produced a 0 penalty — the score never moved.
function scoreWith(knownIssues: string[]): number {
  return computeVehicleHealthScore({ maintenanceItems: [], odometerMiles: 40000, knownIssues });
}

describe("computeVehicleHealthScore — warning-light penalty", () => {
  const baseline = scoreWith([]);

  it("penalises an oil_pressure light in the flat code-set", () => {
    expect(baseline - scoreWith(["oil_pressure"])).toBe(15);
  });

  it("penalises a light appended after a stale no_all_clear sentinel (the Oto corruption)", () => {
    expect(baseline - scoreWith(["no_all_clear", "oil_pressure"])).toBe(15);
  });

  it("penalises a symptom-vocabulary light (brake_warning -> abs, 8 pts)", () => {
    expect(baseline - scoreWith(["brake_warning"])).toBe(8);
  });

  it("does not penalise an all-clear vehicle", () => {
    expect(baseline - scoreWith(["no_all_clear"])).toBe(0);
  });

  it("still honours the legacy sentinel shape (['other','temperature'] = 15)", () => {
    expect(baseline - scoreWith(["other", "temperature"])).toBe(15);
  });
});
