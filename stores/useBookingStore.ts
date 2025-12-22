/**
 * useBookingStore
 *
 * PURPOSE: Manages booking data, location, map state, and service selection for creating bookings
 *
 * TABLES: Bookings (future integration)
 *
 * RELATIONSHIPS:
 *   - Booking belongs to User
 *   - Booking belongs to Vehicle (via vehicleId)
 *   - Booking belongs to Shop (via shopId)
 *   - Booking has many Services (via serviceIds)
 *
 * OWNER: Waleed Mansour
 */

import { create } from "zustand";
import type {
  Booking,
  BookingStage,
  BookingType,
  ScheduledAppointment,
  Service,
  ServiceCategory,
  UserLocation,
} from "./types/store.types";

// ─────────────────────────────────────────────────────────────
// STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────

interface BookingState {
  // ═══════════════ LOCATION STATE ═══════════════
  /** User's current location for map display */
  userLocation: UserLocation | null;
  /** Whether location is being fetched */
  isLoadingLocation: boolean;

  // ═══════════════ SERVICE CATEGORY STATE ═══════════════
  /** Selected service category for service list display (null = no filter) */
  selectedServiceCategory: ServiceCategory | null;

  // ═══════════════ MAP STATE ═══════════════
  /** Map region for visible area */
  mapRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null;

  // ═══════════════ SERVICE SELECTION STATE ═══════════════
  /** Available services to choose from */
  availableServices: Service[];
  /** Currently selected service IDs for booking */
  selectedServiceIds: string[];

  // ═══════════════ BOOKING FLOW STATE ═══════════════
  /** Current stage in the booking flow */
  bookingStage: BookingStage;
  /** Direction of the current transition (for animations) */
  transitionDirection: "forward" | "backward";
  /** Selected mechanic ID (null = "Any Available") */
  selectedMechanicId: number | null;
  /** Booking type - immediate or scheduled */
  bookingType: BookingType | null;
  /** Scheduled appointment date/time */
  scheduledAppointment: ScheduledAppointment | null;

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

  // ═══════════════ SERVICE CATEGORY ACTIONS ═══════════════
  /** Set the selected service category for service list display (null to clear) */
  setSelectedServiceCategory: (category: ServiceCategory | null) => void;

  // ═══════════════ MAP ACTIONS ═══════════════
  /** Update map region */
  setMapRegion: (region: BookingState["mapRegion"]) => void;

  // ═══════════════ SERVICE SELECTION ACTIONS ═══════════════
  /** Toggle a service selection (add/remove) */
  toggleServiceSelection: (serviceId: string) => void;
  /** Clear all selected services */
  clearSelectedServices: () => void;

  // ═══════════════ BOOKING FLOW ACTIONS ═══════════════
  /** Set current booking stage with transition direction */
  setBookingStage: (stage: BookingStage, direction: "forward" | "backward") => void;
  /** Go to next stage in booking flow */
  nextBookingStage: () => void;
  /** Go to previous stage in booking flow */
  prevBookingStage: () => void;
  /** Select a mechanic (null for "Any Available") */
  selectMechanic: (mechanicId: number | null) => void;
  /** Set booking type and proceed to booking details */
  setBookingTypeAndProceed: (type: BookingType, mechanicId: number) => void;
  /** Set the scheduled appointment date/time */
  setScheduledAppointment: (appointment: ScheduledAppointment | null) => void;
  /** Reset booking flow to initial state */
  resetBookingFlow: () => void;

  // ═══════════════ BOOKING ACTIONS ═══════════════
  /** Set draft booking */
  setDraftBooking: (draft: Partial<Booking> | null) => void;
  /** Clear all booking state */
  clearBookingState: () => void;

  // ═══════════════ GETTERS ═══════════════
  /** Get location display label */
  getLocationLabel: () => string;
  /** Get total price of selected services */
  getSelectedServicesTotal: () => number;
  /** Get count of selected services */
  getSelectedServicesCount: () => number;
  /** Get services filtered by current category */
  getServicesByCategory: () => Service[];
  /** Get selected services as array */
  getSelectedServices: () => Service[];
  /** Get formatted appointment date for display */
  getFormattedAppointmentDate: () => string;
  /** Get formatted appointment time for display */
  getFormattedAppointmentTime: () => string;
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
// MOCK SERVICES DATA
// ─────────────────────────────────────────────────────────────

const MOCK_SERVICES: Service[] = [
  // Basic Maintenance
  {
    id: "svc_oil_change",
    name: "Oil Change",
    description: "Basic Oil change",
    price: 65,
    category: "basic_maintenance",
  },
  {
    id: "svc_filter_change",
    name: "Filter Change",
    description: "Basic Filter change",
    price: 87,
    category: "basic_maintenance",
  },
  {
    id: "svc_fluid_change",
    name: "Fluid Change",
    description: "Basic Fluid change",
    price: 135,
    category: "basic_maintenance",
  },
  { id: "svc_tune_up", name: "Tune-Up", description: "Overall tune-up", price: 217, category: "basic_maintenance" },
  // Tires & Wheels
  {
    id: "svc_tire_rotation",
    name: "Tire Rotation",
    description: "Rotate all four tires",
    price: 45,
    category: "tires_wheels",
  },
  {
    id: "svc_wheel_alignment",
    name: "Wheel Alignment",
    description: "Full wheel alignment",
    price: 120,
    category: "tires_wheels",
  },
  {
    id: "svc_tire_balance",
    name: "Tire Balancing",
    description: "Balance all tires",
    price: 60,
    category: "tires_wheels",
  },
  // Brakes & Suspension
  {
    id: "svc_brake_pads",
    name: "Brake Pads",
    description: "Replace brake pads",
    price: 180,
    category: "brakes_suspension",
  },
  {
    id: "svc_brake_fluid",
    name: "Brake Fluid Flush",
    description: "Flush brake fluid",
    price: 95,
    category: "brakes_suspension",
  },
  {
    id: "svc_suspension_check",
    name: "Suspension Check",
    description: "Inspect suspension",
    price: 75,
    category: "brakes_suspension",
  },
  // System Diagnostics
  {
    id: "svc_engine_diagnostic",
    name: "Engine Diagnostic",
    description: "Full engine scan",
    price: 110,
    category: "system_diagnostics",
  },
  {
    id: "svc_electrical_check",
    name: "Electrical Check",
    description: "Electrical system check",
    price: 85,
    category: "system_diagnostics",
  },
  {
    id: "svc_emissions_test",
    name: "Emissions Test",
    description: "Emissions testing",
    price: 50,
    category: "system_diagnostics",
  },
];

// ─────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────

export const useBookingStore = create<BookingState>()((set, get) => ({
  // ═══════════════ INITIAL STATE ═══════════════
  userLocation: DEFAULT_LOCATION,
  isLoadingLocation: false,
  selectedServiceCategory: null, // No service category selected by default
  mapRegion: null,
  availableServices: MOCK_SERVICES,
  selectedServiceIds: [],
  bookingStage: "discovery",
  transitionDirection: "forward",
  selectedMechanicId: null,
  bookingType: null,
  scheduledAppointment: null,
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

  // ═══════════════ SERVICE CATEGORY ACTIONS ═══════════════
  setSelectedServiceCategory: (category) =>
    set({
      selectedServiceCategory: category,
    }),

  // ═══════════════ MAP ACTIONS ═══════════════
  setMapRegion: (region) =>
    set({
      mapRegion: region,
    }),

  // ═══════════════ SERVICE SELECTION ACTIONS ═══════════════
  toggleServiceSelection: (serviceId) =>
    set((state) => {
      const isSelected = state.selectedServiceIds.includes(serviceId);
      return {
        selectedServiceIds: isSelected
          ? state.selectedServiceIds.filter((id) => id !== serviceId)
          : [...state.selectedServiceIds, serviceId],
      };
    }),

  clearSelectedServices: () =>
    set({
      selectedServiceIds: [],
    }),

  // ═══════════════ BOOKING FLOW ACTIONS ═══════════════
  setBookingStage: (stage, direction) =>
    set({
      bookingStage: stage,
      transitionDirection: direction,
    }),

  nextBookingStage: () =>
    set((state) => {
      const stages: BookingStage[] = [
        "discovery",
        "service_selection",
        "mechanic_selection",
        "booking_details",
        "payment",
        "confirmation",
      ];
      const currentIndex = stages.indexOf(state.bookingStage);
      const nextIndex = Math.min(currentIndex + 1, stages.length - 1);
      return { bookingStage: stages[nextIndex], transitionDirection: "forward" };
    }),

  prevBookingStage: () =>
    set((state) => {
      const stages: BookingStage[] = [
        "discovery",
        "service_selection",
        "mechanic_selection",
        "booking_details",
        "payment",
        "confirmation",
      ];
      const currentIndex = stages.indexOf(state.bookingStage);
      const prevIndex = Math.max(currentIndex - 1, 0);
      return { bookingStage: stages[prevIndex], transitionDirection: "backward" };
    }),

  selectMechanic: (mechanicId) =>
    set({
      selectedMechanicId: mechanicId,
    }),

  setBookingTypeAndProceed: (type, mechanicId) =>
    set({
      bookingType: type,
      selectedMechanicId: mechanicId,
      bookingStage: "booking_details",
      transitionDirection: "forward",
    }),

  setScheduledAppointment: (appointment) =>
    set({
      scheduledAppointment: appointment,
    }),

  resetBookingFlow: () =>
    set({
      bookingStage: "discovery",
      transitionDirection: "backward",
      selectedServiceIds: [],
      selectedMechanicId: null,
      selectedServiceCategory: null,
      bookingType: null,
      scheduledAppointment: null,
      draftBooking: null,
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

  getSelectedServicesTotal: () => {
    const { availableServices, selectedServiceIds } = get();
    return availableServices
      .filter((service) => selectedServiceIds.includes(service.id))
      .reduce((total, service) => total + service.price, 0);
  },

  getSelectedServicesCount: () => {
    const { selectedServiceIds } = get();
    return selectedServiceIds.length;
  },

  getSelectedServices: () => {
    const { availableServices, selectedServiceIds } = get();
    return availableServices.filter((service) => selectedServiceIds.includes(service.id));
  },

  getServicesByCategory: () => {
    const { availableServices, selectedServiceCategory } = get();
    // If no category selected, return all services
    if (!selectedServiceCategory) return availableServices;
    return availableServices.filter((service) => service.category === selectedServiceCategory);
  },

  getFormattedAppointmentDate: () => {
    const { scheduledAppointment } = get();
    if (!scheduledAppointment) {
      // Default to a future date if not set
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 1 week from now
      const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
      return `${futureDate.getDate()} ${months[futureDate.getMonth()]} ${futureDate.getFullYear()}`;
    }
    return scheduledAppointment.displayDate;
  },

  getFormattedAppointmentTime: () => {
    const { scheduledAppointment } = get();
    if (!scheduledAppointment) {
      return "1:00 PM"; // Default time
    }
    return scheduledAppointment.time;
  },
}));
