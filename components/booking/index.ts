/**
 * Booking Components
 *
 * Components specific to the booking flow and screens.
 * Used in: app/(main-tabs)/bookings/
 */

export { BookingMap } from "./map";
export { ServiceBottomSheet } from "./ServiceBottomSheet";
export { ShopCarousel } from "./ShopCarousel";
export { ShopMarker } from "./ShopMarker";
export { TopBar, type MechanicFilterOption, type TopBarProps } from "./TopBar";

// Re-export types from store for convenience
export type { FilterOption, ServiceCategory, Shop } from "@/stores/types/store.types";
