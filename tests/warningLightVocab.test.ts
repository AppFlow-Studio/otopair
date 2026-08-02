import { describe, it, expect } from "vitest";
import {
  canonicalWarningLights,
  normalizeFaultLight,
  PAIRED_WARNING_LIGHTS,
} from "../lib/warningLightVocab";

// The bug this module fixes: `vehicle_owners.knownIssues` is written in two
// incompatible shapes across the codebase —
//   • legacy sentinel-prefixed  ["no_all_clear"] | ["other", ...lights]
//   • flat code-set (check-in + Oto) ["oil_pressure", "check_engine"]
// — and the symptom-code vocabulary (brake_warning / battery) diverges from the
// canonical light ids the client readers key on (abs / battery_charging).
// `canonicalWarningLights` is the single format- and vocabulary-agnostic reader.

describe("canonicalWarningLights", () => {
  it("reads a flat code-set (Oto / check-in shape)", () => {
    expect(canonicalWarningLights(["oil_pressure", "check_engine"])).toEqual([
      "oil_pressure",
      "check_engine",
    ]);
  });

  it("reads the legacy sentinel-prefixed shape", () => {
    expect(canonicalWarningLights(["other", "temperature"])).toEqual(["temperature"]);
    expect(canonicalWarningLights(["no_all_clear"])).toEqual([]);
    expect(canonicalWarningLights(["check_engine"])).toEqual(["check_engine"]);
    expect(canonicalWarningLights(["not_sure"])).toEqual(["not_sure_which"]);
  });

  it("recovers a light appended after a stale no_all_clear sentinel (the Oto corruption)", () => {
    // applyVehicleTruth raw-appended onto ["no_all_clear"] → this exact array.
    expect(canonicalWarningLights(["no_all_clear", "oil_pressure"])).toEqual([
      "oil_pressure",
    ]);
  });

  it("maps the pipeline symptom-code vocabulary to canonical light ids", () => {
    expect(canonicalWarningLights(["brake_warning"])).toEqual(["abs"]);
    expect(canonicalWarningLights(["battery"])).toEqual(["battery_charging"]);
    expect(canonicalWarningLights(["battery_no_start"])).toEqual(["battery_charging"]);
    expect(canonicalWarningLights(["tire_issue"])).toEqual(["tpms"]);
    expect(canonicalWarningLights(["TPMS"])).toEqual(["tpms"]);
  });

  it("ignores non-light symptom codes and bare sentinels", () => {
    expect(
      canonicalWarningLights(["soft_slow", "alignment", "different_light"]),
    ).toEqual([]);
  });

  it("dedupes when an alias and its canonical id both appear", () => {
    expect(canonicalWarningLights(["brake_warning", "abs"])).toEqual(["abs"]);
  });

  it("returns [] for empty / undefined", () => {
    expect(canonicalWarningLights(undefined)).toEqual([]);
    expect(canonicalWarningLights([])).toEqual([]);
  });
});

describe("normalizeFaultLight", () => {
  it("canonicalizes the wrong 'tire_pressure' id Oto is prone to emit", () => {
    // The render_vehicle_update tool schema example literally used "tire_pressure".
    expect(normalizeFaultLight("tire_pressure")).toBe("tpms");
  });

  it("passes a canonical id through unchanged", () => {
    expect(normalizeFaultLight("check_engine")).toBe("check_engine");
    expect(normalizeFaultLight("oil_pressure")).toBe("oil_pressure");
  });

  it("passes an unrecognized id through unchanged (never drops data)", () => {
    expect(normalizeFaultLight("gremlin_light")).toBe("gremlin_light");
  });
});

describe("PAIRED_WARNING_LIGHTS", () => {
  it("is exactly the four lights that escalate a maintenance tile", () => {
    expect([...PAIRED_WARNING_LIGHTS].sort()).toEqual(
      ["abs", "battery_charging", "oil_pressure", "tpms"].sort(),
    );
  });
});
