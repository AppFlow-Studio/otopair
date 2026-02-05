import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Booking Status History - Append-only audit log
 * 
 * Valid booking transitions:
 * pending → confirmed | cancelled
 * confirmed → in_progress | cancelled | no_show
 * in_progress → completed
 * completed, cancelled, no_show → (terminal)
 */

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

const TERMINAL_STATES = ["completed", "cancelled", "no_show"];

export const getByBookingId = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("booking_status_history")
      .withIndex("by_booking_id", (q) => q.eq("booking_id", args.bookingId))
      .collect();
  },
});

export const getHistory = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    // Get history in chronological order (oldest first)
    const history = await ctx.db
      .query("booking_status_history")
      .withIndex("by_booking_id", (q) => q.eq("booking_id", args.bookingId))
      .collect();
    
    return history.sort((a, b) => a.changed_at - b.changed_at);
  },
});

export const getLatestStatus = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    // Get most recent status transition
    const history = await ctx.db
      .query("booking_status_history")
      .withIndex("by_booking_id", (q) => q.eq("booking_id", args.bookingId))
      .collect();
    
    if (history.length === 0) return null;
    
    // Return most recent (highest timestamp)
    return history.reduce((latest, current) =>
      current.changed_at > latest.changed_at ? current : latest
    );
  },
});

/**
 * Internal mutation: Log booking status change
 * Called by bookings.updateStatus after validation
 */
export const log = internalMutation({
  args: {
    booking_id: v.id("bookings"),
    old_status: v.optional(v.string()),
    new_status: v.string(),
    changed_by: v.optional(v.id("users")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("booking_status_history", {
      booking_id: args.booking_id,
      old_status: args.old_status,
      new_status: args.new_status,
      changed_by: args.changed_by,
      reason: args.reason,
      changed_at: Date.now(),
    });
  },
});

/**
 * Validate booking status transition
 * Returns error message if invalid, null if valid
 */
export function validateTransition(
  currentStatus: string,
  newStatus: string
): string | null {
  if (currentStatus === newStatus) {
    return null; // No change is valid (idempotent)
  }

  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    return `Invalid transition: ${currentStatus} → ${newStatus}`;
  }

  return null; // Valid transition
}

/**
 * Check if status is terminal
 */
export function isTerminal(status: string): boolean {
  return TERMINAL_STATES.includes(status);
}

/**
 * Get all valid next states for current status
 */
export function getValidNextStates(currentStatus: string): string[] {
  return VALID_TRANSITIONS[currentStatus] ?? [];
}

export { VALID_TRANSITIONS, TERMINAL_STATES };
