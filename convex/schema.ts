import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  bookings: defineTable({
    labor_cost: v.float64(),
    mechanic_id: v.optional(v.id("mechanics")),
    parts_cost: v.float64(),
    scheduled_date: v.string(),
    scheduled_time: v.string(),
    service_id: v.id("services"),
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
    .index("by_service_id", ["service_id"])
    .index("by_user_and_status", ["user_id", "status"])
    .index("by_shop_and_date", ["shop_id", "scheduled_date"])
    .index("by_shop_and_status", ["shop_id", "status"])
    .index("by_created_at", ["created_at"]),
  engines: defineTable({
    cylinders: v.float64(),
    displacement_liters: v.string(),
    engine_code: v.string(),
    fuel_type: v.string(),
    trim_id: v.id("trims"),
  }),
  job_actuals: defineTable({
    actual_labor_minutes: v.float64(),
    actual_parts_cost: v.float64(),
    booking_id: v.id("bookings"),
    // Legacy string timestamps (optional, deprecated)
    completed_at: v.optional(v.string()),
    job_completed_at: v.optional(v.string()),
    job_started_at: v.optional(v.string()),
    logged_at: v.optional(v.string()),
    // New standardized timestamps (v.float64() Unix ms)
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
  makes: defineTable({
    logo_url: v.string(),
    name: v.string(),
  }),
  mechanics: defineTable({
    first_name: v.string(),
    is_active: v.boolean(),
    last_name: v.string(),
    rating: v.float64(),
    review_count: v.float64(),
    shop_id: v.id("shops"),
  })
    .index("by_shop_id", ["shop_id"])
    .index("by_is_active", ["is_active"]),
  models: defineTable({
    make_id: v.id("makes"),
    name: v.string(),
  }),
  onboarding_question_answers: defineTable({
    answer_text: v.string(),
    answer_value: v.string(),
    display_order: v.float64(),
    emoji: v.optional(v.string()),
    question_id: v.id("onboarding_questions"),
  }).index("by_question_id", ["question_id"]),
  onboarding_questions: defineTable({
    display_order: v.float64(),
    is_active: v.boolean(),
    question_text: v.string(),
    question_type: v.string(),
    rank: v.float64(),
    step_name: v.string(),
  })
    .index("by_rank", ["rank"])
    .index("by_step_name", ["step_name"]),
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
    .index("by_user_id", ["user_id"])
    .index("by_rating", ["rating"]),
  service_categories: defineTable({
    display_order: v.float64(),
    icon_name: v.string(),
    name: v.string(),
  }),
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
  service_vehicle_specs: defineTable({
    confidence_score: v.float64(),
    engine_id: v.id("engines"),
    labor_hours: v.float64(),
    parts_cost_high: v.float64(),
    parts_cost_low: v.float64(),
    service_id: v.id("services"),
    tech_notes: v.string(),
  })
    .index("by_engine_id", ["engine_id"])
    .index("by_service_id", ["service_id"])
    .index("by_engine_and_service", ["engine_id", "service_id"]),
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
  })
    .index("by_shop_id", ["shop_id"])
    .index("by_service_id", ["service_id"])
    .index("by_shop_and_service", ["shop_id", "service_id"]),
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
  })
    .index("by_shop_id", ["shop_id"]),
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
  trims: defineTable({
    model_id: v.id("models"),
    name: v.string(),
    year_end: v.float64(),
    year_start: v.float64(),
  }),
  user_question_answers: defineTable({
    answer_id: v.optional(
      v.id("onboarding_question_answers")
    ),
    answer_ids: v.optional(
      v.array(v.id("onboarding_question_answers"))
    ),
    answered_at: v.float64(),
    free_text_answer: v.optional(v.string()),
    question_id: v.id("onboarding_questions"),
    user_id: v.id("users"),
  })
    .index("by_user_and_question", [
      "user_id",
      "question_id",
    ])
    .index("by_user_id", ["user_id"]),
  vehicles: defineTable({
    vin: v.string(), // canonical unique identifier
    trim_id: v.optional(v.id("trims")),
    engine_id: v.optional(v.id("engines")),
    year: v.optional(v.float64()),
    metadata: v.optional(v.any()),
    created_at: v.float64(),
    updated_at: v.float64(),
  })
    .index("by_vin", ["vin"])
    .index("by_engine_id", ["engine_id"])
    .index("by_trim_id", ["trim_id"]),

  vehicle_owners: defineTable({
    vin: v.string(), // FK-like to vehicles.vin
    user_id: v.id("users"),
    status: v.string(), // "active" | "removed"
    nickname: v.optional(v.string()),
    is_primary: v.optional(v.boolean()),
    mileage: v.optional(v.float64()),
    added_at: v.float64(),
    removed_at: v.optional(v.float64()),
  })
    .index("by_vin", ["vin"])
    .index("by_user_id", ["user_id"])
    .index("by_vin_user", ["vin", "user_id"])
    .index("by_user_status", ["user_id", "status"]),
  users: defineTable({
    alias: v.optional(v.string()),
    auth_provider: v.optional(v.string()),
    car_knowledge_level: v.optional(v.float64()),
    clerkUserId: v.string(),
    createdAt: v.float64(),
    created_at: v.optional(v.string()),
    email: v.optional(v.string()),
    emailConfirmed: v.optional(v.boolean()),
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    onboardingCompleted: v.boolean(),
    phone: v.optional(v.string()),
    phoneVerified: v.optional(v.boolean()),
    profile_photo_url: v.optional(v.string()),
    tellUsAboutCompleted: v.optional(v.boolean()),
    user_intentions: v.optional(v.array(v.string())),
    username: v.optional(v.string()),
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_username", ["username"]),
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
  // Payment tracking (separate from bookings)
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
  // Follow-up reminders and maintenance scheduling
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
  // AI conversation sessions
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
  // Individual AI messages
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
      })
    ),
  })
    .index("by_conversation_id", ["conversation_id"])
    .index("by_role", ["role"])
    .index("by_timestamp", ["timestamp"]),
  // Analytics event tracking
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
  // Conversion funnel tracking
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
  // Vehicle spec AI enrichment logs
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
  // Manual review queue for low-confidence AI enrichments
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
  // Spec variance tracking (actual vs predicted)
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
  // User confirmations of spec accuracy
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
  // Booking status history (append-only audit log)
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
  // Payment status history (append-only audit log)
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
});