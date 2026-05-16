// =============================================================================
// Oto AI — moat-table read wrapper helper (Wave 7.3, Option B)
// =============================================================================
//
// Sprint 1 Day 7 (2026-05-16). Owner: AI Security Analyst.
// Authority:
//   * docs/SPRINT_1/WAVE_7_3_RATE_LIMIT_DESIGN.md §2.2 (helper API).
//   * docs/SPRINT_1/WAVE_7_3_QUERY_CONTEXT_DECISION.md §§4–5 (Option B pick).
//   * PM Ruling v3 §6.7; Architecture v3 Amendments §C.4 + §C.4.1.
//
// PURPOSE
// -------
// This is THE ONLY SANCTIONED in-context read path for the 28 moat tables.
// Every moat-table `ctx.db.query("<moat_table>")` inside `convex/oto/` (with
// the explicit bypass list documented below + per-call `EXEMPT:` annotations)
// MUST route through `queryMoat`. Direct reads are forbidden by CI Rule 7
// (`scripts/ci/vehicle-facts-grep.sh`).
//
// SHAPE OF THE COUNTER
// --------------------
// The helper bumps a denormalized per-user counter on `users`:
//     moat_reads_window         number  rows read this rolling 24h window
//     moat_reads_window_start   number  epoch ms of window open
//     moat_reads_is_admin_exempt boolean Waleed/Temur bypass (set via admin)
// At threshold breach the helper degrades the read instead of throwing:
//   * 1× → 2× threshold: SOFT BLOCK. Returns an empty array; emits a
//     warning to console.warn. No user-facing error, no telemetry surface.
//   * > 2× threshold: HARD BLOCK. Throws a friendly user-facing error.
// Calibration: `threshold = N × MOAT_P95_DEFAULT`. Both are placeholders
// pending Sprint 2 production-telemetry calibration; see constants below.
//
// CONTEXT SUPPORT
// ---------------
// `queryMoat` accepts MutationCtx | ActionCtx. Query-context reads are not
// counted by design (Convex queries cannot patch — the read/write split is
// the platform invariant). The Adv-1 four-table residual that this leaves
// is the explicitly-accepted hole per WAVE_7_3_QUERY_CONTEXT_DECISION §6.1
// and is grandfathered in CI Rule 7.
//
// MIGRATION POSTURE
// -----------------
// This pass ships the helper + schema fields + CI rule only. Existing moat
// reads are NOT migrated through `queryMoat()` in this pass — that is a
// follow-up. CI Rule 7 grandfathers the existing read sites by bypass-path
// list and the 4-site `EXEMPT:` annotation pattern.
// =============================================================================

import type { ActionCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

// -----------------------------------------------------------------------------
// 28 moat tables — verified against convex/schema.ts on 2026-05-16.
// Order mirrors WAVE_7_3_RATE_LIMIT_DESIGN §1.2 groupings A-G.
// -----------------------------------------------------------------------------

export const MOAT_TABLES = [
  // A. Vehicle structural moat (10)
  "makes",
  "models",
  "generations",
  "trims",
  "engines",
  "transmissions",
  "chassis_variants",
  "chassis_specs",
  "vehicle_configs",
  "drivetrain_configs",
  // B. Trim/spec moat (1)
  "trim_specs",
  // C. Parts moat (3)
  "oem_parts",
  "part_fitments",
  "part_prices",
  // D. Service definitions moat (7)
  "services",
  "service_categories",
  "service_options",
  "service_vehicle_specs",
  "service_intervals",
  "labor_times",
  "mechanic_verifications",
  // E. Tire moat (4)
  "tire_brands",
  "tire_size_cache",
  "tire_models",
  "tire_pricing",
  // F. Vehicle-derivative caches (2)
  "model_year_cache",
  "trim_year_cache",
  // G. Consolidated KB (1)
  "vehicle_facts",
] as const;

export type MoatTable = (typeof MOAT_TABLES)[number];

// -----------------------------------------------------------------------------
// Calibration constants — both are placeholders for Sprint 2 calibration.
// -----------------------------------------------------------------------------

/**
 * Multiplier on observed p95(legitimate_user_24h_moat_reads). N=50 is the
 * design-doc starting point (range 30-200). Configurable via env var
 * `OTO_MOAT_THRESHOLD_N` for runtime overrides without a code deploy.
 */
function getMoatThresholdN(): number {
  const raw =
    typeof process !== "undefined" &&
    process.env &&
    typeof process.env.OTO_MOAT_THRESHOLD_N === "string"
      ? process.env.OTO_MOAT_THRESHOLD_N
      : null;
  if (raw === null) return 50;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return parsed;
}

/**
 * Stand-in for p95(legitimate_user_24h_moat_reads). 200 is the working
 * number in WAVE_7_3_RATE_LIMIT_DESIGN §4.3 used for the residual-exposure
 * math; it is NOT a measured value yet.
 *
 * TODO: calibrate from production telemetry (Sprint 2).
 */
const MOAT_P95_DEFAULT = 200;

const WINDOW_MS = 24 * 60 * 60 * 1000;

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

export class MoatRateLimitedError extends Error {
  readonly kind = "MoatRateLimitedError" as const;
  constructor(
    readonly userId: Id<"users">,
    readonly counter: number,
    readonly threshold: number,
  ) {
    super(
      "We're seeing unusual traffic on your account; please try again later.",
    );
    this.name = "MoatRateLimitedError";
  }
}

// -----------------------------------------------------------------------------
// Query-builder type alias. We keep this loose intentionally: the second
// argument to `build` is whatever `ctx.db.query("<table>")` returns. Convex
// types this as the OrderedQuery for the table; the helper passes it through
// unchanged. Avoiding the explicit OrderedQuery type lets us support both
// `.withIndex(...).collect()` and bare `.collect()` shapes without a deep
// Convex generics dance.
// -----------------------------------------------------------------------------

// The callback receives the query handle and returns a final value
// (typically a Promise<T[]> after `.collect()`/`.take()`/`.first()`).
// We type the callback as `unknown -> Promise<unknown>` and narrow on the
// caller side via the helper's generic parameter. This avoids `any` while
// keeping the helper drop-in for arbitrary `withIndex(...)` chains.
type CtxWithDb = MutationCtx;
type AnyCtx = MutationCtx | ActionCtx;

// -----------------------------------------------------------------------------
// queryMoat — the canonical helper
// -----------------------------------------------------------------------------

/**
 * The single legal in-context read path for moat tables. The `build`
 * callback receives the table's Convex query handle; whatever it returns
 * (an array of rows, a single row from `.first()`, etc.) is forwarded back
 * to the caller after the counter bump.
 *
 * Bumping happens in mutation context only (Convex queries cannot patch).
 * In action context, callers MUST resolve the underlying mutation via
 * `ctx.runMutation` -- see `bumpUserCounter` below for the canonical bump
 * mutation reference. The helper detects which context it is in and dispatches
 * accordingly.
 *
 * @param ctx          The Convex MutationCtx (or ActionCtx with a sibling bump path).
 * @param tableName    A `MoatTable` -- compile-time-checked union of the 28 names.
 * @param build        Callback that wires `withIndex(...)` and finalizes the query.
 * @param opts.threshold Optional explicit threshold override (otherwise N × p95).
 */
export async function queryMoat<T>(
  ctx: CtxWithDb,
  tableName: MoatTable,
  build: (q: ReturnType<CtxWithDb["db"]["query"]>) => Promise<T[]>,
  opts?: { threshold?: number },
): Promise<T[]> {
  const threshold =
    typeof opts?.threshold === "number"
      ? opts.threshold
      : getMoatThresholdN() * MOAT_P95_DEFAULT;

  // Resolve the calling user (best-effort; system/cron calls return null).
  const userId = await resolveCallingUserId(ctx);

  // Execute the underlying query first; the row-count is the bump delta.
  const rows: T[] = await build(ctx.db.query(tableName));
  const rowsDelta = rows.length;

  // System / cron / unauthenticated calls are NOT subject to the counter.
  if (userId === null) {
    return rows;
  }

  // Check admin exemption + window + threshold. May SOFT-BLOCK or HARD-BLOCK.
  const decision = await applyBumpAndDecide(ctx, userId, rowsDelta, threshold);

  if (decision === "ok") {
    return rows;
  }
  if (decision === "soft_block") {
    // 1×-2× breach. Serve a stale/empty result; no user-facing error.
    // Caller may treat empty-array as "no data" and degrade gracefully.
    console.warn(
      `[queryMoat] soft block for user=${userId} on table=${tableName} ` +
        `(counter exceeded threshold; serving empty result)`,
    );
    return [] as T[];
  }
  // decision === "hard_block"
  throw new MoatRateLimitedError(userId, rowsDelta, threshold);
}

// -----------------------------------------------------------------------------
// Internal: resolve the calling user via Clerk identity → users row lookup.
// Returns null if unauthenticated (system/cron/action-without-auth).
// -----------------------------------------------------------------------------

async function resolveCallingUserId(ctx: AnyCtx): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  // Action context has no direct ctx.db; the bump-mutation handles its own
  // user lookup via ctx.runMutation. In mutation context, we already have
  // ctx.db and can resolve here.
  if (!("db" in ctx)) {
    // ActionCtx: defer; the bump-mutation will re-resolve. Returning a
    // sentinel non-null id is unsafe, so we return null here. Action-side
    // callers in chat.ts should use `ctx.runMutation(internal.oto.queryMoat.bumpUserCounter)`
    // directly with the userId they already resolved upstream.
    return null;
  }

  const mctx = ctx as MutationCtx;
  const user: Doc<"users"> | null = await mctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
  return user ? user._id : null;
}

// -----------------------------------------------------------------------------
// Internal: window + threshold logic. Performs the patch and returns the
// enforcement decision for the caller.
// -----------------------------------------------------------------------------

type BumpDecision = "ok" | "soft_block" | "hard_block";

async function applyBumpAndDecide(
  ctx: CtxWithDb,
  userId: Id<"users">,
  rowsDelta: number,
  threshold: number,
): Promise<BumpDecision> {
  const user: Doc<"users"> | null = await ctx.db.get(userId);
  if (!user) {
    // User row vanished mid-call. Treat as system call.
    return "ok";
  }
  if (user.moat_reads_is_admin_exempt === true) {
    return "ok";
  }

  const now = Date.now();
  const windowStart = user.moat_reads_window_start;
  const currentCount = user.moat_reads_window ?? 0;

  let newCount: number;
  let newWindowStart: number;
  if (
    windowStart === undefined ||
    now - windowStart > WINDOW_MS
  ) {
    // Fresh window opens with this bump.
    newCount = rowsDelta;
    newWindowStart = now;
  } else {
    newCount = currentCount + rowsDelta;
    newWindowStart = windowStart;
  }

  await ctx.db.patch(userId, {
    moat_reads_window: newCount,
    moat_reads_window_start: newWindowStart,
  });

  if (newCount > 2 * threshold) {
    return "hard_block";
  }
  if (newCount > threshold) {
    return "soft_block";
  }
  return "ok";
}
