# OtoPair Database Diagrams

Diagrams reflect the current Convex schema ([convex/schema.ts](convex/schema.ts)) — 44 tables, broken into **one high-level view** and **one detailed diagram per part**.

**How to view:** Open **Markdown preview** (`Ctrl+Shift+V` or right‑click → **Open Preview**). Use **Ctrl+Shift+P** → **"Markdown: Open Preview to the Side"** if diagrams don’t render.

---

## High-level: database in 8 parts

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

| Part | Tables |
|------|--------|
| **1. Core transactions** | bookings, payments, job_actuals, booking_status_history, payment_status_history |
| **2. Vehicle catalog and ownership** | makes, models, trims, engines, transmissions, chassis_variants, vehicles, vehicle_owners |
| **3. Vehicle intelligence** | engine_specs, transmission_specs, trim_specs, oem_parts, engine_part_fitments, transmission_part_fitments, trim_part_fitments |
| **4. Shops and services** | shops, mechanics, services, service_categories, service_options, shop_services, shops_hours, time_slots, service_vehicle_specs, service_insights |
| **5. Reviews and follow-ups** | reviews, follow_ups |
| **6. User and onboarding** | users, user_question_answers, onboarding_questions, onboarding_question_answers |
| **7. AI and analytics** | ai_conversations, ai_messages, analytics_events, conversion_funnels |
| **8. Spec pipeline** | ai_enrichment_logs, manual_review_queue, spec_variances, spec_confirmations |

---

## Part 1: Core transactions

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
  services -->|service_id| bookings
  mechanics -->|mechanic_id| bookings
  time_slots -->|time_slot_id| bookings
  bookings -->|booking_id| payments
  bookings -->|booking_id| job_actuals
  bookings -->|booking_id| reviews
  bookings -->|booking_id| booking_hist
  payments -->|payment_id| payment_hist
```

---

## Part 2: Vehicle catalog and ownership

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

## Part 3: Vehicle intelligence (specs and fitments)

```mermaid
flowchart LR
  engines[engines]
  transmissions[transmissions]
  trims[trims]
  engine_specs[engine_specs]
  transmission_specs[transmission_specs]
  trim_specs[trim_specs]
  oem_parts[oem_parts]
  engine_fit[engine_part_fitments]
  trans_fit[transmission_part_fitments]
  trim_fit[trim_part_fitments]

  engines -->|engine_id| engine_specs
  engines -->|engine_id| engine_fit
  transmissions -->|transmission_id| transmission_specs
  transmissions -->|transmission_id| trans_fit
  trims -->|trim_id| trim_specs
  trims -->|trim_id| trim_fit
  oem_parts -->|part_id| engine_fit
  oem_parts -->|part_id| trans_fit
  oem_parts -->|part_id| trim_fit
```

---

## Part 4: Shops and services

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
  engines -->|engine_id| service_insights
  engines -->|engine_id| service_vehicle_specs
```

---

## Part 5: Reviews and follow-ups

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

## Part 6: User and onboarding

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

## Part 8: Spec pipeline

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

*Source: [convex/schema.ts](convex/schema.ts).*
