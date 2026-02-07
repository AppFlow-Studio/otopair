/**
 * Convex HTTP Router
 * 
 * Exposes webhook endpoints for external services.
 * Smartcar sends POST events when scheduled data syncs complete.
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
      // ── Verify webhook signature ──
      // Smartcar signs webhooks with HMAC-SHA256
      // Header: sc-signature = <timestamp>.<signature>
      const signature = request.headers.get("sc-signature");
      
      // In production, verify the signature:
      // const webhookSecret = process.env.SMARTCAR_WEBHOOK_SECRET;
      // if (!verifySignature(signature, body, webhookSecret)) {
      //   return new Response("Invalid signature", { status: 401 });
      // }

      const body = await request.json();

      // Smartcar webhook payload structure:
      // {
      //   "eventId": "unique-event-id",
      //   "type": "schedule",
      //   "vehicleId": "smartcar-vehicle-id",
      //   "timestamp": "2026-01-30T12:00:00Z",
      //   "data": { ... }
      // }

      const { vehicleId, type: eventType } = body;

      if (!vehicleId) {
        return new Response(
          JSON.stringify({ error: "Missing vehicleId" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Dispatch to internal action for processing
      // This runs async — webhook returns immediately
      await ctx.runAction(internal.smartcar.syncVehicleFromWebhook, {
        smartcarVehicleId: vehicleId,
        eventType: eventType || "unknown",
      });

      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response(
        JSON.stringify({ error: "Internal error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// ============================================
// Smartcar Webhook Verification (optional)
// ============================================
// 
// To verify in production, set SMARTCAR_WEBHOOK_SECRET
// in Convex env vars and uncomment the verify logic above.
//
// async function verifySignature(
//   header: string | null,
//   body: any,
//   secret: string
// ): Promise<boolean> {
//   if (!header || !secret) return false;
//   const [timestamp, signature] = header.split(".");
//   const payload = `${timestamp}.${JSON.stringify(body)}`;
//   const encoder = new TextEncoder();
//   const key = await crypto.subtle.importKey(
//     "raw",
//     encoder.encode(secret),
//     { name: "HMAC", hash: "SHA-256" },
//     false,
//     ["sign"]
//   );
//   const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
//   const expected = Array.from(new Uint8Array(signed))
//     .map((b) => b.toString(16).padStart(2, "0"))
//     .join("");
//   return expected === signature;
// }

export default http;