/**
 * An advisory is never booked through Otopair.
 *
 * When a mechanic recommends work Otopair does not sell, the recommendation
 * carries no service_id (jobRecommendations.isAdvisory). Product call, Ahmad +
 * colleague 2026-08-30: we do not try to sell it, book it, or route it into
 * the service picker. The driver gets it done wherever they like and tells us
 * afterwards; then — and only then — we ask for the receipt.
 *
 * Before this, an advisory's CTA read "View suggestion" and opened a read-only
 * screen, so there was no way to close the item at all. Pressing Book Service
 * on one would have dumped the user on an empty service picker, which is the
 * dead end this replaces.
 *
 * Source assertions: the behaviour lives in a React Native component that the
 * test runner cannot import (RN ships Flow), so these pin the wiring that is
 * easy to break silently — a renamed callback or a lost prop fails no types
 * when every prop is optional.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

const TRACKER = code("components/cars/MaintenanceTracker.tsx");
const CARS = code("app/(main-tabs)/cars/index.tsx");

describe("advisory close-out", () => {
  it("an advisory's CTA marks it done, it does not book", () => {
    expect(TRACKER).toContain('? "Mark as Done"');
    expect(TRACKER).toMatch(/if \(isAdvisory\) onMarkDone\?\.\(item\);\s*\n\s*else onBookNow/);
  });

  it("no advisory path reaches the booking flow", () => {
    // The old label promised a screen, not a booking; the new one must not
    // quietly regain a Book Service branch.
    expect(TRACKER).not.toContain('"View suggestion"');
  });

  it("the callback is threaded from the screen to every card", () => {
    expect(TRACKER).toContain("onMarkDone={onMarkDone}");
    // UrgentCard renders in NOW, SOON and both legacy tiers.
    expect(TRACKER.split("onMarkDone={onMarkDone}").length - 1).toBeGreaterThanOrEqual(3);
    expect(CARS).toContain("onMarkDone={(item) => {");
  });

  it("closing an advisory uses reason 'fixed', not a silent hide", () => {
    // "hidden_by_driver" deliberately keeps the follow-up alive so reminders
    // still fire, and skips the rec-penalty recompute. Work that is actually
    // done must do both, so the reason matters.
    expect(CARS).toContain("dismissRecFromDriver({");
    expect(CARS).toMatch(/reason:\s*"fixed"/);
    expect(CARS).not.toMatch(/reason:\s*"hidden_by_driver"/);
  });

  it("asks for the receipt after closing, never as a precondition", () => {
    const markDone = CARS.slice(CARS.indexOf("onMarkDone={(item) => {"));
    const dismissAt = markDone.indexOf("dismissRecFromDriver({");
    const uploadAt = markDone.indexOf("pickServiceRecord");
    expect(dismissAt).toBeGreaterThan(-1);
    expect(uploadAt).toBeGreaterThan(dismissAt);
    // A driver with no paperwork must still be able to close the item.
    expect(markDone).toContain('text: "Not now"');
  });

  it("upload runs through the shared hook, not a second copy", () => {
    expect(CARS).toContain("useServiceRecordUpload");
    expect(code("components/cars/VehicleServiceHistory.tsx")).toContain("useServiceRecordUpload");
    // The picker sequence should exist in exactly one place now.
    expect(code("components/cars/VehicleServiceHistory.tsx")).not.toContain(
      "DocumentPicker.getDocumentAsync",
    );
  });
});
