/**
 * Drop cart services a pinned shop doesn't offer, right before routing into
 * that shop's booking steps (bug #404). Used by the entry points that pin a
 * shop without passing through Choose Mechanic's coverage check: shop detail
 * Book with a filled cart, Quick Book with a pinned shop, "Book again" and the
 * AI chat handoff. The caller shows `droppedServicesToast` when `droppedNames`
 * is non-empty.
 *
 * Reads the stores at call time (event handlers, not render), so it sees the
 * latest shop_services hydration.
 */

import { servicesShopDoesntOffer, serviceNamesFor } from "@/lib/shopServiceCoverage";
import { useBookingStore } from "@/stores/useBookingStore";
import { useShopStore } from "@/stores/useShopStore";

export type PinnedShopCartResult =
  /** Shop not hydrated yet — coverage unknown, cart left alone. The next
   *  screen (pick-datetime / Review & Pay) re-checks once it lands. */
  | { status: "unknown" }
  | {
      status: "checked";
      shopName: string;
      droppedIds: string[];
      droppedNames: string[];
      remainingCount: number;
    };

export function dropServicesShopDoesntOffer(shopId: string): PinnedShopCartResult {
  const shop = useShopStore.getState().shops[shopId];
  const booking = useBookingStore.getState();
  const missing = servicesShopDoesntOffer(shop, booking.selectedServiceIds);
  if (!shop || missing === null) return { status: "unknown" };
  const droppedNames = serviceNamesFor(missing, booking.availableServices);
  // toggleServiceSelection removes a selected id and keeps the per-service
  // vehicle map + basket VIN consistent, same as the customer unticking it.
  for (const id of missing) booking.toggleServiceSelection(id);
  return {
    status: "checked",
    shopName: shop.name,
    droppedIds: missing,
    droppedNames,
    remainingCount: useBookingStore.getState().selectedServiceIds.length,
  };
}
