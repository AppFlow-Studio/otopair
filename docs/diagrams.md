# Database Diagrams

Mermaid diagrams for the OtoPair Convex schema — **single source** for all database diagrams. Source: [convex/schema.ts](../convex/schema.ts) (44 tables).

**How to view:** Open Markdown preview (`Ctrl+Shift+V` or right‑click → **Open Preview**). Use **Ctrl+Shift+P** → **"Markdown: Open Preview to the Side"** if diagrams don't render. Diagrams render in VS Code / Cursor and on GitHub.

---

## Overview

Three levels of detail:

| Level       | Scope             | Contents                                                                                                  |
| ----------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| **1. High** | Whole DB          | One diagram: 8 domain groups and how they connect.                                                        |
| **2. Mid**  | Per domain        | One diagram per part (8 parts): tables and FKs within that domain.                                        |
| **3. Low**  | Per table + flows | **One diagram per table** (field-level, legible); then function flow diagrams (Convex queries/mutations). |

---

## Level 1: High-level — database in 8 parts

```mermaid
flowchart LR
  User[User and onboarding]
  VehicleCatalog[Vehicle catalog and ownership]
  VehicleIntel[Vehicle intelligence]
  Shops[Shops and services]
  Core[Core transactions]
  Reviews[Reviews and follow-ups]
  AI[AI and analytics]
  SpecPipeline[Spec pipeline]

  User --> Core
  User --> VehicleCatalog
  User --> Reviews
  User --> AI
  VehicleCatalog --> Core
  VehicleCatalog --> VehicleIntel
  Shops --> Core
  Core --> Reviews
  Core --> AI
  Core --> SpecPipeline
  VehicleIntel --> SpecPipeline
```

| Part                                 | Tables                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Core transactions**             | bookings, payments, job_actuals, booking_status_history, payment_status_history                                                                  |
| **2. Vehicle catalog and ownership** | makes, models, trims, engines, transmissions, chassis_variants, vehicles, vehicle_owners                                                         |
| **3. Vehicle intelligence**          | engine_specs, transmission_specs, trim_specs, vehicle_specs, oem_parts, engine_part_fitments, transmission_part_fitments, trim_part_fitments     |
| **4. Shops and services**            | shops, mechanics, services, service_categories, service_options, shop_services, shops_hours, time_slots, service_vehicle_specs, service_insights, cdn_assets, shop_portfolio |
| **5. Reviews and follow-ups**        | reviews, follow_ups                                                                                                                              |
| **6. User and onboarding**           | users, user_question_answers, onboarding_questions, onboarding_question_answers                                                                  |
| **7. AI and analytics**              | ai_conversations, ai_messages, analytics_events, conversion_funnels                                                                              |
| **8. Spec pipeline**                 | ai_enrichment_logs, manual_review_queue, spec_variances, spec_confirmations                                                                      |

---

## Level 2: Mid-level — tables and relationships by part

### Part 1: Core transactions

```mermaid
flowchart LR
  users[users]
  vehicles[vehicles]
  shops[shops]
  services[services]
  mechanics[mechanics]
  time_slots[time_slots]
  bookings[bookings]
  payments[payments]
  job_actuals[job_actuals]
  reviews[reviews]
  booking_hist[booking_status_history]
  payment_hist[payment_status_history]

  users -->|user_id| bookings
  vehicles -->|vin| bookings
  shops -->|shop_id| bookings
  bookings -->|service_ids[]| services
  mechanics -->|mechanic_id| bookings
  time_slots -->|time_slot_id| bookings
  bookings -->|booking_id| payments
  bookings -->|booking_id| job_actuals
  bookings -->|booking_id| reviews
  bookings -->|booking_id| booking_hist
  payments -->|payment_id| payment_hist
```

---

### Part 2: Vehicle catalog and ownership

```mermaid
flowchart LR
  makes[makes]
  models[models]
  trims[trims]
  engines[engines]
  transmissions[transmissions]
  chassis_variants[chassis_variants]
  vehicles[vehicles]
  vehicle_owners[vehicle_owners]
  users[users]

  makes -->|make_id| models
  models -->|model_id| trims
  trims -->|trim_id| engines
  trims -->|trim_id| transmissions
  trims -->|trim_id| chassis_variants
  trims -->|trim_id| vehicles
  engines -->|engine_id| vehicles
  transmissions -->|transmission_id| vehicles
  chassis_variants -->|chassis_id| vehicles
  vehicles -->|vin| vehicle_owners
  users -->|user_id| vehicle_owners
```

---

### Part 3: Vehicle intelligence (specs and fitments)

```mermaid
flowchart LR
  engines[engines]
  transmissions[transmissions]
  trims[trims]
  engine_specs[engine_specs]
  transmission_specs[transmission_specs]
  trim_specs[trim_specs]
  vehicle_specs[vehicle_specs]
  oem_parts[oem_parts]
  engine_fit[engine_part_fitments]
  trans_fit[transmission_part_fitments]
  trim_fit[trim_part_fitments]

  engines -->|engine_id| engine_specs
  engines -->|engine_id| engine_fit
  engines -->|engine_id| vehicle_specs
  transmissions -->|transmission_id| transmission_specs
  transmissions -->|transmission_id| trans_fit
  trims -->|trim_id| trim_specs
  trims -->|trim_id| trim_fit
  oem_parts -->|part_id| engine_fit
  oem_parts -->|part_id| trans_fit
  oem_parts -->|part_id| trim_fit
```

---

### Part 4: Shops and services

```mermaid
flowchart LR
  service_categories[service_categories]
  services[services]
  service_options[service_options]
  shops[shops]
  mechanics[mechanics]
  shop_services[shop_services]
  shops_hours[shops_hours]
  time_slots[time_slots]
  service_vehicle_specs[service_vehicle_specs]
  service_insights[service_insights]
  cdn_assets[cdn_assets]
  shop_portfolio[shop_portfolio]
  engines[engines]

  service_categories -->|service_category_id| services
  services -->|service_id| service_options
  services -->|service_id| shop_services
  services -->|service_id| service_vehicle_specs
  services -->|service_id| service_insights
  shops -->|shop_id| mechanics
  shops -->|shop_id| shop_services
  shops -->|shop_id| shops_hours
  shops -->|shop_id| time_slots
  shops -->|shop_id| shop_portfolio
  shop_portfolio -->|content_id| cdn_assets
  engines -->|engine_id| service_insights
  engines -->|engine_id| service_vehicle_specs
```

---

### Part 5: Reviews and follow-ups

```mermaid
flowchart LR
  users[users]
  vehicles[vehicles]
  bookings[bookings]
  services[services]
  shops[shops]
  mechanics[mechanics]
  reviews[reviews]
  follow_ups[follow_ups]

  users -->|user_id| reviews
  vehicles -->|vin| follow_ups
  bookings -->|booking_id| reviews
  bookings -->|booking_id| follow_ups
  services -->|service_id| follow_ups
  users -->|user_id| follow_ups
  shops -->|shop_id| reviews
  mechanics -->|mechanic_id| reviews
```

---

### Part 6: User and onboarding

```mermaid
flowchart LR
  users[users]
  onboarding_questions[onboarding_questions]
  onboarding_question_answers[onboarding_question_answers]
  user_question_answers[user_question_answers]

  onboarding_questions -->|question_id| onboarding_question_answers
  onboarding_questions -->|question_id| user_question_answers
  users -->|user_id| user_question_answers
  onboarding_question_answers -->|answer_id| user_question_answers
```

---

## Part 7: AI and analytics

```mermaid
flowchart LR
  users[users]
  ai_conversations[ai_conversations]
  ai_messages[ai_messages]
  analytics_events[analytics_events]
  conversion_funnels[conversion_funnels]
  bookings[bookings]

  users -->|user_id| ai_conversations
  ai_conversations -->|conversation_id| ai_messages
  ai_conversations -->|booking_id| bookings
  users -->|user_id| analytics_events
  users -->|user_id| conversion_funnels
  conversion_funnels -->|booking_id| bookings
```

---

### Part 8: Spec pipeline

```mermaid
flowchart LR
  engines[engines]
  services[services]
  job_actuals[job_actuals]
  users[users]
  bookings[bookings]
  ai_enrichment_logs[ai_enrichment_logs]
  manual_review_queue[manual_review_queue]
  spec_variances[spec_variances]
  spec_confirmations[spec_confirmations]

  engines -->|engine_id| ai_enrichment_logs
  engines -->|engine_id| manual_review_queue
  engines -->|engine_id| spec_variances
  engines -->|engine_id| spec_confirmations
  services -->|service_id| ai_enrichment_logs
  services -->|service_id| manual_review_queue
  services -->|service_id| spec_variances
  services -->|service_id| spec_confirmations
  job_actuals -->|job_actual_id| spec_variances
  users -->|user_id| spec_confirmations
  bookings -->|booking_id| spec_confirmations
```

---

## Level 3: Low-level — table fields and function flows

Level 3 adds (1) per-table field and index definitions and (2) diagrams of Convex function flows (queries/mutations).

---

### Level 3 — Part 1: Core transactions (one table per diagram)

#### Table: `bookings`

One row per appointment. Multiple services are stored in the `service_ids` array; costs and time are aggregated on the row.

```mermaid
classDiagram
  class bookings {
    +id _id
    +id user_id
    +string vin
    +array service_ids (optional: list of service IDs)
    +float estimated_labor_minutes (optional)
    +id shop_id
    +id mechanic_id
    +id time_slot_id
    +string scheduled_date
    +string scheduled_time
    +float labor_cost (total)
    +float parts_cost (total)
    +float total_cost
    +string status
    +float created_at
    +float updated_at
  }
  note for bookings "indexes: by_user_id, by_shop_id, by_status,\nby_scheduled_date, by_user_and_status, by_shop_and_date,\nby_shop_and_status, by_created_at"
```

#### Table: `payments`

```mermaid
classDiagram
  class payments {
    +id _id
    +id booking_id
    +id user_id
    +id shop_id
    +float amount
    +string payment_method
    +string status
    +string transaction_id
    +string stripe_payment_intent_id
    +string idempotency_key
    +float created_at
    +float updated_at
  }
  note for payments "indexes: by_booking_id, by_user_id,\nby_status, by_idempotency_key, by_created_at"
```

#### Table: `job_actuals`

```mermaid
classDiagram
  class job_actuals {
    +id _id
    +id booking_id
    +id mechanic_id
    +float started_at
    +float actual_labor_minutes
    +float completed_at_ms
    +float actual_parts_cost
    +array parts_used
    +float difficulty_rating
    +string technician_notes
    +float created_at
    +float updated_at
    +float logged_at_ms
  }
  note for job_actuals "indexes: by_booking_id, by_mechanic_id, by_created_at"
```

#### Table: `booking_status_history`

```mermaid
classDiagram
  class booking_status_history {
    +id _id
    +id booking_id
    +string old_status
    +string new_status
    +id changed_by
    +string reason
    +float changed_at
  }
  note for booking_status_history "indexes: by_booking_id, by_changed_at"
```

#### Table: `payment_status_history`

```mermaid
classDiagram
  class payment_status_history {
    +id _id
    +id payment_id
    +string old_status
    +string new_status
    +string error_code
    +string error_message
    +float changed_at
  }
  note for payment_status_history "indexes: by_payment_id, by_changed_at"
```

---

### Level 3 — Part 2: Vehicle catalog (one table per diagram)

#### Table: `makes`

```mermaid
classDiagram
  class makes {
    +id _id
    +string name
    +string logo_url
  }
```

#### Table: `models`

```mermaid
classDiagram
  class models {
    +id _id
    +id make_id
    +string name
  }
```

#### Table: `trims`

```mermaid
classDiagram
  class trims {
    +id _id
    +id model_id
    +string name
    +float year_start
    +float year_end
  }
```

#### Table: `engines`

```mermaid
classDiagram
  class engines {
    +id _id
    +id trim_id
    +string engine_code
    +float cylinders
    +string displacement_liters
    +string fuel_type
  }
```

#### Table: `transmissions`

```mermaid
classDiagram
  class transmissions {
    +id _id
    +id trim_id
    +string transmission_type
    +string code
    +string notes
    +float created_at
    +float confidence_score
  }
  note for transmissions "indexes: by_trim, by_trim_type"
```

#### Table: `chassis_variants`

```mermaid
classDiagram
  class chassis_variants {
    +id _id
    +id trim_id
    +string drivetrain_type
    +string notes
    +float created_at
    +float confidence_score
  }
  note for chassis_variants "indexes: by_trim, by_trim_drivetrain"
```

#### Table: `vehicles`

```mermaid
classDiagram
  class vehicles {
    +id _id
    +string vin
    +id trim_id
    +id engine_id
    +id transmission_id
    +id chassis_id
    +float year
    +object metadata
    +float created_at
    +float updated_at
  }
  note for vehicles "indexes: by_vin, by_engine_id, by_trim_id,\nby_transmission, by_chassis"
```

#### Table: `vehicle_owners`

```mermaid
classDiagram
  class vehicle_owners {
    +id _id
    +string vin
    +id user_id
    +string status
    +string nickname
    +boolean is_primary
    +float mileage
    +float added_at
    +float removed_at
  }
  note for vehicle_owners "indexes: by_vin, by_user_id,\nby_vin_user, by_user_status"
```

---

### Level 3 — Part 3: Vehicle intelligence (one table per diagram)

#### Table: `engine_specs`

```mermaid
classDiagram
  class engine_specs {
    +id _id
    +id engine_id
    +string oil_viscosity
    +float oil_capacity_qts
    +string coolant_type
    +float coolant_capacity_qts
    +string brake_fluid_type
    +string oil_change_interval
    +string cabin_air_filter_interval
    +string engine_air_filter_interval
    +string spark_plug_interval
    +string serpentine_belt_interval
    +string brake_fluid_interval
    +string coolant_interval
    +string transmission_fluid_interval
    +string tire_rotation_interval
    +float confidence_score
    +float created_at
  }
  note for engine_specs "indexes: by_engine"
```

#### Table: `vehicle_specs`

```mermaid
classDiagram
  class vehicle_specs {
    +id _id
    +id engine_id
    +string oil_viscocity
    +string oil_capacity_qts
    +string oil_filter_oem
    +string oil_drain_plug_gasket_oem
    +string front_brake_pad_oem
    +string rear_brake_pad_oem
    +string front_brake_rotor_oem
    +string rear_brake_rotor_oem
    +string parking_brake_type
    +string battery_group
    +float battery_cca
    +string engine_air_filter_oem
    +string cabin_air_filter_oem
    +string spark_plug_oem
    +float spark_plug_quantity
    +float spark_plug_gap_mm
    +string serpentine_belt_oem
  }
  note for vehicle_specs "indexes: by_engine_id; used by job_actuals for suggested parts"
```

#### Table: `transmission_specs`

```mermaid
classDiagram
  class transmission_specs {
    +id _id
    +id transmission_id
    +string transmission_fluid_type
    +float transmission_fluid_capacity_qts
    +string maintenance_interval
    +float confidence_score
    +float created_at
  }
  note for transmission_specs "indexes: by_transmission"
```

#### Table: `trim_specs`

```mermaid
classDiagram
  class trim_specs {
    +id _id
    +id trim_id
    +string tire_size_front
    +string tire_size_rear
    +float recommended_tire_pressure_front_psi
    +float recommended_tire_pressure_rear_psi
    +float lug_nut_torque_ft_lbs
    +float wiper_blade_driver_size_in
    +float wiper_blade_passenger_size_in
    +float wiper_blade_rear_size_in
    +string parking_brake_type
    +float confidence_score
    +float created_at
  }
  note for trim_specs "indexes: by_trim"
```

#### Table: `oem_parts`

```mermaid
classDiagram
  class oem_parts {
    +id _id
    +string oem_part_number
    +string name
    +string category
    +string notes
    +float created_at
  }
  note for oem_parts "indexes: by_part_number, by_category"
```

#### Table: `engine_part_fitments`

```mermaid
classDiagram
  class engine_part_fitments {
    +id _id
    +id engine_id
    +id part_id
    +string role
    +float quantity
    +float spark_plug_gap_mm
    +string notes
    +float confidence_score
    +float created_at
  }
  note for engine_part_fitments "indexes: by_engine, by_engine_role, by_part"
```

#### Table: `transmission_part_fitments`

```mermaid
classDiagram
  class transmission_part_fitments {
    +id _id
    +id transmission_id
    +id part_id
    +string role
    +float quantity
    +string notes
    +float confidence_score
    +float created_at
  }
  note for transmission_part_fitments "indexes: by_transmission, by_transmission_role, by_part"
```

#### Table: `trim_part_fitments`

```mermaid
classDiagram
  class trim_part_fitments {
    +id _id
    +id trim_id
    +id part_id
    +string role
    +float quantity
    +float wiper_size_in
    +string notes
    +float confidence_score
    +float created_at
  }
  note for trim_part_fitments "indexes: by_trim, by_trim_role, by_part"
```

---

### Level 3 — Part 4: Shops and services (one table per diagram)

#### Table: `shops`

```mermaid
classDiagram
  class shops {
    +id _id
    +string name
    +string slug
    +string address
    +string city
    +string state
    +string zip
    +float lat
    +float lng
    +string phone
    +float labor_rate
    +float rating
    +float review_count
    +boolean is_active
    +boolean is_verified
  }
```

#### Table: `mechanics`

```mermaid
classDiagram
  class mechanics {
    +id _id
    +id shop_id
    +string first_name
    +string last_name
    +boolean is_active
    +float rating
    +float review_count
  }
  note for mechanics "indexes: by_shop_id, by_is_active"
```

#### Table: `service_categories`

```mermaid
classDiagram
  class service_categories {
    +id _id
    +string name
    +string icon_name
    +float display_order
  }
```

#### Table: `services`

```mermaid
classDiagram
  class services {
    +id _id
    +id service_category_id
    +string name
    +string description
    +string slug
    +float default_labor_hours
    +boolean is_labor_only
    +boolean has_options
    +float display_order
  }
```

#### Table: `service_options`

```mermaid
classDiagram
  class service_options {
    +id _id
    +id service_id
    +string option_type
    +string option_label
    +float labor_hours
    +float parts_cost_low
    +float parts_cost_high
    +float state_fee
    +float display_order
  }
```

#### Table: `shop_services`

```mermaid
classDiagram
  class shop_services {
    +id _id
    +id shop_id
    +id service_id
    +boolean is_offered
  }
  note for shop_services "indexes: by_shop_id, by_service_id, by_shop_and_service"
```

#### Table: `shops_hours`

```mermaid
classDiagram
  class shops_hours {
    +id _id
    +id shop_id
    +string day_name
    +float day_of_week
    +boolean is_closed
    +string open_time
    +string close_time
  }
  note for shops_hours "indexes: by_shop_id"
```

#### Table: `time_slots`

```mermaid
classDiagram
  class time_slots {
    +id _id
    +id shop_id
    +id mechanic_id
    +string date
    +string start_time
    +string end_time
    +boolean is_available
  }
  note for time_slots "indexes: by_shop_id, by_mechanic_id,\nby_shop_and_date, by_availability"
```

#### Table: `service_vehicle_specs`

```mermaid
classDiagram
  class service_vehicle_specs {
    +id _id
    +id engine_id
    +id service_id
    +float labor_hours
    +float parts_cost_low
    +float parts_cost_high
    +float confidence_score
    +string tech_notes
  }
  note for service_vehicle_specs "indexes: by_engine_id, by_service_id, by_engine_and_service"
```

#### Table: `service_insights`

```mermaid
classDiagram
  class service_insights {
    +id _id
    +id engine_id
    +id service_id
    +float completed_jobs_count
    +float estimated_labor_hours
    +float avg_actual_labor_hours
    +float labor_variance
    +float avg_actual_parts_cost
    +float confidence_level
  }
  note for service_insights "indexes: by_engine_id, by_service_id, by_engine_and_service"
```

#### Table: `cdn_assets`

```mermaid
classDiagram
  class cdn_assets {
    +id _id
    +string url
    +string type
    +string caption
  }
  note for cdn_assets "Stores CDN/content URLs; referenced by shop_portfolio"
```

#### Table: `shop_portfolio`

```mermaid
classDiagram
  class shop_portfolio {
    +id _id
    +id shop_id
    +id content_id
    +float display_order
  }
  note for shop_portfolio "indexes: by_shop_id"
```

---

### Level 3 — Part 5: Reviews and follow-ups (one table per diagram)

#### Table: `reviews`

```mermaid
classDiagram
  class reviews {
    +id _id
    +id booking_id
    +id user_id
    +id shop_id
    +id mechanic_id
    +float rating
    +string comment
    +float created_at
  }
  note for reviews "indexes: by_booking_id, by_shop_id, by_mechanic_id, by_user_id, by_rating"
```

#### Table: `follow_ups`

```mermaid
classDiagram
  class follow_ups {
    +id _id
    +id user_id
    +string vin
    +id booking_id
    +id service_id
    +string follow_up_type
    +float scheduled_for
    +string status
    +string message
    +float created_at
    +float sent_at
  }
  note for follow_ups "indexes: by_user_id, by_vin,\nby_status_and_scheduled, by_booking_id"
```

---

### Level 3 — Part 6: User and onboarding (one table per diagram)

#### Table: `users`

```mermaid
classDiagram
  class users {
    +id _id
    +string clerkUserId
    +string email
    +string phone
    +string first_name
    +string last_name
    +string username
    +string alias
    +string profile_photo_url
    +float car_knowledge_level
    +array user_intentions
    +boolean onboardingCompleted
    +boolean tellUsAboutCompleted
    +string auth_provider
    +float createdAt
    +boolean emailConfirmed
    +boolean phoneVerified
  }
  note for users "indexes: by_clerkUserId, by_username"
```

#### Table: `onboarding_questions`

```mermaid
classDiagram
  class onboarding_questions {
    +id _id
    +string step_name
    +string question_text
    +string question_type
    +float rank
    +float display_order
    +boolean is_active
  }
  note for onboarding_questions "indexes: by_rank, by_step_name"
```

#### Table: `onboarding_question_answers`

```mermaid
classDiagram
  class onboarding_question_answers {
    +id _id
    +id question_id
    +string answer_text
    +string answer_value
    +float display_order
    +string emoji
  }
  note for onboarding_question_answers "indexes: by_question_id"
```

#### Table: `user_question_answers`

```mermaid
classDiagram
  class user_question_answers {
    +id _id
    +id user_id
    +id question_id
    +id answer_id
    +array answer_ids
    +string free_text_answer
    +float answered_at
  }
  note for user_question_answers "indexes: by_user_and_question, by_user_id"
```

---

### Level 3 — Part 7: AI and analytics (one table per diagram)

#### Table: `ai_conversations`

```mermaid
classDiagram
  class ai_conversations {
    +id _id
    +id user_id
    +string session_id
    +float started_at
    +float ended_at
    +string scenario_detected
    +float message_count
    +id booking_id
    +boolean led_to_booking
  }
  note for ai_conversations "indexes: by_user_id, by_session_id,\nby_booking_id, by_started_at"
```

#### Table: `ai_messages`

```mermaid
classDiagram
  class ai_messages {
    +id _id
    +id conversation_id
    +string role
    +string content
    +float timestamp
    +float confidence_score
    +object metadata
  }
  note for ai_messages "indexes: by_conversation_id, by_role, by_timestamp"
```

#### Table: `analytics_events`

```mermaid
classDiagram
  class analytics_events {
    +id _id
    +id user_id
    +string event_type
    +string event_category
    +object event_data
    +float timestamp
    +string session_id
  }
  note for analytics_events "indexes: by_user_id, by_event_type,\nby_event_category, by_timestamp, by_session_id"
```

#### Table: `conversion_funnels`

```mermaid
classDiagram
  class conversion_funnels {
    +id _id
    +id user_id
    +string funnel_type
    +string stage
    +id booking_id
    +float entered_at
    +float exited_at
    +boolean completed
    +string drop_off_reason
  }
  note for conversion_funnels "indexes: by_user_id, by_funnel_type,\nby_booking_id, by_stage, by_completed, by_entered_at"
```

---

### Level 3 — Part 8: Spec pipeline (one table per diagram)

#### Table: `ai_enrichment_logs`

```mermaid
classDiagram
  class ai_enrichment_logs {
    +id _id
    +id engine_id
    +id service_id
    +string source
    +float confidence_score
    +object enriched_data
    +float created_at
    +id reviewed_by
    +string review_status
  }
  note for ai_enrichment_logs "indexes: by_engine_id, by_review_status,\nby_confidence, by_created_at"
```

#### Table: `manual_review_queue`

```mermaid
classDiagram
  class manual_review_queue {
    +id _id
    +id enrichment_log_id
    +id engine_id
    +id service_id
    +string priority
    +string reason
    +string status
    +id assigned_to
    +float created_at
    +float resolved_at
  }
  note for manual_review_queue "indexes: by_status, by_engine_id,\nby_assigned_to, by_priority_and_status, by_created_at"
```

#### Table: `spec_variances`

```mermaid
classDiagram
  class spec_variances {
    +id _id
    +id job_actual_id
    +id engine_id
    +id service_id
    +float predicted_labor_hours
    +float actual_labor_hours
    +float predicted_parts_cost
    +float actual_parts_cost
    +float variance_percentage
    +boolean flagged_for_review
    +float reviewed_at
    +string notes
    +float created_at
  }
  note for spec_variances "indexes: by_engine_id, by_service_id,\nby_flagged, by_variance, by_job_actual_id, by_created_at"
```

#### Table: `spec_confirmations`

```mermaid
classDiagram
  class spec_confirmations {
    +id _id
    +id user_id
    +id engine_id
    +id service_id
    +id booking_id
    +boolean confirmed_accurate
    +string feedback
    +float confirmed_at
  }
  note for spec_confirmations "indexes: by_engine_id, by_user_id,\nby_booking_id, by_confirmed_at"
```

---

### Level 3: Function flows

#### Flow: Booking creation (`bookings.create` / `bookings.createBatch`)

**Single-service:** `bookings.create` – one booking with `service_ids: [service_id]`.

**Multi-service (app flow):** `bookings.createBatch` – one booking per appointment; accepts `services` payload (per-service labor_cost, parts_cost from **shop labor rate only**: labor_cost = shop.labor_rate × default_labor_hours, parts_cost = default_parts_estimate); optional `taxes_and_fees`, `platform_fee`; stores `service_ids` (array of IDs); total_cost = labor + parts + taxes_and_fees + platform_fee (full amount customer pays); initial status `pending`; marks one time slot unavailable; returns `[bookingId]`.

```mermaid
flowchart TD
  A[Client: create booking] --> B[bookings.create or createBatch]
  B --> C{Vehicle exists by VIN?}
  C -->|No| D[Throw: Vehicle not found]
  C -->|Yes| E{User owns vehicle?}
  E -->|No| F[Throw: User does not own this vehicle]
  E -->|Yes| G{Time slot available?}
  G -->|No| H[Throw: Time slot no longer available]
  G -->|Yes| I[Patch time_slots: is_available = false]
  I --> J[Insert one bookings row]
  J --> K[Insert booking_status_history]
  K --> L[Insert analytics_events]
  L --> M{Funnel ID provided?}
  M -->|Yes| N[Patch conversion_funnels: completed, stage]
  M -->|No| O[Return bookingId or array]
  N --> O
```

#### Flow: Booking status update (`bookings.updateStatus`)

```mermaid
flowchart TD
  A[Client: updateStatus] --> B[bookings.updateStatus]
  B --> C[Get booking]
  C --> D{Booking exists?}
  D -->|No| E[Throw: Booking not found]
  D -->|Yes| F[booking_status_history.validateTransition]
  F --> G{Valid transition?}
  G -->|No| H[Throw: invalid transition]
  G -->|Yes| I{Terminal state?}
  I -->|Yes| J[Throw: Cannot transition from terminal]
  I -->|No| K[Patch bookings: status, updated_at]
  K --> L[scheduler.runAfter: booking_status_history.log]
  L --> M[Return success]
```

#### Flow: Payment create and status update

```mermaid
flowchart TD
  subgraph create["payments.create"]
    A1[Client: create payment] --> A2[payments.create]
    A2 --> A3[Insert payments]
    A3 --> A4[Return paymentId]
  end
  subgraph update["payments.updateStatus"]
    B1[Client: updateStatus] --> B2[payments.updateStatus]
    B2 --> B3[Get payment]
    B3 --> B4{Valid FSM transition?}
    B4 -->|No| B5[Throw]
    B4 -->|Yes| B6[Patch payments: status, updated_at]
    B6 --> B7[scheduler: payment_status_history.log]
    B7 --> B8[Return success]
  end
```

#### Flow: Service vehicle specs lookup (car-specific pricing)

```mermaid
flowchart TD
  A[Client: getSpecsForEngineAndServices engineId, serviceIds] --> B[service_vehicle_specs.getSpecsForEngineAndServices]
  B --> C[For each serviceId: query by_engine_and_service index]
  C --> D{Spec found?}
  D -->|No| E[Use services.default_labor_hours + service_options fallback]
  D -->|Yes| F[Return labor_hours, parts_cost_avg per service]
  F --> G[ShopCard/Footer: price = labor_rate × labor_hours + parts]
  E --> G
```

Single-service lookup: `getByEngineAndService(engineId, serviceId)` returns one spec or null.

#### Flow: Job actuals prefill (suggested parts)

```mermaid
flowchart TD
  A[Client: getPrefillData bookingId] --> B[job_actuals.getPrefillData]
  B --> C[Get booking, vehicle, engine]
  C --> D[Query vehicle_specs by engine_id]
  D --> E[Lookup suggested parts by service slug]
  E --> F[Return vehicleLabel, serviceName, suggestedParts OEM numbers]
```

#### Flow: Time slot availability

```mermaid
flowchart TD
  A[Client: getByShopAndDate or getAvailableByShopId] --> B[time_slots query]
  B --> C[Filter: shop_id, date optional, is_available = true]
  C --> D[Return slots]
```

---

_Source: [convex/schema.ts](../convex/schema.ts). Convex modules: [bookings](../convex/bookings.ts), [payments](../convex/payments.ts), [job_actuals](../convex/job_actuals.ts), [service_vehicle_specs](../convex/service_vehicle_specs.ts), [time_slots](../convex/time_slots.ts), [booking_status_history](../convex/booking_status_history.ts), [vehicle_specs](../convex/vehicle_specs.ts)._
