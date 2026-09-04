/**
 * buildMechanicCarouselItems — pure util that maps the shop's
 * mechanic availability (from `useNextAvailabilityPerMechanicForShop`)
 * plus the local mechanic-store entries into `MechanicCarouselItem[]`
 * with an "Any" sentinel at index 0.
 *
 * Lifted out of `components/booking-flow/ShopPage.tsx` so the same
 * carousel can ship on `pick-datetime` when the user already picked
 * the shop on shop-detail and we skip Choose Mechanic. Single source
 * of truth for the carousel shape.
 */

import type { MechanicCarouselItem } from "@/components/booking-flow/MechanicCarousel";
import type {
  Mechanic,
  MechanicAvailabilitySlot,
} from "@/stores/types/store.types";

const WEEKDAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatMechanicAvailabilityLabel(
  slot: Pick<MechanicAvailabilitySlot, "dayOfWeek" | "time" | "scheduledDate">,
  today: Date = new Date(),
): string {
  if (!slot.scheduledDate) return `${slot.dayOfWeek} ${slot.time}`;

  const [year, month, day] = slot.scheduledDate.split("-").map(Number);
  if (!year || !month || !day) return `${slot.dayOfWeek} ${slot.time}`;

  const slotDay = Date.UTC(year, month - 1, day);
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if ((slotDay - todayDay) / 86_400_000 < 7) {
    return `${slot.dayOfWeek} ${slot.time}`;
  }

  return `${WEEKDAY_ABBREVIATIONS[new Date(slotDay).getUTCDay()]}, ${MONTH_ABBREVIATIONS[month - 1]} ${day}\n${slot.time}`;
}

export interface BuildMechanicCarouselItemsArgs {
  /** From `useNextAvailabilityPerMechanicForShop(shopId).slotsByMechanicId`.
   *  Keys are mechanic IDs; values are sorted upcoming slots. */
  slotsByMechanicId: Record<string, readonly MechanicAvailabilitySlot[]>;
  /** From `useMechanicStore(s => s.mechanics)`. Used to hydrate name +
   *  photoUrl + verified badge. */
  mechanicsMap: Record<string, Mechanic>;
  /** True when the shop has any availability at all. Drives the "Any"
   *  card's subtitle ("Earliest" vs "Availability TBD"). Pass
   *  `useNextAvailabilityForShop(shopId, null, 1).slots.length > 0`. */
  shopHasAnySlot: boolean;
}

export function buildMechanicCarouselItems({
  slotsByMechanicId,
  mechanicsMap,
  shopHasAnySlot,
}: BuildMechanicCarouselItemsArgs): MechanicCarouselItem[] {
  const items: MechanicCarouselItem[] = [
    {
      mechanicId: null,
      name: "Any",
      photoUrl: null,
      slotLabel: shopHasAnySlot ? "Earliest" : "Availability TBD",
    },
  ];

  for (const mechId of Object.keys(slotsByMechanicId)) {
    const mech = mechanicsMap[mechId];
    if (!mech) continue;
    const earliest = slotsByMechanicId[mechId]?.[0];
    const slotLabel = earliest ? formatMechanicAvailabilityLabel(earliest) : "TBD";
    items.push({
      mechanicId: mechId,
      name: mech.name,
      photoUrl: mech.photoUrl,
      slotLabel,
      verified: mech.isVerified,
    });
  }

  return items;
}
