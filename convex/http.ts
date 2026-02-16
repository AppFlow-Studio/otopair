/**
 * Convex HTTP Router
 * 
 * Exposes webhook endpoints for external services.
 * Supports both v2 (schedule-based) and v3 (signal-based) Smartcar webhooks.
 * 
 * Webhook URL to register in Smartcar dashboard:
 *   https://<your-deployment>.convex.site/smartcar/webhook
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// ============================================
// Smartcar Webhook Endpoint
// ============================================

http.route({
  path: "/smartcar/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Read the raw body text FIRST (needed for signature verification)
      const rawBody = await request.text();
      const body = JSON.parse(rawBody);
      const signature = request.headers.get("sc-signature");

      // ── Detect event type early (VERIFY skips signature check) ──
      const eventType = body.eventType || body.type;
      // v4 puts vehicleId at data.vehicle.id, v2 at body.vehicleId
      const vehicleId = body.vehicleId || body.data?.vehicle?.id;

      // ── Verify webhook signature (skip for VERIFY events) ──
      const managementToken = process.env.SMARTCAR_MANAGEMENT_TOKEN;
      if (eventType !== "VERIFY" && managementToken && signature) {
        const isValid = await verifySignature(rawBody, signature, managementToken);
        if (!isValid) {
          console.error("[Webhook] Invalid signature — rejecting request");
          return new Response(
            JSON.stringify({ error: "Invalid signature" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      console.log(`[Webhook] Received: eventType=${eventType || "unknown"}, vehicleId=${vehicleId || "N/A"}, eventId=${body.eventId || "N/A"}, version=${body.meta?.version || "?"}, signalCount=${body.data?.signals?.length ?? 0}`);

      // ── Handle VERIFY event (v3 webhooks) ──
      if (eventType === "VERIFY") {
        const challenge = body.data?.challenge;
        if (!challenge) {
          return new Response(
            JSON.stringify({ error: "Missing challenge" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        // Hash the challenge with the management token
        if (!managementToken) {
          console.error("[Webhook] SMARTCAR_MANAGEMENT_TOKEN not set — cannot verify");
          return new Response(
            JSON.stringify({ error: "Server not configured for verification" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
        const hashedChallenge = await hashChallenge(managementToken, challenge);
        console.log("[Webhook] VERIFY challenge responded");
        return new Response(
          JSON.stringify({ challenge: hashedChallenge }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // ── Handle VEHICLE_STATE event (v3 signals webhook) ──
      if (eventType === "VEHICLE_STATE" && body.data?.signals) {
        if (!vehicleId) {
          console.error("[Webhook] VEHICLE_STATE missing vehicleId");
          return new Response(
            JSON.stringify({ error: "Missing vehicleId" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Extract signals from the payload
        const signals = body.data.signals as WebhookSignal[];
        const signalCodes = signals.map((s) => `${s.code}${s.status?.error ? "(ERR)" : ""}`).join(", ");
        console.log(`[Webhook] VEHICLE_STATE: ${signals.length} signals for vehicle=${vehicleId}: [${signalCodes}]`);

        // Dispatch to internal action for processing signals directly
        await ctx.runAction(internal.smartcar.processWebhookSignals, {
          smartcarVehicleId: vehicleId,
          signals: signals.map((s) => ({
            code: s.code,
            name: s.name,
            group: s.group,
            body: s.body || null,
            hasError: !!s.status?.error,
          })),
          eventId: body.eventId || "",
        });

        return new Response(
          JSON.stringify({ received: true }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // ── Handle VEHICLE_ERROR event (v3) ──
      if (eventType === "VEHICLE_ERROR") {
        console.log(`[Webhook] VEHICLE_ERROR for vehicle=${vehicleId}:`, JSON.stringify(body.data)?.slice(0, 300));
        return new Response(
          JSON.stringify({ received: true }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // ── Handle v2 schedule-based webhooks (legacy) ──
      if (vehicleId) {
        await ctx.runAction(internal.smartcar.syncVehicleFromWebhook, {
          smartcarVehicleId: vehicleId,
          eventType: eventType || "unknown",
        });

        console.log(`[Webhook] Dispatched v2 sync for vehicleId=${vehicleId}`);
      } else {
        console.error("[Webhook] Missing vehicleId in payload");
      }

      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      // Always return 200 on internal errors to prevent Smartcar from retrying
      console.error("[Webhook] Error processing webhook:", error);
      return new Response(
        JSON.stringify({ received: true, warning: "Processing error logged" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// ============================================
// Types
// ============================================

interface WebhookSignal {
  code: string;
  name: string;
  group: string;
  body?: any;
  status?: { error?: { code: string; type: string }; value?: string };
  meta?: { oemUpdatedAt?: number; fetchedAt?: number };
}

// ============================================
// Smartcar Webhook Signature Verification
// ============================================

async function verifySignature(
  rawBody: string,
  signature: string,
  managementToken: string
): Promise<boolean> {
  if (!signature || !managementToken) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(managementToken),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const expected = Array.from(new Uint8Array(signed))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return expected === signature;
  } catch (err) {
    console.error("[Webhook] Signature verification error:", err);
    return false;
  }
}

// ============================================
// VERIFY Challenge Hash
// ============================================

async function hashChallenge(
  managementToken: string,
  challenge: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(managementToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(challenge));
  return Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default http;
