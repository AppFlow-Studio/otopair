/**
 * services.ts - Service Catalog Management
 * 
 * DESCRIPTION:
 * Manages the master catalog of services offered on the platform.
 * Examples: Oil Change, Tire Rotation, Brake Inspection, Transmission Fluid Flush
 * Services are organized into categories and may have options/variations.
 * 
 * TABLE: services
 *   - Master list of all services
 *   - Belongs to a service_category
 *   - Can have multiple options (variations)
 *   - Has associated cost/time estimates
 *   - Referenced by bookings, shops, and specs
 * 
 * KEY RELATIONSHIPS:
 *   - Belongs-to: service_category (via service_category_id)
 *   - Has-many: bookings (via service_id)
 *   - Has-many: service_options (via service_id)
 *   - Has-many: shop_services (via service_id)
 *   - Has-many: service_insights (via service_id)
 *   - Has-many: service_vehicle_specs (via service_id)
 * 
 * USE CASES:
 *   1. Display available services to users
 *   2. Show service details and pricing estimates
 *   3. Filter by category
 *   4. Get cost/time estimates for booking
 *   5. Track service offerings at shops
 * 
 * OWNER: Service Catalog Team
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * QUERY: list
 * Returns all services with related category data.
 * Ordered by category and display order.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db.query("services").collect();
    return await Promise.all(
      services.map(async (service) => {
        const serviceCategory = await ctx.db.get(service.service_category_id);
        return { ...service, serviceCategory };
      })
    );
  },
});

/**
 * QUERY: getById
 * Fetch a specific service by ID with category info.
 * 
 * ARGS:
 *   - id: Service ID
 * 
 * RETURNS:
 *   {
 *     _id: service id,
 *     name: string (e.g., "Oil Change"),
 *     description: string,
 *     slug: string,
 *     service_category_id: id,
 *     default_labor_hours: number,
 *     is_labor_only: boolean,
 *     has_options: boolean,
 *     display_order: number,
 *     serviceCategory: { icon_name, name, ... }
 *   }
 */
export const getById = query({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.id);
    if (!service) {
      return null;
    }
    const serviceCategory = await ctx.db.get(service.service_category_id);
    return { ...service, serviceCategory };
  },
});
