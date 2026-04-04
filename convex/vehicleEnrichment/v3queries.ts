/**
 * vehicleEnrichment/v3queries.ts — Read-only queries for the v3 pipeline.
 */

import { v } from "convex/values";
import { internalQuery, internalMutation } from "../_generated/server";

export const getVehicleConfigByKey = internalQuery({
  args: { configKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vehicle_configs")
      .withIndex("by_config_key", (q) => q.eq("config_key", args.configKey))
      .first();
  },
});

export const getMakeByName = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("makes")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

export const getModelByMakeAndName = internalQuery({
  args: { makeId: v.id("makes"), name: v.string() },
  handler: async (ctx, args) => {
    const models = await ctx.db
      .query("models")
      .withIndex("by_make_id", (q) => q.eq("make_id", args.makeId))
      .collect();
    return models.find((m) => m.name === args.name) ?? null;
  },
});

/** Creates a model record — used when pipeline encounters a new model. */
export const createModel = internalMutation({
  args: { make_id: v.id("makes"), name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("models", {
      make_id: args.make_id,
      name: args.name,
    });
  },
});

export const getVehicle = internalQuery({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.vehicleId);
  },
});

export const getEngine = internalQuery({
  args: { engineId: v.id("engines") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.engineId);
  },
});

export const getTransmission = internalQuery({
  args: { transmissionId: v.id("transmissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.transmissionId);
  },
});

export const getServiceBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("services")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getFitmentsByConfigAndService = internalQuery({
  args: {
    vehicleConfigId: v.id("vehicle_configs"),
    serviceType: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("part_fitments")
      .withIndex("by_config_service", (q) =>
        q
          .eq("vehicle_config_id", args.vehicleConfigId)
          .eq("service_type", args.serviceType)
      )
      .collect();
  },
});

/** Fuzzy dedup: find an existing config with the same engine + year + make. */
export const findSimilarConfig = internalQuery({
  args: {
    engine_id: v.id("engines"),
    year: v.float64(),
    make_id: v.id("makes"),
  },
  handler: async (ctx, args) => {
    const configs = await ctx.db
      .query("vehicle_configs")
      .withIndex("by_engine", (q) => q.eq("engine_id", args.engine_id))
      .collect();

    return configs.find((c) => c.year === args.year && c.make_id === args.make_id) ?? null;
  },
});

// ─── Fill rate queries ───────────────────────────────────────────

export const getVehicleConfigById = internalQuery({
  args: { vehicleConfigId: v.id("vehicle_configs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.vehicleConfigId);
  },
});

export const getDrivetrainConfig = internalQuery({
  args: { vehicleConfigId: v.id("vehicle_configs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("drivetrain_configs")
      .withIndex("by_vehicle_config", (q) => q.eq("vehicle_config_id", args.vehicleConfigId))
      .first();
  },
});

export const getTrimSpecs = internalQuery({
  args: { vehicleConfigId: v.id("vehicle_configs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trim_specs")
      .withIndex("by_vehicle_config", (q) => q.eq("vehicle_config_id", args.vehicleConfigId))
      .first();
  },
});

export const getPartFitments = internalQuery({
  args: { vehicleConfigId: v.id("vehicle_configs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("part_fitments")
      .withIndex("by_vehicle_config", (q) => q.eq("vehicle_config_id", args.vehicleConfigId))
      .collect();
  },
});

export const getServiceIntervals = internalQuery({
  args: { vehicleConfigId: v.id("vehicle_configs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("service_intervals")
      .withIndex("by_vehicle_config", (q) => q.eq("vehicle_config_id", args.vehicleConfigId))
      .collect();
  },
});

export const getLaborTimes = internalQuery({
  args: { vehicleConfigId: v.id("vehicle_configs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("labor_times")
      .withIndex("by_vehicle_config", (q) => q.eq("vehicle_config_id", args.vehicleConfigId))
      .collect();
  },
});

/** Best available labor estimate for a single service on a vehicle config. */
export const getQuotableLaborTime = internalQuery({
  args: {
    vehicle_config_id: v.id("vehicle_configs"),
    service_id: v.id("services"),
  },
  handler: async (ctx, args) => {
    const labor = await ctx.db
      .query("labor_times")
      .withIndex("by_vehicle_config", (q) =>
        q
          .eq("vehicle_config_id", args.vehicle_config_id)
          .eq("service_id", args.service_id),
      )
      .first();

    if (!labor) return null;

    const MIN_SAMPLES = 3;
    const useEmpirical =
      labor.empirical_hours != null &&
      labor.empirical_sample_size >= MIN_SAMPLES;

    return {
      hours: useEmpirical ? labor.empirical_hours! : labor.book_hours,
      source: useEmpirical ? ("empirical" as const) : labor.source,
      is_empirical: useEmpirical,
      sample_size: labor.empirical_sample_size,
      book_hours: labor.book_hours,
      empirical_hours: labor.empirical_hours ?? null,
      confidence: useEmpirical ? 0.95 : (labor.confidence ?? 0.75),
    };
  },
});

export const getPricedPartCount = internalQuery({
  args: { vehicleConfigId: v.id("vehicle_configs") },
  handler: async (ctx, args) => {
    const fitments = await ctx.db
      .query("part_fitments")
      .withIndex("by_vehicle_config", (q) => q.eq("vehicle_config_id", args.vehicleConfigId))
      .collect();
    let priced = 0;
    for (const f of fitments) {
      const price = await ctx.db
        .query("part_prices")
        .withIndex("by_part", (q) => q.eq("part_id", f.part_id))
        .first();
      if (price) priced++;
    }
    return priced;
  },
});

// ─── Source discovery queries ────────────────────────────────────

export const getSourcesForMake = internalQuery({
  args: { make_id: v.id("makes") },
  handler: async (ctx, { make_id }) => {
    return await ctx.db
      .query("source_registry")
      .withIndex("by_make", (q) => q.eq("make_id", make_id))
      .collect();
  },
});

export const getBlockedDomains = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("blocked_domains").collect();
  },
});

export const getAllMakes = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("makes").collect();
  },
});

export const getMakeById = internalQuery({
  args: { makeId: v.id("makes") },
  handler: async (ctx, { makeId }) => {
    return await ctx.db.get(makeId);
  },
});

export const getModelById = internalQuery({
  args: { modelId: v.id("models") },
  handler: async (ctx, { modelId }) => {
    return await ctx.db.get(modelId);
  },
});

export const getEvidenceForField = internalQuery({
  args: { entityId: v.string(), fieldName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("enrichment_evidence")
      .withIndex("by_entity_field", (q) =>
        q.eq("entity_id", args.entityId).eq("field_name", args.fieldName)
      )
      .collect();
  },
});

export const getEnrichmentRuns = internalQuery({
  args: { vehicleConfigId: v.id("vehicle_configs") },
  handler: async (ctx, { vehicleConfigId }) => {
    return await ctx.db
      .query("enrichment_runs")
      .withIndex("by_vehicle_config", (q) => q.eq("vehicle_config_id", vehicleConfigId))
      .collect();
  },
});

export const getAllServices = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("services").collect();
  },
});

export const getPartById = internalQuery({
  args: { partId: v.id("oem_parts") },
  handler: async (ctx, { partId }) => {
    return await ctx.db.get(partId);
  },
});

export const getOemPartById = internalQuery({
  args: { partId: v.id("oem_parts") },
  handler: async (ctx, { partId }) => {
    return await ctx.db.get(partId);
  },
});

export const getPricesForPart = internalQuery({
  args: { partId: v.id("oem_parts") },
  handler: async (ctx, { partId }) => {
    return await ctx.db
      .query("part_prices")
      .withIndex("by_part", (q) => q.eq("part_id", partId))
      .collect();
  },
});

export const getFirstShop = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("shops").first();
  },
});

export const createTestShop = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.insert("shops", {
      name: "Test Shop",
      slug: "test-shop",
      address: "123 Test St",
      city: "Test City",
      state: "TX",
      zip: "75001",
      lat: 32.7767,
      lng: -96.797,
      phone: "555-0100",
      labor_rate: 125,
      rating: 5,
      review_count: 0,
      is_active: true,
      is_verified: true,
    });
  },
});

export const getOrCreateTestMechanic = internalMutation({
  args: { shopId: v.id("shops") },
  handler: async (ctx, { shopId }) => {
    const existing = await ctx.db
      .query("mechanics")
      .withIndex("by_shop_id", (q) => q.eq("shop_id", shopId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("mechanics", {
      first_name: "Test",
      last_name: "Mechanic",
      shop_id: shopId,
      is_active: true,
      rating: 5,
      review_count: 0,
    });
  },
});

export const getEvidenceByRun = internalQuery({
  args: { enrichmentRunId: v.id("enrichment_runs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("enrichment_evidence")
      .withIndex("by_enrichment_run", (q) => q.eq("enrichment_run_id", args.enrichmentRunId))
      .collect();
  },
});

export const getEvidenceCount = internalQuery({
  args: { entityId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("enrichment_evidence")
      .withIndex("by_entity_field", (q) => q.eq("entity_id", args.entityId))
      .collect();
    return rows.length;
  },
});

export const getEvidenceForEntity = internalQuery({
  args: { entityId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("enrichment_evidence")
      .withIndex("by_entity_field", (q) => q.eq("entity_id", args.entityId))
      .collect();
  },
});
