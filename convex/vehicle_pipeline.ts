/**
 * Vehicle Data Pipeline — Convex Actions
 *
 * Stage 2: NHTSA VIN Decode (FREE)
 *   VIN → makes, models, trims, engines
 *
 * Stage 3: AI Enrichment (Claude ~$0.02/vehicle)
 *   engine → engine_specs, vehicle_specs, trim_specs, oem_parts
 *
 * Mutations/queries live in vehicle_mutations.ts to avoid circular
 * type inference (TS7022) when actions reference their own module
 * through `internal.*`.
 */

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const NHTSA_API = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvaluesextended/";

// ============================================
// STAGE 2: NHTSA VIN DECODE
// ============================================

/**
 * Process a VIN through NHTSA decode → upsert makes/models/trims/engines.
 * Returns the resolved IDs for linking to vehicle records.
 */
export const processVin = internalAction({
  args: { vin: v.string() },
  handler: async (ctx, args) => {
    try {
      // ── Call NHTSA API ──
      const response = await fetch(
        `${NHTSA_API}/${args.vin}?format=json`
      );
      const data = await response.json();

      // Check for errors — ErrorCode "0" means clean decode.
      // Some VINs return comma-separated codes like "0,6" (partial decode).
      // We accept any response that includes "0" among the codes.
      const errorCode = getValue(data, "ErrorCode");
      const errorCodes = errorCode.split(",").map((c: string) => c.trim());
      if (!errorCodes.includes("0")) {
        console.error("NHTSA decode error:", errorCode, getValue(data, "ErrorText"));
        return null;
      }

      // Extract fields
      const extracted = {
        make: getValue(data, "Make") || "",
        model: getValue(data, "Model") || "",
        year: parseInt(getValue(data, "ModelYear") || "0"),
        trim: getValue(data, "Trim") || "Base",
        engineCode: getValue(data, "EngineModel") || "",
        cylinders: parseFloat(getValue(data, "EngineCylinders") || "0"),
        displacement: getValue(data, "DisplacementL") || "",
        fuelType: getValue(data, "FuelTypePrimary") || "Gasoline",
        turbo: getValue(data, "Turbo") === "Yes",
        bodyStyle: getValue(data, "BodyClass") || "",
        transmission: getValue(data, "TransmissionStyle") || "",
      };

      if (!extracted.make || !extracted.model || !extracted.year) {
        console.error("NHTSA: Missing critical fields", extracted);
        return null;
      }

      // ── Upsert database records: makes → models → trims → engines ──
      const makeId = await ctx.runMutation(
        internal.vehicle_mutations.upsertMake,
        { name: extracted.make }
      );

      const modelId = await ctx.runMutation(
        internal.vehicle_mutations.upsertModel,
        { makeId, name: extracted.model }
      );

      const trimId = await ctx.runMutation(
        internal.vehicle_mutations.upsertTrim,
        {
          modelId,
          name: extracted.trim,
          year: extracted.year,
        }
      );

      const engineId = await ctx.runMutation(
        internal.vehicle_mutations.upsertEngine,
        {
          trimId,
          engineCode: extracted.engineCode,
          cylinders: extracted.cylinders,
          displacement: extracted.displacement,
          fuelType: extracted.fuelType,
        }
      );

      return {
        makeId,
        modelId,
        trimId,
        engineId,
        make: extracted.make,
        model: extracted.model,
        year: extracted.year,
        trim: extracted.trim,
        engineCode: extracted.engineCode,
        cylinders: extracted.cylinders,
        displacement: extracted.displacement,
        fuelType: extracted.fuelType,
      };
    } catch (error) {
      console.error("VIN pipeline error:", error);
      return null;
    }
  },
});

// ============================================
// STAGE 3: AI ENRICHMENT (Claude)
// ============================================

/**
 * Use Claude to research vehicle specs that NHTSA doesn't provide:
 *   - Oil type, capacity, viscosity
 *   - OEM part numbers (filters, brake pads, spark plugs)
 *   - Maintenance intervals
 *   - Tire specs, brake specs
 *
 * Stores results in engine_specs, vehicle_specs, trim_specs.
 * Creates ai_enrichment_logs for audit trail.
 */
export const enrichVehicleSpecs = internalAction({
  args: {
    engineId: v.id("engines"),
    make: v.string(),
    model: v.string(),
    year: v.float64(),
    trim: v.string(),
    engineCode: v.string(),
    displacement: v.string(),
    cylinders: v.float64(),
    fuelType: v.string(),
  },
  handler: async (ctx, args) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      console.error("ANTHROPIC_API_KEY not set — skipping enrichment");
      return;
    }

    // ── Re-enrichment guard ──
    const existingSpecs = await ctx.runQuery(
      internal.vehicle_mutations.getEngineSpecs,
      { engineId: args.engineId }
    );
    const existingSvcSpecsCount = await ctx.runQuery(
      internal.vehicle_mutations.getServiceVehicleSpecsCount,
      { engineId: args.engineId }
    );

    const needsBaseSpecs = !existingSpecs;
    const needsPricing = existingSvcSpecsCount === 0;

    if (!needsBaseSpecs && !needsPricing) {
      console.log(`Specs and pricing already exist for engine ${args.engineId}`);
      return;
    }

    const vehicleDesc = `${args.year} ${args.make} ${args.model} ${args.trim} (${args.displacement}L ${args.cylinders}-cylinder ${args.fuelType}, engine code: ${args.engineCode})`;

    // ── Variables populated by base-specs call, used by pricing call ──
    let oilViscosity = "N/A";
    let oilCapacityQts = 0;
    let confidenceScore = 0.75;

    // ============================================================
    // CLAUDE CALL #1 — Base specs (engine, vehicle, trim)
    // ============================================================
    if (needsBaseSpecs) {
      const prompt = `You are an automotive parts specialist. I need accurate OEM specifications for a ${vehicleDesc}.

Return ONLY a JSON object with no additional text. Every field must be filled — use "N/A" if truly unknown.

{
  "engine_specs": {
    "oil_viscosity": "e.g. 0W-20",
    "oil_capacity_qts": 5.0,
    "oil_change_interval": "e.g. 5000 miles or 6 months",
    "coolant_type": "e.g. Toyota Super Long Life Coolant",
    "coolant_capacity_qts": 6.0,
    "brake_fluid_type": "e.g. DOT 3",
    "tire_rotation_interval": "e.g. 5000 miles",
    "spark_plug_interval": "e.g. 60000 miles",
    "serpentine_belt_interval": "e.g. 60000 miles",
    "transmission_fluid_interval": "e.g. 60000 miles",
    "engine_air_filter_interval": "e.g. 30000 miles",
    "cabin_air_filter_interval": "e.g. 15000 miles",
    "timing_type": "belt or chain or gear",
    "steering_type": "hydraulic or electric"
  },
  "vehicle_specs": {
    "oil_filter_oem": "e.g. 04152-YZZA1",
    "oil_drain_plug_gasket_oem": "e.g. 90430-12031",
    "engine_air_filter_oem": "e.g. 17801-YZZ05",
    "cabin_air_filter_oem": "e.g. 87139-YZZ10",
    "front_brake_pad_oem": "e.g. 04465-33471",
    "rear_brake_pad_oem": "e.g. 04466-33210",
    "front_brake_rotor_oem": "e.g. 43512-33130",
    "rear_brake_rotor_oem": "e.g. 42431-33130",
    "spark_plug_oem": "e.g. 90919-01253",
    "spark_plug_quantity": 4,
    "spark_plug_gap_mm": 1.1,
    "serpentine_belt_oem": "e.g. 90916-02705",
    "battery_group": "e.g. 35",
    "battery_cca": 550,
    "oil_viscosity": "e.g. 0W-20",
    "oil_capacity_qts": "5.0",
    "parking_brake_type": "e.g. drum-in-disc"
  },
  "trim_specs": {
    "tire_size_front": "e.g. 215/55R17",
    "tire_size_rear": "e.g. 215/55R17",
    "recommended_tire_pressure_front_psi": 35,
    "recommended_tire_pressure_rear_psi": 35,
    "lug_nut_torque_ft_lbs": 76,
    "wiper_blade_driver_size_in": 26,
    "wiper_blade_passenger_size_in": 16,
    "parking_brake_type": "e.g. drum-in-disc"
  },
  "confidence_score": 0.85
}`;

      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 50000,
            tools: [{
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 5,
            }],
          }),
        });

        if (!response.ok) {
          console.error("Claude API error (base specs):", await response.text());
          return;
        }

        const result = await response.json();
        const specs = extractJsonFromContentBlocks(result.content || []);

        confidenceScore = specs.confidence_score || 0.75;

        if (confidenceScore < 0.7) {
          console.warn(
            `[AI Enrichment] Low confidence ${confidenceScore} for engine ${args.engineId} — flagged for manual review`
          );
        }

        // ── Store engine_specs ──
        if (specs.engine_specs) {
          oilViscosity = specs.engine_specs.oil_viscosity || "N/A";
          oilCapacityQts = parseFloat(specs.engine_specs.oil_capacity_qts) || 0;
          await ctx.runMutation(internal.vehicle_mutations.storeEngineSpecs, {
            engineId: args.engineId,
            specs: specs.engine_specs,
            confidenceScore,
          });

          // Store timing_type on engines table
          const timingType = specs.engine_specs.timing_type;
          if (timingType && timingType !== "N/A") {
            await ctx.runMutation(internal.vehicle_mutations.patchEngine, {
              engineId: args.engineId,
              timingType,
            });
          }

          // Store steering_type on trims table (per spec: timing→engines, steering→trims)
          const steeringType = specs.engine_specs.steering_type;
          if (steeringType && steeringType !== "N/A") {
            const engine = await ctx.runQuery(
              internal.vehicle_mutations.getEngine,
              { engineId: args.engineId }
            );
            if (engine) {
              await ctx.runMutation(internal.vehicle_mutations.patchTrim, {
                trimId: engine.trim_id,
                steeringType,
              });
            }
          }
        }

        // ── Store vehicle_specs ──
        if (specs.vehicle_specs) {
          await ctx.runMutation(internal.vehicle_mutations.storeVehicleSpecs, {
            engineId: args.engineId,
            specs: specs.vehicle_specs,
            confidenceScore,
          });
        }

        // ── Store trim_specs ──
        if (specs.trim_specs) {
          const engine = await ctx.runQuery(
            internal.vehicle_mutations.getEngine,
            { engineId: args.engineId }
          );
          if (engine) {
            await ctx.runMutation(internal.vehicle_mutations.storeTrimSpecs, {
              trimId: engine.trim_id,
              specs: specs.trim_specs,
              confidenceScore,
            });
          }
        }

        // ── Log the enrichment ──
        await ctx.runMutation(internal.vehicle_mutations.logEnrichment, {
          engineId: args.engineId,
          confidenceScore,
          source: "claude-sonnet",
        });

        console.log(
          `Enriched specs for ${vehicleDesc} (confidence: ${confidenceScore})`
        );
      } catch (error) {
        console.error("AI enrichment error (base specs):", error);
        await ctx.runMutation(internal.vehicle_mutations.logEnrichment, {
          engineId: args.engineId,
          confidenceScore: 0,
          source: "claude-sonnet-failed",
        });
        // Don't return — still attempt pricing if base specs existed before
        if (!existingSpecs) return;
      }
    } else {
      // Base specs already exist — pull values for pricing prompt context
      oilViscosity = existingSpecs.oil_viscosity || "N/A";
      oilCapacityQts = existingSpecs.oil_capacity_qts || 0;
      confidenceScore = existingSpecs.confidence_score || 0.75;
    }

    // ============================================================
    // CLAUDE CALL #2 — Service pricing (service_vehicle_specs)
    // ============================================================
    if (needsPricing) {
      try {
        // Fetch all services
        const services = await ctx.runQuery(
          internal.vehicle_mutations.listAllServices,
          {}
        );

        if (!services || services.length === 0) {
          console.log("No services found — skipping pricing enrichment");
          return;
        }

        // Build service list for the prompt
        const serviceList = services
          .map(
            (s: any) =>
              `- "${s.name}" (slug: ${s.slug}, default_labor: ${s.default_labor_hours}h, labor_only: ${s.is_labor_only})`
          )
          .join("\n");

        const pricingPrompt = `You are an automotive service pricing specialist. I need accurate labor hours, parts cost estimates, AND OEM maintenance intervals for servicing a ${vehicleDesc}.

Vehicle specs already known:
- Oil: ${oilViscosity}, ${oilCapacityQts} qts
- Engine: ${args.displacement}L ${args.cylinders}-cyl ${args.fuelType}

Services to price:
${serviceList}

Use web search to find real-world parts pricing and labor times for this SPECIFIC vehicle. Check auto parts retailers for parts pricing, RepairPal/mechanic forums for labor times, and manufacturer maintenance schedules for OEM intervals.

Return ONLY a JSON array:
[
  {
    "slug": "oil-change",
    "labor_hours": 0.5,
    "parts_cost_low": 35.00,
    "parts_cost_high": 55.00,
    "confidence_score": 0.9,
    "tech_notes": "Uses 0W-20 synthetic. OEM filter ...",
    "oem_interval_miles": 5000,
    "oem_interval_months": 6,
    "oem_interval_note": "Every 5,000 miles or 6 months under normal conditions",
    "parts_required": [{"name": "Oil filter", "oem_part_num": "04152-YZZA1", "cost_estimate": 8.50}],
    "is_applicable": true,
    "exclusion_reason": null
  }
]

Rules:
- Include ALL services listed above. For labor_only services: parts_cost_low and parts_cost_high must be 0.
- Reflect THIS vehicle's real-world pricing, not generic defaults.
- confidence_score: 0.6 if estimating, 0.9+ if verified via web search.
- oem_interval_miles/months: The manufacturer-recommended interval. Use null if not applicable.
- is_applicable: false if the service doesn't apply (e.g. timing belt on a chain engine, diesel on gas vehicle).
- exclusion_reason: brief explanation when is_applicable is false (e.g. "Chain-driven, no timing belt").`;

        const pricingResponse = await fetch(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 8000,
              messages: [{ role: "user", content: pricingPrompt }],
              tools: [{
                type: "web_search_20250305",
                name: "web_search",
                max_uses: 5,
              }],
            }),
          }
        );

        if (!pricingResponse.ok) {
          console.error(
            "Claude API error (pricing):",
            await pricingResponse.text()
          );
          return;
        }

        const pricingResult = await pricingResponse.json();
        const pricingData: any[] = extractJsonFromContentBlocks(
          pricingResult.content || []
        );

        // Build slug → service ID map
        const slugToService = new Map<string, any>();
        for (const svc of services) {
          slugToService.set(svc.slug, svc);
        }

        // Loop through results and upsert
        for (const item of pricingData) {
          const svc = slugToService.get(item.slug);
          if (!svc) {
            console.log(`Unknown service slug "${item.slug}" — skipping`);
            continue;
          }

          const laborHours = parseFloat(item.labor_hours) || svc.default_labor_hours;
          const partsCostLow = parseFloat(item.parts_cost_low) || 0;
          const partsCostHigh = parseFloat(item.parts_cost_high) || 0;
          const itemConfidence = parseFloat(item.confidence_score) || 0.6;
          if (itemConfidence < 0.7) {
            console.warn(
              `[AI Pricing] Low confidence ${itemConfidence} for ${item.slug} on engine ${args.engineId} — flagged for manual review`
            );
          }
          const techNotes = item.tech_notes || "";

          await ctx.runMutation(
            internal.vehicle_mutations.upsertServiceVehicleSpec,
            {
              engineId: args.engineId,
              serviceId: svc._id,
              laborHours,
              partsCostLow,
              partsCostHigh,
              confidenceScore: itemConfidence,
              techNotes,
              oemIntervalMiles: item.oem_interval_miles ?? undefined,
              oemIntervalMonths: item.oem_interval_months ?? undefined,
              oemIntervalNote: item.oem_interval_note ?? undefined,
              partsRequired: item.parts_required
                ? JSON.stringify(item.parts_required)
                : undefined,
              isApplicable: item.is_applicable !== false,
              exclusionReason: item.exclusion_reason ?? undefined,
            }
          );

          await ctx.runMutation(
            internal.vehicle_mutations.logServiceEnrichment,
            {
              engineId: args.engineId,
              serviceId: svc._id,
              source: "claude-sonnet-pricing",
              confidenceScore: itemConfidence,
              enrichedData: {
                labor_hours: laborHours,
                parts_cost_low: partsCostLow,
                parts_cost_high: partsCostHigh,
                tech_notes: techNotes,
              },
            }
          );
        }

        console.log(
          `Enriched service pricing for ${vehicleDesc} (${pricingData.length} services)`
        );
      } catch (error) {
        console.error("AI enrichment error (pricing):", error);
        // Pricing failure does not lose base specs — they were already stored
      }
    }
  },
});

// ============================================
// PUBLIC ACTIONS (called from client)
// ============================================

/**
 * Decode a VIN via NHTSA and upsert makes/models/trims/engines.
 * Returns decoded vehicle info for the review screen.
 */
export const decodeVin = action({
  args: { vin: v.string() },
  handler: async (ctx, args) => {
    const vin = args.vin.toUpperCase().trim();

    if (vin.length !== 17) {
      return { success: false as const, error: "VIN must be exactly 17 characters" };
    }

    const result = await ctx.runAction(internal.vehicle_pipeline.processVin, { vin });

    if (!result) {
      return { success: false as const, error: "Could not decode this VIN. Please check and try again." };
    }

    return {
      success: true as const,
      vin,
      makeId: result.makeId,
      modelId: result.modelId,
      trimId: result.trimId,
      engineId: result.engineId,
      make: result.make,
      model: result.model,
      year: result.year,
      trim: result.trim,
      engineCode: result.engineCode,
      cylinders: result.cylinders,
      displacement: result.displacement,
      fuelType: result.fuelType,
    };
  },
});

/**
 * Confirm a decoded vehicle for the current user.
 * Creates vehicle + owner records and schedules AI enrichment.
 */
export const confirmVehicleForUser = action({
  args: {
    vin: v.string(),
    trimId: v.id("trims"),
    engineId: v.id("engines"),
    year: v.float64(),
    make: v.string(),
    model: v.string(),
    trim: v.string(),
    engineCode: v.string(),
    displacement: v.string(),
    cylinders: v.float64(),
    fuelType: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Resolve current user from auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false as const, error: "Not authenticated" };
    }

    const user = await ctx.runQuery(internal.vehicle_mutations.getUserByClerkId, {
      clerkUserId: identity.subject,
    });
    if (!user) {
      return { success: false as const, error: "User not found" };
    }

    const vin = args.vin.toUpperCase().trim();

    // Upsert vehicle catalog record
    await ctx.runMutation(api.vehicles.upsertVehicle, {
      vin,
      trim_id: args.trimId,
      engine_id: args.engineId,
      year: args.year,
      metadata: {
        make: args.make,
        model: args.model,
        color: args.color || "",
      },
    });

    // Link vehicle to user
    const vehicleOwnerId = await ctx.runMutation(api.vehicles.addOwner, {
      vin,
      userId: user._id,
      nickname: `${args.year} ${args.make} ${args.model}`,
      is_primary: true,
    });

    // Schedule AI enrichment in background
    await ctx.scheduler.runAfter(0, internal.vehicle_pipeline.enrichVehicleSpecs, {
      engineId: args.engineId,
      make: args.make,
      model: args.model,
      year: args.year,
      trim: args.trim,
      engineCode: args.engineCode,
      displacement: args.displacement,
      cylinders: args.cylinders,
      fuelType: args.fuelType,
    });

    return { success: true as const, vehicleOwnerId };
  },
});

// ============================================
// HELPERS
// ============================================

/**
 * Extract a field from NHTSA DecodeVinValuesExtended response.
 * The endpoint returns Results as an array with a single flat object
 * where keys are field names (e.g. { Make: "HONDA", Model: "Civic", ... }).
 */
function getValue(nhtsaData: any, variable: string): string {
  const row = nhtsaData?.Results?.[0];
  if (!row) return "";
  const val = row[variable];
  return typeof val === "string" ? val.trim() : "";
}

/**
 * Extract JSON from Claude API response content blocks.
 *
 * When Claude uses web_search, the response contains mixed block types:
 *   - "text" blocks (conversational preamble + actual JSON)
 *   - "server_tool_use" blocks (search queries)
 *   - "web_search_tool_result" blocks (search results)
 *
 * This helper:
 *   1. Filters for "text" blocks only
 *   2. Concatenates their text
 *   3. Strips markdown fences
 *   4. Finds the outermost JSON object ({…}) or array ([…]) in the text
 *   5. Parses and returns it
 *
 * This is necessary because Claude often wraps JSON in conversational text
 * like "Based on the search results, here is the data:" before the actual JSON.
 */
function extractJsonFromContentBlocks(content: any[]): any {
  const textParts = content
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("\n");

  const stripped = textParts
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  // Try direct parse first (ideal case — response is pure JSON)
  try {
    return JSON.parse(stripped);
  } catch {
    // Fall through to bracket-matching extraction
  }

  // Find the outermost JSON structure (object or array) in the text.
  // Scan for the first '{' or '[' and find its matching closer.
  const startObj = stripped.indexOf("{");
  const startArr = stripped.indexOf("[");

  let startIdx: number;
  let openChar: string;
  let closeChar: string;

  if (startObj === -1 && startArr === -1) {
    throw new Error("No JSON object or array found in Claude response");
  } else if (startArr === -1 || (startObj !== -1 && startObj < startArr)) {
    startIdx = startObj;
    openChar = "{";
    closeChar = "}";
  } else {
    startIdx = startArr;
    openChar = "[";
    closeChar = "]";
  }

  // Walk forward counting braces/brackets, respecting strings
  let depth = 0;
  let inString = false;
  let escape = false;
  let endIdx = -1;

  for (let i = startIdx; i < stripped.length; i++) {
    const ch = stripped[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === openChar) depth++;
    if (ch === closeChar) depth--;

    if (depth === 0) {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) {
    throw new Error("Unbalanced JSON structure in Claude response");
  }

  return JSON.parse(stripped.slice(startIdx, endIdx + 1));
}
