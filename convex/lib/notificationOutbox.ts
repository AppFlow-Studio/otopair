/**
 * notificationOutbox.ts — the single enqueue path into `notification_outbox`.
 *
 * Lives in lib/ (rather than convex/bookings.ts, which re-exports it) so
 * convex/inspectionHealthDeferred.ts can enqueue the deferred health-score push
 * without a circular import back into bookings.ts. Same reasoning as
 * hydrateTieredInspectionState — see the note at convex/bookings.ts.
 */

import { internal } from "../_generated/api";

/**
 * Channel → its dispatcher action. Enqueue kicks the matching dispatcher via
 * `scheduler.runAfter` so delivery no longer waits up to a minute for the
 * polling cron. The 1-min `dispatch-pending-*` crons remain as a backstop.
 *
 * `front_desk` rows are read reactively by the shop UI (no dispatcher). `slack`
 * rows are written through a separate path and drained by their own cron — ops
 * alerts don't need instant delivery.
 */
const CHANNEL_DISPATCHER: Record<string, any> = {
  push: internal.lib.push_dispatcher.dispatchPendingPush,
  sms: (internal as any).sms_dispatcher.dispatchPendingSms,
  email: (internal as any).email_dispatcher.dispatchPendingEmails,
};

export async function enqueueNotificationOutbox(
  ctx: any,
  {
    shopId,
    bookingId,
    userId,
    mechanicId,
    channel,
    category,
    dedupeKey,
    payload,
    scheduledForMs,
  }: {
    shopId?: any;
    bookingId?: any;
    userId?: any;
    mechanicId?: any;
    channel: "push" | "sms" | "front_desk" | "email";
    category: string;
    dedupeKey: string;
    payload: any;
    scheduledForMs?: number;
  },
) {
  // Dedupe against any still-OPEN row for this key — one that hasn't been
  // resolved yet (resolved_at == null), regardless of delivery status. This
  // stops a repeat event from stacking a second in-app card (or re-pushing)
  // while the first is still live. Dedupe keys are event-specific (booking +
  // category + timestamp/date), so the only collisions are idempotent
  // re-fires. `failed` rows are excluded so a genuine retry can produce a new
  // row. Once a row is resolved, a fresh event with the same key opens a new
  // one.
  const priorRows = await ctx.db
    .query("notification_outbox")
    .withIndex("by_dedupe_key", (q: any) => q.eq("dedupe_key", dedupeKey))
    .collect();
  const openExisting = priorRows.find(
    (r: any) => r.resolved_at == null && r.status !== "failed",
  );
  if (openExisting) {
    // Deduped to a row that's already pending/claimable — no new kick needed.
    return openExisting._id;
  }

  const now = Date.now();
  const insertedId = await ctx.db.insert("notification_outbox", {
    shop_id: shopId,
    booking_id: bookingId,
    user_id: userId,
    mechanic_id: mechanicId,
    channel,
    category,
    status: "pending",
    dedupe_key: dedupeKey,
    payload,
    scheduled_for_ms: scheduledForMs,
    created_at: now,
    updated_at: now,
  });

  // Instant dispatch: kick the matching channel's dispatcher so this row goes
  // out now instead of on the next 1-min cron tick. A future-dated
  // scheduled_for_ms schedules the kick for that time (and the claim mutations
  // skip rows not yet due). We dedupe kicks per (channel[, time]) within a
  // single mutation via a ctx-scoped Set, so a bulk enqueue (e.g. a cron
  // cancelling many bookings at once) fires one kick per channel, not N — the
  // first dispatcher run drains every pending row anyway.
  const ref = CHANNEL_DISPATCHER[channel];
  if (ref && ctx.scheduler?.runAfter) {
    const delay =
      scheduledForMs && scheduledForMs > now ? scheduledForMs - now : 0;
    const kickKey = delay === 0 ? channel : `${channel}:${scheduledForMs}`;
    ctx._kickedChannels ??= new Set<string>();
    if (!ctx._kickedChannels.has(kickKey)) {
      ctx._kickedChannels.add(kickKey);
      await ctx.scheduler.runAfter(delay, ref, {});
    }
  }

  return insertedId;
}
