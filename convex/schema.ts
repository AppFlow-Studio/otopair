import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  engines: defineTable({
    cylinders: v.float64(),
    displacement_liters: v.string(),
    engine_code: v.string(),
    fuel_type: v.string(),
    trim_id: v.id("trims"),
  }),

  makes: defineTable({
    logo_url: v.string(),
    name: v.string(),
  }),

  models: defineTable({
    name: v.string(),
    make_id: v.id("makes"),
  }),

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

  shop_services: defineTable({
    is_offered: v.boolean(),
    service_id: v.id("services"),
    shop_id: v.id("shops"),
  }),

  vehicle_specs: defineTable({
    battery_cca: v.float64(),
    battery_group: v.string(),
    engine_id: v.id("engines"),
    front_brake_pad_oem: v.string(),
    oil_capacity_qts: v.string(),
    oil_filter_oem: v.string(),
    oil_viscocity: v.string(),
    parking_brake_type: v.string(),
    rear_brake_pad_oem: v.string(),
  }),

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

  shops_hours: defineTable({
    close_time: v.optional(v.string()),
    day_name: v.string(),
    day_of_week: v.float64(),
    is_closed: v.boolean(),
    open_time: v.optional(v.string()),
    shop_id: v.id("shops"),
  }),

  trims: defineTable({
    model_id: v.id("models"),
    name: v.string(),
    year_end: v.float64(),
    year_start: v.float64(),
  }),

  service_options: defineTable({
    display_order: v.float64(),
    labor_hours: v.float64(),
    option_label: v.string(),
    option_type: v.string(),
    parts_cost_high: v.float64(),
    parts_cost_low: v.float64(),
    service_id: v.id("services"),
    state_fee: v.optional(v.float64()),
  }),

  service_categories: defineTable({
    display_order: v.float64(),
    icon_name: v.string(),
    name: v.string(),
  }),

  mechanics: defineTable({
    first_name: v.string(),
    is_active: v.boolean(),
    last_name: v.string(),
    rating: v.float64(),
    review_count: v.float64(),
    shop_id: v.id("shops"),
  }),

  // --- New tables ---

  users: defineTable({
    clerkUserId: v.string(),
    onboardingCompleted: v.boolean(),
    createdAt: v.number(),
    email: v.optional(v.string()),
    emailConfirmed: v.optional(v.boolean()),
    phone: v.optional(v.string()),
    phoneVerified: v.optional(v.boolean()),
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    alias: v.optional(v.string()),
    username: v.optional(v.string()),
    profile_photo_url: v.optional(v.string()),
    user_intentions: v.optional(v.array(v.string())),
    car_knowledge_level: v.optional(v.number()),
    auth_provider: v.optional(v.string()),
    tellUsAboutCompleted: v.optional(v.boolean()),
    created_at: v.optional(v.string()),
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_username", ["username"]),

  user_vehicles: defineTable({
    engine_id: v.id("engines"),
    user_id: v.id("users"),

    vin: v.optional(v.string()),
    license_plate: v.optional(v.string()),
    year: v.float64(),
    mileage: v.float64(),
    nickname: v.string(),
    is_primary: v.boolean(),
  }),

  service_vehicle_specs: defineTable({
    service_id: v.id("services"),
    engine_id: v.id("engines"),
    labor_hours: v.float64(),
    parts_cost_low: v.float64(),
    parts_cost_high: v.float64(),
    tech_notes: v.string(),
    confidence_score: v.float64(),
  }),

  time_slots: defineTable({
    shop_id: v.id("shops"),
    mechanic_id: v.optional(v.id("mechanics")),
    date: v.string(),
    start_time: v.string(),
    end_time: v.string(),
    is_available: v.boolean(),
  }),

  bookings: defineTable({
    user_id: v.id("users"),
    user_vehicle_id: v.id("user_vehicles"),
    shop_id: v.id("shops"),
    mechanic_id: v.optional(v.id("mechanics")),
    service_id: v.id("services"),
    time_slot_id: v.id("time_slots"),
    scheduled_date: v.string(),
    scheduled_time: v.string(),
    labor_cost: v.float64(),
    parts_cost: v.float64(),
    total_cost: v.float64(),
    status: v.string(),
  }),

  job_actuals: defineTable({
    booking_id: v.id("bookings"),
    mechanic_id: v.id("mechanics"),
    actual_labor_minutes: v.float64(),
    parts_used: v.array(
      v.object({
        part_name: v.string(),
        oem_number: v.string(),
        cost: v.float64(),
      }),
    ),
    actual_parts_cost: v.float64(),
    difficulty_rating: v.float64(),
    technician_notes: v.string(),
    job_started_at: v.string(),
    job_completed_at: v.optional(v.string()),
    logged_at: v.optional(v.string()),
    completed_at: v.string(),
  }),

  service_insights: defineTable({
    service_id: v.id("services"),
    engine_id: v.id("engines"),
    estimated_labor_hours: v.float64(),
    avg_actual_labor_hours: v.float64(),
    avg_actual_parts_cost: v.float64(),
    completed_jobs_count: v.float64(),
    labor_variance: v.float64(),
    confidence_level: v.float64(),
  }),

  reviews: defineTable({
    booking_id: v.id("bookings"),
    user_id: v.id("users"),
    shop_id: v.id("shops"),
    mechanic_id: v.optional(v.id("mechanics")),
    rating: v.float64(),
    comment: v.string(),
  }),

  onboarding_questions: defineTable({
    question_text: v.string(),
    rank: v.number(),
    step_name: v.string(),
    question_type: v.string(),
    display_order: v.number(),
    is_active: v.boolean(),
  })
    .index("by_rank", ["rank"])
    .index("by_step_name", ["step_name"]),

  onboarding_question_answers: defineTable({
    question_id: v.id("onboarding_questions"),
    answer_text: v.string(),
    answer_value: v.string(),
    display_order: v.number(),
    emoji: v.optional(v.string()),
  }).index("by_question_id", ["question_id"]),

  user_question_answers: defineTable({
    user_id: v.id("users"),
    question_id: v.id("onboarding_questions"),
    answer_id: v.optional(v.id("onboarding_question_answers")),
    answer_ids: v.optional(v.array(v.id("onboarding_question_answers"))),
    free_text_answer: v.optional(v.string()),
    answered_at: v.number(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_user_and_question", ["user_id", "question_id"]),
});
