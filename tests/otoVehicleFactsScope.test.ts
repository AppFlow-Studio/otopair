/**
 * retrieve_vehicle_facts threw on 26 of 30 calls in the 2026-10-01 runs: Oto
 * passed the <vehicle> block's `id` (a vehicles id, the only id it sees) as
 * `vehicle_config_id`, under a camelCase arg the EvalTest check didn't accept,
 * so the KB never answered a "my car" question.
 */
import { describe, expect, it } from "vitest";
import { makeT } from "./helpers";
import { internal } from "../convex/_generated/api";

const VIN = "WBSJF0C03LCD42488";

async function seed(t: ReturnType<typeof makeT>) {
  return await t.run(async (ctx: any) => {
    const makeId = await ctx.db.insert("makes", { name: "BMW" } as any);
    const modelId = await ctx.db.insert("models", { name: "M5", make_id: makeId } as any);
    const configId = await ctx.db.insert("vehicle_configs", {
      config_key: "2020_bmw_m5_competition_s63b44t4",
      year: 2020,
      make_id: makeId,
      model_id: modelId,
    } as any);
    const vehicleId = await ctx.db.insert("vehicles", { vin: VIN, vehicle_config_id: configId } as any);
    const unlinkedId = await ctx.db.insert("vehicles", { vin: "1FMSK8FH4MGA53887" } as any);
    return { configId, vehicleId, unlinkedId };
  });
}

describe("scoping a KB lookup to the user's car", () => {
  it("takes the car's id from the <vehicle> block, its VIN, or a config id", async () => {
    const t = makeT();
    const { configId, vehicleId } = await seed(t);
    const scope = (id: string) => t.query(internal.oto.resolveVehicle.vehicleConfigIdFor, { id });
    expect(await scope(vehicleId)).toBe(configId);
    expect(await scope(VIN)).toBe(configId);
    expect(await scope(configId)).toBe(configId);
  });

  it("drops the scope instead of throwing on anything else", async () => {
    const t = makeT();
    const { unlinkedId } = await seed(t);
    const scope = (id: string) => t.query(internal.oto.resolveVehicle.vehicleConfigIdFor, { id });
    expect(await scope(unlinkedId)).toBeNull();
    expect(await scope("2020 BMW M5")).toBeNull();
    expect(await scope("")).toBeNull();
  });

  it("feeds the EvalTest check the arg it validates", async () => {
    const t = makeT();
    const { configId } = await seed(t);
    expect(await t.query(internal.oto.evalTestFilter.isEvalTestConfigId, { vehicle_config_id: configId })).toBe(false);
  });
});
