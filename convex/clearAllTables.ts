/**
 * ONE-SHOT dev cleanup — wipes all documents from every table.
 * Run once after schema merge to clear old data before re-importing from backup.
 * DELETE THIS FILE after running.
 *
 * Usage:
 *   npx convex run clearAllTables:run
 */

import { internalMutation } from "./_generated/server";

const TABLES = [
  "users",
  "vehicles",
  "vehicle_owners",
  "vehicle_configs",
  "vehicle_tiers",
  "vehicle_health_snapshots",
  "vehicle_driving_profiles",
  "vehicle_service_states",
  "vehicle_checkins",
  "vehicle_classifications",
  "makes",
  "models",
  "generations",
  "trims",
  "engines",
  "transmissions",
  "chassis_variants",
  "drivetrain_configs",
  "trim_specs",
  "oem_parts",
  "part_fitments",
  "part_prices",
  "enrichment_evidence",
  "enrichment_runs",
  "enriched_engine_configs",
  "scrape_cache",
  "scrape_jobs",
  "source_registry",
  "spec_confirmations",
  "spec_variances",
  "vin_queue",
  "blocked_domains",
  "mechanic_verifications",
  "mechanics",
  "shops",
  "shops_hours",
  "shop_services",
  "shop_portfolio",
  "shop_users",
  "shop_invitations",
  "bookings",
  "booking_status_history",
  "payments",
  "payment_status_history",
  "time_slots",
  "services",
  "service_categories",
  "service_options",
  "service_intervals",
  "service_vehicle_specs",
  "labor_times",
  "block_time_types",
  "composite_modifier_weights",
  "job_actuals",
  "reviews",
  "maintenance_records",
  "odometer_history",
  "smartcar_connections",
  "ai_conversations",
  "ai_messages",
  "follow_ups",
  "analytics_events",
  "conversion_funnels",
  "client_logs",
  "cdn_assets",
  "transactions",
  "rewards",
  "reward_deals",
  "user_reward_wallets",
  "ownership_credit_transactions",
  "user_contribution_claims",
  "user_mechanic_preferences",
  "user_settings_preferences",
  "onboarding_questions_answers",
] as const;

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const results: Record<string, number> = {};

    for (const table of TABLES) {
      try {
        const docs = await (ctx.db as any).query(table).collect();
        for (const doc of docs) {
          await ctx.db.delete(doc._id);
        }
        results[table] = docs.length;
      } catch {
        results[table] = -1; // table doesn't exist or already empty
      }
    }

    const cleared = Object.entries(results).filter(([, n]) => n > 0);
    console.log(
      "[clearAllTables] Done. Cleared:",
      cleared.map(([t, n]) => `${t}(${n})`).join(", ") || "nothing"
    );
    return results;
  },
});
