/**
 * user_vehicles.ts - DEPRECATED
 * 
 * This table has been replaced by the new vehicle model:
 * - vehicles (canonical VIN catalog)
 * - vehicle_owners (soft-delete join table)
 * 
 * DO NOT USE THIS FILE FOR NEW CODE.
 * Use vehicles.ts and vehicle_owners.ts instead.
 * 
 * This file is kept temporarily for backward compatibility only.
 * It will be removed after full migration is complete.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("user_vehicles").collect();
  },
});

export const getById = query({
  args: { id: v.id("user_vehicles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("user_vehicles")
      .filter((q) => q.eq(q.field("user_id"), args.userId))
      .collect();
  },
});
