/**
 * notificationLabels — customer-facing titles for notification_outbox rows.
 *
 * Many writer sites never set `payload.title` (the title-less categories called
 * out in the notifications gap review), so every card rendered the generic
 * "Update". When a row carries a real title we use it; otherwise we derive a
 * human label from the `category` key.
 */

const CUSTOMER_CATEGORY_TITLES: Record<string, string> = {
  booking_reschedule_proposed: "Reschedule proposed",
  booking_forced_delay_proposed: "Schedule delay proposed",
  booking_reschedule_withdrawn: "Reschedule withdrawn",
  booking_reschedule_auto_reverted: "Reschedule offer expired",
  schedule_courtesy_update: "Schedule update",
  appointment_reminder: "Appointment reminder",
  overrun_customer_resolution: "Service running long",
  new_booking: "Booking received",
};

function titleCase(category: string): string {
  return category
    .split("_")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Resolve the display title for a notification. Prefers an explicit
 * `payload.title`, then a mapped category label, then a title-cased category.
 */
export function notificationTitle(category: string, payload: any): string {
  const explicit = payload?.title;
  if (typeof explicit === "string" && explicit.trim().length > 0) {
    return explicit.trim();
  }
  if (category.startsWith("customer_late")) return "Are you on your way?";
  return CUSTOMER_CATEGORY_TITLES[category] ?? titleCase(category);
}
