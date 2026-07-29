import { describe, it, expect } from "vitest";
import { computeMaintenanceStatus } from "@/utils/maintenanceStatus";

// The per-type maintenance TILE status escalates when the matching dashboard
// light is on. The escalation membership test must accept the symptom-code
// vocabulary Oto/check-in actually write (brake_warning, battery, tire_issue,
// TPMS), not only the canonical light ids — otherwise a brake light logged via
// Oto ("brake_warning") never escalates the brake tile (the core surfacing bug).
//
// The assertions accept either escalated status: the tile LEVEL is owned by the
// Yassin v1.1 §3.2 severity policy (escalateForWarningLight now targets
// `overdue` so paired lights clear the Now-tier cutoff), while what this file
// pins is that the light is RECOGNIZED at all, whichever vocabulary wrote it.
const ESCALATED = ["needs_attention", "overdue"];
const NOW = 1_700_000_000_000;
function record(type: string, extra: Record<string, unknown> = {}) {
  // Serviced right now at the current odometer → core status is benign (on_time),
  // so any escalation we observe is purely from the warning light.
  return { type, lastServiceDate: NOW, lastServiceMileage: 40000, ...extra } as any;
}
function statusFor(type: string, knownIssues: string[]) {
  return computeMaintenanceStatus(record(type), 40000, undefined, NOW, undefined, undefined, knownIssues);
}

describe("computeMaintenanceStatus — warning-light tile escalation is vocabulary-agnostic", () => {
  it("escalates the BRAKE tile for the symptom code 'brake_warning' (not just 'abs')", () => {
    expect(statusFor("brakes", []).status).toBe("on_time"); // benign without a light
    const escalated = statusFor("brakes", ["brake_warning"]);
    expect(ESCALATED).toContain(escalated.status);
    expect(escalated.description).toContain("ABS / brake");
  });

  it("still escalates the BRAKE tile for the canonical 'abs'", () => {
    expect(ESCALATED).toContain(statusFor("brakes", ["abs"]).status);
  });

  it("escalates the BATTERY tile for the symptom code 'battery' (not just 'battery_charging')", () => {
    const escalated = statusFor("battery", ["battery"]);
    expect(ESCALATED).toContain(escalated.status);
  });

  it("escalates the TIRE tile for the check-in code 'TPMS' (not just 'tpms')", () => {
    expect(statusFor("tires", []).status).toBe("on_time");
    const escalated = statusFor("tires", ["TPMS"]);
    expect(ESCALATED).toContain(escalated.status);
    expect(escalated.description).toContain("TPMS");
  });

  it("escalates the OIL tile for 'oil_pressure' even appended after a stale no_all_clear", () => {
    expect(statusFor("oil", []).status).toBe("on_time");
    const escalated = statusFor("oil", ["no_all_clear", "oil_pressure"]);
    expect(ESCALATED).toContain(escalated.status);
    expect(escalated.description).toContain("Oil pressure");
  });
});
