/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as bookings from "../bookings.js";
import type * as engines from "../engines.js";
import type * as job_actuals from "../job_actuals.js";
import type * as makes from "../makes.js";
import type * as mechanics from "../mechanics.js";
import type * as migrations from "../migrations.js";
import type * as models from "../models.js";
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
import type * as time_slots from "../time_slots.js";
import type * as trims from "../trims.js";
import type * as user_vehicles from "../user_vehicles.js";
import type * as users from "../users.js";
import type * as vehicle_specs from "../vehicle_specs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  bookings: typeof bookings;
  engines: typeof engines;
  job_actuals: typeof job_actuals;
  makes: typeof makes;
  mechanics: typeof mechanics;
  migrations: typeof migrations;
  models: typeof models;
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
  time_slots: typeof time_slots;
  trims: typeof trims;
  user_vehicles: typeof user_vehicles;
  users: typeof users;
  vehicle_specs: typeof vehicle_specs;
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
