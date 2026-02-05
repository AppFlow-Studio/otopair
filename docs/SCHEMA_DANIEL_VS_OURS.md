# Schema comparison: Daniel's schema vs ours

This doc summarizes differences between **Daniel's Convex schema** (daniel-dev branch) and **our current schema** (waleedcodespace / post-merge). Use it to integrate Daniel's frontend without breaking our backend.

---

## 1. Tables only in Daniel's schema (we do not have)

| Table             | Daniel's purpose                                                                              | Our equivalent / note                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **user_vehicles** | Links user to vehicle with engine_id, mileage, nickname, vin, year, is_primary, license_plate | We use **vehicle_owners** + **vehicles** (VIN-centric). We do **not** add user_vehicles; our bookings and flows use vin + vehicle_owners. |

**Decision:** We do not add `user_vehicles`. Our app uses `vehicles` (by VIN) and `vehicle_owners` (user–vehicle link). Daniel's booking flow that expected `user_vehicle_id` would need to be wired to our `vin` + `vehicle_owners` model if we ever port that part of his flow.

---

## 2. Tables only in our schema (Daniel does not have)

We have many tables Daniel's schema does not define. These stay as-is and are not removed:

- **vehicle_owners**, **vehicles** (our vehicle model)
- **cdn_assets**, **shop_portfolio** (media/shop assets)
- **payments**, **booking_status_history**, **payment_status_history**
- **follow_ups**, **ai_conversations**, **ai_messages**, **analytics_events**, **conversion_funnels**
- **ai_enrichment_logs**, **manual_review_queue**, **spec_variances**, **spec_confirmations**
- **oem_parts**, **transmissions**, **chassis_variants**, **engine_specs**, **transmission_specs**, **trim_specs**
- **engine_part_fitments**, **transmission_part_fitments**, **trim_part_fitments**
- **fitments**, **models** (we have models; Daniel's schema snippet also has models)

---

## 3. Tables in both: field / type differences

### bookings

| Aspect       | Daniel                                    | Ours                                                                        |
| ------------ | ----------------------------------------- | --------------------------------------------------------------------------- |
| Vehicle link | **user_vehicle_id** (id("user_vehicles")) | **vin** (string, canonical VIN)                                             |
| Services     | **service_id** (single id("services"))    | **service_ids** (optional array of id("services"))                          |
| Extra fields | —                                         | **live_stage**, **created_at**, **updated_at**, **estimated_labor_minutes** |

We keep our shape (vin, service_ids, etc.). Daniel's UI that assumed a single service or user_vehicle_id would need to be adapted to vin + service_ids.

### job_actuals

| Aspect      | Daniel                                                                              | Ours                                                                       |
| ----------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Time fields | **job_started_at**, **job_completed_at**, **completed_at**, **logged_at** (strings) | **started_at**, **completed_at_ms**, **logged_at_ms** (float64 timestamps) |

We keep our timestamps and field names.

### makes

| Aspect | Daniel                | Ours                                 |
| ------ | --------------------- | ------------------------------------ |
| Logo   | **logo_url** (string) | **logo** (optional id("cdn_assets")) |

We keep **logo** as cdn_assets reference.

### mechanics

| Aspect | Daniel | Ours                                                               |
| ------ | ------ | ------------------------------------------------------------------ |
| Extra  | —      | **photo** (optional id("cdn_assets")), **title** (optional string) |

We keep photo and title.

### shops

Daniel: **address**, **city**, **state**, **zip**, **phone**, **lat**, **lng**, **labor_rate**, **rating**, **review_count**, **slug**, **name**, **is_active**, **is_verified**.  
Ours: same idea with possible extra fields (e.g. **created_at**). We keep our definition.

### time_slots

Daniel: **mechanic_id** optional. We have the same. No conflict.

### users

Structure is effectively the same (clerkUserId, email, phone, first_name, last_name, onboardingCompleted, phoneVerified, etc.). We keep our users table as-is.

### vehicle_specs (Daniel) vs vehicle_specs / engine_specs / trim_specs (ours)

- Daniel: single **vehicle_specs** with **engine_id**, **oil\_\***, **battery\_\***, **brake\_\***, etc.
- Ours: **vehicle_specs** (engine-level OEM parts), **engine_specs**, **transmission_specs**, **trim_specs** (normalized by subsystem).

We keep our split (engine_specs, transmission_specs, trim_specs, vehicle_specs).

### onboarding_questions / onboarding_question_answers / user_question_answers

Same intent; we already have these tables and use them for Daniel's additive onboarding Convex files.

---

## 4. Convex functions from Daniel's flow we added

- **users.updateProfile** – Already added for onboarding persistence (phone, phoneVerified, etc.).
- **users.completeOnboarding** – Added so that when onboarding reaches the "complete" step we set **onboardingCompleted: true** for the current user. This fixes the error: `Could not find public function for 'users:completeOnboarding'`.

---

## 5. "Not authenticated" on getOrCreateMe

If you see a Convex server error **Not authenticated** for **users:getOrCreateMe**, it usually means the mutation ran before the Clerk JWT was available to Convex (e.g. right after sign-in or on cold load). We already:

- Call **getOrCreateMe** only when **isSignedIn && userId** in the root layout.
- Use an initial 3s delay and retries with backoff before giving up.
- Catch and log failures so they don’t surface as unhandled errors.

If it still appears, increase the initial delay in `_layout.tsx` or ensure no other code path calls **getOrCreateMe** before the user is signed in.

---

## 6. Summary

- **completeOnboarding** is implemented in **convex/users.ts**; run **npx convex dev** (or deploy) so the backend has it.
- We do **not** add Daniel's **user_vehicles** table; we keep **vehicles** + **vehicle_owners**.
- All other table/field differences are documented above; we keep our schema and adapt Daniel's UI to our APIs where needed (e.g. bookings by vin, not user_vehicle_id).

Last updated: after adding users.completeOnboarding and schema comparison.
