/**
 * One physical finding, one card.
 *
 * A mechanic's eye-check can produce BOTH a graded maintenance record (the
 * "Coolant Condition" tile) and a job recommendation for the fix (the
 * "Coolant Flush" card). They are the same finding from the same inspection,
 * and the driver was seeing both stacked — "Coolant Flush · Suggested by
 * James Bond" directly above "Coolant Condition · Flagged by Chelala".
 *
 * The recommendation wins: it carries the mechanic's framing, a service id
 * that books reliably, and the dismiss / follow-up lifecycle. Scoring does
 * not move — recommendations are excluded from Upkeep precisely because the
 * matching tile scores them, and the tile still exists when uncovered.
 */
import { describe, expect, it } from "vitest";
import {
  MINOR_ITEM_RECORD_TYPES,
  buildMergedMaintenanceItems,
} from "@/utils/mergedMaintenance";
import { TAXONOMY } from "@/constants/serviceTaxonomy";

const NOW = new Date("2026-08-30T00:00:00Z").getTime();

const GRADED_COOLANT = {
  type: "minor_cool_condition",
  customInputs: {
    mechanicGrade: "y",
    mechanicGradeReason: "Coolant condition flagged on eye-check",
    mechanicGradeSource: "Chelala Service Center",
    mechanicGradedAt: NOW,
  },
};

function merge(opts: { recs?: any[]; resolver?: (id: string) => string | undefined }) {
  return buildMergedMaintenanceItems({
    userItems: new Map(),
    records: [GRADED_COOLANT],
    knownIssues: [],
    vehicleYear: 2020,
    driverRecommendations: opts.recs ?? [],
    scopeId: "vin",
    now: NOW,
    serviceSlugById: opts.resolver,
  } as any);
}

const COOLANT_REC = {
  _id: "rec1",
  service_id: "svc_coolant",
  service_name: "Coolant Flush",
  urgency: "soon",
  reason: "Coolant Flush flagged on eye-check (monitor)",
  shop_name: "Chelala Service Center",
  mechanic_name: "James Bond",
};

describe("minor tile vs. recommendation", () => {
  it("every minor type names a real taxonomy service as its remedy", () => {
    for (const { type, remedySlug } of MINOR_ITEM_RECORD_TYPES) {
      expect(TAXONOMY[remedySlug], `${type} → ${remedySlug}`).toBeTruthy();
    }
  });

  it("shows the tile when no recommendation covers it", () => {
    const items = merge({ recs: [], resolver: () => undefined });
    expect(items.some((i) => i.id === "user-minor_cool_condition")).toBe(true);
  });

  it("suppresses the tile when a recommendation covers the same remedy", () => {
    const items = merge({
      recs: [COOLANT_REC],
      resolver: (id) => (id === "svc_coolant" ? "coolant_flush" : undefined),
    });
    const tiles = items.filter((i) => i.id === "user-minor_cool_condition");
    const recs = items.filter((i) => i.sourceRecommendationId === "rec1");
    expect(tiles, "the eye-check tile should be suppressed").toHaveLength(0);
    expect(recs, "the recommendation card survives").toHaveLength(1);
  });

  it("keeps the tile when the recommendation is for something else", () => {
    const items = merge({
      recs: [{ ...COOLANT_REC, service_id: "svc_brakes" }],
      resolver: (id) => (id === "svc_brakes" ? "brake_pad_replacement" : undefined),
    });
    expect(items.some((i) => i.id === "user-minor_cool_condition")).toBe(true);
  });

  it("without a resolver, nothing is suppressed (Oto's server-side merge)", () => {
    const items = merge({ recs: [COOLANT_REC], resolver: undefined });
    expect(items.some((i) => i.id === "user-minor_cool_condition")).toBe(true);
  });

  it("a surviving tile carries the remedy slug so Book Service resolves", () => {
    const items = merge({ recs: [], resolver: () => undefined });
    const tile = items.find((i) => i.id === "user-minor_cool_condition");
    expect(tile?.serviceSlug).toBe("coolant_flush");
  });
});
