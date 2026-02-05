/**
 * Smartcar Integration — Convex Functions
 *
 * Actions:  External API calls to Smartcar
 * Mutations: Database writes (tokens, connections, mileage)
 * Queries:  Reactive reads for UI
 *
 * Fits into Otopair's 5-stage vehicle pipeline as:
 * - An alternative Stage 1 input (Smartcar Connect instead of manual VIN)
 * - An ongoing data source (webhooks update mileage, health data)
 */

import { v } from "convex/values";
import {
  action,
  query,
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================
// Config
// ============================================

const SMARTCAR_AUTH_URL = "https://auth.smartcar.com/oauth/token";
const SMARTCAR_API = "https://api.smartcar.com/v2.0";
const REDIRECT_URI = "otopair://smartcar/callback";

function getCredentials() {
  const clientId = process.env.SMARTCAR_CLIENT_ID;
  const clientSecret = process.env.SMARTCAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SMARTCAR_CLIENT_ID and SMARTCAR_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

function basicAuth() {
  const { clientId, clientSecret } = getCredentials();
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

// ============================================
// CLIENT-FACING QUERIES
// ============================================

/**
 * Check if a vehicle_owner has an active Smartcar connection
 */
export const getConnectionStatus = query({
  args: { vehicleOwnerId: v.id("vehicle_owners") },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("smartcar_connections")
      .withIndex("by_vehicle_owner", (q) =>
        q.eq("vehicleOwnerId", args.vehicleOwnerId)
      )
      .first();

    if (!connection) return { connected: false };

    return {
      connected: connection.status === "active",
      connectedAt: connection.connectedAt,
      lastSyncedAt: connection.lastSyncedAt,
      status: connection.status,
    };
  },
});

/**
 * Get all connected vehicles for a user
 */
export const getUserConnectedVehicles = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get user's vehicle_owners
    const vehicleOwners = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId))
      .collect();

    // Check which have active Smartcar connections
    const results = [];
    for (const vo of vehicleOwners) {
      const connection = await ctx.db
        .query("smartcar_connections")
        .withIndex("by_vehicle_owner", (q) =>
          q.eq("vehicleOwnerId", vo._id)
        )
        .first();

      results.push({
        ...vo,
        isSmartcarConnected: connection?.status === "active",
        lastSyncedAt: connection?.lastSyncedAt,
      });
    }

    return results;
  },
});

// ============================================
// ACTIONS — External API Calls
// ============================================

/**
 * Exchange OAuth authorization code for tokens.
 * Then fetch connected vehicles, decode VINs, and kick off the pipeline.
 *
 * This is the main entry point after the user completes Smartcar Connect.
 */
export const exchangeCodeAndConnect = action({
  args: {
    code: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    try {
      // ── Step 1: Exchange code for tokens ──
      const tokens = await exchangeCode(args.code);

      // ── Step 2: Get list of vehicle IDs ──
      const vehicleIds = await fetchVehicleIds(tokens.access_token);

      if (vehicleIds.length === 0) {
        return { success: false, error: "No vehicles found" };
      }

      const connectedVehicles = [];

      for (const smartcarVehicleId of vehicleIds) {
        // ── Step 3: Get vehicle info + VIN from Smartcar ──
        const [info, vinData, odometerData] = await Promise.allSettled([
          fetchFromSmartcar(tokens.access_token, smartcarVehicleId, ""),
          fetchFromSmartcar(tokens.access_token, smartcarVehicleId, "/vin"),
          fetchFromSmartcar(tokens.access_token, smartcarVehicleId, "/odometer"),
        ]);

        const vehicleInfo =
          info.status === "fulfilled" ? info.value : null;
        const vin =
          vinData.status === "fulfilled" ? vinData.value?.vin : null;
        const odometer =
          odometerData.status === "fulfilled"
            ? odometerData.value?.distance
            : null;

        if (!vehicleInfo || !vin) {
          console.error(`Failed to get info/VIN for ${smartcarVehicleId}`);
          continue;
        }

        // ── Step 4: Run VIN through pipeline (Stage 1 + 2) ──
        // Process NHTSA decode → create makes/models/trims/engines
        const pipelineResult = await ctx.runAction(
          internal.vehicle_pipeline.processVin,
          { vin }
        );

        // ── Step 5: Create vehicle_owner + vehicle records ──
        const vehicleOwnerId = await ctx.runMutation(
          internal.smartcar.createVehicleOwnerFromSmartcar,
          {
            userId: args.userId,
            vin,
            mileage: odometer || 0,
            nickname: `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`,
            engineId: pipelineResult?.engineId || null,
            vehicleData: pipelineResult
              ? {
                  year: pipelineResult.year,
                  trimId: pipelineResult.trimId,
                  engineId: pipelineResult.engineId,
                  make: pipelineResult.make,
                  model: pipelineResult.model,
                }
              : {
                  year: vehicleInfo.year,
                  trimId: null,
                  engineId: null,
                  make: vehicleInfo.make,
                  model: vehicleInfo.model,
                },
          }
        );

        // ── Step 6: Store Smartcar connection (tokens) ──
        await ctx.runMutation(internal.smartcar.storeConnection, {
          vehicleOwnerId,
          smartcarVehicleId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
        });

        // ── Step 7: Store initial odometer snapshot ──
        if (odometer) {
          await ctx.runMutation(internal.smartcar.storeHealthSnapshot, {
            vehicleOwnerId,
            snapshotType: "odometer",
            data: {
              distance: odometer,
              unit: "mi",
            },
            source: "smartcar",
          });
        }

        // ── Step 8: Trigger AI enrichment if engine_id exists ──
        if (pipelineResult?.engineId) {
          // Schedule AI enrichment (non-blocking)
          await ctx.scheduler.runAfter(
            0,
            internal.vehicle_pipeline.enrichVehicleSpecs,
            {
              engineId: pipelineResult.engineId,
              make: pipelineResult.make,
              model: pipelineResult.model,
              year: pipelineResult.year,
              trim: pipelineResult.trim,
              engineCode: pipelineResult.engineCode,
              displacement: pipelineResult.displacement,
              cylinders: pipelineResult.cylinders,
              fuelType: pipelineResult.fuelType,
            }
          );
        }

        connectedVehicles.push({
          vin,
          make: vehicleInfo.make,
          model: vehicleInfo.model,
          year: vehicleInfo.year,
          odometer,
        });
      }

      return {
        success: true,
        vehicleCount: connectedVehicles.length,
        vehicles: connectedVehicles,
      };
    } catch (error) {
      console.error("Smartcar exchange error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  },
});

/**
 * Fetch latest vehicle data from Smartcar on demand.
 * Handles token refresh automatically.
 */
export const fetchVehicleData = action({
  args: { vehicleOwnerId: v.id("vehicle_owners") },
  handler: async (ctx, args) => {
    // Get connection
    const connection = await ctx.runQuery(
      internal.smartcar.getConnectionByOwner,
      { vehicleOwnerId: args.vehicleOwnerId }
    );

    if (!connection || connection.status !== "active") {
      return { error: "Vehicle not connected" };
    }

    // Refresh token if needed
    let accessToken = connection.accessToken;
    const now = Date.now();
    const fiveMin = 5 * 60 * 1000;

    if (connection.tokenExpiresAt < now + fiveMin) {
      const newTokens = await refreshToken(connection.refreshToken);

      if (!newTokens) {
        await ctx.runMutation(internal.smartcar.markConnectionExpired, {
          connectionId: connection._id,
        });
        return { error: "Connection expired. Please reconnect." };
      }

      accessToken = newTokens.access_token;

      await ctx.runMutation(internal.smartcar.updateTokens, {
        connectionId: connection._id,
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token,
        expiresIn: newTokens.expires_in,
      });
    }

    // Fetch data via batch endpoint
    const data = await fetchBatchData(
      accessToken,
      connection.smartcarVehicleId
    );

    // Update mileage on vehicle_owners
    if (data.odometer) {
      await ctx.runMutation(internal.smartcar.updateMileage, {
        vehicleOwnerId: args.vehicleOwnerId,
        mileage: data.odometer.distance,
      });
    }

    // Update lastSyncedAt
    await ctx.runMutation(internal.smartcar.markSynced, {
      connectionId: connection._id,
    });

    return data;
  },
});

/**
 * Disconnect a vehicle from Smartcar
 */
export const disconnectVehicle = action({
  args: { vehicleOwnerId: v.id("vehicle_owners") },
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(
      internal.smartcar.getConnectionByOwner,
      { vehicleOwnerId: args.vehicleOwnerId }
    );

    if (!connection) {
      return { success: false, error: "No connection found" };
    }

    // Revoke at Smartcar
    if (connection.accessToken) {
      try {
        await fetch(
          `${SMARTCAR_API}/vehicles/${connection.smartcarVehicleId}/application`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${connection.accessToken}`,
            },
          }
        );
      } catch (err) {
        console.error("Smartcar revoke failed:", err);
      }
    }

    // Remove from DB
    await ctx.runMutation(internal.smartcar.deleteConnection, {
      connectionId: connection._id,
    });

    return { success: true };
  },
});

/**
 * Check VIN compatibility with Smartcar
 */
export const checkCompatibility = action({
  args: { vin: v.string() },
  handler: async (ctx, args) => {
    if (args.vin.length !== 17) {
      return { compatible: false, reason: "Invalid VIN" };
    }

    try {
      const scopes = "read_vehicle_info read_odometer read_location read_tires read_engine_oil read_fuel";
      const response = await fetch(
        `${SMARTCAR_API}/compatibility?vin=${args.vin}&scope=${encodeURIComponent(scopes)}&country=US`,
        { headers: { Authorization: basicAuth() } }
      );

      if (!response.ok) {
        return { compatible: false, reason: "VIN not recognized" };
      }

      const data = await response.json();
      const capabilities: string[] = [];
      if (data.capabilities) {
        for (const cap of data.capabilities) {
          if (cap.capable) capabilities.push(cap.permission);
        }
      }

      return {
        compatible: data.compatible === true,
        capabilities: data.compatible ? capabilities : undefined,
        reason: data.compatible ? undefined : data.reason || "Not supported",
      };
    } catch (error) {
      return { compatible: false, reason: "Check failed" };
    }
  },
});

// ============================================
// INTERNAL ACTION — Webhook Data Fetch
// ============================================

/**
 * Called from the webhook handler to fetch fresh data and update DB.
 * This is an internalAction because it makes external API calls.
 */
export const syncVehicleFromWebhook = internalAction({
  args: {
    smartcarVehicleId: v.string(),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the connection
    const connection = await ctx.runQuery(
      internal.smartcar.getConnectionBySmartcarId,
      { smartcarVehicleId: args.smartcarVehicleId }
    );

    if (!connection || connection.status !== "active") {
      console.log(`No active connection for ${args.smartcarVehicleId}`);
      return;
    }

    // Refresh token if needed
    let accessToken = connection.accessToken;
    const now = Date.now();
    const fiveMin = 5 * 60 * 1000;

    if (connection.tokenExpiresAt < now + fiveMin) {
      const newTokens = await refreshToken(connection.refreshToken);
      if (!newTokens) {
        await ctx.runMutation(internal.smartcar.markConnectionExpired, {
          connectionId: connection._id,
        });
        return;
      }
      accessToken = newTokens.access_token;
      await ctx.runMutation(internal.smartcar.updateTokens, {
        connectionId: connection._id,
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token,
        expiresIn: newTokens.expires_in,
      });
    }

    // Fetch vehicle data
    const data = await fetchBatchData(
      accessToken,
      args.smartcarVehicleId
    );

    // Update mileage
    if (data.odometer) {
      await ctx.runMutation(internal.smartcar.updateMileage, {
        vehicleOwnerId: connection.vehicleOwnerId,
        mileage: data.odometer.distance,
      });
      await ctx.runMutation(internal.smartcar.storeHealthSnapshot, {
        vehicleOwnerId: connection.vehicleOwnerId,
        snapshotType: "odometer",
        data: data.odometer,
        source: "smartcar",
      });
    }

    // Store tire pressure
    if (data.tirePressure) {
      await ctx.runMutation(internal.smartcar.storeHealthSnapshot, {
        vehicleOwnerId: connection.vehicleOwnerId,
        snapshotType: "tire_pressure",
        data: data.tirePressure,
        source: "smartcar",
      });
    }

    // Store oil life
    if (data.oilLife) {
      await ctx.runMutation(internal.smartcar.storeHealthSnapshot, {
        vehicleOwnerId: connection.vehicleOwnerId,
        snapshotType: "oil_life",
        data: data.oilLife,
        source: "smartcar",
      });
    }

    // Store fuel
    if (data.fuel) {
      await ctx.runMutation(internal.smartcar.storeHealthSnapshot, {
        vehicleOwnerId: connection.vehicleOwnerId,
        snapshotType: "fuel",
        data: data.fuel,
        source: "smartcar",
      });
    }

    // Mark synced
    await ctx.runMutation(internal.smartcar.markSynced, {
      connectionId: connection._id,
    });
  },
});

// ============================================
// INTERNAL QUERIES
// ============================================

export const getConnectionByOwner = internalQuery({
  args: { vehicleOwnerId: v.id("vehicle_owners") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("smartcar_connections")
      .withIndex("by_vehicle_owner", (q) =>
        q.eq("vehicleOwnerId", args.vehicleOwnerId)
      )
      .first();
  },
});

export const getConnectionBySmartcarId = internalQuery({
  args: { smartcarVehicleId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("smartcar_connections")
      .withIndex("by_smartcar_vehicle_id", (q) =>
        q.eq("smartcarVehicleId", args.smartcarVehicleId)
      )
      .first();
  },
});

// ============================================
// INTERNAL MUTATIONS
// ============================================

/**
 * Create vehicle_owner + vehicle records from Smartcar data.
 * Handles dedup — if a vehicle_owner with this VIN already exists
 * for this user, returns the existing one.
 */
export const createVehicleOwnerFromSmartcar = internalMutation({
  args: {
    userId: v.id("users"),
    vin: v.string(),
    mileage: v.float64(),
    nickname: v.string(),
    engineId: v.optional(v.union(v.id("engines"), v.null())),
    vehicleData: v.object({
      year: v.float64(),
      trimId: v.optional(v.union(v.id("trims"), v.null())),
      engineId: v.optional(v.union(v.id("engines"), v.null())),
      make: v.string(),
      model: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if vehicle_owner already exists for this user + VIN
    const existingOwners = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId))
      .collect();

    const existing = existingOwners.find((vo) => vo.vin === args.vin);
    if (existing) {
      // Update mileage if Smartcar has fresher data
      if (args.mileage > 0 && args.mileage > existing.mileage) {
        await ctx.db.patch(existing._id, { mileage: args.mileage });
      }
      return existing._id;
    }

    // Check if vehicle record exists
    const existingVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", args.vin))
      .collect();

    if (existingVehicles.length === 0 && args.vehicleData.engineId && args.vehicleData.trimId) {
      // Create vehicle record
      await ctx.db.insert("vehicles", {
        vin: args.vin,
        year: args.vehicleData.year,
        trim_id: args.vehicleData.trimId,
        engine_id: args.vehicleData.engineId,
        metadata: { body_style: "", color: "" },
        created_at: now,
        updated_at: now,
      });
    }

    // Create vehicle_owner record
    const vehicleOwnerId = await ctx.db.insert("vehicle_owners", {
      user_id: args.userId,
      vin: args.vin,
      mileage: args.mileage,
      nickname: args.nickname,
      status: "active",
      is_primary: existingOwners.length === 0, // First vehicle = primary
      added_at: now,
    });

    return vehicleOwnerId;
  },
});

/**
 * Store a Smartcar connection (tokens)
 */
export const storeConnection = internalMutation({
  args: {
    vehicleOwnerId: v.id("vehicle_owners"),
    smartcarVehicleId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresIn: v.float64(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + args.expiresIn * 1000;

    // Check for existing connection
    const existing = await ctx.db
      .query("smartcar_connections")
      .withIndex("by_vehicle_owner", (q) =>
        q.eq("vehicleOwnerId", args.vehicleOwnerId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        smartcarVehicleId: args.smartcarVehicleId,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiresAt: expiresAt,
        connectedAt: now,
        status: "active",
      });
      return existing._id;
    }

    return await ctx.db.insert("smartcar_connections", {
      vehicleOwnerId: args.vehicleOwnerId,
      smartcarVehicleId: args.smartcarVehicleId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: expiresAt,
      connectedAt: now,
      status: "active",
    });
  },
});

/**
 * Update tokens after refresh
 */
export const updateTokens = internalMutation({
  args: {
    connectionId: v.id("smartcar_connections"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresIn: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: Date.now() + args.expiresIn * 1000,
    });
  },
});

/**
 * Mark connection as expired
 */
export const markConnectionExpired = internalMutation({
  args: { connectionId: v.id("smartcar_connections") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, { status: "expired" });
  },
});

/**
 * Mark connection as synced
 */
export const markSynced = internalMutation({
  args: { connectionId: v.id("smartcar_connections") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, { lastSyncedAt: Date.now() });
  },
});

/**
 * Delete connection (disconnect)
 */
export const deleteConnection = internalMutation({
  args: { connectionId: v.id("smartcar_connections") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.connectionId);
  },
});

/**
 * Update mileage on vehicle_owners
 */
export const updateMileage = internalMutation({
  args: {
    vehicleOwnerId: v.id("vehicle_owners"),
    mileage: v.float64(),
  },
  handler: async (ctx, args) => {
    const vo = await ctx.db.get(args.vehicleOwnerId);
    if (!vo) return;
    // Only update if new mileage is higher (odometer goes up)
    if (args.mileage > vo.mileage) {
      await ctx.db.patch(args.vehicleOwnerId, { mileage: args.mileage });
    }
  },
});

/**
 * Store a health snapshot
 */
export const storeHealthSnapshot = internalMutation({
  args: {
    vehicleOwnerId: v.id("vehicle_owners"),
    snapshotType: v.string(),
    data: v.any(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("vehicle_health_snapshots", {
      vehicleOwnerId: args.vehicleOwnerId,
      snapshotType: args.snapshotType,
      data: args.data,
      source: args.source,
      recordedAt: now,
      createdAt: now,
    });
  },
});

// ============================================
// SMARTCAR HTTP HELPERS
// ============================================

async function exchangeCode(code: string) {
  const response = await fetch(SMARTCAR_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Token exchange failed:", err);
    throw new Error("Failed to exchange authorization code");
  }

  return response.json();
}

async function refreshToken(token: string) {
  try {
    const response = await fetch(SMARTCAR_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuth(),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token,
      }),
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchVehicleIds(accessToken: string): Promise<string[]> {
  const response = await fetch(`${SMARTCAR_API}/vehicles`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Failed to get vehicles");
  const data = await response.json();
  return data.vehicles || [];
}

async function fetchFromSmartcar(
  accessToken: string,
  vehicleId: string,
  path: string
) {
  const response = await fetch(
    `${SMARTCAR_API}/vehicles/${vehicleId}${path}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) return null;
  return response.json();
}

async function fetchBatchData(accessToken: string, smartcarVehicleId: string) {
  const response = await fetch(
    `${SMARTCAR_API}/vehicles/${smartcarVehicleId}/batch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          { path: "/" },
          { path: "/odometer" },
          { path: "/location" },
          { path: "/tires/pressure" },
          { path: "/engine/oil" },
          { path: "/fuel" },
        ],
      }),
    }
  );

  if (!response.ok) {
    // Fallback to individual requests
    return fetchIndividual(accessToken, smartcarVehicleId);
  }

  const batch = await response.json();
  return {
    info: extract(batch, "/"),
    odometer: formatOdometer(extract(batch, "/odometer")),
    location: extract(batch, "/location"),
    tirePressure: extract(batch, "/tires/pressure"),
    oilLife: extract(batch, "/engine/oil"),
    fuel: extract(batch, "/fuel"),
  };
}

async function fetchIndividual(accessToken: string, vehicleId: string) {
  const get = (path: string) =>
    fetchFromSmartcar(accessToken, vehicleId, path);

  const [info, odo, loc, tires, oil, fuel] = await Promise.allSettled([
    get(""),
    get("/odometer"),
    get("/location"),
    get("/tires/pressure"),
    get("/engine/oil"),
    get("/fuel"),
  ]);

  return {
    info: info.status === "fulfilled" ? info.value : null,
    odometer: formatOdometer(
      odo.status === "fulfilled" ? odo.value : null
    ),
    location: loc.status === "fulfilled" ? loc.value : null,
    tirePressure: tires.status === "fulfilled" ? tires.value : null,
    oilLife: oil.status === "fulfilled" ? oil.value : null,
    fuel: fuel.status === "fulfilled" ? fuel.value : null,
  };
}

function extract(batch: any, path: string) {
  const r = batch.responses?.find((r: any) => r.path === path);
  if (!r || r.code !== 200) return null;
  return r.body;
}

function formatOdometer(data: any) {
  if (!data) return null;
  return {
    distance: data.distance,
    unit: data.meta?.unitSystem === "metric" ? "km" : "mi",
    dataAge: data.meta?.dataAge,
  };
}