import { describe, it, expect } from "vitest";
import {
  buildMergedMaintenanceItems,
  lastShopScanAt,
  scanRecentlyDone,
  RECENT_SCAN_WINDOW_MS,
} from "@/utils/mergedMaintenance";
import { buildMaintenanceItems } from "@/utils/maintenanceEnrichment";
import { explainMaintenanceItem } from "@/utils/maintenanceExplanation";
import type { MaintenanceItem } from "@/components/cars/MaintenanceTracker";

// Bug #428 (merged #206 #340 #413): the Maintenance Tracker must understand a
// job the shop just completed. These pin what the tracker READS from the rows
// booking completion writes (convex/bookings.ts runCompletionSideEffects).
const NOW = 1_790_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const ODO = 61_000;

function merge(records: any[], extra: Partial<Parameters<typeof buildMergedMaintenanceItems>[0]> = {}) {
  const userItems = buildMaintenanceItems(
    records.map((r) => ({
      type: r.type,
      lastServiceDate: r.lastServiceDate,
      lastServiceMileage: r.lastServiceMileage,
      customInputs: r.customInputs,
      confirmedHealthyAt: r.confirmedHealthyAt,
    })),
    ODO,
  );
  return buildMergedMaintenanceItems({
    userItems,
    records,
    scopeId: "owner_1",
    now: NOW,
    currentOdometer: ODO,
    oemIntervals: undefined,
    classCtx: undefined,
    serviceSlugById: undefined,
    ...extra,
  });
}

/** Exactly what completion writes for a service done on booking `bk_1`. */
const stamped = (type: string, extra: Record<string, unknown> = {}) => ({
  type,
  lastServiceDate: NOW - 2 * 60 * 60 * 1000,
  lastServiceMileage: ODO,
  lastServiceBookingId: "bk_1",
  lastServiceShopName: "Damis",
  ...extra,
});

describe("#413 — a tire rotation is not new tires", () => {
  it("the Tires card keeps measuring tread life and shows the rotation as logged", () => {
    const items = merge([stamped("service_tire_rotation")]);
    const tires = items.find((i) => i.id.endsWith("-tires"))!;
    // No tread-life record → not on file. Never "50,000 mi remaining".
    expect(tires.status).toBe("unknown");
    expect(tires.description).not.toMatch(/remaining/);
    // …but the visit's rotation is visible on it, under its own name.
    expect(tires.resolvedByBookingId).toBe("bk_1");
    expect(tires.resolvedServiceLabel).toBe("Tire rotation");
    expect(tires.resolvedRecordType).toBe("service_tire_rotation");
  });

  it("a real replacement still resets tread life", () => {
    const items = merge([stamped("tires")]);
    const tires = items.find((i) => i.id === "user-tires")!;
    expect(tires.status).toBe("on_time");
    expect(tires.resolvedServiceLabel).toBeUndefined();
  });

  it("once the driver has seen it, the rotation card folds away", () => {
    const items = merge([stamped("service_tire_rotation", { resolutionAckedAt: NOW })]);
    const tires = items.find((i) => i.id.endsWith("-tires"))!;
    expect(tires.resolvedByBookingId).toBeUndefined();
  });
});

describe("#340 — a scan done this visit leaves RECOMMENDED", () => {
  it("a mid-job Diagnostic Scan resolves as its own card", () => {
    const items = merge([stamped("diagnostics")]);
    const scan = items.find((i) => i.id === "user-diagnostics")!;
    expect(scan).toBeDefined();
    expect(scan.resolvedByBookingId).toBe("bk_1");
    expect(scan.resolvedShopName).toBe("Damis");
    expect(scan.excludeFromScore).toBe(true);
  });

  it("the card is gone once tapped — no permanent scan row", () => {
    const items = merge([stamped("diagnostics", { resolutionAckedAt: NOW })]);
    expect(items.find((i) => i.id === "user-diagnostics")).toBeUndefined();
  });

  it("a recent shop scan retires the 'book a diagnostic scan' recommendation for 90 days", () => {
    const at = lastShopScanAt([stamped("diagnostics")] as any);
    expect(at).toBe(NOW - 2 * 60 * 60 * 1000);
    expect(scanRecentlyDone(at, NOW)).toBe(true);
    expect(scanRecentlyDone(at, at! + RECENT_SCAN_WINDOW_MS + 1)).toBe(false);
    expect(scanRecentlyDone(lastShopScanAt([]), NOW)).toBe(false);
  });
});

describe("#206 — a service just performed is not still recommended", () => {
  it("spark plugs done this visit close out their catalog row", () => {
    const oemIntervals = { spark_plugs: { interval_miles: 60_000, confidence: 0.9 } } as any;
    const before = merge([], { oemIntervals });
    expect(before.find((i) => i.id === "catalog-spark_plugs")?.status).not.toBe("on_time");

    const after = merge([stamped("service_spark_plugs")], { oemIntervals });
    const plugs = after.find((i) => i.id === "catalog-spark_plugs")!;
    expect(plugs.status).toBe("on_time");
    expect(plugs.resolvedByBookingId).toBe("bk_1");
    expect(plugs.resolvedRecordType).toBe("service_spark_plugs");
    // Measured FROM the service, not the odometer.
    expect(plugs.signals?.mileage).toBe("0 mi since last service");
  });
});

describe("#428 — 'why it's due' copy never contradicts a fresh service", () => {
  const anchored = (over: Partial<MaintenanceItem>): MaintenanceItem => ({
    id: "user-brakes",
    serviceName: "Brakes",
    description: "",
    detail: "",
    status: "on_time",
    triggeredBy: "both",
    signals: { time: "0 mo since last service", mileage: "0 mi since last service" },
    lastServiceAt: NOW - DAY,
    ...over,
  });

  it("a brake job done today reads as just done", () => {
    const { fact } = explainMaintenanceItem(anchored({}), "Camry", NOW);
    expect(fact).toBe("You had brakes done recently — nothing to do until the next one.");
  });

  it("never says 'getting close' for 0 months and 0 mi, whatever raised the status", () => {
    const flagged = explainMaintenanceItem(
      anchored({
        status: "due_soon",
        mechanicProvenance: { shopName: "Damis", mechanicName: "Ray" },
      }),
      "Camry",
      NOW,
    ).fact;
    expect(flagged).not.toMatch(/getting close|0 months/);
    expect(flagged).toBe("You had brakes done recently, and Ray at Damis flagged it for a follow-up.");

    const reported = explainMaintenanceItem(
      anchored({ status: "needs_attention", description: "Squeaking/grinding reported" }),
      "Camry",
      NOW,
    ).fact;
    expect(reported).not.toMatch(/getting close|0 months/);
  });

  it("names only the axis that explains the status ('45 months and 38 mi' was noise)", () => {
    const { fact } = explainMaintenanceItem(
      anchored({
        id: "user-tires",
        serviceName: "Tires",
        status: "due_soon",
        signals: {
          time: "45 mo since last service",
          mileage: "38 mi since last service",
          interval: "60 mo / 50,000 mi",
        },
        lastServiceAt: NOW - 45 * 30 * DAY,
      }),
      "Camry",
      NOW,
    );
    expect(fact).toBe("It's been about 45 months since your last tires — getting close to when it's due again.");
  });

  it("an item with nothing on file never claims to look fine", () => {
    const { fact } = explainMaintenanceItem(
      { id: "unknown-tires", serviceName: "Tires", description: "", detail: "", status: "unknown" },
      "Camry",
      NOW,
    );
    expect(fact).not.toMatch(/looks fine/);
    expect(fact).toMatch(/don't have a record of your last tires/);
  });

  it("keeps both axes when they agree", () => {
    const { fact } = explainMaintenanceItem(
      anchored({
        id: "user-oil",
        serviceName: "Oil Change",
        status: "due_soon",
        signals: {
          time: "5 mo since last service",
          mileage: "4,500 mi since last service",
          interval: "6 mo / 5,000 mi",
        },
        lastServiceAt: NOW - 150 * DAY,
      }),
      "Camry",
      NOW,
    );
    expect(fact).toMatch(/5 months and 4,500 mi ago — you're getting close/);
  });
});
