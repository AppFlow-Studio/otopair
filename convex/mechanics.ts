/**
 * mechanics.ts - Mechanic/Technician Management
 *
 * DESCRIPTION:
 * Manages mechanic/technician staff at service shops.
 * Tracks individual mechanics and their qualifications, ratings, and availability.
 *
 * TABLE: mechanics
 *   - Stores mechanic profiles and performance data
 *   - Belongs to one shop (shop_id)
 *   - Can be assigned to time slots and bookings
 *   - Has aggregated ratings from customer reviews
 *
 * KEY RELATIONSHIPS:
 *   - Belongs-to: shop (via shop_id)
 *   - Has-many: bookings (via mechanic_id)
 *   - Has-many: job_actuals (via mechanic_id)
 *   - Has-many: time_slots (via mechanic_id)
 *   - Has-many: reviews (via mechanic_id)
 *
 * USE CASES:
 *   1. Display available mechanics at a shop
 *   2. Show mechanic ratings and reviews
 *   3. Assign mechanics to bookings
 *   4. Filter by active/inactive status
 *   5. Track mechanic performance metrics
 *
 * OWNER: Shop Management Team
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * QUERY: list
 * Returns all mechanics with related shop data.
 * Use with caution - consider filtering by shop in production.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const mechanics = await ctx.db.query("mechanics").collect();
    return await Promise.all(
      mechanics.map(async (mechanic) => {
        const shop = await ctx.db.get(mechanic.shop_id);
        const photoUrl = mechanic.photo ? (await ctx.db.get(mechanic.photo))?.url : undefined;
        return { ...mechanic, shop, photoUrl };
      }),
    );
  },
});

/**
 * QUERY: getById
 * Fetch a specific mechanic by ID with shop info.
 *
 * ARGS:
 *   - id: Mechanic ID
 *
 * RETURNS:
 *   {
 *     _id: mechanic id,
 *     first_name: string,
 *     last_name: string,
 *     shop_id: id,
 *     is_active: boolean,
 *     rating: number (0-5),
 *     review_count: number,
 *     shop: { name, address, ... }
 *   }
 */
export const getById = query({
  args: { id: v.id("mechanics") },
  handler: async (ctx, args) => {
    const mechanic = await ctx.db.get(args.id);
    if (!mechanic) {
      return null;
    }
    const shop = await ctx.db.get(mechanic.shop_id);
    const photoUrl = mechanic.photo ? (await ctx.db.get(mechanic.photo))?.url : undefined;
    return { ...mechanic, shop, photoUrl };
  },
});

/**
 * QUERY: getByShopId
 * Get all active mechanics at a specific shop.
 * Returns only active mechanics (is_active=true).
 *
 * ARGS:
 *   - shopId: Shop ID
 *
 * RETURNS: Array of active mechanics at shop
 *
 * EXAMPLE:
 *   Get mechanics available for booking at shop
 */
export const getByShopId = query({
  args: { shopId: v.id("shops") },
  handler: async (ctx, args) => {
    const mechanics = await ctx.db
      .query("mechanics")
      .filter((q) => q.and(q.eq(q.field("shop_id"), args.shopId), q.eq(q.field("is_active"), true)))
      .collect();
    return await Promise.all(
      mechanics.map(async (mechanic) => {
        const photoUrl = mechanic.photo ? (await ctx.db.get(mechanic.photo))?.url : undefined;
        return { ...mechanic, photoUrl };
      }),
    );
  },
});
