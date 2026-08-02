import { describe, it, expect } from "vitest";
import { executeTool } from "../convex/oto/dispatcher";

// Anthropic tool schemas are advisory — Haiku can emit a malformed `mileage: ""`
// on render_vehicle_update even though tools.ts declares it type:"number". The
// dispatcher is the earliest shared server choke point; it must drop non-finite
// numeric args so "" never reaches the render envelope, the card (blank
// "Update odometer to  mi"), or the Convex v.optional(v.number()) validator
// (which throws → "Couldn't save that. Tap to retry.").
async function renderVehicleUpdate(input: Record<string, unknown>) {
  const res = await executeTool(
    { type: "tool_use", id: "t1", name: "render_vehicle_update", input },
    {},
  );
  return JSON.parse(res.content) as {
    status: string;
    data: { type: string; field: string; value: any };
  };
}

describe("dispatcher render_vehicle_update — sanitizes malformed numeric args", () => {
  it("drops an empty-string mileage instead of forwarding it", async () => {
    const env = await renderVehicleUpdate({ mileage: "" });
    expect(env.status).toBe("ok");
    expect(env.data.value).not.toHaveProperty("mileage");
  });

  it("drops a NaN mileage", async () => {
    const env = await renderVehicleUpdate({ mileage: NaN });
    expect(env.data.value).not.toHaveProperty("mileage");
  });

  it("emits an EMPTY value when every field is malformed (so the card is suppressed, not dead)", async () => {
    const env = await renderVehicleUpdate({ mileage: "", fault_lights: [123], service_claims: [{ service_slug: 5, kind: "due" }] });
    expect(Object.keys(env.data.value)).toHaveLength(0);
  });

  it("keeps a valid numeric mileage", async () => {
    const env = await renderVehicleUpdate({ mileage: 90000 });
    expect(env.data.value.mileage).toBe(90000);
  });

  it("drops an empty-string service_mileage inside a claim but keeps the claim", async () => {
    const env = await renderVehicleUpdate({
      service_claims: [{ service_slug: "oil_change", kind: "completed", service_mileage: "" }],
    });
    expect(env.data.value.service_claims).toHaveLength(1);
    expect(env.data.value.service_claims[0]).not.toHaveProperty("service_mileage");
    expect(env.data.value.service_claims[0].service_slug).toBe("oil_change");
    expect(env.data.value.service_claims[0].kind).toBe("completed");
  });

  it("drops a claim with a non-string slug or bad kind", async () => {
    const env = await renderVehicleUpdate({
      service_claims: [
        { service_slug: "oil_change", kind: "due" },
        { service_slug: 123, kind: "due" },
        { service_slug: "brake_pad_replacement", kind: "bogus" },
      ],
    });
    expect(env.data.value.service_claims).toHaveLength(1);
    expect(env.data.value.service_claims[0].service_slug).toBe("oil_change");
  });

  it("keeps string fault_lights, drops non-strings", async () => {
    const env = await renderVehicleUpdate({ fault_lights: ["check_engine", 123] });
    expect(env.data.value.fault_lights).toEqual(["check_engine"]);
  });
});
