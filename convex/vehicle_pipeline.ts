/**
 * Vehicle Data Pipeline — Convex Actions
 *
 * Stage 2: NHTSA VIN Decode + AI Normalization
 *   VIN → NHTSA raw → (optional) Claude normalizes model/trim/drivetrain/engine_code → makes, models, trims, engines, chassis_variants
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
      const response = await fetch(`${NHTSA_API}/${args.vin}?format=json`);
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

      // Extract fields from NHTSA
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
        driveType: getValue(data, "DriveType") || "",
        trim2: getValue(data, "Trim2") || "",
        series: getValue(data, "Series") || "",
        series2: getValue(data, "Series2") || "",
      };

      if (!extracted.make || !extracted.model || !extracted.year) {
        console.error("NHTSA: Missing critical fields", extracted);
        return null;
      }

      // ── Optional: AI normalization (correct model/trim/drivetrain/engine_code when NHTSA is wrong) ──
      let finalModel = extracted.model;
      let finalTrim = extracted.trim;
      let finalEngineCode = extracted.engineCode;
      let drivetrainType: string | undefined;

      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicKey) {
        const normalized = await normalizeNhtsaWithClaude(anthropicKey, {
          make: extracted.make,
          year: extracted.year,
          nhtsaModel: extracted.model,
          nhtsaTrim: extracted.trim,
          nhtsaTrim2: extracted.trim2,
          nhtsaSeries: extracted.series,
          nhtsaSeries2: extracted.series2,
          bodyClass: extracted.bodyStyle,
          driveType: extracted.driveType,
          engineModel: extracted.engineCode,
        });
        if (normalized) {
          if (normalized.model) finalModel = normalized.model;
          if (normalized.trim) finalTrim = normalized.trim;
          if (normalized.engine_code) finalEngineCode = normalized.engine_code;
          if (normalized.drivetrain_type) drivetrainType = normalized.drivetrain_type;
        }
      }

      // ── Upsert database records: makes → models → trims → engines ──
      const makeId = await ctx.runMutation(internal.vehicle_mutations.upsertMake, { name: extracted.make });

      const modelId = await ctx.runMutation(internal.vehicle_mutations.upsertModel, { makeId, name: finalModel });

      const trimId = await ctx.runMutation(internal.vehicle_mutations.upsertTrim, {
        modelId,
        name: finalTrim,
        year: extracted.year,
      });

      // ── Drivetrain variant (e.g. xDrive → awd) when AI provided it ──
      const canonicalDrivetrain = drivetrainType ? toCanonicalDrivetrain(drivetrainType) : undefined;
      if (canonicalDrivetrain) {
        await ctx.runMutation(api.chassis_variants.upsertChassisVariant, {
          trim_id: trimId,
          drivetrain_type: canonicalDrivetrain,
          confidence_score: 0.85,
        });
      }

      const engineId = await ctx.runMutation(internal.vehicle_mutations.upsertEngine, {
        trimId,
        engineCode: finalEngineCode,
        cylinders: extracted.cylinders,
        displacement: extracted.displacement,
        fuelType: extracted.fuelType,
      });

      return {
        makeId,
        modelId,
        trimId,
        engineId,
        make: extracted.make,
        model: finalModel,
        year: extracted.year,
        trim: finalTrim,
        engineCode: finalEngineCode,
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
    const existingSpecs = await ctx.runQuery(internal.vehicle_mutations.getEngineSpecs, { engineId: args.engineId });
    const existingSvcSpecsCount = await ctx.runQuery(internal.vehicle_mutations.getServiceVehicleSpecsCount, {
      engineId: args.engineId,
    });

    const needsBaseSpecs = !existingSpecs;
    const needsPricing = existingSvcSpecsCount === 0;

    if (!needsBaseSpecs && !needsPricing) {
      console.log(`Specs and pricing already exist for engine ${args.engineId}`);
      return;
    }

    // ── Infer engine code from model + trim + year when NHTSA didn't provide it ──
    let effectiveEngineCode = args.engineCode?.trim() ?? "";
    if (!effectiveEngineCode) {
      const inferred = await inferEngineCodeFromVehicle(anthropicKey, {
        make: args.make,
        model: args.model,
        trim: args.trim,
        year: args.year,
        displacement: args.displacement,
        cylinders: args.cylinders,
        fuelType: args.fuelType,
      });
      if (inferred) {
        await ctx.runMutation(internal.vehicle_mutations.updateEngineCode, {
          engineId: args.engineId,
          engineCode: inferred,
        });
        effectiveEngineCode = inferred;
        await delay(5_000); // Spread rate limit: inference then base specs
      }
    }

    const vehicleDesc = `${args.year} ${args.make} ${args.model} ${args.trim} (${args.displacement}L ${args.cylinders}-cylinder ${args.fuelType}, engine code: ${effectiveEngineCode})`;

    // ── Variables populated by base-specs call, used by pricing call ──
    let oilViscosity = "N/A";
    let oilCapacityQts = 0;
    let confidenceScore = 0.75;

    // ============================================================
    // CLAUDE CALL #1 — Base specs (engine, vehicle, trim)
    // ============================================================
    if (needsBaseSpecs) {
      const specsPrompt = `You are an automotive OEM specifications extractor.

      Vehicle: ${vehicleDesc}
      
      Goal: Fill the JSON template EXACTLY. Output ONLY valid JSON (no markdown, no comments).
      
      SEARCH STRATEGY (use web_search)
      - Search by make + model + trim + year (e.g. "BMW 5 Series M550i 2020") and by engine code when present.
      - If exact match yields few results, also search by make + trim (e.g. "BMW M550i") or model line + trim; many OEM parts are shared across years and engine variants.
      - Prefer filling every OEM part number when you find a reliable source (OEM catalog, dealer, parts site). Only use "N/A" when no reasonable source is found after trying the fallback ladder below.
      
      FALLBACK LADDER (try in order; use first tier that returns part numbers)
      1) Exact vehicle (year + make + model + trim + engine code)
      2) Same trim, different year (e.g. 2019–2021 M550i)
      3) Same engine code in same make/model family
      4) Same model line + trim without engine code (e.g. "BMW 5 Series M550i parts")
      
      Rules:
      - Every field MUST be present.
      - Use "N/A" only when no reliable part number is found after the fallback ladder. Do NOT default to N/A when a plausible match exists.
      - Do NOT invent OEM part numbers. When a part number appears in OEM/dealer/parts catalog sources, include it.
      - Prefer values that are specific to: exact year/trim/engine code > same engine code > same model/gen > generic.
      - confidence_score: 0.90+ verified exact match, 0.70-0.89 strong match (same engine code/platform), 0.50-0.69 partial/estimated, <0.50 mostly unknown.
      
      Return this JSON shape:
      
      {
        "engine_specs": {
          "oil_viscosity": "",
          "oil_capacity_qts": 0,
          "oil_change_interval": "",
          "coolant_type": "",
          "coolant_capacity_qts": 0,
          "brake_fluid_type": "",
          "tire_rotation_interval": "",
          "spark_plug_interval": "",
          "serpentine_belt_interval": "",
          "transmission_fluid_interval": "",
          "engine_air_filter_interval": "",
          "cabin_air_filter_interval": ""
        },
        "vehicle_specs": {
          "oil_filter_oem": "",
          "oil_drain_plug_gasket_oem": "",
          "engine_air_filter_oem": "",
          "cabin_air_filter_oem": "",
          "front_brake_pad_oem": "",
          "rear_brake_pad_oem": "",
          "front_brake_rotor_oem": "",
          "rear_brake_rotor_oem": "",
          "spark_plug_oem": "",
          "spark_plug_quantity": 0,
          "spark_plug_gap_mm": 0,
          "serpentine_belt_oem": "",
          "battery_group": "",
          "battery_cca": 0,
          "oil_viscosity": "",
          "oil_capacity_qts": 0,
          "parking_brake_type": ""
        },
        "trim_specs": {
          "tire_size_front": "",
          "tire_size_rear": "",
          "recommended_tire_pressure_front_psi": 0,
          "recommended_tire_pressure_rear_psi": 0,
          "lug_nut_torque_ft_lbs": 0,
          "wiper_blade_driver_size_in": 0,
          "wiper_blade_passenger_size_in": 0,
          "parking_brake_type": ""
        },
        "confidence_score": 0
      }`;

      try {
        const response = await fetchAnthropicWithRetry(anthropicKey, {
          model: "claude-sonnet-4-5-20250929",
          messages: [{ role: "user", content: specsPrompt }],
          max_tokens: 50000,
          temperature: 0.1,
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 10,
            },
          ],
        });

        if (!response.ok) {
          console.error("Claude API error (base specs):", await response.text());
          return;
        }

        const result = await response.json();
        const specs = extractJsonFromContentBlocks(result.content || []);

        confidenceScore = specs.confidence_score || 0.75;

        // ── Store engine_specs ──
        if (specs.engine_specs) {
          oilViscosity = specs.engine_specs.oil_viscosity || "N/A";
          oilCapacityQts = parseFloat(specs.engine_specs.oil_capacity_qts) || 0;
          await ctx.runMutation(internal.vehicle_mutations.storeEngineSpecs, {
            engineId: args.engineId,
            specs: specs.engine_specs,
            confidenceScore,
          });
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
          const engine = await ctx.runQuery(internal.vehicle_mutations.getEngine, { engineId: args.engineId });
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

        console.log(`Enriched specs for ${vehicleDesc} (confidence: ${confidenceScore})`);
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
        const services = await ctx.runQuery(internal.vehicle_mutations.listAllServices, {});

        if (!services || services.length === 0) {
          console.log("No services found — skipping pricing enrichment");
          return;
        }

        // Build service list for the prompt
        const serviceList = services
          .map(
            (s: any) =>
              `- "${s.name}" (slug: ${s.slug}, default_labor: ${s.default_labor_hours}h, labor_only: ${s.is_labor_only})`,
          )
          .join("\n");

        const pricingPrompt = `You are an automotive service pricing specialist.

          Vehicle: ${vehicleDesc}
          
          Known specs (use these):
          - Oil viscosity: ${oilViscosity}
          - Oil capacity (qts): ${oilCapacityQts}
          - Engine: ${args.displacement}L ${args.cylinders}-cyl ${args.fuelType}
          - Engine code: ${effectiveEngineCode}
          
          Services to price (include ALL of them):
          ${serviceList}
          
          GOAL
          For EACH service slug, return labor_hours and parts_cost_low/high for THIS vehicle.
          Use web research. Prefer primary/commercial sources over opinions.
          
          ALLOWED SOURCE TYPES
          - Dealer parts sites / OEM parts catalogs (pricing references)
          - Major parts retailers (pricing references)
          - Reputable shop menus/quotes/estimates (labor references)
          - Publicly visible labor-time references (if available)
          
          NOT ALLOWED
          - RepairPal
          - Forums as a primary source (forums may only sanity-check; never “verify”)
          
          CRITICAL RULES
          1) LABOR-ONLY services: parts_cost_low=0, parts_cost_high=0, parts_list=[]
          2) Do NOT invent OEM part numbers. If unconfirmed, omit part numbers.
          3) If exact trim data is missing, use the fallback ladder and widen ranges.
          
          FALLBACK LADDER
          1) Exact vehicle/trim
          2) Same generation/platform
          3) Same engine code (M176) in closest Mercedes model
          4) Generic luxury performance car estimate
          When using fallback, widen ranges and state fallback in tech_notes.
          
          PER-SERVICE LIMITS (must follow)
          - tech_notes: max 120 characters
          - sources: max 2 items
          - parts_list: max 4 items
          
          CONFIDENCE SCORING (evidence-based)
          - 0.90+ = labor AND parts both supported by sources (2 sources total is fine)
          - 0.70–0.89 = one of labor/parts supported, other inferred via fallback ladder
          - <=0.69 = mostly inferred/estimated (must say why in tech_notes)
          
          EXAMPLE FORMAT (placeholders only; do not reuse values)
          [
            {
              "slug": "oil-change",
              "labor_hours": 0,
              "parts_cost_low": 0,
              "parts_cost_high": 0,
              "confidence_score": 0,
              "parts_list": [
                { "item": "engine oil", "qty": 0, "price_low": 0, "price_high": 0 },
                { "item": "oil filter", "qty": 0, "price_low": 0, "price_high": 0 }
              ],
              "tech_notes": "",
              "sources": []
            }
          ]
          
          RETURN ONLY valid JSON array (no extra text). Each element MUST include EXACT fields:
          [
            {
              "slug": string,
              "labor_hours": number,
              "parts_cost_low": number,
              "parts_cost_high": number,
              "confidence_score": number,
              "parts_list": Array<{ "item": string, "qty": number, "price_low": number, "price_high": number }>,
              "tech_notes": string,
              "sources": string[]
            }
          ]`;

        // Spread tokens across rate-limit window: wait before pricing so we don't burst with base specs.
        await delay(15_000);

        const pricingResponse = await fetchAnthropicWithRetry(anthropicKey, {
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 16000,
          temperature: 0.1,
          messages: [{ role: "user", content: pricingPrompt }],
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 5,
            },
          ],
        });

        if (!pricingResponse.ok) {
          console.error("Claude API error (pricing):", await pricingResponse.text());
          return;
        }

        const pricingResult = await pricingResponse.json();
        const pricingData: any[] = extractJsonFromContentBlocks(pricingResult.content || []);

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
          const techNotes = item.tech_notes || "";

          await ctx.runMutation(internal.vehicle_mutations.upsertServiceVehicleSpec, {
            engineId: args.engineId,
            serviceId: svc._id,
            laborHours,
            partsCostLow,
            partsCostHigh,
            confidenceScore: itemConfidence,
            techNotes,
          });

          await ctx.runMutation(internal.vehicle_mutations.logServiceEnrichment, {
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
          });
        }

        console.log(`Enriched service pricing for ${vehicleDesc} (${pricingData.length} services)`);
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
    });

    // Link vehicle to user
    await ctx.runMutation(api.vehicles.addOwner, {
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

    return { success: true as const };
  },
});

// ============================================
// HELPERS
// ============================================

/** Delay for ms milliseconds (used to spread Claude calls and respect rate limits). */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Anthropic Messages API with retry on 429 (rate limit).
 * Waits 60s and retries up to maxRetries times to stay within 30k input tokens/min.
 */
async function fetchAnthropicWithRetry(
  anthropicKey: string,
  body: Record<string, unknown>,
  maxRetries = 2,
): Promise<Response> {
  const url = "https://api.anthropic.com/v1/messages";
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    lastResponse = response;
    if (response.status === 429) {
      const text = await response.text();
      const waitMs = 60_000; // 1 minute to align with org limit window
      if (attempt < maxRetries) {
        console.warn(`Claude rate limit (429), waiting ${waitMs / 1000}s before retry (${attempt + 1}/${maxRetries})`);
        await delay(waitMs);
        continue;
      }
      console.error("Claude API rate limit after retries:", text);
      return response;
    }
    return response;
  }
  return lastResponse!;
}

/** Normalize AI drivetrain label to schema value: fwd | rwd | awd | 4wd */
function toCanonicalDrivetrain(value: string): "fwd" | "rwd" | "awd" | "4wd" | undefined {
  const v = value.toLowerCase().trim();
  if (v === "fwd" || v === "rwd" || v === "awd" || v === "4wd") return v as "fwd" | "rwd" | "awd" | "4wd";
  if (v === "xdrive" || v === "4matic" || v === "quattro" || v === "4motion") return "awd";
  if (v === "sdrive") return "rwd";
  return undefined;
}

/**
 * Call Claude to normalize NHTSA model/trim/drivetrain/engine_code into canonical OEM naming.
 * Returns null on failure or missing key; otherwise { model?, trim?, drivetrain_type?, engine_code? }.
 */
async function normalizeNhtsaWithClaude(
  anthropicKey: string,
  nhtsa: {
    make: string;
    year: number;
    nhtsaModel: string;
    nhtsaTrim: string;
    nhtsaTrim2: string;
    nhtsaSeries: string;
    nhtsaSeries2: string;
    bodyClass: string;
    driveType: string;
    engineModel: string;
  },
): Promise<{ model?: string; trim?: string; drivetrain_type?: string; engine_code?: string } | null> {
  const prompt = `You are an automotive data normalizer. NHTSA VIN decode often mislabels model vs trim vs drivetrain (e.g. BMW M550i xDrive: Model="M550i", Trim="xdrive" — but model should be "5 Series", trim "M550i", drivetrain "awd").

Input from NHTSA:
- Make: ${nhtsa.make}
- Year: ${nhtsa.year}
- NHTSA Model: ${nhtsa.nhtsaModel}
- NHTSA Trim: ${nhtsa.nhtsaTrim}
- NHTSA Trim2: ${nhtsa.nhtsaTrim2}
- NHTSA Series: ${nhtsa.nhtsaSeries}
- NHTSA Series2: ${nhtsa.nhtsaSeries2}
- BodyClass: ${nhtsa.bodyClass}
- DriveType: ${nhtsa.driveType}
- EngineModel: ${nhtsa.engineModel}

Output ONLY valid JSON (no markdown, no comments) with this exact shape:
{
  "model": "<canonical model line, e.g. 5 Series, 3 Series, Civic>",
  "trim": "<canonical trim/submodel, e.g. M550i, 330i, EX-L>",
  "drivetrain_type": "<one of: fwd, rwd, awd, 4wd — or empty string if unknown>",
  "engine_code": "<OEM engine code if known, e.g. N63B44O2, or empty string to keep NHTSA>"
}

Rules:
- model = the model line (e.g. "5 Series"), not the trim (e.g. "M550i").
- trim = the trim/submodel name; if NHTSA put drivetrain in Trim (e.g. "xdrive"), use the actual trim from NHTSA Model or infer (e.g. "M550i").
- drivetrain_type: infer from Trim/DriveType (xDrive, sDrive, 4matic, quattro → awd/rwd). Use only fwd, rwd, awd, 4wd or "".
- engine_code: fill if you know the OEM code and NHTSA is empty/wrong; otherwise "".
- If a field is truly unknown, use "".
- Output ONLY the JSON object.`;

  try {
    const response = await fetchAnthropicWithRetry(anthropicKey, {
      model: "claude-sonnet-4-5-20250929",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
      temperature: 0.1,
    });

    if (!response.ok) {
      console.error("Claude normalization API error:", await response.text());
      return null;
    }

    const result = await response.json();
    const content = result.content ?? [];
    const parsed = extractJsonFromContentBlocks(Array.isArray(content) ? content : [content]);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      model: typeof parsed.model === "string" ? parsed.model.trim() || undefined : undefined,
      trim: typeof parsed.trim === "string" ? parsed.trim.trim() || undefined : undefined,
      drivetrain_type:
        typeof parsed.drivetrain_type === "string" ? parsed.drivetrain_type.trim() || undefined : undefined,
      engine_code: typeof parsed.engine_code === "string" ? parsed.engine_code.trim() || undefined : undefined,
    };
  } catch (e) {
    console.error("Claude normalization error:", e);
    return null;
  }
}

/**
 * Infer OEM engine code from make + model + trim + year (and optional displacement/cylinders/fuel).
 * Used when NHTSA did not provide engine code so enrichment can run with correct context.
 */
async function inferEngineCodeFromVehicle(
  anthropicKey: string,
  vehicle: {
    make: string;
    model: string;
    trim: string;
    year: number;
    displacement: string;
    cylinders: number;
    fuelType: string;
  },
): Promise<string> {
  const prompt = `You are an automotive expert. Given this vehicle, return ONLY the OEM engine code (e.g. N63B44O2, B58B30M1, K20C1). No explanation.

Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}
Displacement: ${vehicle.displacement}L, ${vehicle.cylinders} cylinders, ${vehicle.fuelType}

Output a single line with only the engine code, or "unknown" if you cannot determine it.`;

  try {
    const response = await fetchAnthropicWithRetry(anthropicKey, {
      model: "claude-sonnet-4-5-20250929",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 128,
      temperature: 0,
    });

    if (!response.ok) return "";

    const result = await response.json();
    const content = result.content ?? [];
    const text = (Array.isArray(content) ? content : [content])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join(" ")
      .trim();
    const code = text.replace(/^["']|["']$/g, "").trim();
    if (code && code.toLowerCase() !== "unknown") return code;
    return "";
  } catch (e) {
    console.error("Engine code inference error:", e);
    return "";
  }
}

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
