/**
 * vehicleEnrichment/tier2Enrichment.ts — Tier 2: Source Registry Enrichment
 *
 * After Tier 1 (Batch API) completes, Tier 2 uses site-scoped FireCrawl
 * searches on discovered source domains to find vehicle-specific pages,
 * extracts fields via regex, writes evidence rows, runs consensus to
 * detect value changes, and updates source scoring.
 *
 * Cost: ~3 FireCrawl credits per query (search + scrape). With 5 sources
 * × ~2 queries each = ~30 credits per Tier 2 run.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { searchAndFetch } from "./firecrawl";
import { extractFieldsFromMarkdown } from "./sourceDiscovery";
import { computeConsensus } from "../services/consensus";
import type { Doc } from "../_generated/dataModel";

/** Fields that benefit from multi-source evidence. */
const ENRICHABLE_FIELDS = [
  "oil_filter_oem", "air_filter_oem", "cabin_filter_oem", "spark_plug_oem",
  "front_brake_pad_oem", "rear_brake_pad_oem", "rotor_front_oem", "rotor_rear_oem",
  "drain_plug_gasket_oem", "serpentine_belt_oem", "battery_oem", "coolant_oem",
  "wiper_blade_set_oem",
  "oil_viscosity", "front_tire_size", "rear_tire_size",
];

/** Minimum evidence rows before a field is "well-covered". */
const MIN_EVIDENCE_FOR_FIELD = 3;

/** Check if a value is garbage. */
function isGarbageValue(val: string): boolean {
  return (
    val === "undefined" ||
    val === "null" ||
    val === "NaN" ||
    val === "" ||
    val === "0" ||
    val.length < 2 ||
    val.length > 50
  );
}

export const runTier2Enrichment = internalAction({
  args: {
    vehicle_config_id: v.id("vehicle_configs"),
  },
  handler: async (ctx, args) => {
    console.log(`[tier2] Starting for vehicle_config ${args.vehicle_config_id}`);

    // 1. Load vehicle config + make + model
    const vc = await ctx.runQuery(
      internal.vehicleEnrichment.v3queries.getVehicleConfigById,
      { vehicleConfigId: args.vehicle_config_id },
    );
    if (!vc) {
      console.error("[tier2] Vehicle config not found");
      return { error: "vehicle_config_not_found" };
    }

    const makeDoc = await ctx.runQuery(
      internal.vehicleEnrichment.v3queries.getMakeById,
      { makeId: vc.make_id },
    );
    const makeName = makeDoc?.name ?? "Unknown";

    const modelDoc = await ctx.runQuery(
      internal.vehicleEnrichment.v3queries.getModelById,
      { modelId: vc.model_id },
    );
    const modelName = modelDoc?.name ?? "Unknown";

    // 2. Find fields that need more evidence
    const fieldsNeedingEvidence: string[] = [];
    const allExistingEvidence: Array<{ source_domain?: string; field_name: string }> = [];

    for (const field of ENRICHABLE_FIELDS) {
      const evidence = await ctx.runQuery(
        internal.vehicleEnrichment.v3queries.getEvidenceForField,
        { entityId: String(args.vehicle_config_id), fieldName: field },
      );
      if (evidence.length < MIN_EVIDENCE_FOR_FIELD) {
        fieldsNeedingEvidence.push(field);
      }
      for (const e of evidence) {
        allExistingEvidence.push({ source_domain: e.source_domain ?? undefined, field_name: e.field_name });
      }
    }

    console.log(`[tier2] ${fieldsNeedingEvidence.length}/${ENRICHABLE_FIELDS.length} fields need more evidence`);

    if (fieldsNeedingEvidence.length === 0) {
      console.log("[tier2] All fields well-covered — nothing to do");
      return { fieldsChecked: ENRICHABLE_FIELDS.length, fieldsNeeding: 0, evidenceWritten: 0, totalEvidence: 0 };
    }

    // 3. Get active sources from registry, filter blocked domains
    const sources = await ctx.runQuery(
      internal.vehicleEnrichment.v3queries.getSourcesForMake,
      { make_id: vc.make_id },
    );
    const blockedDomainDocs = await ctx.runQuery(
      internal.vehicleEnrichment.v3queries.getBlockedDomains,
      {},
    );
    const blockedSet = new Set(blockedDomainDocs.map((d) => d.domain));

    const activeSources = sources.filter((s) => !s.is_blocked && !blockedSet.has(s.domain));
    console.log(`[tier2] ${activeSources.length} active sources for ${makeName} (${sources.length - activeSources.length} blocked)`);

    const vehicleDesc = `${vc.year} ${makeName} ${vc.trim_name}`;

    // Evidence batch accumulator
    const batchRows: Array<{
      entity_type: string;
      entity_id: string;
      field_name: string;
      observed_value: string;
      observed_type: string;
      source_url?: string;
      source_domain?: string;
      source_type: string;
      confidence: number;
      observed_at: number;
    }> = [];

    let totalQueriesRun = 0;
    let sourcesWithData = 0;
    let skippedGarbage = 0;

    // 4. SEARCH EACH SOURCE FOR VEHICLE-SPECIFIC DATA
    for (const source of activeSources) {
      const fieldGroups = {
        parts: fieldsNeedingEvidence.filter((f) => f.endsWith("_oem")),
        fluids: fieldsNeedingEvidence.filter((f) =>
          f.includes("viscosity") || f.includes("coolant") ||
          f.includes("fluid") || f.includes("capacity"),
        ),
        specs: fieldsNeedingEvidence.filter((f) =>
          f.includes("tire") || f.includes("battery") ||
          f.includes("lug") || f.includes("spark_plug"),
        ),
      };

      const queries: string[] = [];
      if (fieldGroups.parts.length > 0) {
        queries.push(`site:${source.domain} ${vehicleDesc} OEM parts oil filter brake pad`);
      }
      if (fieldGroups.fluids.length > 0) {
        queries.push(`site:${source.domain} ${vehicleDesc} oil capacity viscosity coolant fluid`);
      }
      if (fieldGroups.specs.length > 0) {
        queries.push(`site:${source.domain} ${vehicleDesc} tire size battery specs`);
      }
      if (queries.length === 0) {
        queries.push(`site:${source.domain} ${vehicleDesc} maintenance parts specifications`);
      }

      let totalFieldsFromSource = 0;

      for (const query of queries) {
        totalQueriesRun++;
        try {
          const results = await searchAndFetch(query, 3);

          for (const result of results) {
            if (!result.markdown || result.markdown.length < 200) continue;

            const extracted = extractFieldsFromMarkdown(
              result.markdown,
              fieldsNeedingEvidence,
              makeName,
            );

            for (const [fieldName, value] of Object.entries(extracted)) {
              if (fieldName.startsWith("_")) continue;

              // Guard: skip garbage values
              const val = String(value);
              if (isGarbageValue(val)) {
                console.log(`[tier2] SKIPPED ${fieldName} from ${source.domain}: garbage value "${val}"`);
                skippedGarbage++;
                continue;
              }

              // Dedup: skip if this source+field already has evidence
              const exists = allExistingEvidence.some(
                (e) => e.source_domain === source.domain && e.field_name === fieldName,
              );
              if (exists) continue;

              batchRows.push({
                entity_type: fieldName.endsWith("_oem") ? "part" : "vehicle_config",
                entity_id: String(args.vehicle_config_id),
                field_name: fieldName,
                observed_value: val,
                observed_type: typeof value === "number" ? "number" : "string",
                source_url: result.url,
                source_domain: source.domain,
                source_type: source.source_type || "parts_retailer",
                confidence: source.reliability_score ?? 0.5,
                observed_at: Date.now(),
              });

              allExistingEvidence.push({ source_domain: source.domain, field_name: fieldName });
              totalFieldsFromSource++;
            }
          }
        } catch (err) {
          console.log(`[tier2] ${source.domain}: search failed — ${err}`);
        }
      }

      if (totalFieldsFromSource > 0) sourcesWithData++;
      console.log(`[tier2] ${source.domain}: ${totalFieldsFromSource} fields extracted (${queries.length} queries)`);
    }

    if (skippedGarbage > 0) {
      console.log(`[tier2] Skipped ${skippedGarbage} garbage values total`);
    }

    // 5. Write evidence batch
    let evidenceWritten = 0;
    if (batchRows.length > 0) {
      for (let i = 0; i < batchRows.length; i += 50) {
        const batch = batchRows.slice(i, i + 50);
        const count = await ctx.runMutation(
          internal.vehicleEnrichment.v3mutations.addEvidenceBatch,
          { evidence_rows: batch },
        );
        evidenceWritten += count;
      }
    }

    console.log(`[tier2] Evidence rows written: ${evidenceWritten}`);

    // 6. RUN CONSENSUS on fields that now have multi-source evidence
    let consensusChanges = 0;
    if (evidenceWritten > 0) {
      console.log("[tier2] Running consensus on fields with new evidence...");

      // Reload all evidence for fields we just wrote to
      const fieldsWithNewEvidence = new Set(batchRows.map((r) => r.field_name));

      for (const fieldName of fieldsWithNewEvidence) {
        const allFieldEvidence = await ctx.runQuery(
          internal.vehicleEnrichment.v3queries.getEvidenceForField,
          { entityId: String(args.vehicle_config_id), fieldName },
        );

        if (allFieldEvidence.length < 2) continue;

        try {
          const result = computeConsensus(
            allFieldEvidence as Doc<"enrichment_evidence">[],
            makeName,
          );

          // Find the previous winner (highest confidence from Tier 1)
          const tier1Evidence = allFieldEvidence
            .filter((e) => e.confidence >= 0.8)
            .sort((a, b) => b.confidence - a.confidence);
          const previousValue = tier1Evidence[0]?.observed_value;

          if (previousValue && result.value !== previousValue) {
            console.log(
              `[tier2] Consensus CHANGED for ${fieldName}: ` +
              `"${previousValue}" → "${result.value}" ` +
              `(confidence ${result.confidence.toFixed(2)}, ${result.source_count} sources, ` +
              `conflict=${result.has_conflict}, verified=${result.is_verified})`,
            );
            consensusChanges++;
          } else {
            console.log(
              `[tier2] Consensus CONFIRMED for ${fieldName}: ` +
              `"${result.value}" ` +
              `(confidence ${result.confidence.toFixed(2)}, ${result.source_count} sources)`,
            );
          }
        } catch (e) {
          console.warn(`[tier2] Consensus failed for ${fieldName}: ${e}`);
        }
      }
    }

    // 7. Count total evidence
    const totalEvidence = await ctx.runQuery(
      internal.vehicleEnrichment.v3queries.getEvidenceCount,
      { entityId: String(args.vehicle_config_id) },
    );

    // 8. Log summary
    const estimatedCredits = totalQueriesRun * 3;
    console.log(`[tier2] Queries run: ${totalQueriesRun}`);
    console.log(`[tier2] Sources with data: ${sourcesWithData}/${activeSources.length}`);
    console.log(`[tier2] Consensus changes: ${consensusChanges}`);
    console.log(`[tier2] Total evidence for config: ${totalEvidence}`);
    console.log(`[tier2] Estimated FireCrawl credits used: ${estimatedCredits}`);

    return {
      fieldsChecked: ENRICHABLE_FIELDS.length,
      fieldsNeeding: fieldsNeedingEvidence.length,
      queriesRun: totalQueriesRun,
      sourcesWithData,
      evidenceWritten,
      skippedGarbage,
      consensusChanges,
      totalEvidence,
      estimatedCredits,
    };
  },
});
