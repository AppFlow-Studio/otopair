/**
 * schema.ts - Convex Database Schema
 *
 * DESCRIPTION:
 * Central schema definition for the entire Convex database. This file defines
 * all tables, their fields, types, relationships, and indexes. It serves as the
 * single source of truth for the database structure.
 *
 * ARCHITECTURE:
 * - Core entities: users, vehicles, shops, mechanics, services
 * - Booking flow: bookings, time_slots, payments (with status history)
 * - Vehicle specs: vehicles, vehicle_owners, engines, trims, models, makes
 * - AI/enrichment: ai_conversations, ai_messages, ai_enrichment_logs, manual_review_queue
 * - Analytics: analytics_events, conversion_funnels
 * - Reviews & feedback: reviews, service_insights, spec_confirmations, spec_variances
 * - Maintenance: follow_ups, booking_status_history, payment_status_history
 *
 * OWNER: Backend Team
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
   *   - service_ids: Array of service IDs (id("services")) for this appointment
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
   *   - live_stage: When status is "in_progress", current Live Tracker stage: "booking_confirmed" | "service_in_progress" | "vehicle_ready"
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
    live_stage: v.optional(v.string()), // "booking_confirmed" | "service_in_progress" | "vehicle_ready" when status is in_progress
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
    vin: v.string(), // canonical VIN reference
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
   * TABLE: engines
   *
   * DESCRIPTION:
   * Stores engine specifications for specific vehicle trims.
   * Links trims to their precise engine characteristics.
   *
   * FIELDS:
   *   - trim_id: References the vehicle trim
   *   - engine_code: OEM engine code/designation (e.g., "5SFE")
   *   - cylinders: Number of cylinders (e.g., 4, 6, 8)
   *   - displacement_liters: Engine displacement (e.g., "3.5L")
   *   - fuel_type: Type of fuel (e.g., "gasoline", "diesel", "hybrid", "electric")
   *
   * RELATIONSHIPS:
   *   FK → trims(trim_id)
   *   Has-many → vehicles (via engine_id)
   *   Has-many → service_insights (via engine_id)
   *   Has-many → service_vehicle_specs (via engine_id)
   *   Has-many → ai_enrichment_logs (via engine_id)
   *   Has-many → spec_variances (via engine_id)
   */
  engines: defineTable({
    cylinders: v.float64(),
    displacement_liters: v.string(),
    engine_code: v.string(),
    fuel_type: v.string(),
    trim_id: v.id("trims"),
    timing_type: v.optional(v.string()),    // "belt" | "chain" | "gear"
  }).index("by_trim_id", ["trim_id"]),

  /**
   * TABLE: vehicle_specs
   *
   * DESCRIPTION:
   * Engine-level OEM part numbers for job actuals and suggested parts.
   * Supports verified pricing and comparison engine for MVP services.
   * Fluids/intervals live in engine_specs; tire/wipers in trim_specs; transmission deferred.
   *
   * FIELDS:
   *   - engine_id: References the engine
   *   - oil_viscocity: Oil viscosity (e.g., "0W-20")
   *   - oil_capacity_qts: Oil capacity as string (e.g., "4.8")
   *   - oil_filter_oem: OEM oil filter part number
   *   - oil_drain_plug_gasket_oem: OEM drain plug gasket (replaced at every oil change)
   *   - front_brake_pad_oem, rear_brake_pad_oem: Brake pad part numbers
   *   - front_brake_rotor_oem, rear_brake_rotor_oem: Brake rotor part numbers
   *   - parking_brake_type: Type of parking brake
   *   - battery_group, battery_cca: Battery specs
   *   - engine_air_filter_oem, cabin_air_filter_oem: Air filter part numbers
   *   - spark_plug_oem, spark_plug_quantity, spark_plug_gap_mm: Spark plug specs
   *   - serpentine_belt_oem: Serpentine belt part number
   *
   * RELATIONSHIPS:
   *   FK → engines(engine_id)
   */
  vehicle_specs: defineTable({
    engine_id: v.id("engines"),
    oil_viscocity: v.optional(v.string()),
    oil_capacity_qts: v.optional(v.string()),
    oil_filter_oem: v.optional(v.string()),
    oil_drain_plug_gasket_oem: v.optional(v.string()),
    front_brake_pad_oem: v.optional(v.string()),
    rear_brake_pad_oem: v.optional(v.string()),
    front_brake_rotor_oem: v.optional(v.string()),
    rear_brake_rotor_oem: v.optional(v.string()),
    parking_brake_type: v.optional(v.string()),
    battery_group: v.optional(v.string()),
    battery_cca: v.optional(v.float64()),
    engine_air_filter_oem: v.optional(v.string()),
    cabin_air_filter_oem: v.optional(v.string()),
    spark_plug_oem: v.optional(v.string()),
    spark_plug_quantity: v.optional(v.float64()),
    spark_plug_gap_mm: v.optional(v.float64()),
    serpentine_belt_oem: v.optional(v.string()),
  }).index("by_engine_id", ["engine_id"]),

  /**
   * TABLE: job_actuals
   *
   * DESCRIPTION:
   * Records actual job performance data after service completion.
   * Compares estimated vs actual labor/parts costs for continuous improvement.
   * Single record per completed booking.
   *
   * FIELDS:
   *   - booking_id: References the booking this job is for
   *   - mechanic_id: The mechanic who performed the work
   *   - started_at: Unix timestamp when work started
   *   - actual_labor_minutes: Actual time spent on job
   *   - completed_at_ms: Unix timestamp when work finished
   *   - actual_parts_cost: Actual parts cost incurred
   *   - parts_used: Array of parts with cost, part name, OEM number
   *   - difficulty_rating: Mechanic's assessment of job difficulty (1-5)
   *   - technician_notes: Notes from mechanic about work performed
   *   - created_at: When this record was created
   *   - updated_at: Last modification timestamp
   *   - logged_at_ms: Unix timestamp when job was logged
   *
   * INDEXES:
   *   - by_booking_id: Get actuals for specific booking
   *   - by_mechanic_id: Get all jobs completed by a mechanic
   *   - by_created_at: Chronological ordering
   *
   * RELATIONSHIPS:
   *   FK → bookings(booking_id)
   *   FK → mechanics(mechanic_id)
   *   Has-many → spec_variances (via job_actual_id)
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
      }),
    ),
    technician_notes: v.string(),
  })
    .index("by_booking_id", ["booking_id"])
    .index("by_mechanic_id", ["mechanic_id"])
    .index("by_created_at", ["created_at"]),

  /**
   * TABLE: makes
   *
   * DESCRIPTION:
   * Stores vehicle manufacturer (make) information.
   * Top-level in vehicle hierarchy: Makes → Models → Trims → Engines
   *
   * FIELDS:
   *   - name: Manufacturer name (e.g., "Toyota", "Honda")
   *   - logo: Reference to cdn_assets (content) for manufacturer logo image
   *
   * RELATIONSHIPS:
   *   Has-many → models (via make_id)
   *   FK → cdn_assets(logo) for logo URL
   */
  makes: defineTable({
    logo: v.optional(v.id("cdn_assets")),
    logo_url: v.optional(v.string()),
    name: v.string(),
  }).index("by_name", ["name"]),

  /**
   * TABLE: mechanics
   *
   * DESCRIPTION:
   * Stores individual mechanic/technician information.
   * Each mechanic is employed at a specific shop.
   *
   * FIELDS:
   *   - shop_id: The shop this mechanic works at
   *   - first_name: Mechanic's first name
   *   - last_name: Mechanic's last name
   *   - title: Optional job title (e.g. "Master Mechanic"); when empty, UI shows shop name under mechanic name
   *   - photo: Optional reference to cdn_assets for profile/avatar image
   *   - is_active: Whether mechanic is currently available
   *   - rating: Average rating from customer reviews (0-5)
   *   - review_count: Total number of reviews received
   *
   * INDEXES:
   *   - by_shop_id: Get all mechanics at a shop
   *   - by_is_active: Filter for active mechanics
   *
   * RELATIONSHIPS:
   *   FK → shops(shop_id)
   *   FK → cdn_assets(photo) for profile image URL
   *   Has-many → bookings (via mechanic_id)
   *   Has-many → job_actuals (via mechanic_id)
   *   Has-many → time_slots (via mechanic_id)
   *   Has-many → reviews (via mechanic_id)
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
   * TABLE: models
   *
   * DESCRIPTION:
   * Stores vehicle model information (e.g., Camry, Accord).
   * Second level in vehicle hierarchy: Makes → Models → Trims → Engines
   *
   * FIELDS:
   *   - make_id: References the vehicle make
   *   - name: Model name (e.g., "Camry", "Accord")
   *
   * RELATIONSHIPS:
   *   FK → makes(make_id)
   *   Has-many → trims (via model_id)
   */
  models: defineTable({
    make_id: v.id("makes"),
    name: v.string(),
  }).index("by_make_id", ["make_id"]),

  /**
   * TABLE: reviews
   *
   * DESCRIPTION:
   * Stores customer reviews for services and shops.
   * Users leave ratings and comments after booking completion.
   *
   * FIELDS:
   *   - booking_id: The booking being reviewed
   *   - user_id: The user who left the review
   *   - shop_id: The shop being reviewed
   *   - mechanic_id: (optional) Specific mechanic being reviewed
   *   - rating: Star rating (typically 1-5)
   *   - comment: Review text from user
   *   - created_at: Unix timestamp when review was posted
   *
   * INDEXES:
   *   - by_booking_id: Get review for specific booking
   *   - by_shop_id: Get all reviews for a shop
   *   - by_mechanic_id: Get all reviews for a mechanic
   *   - by_user_id: Get all reviews from a user
   *   - by_rating: Filter reviews by rating
   *
   * RELATIONSHIPS:
   *   FK → bookings(booking_id)
   *   FK → users(user_id)
   *   FK → shops(shop_id)
   *   FK → mechanics(mechanic_id)
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

  /**
   * TABLE: service_categories
   *
   * DESCRIPTION:
   * Groups services into logical categories for UI organization.
   * Examples: Maintenance, Repairs, Inspections, Upgrades
   *
   * FIELDS:
   *   - name: Category name (e.g., "Oil Changes")
   *   - icon_name: Icon identifier for UI display
   *   - display_order: Order to show categories
   *
   * RELATIONSHIPS:
   *   Has-many → services (via service_category_id)
   */
  service_categories: defineTable({
    display_order: v.float64(),
    icon_name: v.string(),
    name: v.string(),
  }),

  /**
   * TABLE: service_insights
   *
   * DESCRIPTION:
   * Aggregated performance data for service+engine combinations.
   * Calculated from job_actuals to show historical averages and confidence.
   * Used to improve cost/time estimates over time.
   *
   * FIELDS:
   *   - engine_id: The engine this data applies to
   *   - service_id: The service being performed
   *   - completed_jobs_count: How many jobs completed for this combo
   *   - estimated_labor_hours: Estimated time based on service definition
   *   - avg_actual_labor_hours: Actual average from completed jobs
   *   - labor_variance: Difference between estimated and actual
   *   - avg_actual_parts_cost: Average parts cost from completed jobs
   *   - confidence_level: Confidence in these estimates (0-1 scale)
   *
   * INDEXES:
   *   - by_engine_id: Get insights for specific engine
   *   - by_service_id: Get insights for specific service
   *   - by_engine_and_service: Combined lookup
   *
   * RELATIONSHIPS:
   *   FK → engines(engine_id)
   *   FK → services(service_id)
   */
  service_insights: defineTable({
    avg_actual_labor_hours: v.float64(),
    avg_actual_parts_cost: v.float64(),
    completed_jobs_count: v.float64(),
    confidence_level: v.float64(),
    engine_id: v.id("engines"),
    estimated_labor_hours: v.float64(),
    labor_variance: v.float64(),
    service_id: v.id("services"),
  })
    .index("by_engine_id", ["engine_id"])
    .index("by_service_id", ["service_id"])
    .index("by_engine_and_service", ["engine_id", "service_id"]),

  /**
   * TABLE: service_options
   *
   * DESCRIPTION:
   * Defines optional variations for services (e.g., synthetic vs regular oil).
   * Allows users to customize services with different parts/labor.
   *
   * FIELDS:
   *   - service_id: References the service
   *   - option_type: Type of option (e.g., "oil_type", "filter_brand")
   *   - option_label: Display name (e.g., "Synthetic Oil")
   *   - labor_hours: Additional labor time for this option
   *   - parts_cost_low: Minimum parts cost for option
   *   - parts_cost_high: Maximum parts cost for option
   *   - state_fee: (optional) State/local fee for this option
   *   - display_order: Order to show options
   *
   * RELATIONSHIPS:
   *   FK → services(service_id)
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
   * TABLE: service_vehicle_specs
   *
   * DESCRIPTION:
   * Pre-calculated service specifications for specific engine+service combinations.
   * Provides quick lookup of labor/parts estimates without complex calculations.
   *
   * FIELDS:
   *   - engine_id: The engine this spec applies to
   *   - service_id: The service being performed
   *   - labor_hours: Estimated labor time
   *   - parts_cost_low: Low estimate for parts cost
   *   - parts_cost_high: High estimate for parts cost
   *   - confidence_score: Confidence in these specs (0-1)
   *   - tech_notes: Technical notes for this combination
   *
   * INDEXES:
   *   - by_engine_id: Lookup by engine
   *   - by_service_id: Lookup by service
   *   - by_engine_and_service: Combined lookup
   *
   * RELATIONSHIPS:
   *   FK → engines(engine_id)
   *   FK → services(service_id)
   */
  service_vehicle_specs: defineTable({
    confidence_score: v.float64(),
    engine_id: v.id("engines"),
    labor_hours: v.float64(),
    parts_cost_high: v.float64(),
    parts_cost_low: v.float64(),
    service_id: v.id("services"),
    tech_notes: v.string(),
    // OEM baselines (Maintenance Intelligence)
    oem_interval_miles: v.optional(v.float64()),
    oem_interval_months: v.optional(v.float64()),
    oem_interval_note: v.optional(v.string()),
    // Vehicle-specific parts: JSON array [{name, oem_part_num, cost_estimate}]
    parts_required: v.optional(v.string()),
    estimated_labor_hours: v.optional(v.float64()),
    labor_notes: v.optional(v.string()),
    // Applicability gate (e.g. timing belt on chain engines)
    is_applicable: v.boolean(),
    exclusion_reason: v.optional(v.string()),
    // Data provenance
    data_source: v.optional(v.string()),         // "ai_enrichment" | "manual" | "actuals"
    last_enriched_at: v.optional(v.float64()),
  })
    .index("by_engine_id", ["engine_id"])
    .index("by_service_id", ["service_id"])
    .index("by_engine_and_service", ["engine_id", "service_id"]),

  /**
   * TABLE: services
   *
   * DESCRIPTION:
   * Master list of all services offered on the platform.
   * Examples: Oil Change, Tire Rotation, Brake Inspection
   * Price is not stored; computed at booking: (labor_time × shop labor_rate) + parts + %taxes + %service_fees.
   *
   * FIELDS:
   *   - name: Service name
   *   - description: Detailed description of what service includes
   *   - slug: URL-friendly identifier
   *   - service_category_id: Category this service belongs to
   *   - default_labor_hours: Default estimated labor time (used in price formula)
   *   - is_labor_only: Whether service has no parts cost
   *   - has_options: Whether users can customize this service
   *   - display_order: Order to show in UI
   *
   * RELATIONSHIPS:
   *   FK → service_categories(service_category_id)
   *   Has-many → bookings (via service_id)
   *   Has-many → service_options (via service_id)
   *   Has-many → service_insights (via service_id)
   *   Has-many → service_vehicle_specs (via service_id)
   *   Has-many → shop_services (via service_id)
   */
  services: defineTable({
    default_labor_hours: v.float64(),
    description: v.string(),
    display_order: v.float64(),
    has_options: v.boolean(),
    is_labor_only: v.boolean(),
    name: v.string(),
    service_category_id: v.id("service_categories"),
    slug: v.string(),
  }),

  /**
   * TABLE: shop_services
   *
   * DESCRIPTION:
   * Junction table mapping services offered at specific shops.
   * Tracks which services each shop provides.
   *
   * FIELDS:
   *   - shop_id: References the shop
   *   - service_id: References the service
   *   - is_offered: Whether this shop currently offers this service
   *
   * INDEXES:
   *   - by_shop_id: Get all services offered at a shop
   *   - by_service_id: Get all shops offering a service
   *   - by_shop_and_service: Combined lookup
   *
   * RELATIONSHIPS:
   *   FK → shops(shop_id)
   *   FK → services(service_id)
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
   * TABLE: shops
   *
   * DESCRIPTION:
   * Stores automotive service shops/repair facilities.
   * Core entity in the platform representing businesses offering services.
   *
   * FIELDS:
   *   - name: Shop name
   *   - slug: URL-friendly shop identifier
   *   - address: Street address
   *   - city: City name
   *   - state: State abbreviation
   *   - zip: Postal code
   *   - lat: Latitude for map display
   *   - lng: Longitude for map display
   *   - phone: Contact phone number
   *   - labor_rate: Hourly labor rate in dollars
   *   - rating: Average shop rating (0-5)
   *   - review_count: Total number of reviews
   *   - is_active: Whether shop is currently accepting bookings
   *   - is_verified: Whether shop is verified by platform
   *
   * RELATIONSHIPS:
   *   Has-many → bookings (via shop_id)
   *   Has-many → mechanics (via shop_id)
   *   Has-many → time_slots (via shop_id)
   *   Has-many → shops_hours (via shop_id)
   *   Has-many → shop_services (via shop_id)
   *   Has-many → reviews (via shop_id)
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
   * TABLE: cdn_assets
   *
   * DESCRIPTION:
   * Stores CDN/content URLs for reusable media (portfolio images, logos, etc.).
   * Portfolio and other features reference assets by id to avoid duplicating URLs.
   *
   * FIELDS:
   *   - url: Full URL to the asset (e.g. CDN or storage URL)
   *   - type: Optional asset type (e.g. "image", "video")
   *   - caption: Optional caption for display
   *
   * RELATIONSHIPS:
   *   Referenced by shop_portfolio (content_id)
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
   * Each row is one portfolio item (image) for a shop; order by display_order.
   *
   * FIELDS:
   *   - shop_id: The shop this item belongs to
   *   - content_id: Reference to cdn_assets (the image URL)
   *   - display_order: Order to show in gallery (lower first)
   *
   * RELATIONSHIPS:
   *   FK → shops(shop_id)
   *   FK → cdn_assets(content_id)
   */
  shop_portfolio: defineTable({
    shop_id: v.id("shops"),
    content_id: v.id("cdn_assets"),
    display_order: v.float64(),
  }).index("by_shop_id", ["shop_id"]),

  /**
   * TABLE: shops_hours
   *
   * DESCRIPTION:
   * Stores operating hours for shops (by day of week).
   * One record per shop per day of week (7 records per shop max).
   *
   * FIELDS:
   *   - shop_id: References the shop
   *   - day_name: Day name (e.g., "Monday", "Tuesday")
   *   - day_of_week: Numeric day (0=Sunday, 1=Monday, etc.)
   *   - is_closed: Whether shop is closed this day
   *   - open_time: Opening time (e.g., "09:00")
   *   - close_time: Closing time (e.g., "17:00")
   *
   * INDEXES:
   *   - by_shop_id: Get all operating hours for a shop
   *
   * RELATIONSHIPS:
   *   FK → shops(shop_id)
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
   * TABLE: time_slots
   *
   * DESCRIPTION:
   * Available appointment time slots at shops. Each mechanic is treated as an
   * individual bay with their own calendar: the same (shop, date, time) can
   * have multiple rows (one per mechanic). Slots are marked unavailable when
   * a booking is confirmed for that time_slot_id.
   *
   * FIELDS:
   *   - shop_id: References the shop
   *   - mechanic_id: (optional) Mechanic/bay this slot belongs to. When set,
   *     this slot is that mechanic's availability; when omitted, slot is
   *     shop-level (any mechanic). Seed data creates slots per mechanic.
   *   - date: Date of slot (YYYY-MM-DD)
   *   - start_time: Start time (HH:MM)
   *   - end_time: End time (HH:MM)
   *   - is_available: Whether slot is still bookable
   *
   * INDEXES:
   *   - by_shop_id: Get slots for a shop
   *   - by_mechanic_id: Get slots for a mechanic (per-bay calendar)
   *   - by_shop_and_date: Get slots for shop on specific date
   *   - by_availability: Filter available slots by date
   *
   * RELATIONSHIPS:
   *   FK → shops(shop_id)
   *   FK → mechanics(mechanic_id)
   *   Becomes-reference → bookings (via time_slot_id)
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
   * TABLE: trims
   *
   * DESCRIPTION:
   * Stores vehicle trim information (e.g., Camry LE, Camry XLE).
   * Third level in vehicle hierarchy: Makes → Models → Trims → Engines
   *
   * FIELDS:
   *   - model_id: References the vehicle model
   *   - name: Trim name (e.g., "LE", "XLE", "Limited")
   *   - year_start: First year this trim was produced
   *   - year_end: Last year this trim was produced
   *
   * RELATIONSHIPS:
   *   FK → models(model_id)
   *   Has-many → engines (via trim_id)
   *   Has-many → vehicles (via trim_id)
   */
  trims: defineTable({
    model_id: v.id("models"),
    name: v.string(),
    year_end: v.float64(),
    year_start: v.float64(),
    steering_type: v.optional(v.string()),  // "hydraulic" | "electric"
  }).index("by_model_id", ["model_id"]),

  /**
   * TABLE: onboarding_questions_answers
   *
   * DESCRIPTION:
   * Unified table per user for onboarding Q&A (data intelligence). One row per user;
   * questions_and_answers is an array of { question, answer }; last_updated on every save.
   *
   * FIELDS:
   *   - user_id: References the user
   *   - questions_and_answers: Array of { question: string, answer: string }
   *   - user_intentions: Optional { question, intentions } for "What do you want to use Otopair for?"
   *   - car_knowledge_level: Optional self-reported auto knowledge (1–3 scale from experience step)
   *   - last_updated: Unix timestamp of last update
   *
   * INDEXES:
   *   - by_user_id: Get Q&A for a user (unique per user)
   *
   * RELATIONSHIPS:
   *   FK → users(user_id)
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

  /**
   * TABLE: vehicles
   *
   * DESCRIPTION:
   * Canonical vehicle catalog - one record per VIN.
   * Vehicle ownership is tracked in vehicle_owners table.
   * Links to vehicle specs (trim, engine, year, transmission, chassis).
   *
   * FIELDS:
   *   - vin: Vehicle Identification Number (uppercase, normalized, UNIQUE)
   *   - trim_id: References the vehicle trim
   *   - engine_id: References the engine specs
   *   - transmission_id: (optional) References the chosen transmission variant for this VIN
   *   - chassis_id: (optional) References the chosen chassis variant for this VIN
   *   - year: Model year of vehicle
   *   - metadata: Flexible field for additional vehicle data
   *   - created_at: Unix timestamp when vehicle was added
   *   - updated_at: Unix timestamp of last modification
   *
   * INDEXES:
   *   - by_vin: Primary lookup by VIN (unique)
   *   - by_engine_id: Find all vehicles with specific engine
   *   - by_trim_id: Find all vehicles with specific trim
   *   - by_transmission: Find all vehicles with specific transmission
   *   - by_chassis: Find all vehicles with specific chassis variant
   *
   * RELATIONSHIPS:
   *   FK → trims(trim_id)
   *   FK → engines(engine_id)
   *   FK → transmissions(transmission_id) optional
   *   FK → chassis_variants(chassis_id) optional
   *   Has-many → vehicle_owners (via vin)
   *   Has-many → bookings (via vin)
   *   Has-many → follow_ups (via vin)
   */
  vehicles: defineTable({
    vin: v.string(), // canonical unique identifier
    trim_id: v.optional(v.id("trims")),
    engine_id: v.optional(v.id("engines")),
    transmission_id: v.optional(v.id("transmissions")),
    chassis_id: v.optional(v.id("chassis_variants")),
    year: v.optional(v.float64()),
    metadata: v.optional(v.any()),
    image_url: v.optional(v.string()),
    created_at: v.float64(),
    updated_at: v.float64(),
  })
    .index("by_vin", ["vin"])
    .index("by_engine_id", ["engine_id"])
    .index("by_trim_id", ["trim_id"])
    .index("by_transmission", ["transmission_id"])
    .index("by_chassis", ["chassis_id"]),

  /**
   * TABLE: vehicle_owners
   *
   * DESCRIPTION:
   * Tracks ownership relationships between users and vehicles.
   * One record per user-vehicle pair. Supports vehicle removal (soft delete).
   *
   * FIELDS:
   *   - vin: Canonical VIN reference
   *   - user_id: User who owns this vehicle
   *   - status: "active" (currently owned) or "removed" (deleted by user)
   *   - nickname: (optional) User's personal name for vehicle (e.g., "My Daily")
   *   - is_primary: (optional) Whether this is user's primary vehicle
   *   - mileage: (optional) Current vehicle mileage
   *   - added_at: Unix timestamp when vehicle was added
   *   - removed_at: (optional) Unix timestamp when removed
   *   - smartcarVehicleId: (optional) Smartcar's unique vehicle ID for webhook lookups
   *   - connectionStatus: (optional) "unconnected" | "connected" | "error"
   *   - connectedAt: (optional) Unix timestamp when Smartcar was connected
   *   - avgMonthlyDriving: (optional) "light" | "average" | "heavy" — for service predictions
   *   - drivingConditions: (optional) "city" | "highway" | "mixed" — adjusts intervals
   *   - knownIssues: (optional) string[] of current concerns (e.g. "check_engine")
   *   - ownershipType: (optional) "leased" | "owned"
   *   - ownedSinceNew: (optional) true if user has had vehicle since new
   *   - mileageAtPurchase: (optional) odometer when user acquired vehicle
   *   - ownershipDuration: (optional) "<1" | "1_2" | "2_4" | "4_plus"
   *   - annualMileageBand: (optional) "light" | "avg" | "heavy" | "very_heavy"
   *   - usagePattern: (optional) "mostly_local" | "mostly_highway" | "mixed"
   *   - lastServiceWhen: (optional) "lt1mo" | "1_3mo" | "3_6mo" | "6_12mo" | "12plus" | "not_sure"
   *   - lastServiceWhat: (optional) string[] of selected service types
   *   - serviceLocationPreference: (optional) "dealer" | "independent" | "chain" | "self" | "not_sure"
   *   - garageRole: (optional) "primary" | "secondary" | "weekend" | "stored"
   *   - preOnboardingComplete: (optional) true once pre-step onboarding is done
   *   - onboardingComplete: (optional) true once follow-up onboarding is done
   *
   * INDEXES:
   *   - by_vin: Get all owners of a vehicle
   *   - by_user_id: Get all vehicles owned by user
   *   - by_vin_user: Combined lookup for specific ownership
   *   - by_user_status: Get user's active/removed vehicles
   *   - by_smartcar_vehicle_id: Lookup by Smartcar vehicle ID (webhook path)
   *
   * RELATIONSHIPS:
   *   FK → vehicles(vin)
   *   FK → users(user_id)
   */
  vehicle_owners: defineTable({
    vin: v.string(), // FK-like to vehicles.vin
    user_id: v.id("users"),
    status: v.string(), // "active" | "removed"
    nickname: v.optional(v.string()),
    is_primary: v.optional(v.boolean()),
    mileage: v.optional(v.float64()),
    added_at: v.float64(),
    removed_at: v.optional(v.float64()),
    smartcarVehicleId: v.optional(v.string()),
    connectionStatus: v.optional(v.string()), // "unconnected" | "connected" | "error"
    connectedAt: v.optional(v.float64()),
    // Vehicle onboarding profile fields (non-Smartcar)
    ownershipType: v.optional(v.string()),
    ownedSinceNew: v.optional(v.boolean()),
    mileageAtPurchase: v.optional(v.float64()),
    ownershipDuration: v.optional(v.string()),
    annualMileageBand: v.optional(v.string()),
    usagePattern: v.optional(v.string()),
    lastServiceWhen: v.optional(v.string()),
    lastServiceWhat: v.optional(v.array(v.string())),
    serviceLocationPreference: v.optional(v.string()),
    garageRole: v.optional(v.string()),
    avgMonthlyDriving: v.optional(v.string()),   // "light" | "average" | "heavy"
    drivingConditions: v.optional(v.string()),    // "city" | "highway" | "mixed"
    knownIssues: v.optional(v.any()),             // string[] e.g. ["check_engine", "weird_noise"]
    preOnboardingComplete: v.optional(v.boolean()), // Pre-step gate before CarInfoStepper
    onboardingComplete: v.optional(v.boolean()),  // Phase 1 → Phase 2 gate
    // Maintenance Intelligence: modifier inputs
    usage_pattern: v.optional(v.string()),        // "city" | "highway" | "mixed"
    vehicle_age_years: v.optional(v.float64()),
    mileage_tier: v.optional(v.string()),         // "low" | "moderate" | "high" | "ultra"
    prev_usage_intensity: v.optional(v.string()), // "light" | "average" | "heavy" | "ultra_heavy"
    history_confidence: v.optional(v.string()),   // "full" | "partial" | "none"
    // Maintenance Intelligence: segment & classification
    owner_segment: v.optional(v.string()),        // "A" | "B" | "C" | "D"
    segment_classified_at: v.optional(v.float64()),
    annual_mileage_rate: v.optional(v.float64()),
    prev_owner_annual_rate: v.optional(v.float64()),
    // Classification & check-in pointers (denormalized for fast reads)
    active_classification_id: v.optional(v.id("vehicle_classifications")),
    vehicle_mode: v.optional(v.string()),         // "lease" | "owned_new" | "owned_active" | "owned_endurance" | "owned_weekend"
    last_checkin_at: v.optional(v.float64()),
    next_checkin_due: v.optional(v.float64()),
    health_score: v.optional(v.float64()),
    health_score_is_estimated: v.optional(v.boolean()),
    // Q8 ownership plans — affects service philosophy
    ownership_plan: v.optional(v.string()),   // "keeping" | "might_sell" | "not_sure"
    // Q7 lease status
    lease_ending_soon: v.optional(v.boolean()),
    // Q11 lease mileage pace
    lease_mileage_pace: v.optional(v.string()), // "on_track" | "running_ahead" | "well_under"
  })
    .index("by_vin", ["vin"])
    .index("by_user_id", ["user_id"])
    .index("by_vin_user", ["vin", "user_id"])
    .index("by_user_status", ["user_id", "status"])
    .index("by_smartcar_vehicle_id", ["smartcarVehicleId"]),

  /**
   * TABLE: users
   *
   * DESCRIPTION:
   * Platform users (vehicle owners seeking maintenance services).
   * Primary authentication via Clerk (third-party auth provider).
   * Stores user profile, contact, and onboarding state.
   *
   * FIELDS:
   *   - clerkUserId: External ID from Clerk auth (UNIQUE)
   *   - email: User's email address
   *   - phone: User's phone number
   *   - first_name: User's first name
   *   - last_name: User's last name
   *   - profile_photo_url: URL to user's profile picture
   *   - onboardingCompleted: Whether user finished onboarding
   *   - tellUsAboutCompleted: Whether "Tell Us About You" section completed
   *   - auth_provider: Which provider for auth (e.g., "oauth_google")
   *   - createdAt: Unix timestamp of account creation (single creation timestamp)
   *   - lastUpdated: Unix timestamp of last profile/state update
   *   - emailConfirmed: Whether email is verified
   *   - phoneVerified: Whether phone is verified
   *
   * INDEXES:
   *   - by_clerkUserId: Auth lookup by external ID
   *
   * RELATIONSHIPS:
   *   Has-many → bookings (via user_id)
   *   Has-many → payments (via user_id)
   *   Has-many → vehicle_owners (via user_id)
   *   Has-many → reviews (via user_id)
   *   Has-many → ai_conversations (via user_id)
   *   Has-many → onboarding_questions_answers (via user_id)
   *   Has-many → follow_ups (via user_id)
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
    profile_photo_url: v.optional(v.string()),
    tellUsAboutCompleted: v.optional(v.boolean()),
    user_intentions: v.optional(v.array(v.string())),
    username: v.optional(v.string()),
  }).index("by_clerkUserId", ["clerkUserId"]),

  // ============================================================================
  // OEM PARTS & NORMALIZATION
  // ============================================================================

  /**
   * TABLE: oem_parts
   *
   * DESCRIPTION:
   * Normalized OEM part catalog. Master reference for all vehicle parts.
   * Allows tracking of parts across multiple fitment relationships.
   *
   * FIELDS:
   *   - oem_part_number: OEM part number (UNIQUE)
   *   - name: Part name (e.g., "Oil Filter", "Brake Pad")
   *   - category: Part category (e.g., "filter", "brakes", "wipers", "fluids")
   *   - notes: (optional) Additional notes about part
   *   - created_at: Unix timestamp when part was added
   *
   * INDEXES:
   *   - by_part_number: Lookup by OEM part number (unique)
   *   - by_category: Filter parts by category
   *
   * RELATIONSHIPS:
   *   Has-many → engine_part_fitments (via part_id)
   *   Has-many → transmission_part_fitments (via part_id)
   *   Has-many → trim_part_fitments (via part_id)
   */
  oem_parts: defineTable({
    oem_part_number: v.string(),
    name: v.optional(v.string()),
    category: v.optional(v.string()), // "filter", "brakes", "wipers", "fluids", etc.
    notes: v.optional(v.string()),
    created_at: v.float64(),
  })
    .index("by_part_number", ["oem_part_number"])
    .index("by_category", ["category"]),

  /**
   * TABLE: transmissions
   *
   * DESCRIPTION:
   * Transmission variants for specific vehicle trims (trim-scoped).
   * Mirrors engines table structure but for transmission-related specs.
   * Multiple transmission types may exist for same trim year.
   *
   * FIELDS:
   *   - trim_id: References the vehicle trim
   *   - transmission_type: Type (e.g., "automatic", "manual", "cvt", "dct")
   *   - code: (optional) OEM transmission code if known
   *   - notes: (optional) Additional notes
   *   - created_at: Unix timestamp when variant was added
   *   - confidence_score: (optional) AI confidence when auto-generated
   *
   * INDEXES:
   *   - by_trim: Get all transmissions for trim
   *   - by_trim_type: Combined lookup by trim and type
   *
   * RELATIONSHIPS:
   *   FK → trims(trim_id)
   *   Has-many → transmission_specs (via transmission_id)
   *   Has-many → transmission_part_fitments (via transmission_id)
   *   Can be referenced by → vehicles(transmission_id)
   */
  transmissions: defineTable({
    trim_id: v.id("trims"),
    transmission_type: v.string(), // "automatic" | "manual" | "cvt" | "dct"
    code: v.optional(v.string()),
    notes: v.optional(v.string()),
    created_at: v.float64(),
    confidence_score: v.optional(v.float64()), // 0-1, present when AI-created/selected
  })
    .index("by_trim", ["trim_id"])
    .index("by_trim_type", ["trim_id", "transmission_type"]),

  /**
   * TABLE: chassis_variants
   *
   * DESCRIPTION:
   * Chassis and drivetrain variants for specific vehicle trims (trim-scoped).
   * Tracks drivetrain type (FWD/RWD/AWD/4WD) for each trim.
   *
   * FIELDS:
   *   - trim_id: References the vehicle trim
   *   - drivetrain_type: Type (e.g., "fwd", "rwd", "awd", "4wd")
   *   - notes: (optional) Additional notes about chassis
   *   - created_at: Unix timestamp when variant was added
   *   - confidence_score: (optional) AI confidence when auto-generated
   *
   * INDEXES:
   *   - by_trim: Get all chassis variants for trim
   *   - by_trim_drivetrain: Combined lookup by trim and drivetrain type
   *
   * RELATIONSHIPS:
   *   FK → trims(trim_id)
   *   Can be referenced by → vehicles(chassis_id)
   */
  chassis_variants: defineTable({
    trim_id: v.id("trims"),
    drivetrain_type: v.string(), // "fwd" | "rwd" | "awd" | "4wd"
    notes: v.optional(v.string()),
    created_at: v.float64(),
    confidence_score: v.optional(v.float64()), // 0-1, present when AI-created/selected
  })
    .index("by_trim", ["trim_id"])
    .index("by_trim_drivetrain", ["trim_id", "drivetrain_type"]),

  // ============================================================================
  // SUBSYSTEM-LEVEL SPECS (NOT PARTS - SPECIFICATION DATA)
  // ============================================================================

  /**
   * TABLE: engine_specs
   *
   * DESCRIPTION:
   * Engine subsystem specifications (not parts, but spec data).
   * One row per engine_id covering fluids and maintenance intervals.
   *
   * FIELDS:
   *   - engine_id: References the engine (treated as unique via index)
   *   - oil_viscosity: Oil viscosity rating (e.g., "5W-30")
   *   - oil_capacity_qts: Oil capacity in quarts
   *   - coolant_type: Coolant type/specification
   *   - coolant_capacity_qts: Coolant capacity in quarts
   *   - brake_fluid_type: (optional) Brake fluid specification
   *   - oil_change_interval: (optional) Interval for engine oil service
   *   - cabin_air_filter_interval: (optional) Interval for cabin filter service
   *   - engine_air_filter_interval: (optional) Interval for engine air filter service
   *   - spark_plug_interval: (optional) Interval for spark plug service
   *   - serpentine_belt_interval: (optional) Interval for serpentine belt service
   *   - brake_fluid_interval: (optional) Interval for brake fluid service
   *   - coolant_interval: (optional) Interval for coolant service
   *   - transmission_fluid_interval: (optional) Interval for transmission fluid service
   *   - tire_rotation_interval: (optional) Interval for tire rotation
   *   - confidence_score: (optional) Confidence in spec accuracy (0-1)
   *   - created_at: Unix timestamp when spec was created
   *
   * INDEXES:
   *   - by_engine: Lookup by engine (unique)
   *
   * RELATIONSHIPS:
   *   FK -> engines(engine_id)
   */
  engine_specs: defineTable({
    engine_id: v.id("engines"),
    oil_viscosity: v.optional(v.string()),
    oil_capacity_qts: v.optional(v.float64()),
    coolant_type: v.optional(v.string()),
    coolant_capacity_qts: v.optional(v.float64()),
    brake_fluid_type: v.optional(v.string()),
    oil_change_interval: v.optional(v.string()),
    cabin_air_filter_interval: v.optional(v.string()),
    engine_air_filter_interval: v.optional(v.string()),
    spark_plug_interval: v.optional(v.string()),
    serpentine_belt_interval: v.optional(v.string()),
    brake_fluid_interval: v.optional(v.string()),
    coolant_interval: v.optional(v.string()),
    transmission_fluid_interval: v.optional(v.string()),
    tire_rotation_interval: v.optional(v.string()),
    confidence_score: v.optional(v.float64()), // 0-1
    created_at: v.float64(),
  }).index("by_engine", ["engine_id"]),

  /**
   * TABLE: transmission_specs
   *
   * DESCRIPTION:
   * Transmission subsystem specifications (not parts, but spec data).
   * Stores transmission fluid and maintenance specs keyed by transmission_id.
   * UNIQUE index ensures one spec record per transmission.
   *
   * FIELDS:
   *   - transmission_id: References the transmission (UNIQUE via index)
   *   - transmission_fluid_type: Fluid specification
   *   - transmission_fluid_capacity_qts: Fluid capacity in quarts
   *   - maintenance_interval: (optional) Maintenance interval specs
   *   - confidence_score: (optional) Confidence in spec accuracy (0-1)
   *   - created_at: Unix timestamp when spec was created
   *
   * INDEXES:
   *   - by_transmission: Lookup by transmission (unique)
   *
   * RELATIONSHIPS:
   *   FK → transmissions(transmission_id)
   */
  transmission_specs: defineTable({
    transmission_id: v.id("transmissions"),
    transmission_fluid_type: v.optional(v.string()),
    transmission_fluid_capacity_qts: v.optional(v.float64()),
    maintenance_interval: v.optional(v.string()),
    confidence_score: v.optional(v.float64()), // 0-1
    created_at: v.float64(),
  }).index("by_transmission", ["transmission_id"]),

  /**
   * TABLE: trim_specs
   *
   * DESCRIPTION:
   * Trim-level specifications (not parts, but spec data).
   * Stores tire, lug nut, wiper blade, parking brake specs keyed by trim_id.
   * UNIQUE index ensures one spec record per trim.
   *
   * FIELDS:
   *   - trim_id: References the trim (UNIQUE via index)
   *   - tire_size_front: Front tire size (e.g., "205/55R16")
   *   - tire_size_rear: (optional, nullable) Rear tire size (staggered setups)
   *   - recommended_tire_pressure_front_psi: Recommended PSI for front
   *   - recommended_tire_pressure_rear_psi: Recommended PSI for rear
   *   - lug_nut_torque_ft_lbs: Lug nut torque specification
   *   - wiper_blade_driver_size_in, wiper_blade_passenger_size_in: Wiper sizes in inches
   *   - wiper_blade_rear_size_in: (optional) Rear wiper size; null if no rear wiper
   *   - parking_brake_type: Type of parking brake (e.g., "drum", "disc")
   *   - confidence_score: (optional) Confidence in spec accuracy (0-1)
   *   - created_at: Unix timestamp when spec was created
   *
   * INDEXES:
   *   - by_trim: Lookup by trim (unique)
   *
   * RELATIONSHIPS:
   *   FK → trims(trim_id)
   */
  trim_specs: defineTable({
    trim_id: v.id("trims"),
    tire_size_front: v.optional(v.string()),
    tire_size_rear: v.optional(v.string()),
    recommended_tire_pressure_front_psi: v.optional(v.float64()),
    recommended_tire_pressure_rear_psi: v.optional(v.float64()),
    lug_nut_torque_ft_lbs: v.optional(v.float64()),
    wiper_blade_driver_size_in: v.optional(v.float64()),
    wiper_blade_passenger_size_in: v.optional(v.float64()),
    wiper_blade_rear_size_in: v.optional(v.float64()),
    parking_brake_type: v.optional(v.string()),
    confidence_score: v.optional(v.float64()), // 0-1
    created_at: v.float64(),
  }).index("by_trim", ["trim_id"]),

  // ============================================================================
  // FITMENT MAPPINGS (VARIANT -> PART)
  // ============================================================================

  /**
   * TABLE: engine_part_fitments
   *
   * DESCRIPTION:
   * Maps OEM parts to specific engines with role/application context.
   * Enables querying: "What parts fit this engine for these roles?"
   *
   * FIELDS:
   *   - engine_id: References the engine
   *   - part_id: References the OEM part
   *   - role: Part role/application (e.g., "oil_filter", "spark_plug", "serpentine_belt")
   *   - quantity: (optional) How many units needed
   *   - spark_plug_gap_mm: (optional) Spark plug gap if applicable
   *   - notes: (optional) Additional fitment notes
   *   - confidence_score: (optional) Confidence in fitment (0-1)
   *   - created_at: Unix timestamp when fitment was created
   *
   * INDEXES:
   *   - by_engine: Get all fitments for engine
   *   - by_engine_role: Get fitment for specific role (treated as unique in code)
   *   - by_part: Find which engines use this part
   *
   * RELATIONSHIPS:
   *   FK → engines(engine_id)
   *   FK → oem_parts(part_id)
   */
  engine_part_fitments: defineTable({
    engine_id: v.id("engines"),
    part_id: v.id("oem_parts"),
    role: v.string(), // oil_filter, spark_plug, serpentine_belt, engine_air_filter, etc.
    quantity: v.optional(v.float64()),
    spark_plug_gap_mm: v.optional(v.float64()),
    notes: v.optional(v.string()),
    confidence_score: v.optional(v.float64()), // 0-1
    created_at: v.float64(),
  })
    .index("by_engine", ["engine_id"])
    .index("by_engine_role", ["engine_id", "role"])
    .index("by_part", ["part_id"]),

  /**
   * TABLE: transmission_part_fitments
   *
   * DESCRIPTION:
   * Maps OEM parts to specific transmissions with role/application context.
   * Enables querying: "What parts fit this transmission for these roles?"
   *
   * FIELDS:
   *   - transmission_id: References the transmission
   *   - part_id: References the OEM part
   *   - role: Part role/application (e.g., "transmission_filter", "pan_gasket")
   *   - quantity: (optional) How many units needed
   *   - notes: (optional) Additional fitment notes
   *   - confidence_score: (optional) Confidence in fitment (0-1)
   *   - created_at: Unix timestamp when fitment was created
   *
   * INDEXES:
   *   - by_transmission: Get all fitments for transmission
   *   - by_transmission_role: Get fitment for specific role (treated as unique in code)
   *   - by_part: Find which transmissions use this part
   *
   * RELATIONSHIPS:
   *   FK → transmissions(transmission_id)
   *   FK → oem_parts(part_id)
   */
  transmission_part_fitments: defineTable({
    transmission_id: v.id("transmissions"),
    part_id: v.id("oem_parts"),
    role: v.string(), // transmission_filter, transmission_pan_gasket, etc.
    quantity: v.optional(v.float64()),
    notes: v.optional(v.string()),
    confidence_score: v.optional(v.float64()), // 0-1
    created_at: v.float64(),
  })
    .index("by_transmission", ["transmission_id"])
    .index("by_transmission_role", ["transmission_id", "role"])
    .index("by_part", ["part_id"]),

  /**
   * TABLE: trim_part_fitments
   *
   * DESCRIPTION:
   * Maps OEM parts to specific trims with role/application context.
   * Enables querying: "What parts fit this trim for these roles?"
   *
   * FIELDS:
   *   - trim_id: References the trim
   *   - part_id: References the OEM part
   *   - role: Part role/application (e.g., "battery", "wiper_blade_driver", "brake_rotor")
   *   - quantity: (optional) How many units needed
   *   - wiper_size_in: (optional) Wiper blade size in inches
   *   - notes: (optional) Additional fitment notes
   *   - confidence_score: (optional) Confidence in fitment (0-1)
   *   - created_at: Unix timestamp when fitment was created
   *
   * INDEXES:
   *   - by_trim: Get all fitments for trim
   *   - by_trim_role: Get fitment for specific role (treated as unique in code)
   *   - by_part: Find which trims use this part
   *
   * RELATIONSHIPS:
   *   FK → trims(trim_id)
   *   FK → oem_parts(part_id)
   */
  trim_part_fitments: defineTable({
    trim_id: v.id("trims"),
    part_id: v.id("oem_parts"),
    role: v.string(), // battery, wiper_blade_driver, wiper_blade_passenger, brake_rotor, etc.
    quantity: v.optional(v.float64()),
    wiper_size_in: v.optional(v.float64()),
    notes: v.optional(v.string()),
    confidence_score: v.optional(v.float64()), // 0-1
    created_at: v.float64(),
  })
    .index("by_trim", ["trim_id"])
    .index("by_trim_role", ["trim_id", "role"])
    .index("by_part", ["part_id"]),

  // ============================================================================
  // PAYMENT TRACKING
  // ============================================================================

  /**
   * TABLE: payments
   *
   * DESCRIPTION:
   * Payment records for completed bookings.
   * Tracks payment status, method, and transaction IDs.
   * Separate from bookings to handle multiple payments per booking (if needed).
   *
   * FIELDS:
   *   - booking_id: References the booking being paid for
   *   - user_id: User making payment
   *   - shop_id: Shop receiving payment
   *   - amount: Payment amount in dollars
   *   - payment_method: Method used ("card", "cash", "apple_pay", etc.)
   *   - status: Payment state ("pending", "completed", "failed", "refunded")
   *   - transaction_id: Internal transaction identifier
   *   - stripe_payment_intent_id: Stripe payment intent ID (if using Stripe)
   *   - idempotency_key: Key for preventing duplicate charges
   *   - created_at: Unix timestamp when payment was initiated
   *   - updated_at: Unix timestamp of last status update
   *
   * INDEXES:
   *   - by_booking_id: Get payment for booking
   *   - by_user_id: Get all payments by user
   *   - by_status: Filter payments by status
   *   - by_idempotency_key: Prevent duplicate payments
   *   - by_created_at: Chronological ordering
   *
   * RELATIONSHIPS:
   *   FK → bookings(booking_id)
   *   FK → users(user_id)
   *   FK → shops(shop_id)
   *   Has-one → payment_status_history (via payment_id)
   */
  payments: defineTable({
    booking_id: v.id("bookings"),
    user_id: v.id("users"),
    shop_id: v.id("shops"),
    amount: v.float64(),
    payment_method: v.string(), // "card", "cash", "apple_pay", etc.
    status: v.string(), // "pending", "completed", "failed", "refunded"
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
   * Unified list of charges, credits, and refunds (shop payments, subscriptions,
   * referral rewards, ownership credits, etc.).
   *
   * FIELDS:
   *   - user_id: User who owns this transaction
   *   - created_at: Unix timestamp (for grouping by date and sorting)
   *   - description: Main label (e.g. "Hawk Precision Auto Works", "Ownership credits")
   *   - sub_description: Extra detail (e.g. "3 items", "Referral reward", "Monthly Subscription")
   *   - amount: Signed amount in dollars (negative = charge/refund, positive = credit)
   *   - currency: ISO currency code (e.g. "USD")
   *   - status: "completed" | "pending" | "refunded"
   *   - transaction_type: "charge" | "credit" | "refund"
   *   - shop_id: (optional) Shop when transaction is shop-related
   *   - booking_id: (optional) Booking when transaction is from a booking payment
   *   - payment_id: (optional) Link to payments table
   *   - icon_type: (optional) UI hint: "wrench" | "leaf" | "car" | "fuel" | "card" | etc.
   *
   * INDEXES:
   *   - by_user_id: All transactions for a user
   *   - by_user_id_created_at: Chronological list for user (desc)
   *   - by_user_id_type: Filter by user + transaction_type
   *
   * RELATIONSHIPS:
   *   FK → users(user_id)
   *   FK → shops(shop_id) optional
   *   FK → bookings(booking_id) optional
   *   FK → payments(payment_id) optional
   */
  transactions: defineTable({
    user_id: v.id("users"),
    created_at: v.float64(),
    description: v.string(),
    sub_description: v.optional(v.string()),
    amount: v.float64(), // negative = charge/refund, positive = credit
    currency: v.string(), // "USD"
    status: v.string(), // "completed" | "pending" | "refunded"
    transaction_type: v.string(), // "charge" | "credit" | "refund"
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

  // ============================================================================
  // FOLLOW-UPS & MAINTENANCE
  // ============================================================================

  /**
   * TABLE: follow_ups
   *
   * DESCRIPTION:
   * Maintenance reminders and follow-up notifications for users.
   * Tracks scheduled reminders for services (e.g., "Oil change due in 3000 miles").
   *
   * FIELDS:
   *   - user_id: User receiving reminder
   *   - vin: Vehicle needing service
   *   - booking_id: (optional) Related booking if from past service
   *   - service_id: Service to be reminded about
   *   - follow_up_type: Type of follow-up ("reminder", "maintenance_due", "inspection")
   *   - scheduled_for: Unix timestamp when reminder should trigger
   *   - status: Current state ("pending", "sent", "completed", "dismissed")
   *   - message: Reminder message text
   *   - created_at: When reminder was created
   *   - sent_at: (optional) When reminder was sent to user
   *
   * INDEXES:
   *   - by_user_id: Get reminders for user
   *   - by_vin: Get reminders for vehicle
   *   - by_status_and_scheduled: Get pending reminders to send
   *   - by_booking_id: Get reminders related to booking
   *
   * RELATIONSHIPS:
   *   FK → users(user_id)
   *   FK → vehicles(vin)
   *   FK → services(service_id)
   *   FK → bookings(booking_id)
   */
  follow_ups: defineTable({
    user_id: v.id("users"),
    vin: v.string(), // canonical VIN reference
    booking_id: v.optional(v.id("bookings")),
    service_id: v.id("services"),
    follow_up_type: v.string(), // "reminder", "maintenance_due", "inspection"
    scheduled_for: v.float64(), // timestamp when reminder should trigger
    status: v.string(), // "pending", "sent", "completed", "dismissed"
    message: v.string(),
    created_at: v.float64(),
    sent_at: v.optional(v.float64()),
  })
    .index("by_user_id", ["user_id"])
    .index("by_vin", ["vin"])
    .index("by_status_and_scheduled", ["status", "scheduled_for"])
    .index("by_booking_id", ["booking_id"]),

  // ============================================================================
  // AI CONVERSATIONS & ENRICHMENT
  // ============================================================================

  /**
   * TABLE: ai_conversations
   *
   * DESCRIPTION:
   * Conversation sessions with AI chat assistant.
   * Tracks multi-turn conversations and whether they led to bookings.
   *
   * FIELDS:
   *   - user_id: User having conversation
   *   - session_id: Client-generated session UUID for correlation
   *   - started_at: Unix timestamp when conversation started
   *   - ended_at: (optional) When conversation ended
   *   - scenario_detected: (optional) Detected user scenario ("price_check", "booking_flow")
   *   - message_count: Number of messages in conversation
   *   - booking_id: (optional) Booking created from this conversation
   *   - led_to_booking: Whether conversation resulted in booking
   *
   * INDEXES:
   *   - by_user_id: Get conversations for user
   *   - by_session_id: Lookup by session (unique)
   *   - by_booking_id: Get conversation that led to booking
   *   - by_started_at: Chronological ordering
   *
   * RELATIONSHIPS:
   *   FK → users(user_id)
   *   FK → bookings(booking_id)
   *   Has-many → ai_messages (via conversation_id)
   */
  ai_conversations: defineTable({
    user_id: v.id("users"),
    started_at: v.float64(),
    ended_at: v.optional(v.float64()),
    scenario_detected: v.optional(v.string()), // "price_check", "booking_flow", etc.
    led_to_booking: v.boolean(),
    booking_id: v.optional(v.id("bookings")),
    message_count: v.float64(),
    session_id: v.string(), // client-generated UUID for correlation
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
   * Complete message history for analysis and training.
   *
   * FIELDS:
   *   - conversation_id: References the conversation session
   *   - role: Message source ("user", "assistant", "system")
   *   - content: Message text content
   *   - timestamp: Unix timestamp when message was sent
   *   - confidence_score: (optional) AI confidence in response (0-1)
   *   - metadata: (optional) Additional context (detected services, shops, intent)
   *
   * INDEXES:
   *   - by_conversation_id: Get all messages in conversation
   *   - by_role: Filter messages by role
   *   - by_timestamp: Chronological ordering
   *
   * RELATIONSHIPS:
   *   FK → ai_conversations(conversation_id)
   */
  ai_messages: defineTable({
    conversation_id: v.id("ai_conversations"),
    role: v.string(), // "user", "assistant", "system"
    content: v.string(),
    timestamp: v.float64(),
    confidence_score: v.optional(v.float64()), // AI confidence in response
    metadata: v.optional(
      v.object({
        service_suggestions: v.optional(v.array(v.id("services"))),
        shop_suggestions: v.optional(v.array(v.id("shops"))),
        intent_detected: v.optional(v.string()),
      }),
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
   * Records user actions across the application (page views, bookings, payments).
   *
   * FIELDS:
   *   - user_id: (optional) User who triggered event
   *   - event_type: Specific event ("page_view", "booking_started", "payment_completed")
   *   - event_category: Category of event ("booking", "payment", "navigation", "ai_chat")
   *   - event_data: (optional) Event-specific data (booking/shop/service IDs, screen names)
   *   - timestamp: Unix timestamp when event occurred
   *   - session_id: (optional) Client session ID for grouping events
   *
   * INDEXES:
   *   - by_user_id: Get events for user
   *   - by_event_type: Filter by event type
   *   - by_event_category: Filter by category
   *   - by_timestamp: Chronological ordering
   *   - by_session_id: Group events by session
   *
   * RELATIONSHIPS:
   *   FK → users(user_id) (optional)
   */
  analytics_events: defineTable({
    user_id: v.optional(v.id("users")),
    event_type: v.string(), // "page_view", "booking_started", "payment_completed", etc.
    event_category: v.string(), // "booking", "payment", "navigation", "ai_chat"
    event_data: v.optional(
      v.object({
        booking_id: v.optional(v.id("bookings")),
        shop_id: v.optional(v.id("shops")),
        service_id: v.optional(v.id("services")),
        screen_name: v.optional(v.string()),
        custom_properties: v.optional(v.any()),
      }),
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
   * Records each step of booking/payment flows for analytics.
   * Used to identify drop-off points and optimize conversion.
   *
   * FIELDS:
   *   - user_id: User going through funnel
   *   - funnel_type: Type of funnel ("booking_flow", "payment_flow", "onboarding")
   *   - stage: Current stage in funnel ("started", "service_selected", "shop_selected", etc.)
   *   - booking_id: (optional) Associated booking
   *   - entered_at: Unix timestamp when user entered funnel
   *   - exited_at: (optional) When user exited/left funnel
   *   - completed: Whether user completed entire funnel
   *   - drop_off_reason: (optional) Why user left ("user_cancelled", "error", "timeout")
   *
   * INDEXES:
   *   - by_user_id: Get user's funnels
   *   - by_funnel_type: Filter by funnel type
   *   - by_booking_id: Get funnel for booking
   *   - by_stage: Filter by stage
   *   - by_completed: Get completed/incomplete funnels
   *   - by_entered_at: Chronological ordering
   *
   * RELATIONSHIPS:
   *   FK → users(user_id)
   *   FK → bookings(booking_id)
   */
  conversion_funnels: defineTable({
    user_id: v.id("users"),
    funnel_type: v.string(), // "booking_flow", "payment_flow", "onboarding"
    stage: v.string(), // "started", "service_selected", "shop_selected", "time_selected", "payment_info", "completed"
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
  // AI ENRICHMENT & QUALITY CONTROL
  // ============================================================================

  /**
   * TABLE: ai_enrichment_logs
   *
   * DESCRIPTION:
   * Logs AI-generated enrichments of service specs for engine+service combinations.
   * Tracks source, confidence, and review status of AI-generated data.
   * Used for manual review of low-confidence enrichments.
   *
   * FIELDS:
   *   - engine_id: Engine being enriched
   *   - service_id: Service being enriched
   *   - source: AI source ("openai", "claude", "manual")
   *   - confidence_score: AI confidence in enrichment (0-1)
   *   - enriched_data: Generated specs (labor hours, parts costs, notes)
   *   - created_at: Unix timestamp when enrichment was created
   *   - reviewed_by: (optional) User who reviewed this enrichment
   *   - review_status: Status ("pending", "approved", "rejected")
   *
   * INDEXES:
   *   - by_engine_id: Get enrichments for engine
   *   - by_review_status: Get pending reviews
   *   - by_confidence: Sort by confidence level
   *   - by_created_at: Chronological ordering
   *
   * RELATIONSHIPS:
   *   FK → engines(engine_id)
   *   FK → services(service_id)
   *   FK → users(reviewed_by)
   *   Has-many → manual_review_queue (via enrichment_log_id)
   */
  ai_enrichment_logs: defineTable({
    engine_id: v.id("engines"),
    service_id: v.id("services"),
    source: v.string(), // "openai", "claude", "manual"
    confidence_score: v.float64(),
    enriched_data: v.object({
      labor_hours: v.optional(v.float64()),
      parts_cost_low: v.optional(v.float64()),
      parts_cost_high: v.optional(v.float64()),
      tech_notes: v.optional(v.string()),
    }),
    created_at: v.float64(),
    reviewed_by: v.optional(v.id("users")),
    review_status: v.string(), // "pending", "approved", "rejected"
  })
    .index("by_engine_id", ["engine_id"])
    .index("by_review_status", ["review_status"])
    .index("by_confidence", ["confidence_score"])
    .index("by_created_at", ["created_at"]),

  /**
   * TABLE: manual_review_queue
   *
   * DESCRIPTION:
   * Queue of AI enrichments requiring manual review.
   * Prioritizes low-confidence or flagged enrichments for human review.
   *
   * FIELDS:
   *   - enrichment_log_id: References the enrichment to review
   *   - engine_id: Engine needing review
   *   - service_id: Service needing review
   *   - priority: Review priority ("high", "medium", "low")
   *   - reason: Why review is needed ("low_confidence", "missing_data", "user_reported")
   *   - status: Review state ("pending", "in_review", "resolved")
   *   - assigned_to: (optional) User assigned to review
   *   - created_at: When review was requested
   *   - resolved_at: (optional) When review was completed
   *
   * INDEXES:
   *   - by_status: Get pending/in-progress reviews
   *   - by_engine_id: Get reviews for engine
   *   - by_assigned_to: Get reviews assigned to user
   *   - by_priority_and_status: Get high-priority pending reviews
   *   - by_created_at: Chronological ordering
   *
   * RELATIONSHIPS:
   *   FK → ai_enrichment_logs(enrichment_log_id)
   *   FK → engines(engine_id)
   *   FK → services(service_id)
   *   FK → users(assigned_to)
   */
  manual_review_queue: defineTable({
    engine_id: v.id("engines"),
    service_id: v.id("services"),
    enrichment_log_id: v.id("ai_enrichment_logs"),
    priority: v.string(), // "high", "medium", "low"
    reason: v.string(), // "low_confidence", "missing_data", "user_reported"
    status: v.string(), // "pending", "in_review", "resolved"
    assigned_to: v.optional(v.id("users")),
    created_at: v.float64(),
    resolved_at: v.optional(v.float64()),
  })
    .index("by_status", ["status"])
    .index("by_engine_id", ["engine_id"])
    .index("by_assigned_to", ["assigned_to"])
    .index("by_priority_and_status", ["priority", "status"])
    .index("by_created_at", ["created_at"]),

  // ============================================================================
  // QUALITY ASSURANCE & VARIANCE TRACKING
  // ============================================================================

  /**
   * TABLE: spec_variances
   *
   * DESCRIPTION:
   * Tracks differences between predicted and actual job specifications.
   * Used to identify where estimates are inaccurate and improve future predictions.
   *
   * FIELDS:
   *   - job_actual_id: References the completed job
   *   - engine_id: Engine this service was performed on
   *   - service_id: Service that was performed
   *   - predicted_labor_hours: What was estimated
   *   - actual_labor_hours: What actually took
   *   - predicted_parts_cost: What was estimated
   *   - actual_parts_cost: What was actually charged
   *   - variance_percentage: Calculated variance from predictions
   *   - flagged_for_review: Whether variance is outside acceptable range
   *   - reviewed_at: (optional) When variance was reviewed
   *   - notes: (optional) Review notes
   *   - created_at: When variance was recorded
   *
   * INDEXES:
   *   - by_engine_id: Get variances for engine
   *   - by_service_id: Get variances for service
   *   - by_flagged: Get variances flagged for review
   *   - by_variance: Sort by variance percentage
   *   - by_job_actual_id: Get variance for specific job
   *   - by_created_at: Chronological ordering
   *
   * RELATIONSHIPS:
   *   FK → job_actuals(job_actual_id)
   *   FK → engines(engine_id)
   *   FK → services(service_id)
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
   * Collects feedback on whether predicted specs matched actual service.
   *
   * FIELDS:
   *   - user_id: User providing feedback
   *   - engine_id: Engine being confirmed
   *   - service_id: Service being confirmed
   *   - booking_id: The booking after which confirmation was given
   *   - confirmed_accurate: Whether user confirmed specs were accurate
   *   - feedback: (optional) User's feedback text
   *   - confirmed_at: Unix timestamp when feedback was submitted
   *
   * INDEXES:
   *   - by_engine_id: Get confirmations for engine
   *   - by_user_id: Get confirmations from user
   *   - by_booking_id: Get confirmation for booking
   *   - by_confirmed_at: Chronological ordering
   *
   * RELATIONSHIPS:
   *   FK → users(user_id)
   *   FK → engines(engine_id)
   *   FK → services(service_id)
   *   FK → bookings(booking_id)
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

  // ============================================================================
  // AUDIT LOGS
  // ============================================================================

  /**
   * TABLE: booking_status_history
   *
   * DESCRIPTION:
   * Append-only audit log of booking status changes.
   * Complete history of state transitions for compliance and debugging.
   * One record per status change.
   *
   * FIELDS:
   *   - booking_id: The booking that changed
   *   - old_status: Previous status (null for creation)
   *   - new_status: New status after change
   *   - changed_by: (optional) User who triggered change (null for system)
   *   - reason: (optional) Reason for change ("user_requested", "auto_timeout", etc.)
   *   - changed_at: Unix timestamp when change occurred (milliseconds)
   *
   * INDEXES:
   *   - by_booking_id: Get all status changes for booking
   *   - by_changed_at: Chronological ordering
   *
   * RELATIONSHIPS:
   *   FK → bookings(booking_id)
   *   FK → users(changed_by)
   */
  booking_status_history: defineTable({
    booking_id: v.id("bookings"),
    old_status: v.optional(v.string()), // null for initial creation
    new_status: v.string(),
    changed_by: v.optional(v.id("users")), // null for system changes
    reason: v.optional(v.string()), // "user_requested", "auto_timeout", etc.
    changed_at: v.float64(), // Unix ms
  })
    .index("by_booking_id", ["booking_id"])
    .index("by_changed_at", ["changed_at"]),

  /**
   * TABLE: payment_status_history
   *
   * DESCRIPTION:
   * Append-only audit log of payment status changes.
   * Complete history of payment state transitions including errors.
   * One record per status change.
   *
   * FIELDS:
   *   - payment_id: The payment that changed
   *   - old_status: Previous status (null for creation)
   *   - new_status: New status after change
   *   - error_code: (optional) Error code if change failed ("insufficient_funds", etc.)
   *   - error_message: (optional) Human-readable error message
   *   - changed_at: Unix timestamp when change occurred (milliseconds)
   *
   * INDEXES:
   *   - by_payment_id: Get all status changes for payment
   *   - by_changed_at: Chronological ordering
   *
   * RELATIONSHIPS:
   *   FK → payments(payment_id)
   */
  payment_status_history: defineTable({
    payment_id: v.id("payments"),
    old_status: v.optional(v.string()), // null for initial creation
    new_status: v.string(),
    error_code: v.optional(v.string()), // "insufficient_funds", "card_declined", etc.
    error_message: v.optional(v.string()),
    changed_at: v.float64(), // Unix ms
  })
    .index("by_payment_id", ["payment_id"])
    .index("by_changed_at", ["changed_at"]),

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
   * TABLE: vehicle_health_snapshots
   * Stores historical data points from Smartcar webhooks (odometer, tire pressure, oil life, fuel).
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
   * TABLE: odometer_history
   *
   * DESCRIPTION:
   * Logs odometer readings over time for trip stats (daily/weekly miles driven).
   * Each row is one reading. Deduplicated: only insert if distance changed.
   *
   * FIELDS:
   *   - vehicleOwnerId: FK to vehicle_owners
   *   - distance: Odometer value in miles
   *   - unit: "mi" | "km"
   *   - recordedAt: Unix timestamp of the reading
   *
   * INDEXES:
   *   - by_vehicle_and_date: For querying history range per vehicle
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
   *
   * DESCRIPTION:
   * User-provided maintenance data for items Smartcar doesn't cover
   * (brakes, inspection, transmission, battery, etc.).
   * One record per vehicle + type. Upserted when user submits info.
   *
   * FIELDS:
   *   - vehicleOwnerId: FK to vehicle_owners
   *   - type: "oil" | "brakes" | "tires" | "inspection" | "battery"
   *   - lastServiceDate: Unix timestamp of last service (optional)
   *   - lastServiceMileage: Miles at last service (optional)
   *   - customInputs: Flexible object for type-specific data (optional)
   *   - createdAt: Creation timestamp
   *   - updatedAt: Last update timestamp
   *
   * INDEXES:
   *   - by_vehicle_owner: All records for a vehicle
   *   - by_vehicle_and_type: Lookup a specific maintenance type per vehicle
   */
  maintenance_records: defineTable({
    vehicleOwnerId: v.id("vehicle_owners"),
    type: v.string(),
    lastServiceDate: v.optional(v.float64()),
    lastServiceMileage: v.optional(v.float64()),
    customInputs: v.optional(v.any()),
    serviceSource: v.optional(v.string()),    // "otopair" | "external" | "unknown"
    confidence: v.optional(v.string()),       // "verified" | "unverified"
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_vehicle_owner", ["vehicleOwnerId"])
    .index("by_vehicle_and_type", ["vehicleOwnerId", "type"]),

  // ============================================================================
  // MAINTENANCE INTELLIGENCE
  // ============================================================================

  /**
   * TABLE: composite_modifier_weights
   *
   * Weight profiles per service category. Weights must sum to 1.00
   * for non-compliance rows. Changing weights never requires a code deploy.
   */
  composite_modifier_weights: defineTable({
    category_name: v.string(),   // "routine" | "tires" | "brakes" | "battery" | "fluids" | "diagnostics" | "compliance"
    dcm_weight: v.float64(),     // Driving Condition
    vam_weight: v.float64(),     // Vehicle Age
    mtm_weight: v.float64(),     // Mileage Tier
    pum_weight: v.float64(),     // Previous Usage
    hcm_weight: v.float64(),     // History Confidence
    is_fixed: v.boolean(),       // true = Compliance, skip modifier entirely
  })
    .index("by_category", ["category_name"]),

  /**
   * TABLE: vehicle_driving_profiles
   *
   * Raw onboarding answers. One row per vehicle-owner pair, upserted on
   * completion. Stores the onboarding path alongside answers so we always
   * know which question set was presented.
   */
  vehicle_driving_profiles: defineTable({
    vehicle_owner_id: v.id("vehicle_owners"),
    onboarding_path: v.string(),          // "leased" | "owned_new" | "owned_used"
    onboarding_completed_at: v.float64(),
    // Path 3 only
    mileage_at_purchase: v.optional(v.float64()),
    ownership_duration: v.optional(v.string()),  // "<1yr" | "1-2" | "2-4" | "4+"
    // Shared fields (all paths)
    current_mileage: v.float64(),
    annual_mileage_band: v.string(),       // "light" | "average" | "heavy" | "very_heavy"
    usage_pattern: v.string(),             // "city" | "highway" | "mixed"
    // Optional "Head Start" section
    last_service_when: v.optional(v.string()),
    last_service_what: v.optional(v.array(v.string())),
    where_serviced: v.optional(v.string()),  // "dealer" | "independent" | "chain" | "self" | "not_sure"
    current_concerns: v.optional(v.string()),
    // Conditional
    garage_role: v.optional(v.string()),   // "primary" | "secondary" | "weekend" | "stored"
    // Metadata
    source: v.string(),                    // "onboarding" | "settings_edit" | "checkin_reclassify"
    created_at: v.float64(),
    updated_at: v.float64(),
  })
    .index("by_vehicle_owner", ["vehicle_owner_id"]),

  /**
   * TABLE: vehicle_classifications
   *
   * Computed mode + 5 dimension scores + 6 pre-computed composite modifiers.
   * Append-only with status (active/superseded) for full audit trail.
   */
  vehicle_classifications: defineTable({
    vehicle_owner_id: v.id("vehicle_owners"),
    // Mode assignment
    vehicle_mode: v.string(),  // "lease" | "owned_new" | "owned_active" | "owned_endurance" | "owned_weekend"
    owner_segment: v.string(), // "A" | "B" | "C" | "D"
    // Five dimension scores
    driving_condition_modifier: v.float64(),
    vehicle_age_modifier: v.float64(),
    mileage_tier_modifier: v.float64(),
    previous_usage_modifier: v.float64(),
    history_confidence_modifier: v.float64(),
    // Pre-computed composite modifiers per service category
    composite_routine: v.float64(),
    composite_tires: v.float64(),
    composite_brakes: v.float64(),
    composite_battery: v.float64(),
    composite_fluids: v.float64(),
    composite_diagnostics: v.float64(),
    // Velocity data
    annual_mileage_estimated: v.float64(),
    velocity_confidence: v.string(),           // "high" | "moderate" | "low"
    // Lifecycle
    status: v.string(),                        // "active" | "superseded"
    computed_at: v.float64(),
    triggered_by: v.string(),                  // "onboarding" | "checkin" | "booking" | "manual"
    superseded_at: v.optional(v.float64()),
    superseded_by: v.optional(v.id("vehicle_classifications")),
  })
    .index("by_vehicle_owner", ["vehicle_owner_id"])
    .index("by_vehicle_owner_active", ["vehicle_owner_id", "status"])
    .index("by_computed_at", ["computed_at"]),

  /**
   * TABLE: vehicle_service_states
   *
   * Central output of the intelligence engine. One row per vehicle per service.
   * Updated on new data (mileage update, Quick Read, booking, check-in).
   */
  vehicle_service_states: defineTable({
    vehicle_owner_id: v.id("vehicle_owners"),
    service_id: v.id("services"),
    // Gate results
    is_applicable: v.boolean(),
    exclusion_reason: v.optional(v.string()),
    // Interval calculation outputs
    adjusted_interval_miles: v.optional(v.float64()),
    adjusted_interval_months: v.optional(v.float64()),
    composite_modifier: v.optional(v.float64()),
    // Due date outputs
    due_at_mileage: v.optional(v.float64()),
    due_at_date: v.optional(v.float64()),
    trigger_type: v.optional(v.string()),   // "mileage" | "time" | "both"
    // Last service anchor
    last_service_mileage: v.optional(v.float64()),
    last_service_date: v.optional(v.float64()),
    last_service_booking_id: v.optional(v.id("bookings")),
    last_service_source: v.optional(v.string()), // "user_reported" | "booking" | "smartcar"
    // Urgency
    urgency: v.string(),                    // "none" | "low" | "moderate" | "high" | "critical"
    urgency_score: v.optional(v.float64()),
    // Quick Read overrides
    quick_read_flag: v.optional(v.string()),
    quick_read_urgency: v.optional(v.string()),
    // Phase scheduling (Segment C)
    phase_visit: v.optional(v.float64()),   // 1 | 2 | 3
    is_surfaced: v.boolean(),
    calculated_at: v.float64(),
  })
    .index("by_vehicle_owner", ["vehicle_owner_id"])
    .index("by_vehicle_service", ["vehicle_owner_id", "service_id"])
    .index("by_urgency", ["vehicle_owner_id", "urgency"])
    .index("by_surfaced", ["vehicle_owner_id", "is_surfaced"]),

  /**
   * TABLE: vehicle_checkins
   *
   * Quarterly check-in responses. Append-only — every check-in is a new row.
   */
  vehicle_checkins: defineTable({
    vehicle_owner_id: v.id("vehicle_owners"),
    mode_at_checkin: v.string(),
    questions_shown: v.array(v.string()),
    answers: v.any(),
    // Denormalized key fields
    mileage_reported: v.float64(),
    mileage_projected: v.float64(),
    velocity_delta: v.float64(),
    services_reported: v.optional(v.array(v.string())),
    services_through_otopair: v.optional(v.string()), // "yes" | "no" | "partial"
    warning_lights: v.boolean(),
    symptoms_text: v.optional(v.string()),
    // Mode transition
    mode_transition_triggered: v.boolean(),
    new_mode: v.optional(v.string()),
    new_classification_id: v.optional(v.id("vehicle_classifications")),
    engine_recalc_completed_at: v.optional(v.float64()),
    // Lifecycle
    started_at: v.float64(),
    completed_at: v.optional(v.float64()),
    status: v.string(),                        // "completed" | "abandoned" | "in_progress"
    next_checkin_due: v.optional(v.float64()),
  })
    .index("by_vehicle_owner", ["vehicle_owner_id"])
    .index("by_status", ["status"])
    .index("by_next_due", ["next_checkin_due"])
    .index("by_vehicle_owner_completed", ["vehicle_owner_id", "completed_at"]),
});
