// Sprint 2 Day 11 Pass A — fixture-isolation cleanup hook.
//
// Retracts ALL active user_semantic_facts for the test user. Use BEFORE
// running eval cases that pre_seed user_semantic_facts to prevent the
// negative-control flap (`cross_conv_no_prior_data_envelope_empty_of_seeded_content`
// fails when prior runs left accumulated rows in the test user's table).
//
// Usage:
//   CONVEX_DEPLOY_KEY="dev:..." npx tsx scripts/eval/runs/_teardown-fixtures.ts
//   CASE_FILTER="cross_conv_" npx tsx scripts/eval/runs/_run-eval-cases.ts
//
// Auth: uses CONVEX_DEPLOY_KEY (Authorization: Convex <key>) so we can
// call `getActiveUserSemanticFactsForUser` which is `internalQuery`
// (unreachable via user JWT). retractUserSemanticFact is `mutation` so
// either auth works; we use deploy-key for consistency.
//
// Safety: this is a DEV-deployment-only test utility. It hard-retracts
// rows in the test user's user_semantic_facts table (idempotent — already-
// retracted rows are skipped per the helper's retract-idempotent guard).
// On dev with the canonical test user this is the intended behavior; on
// prod it would nuke a real user's semantic memory. Hence deploy-key gate.

import process from "node:process";

const KEY = process.env.CONVEX_DEPLOY_KEY;
const URL = process.env.CONVEX_URL ?? "https://flippant-mink-750.convex.cloud";
// Canonical test user — match the runner's USER_ID at _run-eval-cases.ts:37
const USER_ID = process.env.OTO_TEST_USER_ID ?? "md7fjepfczgwtpn0vpas2y3rrh83ggb3";

if (!KEY) {
  console.error(
    "ENV CONVEX_DEPLOY_KEY is required (deploy key needed to reach internalQuery)",
  );
  process.exit(1);
}

interface ActiveSemanticFactRow {
  fact_id: string;
  fact_type: string;
  payload: string;
  effective_confidence?: number;
}

async function call(
  path: string,
  args: Record<string, unknown>,
  kind: "query" | "mutation",
): Promise<unknown> {
  const res = await fetch(`${URL}/api/${kind}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${KEY}`,
    },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const raw = (await res.json()) as {
    status: string;
    value?: unknown;
    errorMessage?: string;
  };
  if (raw.status !== "success") {
    throw new Error(
      `${path} failed: ${raw.errorMessage?.slice(0, 300) ?? "(no message)"}`,
    );
  }
  return raw.value;
}

(async () => {
  console.log(
    `[teardown] Fetching active user_semantic_facts for user ${USER_ID} ...`,
  );
  const rows = (await call(
    "oto/memoryEditing:getActiveUserSemanticFactsForUser",
    { user_id: USER_ID, top_K: 1000 },
    "query",
  )) as ActiveSemanticFactRow[];
  console.log(`[teardown] Found ${rows.length} active rows`);

  let retracted = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await call(
        "oto/memoryEditing:retractUserSemanticFact",
        { fact_id: row.fact_id, reason: "test_fixture_teardown" },
        "mutation",
      );
      retracted++;
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? String(e);
      // Idempotent guard from the helper throws when row is already retracted;
      // treat as a no-op skip rather than a failure.
      if (msg.includes("already retracted")) {
        skipped++;
      } else {
        console.warn(
          `[teardown] retract failed for ${row.fact_id} (${row.fact_type}): ${msg.slice(0, 150)}`,
        );
        failed++;
      }
    }
  }
  console.log(
    `[teardown] Result: retracted=${retracted}, already-retracted-skipped=${skipped}, failed=${failed} (total inspected: ${rows.length})`,
  );
})();
