/**
 * shopServiceCoverage — "does this shop offer everything in the cart?"
 * (bug #404).
 *
 * The server now refuses a booking whose shop has switched a service off
 * (SERVICE_NOT_OFFERED at commit time), but several entry points used to pin
 * a shop without looking at what it offers — Choose Mechanic's pinned shop and
 * earliest-slot CTA, shop detail's Book with a cart already filled, the
 * "Book again" hero card, Quick Book with a pinned shop and the AI chat
 * handoff. They route through here so the customer learns BEFORE checkout,
 * with the service named, instead of at the pay button.
 *
 * `Shop.serviceIds` is built by useShopsFromConvex from the live
 * shop_services list (offered rows only), so it follows portal toggles
 * reactively. A shop that isn't in the store yet is UNKNOWN, not "offers
 * everything": callers treat that as loading (or defer to the next screen's
 * check), never as covered.
 *
 * Pure (no store or React imports) so it stays unit-testable.
 */

type ShopLike = { serviceIds: readonly string[] } | null | undefined;
type ServiceLike = { id: string; name?: string | null; displayLabel?: string | null };

/**
 * Cart ids the shop doesn't offer, in cart order. `null` = the shop isn't
 * hydrated yet, so coverage is unknown (treat as loading).
 */
export function servicesShopDoesntOffer(
  shop: ShopLike,
  serviceIds: readonly string[],
): string[] | null {
  if (!shop) return null;
  const offered = new Set(shop.serviceIds);
  return serviceIds.filter((id) => !offered.has(id));
}

/** Customer-facing names for service ids; unknown ids read "a service". */
export function serviceNamesFor(
  ids: readonly string[],
  catalog: readonly ServiceLike[],
): string[] {
  return ids.map((id) => {
    const svc = catalog.find((s) => s.id === id);
    const name = (svc?.displayLabel || svc?.name || "").trim();
    return name || "a service";
  });
}

/** "A", "A and B", "A, B and C". */
export function joinServiceNames(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Short label for a disabled Book CTA / shop card: "Doesn't offer Brake Fluid
 * Flush". More than two names collapse to a count so it fits one line.
 */
export function doesntOfferLabel(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length <= 2) return `Doesn't offer ${joinServiceNames(names)}`;
  return `Doesn't offer ${names.length} of your services`;
}

/** Toast copy when services are dropped from the cart for a pinned shop. */
export function droppedServicesToast(
  shopName: string | null | undefined,
  names: readonly string[],
): { title: string; body: string } {
  const shop = shopName?.trim() || "This shop";
  const what = joinServiceNames(names);
  return {
    title: `${shop} doesn't offer ${what}`,
    body:
      names.length > 1
        ? "We took them out of your booking."
        : "We took it out of your booking.",
  };
}
