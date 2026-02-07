/**
 * shops.ts - Service Shop Management
 * 
 * DESCRIPTION:
 * Manages automotive service shops/repair facilities on the platform.
 * Core business entity representing service providers.
 * Shops offer services, employ mechanics, and accept bookings.
 * 
 * TABLE: shops
 *   - Stores shop profiles and location data
 *   - Contains ratings, reviews, and verification status
 *   - Has operating hours (shops_hours)
 *   - Lists services offered (shop_services)
 *   - Employs multiple mechanics
 *   - Accepts bookings and manages time slots
 * 
 * KEY RELATIONSHIPS:
 *   - Has-many: mechanics (via shop_id)
 *   - Has-many: bookings (via shop_id)
 *   - Has-many: time_slots (via shop_id)
 *   - Has-many: shops_hours (via shop_id)
 *   - Has-many: shop_services (via shop_id)
 *   - Has-many: reviews (via shop_id)
 *   - Has-many: payments (via shop_id)
 * 
 * USE CASES:
 *   1. Search/filter shops by location
 *   2. Display shop details and ratings
 *   3. Show available services at shop
 *   4. View shop hours and availability
 *   5. Make bookings at shop
 * 
 * OWNER: Shop Management Team
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * QUERY: list
 * Returns all shops in the system.
 * Use with caution - consider filtering by location in production.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("shops").collect();
  },
});

/**
 * QUERY: getById
 * Fetch a specific shop by ID.
 * 
 * ARGS:
 *   - id: Shop ID
 * 
 * RETURNS:
 *   {
 *     _id: shop id,
 *     name: string,
 *     slug: string,
 *     address: string,
 *     city: string,
 *     state: string,
 *     zip: string,
 *     lat: number,
 *     lng: number,
 *     phone: string,
 *     labor_rate: number,
 *     rating: number (0-5),
 *     review_count: number,
 *     is_active: boolean,
 *     is_verified: boolean
 *   }
 */
export const getById = query({
  args: { id: v.id("shops") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
