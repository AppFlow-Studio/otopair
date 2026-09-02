import { describe, it, expect } from "vitest";
import { computeVehicleHealthScore } from "@/utils/healthScore";

const core = (id: string, status: any) => ({
  id: `user-${id}`, serviceName: id, description: "", detail: "", status,
});
const base: any[] = [
  core("oil", "on_time"), core("brakes", "on_time"), core("tires", "on_time"),
  core("battery", "on_time"), core("inspection", "on_time"),
];
const score = (items: any[]) =>
  computeVehicleHealthScore({ maintenanceItems: items, odometerMiles: 145_000, knownIssues: [] } as any);

// Daniel, 2026-08-26: "there are services marked as Overdue and deducting
// points when they're not supposed to. They should only deduct points if the
// mechanic flagged them in their inspection. No more timer or mileage based
// score calculations for those parts."
//
// maintenance_records.type is an unconstrained v.string() and the core builder
// casts whatever it finds to MaintenanceType, so records outside the five-tile
// union were scoring on interval. Live data on this deployment carries
// `fluids` and `diagnostics` rows, so this was reachable, not theoretical.
describe("only core tiles and mechanic-graded minors deduct on interval", () => {
  it("baseline: five core tiles all on time", () => {
    expect(score(base)).toBe(100);
  });
  it("a 'fluids' record overdue on interval does not deduct", () => {
    expect(score([...base, core("fluids", "overdue")])).toBe(100);
  });

  it("a 'diagnostics' record overdue on interval does not deduct", () => {
    expect(score([...base, core("diagnostics", "overdue")])).toBe(100);
  });

  it("a 'transmission_service' record overdue on interval does not deduct", () => {
    // Worst case before the fix: CATEGORY_WEIGHTS gives this one 18, so it
    // cost 13 points off a perfect score with no mechanic involved.
    expect(score([...base, core("transmission_service", "overdue")])).toBe(100);
  });

  it("a mechanic-graded minor item STILL deducts", () => {
    // The Consolidated model has to survive: `minor_` types only exist on
    // records a mechanic graded yellow or red.
    expect(score([...base, core("minor_trans", "overdue")])).toBeLessThan(100);
  });

  it("the consolidated warning-light card still scores", () => {
    const withWarning = [...base, {
      id: "warning-active-abc", serviceName: "Warning lights",
      description: "", detail: "", status: "overdue" as const,
    }];
    expect(score(withWarning)).toBeLessThan(100);
  });
});
