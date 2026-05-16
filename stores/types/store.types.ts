/**
 * ============================================================
 * SHARED STORE TYPES
 * ============================================================
 *
 * Shared type definitions used across multiple stores.
 * Keep entity schemas in sync with backend database tables.
 */

// ─────────────────────────────────────────────────────────────
// BOOKING TYPES
// ─────────────────────────────────────────────────────────────

/** Filter options for shop discovery */
export type FilterOption = "available_now" | "top_rated" | "specialists";

/** Service category options for filtering shops */
export type ServiceCategory = "basic_maintenance" | "tires_wheels" | "brakes_suspension" | "system_diagnostics";

/** A service offered by shops */
export interface Service {
  /** Unique identifier */
  id: string;
  /** Service display name (e.g., "Oil Change") */
  name: string;
  /** Brief description of the service */
  description: string;
  /** Price in dollars (fallback when labor_rate not available) */
  price: number;
  /** Category this service belongs to */
  category: ServiceCategory;
  /** Default labor hours (for price = labor_rate × time + parts) */
  default_labor_hours?: number;
  /** Default parts estimate in dollars (for price formula) */
  default_parts_estimate?: number;
  /** Whether this service has user-selectable options (e.g. axle position, quantity) */
  has_options?: boolean;
}

/** A selected service option with pricing details */
export interface ServiceOptionSelection {
  optionId: string;
  labor_hours: number;
  parts_cost_avg: number;
  state_fee?: number;
  /** Snapshot of the human-readable option label (e.g. "Front and rear",
   *  "All 4 tires + balance") so the booking record carries it forward to
   *  the mechanic's schedule card without an extra lookup. */
  option_label?: string;
  /** Snapshot of the option_type (e.g. "position", "tire_set"). */
  option_type?: string;
}

/** User's current location for map and shop discovery */
export interface UserLocation {
  /** Display label (e.g., "San Francisco, CA") */
  label: string;
  /** Latitude coordinate */
  latitude: number;
  /** Longitude coordinate */
  longitude: number;
  /** City name */
  city: string;
  /** State/region */
  state: string;
}

/** Booking status options */
export type BookingStatus =
  | "pending"
  | "pending_quote"
  | "quotes_ready"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

/** Booking flow stages */
export type BookingStage =
  | "discovery"
  | "service_selection"
  | "service_options"
  | "mechanic_selection"
  | "booking_details"
  | "payment"
  | "confirmation";

/** Booking type - immediate or scheduled */
export type BookingType = "book_now" | "schedule_later";

/** A mechanic who works at a shop */
export interface Mechanic {
  /** Unique identifier (Convex _id as string) */
  id: string;
  /** Shop this mechanic works at */
  shopId: string;
  /** Mechanic's display name */
  name: string;
  /** Optional job title (e.g. "Master Mechanic"); when empty, UI shows shopName under name */
  title?: string;
  /** Shop/business name */
  shopName: string;
  /** Profile photo URL */
  photoUrl: string | null;
  /** Average rating (0-5) from Convex reviews */
  rating: number;
  /** Number of reviews (from Convex) for display */
  reviewCount?: number;
  /** Whether the mechanic is verified */
  isVerified: boolean;
  /** Distance in miles from user */
  distanceMi: number;
  /** Services offered (display names) */
  services: string[];
  /** Service IDs this mechanic specializes in */
  specialties: string[];
  /** Years of experience */
  yearsExperience: number;
  /** Whether currently available */
  isAvailable: boolean;
  /** Response time category */
  responseTime: "Quick" | "Normal" | "Slow";
  /** Availability score (0-10) */
  availability: number;
  /** Next available time slots */
  nextAvailability: MechanicAvailabilitySlot[];
}

/** A single availability slot for a mechanic */
export interface MechanicAvailabilitySlot {
  /** Day of week abbreviation (e.g., "Wed") */
  dayOfWeek: string;
  /** Day of month (e.g., "10") */
  day: string;
  /** Time string (e.g., "9:00 AM") */
  time: string;
}

/** Mechanic filter options */
export interface MechanicFilters {
  /** Filter type */
  filterType: "available_now" | "distance" | "rating";
  /** Search query for name/shop */
  searchQuery: string;
}

/** A booking/appointment entity */
export interface Booking {
  id: string;
  userId: string;
  shopId: string;
  vehicleId: string;
  serviceIds: string[];
  status: BookingStatus;
  scheduledDate: string;
  scheduledTime: string;
  estimatedDuration: number; // in minutes
  totalPrice: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** A shop/mechanic business entity */
export interface Shop {
  /** Unique identifier (Convex _id as string) */
  id: string;
  /** Shop display name */
  name: string;

  // ─── Location ───
  /** Street address (or full address line) */
  address: string;
  /** Shop phone for Contact / tel: link */
  phone?: string;
  /** Latitude coordinate */
  latitude: number;
  /** Longitude coordinate */
  longitude: number;
  /** Distance in km (calculated client-side) */
  distanceKm: number | null;

  // ─── Details ───
  /** Average rating (0-5) from Convex reviews */
  rating: number | null;
  /** Number of reviews (from Convex) for display */
  reviewCount?: number;
  /** Shop image URL */
  imageUrl: string | null;

  // ─── Availability ───
  /** Availability score (0-10) for UI gradient: 0=closed, 1-3=low, 4-6=medium, 7-10=high */
  availability: number;
  /** Whether the shop has available appointment slots */
  hasAvailableSlots: boolean;
  /** Next available time slot (ISO datetime) */
  nextAvailableSlot: string | null;

  // ─── Services ───
  /** Service IDs offered by this shop */
  serviceIds: string[];

  // ─── Pricing ───
  /** Hourly labor rate in dollars (for price calculation) */
  labor_rate?: number;
}

/** Shop filter options */
export interface ShopFilters {
  /** Maximum distance in km */
  maxDistance: number;
  /** Minimum rating (0-5) */
  minRating: number;
  /** Show only shops with available slots */
  availableOnly: boolean;
  /** Filter by specific service IDs */
  serviceIds: string[];
}

// ─────────────────────────────────────────────────────────────
// SCHEDULE / AVAILABILITY TYPES
// ─────────────────────────────────────────────────────────────

/** Status of a calendar day */
export type DayAvailabilityStatus = "available" | "booked" | "unavailable";

/** A single day's availability with time slots */
export interface DayAvailability {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Day of month (1-31) */
  day: number;
  /** Month (0-11, JavaScript Date format) */
  month: number;
  /** Year (e.g., 2025) */
  year: number;
  /** Day of week (0=Sunday, 6=Saturday) */
  dayOfWeek: number;
  /** Overall status for this day */
  status: DayAvailabilityStatus;
  /** Available time slots for this day */
  timeSlots: string[];
}

/** Monthly availability calendar for a mechanic */
export interface MonthlyAvailability {
  /** Mechanic ID this schedule belongs to */
  mechanicId: number;
  /** Month (0-11, JavaScript Date format) */
  month: number;
  /** Year (e.g., 2025) */
  year: number;
  /** Array of days with availability info */
  days: DayAvailability[];
}

/** Full schedule for a mechanic */
export interface MechanicSchedule {
  /** Mechanic ID */
  mechanicId: number;
  /** Map of "YYYY-MM" to monthly availability */
  monthlySchedules: Record<string, MonthlyAvailability>;
}

// ─────────────────────────────────────────────────────────────
// PAYMENT TYPES
// ─────────────────────────────────────────────────────────────

/** Supported payment card brands */
export type PaymentCardBrand = "mastercard" | "visa" | "amex" | "discover" | "generic";

/** Supported digital wallet types */
export type DigitalWalletType = "apple_pay" | "google_pay";

/** Supported local card art variants for UI */
export type PaymentCardImageKey = "mono_1" | "mono_2";

/** A saved payment method (credit/debit card) */
export interface PaymentMethod {
  /** Unique identifier */
  id: string;
  /** Card brand */
  brand: PaymentCardBrand;
  /** Last 4 digits of card number */
  last4: string;
  /** Expiration month (1-12) */
  expMonth: number;
  /** Expiration year (e.g., 2025) */
  expYear: number;
  /** Whether this is the default payment method */
  isDefault: boolean;
  /** Cardholder name (optional) */
  cardholderName?: string;
  /** Billing zip code (optional) */
  zipCode?: string;
  /** Card art to use for this card in the UI */
  imageKey?: PaymentCardImageKey;
  /** Date when payment method was added */
  createdAt: string;
}

/** A transaction/recent activity item */
export interface Transaction {
  /** Unique identifier */
  id: string;
  /** Card ID this transaction belongs to */
  paymentMethodId: string;
  /** Transaction title (e.g., "Oil Change") */
  title: string;
  /** Shop/Business name */
  shopName: string;
  /** Amount spent (formatted string, e.g., "$129.00") */
  amount: string;
  /** Date of transaction (e.g., "April 24") */
  date: string;
  /** Icon name from Lucide (e.g., "droplet") */
  iconName: string;
  /** Icon color (e.g., "#FACC15") */
  iconColor: string;
}

/** Scheduled appointment date/time for a booking */
export interface ScheduledAppointment {
  /** Selected date (ISO string format YYYY-MM-DD) */
  date: string;
  /** Selected time slot (e.g., "9:00 AM") */
  time: string;
  /** Display-formatted date (e.g., "20 Aug. 2025") */
  displayDate: string;
}
