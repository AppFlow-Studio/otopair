/**
 * serviceVariants
 *
 * PURPOSE: Translate the customer's `selectedServiceOptions` pick (a row from
 *          the Convex `service_options` table) into the `position` value the
 *          Convex parts resolver expects ("front" | "rear" | "both").
 *
 *          Single source of truth — the same option-picker flow that drives
 *          labor_hours / parts_cost_avg also drives the axle choice. No
 *          parallel chip UI, no slug-keyed registry.
 */

/** Position value sent to Convex `part_fitments.position` filter. "both" tells
 *  the server to resolve front AND rear and return them as two lines. */
export type AxleChoice = "front" | "rear" | "both";

/** A snapshot of a selected service option as stored in
 *  `useBookingStore.selectedServiceOptions`. */
interface SelectedOptionLike {
  option_label?: string;
  option_type?: string;
}

/** Derive the axle/position the customer picked. Returns null for
 *  non-positional options (e.g. tire-set choices) so callers can treat them
 *  as "no position filter, behave as before." */
export function positionFromOption(
  option: SelectedOptionLike | null | undefined,
): AxleChoice | null {
  if (!option || option.option_type !== "position") return null;
  const label = option.option_label?.trim().toLowerCase();
  if (!label) return null;
  if (label === "front") return "front";
  if (label === "rear") return "rear";
  if (label === "front and rear" || label === "all four" || label === "both") {
    return "both";
  }
  return null;
}
