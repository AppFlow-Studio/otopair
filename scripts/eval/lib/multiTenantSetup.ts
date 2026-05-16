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
