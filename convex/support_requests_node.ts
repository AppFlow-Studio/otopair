/**
 * support_requests_node.ts — customer-initiated "report an issue" email.
 *
 * Triggered from the Past Service detail screen's "Report an issue"
 * action. Gathers the booking snapshot + customer email, then sends a
 * support inbox email via Resend (`email/send.ts → sendSupportRequestEmail`).
 *
 * Node-only because Resend requires the Node runtime. The mobile UI
 * calls `submitSupportRequest` directly; no notification_outbox queue
 * here — disputes are one-off, low-volume, and should land in support
 * immediately rather than be polled by the dispatcher cron.
 *
 * Auth: customer must own the booking they're reporting on.
 */
"use node";

import { v, ConvexError } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { sendSupportRequestEmail } from "../email/send";

const ALLOWED_REASONS: Record<string, string> = {
  service_quality: "Service quality",
  billing_issue: "Billing / pricing issue",
  mechanic_conduct: "Mechanic conduct",
  work_not_done: "Work not completed as agreed",
  scheduling_no_show: "Scheduling / no-show",
  other: "Other",
};

export const submitSupportRequest = action({
  args: {
    bookingId: v.id("bookings"),
    reasonKey: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; error: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Your session has expired. Please sign in again.");
    }
    if (!ALLOWED_REASONS[args.reasonKey]) {
      throw new ConvexError("Please choose a valid reason.");
    }
    const trimmedMessage = args.message.trim();
    if (trimmedMessage.length === 0) {
      throw new ConvexError("Add a short description before submitting.");
    }
    if (trimmedMessage.length > 4000) {
      throw new ConvexError("Description is too long (max 4000 characters).");
    }

    // `(internal as any)` mirrors the pattern in invoices_node.ts —
    // the generated `internal.support_requests` type only exists
    // after `npx convex codegen` has seen this file. Once codegen
    // runs the cast becomes unnecessary; the runtime path is the
    // same either way.
    const snapshot: {
      booking: {
        id: string;
        orderNumber: string;
        shopName: string;
        mechanicName?: string;
        date?: string;
        time?: string;
        vehicle?: string;
        totalDollars?: number;
      };
      customer: { email: string; name?: string; clerkUserId: string };
    } | null = await ctx.runQuery(
      (internal as any).support_requests.getDisputeContext,
      { bookingId: args.bookingId, clerkUserId: identity.subject },
    );

    if (!snapshot) {
      throw new ConvexError(
        "We couldn't find this booking on your account.",
      );
    }

    const result = await sendSupportRequestEmail({
      reasonKey: args.reasonKey,
      reasonLabel: ALLOWED_REASONS[args.reasonKey],
      message: trimmedMessage,
      customerEmail: snapshot.customer.email,
      customerName: snapshot.customer.name,
      booking: snapshot.booking,
    });

    if (!result.success) {
      // Hide the underlying Resend error from the client — surface a
      // generic message and rely on `console.error` in send.ts for ops.
      return { ok: false, error: "We couldn't send your report. Please try again." };
    }
    return { ok: true };
  },
});
