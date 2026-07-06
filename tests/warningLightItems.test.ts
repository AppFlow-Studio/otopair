import { describe, it, expect } from "vitest";
import { buildWarningLightItem } from "@/lib/warningLightItems";

// The consolidated "warning lights active" card must surface an UNPAIRED
// dashboard light regardless of which knownIssues shape/vocabulary was written.
// Before the fix it switched on knownIssues[0] as a sentinel, so a light in the
// flat code-set (or appended after a stale no_all_clear) produced no card.
const scopeId = "owner_1";

describe("buildWarningLightItem", () => {
  it("surfaces an unpaired light from a flat code-set (paired oil_pressure filtered out)", () => {
    const item = buildWarningLightItem({ knownIssues: ["oil_pressure", "temperature"], scopeId });
    expect(item).not.toBeNull();
    expect(item!.status).toBe("overdue");
    expect(item!.serviceName).toContain("Temperature");
  });

  it("surfaces a light appended after a stale no_all_clear sentinel (the Oto corruption)", () => {
    const item = buildWarningLightItem({ knownIssues: ["no_all_clear", "temperature"], scopeId });
    expect(item).not.toBeNull();
    expect(item!.serviceName).toContain("Temperature");
  });

  it("still reads the legacy sentinel-prefixed shape", () => {
    const item = buildWarningLightItem({ knownIssues: ["other", "temperature"], scopeId });
    expect(item).not.toBeNull();
    expect(item!.serviceName).toContain("Temperature");
  });

  it("returns null when only paired lights are on (they surface via the tile)", () => {
    expect(buildWarningLightItem({ knownIssues: ["oil_pressure"], scopeId })).toBeNull();
    expect(buildWarningLightItem({ knownIssues: ["battery"], scopeId })).toBeNull(); // battery -> battery_charging (paired)
  });

  it("returns null when there are no active lights", () => {
    expect(buildWarningLightItem({ knownIssues: ["no_all_clear"], scopeId })).toBeNull();
    expect(buildWarningLightItem({ knownIssues: [], scopeId })).toBeNull();
    expect(buildWarningLightItem({ knownIssues: undefined, scopeId })).toBeNull();
  });

  it("surfaces check_engine even when it is not the first array element", () => {
    const item = buildWarningLightItem({ knownIssues: ["oil_pressure", "check_engine"], scopeId });
    expect(item).not.toBeNull();
    expect(item!.serviceName.toLowerCase()).toContain("check engine");
  });

  it("surfaces an unpaired symptom-vocabulary light (transmission)", () => {
    const item = buildWarningLightItem({ knownIssues: ["transmission"], scopeId });
    expect(item).not.toBeNull();
    expect(item!.serviceName).toContain("Transmission");
  });
});
