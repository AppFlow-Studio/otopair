/**
 * Booking Components
 *
 * Components specific to the booking flow and screens.
 * Used in: app/(main-tabs)/bookings/
 */

// Main booking components
export { BookingMap } from "./map";
export { ServiceBottomSheet } from "./ServiceBottomSheet";
export { ShopCarousel } from "./ShopCarousel";
export { ShopMarker } from "./ShopMarker";
export { TopBar, type MechanicFilterOption, type TopBarProps } from "./TopBar";

// Footer components (stage-specific bottom sheet footers)
export {
  BookingDetailsFooter,
  ConfirmationFooter,
  PaymentFooter,
  ServiceSelectionFooter,
  type BookingDetailsFooterProps,
  type ConfirmationFooterProps,
  type PaymentFooterProps,
  type ServiceSelectionFooterProps,
} from "./footers";

// Shared reusable components
export {
  // Rating & Reviews
  RatingBar,
  RatingSummaryCard,
  ReviewCard,
  StarRating,
  type RatingBarProps,
  type RatingDistribution,
  type RatingSummaryCardProps,
  type Review,
  type ReviewCardProps,
  type StarRatingProps,
  // Mechanic
  MechanicInfoCard,
  type MechanicInfoCardProps,
  // Availability
  AvailabilitySlots,
  type AvailabilitySlot,
  type AvailabilitySlotsProps,
  // Services
  ServiceRow,
  type ServiceRowProps,
  // Payment
  CardIcon,
  NoPaymentMethod,
  PaymentMethodCard,
  PayOptionButton,
  type CardIconProps,
  type NoPaymentMethodProps,
  type PaymentMethodCardProps,
  type PayOptionButtonProps,
  // Filter
  FilterDropdown,
  type FilterDropdownOption,
  type FilterDropdownProps,
} from "./shared";

// Re-export types from store for convenience
export type { FilterOption, ServiceCategory, Shop } from "@/stores/types/store.types";
