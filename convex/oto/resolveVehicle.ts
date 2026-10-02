// =============================================================================
// Oto AI — VIN-or-id vehicle resolution (B-P3, Jun-10)
// =============================================================================
//
// The vehicle-scoped read tools (get_vehicle_health, get_due_services,
// get_vehicle_facts, list_services_for_vehicle) historically resolved their
// `vehicle_id` arg with ctx.db.get(arg as Id<"vehicles">). But the tool
// DESCRIPTIONS disagree — some tell Haiku to pass a VIN, others a Convex
// vehicles._id — and Haiku passes whichever the description says. A VIN is
// not a valid Convex id, so ctx.db.get threw; for list_services_for_vehicle
// that throw was caught and the handler SILENTLY FELL OPEN to the full
// unfiltered catalog (offering services that don't apply to the car —
// undoing the Schema-Gap-4 applicability work).
//
// Rather than churn the volatile tool-description prompt (cache bump +
// schema review), resolve defensively here: accept BOTH forms. A 17-char
// VIN-shaped string is looked up on `vehicles.by_vin`; anything else is
// treated as a Convex id. Convex ids are ~32 base32 chars and never collide
// with the strict 17-char VIN charset, so the discrimination is unambiguous.
// =============================================================================

import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

// A VIN is exactly 17 chars from the VIN alphabet (no I, O, or Q). Convex
// document ids are longer base32 strings, so a match here is unambiguously a
// VIN, never an id.
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;

export function isVinShaped(value: string): boolean {
  return VIN_RE.test(value);
}

/**
 * Resolve a vehicle from either a VIN or a Convex vehicles._id. Returns null
 * when no vehicle matches (callers decide whether that degrades open or
 * errors). Never throws on a malformed id.
 */
export async function resolveVehicleByIdOrVin(
  ctx: QueryCtx,
  idOrVin: string,
): Promise<Doc<"vehicles"> | null> {
  if (!idOrVin) return null;
  if (isVinShaped(idOrVin)) {
    return await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", idOrVin))
      .first();
  }
  try {
    return await ctx.db.get(idOrVin as Id<"vehicles">);
  } catch {
    return null; // not a valid Convex id and not VIN-shaped
  }
}

/**
 * The vehicle_configs id to scope a retrieve_vehicle_facts lookup to. The
 * prompt has Oto pass `vehicle_config_id` for "my car" questions, but the only
 * id Oto sees is the <vehicle> block's `id`, a vehicles id, so every scoped
 * lookup failed validation and the KB never answered (26 of 30 calls in the
 * 2026-10-01 runs). Takes a vehicle_configs id, a vehicles id or a VIN; null
 * for anything else.
 */
export const vehicleConfigIdFor = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, { id }): Promise<Id<"vehicle_configs"> | null> => {
    const configId = ctx.db.normalizeId("vehicle_configs", id);
    if (configId) return configId;
    const vehicleId = ctx.db.normalizeId("vehicles", id);
    const vehicle = vehicleId
      ? await ctx.db.get(vehicleId)
      : isVinShaped(id)
        ? await resolveVehicleByIdOrVin(ctx, id)
        : null;
    return vehicle?.vehicle_config_id ?? null;
  },
});
