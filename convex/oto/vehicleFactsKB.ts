// =============================================================================
// Oto AI — Vehicle Facts Knowledge Base
// =============================================================================
//
// Persistent KB Haiku reads and writes to grow the system's knowledge over
// time. Two-layer lookup:
//
//   1. SEMANTIC search via vectorIndex (when embedding is populated and the
//      query text has been embedded). Returns top-k facts ranked by cosine
//      similarity, filtered to the axis we're searching on.
//
//   2. STRUCTURAL fallback when (a) no embedding configured, or (b) semantic
//      search returns nothing. Walks vehicle_config_id → chassis_code →
//      engine_code, returning topical matches.
//
// Writes happen via Haiku's `record_vehicle_fact` tool. The action records
// the fact + (if embedding API key is set) embeds the question_text and
// stores the vector for future semantic retrieval.
//
// Heavy KB (Locked Principle #5 — the moat) — facts learned for one car
// propagate to similar cars by chassis/engine without re-asking Haiku.
// =============================================================================

import { v } from "convex/values";
import { query, mutation, action, internalQuery } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";

export interface KBFactRow {
  topic: string;
  topic_axis: string;
  fact_text: string;
  source: string;
  cited_url: string | null;
  confidence: number;
  match_kind: "exact" | "chassis" | "engine" | "model_year" | "semantic";
  fact_id: string;
}

// ---------------------------------------------------------------------------
// QUERY: structural lookup. Returns facts matching the scoping ids/topic.
// ---------------------------------------------------------------------------

export const lookupFactsStructural = query({
  args: {
    topic: v.string(),
    vehicle_config_id: v.optional(v.id("vehicle_configs")),
    chassis_code: v.optional(v.string()),
    engine_code: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<KBFactRow[]> => {
    const cap = Math.min(20, args.limit ?? 5);
    const seen = new Set<string>();
    const results: KBFactRow[] = [];

    const push = (row: Doc<"vehicle_facts">, match_kind: KBFactRow["match_kind"]) => {
      if (results.length >= cap) return;
      if (seen.has(row._id as unknown as string)) return;
      seen.add(row._id as unknown as string);
      results.push({
        topic: row.topic,
        topic_axis: row.topic_axis,
        fact_text: row.fact_text,
        source: row.source,
        cited_url: row.cited_url ?? null,
        confidence: row.confidence,
        match_kind,
        fact_id: row._id as unknown as string,
      });
    };

    // 1. Exact vehicle_config match.
    if (args.vehicle_config_id) {
      const rows = await ctx.db
        .query("vehicle_facts")
        .withIndex("by_vehicle_config", (q: any) =>
          q.eq("vehicle_config_id", args.vehicle_config_id).eq("topic", args.topic),
        )
        .take(cap);
      for (const r of rows) push(r, "exact");
    }

    // 2. Chassis fallback.
    if (results.length < cap && args.chassis_code) {
      const rows = await ctx.db
        .query("vehicle_facts")
        .withIndex("by_chassis", (q: any) =>
          q.eq("chassis_code", args.chassis_code).eq("topic", args.topic),
        )
        .take(cap - results.length);
      for (const r of rows) push(r, "chassis");
    }

    // 3. Engine fallback (engine-axis facts only).
    if (results.length < cap && args.engine_code) {
      const rows = await ctx.db
        .query("vehicle_facts")
        .withIndex("by_engine", (q: any) =>
          q.eq("engine_code", args.engine_code).eq("topic", args.topic),
        )
        .take(cap - results.length);
      for (const r of rows) push(r, "engine");
    }

    return results;
  },
});

// ---------------------------------------------------------------------------
// ACTION: semantic search via vectorIndex. Requires the input query to have
// been embedded externally (we don't embed in the query itself because
// Convex queries can't call external APIs). Callers pass the embedding.
// ---------------------------------------------------------------------------

export const lookupFactsSemantic = action({
  args: {
    embedding: v.array(v.float64()),
    topic_axis: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<KBFactRow[]> => {
    const cap = Math.min(20, args.limit ?? 5);
    const results = await ctx.vectorSearch("vehicle_facts", "by_embedding", {
      vector: args.embedding,
      limit: cap,
      filter: args.topic_axis
        ? (q: any) => q.eq("topic_axis", args.topic_axis)
        : undefined,
    });
    // vectorSearch returns rows with _score; re-fetch full docs to keep
    // payload consistent with the structural lookup shape.
    return await Promise.all(
      results.map(async (r: any) => {
        const row: Doc<"vehicle_facts"> | null = await ctx.runQuery(
          internal.oto.vehicleFactsKB.getFactById,
          { id: r._id },
        );
        if (!row) {
          return {
            topic: "",
            topic_axis: "",
            fact_text: "",
            source: "oto_inferred",
            cited_url: null,
            confidence: 0,
            match_kind: "semantic",
            fact_id: r._id,
          } as KBFactRow;
        }
        return {
          topic: row.topic,
          topic_axis: row.topic_axis,
          fact_text: row.fact_text,
          source: row.source,
          cited_url: row.cited_url ?? null,
          confidence: row.confidence,
          match_kind: "semantic",
          fact_id: row._id as unknown as string,
        };
      }),
    );
  },
});

export const getFactById = internalQuery({
  args: { id: v.id("vehicle_facts") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

// ---------------------------------------------------------------------------
// MUTATION: insert a fact. The Haiku-facing tool callable hits this.
// Embedding is computed by a separate action (recordFactWithEmbedding) that
// chains: mutation insert → embed action → mutation patch embedding.
// ---------------------------------------------------------------------------

export const insertFact = mutation({
  args: {
    topic: v.string(),
    topic_axis: v.union(
      v.literal("vehicle"),
      v.literal("trim"),
      v.literal("chassis"),
      v.literal("engine"),
      v.literal("model_year"),
    ),
    vehicle_config_id: v.optional(v.id("vehicle_configs")),
    chassis_code: v.optional(v.string()),
    engine_code: v.optional(v.string()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    trim_name: v.optional(v.string()),
    year_min: v.optional(v.number()),
    year_max: v.optional(v.number()),
    fact_text: v.string(),
    question_text: v.string(),
    answer_format: v.optional(v.string()),
    source: v.union(
      v.literal("manufacturer"),
      v.literal("oto_inferred"),
      v.literal("web_search"),
      v.literal("user_confirmed"),
      v.literal("propagated"),
    ),
    cited_url: v.optional(v.string()),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("unauthenticated");
    const id = await ctx.db.insert("vehicle_facts", {
      ...args,
      created_at: Date.now(),
    });
    return id;
  },
});

export const patchEmbedding = mutation({
  args: {
    id: v.id("vehicle_facts"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { embedding: args.embedding });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// ACTION: end-to-end recordFact. Inserts row, then (if an embedding API key
// is configured) embeds the question_text and patches the embedding column.
// Embedding failures are swallowed — fact still saves, semantic search just
// won't include it until backfilled.
// ---------------------------------------------------------------------------

export const recordFact = action({
  args: {
    topic: v.string(),
    topic_axis: v.union(
      v.literal("vehicle"),
      v.literal("trim"),
      v.literal("chassis"),
      v.literal("engine"),
      v.literal("model_year"),
    ),
    vehicle_config_id: v.optional(v.id("vehicle_configs")),
    chassis_code: v.optional(v.string()),
    engine_code: v.optional(v.string()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    trim_name: v.optional(v.string()),
    year_min: v.optional(v.number()),
    year_max: v.optional(v.number()),
    fact_text: v.string(),
    question_text: v.string(),
    answer_format: v.optional(v.string()),
    source: v.union(
      v.literal("manufacturer"),
      v.literal("oto_inferred"),
      v.literal("web_search"),
      v.literal("user_confirmed"),
      v.literal("propagated"),
    ),
    cited_url: v.optional(v.string()),
    confidence: v.number(),
  },
  handler: async (ctx, args): Promise<{ id: string; embedded: boolean }> => {
    const insertArgs = { ...args };
    const id: Id<"vehicle_facts"> = await ctx.runMutation(
      api.oto.vehicleFactsKB.insertFact,
      insertArgs,
    );

    // Embedding path — opt-in. Tries OpenAI text-embedding-3-small (1536
    // dims to match the schema vectorIndex) when OPENAI_API_KEY is set.
    let embedded = false;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        const resp = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: args.question_text,
          }),
        });
        if (resp.ok) {
          const data: any = await resp.json();
          const vec = data?.data?.[0]?.embedding as number[] | undefined;
          if (vec && vec.length === 1536) {
            await ctx.runMutation(api.oto.vehicleFactsKB.patchEmbedding, {
              id,
              embedding: vec,
            });
            embedded = true;
          }
        } else {
          console.warn(
            "[oto/kb] embedding API non-OK:",
            resp.status,
            await resp.text().catch(() => "<unreadable>"),
          );
        }
      } catch (e: any) {
        console.warn("[oto/kb] embedding failed (swallowed):", e?.message);
      }
    }

    return { id: id as unknown as string, embedded };
  },
});

// ---------------------------------------------------------------------------
// ACTION: embed an arbitrary query string. Used by the chat action to embed
// the user's question and pass the vector to lookupFactsSemantic.
// ---------------------------------------------------------------------------

export const embedText = action({
  args: { text: v.string() },
  handler: async (_ctx, { text }): Promise<number[] | null> => {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return null;
    try {
      const resp = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text,
        }),
      });
      if (!resp.ok) return null;
      const data: any = await resp.json();
      const vec = data?.data?.[0]?.embedding as number[] | undefined;
      return vec ?? null;
    } catch (e) {
      console.warn("[oto/kb] embedText failed:", (e as any)?.message);
      return null;
    }
  },
});
