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
