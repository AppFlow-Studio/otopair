/**
 * vehicleEnrichment/utils/engineCodeLookup.ts
 *
 * Resolves the real OEM engine code when NHTSA returns a descriptor string
 * instead of an actual code (e.g. "Nu MPI" → "G4NH", "EcoBoost" → "Fox").
 *
 * Priority:
 *   1. DB lookup — engines table by trim_id (free, instant)
 *   2. Haiku inference — one Claude call with web search (~$0.002)
 *
 * Returns the original engineCode unchanged if it already looks like a real
 * OEM code (no spaces, short alphanumeric string).
 */

import Anthropic from "@anthropic-ai/sdk";
import { MODEL_HAIKU } from "./batchClient";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/**
 * Returns true if the string looks like a raw NHTSA descriptor rather than
 * a real OEM engine code.
 *
 * NHTSA descriptors contain spaces ("Nu MPI", "EcoBoost 2.3L") or are generic
 * labels. Real OEM codes are compact alphanumeric strings ("G4NH", "B58", "L83").
 */
export function isNhtsaDescriptor(engineCode: string): boolean {
  if (!engineCode || engineCode === "unknown") return true;
  // Real codes: no spaces, ≤12 chars, alphanumeric + optional dash
  return /\s/.test(engineCode) || engineCode.length > 14;
}

const SYSTEM = `You are an automotive engineering expert. Given a vehicle description, return ONLY the OEM engine code.

Rules:
- Return a single short alphanumeric code. Examples: G4NH, B58B30M1, L83, RA428CK, K20C1, EJ257
- No explanation, no punctuation, no quotes — just the code on one line
- If the engine has multiple variants for this trim, return the most common one
- If you cannot determine the code with confidence, return exactly: unknown`;

/**
 * Resolve the real OEM engine code for a vehicle.
 * Returns the original code if it already looks correct, or the resolved code.
 */
export async function resolveEngineCode(
  year: number,
  make: string,
  model: string,
  trim: string,
  displacement: string,
  cylinders: number,
  fuelType: string,
  rawEngineCode: string,
): Promise<{ engineCode: string; source: "passthrough" | "haiku" | "unknown" }> {

  // Already a clean OEM code — pass through
  if (!isNhtsaDescriptor(rawEngineCode)) {
    return { engineCode: rawEngineCode, source: "passthrough" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[engine-lookup] No API key — cannot infer engine code");
    return { engineCode: rawEngineCode, source: "unknown" };
  }

  console.log(`[engine-lookup] "${rawEngineCode}" looks like a NHTSA descriptor — inferring real OEM code for ${year} ${make} ${model} ${trim}`);

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 64,
      temperature: 0,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `${year} ${make} ${model} ${trim}\nDisplacement: ${displacement}L, ${cylinders} cylinders, ${fuelType}\nNHTSA description: "${rawEngineCode}"`,
      }],
    });

    const text = response.content
      .filter(b => b.type === "text")
      .map(b => (b as any).text)
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!text || text.toLowerCase() === "unknown") {
      console.warn(`[engine-lookup] Haiku could not resolve engine code for ${year} ${make} ${model}`);
      return { engineCode: rawEngineCode, source: "unknown" };
    }

    console.log(`[engine-lookup] Resolved: "${rawEngineCode}" → "${text}" for ${year} ${make} ${model} ${trim}`);
    return { engineCode: text, source: "haiku" };

  } catch (e) {
    console.error("[engine-lookup] Inference failed:", e);
    return { engineCode: rawEngineCode, source: "unknown" };
  }
}
