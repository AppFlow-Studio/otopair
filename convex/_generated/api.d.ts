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
import type * as cdn_assets from "../cdn_assets.js";
import type * as chassis_variants from "../chassis_variants.js";
import type * as cleanup from "../cleanup.js";
import type * as client_logs from "../client_logs.js";
import type * as conversion_funnels from "../conversion_funnels.js";
import type * as crons from "../crons.js";
import type * as engines from "../engines.js";
import type * as fitments from "../fitments.js";
import type * as follow_ups from "../follow_ups.js";
import type * as http from "../http.js";
import type * as imagin from "../imagin.js";
import type * as job_actuals from "../job_actuals.js";
import type * as maintenance from "../maintenance.js";
import type * as makes from "../makes.js";
import type * as manual_review_queue from "../manual_review_queue.js";
import type * as mechanics from "../mechanics.js";
import type * as migrations from "../migrations.js";
import type * as models from "../models.js";
import type * as oemParts from "../oemParts.js";
import type * as onboarding_questions_answers from "../onboarding_questions_answers.js";
import type * as payment_status_history from "../payment_status_history.js";
import type * as payments from "../payments.js";
import type * as preferences from "../preferences.js";
import type * as reviews from "../reviews.js";
import type * as rewards from "../rewards.js";
import type * as seed from "../seed.js";
import type * as seed_services_catalog from "../seed_services_catalog.js";
import type * as service_categories from "../service_categories.js";
import type * as service_insights from "../service_insights.js";
import type * as service_options from "../service_options.js";
import type * as service_vehicle_specs from "../service_vehicle_specs.js";
import type * as services from "../services.js";
import type * as shop_portfolio from "../shop_portfolio.js";
import type * as shop_services from "../shop_services.js";
import type * as shops from "../shops.js";
import type * as shops_hours from "../shops_hours.js";
import type * as smartcar from "../smartcar.js";
import type * as spec_confirmations from "../spec_confirmations.js";
import type * as spec_variances from "../spec_variances.js";
import type * as specs from "../specs.js";
import type * as time_slots from "../time_slots.js";
import type * as transactions from "../transactions.js";
import type * as transmissions from "../transmissions.js";
import type * as trims from "../trims.js";
import type * as users from "../users.js";
import type * as vehicleEnrichment_applicabilityRules from "../vehicleEnrichment/applicabilityRules.js";
import type * as vehicleEnrichment_blockedDomains from "../vehicleEnrichment/blockedDomains.js";
import type * as vehicleEnrichment_buildSearchQueries from "../vehicleEnrichment/buildSearchQueries.js";
import type * as vehicleEnrichment_claudeExtractor from "../vehicleEnrichment/claudeExtractor.js";
import type * as vehicleEnrichment_extractionPrompts from "../vehicleEnrichment/extractionPrompts.js";
import type * as vehicleEnrichment_firecrawl from "../vehicleEnrichment/firecrawl.js";
import type * as vehicleEnrichment_gapFill from "../vehicleEnrichment/gapFill.js";
import type * as vehicleEnrichment_helpers from "../vehicleEnrichment/helpers.js";
import type * as vehicleEnrichment_mutations from "../vehicleEnrichment/mutations.js";
import type * as vehicleEnrichment_nhtsa from "../vehicleEnrichment/nhtsa.js";
import type * as vehicleEnrichment_pipelineBatch from "../vehicleEnrichment/pipelineBatch.js";
import type * as vehicleEnrichment_pipelineTest from "../vehicleEnrichment/pipelineTest.js";
import type * as vehicleEnrichment_prompts_batch1Prompt from "../vehicleEnrichment/prompts/batch1Prompt.js";
import type * as vehicleEnrichment_prompts_batch1bPrompt from "../vehicleEnrichment/prompts/batch1bPrompt.js";
import type * as vehicleEnrichment_prompts_batch2Prompt from "../vehicleEnrichment/prompts/batch2Prompt.js";
import type * as vehicleEnrichment_queries from "../vehicleEnrichment/queries.js";
import type * as vehicleEnrichment_scraper from "../vehicleEnrichment/scraper.js";
import type * as vehicleEnrichment_scraperQueries from "../vehicleEnrichment/scraperQueries.js";
import type * as vehicleEnrichment_searchPreGather from "../vehicleEnrichment/searchPreGather.js";
import type * as vehicleEnrichment_sourceRegistry from "../vehicleEnrichment/sourceRegistry.js";
import type * as vehicleEnrichment_sourceVerifier from "../vehicleEnrichment/sourceVerifier.js";
import type * as vehicleEnrichment_types from "../vehicleEnrichment/types.js";
import type * as vehicleEnrichment_utils_batchClient from "../vehicleEnrichment/utils/batchClient.js";
import type * as vehicleEnrichment_utils_claudeClient from "../vehicleEnrichment/utils/claudeClient.js";
import type * as vehicleEnrichment_validation_oemValidation from "../vehicleEnrichment/validation/oemValidation.js";
import type * as vehicleEnrichment_validation_sanityChecks from "../vehicleEnrichment/validation/sanityChecks.js";
import type * as vehicleEnrichment_verificationApi from "../vehicleEnrichment/verificationApi.js";
import type * as vehicle_mutations from "../vehicle_mutations.js";
import type * as vehicle_owners from "../vehicle_owners.js";
import type * as vehicle_pipeline from "../vehicle_pipeline.js";
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
  cdn_assets: typeof cdn_assets;
  chassis_variants: typeof chassis_variants;
  cleanup: typeof cleanup;
  client_logs: typeof client_logs;
  conversion_funnels: typeof conversion_funnels;
  crons: typeof crons;
  engines: typeof engines;
  fitments: typeof fitments;
  follow_ups: typeof follow_ups;
  http: typeof http;
  imagin: typeof imagin;
  job_actuals: typeof job_actuals;
  maintenance: typeof maintenance;
  makes: typeof makes;
  manual_review_queue: typeof manual_review_queue;
  mechanics: typeof mechanics;
  migrations: typeof migrations;
  models: typeof models;
  oemParts: typeof oemParts;
  onboarding_questions_answers: typeof onboarding_questions_answers;
  payment_status_history: typeof payment_status_history;
  payments: typeof payments;
  preferences: typeof preferences;
  reviews: typeof reviews;
  rewards: typeof rewards;
  seed: typeof seed;
  seed_services_catalog: typeof seed_services_catalog;
  service_categories: typeof service_categories;
  service_insights: typeof service_insights;
  service_options: typeof service_options;
  service_vehicle_specs: typeof service_vehicle_specs;
  services: typeof services;
  shop_portfolio: typeof shop_portfolio;
  shop_services: typeof shop_services;
  shops: typeof shops;
  shops_hours: typeof shops_hours;
  smartcar: typeof smartcar;
  spec_confirmations: typeof spec_confirmations;
  spec_variances: typeof spec_variances;
  specs: typeof specs;
  time_slots: typeof time_slots;
  transactions: typeof transactions;
  transmissions: typeof transmissions;
  trims: typeof trims;
  users: typeof users;
  "vehicleEnrichment/applicabilityRules": typeof vehicleEnrichment_applicabilityRules;
  "vehicleEnrichment/blockedDomains": typeof vehicleEnrichment_blockedDomains;
  "vehicleEnrichment/buildSearchQueries": typeof vehicleEnrichment_buildSearchQueries;
  "vehicleEnrichment/claudeExtractor": typeof vehicleEnrichment_claudeExtractor;
  "vehicleEnrichment/extractionPrompts": typeof vehicleEnrichment_extractionPrompts;
  "vehicleEnrichment/firecrawl": typeof vehicleEnrichment_firecrawl;
  "vehicleEnrichment/gapFill": typeof vehicleEnrichment_gapFill;
  "vehicleEnrichment/helpers": typeof vehicleEnrichment_helpers;
  "vehicleEnrichment/mutations": typeof vehicleEnrichment_mutations;
  "vehicleEnrichment/nhtsa": typeof vehicleEnrichment_nhtsa;
  "vehicleEnrichment/pipelineBatch": typeof vehicleEnrichment_pipelineBatch;
  "vehicleEnrichment/pipelineTest": typeof vehicleEnrichment_pipelineTest;
  "vehicleEnrichment/prompts/batch1Prompt": typeof vehicleEnrichment_prompts_batch1Prompt;
  "vehicleEnrichment/prompts/batch1bPrompt": typeof vehicleEnrichment_prompts_batch1bPrompt;
  "vehicleEnrichment/prompts/batch2Prompt": typeof vehicleEnrichment_prompts_batch2Prompt;
  "vehicleEnrichment/queries": typeof vehicleEnrichment_queries;
  "vehicleEnrichment/scraper": typeof vehicleEnrichment_scraper;
  "vehicleEnrichment/scraperQueries": typeof vehicleEnrichment_scraperQueries;
  "vehicleEnrichment/searchPreGather": typeof vehicleEnrichment_searchPreGather;
  "vehicleEnrichment/sourceRegistry": typeof vehicleEnrichment_sourceRegistry;
  "vehicleEnrichment/sourceVerifier": typeof vehicleEnrichment_sourceVerifier;
  "vehicleEnrichment/types": typeof vehicleEnrichment_types;
  "vehicleEnrichment/utils/batchClient": typeof vehicleEnrichment_utils_batchClient;
  "vehicleEnrichment/utils/claudeClient": typeof vehicleEnrichment_utils_claudeClient;
  "vehicleEnrichment/validation/oemValidation": typeof vehicleEnrichment_validation_oemValidation;
  "vehicleEnrichment/validation/sanityChecks": typeof vehicleEnrichment_validation_sanityChecks;
  "vehicleEnrichment/verificationApi": typeof vehicleEnrichment_verificationApi;
  vehicle_mutations: typeof vehicle_mutations;
  vehicle_owners: typeof vehicle_owners;
  vehicle_pipeline: typeof vehicle_pipeline;
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
