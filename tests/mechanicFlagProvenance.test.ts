import { describe, it, expect } from "vitest";
import { buildMaintenanceItems } from "@/utils/maintenanceEnrichment";

const rec = (customInputs: any) => ({
  type: "brakes",
  lastServiceDate: "2026-01-01",
  lastServiceMileage: 40000,
  customInputs,
});

describe("§09 B5 — mechanic flag provenance", () => {
  it("carries shop + date for a red grade", () => {
    const m = buildMaintenanceItems(
      [rec({ mechanicGrade: "r", mechanicGradeSource: "Chelala Service Center", mechanicGradedAt: 1_752_000_000_000 })] as any,
      50000,
    );
    expect(m.get("brakes" as any)?.mechanicFlag).toEqual({
      shopName: "Chelala Service Center",
      gradedAt: 1_752_000_000_000,
    });
  });

  it("stays silent on a green grade — green is inert", () => {
    const m = buildMaintenanceItems(
      [rec({ mechanicGrade: "g", mechanicGradeSource: "Chelala Service Center", mechanicGradedAt: 1 })] as any,
      50000,
    );
    expect(m.get("brakes" as any)?.mechanicFlag).toBeUndefined();
  });

  it("stays silent when there is no grade at all", () => {
    const m = buildMaintenanceItems([rec({})] as any, 50000);
    expect(m.get("brakes" as any)?.mechanicFlag).toBeUndefined();
  });
});
