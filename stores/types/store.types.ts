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
  /** Price in dollars */
  price: number;
  /** Category this service belongs to */
  category: ServiceCategory;
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
export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

/** Booking flow stages */
export type BookingStage = "discovery" | "service_selection" | "mechanic_selection" | "payment" | "confirmation";

/** A mechanic who works at a shop */
export interface Mechanic {
  /** Unique identifier */
  id: number;
  /** Shop this mechanic works at */
  shopId: number;
  /** Mechanic's display name */
  name: string;
  /** Shop/business name */
  shopName: string;
  /** Profile photo URL */
  photoUrl: string | null;
  /** Average rating (0-5) */
  rating: number;
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
  /** Unique identifier (auto-incrementing) */
  id: number;
  /** Shop display name */
  name: string;

  // ─── Location ───
  /** Street address */
  address: string;
  /** Latitude coordinate */
  latitude: number;
  /** Longitude coordinate */
  longitude: number;
  /** Distance in km (calculated client-side) */
  distanceKm: number | null;

  // ─── Details ───
  /** Average rating (0-5) */
  rating: number | null;
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
