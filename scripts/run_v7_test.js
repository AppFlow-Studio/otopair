/**
 * run_v7_test.js — Run a clean v7 pipeline test on the 2020 BMW M550i xDrive
 *
 * v7 changes tested:
 *   - Parallel Batch 1A (scraped extraction) + Batch 1B (web_search intervals/fluids)
 *   - 88 fields: +rotor OEM, +battery/coolant OEM, +fluid types, +diff/TC intervals
 *   - Applicability rules (chain→timing, FWD→diff, sedan→rear_wiper)
 *   - 14-service SERVICE_FIELD_MAP (was 6), 25 services in Batch 2
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ENGINE_KEY = "2020_bmw_5_series_m550i_xdrive_n63b44o2";
const VIN = "WBAJS7C01LBN96146";
const OUTPUT_FILE = path.join(__dirname, "v7result.json");
const POLL_INTERVAL_MS = 60_000;
const MAX_POLLS = 45; // 45 min max (1A+1B batch + batch 2)

const FIELD_CATS = {
  Fluids: ["oil_viscosity","oil_capacity_qts","coolant_type","coolant_capacity_qts","brake_fluid_type","power_steering_type"],
  Intervals: ["oil_change_miles","oil_change_months","spark_plug_miles","spark_plug_months","transmission_service_miles","transmission_service_months","coolant_flush_miles","coolant_flush_months","air_filter_miles","air_filter_months","cabin_filter_miles","cabin_filter_months","brake_fluid_flush_miles","brake_fluid_flush_months","serpentine_belt_miles","serpentine_belt_months","timing_service_miles","timing_service_months"],
  Attributes: ["timing_system","drivetrain","turbo","fuel_injection_type","transmission_type","power_steering_system"],
  OEMParts: ["oil_filter_oem","air_filter_oem","cabin_filter_oem","spark_plug_oem","front_brake_pad_oem","rear_brake_pad_oem","rotor_front_oem","rotor_rear_oem","drain_plug_gasket_oem","serpentine_belt_oem","timing_belt_oem","wiper_blade_set_oem","battery_oem","coolant_oem"],
  Battery: ["battery_group","battery_cca","spark_plug_quantity","spark_plug_gap","parking_brake_type"],
  Trim: ["front_tire_size","rear_tire_size","tire_pressure_front_psi","tire_pressure_rear_psi","lug_nut_torque_ft_lbs","front_wiper_size","rear_wiper_size"],
  // v7 new
  NewFluidTypes: ["trans_fluid_type","diff_fluid_type","transfer_case_fluid_type"],
  NewFluidIntervals: ["diff_fluid_miles","diff_fluid_months","transfer_case_fluid_miles","transfer_case_fluid_months"],
  Pricing: ["oil_change_price","brake_pad_front_price","brake_pad_rear_price","spark_plug_price","air_filter_price","cabin_filter_price","rotor_front_price","rotor_rear_price","battery_price","serpentine_belt_price","coolant_flush_price","transmission_service_price","brake_fluid_flush_price"],
  Labor: ["estimated_labor_oil_change_hrs","estimated_labor_brake_front_hrs","estimated_labor_brake_rear_hrs","estimated_labor_spark_plug_hrs","estimated_labor_rotor_front_hrs","estimated_labor_rotor_rear_hrs","estimated_labor_serpentine_belt_hrs","estimated_labor_coolant_flush_hrs","estimated_labor_trans_fluid_hrs","estimated_labor_battery_hrs","estimated_labor_brake_fluid_flush_hrs","estimated_labor_timing_service_hrs"],
};

function run(cmd) {
  return execSync(cmd, { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 30000, shell: true }).trim();
}

function convexRun(fn, args) {
  const result = run(`npx convex run ${fn} ${JSON.stringify(JSON.stringify(args))}`);
  try { return JSON.parse(result); } catch { return result; }
}

function queryEnrichment() {
  try {
    return convexRun("vehicleEnrichment/queries:debugGetByEngineKey", { engineKey: ENGINE_KEY });
  } catch { return null; }
}

function printAnalysis(data) {
  console.log("\n" + "=".repeat(80));
  console.log("V7 ENRICHMENT RESULTS — 2020 BMW M550i xDrive");
  console.log("=".repeat(80));

  let totalFilled = 0, totalFields = 0;

  for (const [cat, keys] of Object.entries(FIELD_CATS)) {
    let filled = 0;
    console.log(`\n── ${cat} ──`);
    for (const k of keys) {
      totalFields++;
      const d = data[k];
      const has = d && d.value != null;
      if (has) {
        filled++;
        totalFilled++;
        const src = d.source || "?";
        const conf = d.confidence != null ? d.confidence.toFixed(2) : "?";
        console.log(`  ✓ ${k}: ${JSON.stringify(d.value)} [${src.replace(/https?:\/\/([^/]+).*/, '$1')}] conf=${conf}`);
      } else {
        console.log(`  ✗ ${k}: NULL`);
      }
    }
    console.log(`  → ${cat}: ${filled}/${keys.length}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log(`TOTAL: ${totalFilled}/${totalFields} = ${Math.round(totalFilled/totalFields*100)}%`);
  console.log(`Stored fillRate: ${data.fillRate}%`);
  console.log(`Version: ${data.enrichmentVersion}`);
  console.log(`Duration: ${((data.enrichmentDurationMs||0)/1000).toFixed(0)}s`);

  const cl = data.callLog || [];
  if (cl.length > 0) {
    console.log("\nCall Log:");
    let totalIn = 0, totalOut = 0, totalWs = 0;
    for (const c of cl) {
      totalIn += c.tokensIn || 0;
      totalOut += c.tokensOut || 0;
      totalWs += c.webSearches || 0;
      console.log(`  ${c.call}: ${c.tokensIn}in / ${c.tokensOut}out / ${c.webSearches}ws`);
    }
    console.log(`  TOTAL: ${totalIn}in / ${totalOut}out / ${totalWs} searches`);
    const costIn  = (totalIn  / 1_000_000) * 1.50 * 0.5;
    const costOut = (totalOut / 1_000_000) * 7.50 * 0.5;
    console.log(`  Est. cost: $${(costIn + costOut).toFixed(4)} (Sonnet batch pricing)`);
  }

  console.log(`\nSources: ${(data.sourceUrls||[]).length} URLs`);
}

async function main() {
  console.log("[v7-test] Starting v7 pipeline test...\n");

  console.log("[v7-test] Pushing code to Convex dev...");
  try {
    run("npx convex dev --once");
    console.log("[v7-test] Deploy complete.\n");
  } catch (e) {
    console.log("[v7-test] Deploy warning:", e.message?.split("\n")[0]);
  }

  console.log("[v7-test] Looking up BMW M550i xDrive in DB...");
  let vehicle = convexRun("vehicleEnrichment/queries:debugFindVehicle", { vin: VIN });
  if (!vehicle?.id) {
    vehicle = convexRun("vehicleEnrichment/queries:debugFindVehicle", { engineCode: "N63B44O2" });
  }
  if (!vehicle?.id) {
    console.error("[v7-test] BMW M550i not found in DB.");
    process.exit(1);
  }
  console.log(`[v7-test] Found vehicle: ${vehicle.make} ${vehicle.model} ${vehicle.year} (id=${vehicle.id})\n`);

  console.log(`[v7-test] Deleting enrichment for ${ENGINE_KEY}...`);
  const deleted = convexRun("vehicleEnrichment/mutations:debugDeleteByEngineKey", { engineKey: ENGINE_KEY });
  console.log(`[v7-test] Delete result: ${JSON.stringify(deleted)}\n`);

  // Keep scrape cache — parts catalog data doesn't change, only Batch 1B web search is new
  // Uncomment below to force full re-scrape:
  // const cacheCleared = convexRun("vehicleEnrichment/scraperQueries:debugClearVehicleCache", { vehicleMake: "BMW", vehicleModel: "5 Series", vehicleYear: 2020 });
  // console.log(`[v7-test] Cache cleared: ${JSON.stringify(cacheCleared)}\n`);

  console.log("[v7-test] Scheduling v7 enrichment...");
  const scheduled = convexRun("vehicleEnrichment/mutations:debugScheduleEnrichment", {
    vehicleId: vehicle.id,
    year: 2020,
    make: "BMW",
    model: "5 Series",
    trim: "M550i xDrive",
    engineCode: "N63B44O2",
    displacement: "4.4",
  });
  console.log(`[v7-test] Scheduled: ${JSON.stringify(scheduled)}`);
  console.log("[v7-test] Pipeline running: FireCrawl → Batch[1A+1B] → Batch 2...");
  console.log("[v7-test] Polling every 1 min...\n");

  const startTime = Date.now();
  let polls = 0;

  function doPoll() {
    polls++;
    const elapsed = Math.round((Date.now() - startTime) / 60000);
    process.stdout.write(`[poll ${polls}] +${elapsed}min — checking... `);

    const data = queryEnrichment();
    if (data && data.enrichmentVersion === "v7") {
      console.log(`FOUND (v7, fillRate=${data.fillRate}%)`);
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
      console.log(`[v7-test] Result saved to scripts/v7result.json`);
      printAnalysis(data);
      console.log("\n=== V7 TEST COMPLETE ===");
      process.exit(0);
    } else if (data) {
      console.log(`found but version=${data.enrichmentVersion} — still running or old record`);
    } else {
      console.log("not ready yet");
    }

    if (polls >= MAX_POLLS) {
      console.log("[v7-test] Max polls reached. Check Convex dashboard logs.");
      process.exit(1);
    }
    setTimeout(doPoll, POLL_INTERVAL_MS);
  }

  // v7 has 2 batch rounds: [1A+1B] (parallel, ~5-10min) + Batch 2 (~5-10min)
  // First poll after 5 minutes
  console.log("[v7-test] Waiting 5 minutes before first poll (Batch [1A+1B] startup time)...");
  setTimeout(doPoll, 5 * 60_000);
}

main().catch(console.error);
