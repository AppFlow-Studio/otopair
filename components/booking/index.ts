/**
 * Booking Components
 *
 * Components specific to the booking flow and screens.
 * Used in: app/(main-tabs)/bookings/
 */

// Main booking components
export { BookingMap } from "./map";
export { MechanicDetailHeader } from "./MechanicDetailHeader";
export { MechanicDetailTabs, type MechanicDetailTab } from "./MechanicDetailTabs";
export { MechanicServicesSection } from "./MechanicServicesSection";
export { MechanicAvailabilityBreakdown } from "./MechanicAvailabilityBreakdown";
export { MechanicReviewsSection } from "./MechanicReviewsSection";
export { ShopPortfolioSection } from "./ShopPortfolioSection";
export { ShopStaffSection } from "./ShopStaffSection";
export { FullScreenBookingView } from "./FullScreenBookingView";
export { MechanicCarouselCard, type MechanicCarouselCardProps } from "./MechanicCarouselCard";
export { MechanicCarouselSheet, type MechanicCarouselSheetProps } from "./MechanicCarouselSheet";
export { SearchAreaButton } from "./SearchAreaButton";
export { ShopCarouselCard, type ShopCarouselCardProps } from "./ShopCarouselCard";
export { ServiceBottomSheet } from "./ServiceBottomSheet";
export { ShopCarousel } from "./ShopCarousel";
export { ShopMarker } from "./ShopMarker";
export { TopBar, type MechanicFilterOption, type TopBarProps } from "./TopBar";

// Re-export Region type from react-native-maps for convenience
export type { Region } from "react-native-maps";

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

// Page components (shared components for booking flow pages)
export { BookingPageHeader, BookingPageFooter } from "./pages";

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
