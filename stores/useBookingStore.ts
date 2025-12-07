/**
 * useBookingStore
 *
 * PURPOSE: Manages booking data, location, filters, and map state for shop discovery
 *
 * TABLES: Bookings (future integration)
 *
 * RELATIONSHIPS:
 *   - Booking belongs to User
 *   - Booking belongs to Vehicle (via vehicleId)
 *   - Booking belongs to Shop (via shopId)
 *   - Booking has many Services (via serviceIds)
 *
 * OWNER: Dev 3
 */

import { create } from "zustand";
import type { Booking, FilterOption, ServiceCategory, UserLocation } from "./types/store.types";

// ─────────────────────────────────────────────────────────────
// STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────

interface BookingState {
  // ═══════════════ LOCATION STATE ═══════════════
  /** User's current location for map display */
  userLocation: UserLocation | null;
  /** Whether location is being fetched */
  isLoadingLocation: boolean;

  // ═══════════════ FILTER STATE ═══════════════
  /** Selected filter option (Available Now, Top Rated, Specialists) */
  selectedFilter: FilterOption | null;
  /** Selected service category for filtering shops */
  selectedService: ServiceCategory;

  // ═══════════════ MAP STATE ═══════════════
  /** Map region for visible area */
  mapRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null;

  // ═══════════════ BOOKING STATE ═══════════════
  /** All bookings indexed by ID */
  bookings: Record<string, Booking>;
  /** Ordered list of booking IDs */
  bookingIds: string[];
  /** Draft booking being created */
  draftBooking: Partial<Booking> | null;
  /** Loading state for booking operations */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;

  // ═══════════════ LOCATION ACTIONS ═══════════════
  /** Set user's current location */
  setUserLocation: (location: UserLocation) => void;
  /** Clear user's location */
  clearUserLocation: () => void;
  /** Set location loading state */
  setLocationLoading: (loading: boolean) => void;

  // ═══════════════ FILTER ACTIONS ═══════════════
  /** Set the selected filter option */
  setSelectedFilter: (filter: FilterOption | null) => void;
  /** Set the selected service category */
  setSelectedService: (service: ServiceCategory) => void;
  /** Clear all filters */
  clearFilters: () => void;

  // ═══════════════ MAP ACTIONS ═══════════════
  /** Update map region */
  setMapRegion: (region: BookingState["mapRegion"]) => void;

  // ═══════════════ BOOKING ACTIONS ═══════════════
  /** Set draft booking */
  setDraftBooking: (draft: Partial<Booking> | null) => void;
  /** Clear all booking state */
  clearBookingState: () => void;

  // ═══════════════ GETTERS ═══════════════
  /** Get location display label */
  getLocationLabel: () => string;
  /** Check if filters are active */
  hasActiveFilters: () => boolean;
}

// ─────────────────────────────────────────────────────────────
// DEFAULT VALUES
// ─────────────────────────────────────────────────────────────

const DEFAULT_LOCATION: UserLocation = {
  label: "San Francisco, CA",
  latitude: 37.7749,
  longitude: -122.4194,
  city: "San Francisco",
  state: "CA",
};

const DEFAULT_SERVICE: ServiceCategory = "basic_maintenance";

// ─────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────

export const useBookingStore = create<BookingState>()((set, get) => ({
  // ═══════════════ INITIAL STATE ═══════════════
  userLocation: DEFAULT_LOCATION,
  isLoadingLocation: false,
  selectedFilter: null,
  selectedService: DEFAULT_SERVICE,
  mapRegion: null,
  bookings: {},
  bookingIds: [],
  draftBooking: null,
  isLoading: false,
  error: null,

  // ═══════════════ LOCATION ACTIONS ═══════════════
  setUserLocation: (location) =>
    set({
      userLocation: location,
      mapRegion: {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      },
    }),

  clearUserLocation: () =>
    set({
      userLocation: null,
      mapRegion: null,
    }),

  setLocationLoading: (loading) =>
    set({
      isLoadingLocation: loading,
    }),

  // ═══════════════ FILTER ACTIONS ═══════════════
  setSelectedFilter: (filter) =>
    set({
      selectedFilter: filter,
    }),

  setSelectedService: (service) =>
    set({
      selectedService: service,
    }),

  clearFilters: () =>
    set({
      selectedFilter: null,
      selectedService: DEFAULT_SERVICE,
    }),

  // ═══════════════ MAP ACTIONS ═══════════════
  setMapRegion: (region) =>
    set({
      mapRegion: region,
    }),

  // ═══════════════ BOOKING ACTIONS ═══════════════
  setDraftBooking: (draft) =>
    set({
      draftBooking: draft,
    }),

  clearBookingState: () =>
    set({
      bookings: {},
      bookingIds: [],
      draftBooking: null,
      isLoading: false,
      error: null,
    }),

  // ═══════════════ GETTERS ═══════════════
  getLocationLabel: () => {
    const { userLocation } = get();
    return userLocation?.label ?? "Set Location";
  },

  hasActiveFilters: () => {
    const { selectedFilter, selectedService } = get();
    return selectedFilter !== null || selectedService !== DEFAULT_SERVICE;
  },
}));
