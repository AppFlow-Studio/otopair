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