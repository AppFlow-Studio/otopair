/**
 * schema.ts - Convex Database Schema
 *
 * DESCRIPTION:
 * Central schema definition for the entire Convex database. This file defines
 * all tables, their fields, types, relationships, and indexes. It serves as the
 * single source of truth for the database structure.
 *
 * ARCHITECTURE:
 * - Vehicle Identity: makes → models → generations → vehicle_configs
 * - Legacy stubs: trims, chassis_variants, enriched_engine_configs (FK-referenced)
 * - Engine/Transmission: independent entities shared across vehicle_configs
 * - Parts: oem_parts → part_fitments → part_prices (normalized, evidence-based)
 * - Services: services (with applicability rules), service_intervals, labor_times
 * - Evidence: enrichment_evidence, enrichment_runs, mechanic_verifications
 * - Sources: source_registry, blocked_domains, scrape_cache
 * - Core app: bookings, users, shops, mechanics, payments
 * - Analytics: analytics_events, conversion_funnels
 * - Rewards: user_reward_wallets, ownership_credit_transactions, vehicle_tiers
 *
 * OWNER: Backend Team
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================================================
  // LAYER 1: VEHICLE IDENTITY
  // ============================================================================

  /**
   * TABLE: makes
   *
   * DESCRIPTION:
   * Vehicle manufacturer reference data. Top-level in vehicle hierarchy.
   *
   * INDEXES:
   *   - by_name: Lookup by manufacturer name
   *   - by_slug: Lookup by URL-friendly slug
   */
  makes: defineTable({
    // Original fields
    name: v.string(),
    logo: v.optional(v.id("cdn_assets")),
    logo_url: v.optional(v.string()),
    // Added fields
    slug: v.optional(v.string()),
    country: v.optional(v.string()),
    oem_part_pattern: v.optional(v.string()),
    oem_part_pattern_alt: v.optional(v.string()),
    parent_group: v.optional(v.string()),
    created_at: v.optional(v.float64()),
  })
    .index("by_name", ["name"])
    .index("by_slug", ["slug"]),

  /**
   * TABLE: models
   * Vehicle model information. Second level in hierarchy.
   */
  models: defineTable({
    make_id: v.id("makes"),
    name: v.string(),
    // Added fields
    slug: v.optional(v.string()),
    category: v.optional(v.string()),
    created_at: v.optional(v.float64()),
  }).index("by_make_id", ["make_id"]),

  /**
   * TABLE: trims (LEGACY stub — FK-referenced by vehicles, engines, transmissions, etc.)
   */
  trims: defineTable({
    model_id: v.id("models"),
    name: v.string(),
    year_end: v.float64(),
    year_start: v.float64(),
  }).index("by_model_id", ["model_id"]),

  /**
   * TABLE: chassis_variants (LEGACY stub — FK-referenced by vehicles)
   */
  chassis_variants: defineTable({
    trim_id: v.id("trims"),
    drivetrain_type: v.string(),
    notes: v.optional(v.string()),
    created_at: v.float64(),
    confidence_score: v.optional(v.float64()),
  })
    .index("by_trim", ["trim_id"])
    .index("by_trim_drivetrain", ["trim_id", "drivetrain_type"]),

  /**
   * TABLE: enriched_engine_configs (minimal stub — FK-referenced by vehicles)
   */
  enriched_engine_configs: defineTable({
    engineConfig: v.string(),
  }).index("by_engine_config", ["engineConfig"]),

  /**
   * TABLE: engines
   *
   * DESCRIPTION:
   * Mechanical facts intrinsic to an engine. Includes fluid specs that are
   * engine-determined. Engines are independent entities shared across
   * vehicle_configs.
   *
   * INDEXES:
   *   - by_trim_id: Legacy lookup by trim
   *   - by_engine_code: Lookup by OEM engine code
   *   - by_engine_family: Lookup by engine family
   *   - by_make: Get all engines for a make
   */
  engines: defineTable({
    // Original fields
    trim_id: v.id("trims"),
    cylinders: v.float64(),
    displacement_liters: v.string(),
    engine_code: v.string(),
    fuel_type: v.string(),
    // Added fields
    engine_family: v.optional(v.string()),
    make_id: v.optional(v.id("makes")),
    displacement_l: v.optional(v.float64()),
    configuration: v.optional(v.string()),
    aspiration: v.optional(v.string()),
    fuel_injection: v.optional(v.string()),
    timing_system: v.optional(v.string()),
    has_serpentine_belt: v.optional(v.boolean()),
    oil_viscosity: v.optional(v.string()),
    oil_spec_standard: v.optional(v.string()),
    oil_capacity_qts: v.optional(v.float64()),
    coolant_type: v.optional(v.string()),
    coolant_capacity_qts: v.optional(v.float64()),
    spark_plug_quantity: v.optional(v.float64()),
    spark_plug_gap_mm: v.optional(v.float64()),
    timing_idler_count: v.optional(v.float64()),
    water_pump_timing_driven: v.optional(v.boolean()),
    data_quality: v.optional(v.string()),
    created_at: v.optional(v.float64()),
  })
    .index("by_trim_id", ["trim_id"])
    .index("by_engine_code", ["engine_code"])
    .index("by_engine_family", ["engine_family"])
    .index("by_make", ["make_id"]),

  /**
   * TABLE: transmissions
   *
   * DESCRIPTION:
   * Transmission specs including fluid and service information.
   * Independent entities shared across vehicle_configs.
   *
   * INDEXES:
   *   - by_trim: Legacy lookup by trim
   *   - by_trim_type: Legacy combined lookup
   */
  transmissions: defineTable({
    // Original fields
    trim_id: v.id("trims"),
    transmission_type: v.string(),
    code: v.optional(v.string()),
    notes: v.optional(v.string()),
    created_at: v.float64(),
    confidence_score: v.optional(v.float64()),
    // Added fields
    type: v.optional(v.string()),
    speeds: v.optional(v.float64()),
    make_id: v.optional(v.id("makes")),
    manufacturer: v.optional(v.string()),
    fluid_type: v.optional(v.string()),
    fluid_capacity_drain_fill_qts: v.optional(v.float64()),
    is_lifetime_fill: v.optional(v.boolean()),
    has_serviceable_filter: v.optional(v.boolean()),
    service_method: v.optional(v.string()),
    data_quality: v.optional(v.string()),
  })
    .index("by_trim", ["trim_id"])
    .index("by_trim_type", ["trim_id", "transmission_type"]),

  // ============================================================================
  // LAYER 1b: GENERATIONS & VEHICLE CONFIGS
  // ============================================================================

  /**
   * TABLE: generations
   *
   * Platform-level facts true for every vehicle in this generation.
   * Makes → Models → Generations → Vehicle Configs
   */
  generations: defineTable({
    model_id: v.id("models"),
    name: v.string(),
    start_year: v.float64(),
    end_year: v.optional(v.float64()),
    platform: v.optional(v.string()),
    body_class: v.string(),
    steering_type: v.string(),
    parking_brake_type: v.string(),
    has_rear_wiper: v.boolean(),
    cabin_filter_access: v.optional(v.string()),
    created_at: v.float64(),
  })
    .index("by_model", ["model_id"])
    .index("by_years", ["model_id", "start_year", "end_year"]),

  /**
   * TABLE: vehicle_configs
   *
   * The atomic unit of enrichment. One config = one unique
   * (year, make, model, trim, engine, transmission, drivetrain) combination.
   * All enrichment data (parts, intervals, labor) attaches to this entity.
   */
  vehicle_configs: defineTable({
    config_key: v.string(),
    year: v.float64(),
    make_id: v.id("makes"),
    model_id: v.id("models"),
    generation_id: v.optional(v.id("generations")),
    trim_name: v.string(),
    trim_slug: v.string(),
    engine_id: v.id("engines"),
    transmission_id: v.optional(v.id("transmissions")),
    drivetrain: v.string(),
    has_brake_pad_sensor: v.optional(v.boolean()),
    brake_fluid_type: v.optional(v.string()),
    brake_fluid_capacity_oz: v.optional(v.float64()),
    ps_fluid_type: v.optional(v.string()),
    ps_fluid_capacity_oz: v.optional(v.float64()),
    enrichment_status: v.string(),
    fill_rate: v.float64(),
    confidence_avg: v.optional(v.float64()),
    last_enriched_at: v.optional(v.float64()),
    last_verified_at: v.optional(v.float64()),
    enrichment_version: v.optional(v.string()),
    verification_count: v.float64(),
    created_at: v.float64(),
  })
    .index("by_config_key", ["config_key"])
    .index("by_engine", ["engine_id"])
    .index("by_make_model_year", ["make_id", "model_id", "year"])
    .index("by_enrichment_status", ["enrichment_status"])
    .index("by_fill_rate", ["fill_rate"]),

  /**
   * TABLE: drivetrain_configs
   *
   * Per-vehicle-config drivetrain specifications including differential
   * and transfer case fluid data. 1:1 with vehicle_configs.
   */
  drivetrain_configs: defineTable({
    vehicle_config_id: v.id("vehicle_configs"),
    drivetrain_type: v.string(),
    has_differential: v.boolean(),
    diff_fluid_type: v.optional(v.string()),
    diff_fluid_capacity_qts: v.optional(v.float64()),
    lsd_additive_required: v.optional(v.boolean()),
    has_transfer_case: v.boolean(),
    tc_fluid_type: v.optional(v.string()),
    tc_fluid_capacity_qts: v.optional(v.float64()),
    data_quality: v.optional(v.string()),
    created_at: v.float64(),
  }).index("by_vehicle_config", ["vehicle_config_id"]),

  /**
   * TABLE: trim_specs
   *
   * Physical specs that vary by trim within the same generation.
   * Covers tires, wheels, wipers, battery.
   */
  trim_specs: defineTable({
    // Original fields (optional for v3 records that use vehicle_config_id)
    trim_id: v.optional(v.id("trims")),
    tire_size_front: v.optional(v.string()),
    tire_size_rear: v.optional(v.string()),
    recommended_tire_pressure_front_psi: v.optional(v.float64()),
    recommended_tire_pressure_rear_psi: v.optional(v.float64()),
    lug_nut_torque_ft_lbs: v.optional(v.float64()),
    wiper_blade_driver_size_in: v.optional(v.float64()),
    wiper_blade_passenger_size_in: v.optional(v.float64()),
    wiper_blade_rear_size_in: v.optional(v.float64()),
    parking_brake_type: v.optional(v.string()),
    confidence_score: v.optional(v.float64()),
    created_at: v.float64(),
    // Added fields
    vehicle_config_id: v.optional(v.id("vehicle_configs")),
    is_staggered: v.optional(v.boolean()),
    tire_directional: v.optional(v.boolean()),
    is_run_flat: v.optional(v.boolean()),
    alignment_type: v.optional(v.string()),
    battery_group: v.optional(v.string()),
    battery_cca: v.optional(v.float64()),
    battery_type: v.optional(v.string()),
    battery_location: v.optional(v.string()),
    data_quality: v.optional(v.string()),
  })
    .index("by_trim", ["trim_id"])
    .index("by_vehicle_config", ["vehicle_config_id"]),

  // ============================================================================
  // LAYER 2: PARTS
  // ============================================================================

  /**
   * TABLE: oem_parts
   *
   * Every OEM part number as a first-class entity with supersession chain,
   * fitment rules, and pricing. Parts are shared across vehicle configs.
   */
  oem_parts: defineTable({
    // Original fields
    oem_part_number: v.string(),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
    created_at: v.float64(),
    // Added fields
    part_number_formatted: v.optional(v.string()),
    make_id: v.optional(v.id("makes")),
    subcategory: v.optional(v.string()),
    is_current: v.optional(v.boolean()),
    superseded_by: v.optional(v.string()),
    supersedes: v.optional(v.string()),
    first_seen_at: v.optional(v.float64()),
    last_confirmed_at: v.optional(v.float64()),
    source_count: v.optional(v.float64()),
    data_quality: v.optional(v.string()),
  })
    .index("by_part_number", ["oem_part_number"])
    .index("by_category", ["category"])
    .index("by_subcategory", ["subcategory"])
    .index("by_make_category", ["make_id", "category"]),

  /**
   * TABLE: part_fitments
   *
   * Which parts fit which vehicle configs, for what service, in what quantity.
   * Unified fitment table replacing engine/transmission/trim-specific fitments.
   */
  part_fitments: defineTable({
    part_id: v.id("oem_parts"),
    vehicle_config_id: v.id("vehicle_configs"),
    service_type: v.string(),
    quantity_needed: v.float64(),
    position: v.optional(v.string()),
    confidence: v.optional(v.float64()),
    source_count: v.optional(v.float64()),
    first_confirmed_at: v.optional(v.float64()),
    last_confirmed_at: v.optional(v.float64()),
    mechanic_verified: v.optional(v.boolean()),
    data_quality: v.optional(v.string()),
    created_at: v.float64(),
  })
    .index("by_vehicle_config", ["vehicle_config_id"])
    .index("by_part", ["part_id"])
    .index("by_config_service", ["vehicle_config_id", "service_type"]),

  /**
   * TABLE: part_prices
   *
   * One row per part per source. Monthly overwrite — no time-series history.
   */
  part_prices: defineTable({
    part_id: v.id("oem_parts"),
    price: v.float64(),
    price_type: v.string(),
    source_url: v.optional(v.string()),
    source_domain: v.string(),
    refreshed_at: v.float64(),
    created_at: v.float64(),
  })
    .index("by_part", ["part_id"])
    .index("by_part_source", ["part_id", "source_domain"]),

  // ============================================================================
  // LAYER 3: SERVICES
  // ============================================================================

  /**
   * TABLE: services
   *
   * Master list of services offered on the platform with applicability rules.
   * Price is not stored; computed at booking time.
   */
  services: defineTable({
    // Original fields
    default_labor_hours: v.float64(),
    description: v.string(),
    display_order: v.float64(),
    has_options: v.boolean(),
    is_labor_only: v.boolean(),
    name: v.string(),
    service_category_id: v.id("service_categories"),
    slug: v.string(),
    // Added fields
    requires_parts: v.optional(v.boolean()),
    requires_fluids: v.optional(v.boolean()),
    requires_ice_engine: v.optional(v.boolean()),
    requires_timing_belt: v.optional(v.boolean()),
    requires_hydraulic_ps: v.optional(v.boolean()),
    requires_differential: v.optional(v.boolean()),
    requires_rotatable_tires: v.optional(v.boolean()),
    requires_state_inspection: v.optional(v.boolean()),
    requires_emissions_test: v.optional(v.boolean()),
    min_model_year: v.optional(v.float64()),
    created_at: v.optional(v.float64()),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["service_category_id"]),

  /**
   * TABLE: service_intervals
   *
   * Per vehicle config, per service: when is this service due?
   */
  service_intervals: defineTable({
    vehicle_config_id: v.id("vehicle_configs"),
    service_id: v.id("services"),
    interval_miles: v.optional(v.float64()),
    interval_months: v.optional(v.float64()),
    status: v.string(),
    display_string: v.optional(v.string()),
    confidence: v.optional(v.float64()),
    source_count: v.optional(v.float64()),
    mechanic_verified: v.optional(v.boolean()),
    data_quality: v.optional(v.string()),
    created_at: v.float64(),
  })
    .index("by_vehicle_config", ["vehicle_config_id"])
    .index("by_config_service", ["vehicle_config_id", "service_id"]),

  /**
   * TABLE: labor_times
   *
   * One number per service per vehicle config. All-inclusive — already accounts
   * for all vehicle-specific complexity.
   */
  labor_times: defineTable({
    vehicle_config_id: v.optional(v.id("vehicle_configs")),
    engine_family: v.optional(v.string()),
    service_id: v.id("services"),
    book_hours: v.float64(),
    empirical_hours: v.optional(v.float64()),
    empirical_sample_size: v.float64(),
    empirical_p25: v.optional(v.float64()),
    empirical_p75: v.optional(v.float64()),
    source: v.string(),
    confidence: v.optional(v.float64()),
    data_quality: v.optional(v.string()),
    created_at: v.float64(),
  })
    .index("by_vehicle_config", ["vehicle_config_id", "service_id"])
    .index("by_engine_family", ["engine_family", "service_id"]),

  // ============================================================================
  // LAYER 4: EVIDENCE & VERIFICATION
  // ============================================================================

  /**
   * TABLE: enrichment_evidence
   *
   * Every observation from every source for every field. Append-only.
   * Supports multi-source consensus computation.
   */
  enrichment_evidence: defineTable({
    entity_type: v.string(),
    entity_id: v.string(),
    field_name: v.string(),
    observed_value: v.string(),
    observed_type: v.string(),
    source_url: v.optional(v.string()),
    source_domain: v.optional(v.string()),
    source_type: v.string(),
    confidence: v.float64(),
    enrichment_run_id: v.optional(v.id("enrichment_runs")),
    observed_at: v.float64(),
    is_latest: v.boolean(),
    created_at: v.float64(),
  })
    .index("by_entity", ["entity_type", "entity_id", "field_name"])
    .index("by_entity_field", ["entity_id", "field_name"])
    .index("by_source_domain", ["source_domain"])
    .index("by_enrichment_run", ["enrichment_run_id"]),

  /**
   * TABLE: enrichment_runs
   *
   * Audit trail for every enrichment execution. Tracks costs, timing,
   * field coverage, and errors.
   */
  enrichment_runs: defineTable({
    vehicle_config_id: v.optional(v.id("vehicle_configs")),
    version: v.string(),
    trigger: v.string(),
    status: v.string(),
    total_tokens_in: v.optional(v.float64()),
    total_tokens_out: v.optional(v.float64()),
    total_web_searches: v.optional(v.float64()),
    total_firecrawl_credits: v.optional(v.float64()),
    estimated_cost_usd: v.optional(v.float64()),
    started_at: v.float64(),
    completed_at: v.optional(v.float64()),
    duration_ms: v.optional(v.float64()),
    fields_filled: v.optional(v.float64()),
    fields_total: v.optional(v.float64()),
    fill_rate: v.optional(v.float64()),
    fields_changed: v.optional(v.array(v.string())),
    errors: v.optional(v.array(v.string())),
    batch_ids: v.optional(v.any()),
    scrape_cache_hit: v.optional(v.boolean()),
    created_at: v.float64(),
  })
    .index("by_vehicle_config", ["vehicle_config_id"])
    .index("by_status", ["status"])
    .index("by_created_at", ["created_at"]),

  /**
   * TABLE: mechanic_verifications
   *
   * Feedback from mechanics after completing jobs. Ground truth that feeds
   * back into the knowledge graph via evidence and consensus updates.
   */
  mechanic_verifications: defineTable({
    mechanic_id: v.id("mechanics"),
    vehicle_config_id: v.id("vehicle_configs"),
    job_id: v.optional(v.id("job_actuals")),
    service_id: v.id("services"),
    verifications: v.array(
      v.object({
        field_name: v.string(),
        our_value: v.string(),
        status: v.string(),
        corrected_value: v.optional(v.string()),
        notes: v.optional(v.string()),
      })
    ),
    actual_labor_hours: v.optional(v.float64()),
    parts_used_correct: v.optional(v.boolean()),
    overall_accuracy: v.string(),
    verified_at: v.float64(),
    created_at: v.float64(),
  })
    .index("by_vehicle_config", ["vehicle_config_id"])
    .index("by_mechanic", ["mechanic_id"])
    .index("by_job", ["job_id"])
    .index("by_service", ["service_id"]),

  // ============================================================================
  // LAYER 5: SOURCE MANAGEMENT
  // ============================================================================

  /**
   * TABLE: source_registry
   *
   * Data-driven source management. Self-healing: when accuracy_rate drops
   * below threshold, source is auto-blocked.
   */
  source_registry: defineTable({
    make_id: v.id("makes"),
    source_type: v.string(),
    domain: v.string(),
    url_template: v.string(),
    slug_fn_type: v.string(),
    part_slug_map: v.optional(v.any()),
    manual_queries: v.optional(v.array(v.string())),
    reliability_score: v.optional(v.float64()),
    total_observations: v.optional(v.float64()),
    accuracy_rate: v.optional(v.float64()),
    is_blocked: v.boolean(),
    block_reason: v.optional(v.string()),
    last_scraped_at: v.optional(v.float64()),
    last_scrape_success: v.optional(v.boolean()),
    created_at: v.float64(),
  })
    .index("by_make", ["make_id"])
    .index("by_domain", ["domain"])
    .index("by_blocked", ["is_blocked"]),

  /**
   * TABLE: blocked_domains
   *
   * Auto-maintained blocklist of unreliable data sources.
   */
  blocked_domains: defineTable({
    domain: v.string(),
    reason: v.string(),
    blocked_at: v.float64(),
    blocked_by: v.string(),
    accuracy_at_block: v.optional(v.float64()),
    created_at: v.float64(),
  }).index("by_domain", ["domain"]),

  // ============================================================================
  // LAYER 6: SCRAPE CACHE
  // ============================================================================

  /**
   * TABLE: scrape_cache
   *
   * Caches scraped page content by URL with TTL-based expiration.
   */
  scrape_cache: defineTable({
    cache_key: v.string(),
    url: v.string(),
    domain: v.string(),
    source_type: v.string(),
    make_id: v.optional(v.id("makes")),
    model_id: v.optional(v.id("models")),
    year: v.optional(v.float64()),
    markdown: v.string(),
    markdown_length: v.float64(),
    scraped_at: v.float64(),
    expires_at: v.float64(),
    ttl_days: v.float64(),
    scrape_success: v.boolean(),
    http_status: v.optional(v.float64()),
    created_at: v.float64(),
  })
    .index("by_cache_key", ["cache_key"])
    .index("by_expires_at", ["expires_at"])
    .index("by_make_year", ["make_id", "year"]),

  // ============================================================================
  // CORE APP TABLES
  // ============================================================================

  /**
   * TABLE: bookings
   *
   * DESCRIPTION:
   * Stores confirmed service bookings for vehicles at shops.
   * Central record linking users, vehicles, shops, mechanics, and services.
   *
   * FIELDS:
   *   - user_id: References the user who made the booking
   *   - vin: Canonical VIN (uppercase normalized) linking to vehicles table
   *   - service_ids: Array of service type IDs for this appointment
   *   - shop_id: The shop where service will be performed
   *   - mechanic_id: (optional) Specific mechanic assigned to the job
   *   - time_slot_id: The chosen appointment time slot (one slot per appointment)
   *   - scheduled_date: Date of service (YYYY-MM-DD format)
   *   - scheduled_time: Time of service (HH:MM format)
   *   - labor_cost: Total estimated labor cost (all services) in dollars
   *   - parts_cost: Total estimated parts cost (all services) in dollars
   *   - total_cost: Full amount customer pays (labor_cost + parts_cost + taxes_and_fees + platform_fee)
   *   - estimated_labor_minutes: Total estimated time for all services (minutes)
   *   - status: Current booking state (e.g., "confirmed", "completed", "cancelled")
   *   - live_stage: When status is "in_progress", current Live Tracker stage
   *   - created_at: Unix timestamp when booking was created
   *   - updated_at: Unix timestamp of last modification
   *
   * INDEXES:
   *   - by_user_id: Query all bookings for a user
   *   - by_shop_id: Query all bookings at a shop
   *   - by_status: Query bookings by status (for filtering)
   *   - by_scheduled_date: Query bookings on specific dates
   *   - by_user_and_status: Combined queries for user's specific-status bookings
   *   - by_shop_and_date: Query bookings at shop on specific date
   *   - by_shop_and_status: Query shop's bookings by status
   *   - by_created_at: Chronological ordering of bookings
   *
   * RELATIONSHIPS:
   *   FK → users(user_id)
   *   FK → vehicles(vin) via canonical VIN lookup
   *   FK → shops(shop_id)
   *   FK → mechanics(mechanic_id)
   *   FK → time_slots(time_slot_id)
   *   Has-one → payments (via booking_id)
   *   Has-one → job_actuals (via booking_id)
   *   Has-one → reviews (via booking_id)
   */
  bookings: defineTable({
    labor_cost: v.float64(),
    live_stage: v.optional(v.string()),
    mechanic_id: v.optional(v.id("mechanics")),
    parts_cost: v.float64(),
    scheduled_date: v.string(),
    scheduled_time: v.string(),
    service_ids: v.optional(v.array(v.id("services"))),
    estimated_labor_minutes: v.optional(v.float64()),
    shop_id: v.id("shops"),
    status: v.string(),
    time_slot_id: v.id("time_slots"),
    total_cost: v.float64(),
    user_id: v.id("users"),
    vin: v.string(),
    created_at: v.float64(),
    updated_at: v.float64(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_shop_id", ["shop_id"])
    .index("by_status", ["status"])
    .index("by_scheduled_date", ["scheduled_date"])
    .index("by_user_and_status", ["user_id", "status"])
    .index("by_shop_and_date", ["shop_id", "scheduled_date"])
    .index("by_shop_and_status", ["shop_id", "status"])
    .index("by_created_at", ["created_at"]),

  /**
   * TABLE: users
   *
   * DESCRIPTION:
   * Platform users (vehicle owners seeking maintenance services).
   * Primary authentication via Clerk (third-party auth provider).
   *
   * INDEXES:
   *   - by_clerkUserId: Auth lookup by external ID
   *   - by_isPendingDeletion: Find users requesting deletion
   */
  users: defineTable({
    auth_provider: v.optional(v.string()),
    clerkUserId: v.string(),
    createdAt: v.float64(),
    email: v.optional(v.string()),
    emailConfirmed: v.optional(v.boolean()),
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    lastUpdated: v.optional(v.float64()),
    onboardingCompleted: v.boolean(),
    phone: v.optional(v.string()),
    phoneVerified: v.optional(v.boolean()),
    profile_photo_url: v.optional(v.union(v.string(), v.null())),
    profile_photo_storage_id: v.optional(v.union(v.string(), v.null())),
    tellUsAboutCompleted: v.optional(v.boolean()),
    user_intentions: v.optional(v.array(v.string())),
    username: v.optional(v.string()),
    language: v.optional(v.string()),
    units: v.optional(v.string()),
    deletionRequestedAt: v.optional(v.float64()),
    isPendingDeletion: v.optional(v.boolean()),
    deletionSurveyResponse: v.optional(v.string()),
    deletionSurveySkipped: v.optional(v.boolean()),
  }).index("by_clerkUserId", ["clerkUserId"])
    .index("by_isPendingDeletion", ["isPendingDeletion"]),

  /**
   * TABLE: shops
   *
   * DESCRIPTION:
   * Stores automotive service shops/repair facilities.
   */
  shops: defineTable({
    address: v.string(),
    city: v.string(),
    is_active: v.boolean(),
    is_verified: v.boolean(),
    labor_rate: v.float64(),
    lat: v.float64(),
    lng: v.float64(),
    name: v.string(),
    phone: v.string(),
    rating: v.float64(),
    review_count: v.float64(),
    slug: v.string(),
    state: v.string(),
    zip: v.string(),
  }),

  /**
   * TABLE: mechanics
   *
   * DESCRIPTION:
   * Stores individual mechanic/technician information.
   * Each mechanic is employed at a specific shop.
   *
   * INDEXES:
   *   - by_shop_id: Get all mechanics at a shop
   *   - by_is_active: Filter for active mechanics
   */
  mechanics: defineTable({
    first_name: v.string(),
    is_active: v.boolean(),
    last_name: v.string(),
    photo: v.optional(v.id("cdn_assets")),
    rating: v.float64(),
    review_count: v.float64(),
    shop_id: v.id("shops"),
    title: v.optional(v.string()),
  })
    .index("by_shop_id", ["shop_id"])
    .index("by_is_active", ["is_active"]),

  /**
   * TABLE: time_slots
   *
   * DESCRIPTION:
   * Available appointment time slots at shops. Each mechanic is treated as an
   * individual bay with their own calendar.
   *
   * INDEXES:
   *   - by_shop_id: Get slots for a shop
   *   - by_mechanic_id: Get slots for a mechanic (per-bay calendar)
   *   - by_shop_and_date: Get slots for shop on specific date
   *   - by_availability: Filter available slots by date
   */
  time_slots: defineTable({
    date: v.string(),
    end_time: v.string(),
    is_available: v.boolean(),
    mechanic_id: v.optional(v.id("mechanics")),
    shop_id: v.id("shops"),
    start_time: v.string(),
  })
    .index("by_shop_id", ["shop_id"])
    .index("by_mechanic_id", ["mechanic_id"])
    .index("by_shop_and_date", ["shop_id", "date"])
    .index("by_availability", ["is_available", "date"]),

  /**
   * TABLE: shops_hours
   *
   * DESCRIPTION:
   * Stores operating hours for shops (by day of week).
   */
  shops_hours: defineTable({
    close_time: v.optional(v.string()),
    day_name: v.string(),
    day_of_week: v.float64(),
    is_closed: v.boolean(),
    open_time: v.optional(v.string()),
    shop_id: v.id("shops"),
  }).index("by_shop_id", ["shop_id"]),

  /**
   * TABLE: reviews
   *
   * DESCRIPTION:
   * Stores customer reviews for services and shops.
   *
   * INDEXES:
   *   - by_booking_id: Get review for specific booking
   *   - by_shop_id: Get all reviews for a shop
   *   - by_mechanic_id: Get all reviews for a mechanic
   *   - by_user_id: Get all reviews from a user
   *   - by_rating: Filter reviews by rating
   */
  reviews: defineTable({
    booking_id: v.id("bookings"),
    comment: v.string(),
    mechanic_id: v.optional(v.id("mechanics")),
    rating: v.float64(),
    shop_id: v.id("shops"),
    user_id: v.id("users"),
    created_at: v.float64(),
  })
    .index("by_booking_id", ["booking_id"])
    .index("by_shop_id", ["shop_id"])
    .index("by_mechanic_id", ["mechanic_id"])
    .index("by_user_id", ["user_id"])
    .index("by_rating", ["rating"]),

  // ============================================================================
  // PAYMENT TRACKING
  // ============================================================================

  /**
   * TABLE: payments
   *
   * DESCRIPTION:
   * Payment records for completed bookings.
   *
   * INDEXES:
   *   - by_booking_id: Get payment for booking
   *   - by_user_id: Get all payments by user
   *   - by_status: Filter payments by status
   *   - by_idempotency_key: Prevent duplicate payments
   *   - by_created_at: Chronological ordering
   */
  payments: defineTable({
    booking_id: v.id("bookings"),
    user_id: v.id("users"),
    shop_id: v.id("shops"),
    amount: v.float64(),
    payment_method: v.string(),
    status: v.string(),
    transaction_id: v.optional(v.string()),
    stripe_payment_intent_id: v.optional(v.string()),
    idempotency_key: v.optional(v.string()),
    created_at: v.float64(),
    updated_at: v.float64(),
  })
    .index("by_booking_id", ["booking_id"])
    .index("by_user_id", ["user_id"])
    .index("by_status", ["status"])
    .index("by_idempotency_key", ["idempotency_key"])
    .index("by_created_at", ["created_at"]),

  /**
   * TABLE: transactions
   *
   * DESCRIPTION:
   * User-facing transaction history for the Transactions screen.
   *
   * INDEXES:
   *   - by_user_id: All transactions for a user
   *   - by_user_id_created_at: Chronological list for user
   *   - by_user_id_type: Filter by user + transaction_type
   *   - by_user_id_type_created_at: Combined filter + sort
   *   - by_payment_id: Link to payments table
   */
  transactions: defineTable({
    user_id: v.id("users"),
    created_at: v.float64(),
    description: v.string(),
    sub_description: v.optional(v.string()),
    amount: v.float64(),
    currency: v.string(),
    status: v.string(),
    transaction_type: v.string(),
    shop_id: v.optional(v.id("shops")),
    booking_id: v.optional(v.id("bookings")),
    payment_id: v.optional(v.id("payments")),
    icon_type: v.optional(v.string()),
  })
    .index("by_user_id", ["user_id"])
    .index("by_user_id_created_at", ["user_id", "created_at"])
    .index("by_user_id_type", ["user_id", "transaction_type"])
    .index("by_user_id_type_created_at", ["user_id", "transaction_type", "created_at"])
    .index("by_payment_id", ["payment_id"]),

  /**
   * TABLE: payment_status_history
   *
   * DESCRIPTION:
   * Append-only audit log of payment status changes.
   */
  payment_status_history: defineTable({
    payment_id: v.id("payments"),
    old_status: v.optional(v.string()),
    new_status: v.string(),
    error_code: v.optional(v.string()),
    error_message: v.optional(v.string()),
    changed_at: v.float64(),
  })
    .index("by_payment_id", ["payment_id"])
    .index("by_changed_at", ["changed_at"]),

  /**
   * TABLE: booking_status_history
   *
   * DESCRIPTION:
   * Append-only audit log of booking status changes.
   */
  booking_status_history: defineTable({
    booking_id: v.id("bookings"),
    old_status: v.optional(v.string()),
    new_status: v.string(),
    changed_by: v.optional(v.id("users")),
    reason: v.optional(v.string()),
    changed_at: v.float64(),
  })
    .index("by_booking_id", ["booking_id"])
    .index("by_changed_at", ["changed_at"]),

  // ============================================================================
  // VEHICLES & OWNERSHIP
  // ============================================================================

  /**
   * TABLE: vehicles
   *
   * DESCRIPTION:
   * Canonical vehicle catalog - one record per VIN.
   * Vehicle ownership is tracked in vehicle_owners table.
   * Links to vehicle_configs for enriched vehicle data.
   *
   * INDEXES:
   *   - by_vin: Primary lookup by VIN (unique)
   *   - by_engine_id: Find all vehicles with specific engine
   *   - by_vehicle_config: Find all vehicles with specific config
   *   - by_transmission: Find all vehicles with specific transmission
   */
  vehicles: defineTable({
    vin: v.string(),
    trim_id: v.optional(v.id("trims")),
    engine_id: v.optional(v.id("engines")),
    transmission_id: v.optional(v.id("transmissions")),
    chassis_id: v.optional(v.id("chassis_variants")),
    year: v.optional(v.float64()),
    metadata: v.optional(v.any()),
    image_url: v.optional(v.string()),
    enriched_engine_config_id: v.optional(v.id("enriched_engine_configs")),
    created_at: v.float64(),
    updated_at: v.float64(),
    // Added field
    vehicle_config_id: v.optional(v.id("vehicle_configs")),
  })
    .index("by_vin", ["vin"])
    .index("by_engine_id", ["engine_id"])
    .index("by_vehicle_config", ["vehicle_config_id"])
    .index("by_transmission", ["transmission_id"]),

  /**
   * TABLE: vehicle_owners
   *
   * DESCRIPTION:
   * Tracks ownership relationships between users and vehicles.
   * One record per user-vehicle pair. Supports vehicle removal (soft delete).
   *
   * INDEXES:
   *   - by_vin: Get all owners of a vehicle
   *   - by_user_id: Get all vehicles owned by user
   *   - by_vin_user: Combined lookup for specific ownership
   *   - by_user_status: Get user's active/removed vehicles
   *   - by_smartcar_vehicle_id: Lookup by Smartcar vehicle ID (webhook path)
   */
  vehicle_owners: defineTable({
    vin: v.string(),
    user_id: v.id("users"),
    status: v.string(),
    nickname: v.optional(v.string()),
    is_primary: v.optional(v.boolean()),
    mileage: v.optional(v.float64()),
    added_at: v.float64(),
    removed_at: v.optional(v.float64()),
    smartcarVehicleId: v.optional(v.string()),
    connectionStatus: v.optional(v.string()),
    connectedAt: v.optional(v.float64()),
    avgMonthlyDriving: v.optional(v.string()),
    drivingConditions: v.optional(v.string()),
    knownIssues: v.optional(v.any()),
    onboardingComplete: v.optional(v.boolean()),
  })
    .index("by_vin", ["vin"])
    .index("by_user_id", ["user_id"])
    .index("by_vin_user", ["vin", "user_id"])
    .index("by_user_status", ["user_id", "status"])
    .index("by_smartcar_vehicle_id", ["smartcarVehicleId"]),

  // ============================================================================
  // AI CONVERSATIONS
  // ============================================================================

  /**
   * TABLE: ai_conversations
   *
   * DESCRIPTION:
   * Conversation sessions with AI chat assistant.
   *
   * INDEXES:
   *   - by_user_id: Get conversations for user
   *   - by_session_id: Lookup by session (unique)
   *   - by_booking_id: Get conversation that led to booking
   *   - by_started_at: Chronological ordering
   */
  ai_conversations: defineTable({
    user_id: v.id("users"),
    started_at: v.float64(),
    ended_at: v.optional(v.float64()),
    scenario_detected: v.optional(v.string()),
    led_to_booking: v.boolean(),
    booking_id: v.optional(v.id("bookings")),
    message_count: v.float64(),
    session_id: v.string(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_session_id", ["session_id"])
    .index("by_booking_id", ["booking_id"])
    .index("by_started_at", ["started_at"]),

  /**
   * TABLE: ai_messages
   *
   * DESCRIPTION:
   * Individual messages in AI conversation sessions.
   *
   * INDEXES:
   *   - by_conversation_id: Get all messages in conversation
   *   - by_role: Filter messages by role
   *   - by_timestamp: Chronological ordering
   */
  ai_messages: defineTable({
    conversation_id: v.id("ai_conversations"),
    role: v.string(),
    content: v.string(),
    timestamp: v.float64(),
    confidence_score: v.optional(v.float64()),
    metadata: v.optional(
      v.object({
        service_suggestions: v.optional(v.array(v.id("services"))),
        shop_suggestions: v.optional(v.array(v.id("shops"))),
        intent_detected: v.optional(v.string()),
      })
    ),
  })
    .index("by_conversation_id", ["conversation_id"])
    .index("by_role", ["role"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================================
  // ANALYTICS & CONVERSION TRACKING
  // ============================================================================

  /**
   * TABLE: analytics_events
   *
   * DESCRIPTION:
   * Platform event tracking for analytics and funnel optimization.
   *
   * INDEXES:
   *   - by_user_id: Get events for user
   *   - by_event_type: Filter by event type
   *   - by_event_category: Filter by category
   *   - by_timestamp: Chronological ordering
   *   - by_session_id: Group events by session
   */
  analytics_events: defineTable({
    user_id: v.optional(v.id("users")),
    event_type: v.string(),
    event_category: v.string(),
    event_data: v.optional(
      v.object({
        booking_id: v.optional(v.id("bookings")),
        shop_id: v.optional(v.id("shops")),
        service_id: v.optional(v.id("services")),
        screen_name: v.optional(v.string()),
        custom_properties: v.optional(v.any()),
      })
    ),
    timestamp: v.float64(),
    session_id: v.optional(v.string()),
  })
    .index("by_user_id", ["user_id"])
    .index("by_event_type", ["event_type"])
    .index("by_event_category", ["event_category"])
    .index("by_timestamp", ["timestamp"])
    .index("by_session_id", ["session_id"]),

  /**
   * TABLE: conversion_funnels
   *
   * DESCRIPTION:
   * Tracks user progression through conversion funnels.
   *
   * INDEXES:
   *   - by_user_id: Get user's funnels
   *   - by_funnel_type: Filter by funnel type
   *   - by_booking_id: Get funnel for booking
   *   - by_stage: Filter by stage
   *   - by_completed: Get completed/incomplete funnels
   *   - by_entered_at: Chronological ordering
   */
  conversion_funnels: defineTable({
    user_id: v.id("users"),
    funnel_type: v.string(),
    stage: v.string(),
    booking_id: v.optional(v.id("bookings")),
    entered_at: v.float64(),
    exited_at: v.optional(v.float64()),
    completed: v.boolean(),
    drop_off_reason: v.optional(v.string()),
  })
    .index("by_user_id", ["user_id"])
    .index("by_funnel_type", ["funnel_type"])
    .index("by_booking_id", ["booking_id"])
    .index("by_stage", ["stage"])
    .index("by_completed", ["completed"])
    .index("by_entered_at", ["entered_at"]),

  // ============================================================================
  // FOLLOW-UPS & MAINTENANCE
  // ============================================================================

  /**
   * TABLE: follow_ups
   *
   * DESCRIPTION:
   * Maintenance reminders and follow-up notifications for users.
   *
   * INDEXES:
   *   - by_user_id: Get reminders for user
   *   - by_vin: Get reminders for vehicle
   *   - by_status_and_scheduled: Get pending reminders to send
   *   - by_booking_id: Get reminders related to booking
   */
  follow_ups: defineTable({
    user_id: v.id("users"),
    vin: v.string(),
    booking_id: v.optional(v.id("bookings")),
    service_id: v.id("services"),
    follow_up_type: v.string(),
    scheduled_for: v.float64(),
    status: v.string(),
    message: v.string(),
    created_at: v.float64(),
    sent_at: v.optional(v.float64()),
  })
    .index("by_user_id", ["user_id"])
    .index("by_vin", ["vin"])
    .index("by_status_and_scheduled", ["status", "scheduled_for"])
    .index("by_booking_id", ["booking_id"]),

  // ============================================================================
  // CDN & SHOP PORTFOLIO
  // ============================================================================

  /**
   * TABLE: cdn_assets
   *
   * DESCRIPTION:
   * Stores CDN/content URLs for reusable media (portfolio images, logos, etc.).
   */
  cdn_assets: defineTable({
    url: v.string(),
    type: v.optional(v.string()),
    caption: v.optional(v.string()),
  }),

  /**
   * TABLE: shop_portfolio
   *
   * DESCRIPTION:
   * Links shops to CDN assets for portfolio/gallery display.
   */
  shop_portfolio: defineTable({
    shop_id: v.id("shops"),
    content_id: v.id("cdn_assets"),
    display_order: v.float64(),
  }).index("by_shop_id", ["shop_id"]),

  /**
   * TABLE: shop_services
   *
   * DESCRIPTION:
   * Junction table mapping services offered at specific shops.
   *
   * INDEXES:
   *   - by_shop_id: Get all services offered at a shop
   *   - by_service_id: Get all shops offering a service
   *   - by_shop_and_service: Combined lookup
   */
  shop_services: defineTable({
    is_offered: v.boolean(),
    service_id: v.id("services"),
    shop_id: v.id("shops"),
  })
    .index("by_shop_id", ["shop_id"])
    .index("by_service_id", ["service_id"])
    .index("by_shop_and_service", ["shop_id", "service_id"]),

  /**
   * TABLE: service_options
   *
   * DESCRIPTION:
   * Defines optional variations for services (e.g., synthetic vs regular oil).
   */
  service_options: defineTable({
    display_order: v.float64(),
    labor_hours: v.float64(),
    option_label: v.string(),
    option_type: v.string(),
    parts_cost_high: v.float64(),
    parts_cost_low: v.float64(),
    service_id: v.id("services"),
    state_fee: v.optional(v.float64()),
  }).index("by_service_id", ["service_id"]),

  /**
   * TABLE: service_categories
   *
   * DESCRIPTION:
   * Groups services into logical categories for UI organization.
   */
  service_categories: defineTable({
    display_order: v.float64(),
    icon_name: v.string(),
    name: v.string(),
  }),

  /**
   * TABLE: onboarding_questions_answers
   *
   * DESCRIPTION:
   * Unified table per user for onboarding Q&A. One row per user.
   */
  onboarding_questions_answers: defineTable({
    user_id: v.id("users"),
    questions_and_answers: v.array(
      v.object({
        question: v.string(),
        answer: v.string(),
      }),
    ),
    user_intentions: v.optional(
      v.object({
        question: v.string(),
        intentions: v.array(v.string()),
      }),
    ),
    car_knowledge_level: v.optional(v.float64()),
    last_updated: v.float64(),
  }).index("by_user_id", ["user_id"]),

  // ============================================================================
  // SMARTCAR & VEHICLE DATA
  // ============================================================================

  /**
   * TABLE: smartcar_connections
   * Stores Smartcar OAuth tokens separately from vehicle_owners.
   * FK → vehicle_owners(vehicleOwnerId)
   */
  smartcar_connections: defineTable({
    vehicleOwnerId: v.id("vehicle_owners"),
    smartcarVehicleId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.float64(),
    connectedAt: v.float64(),
    lastSyncedAt: v.optional(v.float64()),
    permissions: v.optional(v.array(v.string())),
    status: v.string(),
  })
    .index("by_vehicle_owner", ["vehicleOwnerId"])
    .index("by_smartcar_vehicle_id", ["smartcarVehicleId"])
    .index("by_status", ["status"]),

  /**
   * TABLE: user_settings_preferences
   *
   * DESCRIPTION:
   * Stores user-specific app preferences and settings.
   */
  user_settings_preferences: defineTable({
    user_id: v.id("users"),
    notification_preferences: v.object({
      offers: v.boolean(),
      rewards: v.boolean(),
      pass: v.boolean(),
      bookings: v.boolean(),
      other: v.boolean(),
    }),
    language: v.optional(v.string()),
    units: v.optional(v.string()),
    last_updated: v.float64(),
  }).index("by_user_id", ["user_id"]),

  /**
   * TABLE: vehicle_health_snapshots
   * Stores historical data points from Smartcar webhooks.
   * FK → vehicle_owners(vehicleOwnerId)
   */
  vehicle_health_snapshots: defineTable({
    vehicleOwnerId: v.id("vehicle_owners"),
    snapshotType: v.string(),
    data: v.any(),
    source: v.string(),
    recordedAt: v.float64(),
    createdAt: v.float64(),
  })
    .index("by_vehicle_owner", ["vehicleOwnerId"])
    .index("by_vehicle_and_type", ["vehicleOwnerId", "snapshotType"]),

  /**
   * TABLE: client_logs
   * Stores client-side logs forwarded from console.
   */
  client_logs: defineTable({
    level: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.float64(),
    user_id: v.optional(v.id("users")),
    session_id: v.optional(v.string()),
  })
    .index("by_level", ["level"])
    .index("by_timestamp", ["timestamp"])
    .index("by_user_id", ["user_id"]),

  // ============================================================================
  // OTOPAIR REWARDS PROGRAM
  // ============================================================================

  /**
   * TABLE: user_reward_wallets
   * One row per user. Tracks Ownership Credit balance and redemption preference.
   */
  user_reward_wallets: defineTable({
    user_id: v.id("users"),
    balance: v.float64(),
    auto_apply_to_booking: v.boolean(),
    miles_safe: v.optional(v.float64()),
    created_at: v.float64(),
    updated_at: v.float64(),
  }).index("by_user_id", ["user_id"]),

  /**
   * TABLE: ownership_credit_transactions
   * Audit trail for credit earnings and redemptions.
   */
  ownership_credit_transactions: defineTable({
    user_id: v.id("users"),
    amount: v.float64(),
    type: v.string(),
    description: v.string(),
    reference_id: v.optional(v.string()),
    expires_at: v.optional(v.float64()),
    created_at: v.float64(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_user_id_created_at", ["user_id", "created_at"]),

  /**
   * TABLE: reward_deals
   * Suggested deals with credit rewards.
   */
  reward_deals: defineTable({
    title: v.string(),
    description: v.string(),
    credit_amount: v.float64(),
    price: v.float64(),
    is_special: v.boolean(),
    service_id: v.optional(v.id("services")),
    display_order: v.float64(),
    created_at: v.float64(),
  }).index("by_display_order", ["display_order"]),

  /**
   * TABLE: user_contribution_claims
   * Tracks which contribution rewards user has claimed.
   */
  user_contribution_claims: defineTable({
    user_id: v.id("users"),
    action_type: v.string(),
    reference_id: v.optional(v.string()),
    created_at: v.float64(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_user_action", ["user_id", "action_type"]),

  /**
   * TABLE: vehicle_tiers
   * Per-vehicle tier status based on 12-month spend.
   */
  vehicle_tiers: defineTable({
    vin: v.string(),
    user_id: v.id("users"),
    tier: v.string(),
    spend_12mo: v.float64(),
    created_at: v.float64(),
    updated_at: v.float64(),
  })
    .index("by_vin_user", ["vin", "user_id"])
    .index("by_user_id", ["user_id"]),

  // ============================================================================
  // VEHICLE MAINTENANCE HISTORY
  // ============================================================================

  /**
   * TABLE: odometer_history
   * Logs odometer readings over time for trip stats.
   */
  odometer_history: defineTable({
    vehicleOwnerId: v.id("vehicle_owners"),
    distance: v.float64(),
    unit: v.string(),
    recordedAt: v.float64(),
  })
    .index("by_vehicle_and_date", ["vehicleOwnerId", "recordedAt"]),

  /**
   * TABLE: maintenance_records
   * User-provided maintenance data for items Smartcar doesn't cover.
   */
  maintenance_records: defineTable({
    vehicleOwnerId: v.id("vehicle_owners"),
    type: v.string(),
    lastServiceDate: v.optional(v.float64()),
    lastServiceMileage: v.optional(v.float64()),
    customInputs: v.optional(v.any()),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_vehicle_owner", ["vehicleOwnerId"])
    .index("by_vehicle_and_type", ["vehicleOwnerId", "type"]),

  // ============================================================================
  // QUALITY ASSURANCE & VARIANCE TRACKING
  // ============================================================================

  /**
   * TABLE: job_actuals
   *
   * DESCRIPTION:
   * Records actual job performance data after service completion.
   * Compares estimated vs actual labor/parts costs for continuous improvement.
   * Single record per completed booking.
   *
   * INDEXES:
   *   - by_booking_id: Get actuals for specific booking
   *   - by_mechanic_id: Get all jobs completed by a mechanic
   *   - by_created_at: Chronological ordering
   */
  job_actuals: defineTable({
    actual_labor_minutes: v.float64(),
    actual_parts_cost: v.float64(),
    booking_id: v.id("bookings"),
    started_at: v.float64(),
    completed_at_ms: v.optional(v.float64()),
    logged_at_ms: v.optional(v.float64()),
    created_at: v.float64(),
    updated_at: v.float64(),
    difficulty_rating: v.float64(),
    mechanic_id: v.id("mechanics"),
    parts_used: v.array(
      v.object({
        cost: v.float64(),
        oem_number: v.string(),
        part_name: v.string(),
      })
    ),
    technician_notes: v.string(),
  })
    .index("by_booking_id", ["booking_id"])
    .index("by_mechanic_id", ["mechanic_id"])
    .index("by_created_at", ["created_at"]),

  /**
   * TABLE: spec_variances
   *
   * DESCRIPTION:
   * Tracks differences between predicted and actual job specifications.
   *
   * INDEXES:
   *   - by_engine_id: Get variances for engine
   *   - by_service_id: Get variances for service
   *   - by_flagged: Get variances flagged for review
   *   - by_variance: Sort by variance percentage
   *   - by_job_actual_id: Get variance for specific job
   *   - by_created_at: Chronological ordering
   */
  spec_variances: defineTable({
    engine_id: v.id("engines"),
    service_id: v.id("services"),
    job_actual_id: v.id("job_actuals"),
    predicted_labor_hours: v.float64(),
    actual_labor_hours: v.float64(),
    predicted_parts_cost: v.float64(),
    actual_parts_cost: v.float64(),
    variance_percentage: v.float64(),
    flagged_for_review: v.boolean(),
    reviewed_at: v.optional(v.float64()),
    notes: v.optional(v.string()),
    created_at: v.float64(),
  })
    .index("by_engine_id", ["engine_id"])
    .index("by_service_id", ["service_id"])
    .index("by_flagged", ["flagged_for_review"])
    .index("by_variance", ["variance_percentage"])
    .index("by_job_actual_id", ["job_actual_id"])
    .index("by_created_at", ["created_at"]),

  /**
   * TABLE: spec_confirmations
   *
   * DESCRIPTION:
   * User confirmations of vehicle spec accuracy after service.
   *
   * INDEXES:
   *   - by_engine_id: Get confirmations for engine
   *   - by_user_id: Get confirmations from user
   *   - by_booking_id: Get confirmation for booking
   *   - by_confirmed_at: Chronological ordering
   */
  spec_confirmations: defineTable({
    user_id: v.id("users"),
    engine_id: v.id("engines"),
    service_id: v.id("services"),
    booking_id: v.id("bookings"),
    confirmed_accurate: v.boolean(),
    feedback: v.optional(v.string()),
    confirmed_at: v.float64(),
  })
    .index("by_engine_id", ["engine_id"])
    .index("by_user_id", ["user_id"])
    .index("by_booking_id", ["booking_id"])
    .index("by_confirmed_at", ["confirmed_at"]),
});
