/**
 * Retrieval-miss fact acquisition — unsourced → sourced supersede path.
 *
 * `recordVehicleFact` dedupes on canonical_question_key and, on a hit, patches
 * only asked_at/updated_at. It deliberately will NOT overwrite fact_text,
 * source, or cited_url. That is correct for a repeat ask, but it meant the
 * background acquisition job could never land its sourced row: the chat agent
 * writes an unsourced `oto_inferred` guess on the same canonical key while the
 * job is still web-searching, so by write time the key was taken and the
 * insert silently degraded to a telemetry touch — citation lost, no error.
 *
 * The fix is retract-then-insert (editVehicleFact → recordVehicleFact), which
 * requires the dedupe to stop counting retracted rows as live. These tests pin
 * both halves: the dedupe must skip retracted rows, and must still dedupe live
 * ones.
 *
 * Why not edit-in-place: `recordVehicleFact` derives verification_status from
 * source, and only web_search starts "unverified" — so the oto_inferred
 * squatter is created "verified". Flipping just its source would leave
 * (web_search, verified), making the locked F.5 predicate render_disclaim_tag
 * compute FALSE and serving a web-scraped fact with no disclosure. A fresh
 * insert derives "unverified" correctly. The last test pins that.
 */
import { describe, test, expect } from "vitest";
import { internal } from "../convex/_generated/api";
import { makeT } from "./helpers";

const KEY = "sha256_oil_capacity_audi_rs5";

/** The sourced row the acquisition job wants to write. */
const SOURCED = {
  topic: "oil_capacity_qts",
  topic_axis: "vehicle" as const,
  fact_text: "The Audi RS5 2.9T takes 6.9 quarts of 0W-40.",
  question_text: "what's the oil capacity of an Audi RS5?",
  canonical_question_key: KEY,
  source: "web_search" as const,
  cited_url: "https://www.audi.com/owners-manual/rs5",
  written_by: "system" as const,
  confidence: 0.7,
};

async function seedSquatter(
  t: ReturnType<typeof makeT>,
  verification_status: "verified" | "unverified" | "retracted",
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkUserId: `clerk_asker_${Math.random().toString(36).slice(2)}`,
      email: "asker@test.local",
      role: "user",
      createdAt: Date.now(),
    } as any);
    // The chat agent's training-knowledge guess: no cited_url.
    const factId = await ctx.db.insert("vehicle_facts", {
      topic: "oil_capacity_qts",
      topic_axis: "vehicle",
      fact_text: "The Audi RS5 takes about 7 quarts.",
      question_text: "what's the oil capacity of an Audi RS5?",
      canonical_question_key: KEY,
      source: "oto_inferred",
      confidence: 0.5,
      written_by: "chat_agent",
      verification_status,
      report_count: 0,
      created_at: Date.now(),
    } as any);
    return { userId, factId };
  });
}

async function rowsForKey(t: ReturnType<typeof makeT>) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("vehicle_facts")
      .withIndex("by_canonical_question", (q: any) =>
        q.eq("canonical_question_key", KEY),
      )
      .collect(),
  );
}

describe("recordVehicleFact dedupe vs retracted rows", () => {
  test("a live row still dedupes — no duplicate insert", async () => {
    const t = makeT();
    const { factId } = await seedSquatter(t, "verified");

    const returned = await t.mutation(
      internal.oto.vehicleFactsEditing.recordVehicleFact,
      SOURCED,
    );

    expect(returned).toBe(factId);
    const rows = await rowsForKey(t);
    expect(rows).toHaveLength(1);
    // Semantic fields untouched — the telemetry-patch contract holds.
    expect(rows[0].source).toBe("oto_inferred");
    expect(rows[0].cited_url ?? null).toBeNull();
  });

  test("a retracted row does NOT block the insert", async () => {
    const t = makeT();
    const { factId } = await seedSquatter(t, "retracted");

    const returned = await t.mutation(
      internal.oto.vehicleFactsEditing.recordVehicleFact,
      SOURCED,
    );

    // A genuinely new row, not the retracted one patched.
    expect(returned).not.toBe(factId);
    const rows = await rowsForKey(t);
    expect(rows).toHaveLength(2);

    const live = rows.filter((r: any) => r.verification_status !== "retracted");
    expect(live).toHaveLength(1);
    expect(live[0].source).toBe("web_search");
    expect(live[0].cited_url).toBe(SOURCED.cited_url);
  });
});

describe("acquisition supersede: editVehicleFact retract → recordVehicleFact", () => {
  test("supersedes the unsourced squatter and lands a disclosable row", async () => {
    const t = makeT();
    const { userId, factId } = await seedSquatter(t, "verified");

    // Step 1 — retract the unsourced squatter through the sanctioned helper,
    // which writes the paired audit row in the same transaction.
    await t.mutation(internal.oto.vehicleFactsEditing.editVehicleFact, {
      fact_id: factId,
      action: "retract",
      editor_id: userId,
      reason:
        "Unsourced answer superseded by a web-sourced fact acquired on retrieval miss.",
      changes: { verification_status: "retracted" },
    });

    // Step 2 — the sourced row now has an unoccupied canonical key.
    await t.mutation(
      internal.oto.vehicleFactsEditing.recordVehicleFact,
      SOURCED,
    );

    const rows = await rowsForKey(t);
    const live = rows.filter((r: any) => r.verification_status !== "retracted");
    expect(live).toHaveLength(1);

    const fact = live[0] as any;
    expect(fact.source).toBe("web_search");
    expect(fact.cited_url).toBe(SOURCED.cited_url);
    expect(fact.written_by).toBe("system");
    // The reason edit-in-place was rejected: a fresh insert derives
    // "unverified" from the source rule, so F.5 render_disclaim_tag
    // (web_search && unverified) computes TRUE and the answer is disclosed.
    expect(fact.verification_status).toBe("unverified");

    // The retraction is audited — the append-only invariant held.
    const audit = await t.run(async (ctx) =>
      ctx.db.query("vehicle_facts_audit").collect(),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("retract");
    expect(audit[0].fact_id).toBe(factId);
  });
});
