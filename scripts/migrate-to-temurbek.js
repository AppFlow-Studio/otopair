#!/usr/bin/env node
/**
 * scripts/migrate-to-temurbek.js
 *
 * One-time migration: copies all vehicle knowledge graph data from the
 * waleed Convex deployment into the temurbek deployment.
 *
 * Run: node scripts/migrate-to-temurbek.js [--dry-run]
 *
 * No external deps — uses built-in fetch (Node 18+).
 */

// ─── Config ──────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");

const WALEED_URL = "https://flippant-mink-750.convex.cloud";
const WALEED_KEY = "dev:flippant-mink-750|eyJ2MiI6IjllZTMxMzNmNzExMTRjYjU5NjQyMzVlNzcwMjJhZTcyIn0=";
const TEMURBEK_URL = "https://ardent-crab-641.convex.cloud";
const TEMURBEK_KEY = "dev:ardent-crab-641|eyJ2MiI6ImE3MWIxODkzYTdiMDQwOWViMzJlYTljMThkZTYxMTMyIn0=";

// ─── ID Mapping ──────────────────────────────────────────────────

const idMap = new Map();
const stats = new Map();

function initStats(table) {
  const s = { inserted: 0, skipped: 0, matched: 0, warnings: [] };
  stats.set(table, s);
  return s;
}

function warn(table, msg) {
  const s = stats.get(table);
  if (s) s.warnings.push(msg);
  console.warn(`  ⚠ [${table}] ${msg}`);
}

// ─── Convex HTTP API helpers ─────────────────────────────────────

async function convexQuery(url, key, path, args) {
  const res = await fetch(`${url}/api/query`, {
    method: "POST",
    headers: { Authorization: `Convex ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  if (!res.ok) throw new Error(`Query ${path} failed (${res.status}): ${await res.text()}`);
  const json = JSON.parse(await res.text());
  return json && typeof json === "object" && "value" in json ? json.value : json;
}

async function convexMutation(url, key, path, args) {
  const res = await fetch(`${url}/api/mutation`, {
    method: "POST",
    headers: { Authorization: `Convex ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  if (!res.ok) throw new Error(`Mutation ${path} failed (${res.status}): ${await res.text()}`);
  const json = JSON.parse(await res.text());
  return json && typeof json === "object" && "value" in json ? json.value : json;
}

async function listAll(url, key, table) {
  const result = await convexQuery(url, key, "migration:listTable", { tableName: table });
  return Array.isArray(result) ? result : [];
}

async function insertDoc(table, doc) {
  return await convexMutation(TEMURBEK_URL, TEMURBEK_KEY, "migration:insertDoc", { tableName: table, doc });
}

// ─── Helpers ─────────────────────────────────────────────────────

function stripMeta(doc) {
  const { _id, _creationTime, ...rest } = doc;
  return rest;
}

function remapFks(doc, fkFields, table, waleedId) {
  const result = { ...doc };
  for (const { field, required } of fkFields) {
    const oldId = result[field];
    if (oldId == null || oldId === "") {
      if (required) { warn(table, `${waleedId}: required FK "${field}" is null — skipping`); return null; }
      continue;
    }
    const newId = idMap.get(oldId);
    if (!newId) {
      if (required) { warn(table, `${waleedId}: FK "${field}" = ${oldId} not in idMap — skipping`); return null; }
      result[field] = undefined;
      continue;
    }
    result[field] = newId;
  }
  return result;
}

async function migrateTable(table, docs, fkFields, extraTransform) {
  const s = initStats(table);
  console.log(`\n📦 ${table}: ${docs.length} docs`);
  for (const doc of docs) {
    let cleaned = remapFks(stripMeta(doc), fkFields, table, doc._id);
    if (!cleaned) { s.skipped++; continue; }
    if (extraTransform) {
      cleaned = extraTransform(cleaned);
      if (!cleaned) { s.skipped++; continue; }
    }
    if (DRY_RUN) {
      s.inserted++;
    } else {
      try {
        const newId = await insertDoc(table, cleaned);
        idMap.set(doc._id, newId);
        s.inserted++;
      } catch (e) {
        warn(table, `Insert failed for ${doc._id}: ${e.message}`);
        s.skipped++;
      }
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  OtoPair Knowledge Graph Migration: waleed → temurbek");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log("═══════════════════════════════════════════════════════════");

  // Load temurbek reference data
  console.log("\n🔍 Loading temurbek reference data...");
  const temurbekMakes = await listAll(TEMURBEK_URL, TEMURBEK_KEY, "makes");
  const temurbekModels = await listAll(TEMURBEK_URL, TEMURBEK_KEY, "models");
  const temurbekServices = await listAll(TEMURBEK_URL, TEMURBEK_KEY, "services");

  const temurbekMakeBySlug = new Map();
  for (const m of temurbekMakes) if (m.slug) temurbekMakeBySlug.set(m.slug.toLowerCase(), m._id);
  console.log(`  makes: ${temurbekMakeBySlug.size}, models: ${temurbekModels.length}, services: ${temurbekServices.length}`);

  const temurbekModelByKey = new Map();
  for (const m of temurbekModels) if (m.make_id && m.name) temurbekModelByKey.set(`${m.make_id}::${m.name.toLowerCase()}`, m._id);

  const temurbekServiceBySlug = new Map();
  for (const s of temurbekServices) if (s.slug) temurbekServiceBySlug.set(s.slug, s._id);

  // Load all waleed data
  console.log("\n📥 Loading waleed data...");
  const tableNames = [
    "makes", "models", "services", "trims", "engines", "transmissions", "chassis_variants",
    "vehicle_configs", "trim_specs", "drivetrain_configs", "oem_parts",
    "part_fitments", "part_prices", "service_intervals", "labor_times",
    "enrichment_runs", "enrichment_evidence", "source_registry",
    "blocked_domains", "scrape_cache", "vin_queue", "vehicles",
    // Extra tables not in original script
    "service_categories", "scrape_jobs", "shops", "mechanics",
    "vehicle_owners", "mechanic_verifications",
  ];
  const waleed = {};
  for (const t of tableNames) {
    waleed[t] = await listAll(WALEED_URL, WALEED_KEY, t);
    console.log(`  ${t}: ${waleed[t].length}`);
  }

  // 1. MAKES — match by slug only
  {
    const s = initStats("makes");
    console.log(`\n📦 makes: ${waleed.makes.length} docs (match-only)`);
    for (const doc of waleed.makes) {
      const slug = doc.slug?.toLowerCase();
      if (!slug) { warn("makes", `${doc._id} has no slug`); s.skipped++; continue; }
      const tid = temurbekMakeBySlug.get(slug);
      if (tid) { idMap.set(doc._id, tid); s.matched++; }
      else { warn("makes", `slug="${slug}" not in temurbek`); s.skipped++; }
    }
  }

  // 2. MODELS — match or insert
  {
    const s = initStats("models");
    console.log(`\n📦 models: ${waleed.models.length} docs`);
    for (const doc of waleed.models) {
      const newMakeId = idMap.get(doc.make_id);
      if (!newMakeId) { warn("models", `${doc._id} make_id not in idMap`); s.skipped++; continue; }
      const key = `${newMakeId}::${doc.name.toLowerCase()}`;
      const tid = temurbekModelByKey.get(key);
      if (tid) { idMap.set(doc._id, tid); s.matched++; continue; }
      if (DRY_RUN) { s.inserted++; continue; }
      try {
        const cleaned = { ...stripMeta(doc), make_id: newMakeId };
        const newId = await insertDoc("models", cleaned);
        idMap.set(doc._id, newId);
        s.inserted++;
      } catch (e) { warn("models", `Insert failed: ${e.message}`); s.skipped++; }
    }
  }

  // 3. SERVICES — match by slug, insert if missing
  {
    const s = initStats("services");
    console.log(`\n📦 services: ${waleed.services.length} docs`);
    for (const doc of waleed.services) {
      const slug = doc.slug;
      if (!slug) { warn("services", `${doc._id} has no slug`); s.skipped++; continue; }
      const tid = temurbekServiceBySlug.get(slug);
      if (tid) { idMap.set(doc._id, tid); s.matched++; continue; }
      if (DRY_RUN) { s.inserted++; continue; }
      try {
        const newId = await insertDoc("services", stripMeta(doc));
        idMap.set(doc._id, newId);
        temurbekServiceBySlug.set(slug, newId); // keep map fresh
        s.inserted++;
      } catch (e) { warn("services", `Insert failed: ${e.message}`); s.skipped++; }
    }
  }

  await migrateTable("trims", waleed.trims, [{ field: "model_id", required: true }]);
  await migrateTable("engines", waleed.engines, [{ field: "trim_id", required: true }, { field: "make_id", required: false }]);
  await migrateTable("transmissions", waleed.transmissions, [{ field: "trim_id", required: true }, { field: "make_id", required: false }]);
  await migrateTable("chassis_variants", waleed.chassis_variants, [{ field: "trim_id", required: true }]);

  await migrateTable("vehicle_configs", waleed.vehicle_configs, [
    { field: "engine_id", required: false },
    { field: "transmission_id", required: false },
    { field: "make_id", required: true },
    { field: "model_id", required: true },
    { field: "generation_id", required: false },
  ], (doc) => { delete doc.cloned_from_config_id; return doc; });

  await migrateTable("trim_specs", waleed.trim_specs, [{ field: "trim_id", required: false }, { field: "vehicle_config_id", required: false }]);
  await migrateTable("drivetrain_configs", waleed.drivetrain_configs, [{ field: "vehicle_config_id", required: true }]);
  await migrateTable("oem_parts", waleed.oem_parts, [{ field: "make_id", required: false }]);
  await migrateTable("part_fitments", waleed.part_fitments, [{ field: "vehicle_config_id", required: true }, { field: "part_id", required: true }]);
  await migrateTable("part_prices", waleed.part_prices, [{ field: "part_id", required: true }]);

  // Service tables — remap service_id via idMap (populated in step 3)
  {
    const remapService = (tableName) => (doc) => {
      const newServiceId = idMap.get(doc.service_id);
      if (!newServiceId) { warn(tableName, `service_id ${doc.service_id} not in idMap`); return null; }
      doc.service_id = newServiceId;
      return doc;
    };

    await migrateTable("service_intervals", waleed.service_intervals, [{ field: "vehicle_config_id", required: true }], remapService("service_intervals"));
    await migrateTable("labor_times", waleed.labor_times, [{ field: "vehicle_config_id", required: true }], remapService("labor_times"));
  }

  await migrateTable("enrichment_runs", waleed.enrichment_runs, [{ field: "vehicle_config_id", required: true }]);
  await migrateTable("enrichment_evidence", waleed.enrichment_evidence, [{ field: "enrichment_run_id", required: false }], (doc) => {
    if (doc.entity_id && ["vehicle_config", "engine", "trim_spec"].includes(doc.entity_type)) {
      const newId = idMap.get(doc.entity_id);
      if (newId) doc.entity_id = newId;
    }
    return doc;
  });
  await migrateTable("source_registry", waleed.source_registry, [{ field: "make_id", required: true }]);
  await migrateTable("blocked_domains", waleed.blocked_domains, []);
  await migrateTable("scrape_cache", waleed.scrape_cache, [{ field: "make_id", required: false }, { field: "model_id", required: false }]);
  await migrateTable("vin_queue", waleed.vin_queue, [{ field: "vehicle_config_id", required: false }]);
  await migrateTable("vehicles", waleed.vehicles, [
    { field: "trim_id", required: false },
    { field: "engine_id", required: false },
    { field: "transmission_id", required: false },
    { field: "chassis_id", required: false },
    { field: "vehicle_config_id", required: false },
    { field: "enriched_engine_config_id", required: false },
  ]);

  // ─── Extra tables (not in original script) ────────────────────
  await migrateTable("service_categories", waleed.service_categories, []);
  await migrateTable("scrape_jobs", waleed.scrape_jobs, []);
  await migrateTable("shops", waleed.shops, []);
  await migrateTable("mechanics", waleed.mechanics, []);
  await migrateTable("vehicle_owners", waleed.vehicle_owners, [
    { field: "user_id", required: false },
  ]);
  await migrateTable("mechanic_verifications", waleed.mechanic_verifications, [
    { field: "mechanic_id", required: false },
    { field: "service_id", required: false },
    { field: "vehicle_config_id", required: false },
  ]);

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  MIGRATION SUMMARY");
  console.log("═══════════════════════════════════════════════════════════\n");

  let totalInserted = 0, totalSkipped = 0, totalMatched = 0, totalWarnings = 0;
  for (const [table, s] of stats) {
    const parts = [];
    if (s.matched > 0) parts.push(`${s.matched} matched`);
    if (s.inserted > 0) parts.push(`${s.inserted} inserted`);
    if (s.skipped > 0) parts.push(`${s.skipped} skipped`);
    if (s.warnings.length > 0) parts.push(`${s.warnings.length} warnings`);
    console.log(`  ${s.skipped > 0 || s.warnings.length > 0 ? "⚠" : "✅"} ${table.padEnd(22)} ${parts.join(", ")}`);
    totalInserted += s.inserted;
    totalSkipped += s.skipped;
    totalMatched += s.matched;
    totalWarnings += s.warnings.length;
  }

  console.log(`\n  Total: ${totalInserted} inserted, ${totalMatched} matched, ${totalSkipped} skipped, ${totalWarnings} warnings`);
  console.log(`  idMap size: ${idMap.size}`);
  if (DRY_RUN) console.log("\n  ⚡ DRY RUN — no data was written");
  console.log("");
}

main().catch((e) => {
  console.error("\n💥 Migration failed:", e);
  process.exit(1);
});
