/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_conversations from "../ai_conversations.js";
import type * as ai_enrichment_logs from "../ai_enrichment_logs.js";
import type * as ai_messages from "../ai_messages.js";
import type * as analytics_events from "../analytics_events.js";
import type * as booking_status_history from "../booking_status_history.js";
import type * as bookings from "../bookings.js";
import type * as conversion_funnels from "../conversion_funnels.js";
import type * as engines from "../engines.js";
import type * as follow_ups from "../follow_ups.js";
import type * as job_actuals from "../job_actuals.js";
import type * as makes from "../makes.js";
import type * as manual_review_queue from "../manual_review_queue.js";
import type * as mechanics from "../mechanics.js";
import type * as migrations from "../migrations.js";
import type * as models from "../models.js";
import type * as payment_status_history from "../payment_status_history.js";
import type * as payments from "../payments.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";
import type * as service_categories from "../service_categories.js";
import type * as service_insights from "../service_insights.js";
import type * as service_options from "../service_options.js";
import type * as service_vehicle_specs from "../service_vehicle_specs.js";
import type * as services from "../services.js";
import type * as shop_services from "../shop_services.js";
import type * as shops from "../shops.js";
import type * as shops_hours from "../shops_hours.js";
import type * as spec_confirmations from "../spec_confirmations.js";
import type * as spec_variances from "../spec_variances.js";
import type * as time_slots from "../time_slots.js";
import type * as trims from "../trims.js";
import type * as user_vehicles from "../user_vehicles.js";
import type * as users from "../users.js";
import type * as vehicle_owners from "../vehicle_owners.js";
import type * as vehicle_specs from "../vehicle_specs.js";
import type * as vehicles from "../vehicles.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai_conversations: typeof ai_conversations;
  ai_enrichment_logs: typeof ai_enrichment_logs;
  ai_messages: typeof ai_messages;
  analytics_events: typeof analytics_events;
  booking_status_history: typeof booking_status_history;
  bookings: typeof bookings;
  conversion_funnels: typeof conversion_funnels;
  engines: typeof engines;
  follow_ups: typeof follow_ups;
  job_actuals: typeof job_actuals;
  makes: typeof makes;
  manual_review_queue: typeof manual_review_queue;
  mechanics: typeof mechanics;
  migrations: typeof migrations;
  models: typeof models;
  payment_status_history: typeof payment_status_history;
  payments: typeof payments;
  reviews: typeof reviews;
  seed: typeof seed;
  service_categories: typeof service_categories;
  service_insights: typeof service_insights;
  service_options: typeof service_options;
  service_vehicle_specs: typeof service_vehicle_specs;
  services: typeof services;
  shop_services: typeof shop_services;
  shops: typeof shops;
  shops_hours: typeof shops_hours;
  spec_confirmations: typeof spec_confirmations;
  spec_variances: typeof spec_variances;
  time_slots: typeof time_slots;
  trims: typeof trims;
  user_vehicles: typeof user_vehicles;
  users: typeof users;
  vehicle_owners: typeof vehicle_owners;
  vehicle_specs: typeof vehicle_specs;
  vehicles: typeof vehicles;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
