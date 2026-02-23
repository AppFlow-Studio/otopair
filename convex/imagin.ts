/**
 * imagin.ts - IMAGIN.studio Vehicle Image Integration
 *
 * Fetches watermark-free vehicle images from IMAGIN.studio using Basic Auth,
 * stores them in Convex file storage, and persists the serving URL on the
 * vehicle record.
 *
 * The `getSignedUrl` API returns the same watermarked image as the public
 * `customer=` param approach. The only way to get watermark-free images is
 * to call `getImage` directly with Basic Auth (Authorization header).
 * Since the frontend can't expose the secret, we fetch server-side and
 * store the image in Convex's built-in file storage.
 *
 * Environment variables required:
 *   IMAGIN_CUSTOMER_KEY    - Your IMAGIN.studio customer ID
 *   IMAGIN_CUSTOMER_SECRET - Your IMAGIN.studio customer secret
 */

import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const IMAGIN_BASE = "https://cdn.imagin.studio";

/**
 * Sanitize a value for use in IMAGIN.studio URL params:
 * lowercase, trim, replace non-alphanumeric runs with hyphens.
 */
function sanitize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Build Basic Auth header from customer key and secret.
 */
function getAuthHeader(): string {
  const key = process.env.IMAGIN_CUSTOMER_KEY;
  const secret = process.env.IMAGIN_CUSTOMER_SECRET;
  if (!key || !secret) {
    throw new Error(
      "Missing IMAGIN_CUSTOMER_KEY or IMAGIN_CUSTOMER_SECRET environment variables"
    );
  }
  const encoded = btoa(`${key}:${secret}`);
  return `Basic ${encoded}`;
}

/**
 * Fetch a watermark-free vehicle image from IMAGIN.studio using Basic Auth.
 * Returns the raw image as a Blob.
 */
async function fetchVehicleImageBlob(
  make: string,
  model: string,
  year?: number,
  vin?: string,
  paintDescription?: string
): Promise<Blob> {
  const key = process.env.IMAGIN_CUSTOMER_KEY;
  const params = new URLSearchParams({
    customer: key || "us-appflowstudio",
    make: sanitize(make),
    modelFamily: sanitize(model),
    zoomType: "fullscreen",
    width: "2400",
    angle: "229",
    tailoring: "imagin",
  });
  if (year && year > 1900) {
    params.set("modelYear", String(year));
  }
  const normalizedVin = (vin ?? "").toUpperCase().trim();
  if (normalizedVin.length === 17) {
    params.set("vehicleKey", normalizedVin);
  }
  if (paintDescription) {
    params.set("paintDescription", sanitize(paintDescription));
  }

  const url = `${IMAGIN_BASE}/getImage?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `IMAGIN.studio getImage failed (${response.status}): ${text}`
    );
  }

  return await response.blob();
}

// ============================================================================
// PUBLIC ACTION: Generate and store vehicle image
// ============================================================================

/**
 * Fetch a watermark-free vehicle image and store it in Convex.
 *
 * Call this after creating/upserting a vehicle. It will:
 * 1. Fetch the image from IMAGIN.studio with Basic Auth (no watermark)
 * 2. Upload it to Convex file storage
 * 3. Store the serving URL as image_url on the vehicle record
 * 4. Return the serving URL
 */
export const generateVehicleImage = action({
  args: {
    vin: v.string(),
    make: v.string(),
    model: v.string(),
    year: v.optional(v.float64()),
    paintDescription: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string | null> => {
    if (!args.make || !args.model) {
      console.log("[IMAGIN] Skipping — missing make or model");
      return null;
    }

    try {
      // 1. Fetch watermark-free image from IMAGIN.studio
      const imageBlob = await fetchVehicleImageBlob(
        args.make,
        args.model,
        args.year,
        args.vin,
        args.paintDescription
      );

      console.log(
        `[IMAGIN] Fetched ${(imageBlob.size / 1024).toFixed(0)}KB image for ${args.make} ${args.model}`
      );

      // 2. Upload to Convex file storage
      const storageId = await ctx.storage.store(imageBlob);

      // 3. Get the serving URL and persist to vehicles table
      const servingUrl = await ctx.storage.getUrl(storageId);
      if (!servingUrl) {
        throw new Error("Failed to get serving URL from Convex storage");
      }

      await ctx.runMutation(internal.imagin.storeVehicleImageUrl, {
        vin: args.vin.toUpperCase().trim(),
        imageUrl: servingUrl,
      });

      console.log(
        `[IMAGIN] Stored image for ${args.make} ${args.model} (${args.vin})`
      );
      return servingUrl;
    } catch (error: any) {
      console.error(`[IMAGIN] Error generating image: ${error.message}`);
      return null;
    }
  },
});

// ============================================================================
// INTERNAL MUTATION: Store the image URL on the vehicle record
// ============================================================================

export const storeVehicleImageUrl = internalMutation({
  args: {
    vin: v.string(),
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", args.vin))
      .unique();

    if (!vehicle) {
      console.warn(`[IMAGIN] Vehicle not found for VIN: ${args.vin}`);
      return;
    }

    await ctx.db.patch(vehicle._id, {
      image_url: args.imageUrl,
      updated_at: Date.now(),
    });
  },
});

// ============================================================================
// INTERNAL QUERY: Get all vehicles (for backfill)
// ============================================================================

export const getAllVehiclesWithMakeModel = internalQuery({
  args: {},
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("vehicles").collect();

    return Promise.all(
      vehicles.map(async (vehicle) => {
        const meta = vehicle.metadata as
          | { make?: string; model?: string; color?: string }
          | undefined;
        let make = meta?.make;
        let model = meta?.model;
        const color = meta?.color;

        if ((!make || !model) && vehicle.trim_id) {
          const trim = await ctx.db.get(vehicle.trim_id);
          if (trim) {
            const modelDoc = await ctx.db.get(trim.model_id);
            if (modelDoc) {
              model = model || modelDoc.name;
              const makeDoc = await ctx.db.get(modelDoc.make_id);
              if (makeDoc) {
                make = make || makeDoc.name;
              }
            }
          }
        }

        return { ...vehicle, resolvedMake: make, resolvedModel: model, resolvedColor: color };
      })
    );
  },
});

// ============================================================================
// PUBLIC ACTION: Backfill images for all existing vehicles
// ============================================================================

/**
 * One-off action to generate watermark-free images for all vehicles.
 * Requires make/model to be passed or present in metadata.
 *
 * Run via: npx convex run imagin:backfillAllVehicleImages
 */
export const backfillAllVehicleImages = action({
  args: {},
  handler: async (ctx) => {
    const vehicles = await ctx.runQuery(
      internal.imagin.getAllVehiclesWithMakeModel
    );

    console.log(
      `[IMAGIN] Backfilling images for ${vehicles.length} vehicle(s)…`
    );

    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const vehicle of vehicles) {
      const make = vehicle.resolvedMake;
      const model = vehicle.resolvedModel;

      if (!make || !model) {
        console.log(
          `[IMAGIN] Skipping ${vehicle.vin} — could not resolve make/model`
        );
        skipped++;
        continue;
      }

      try {
        const imageBlob = await fetchVehicleImageBlob(
          make,
          model,
          vehicle.year,
          vehicle.vin,
          vehicle.resolvedColor
        );

        const storageId = await ctx.storage.store(imageBlob);
        const servingUrl = await ctx.storage.getUrl(storageId);

        if (!servingUrl) {
          throw new Error("Failed to get serving URL");
        }

        await ctx.runMutation(internal.imagin.storeVehicleImageUrl, {
          vin: vehicle.vin,
          imageUrl: servingUrl,
        });

        console.log(`[IMAGIN] ✓ ${make} ${model} (${vehicle.vin})`);
        success++;
      } catch (error: any) {
        console.error(
          `[IMAGIN] ✗ ${make} ${model} (${vehicle.vin}): ${error.message}`
        );
        failed++;
      }
    }

    console.log(
      `[IMAGIN] Backfill complete: ${success} success, ${skipped} skipped, ${failed} failed`
    );
    return { success, skipped, failed, total: vehicles.length };
  },
});
