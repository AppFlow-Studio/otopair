// =============================================================================
// multiTenantSetup — eval-harness fixture for the two-tenant cross-read test
// =============================================================================
//
// Sprint 1 Day 4 (2026-05-16). Owner: Memory Systems Engineer.
//
// Provisions the data shape that:
//   • Wave 1.4 v3 case (d) — cross-tenant read — needs, AND
//   • Wave 5.1 Cat G entries — cross-tenant labeled-set queries — need.
//
// Two synthetic users (A + B) + one fully-enriched vehicle_config that user A
// nominally "owns" and user B queries about. The assertion the harness will
// run: when user B asks a Tier-1 question about A's fixture, the cascade
// returns the T1 row WITHOUT firing the disclaim tag and WITHOUT a re-enrich
// job (it's already enriched).
//
// API contract
// ------------
//   import { seedTenants, teardownTenants } from "./multiTenantSetup";
//   const tenants = await seedTenants(client);
//   // ... run harness against tenants.vehicle_config_id ...
//   await teardownTenants(client);
//
// Idempotency
// -----------
// `seedTenants` is idempotent — it looks up users by email and the
// vehicle_config by stable composite key and reuses existing rows. Re-running
// is a no-op on data shape.
//
// `teardownTenants` is idempotent — missing rows are silently skipped.
//
// Sentinel namespace
// ------------------
// All rows are stamped via `make = "EvalTest"` or attached transitively to a
// row that traces back to it. Production chat reads MUST filter out this
// make (see Day-5 TODO in convex/oto/migrations/evalTenantsSeed.ts).
//
// Implementation
// --------------
// HTTP-API based — same `OTO_EVAL_CONVEX_URL` / `OTO_EVAL_CONVEX_KEY` env
// vars the existing harness uses (see cascadeClient.ts). We dispatch two
// internalMutations defined in convex/oto/migrations/evalTenantsSeed.ts:
//   • internal.oto.migrations.evalTenantsSeed.seedEvalTenants
//   • internal.oto.migrations.evalTenantsSeed.teardownEvalTenants
//
// internalMutations are not callable from the regular `/api/mutation` route
// without a deployment key with admin privileges, which is exactly what
// `OTO_EVAL_CONVEX_KEY` is intended to be. The Convex HTTP API for invoking
// an internal function from a deploy key is `POST /api/mutation` with the
// path `oto/migrations/evalTenantsSeed:seedEvalTenants` and Bearer auth.
// =============================================================================

// We don't import ConvexClient — the existing harness uses fetch-based HTTP
// per cascadeClient.ts. The `client` parameter is the same shape (URL + key);
// in practice the caller passes the env-driven config directly.

export const TEST_USER_A_EMAIL = "eval-user-a@oto-eval.local";
export const TEST_USER_B_EMAIL = "eval-user-b@oto-eval.local";

export const EVAL_SENTINEL_MAKE = "EvalTest";
export const EVAL_FIXTURE_MODEL = "CrossTenantFixture";
export const EVAL_FIXTURE_YEAR = 9999;
export const EVAL_FIXTURE_CHASSIS_CODE = "EVAL-CHASSIS-A";
export const EVAL_FIXTURE_ENGINE_CODE = "EVAL-I4-1.5T";

// -- Public ClientConfig (the existing harness already builds this shape) -----

export interface ConvexClient {
  url: string;
  authKey: string;
}

// -- Result shape -------------------------------------------------------------

export interface SeededTenants {
  user_a_id: string;
  user_b_id: string;
  vehicle_config_id: string;
  make: string;
  model: string;
  year_min: number;
  year_max: number;
  chassis_code: string;
  engine_code: string;
}

interface ConvexHttpResponse<T> {
  status: "success" | "error";
  value?: T;
  errorMessage?: string;
}

// -- Env-config helper (mirrors cascadeClient.ts) -----------------------------

export function configFromEnv(): ConvexClient {
  const url = process.env.OTO_EVAL_CONVEX_URL;
  const authKey = process.env.OTO_EVAL_CONVEX_KEY;
  if (!url || !authKey) {
    throw new Error(
      "multiTenantSetup: OTO_EVAL_CONVEX_URL and OTO_EVAL_CONVEX_KEY are required. " +
        "These are the same env vars the cascade client uses.",
    );
  }
  return { url, authKey };
}

// -- Internal: HTTP POST to /api/mutation -------------------------------------

async function postMutation<T>(
  client: ConvexClient,
  path: string,
  args: Record<string, unknown>,
): Promise<T> {
  const endpoint = `${client.url.replace(/\/$/, "")}/api/mutation`;
  const body = { path, args, format: "json" };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${client.authKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `multiTenantSetup: ${path} HTTP ${res.status}: ${text.slice(0, 300)}`,
    );
  }

  const raw = (await res.json()) as ConvexHttpResponse<T>;
  if (raw.status !== "success" || raw.value === undefined) {
    throw new Error(
      `multiTenantSetup: ${path} returned status="${raw.status}" message="${raw.errorMessage ?? "(none)"}"`,
    );
  }
  return raw.value;
}

// -- Public: seedTenants ------------------------------------------------------
//
// Calls `internal.oto.migrations.evalTenantsSeed.seedEvalTenants` which
// idempotently provisions:
//   • users by email (TEST_USER_A_EMAIL / TEST_USER_B_EMAIL)
//   • the sentinel `makes` / `models` / `trims` / `engines` / `chassis_specs`
//     rows
//   • the `vehicle_configs` row with stable composite key
//   • a `trim_specs` row tied to the config
//
// Returns the SeededTenants shape with the Convex ids and convenience scope
// keys for the cross-tenant queries.

export async function seedTenants(
  client: ConvexClient,
): Promise<SeededTenants> {
  return await postMutation<SeededTenants>(
    client,
    "oto/migrations/evalTenantsSeed:seedEvalTenants",
    {},
  );
}

// -- Public: teardownTenants --------------------------------------------------
//
// Calls `internal.oto.migrations.evalTenantsSeed.teardownEvalTenants` which
// deletes the sentinel rows in reverse-FK order. Idempotent.

export async function teardownTenants(client: ConvexClient): Promise<void> {
  await postMutation<{ deleted: number }>(
    client,
    "oto/migrations/evalTenantsSeed:teardownEvalTenants",
    {},
  );
}

// =============================================================================
// Verified-fact authoring helpers (Sprint 2 Day 2)
// =============================================================================
//
// HTTP-client wrappers around the two internalMutations defined in
// `convex/oto/migrations/verifiedFactsSeed.ts`. These exist so that future
// cross-tenant verified/unverified case authoring in the eval harness
// (Wave 1.4 v3 case (d) family) is one line per case instead of an inline
// recordVehicleFact + editVehicleFact sequence.
//
// The Convex-side mutations enforce all the v3 invariants:
//   - source is locked to "web_search" (the only path where verify-after-
//     record is meaningful)
//   - confidence floor of 0.7 (enforced by recordVehicleFact)
//   - canonical_question_key derived via canonicalize.ts (same path the
//     chat agent uses, so the canonical-hash probe collides correctly)
//   - audit-row atomicity preserved (every verify call routes through
//     editVehicleFact, which writes the paired audit row in the same
//     transaction)
//
// CI grep Rules 1 + 3 stay green: this file never touches vehicle_facts
// or vehicle_facts_audit directly — it only POSTs to Convex.
// =============================================================================

// -- Public args + result shapes ---------------------------------------------

export type VerifiedFactScope =
  | "vehicle_config"
  | "trim"
  | "chassis"
  | "engine"
  | "model_year";

export interface SeedVerifiedFactArgs {
  scope: VerifiedFactScope;
  scope_key: string;
  topic: string;
  fact_text: string;
  question_text: string;
  source: "web_search";
  confidence: number;
  /** Default: true. Pass false to leave the row at verification_status="unverified". */
  verify?: boolean;
  /** Required when verify=true. Stamped on the audit row. */
  editor_user_id?: string;
  /** Optional. Stamped on vehicle_facts.asked_by_user_id. */
  asked_by_user_id?: string;

  // Scope-detail args — pass the subset that matches `scope`.
  vehicle_config_id?: string;
  chassis_code?: string;
  engine_code?: string;
  make?: string;
  model?: string;
  trim_name?: string;
  year_min?: number;
  year_max?: number;
}

export interface SeededVerifiedFact {
  fact_id: string;
}

// -- Public: seedVerifiedFact ------------------------------------------------
//
// Calls `internal.oto.migrations.verifiedFactsSeed.seedEvalVerifiedFact`,
// which:
//   1. Computes canonical_question_key via convex/oto/canonicalize.ts.
//   2. Routes to api.oto.vehicleFactsEditing.recordVehicleFact to land
//      the row (web_search → unverified by default, audit-row-free
//      creation per D-3.2 relocation).
//   3. If `verify` is true (default), routes to
//      api.oto.vehicleFactsEditing.editVehicleFact with action="verify"
//      to flip verification_status → "verified". The audit row writes
//      atomically as part of editVehicleFact.
//
// Returns the new (or de-duped) fact_id.
//
// Idempotent — re-seeding the same canonical question key reuses the
// existing fact and gracefully no-ops the verify step on a row already
// in "verified" state.

export async function seedVerifiedFact(
  client: ConvexClient,
  args: SeedVerifiedFactArgs,
): Promise<SeededVerifiedFact> {
  return await postMutation<SeededVerifiedFact>(
    client,
    "oto/migrations/verifiedFactsSeed:seedEvalVerifiedFact",
    args as unknown as Record<string, unknown>,
  );
}

// -- Public: cleanupVerifiedFact ---------------------------------------------
//
// Calls `internal.oto.migrations.verifiedFactsSeed.cleanupEvalVerifiedFact`,
// which deletes (in reverse-FK order):
//   1. fact_reports rows pointing at the fact (by_fact index)
//   2. vehicle_facts_audit rows pointing at the fact (by_fact index)
//   3. the vehicle_facts row itself
//
// All deletes scoped strictly to the passed fact_id. Idempotent —
// missing rows at any stage are silently skipped.
//
// NOTE: The teardown is fact_id-keyed, NOT verification-status-keyed. It
// works uniformly for verified and unverified facts. The "Verified" in the
// name is historical (the helper landed as the verified-fact companion in
// Sprint 2 Day 2); the d-003 unverified case reuses this same teardown
// without a separate cleanupUnverifiedFact wrapper.

export async function cleanupVerifiedFact(
  client: ConvexClient,
  args: { fact_id: string },
): Promise<void> {
  await postMutation<{
    reports_deleted: number;
    audit_deleted: number;
    fact_deleted: number;
  }>(
    client,
    "oto/migrations/verifiedFactsSeed:cleanupEvalVerifiedFact",
    args as unknown as Record<string, unknown>,
  );
}

// -- Public: seedUnverifiedFact ----------------------------------------------
//
// Sprint 2 Day 3 (QA Lead — crosstenant-d-003 wire-up).
//
// HTTP-only wrapper that calls `seedEvalVerifiedFact` with verify=false.
// No new internalMutation is required because the underlying mutation
// already exposes a `verify` boolean that defaults to true; flipping it to
// false skips the paired editVehicleFact("verify") call and leaves the row
// at verification_status="unverified", which is the d-003 setup the case
// needs.
//
// Args mirror SeedVerifiedFactArgs minus the verify/editor_user_id fields,
// since both are forced to the unverified configuration (verify=false, no
// editor required).
//
// Returns the new (or de-duped) fact_id — same shape as seedVerifiedFact
// so the case-site code stays symmetric.
//
// Teardown: use the existing `cleanupVerifiedFact(client, { fact_id })` —
// the cleanup is fact_id-keyed and works uniformly for unverified facts.

export type SeedUnverifiedFactArgs = Omit<
  SeedVerifiedFactArgs,
  "verify" | "editor_user_id"
>;

export async function seedUnverifiedFact(
  client: ConvexClient,
  args: SeedUnverifiedFactArgs,
): Promise<SeededVerifiedFact> {
  const verifiedArgs: SeedVerifiedFactArgs = {
    ...args,
    verify: false,
  };
  return await postMutation<SeededVerifiedFact>(
    client,
    "oto/migrations/verifiedFactsSeed:seedEvalVerifiedFact",
    verifiedArgs as unknown as Record<string, unknown>,
  );
}
