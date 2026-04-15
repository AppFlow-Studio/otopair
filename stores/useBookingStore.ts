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
import { SERVICE_CATEGORIES, type ServiceCategoryItem } from "@/constants/services";
import type {
  Booking,
  BookingStage,
  BookingType,
  MechanicAvailabilitySlot,
  ScheduledAppointment,
  Service,
  ServiceCategory,
  ServiceOptionSelection,
  UserLocation,
} from "./types/store.types";

// ─────────────────────────────────────────────────────────────
// MECHANIC SLOT SELECTION TYPE
// ─────────────────────────────────────────────────────────────

/** Selected slot in mechanic selection screen */
export interface SelectedMechanicSlot {
  shopId: string;
  shopName: string;
  mechanicId: string | null; // null means "Any"
  mechanicName: string | null;
  slot: MechanicAvailabilitySlot;
  /** Convex time_slot_id for booking.create */
  timeSlotId?: string;
  /** Scheduled date YYYY-MM-DD */
  scheduledDate?: string;
  /** Scheduled time (e.g. "09:00") */
  scheduledTime?: string;
}
import { useMechanicStore } from "./useMechanicStore";
import { useVehicleStore } from "./useVehicleStore";

// ─────────────────────────────────────────────────────────────
// STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────

interface BookingState {
  // ═══════════════ LOCATION STATE ═══════════════
  /** User's current location for map display */
  userLocation: UserLocation | null;
  /** Whether location is being fetched */
  isLoadingLocation: boolean;

  // ═══════════════ PRE-SELECTION STATE (from search) ═══════════════
  /** Pre-selected shop ID when coming from search (navigates directly to shop) */
  preSelectedShopId: string | null;
  /** Pre-selected service IDs when coming from search */
  preSelectedServiceIds: string[];

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
  /** Available services to choose from (from Convex when loaded) */
  availableServices: Service[];
  /** Service categories for UI tabs (from Convex when loaded; empty = use constants fallback) */
  serviceCategories: ServiceCategoryItem[];
  /** Currently selected service IDs for booking */
  selectedServiceIds: string[];
  /** Whether to skip the remove-service confirmation modal */
  skipServiceRemovalConfirm: boolean;

  // ═══════════════ BOOKING FLOW STATE ═══════════════
  /** Current stage in the booking flow */
  bookingStage: BookingStage;
  /** Direction of the current transition (for animations) */
  transitionDirection: "forward" | "backward";
  /** Selected mechanic ID (null = "Any Available") */
  selectedMechanicId: string | null;
  /** Booking type - immediate or scheduled */
  bookingType: BookingType | null;
  /** Scheduled appointment date/time */
  scheduledAppointment: ScheduledAppointment | null;
  /** Whether booking_details was skipped (direct to payment via "Book Now") */
  skippedBookingDetails: boolean;
  /** Selected slot in mechanic selection screen (before booking) */
  selectedMechanicSlot: SelectedMechanicSlot | null;
  /** Selected service option per service (maps service_id → option selection with pricing) */
  selectedServiceOptions: Record<string, ServiceOptionSelection>;

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

  // ═══════════════ PRE-SELECTION ACTIONS ═══════════════
  /** Set pre-selected shop ID (from search) */
  setPreSelectedShop: (shopId: string | null) => void;
  /** Set pre-selected service IDs (from search) */
  setPreSelectedServices: (serviceIds: string[]) => void;
  /** Clear all pre-selections */
  clearPreSelections: () => void;

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
  /** Control whether the remove-service confirmation modal should be skipped */
  setSkipServiceRemovalConfirm: (skip: boolean) => void;

  // ═══════════════ BOOKING FLOW ACTIONS ═══════════════
  /** Set current booking stage with transition direction */
  setBookingStage: (stage: BookingStage, direction: "forward" | "backward") => void;
  /** Go to next stage in booking flow */
  nextBookingStage: () => void;
  /** Go to previous stage in booking flow */
  prevBookingStage: () => void;
  /** Select a mechanic (null for "Any Available") */
  selectMechanic: (mechanicId: string | null) => void;
  /** Set booking type and proceed to booking details */
  setBookingTypeAndProceed: (type: BookingType, mechanicId: string) => void;
  /** Set the scheduled appointment date/time */
  setScheduledAppointment: (appointment: ScheduledAppointment | null) => void;
  /** Set whether booking details was skipped */
  setSkippedBookingDetails: (skipped: boolean) => void;
  /** Set selected mechanic slot in mechanic selection screen */
  setSelectedMechanicSlot: (slot: SelectedMechanicSlot | null) => void;
  /** Clear selected mechanic slot */
  clearSelectedMechanicSlot: () => void;
  /** Set selected service option for a service (with pricing details) */
  setSelectedServiceOption: (serviceId: string, option: ServiceOptionSelection) => void;
  /** Clear all selected service options */
  clearSelectedServiceOptions: () => void;
  /** Reset booking flow to initial state */
  resetBookingFlow: () => void;

  // ═══════════════ BOOKING ACTIONS ═══════════════
  /** Set draft booking */
  setDraftBooking: (draft: Partial<Booking> | null) => void;
  /** Clear all booking state */
  clearBookingState: () => void;
  /** Create a new booking from current state (local only; use api.bookings.create for Convex) */
  createBooking: (mechanicId: string, bookingType: BookingType) => string;
  /** Hydrate available services from Convex (replaces/gates MOCK_SERVICES) */
  setAvailableServices: (services: Service[]) => void;
  /** Hydrate service categories from Convex (for Select Services tabs) */
  setServiceCategories: (categories: ServiceCategoryItem[]) => void;
  /** Hydrate bookings from Convex (cache for user's bookings) */
  setBookingsFromConvex: (bookings: Booking[]) => void;
  /** Cancel a local booking by ID (sets status to "cancelled") */
  cancelBooking: (id: string) => void;
  /** Get a booking by ID */
  getBookingById: (id: string) => Booking | null;
  /** Get all upcoming bookings (pending or confirmed, future dates) */
  getUpcomingBookings: () => Booking[];

  // ═══════════════ GETTERS ═══════════════
  /** Get location display label */
  getLocationLabel: () => string;
  /** Get total price of selected services */
  getSelectedServicesTotal: () => number;
  /** Get count of selected services */
  getSelectedServicesCount: () => number;
  /** Get service categories for UI (Convex when loaded, else constants) */
  getServiceCategories: () => ServiceCategoryItem[];
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
  preSelectedShopId: null,
  preSelectedServiceIds: [],
  selectedServiceCategory: null, // No service category selected by default
  mapRegion: null,
  availableServices: MOCK_SERVICES,
  serviceCategories: [],
  selectedServiceIds: [],
  skipServiceRemovalConfirm: false,
  bookingStage: "discovery",
  transitionDirection: "forward",
  selectedMechanicId: null,
  bookingType: null,
  scheduledAppointment: null,
  skippedBookingDetails: false,
  selectedMechanicSlot: null,
  selectedServiceOptions: {},
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

  // ═══════════════ PRE-SELECTION ACTIONS ═══════════════
  setPreSelectedShop: (shopId) =>
    set({
      preSelectedShopId: shopId,
    }),

  setPreSelectedServices: (serviceIds) =>
    set({
      preSelectedServiceIds: serviceIds,
    }),

  clearPreSelections: () =>
    set({
      preSelectedShopId: null,
      preSelectedServiceIds: [],
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

  setAvailableServices: (services) =>
    set({
      availableServices: services,
    }),

  setServiceCategories: (categories) =>
    set({
      serviceCategories: categories,
    }),

  setBookingsFromConvex: (bookings) =>
    set(() => {
      const byId: Record<string, Booking> = {};
      const ids: string[] = [];
      bookings.forEach((b) => {
        byId[b.id] = b;
        ids.push(b.id);
      });
      return { bookings: byId, bookingIds: ids };
    }),

  setSkipServiceRemovalConfirm: (skip) =>
    set({
      skipServiceRemovalConfirm: skip,
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
        "service_options",
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
        "service_options",
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

  setSkippedBookingDetails: (skipped) =>
    set({
      skippedBookingDetails: skipped,
    }),

  setSelectedMechanicSlot: (slot) =>
    set({
      selectedMechanicSlot: slot,
    }),

  clearSelectedMechanicSlot: () =>
    set({
      selectedMechanicSlot: null,
    }),

  setSelectedServiceOption: (serviceId, option) =>
    set((state) => ({
      selectedServiceOptions: {
        ...state.selectedServiceOptions,
        [serviceId]: option,
      },
    })),

  clearSelectedServiceOptions: () =>
    set({ selectedServiceOptions: {} }),

  resetBookingFlow: () =>
    set({
      bookingStage: "discovery",
      transitionDirection: "backward",
      selectedServiceIds: [],
      selectedMechanicId: null,
      selectedServiceCategory: null,
      preSelectedShopId: null,
      preSelectedServiceIds: [],
      bookingType: null,
      scheduledAppointment: null,
      skippedBookingDetails: false,
      selectedMechanicSlot: null,
      selectedServiceOptions: {},
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

  getServiceCategories: () => {
    const { serviceCategories } = get();
    return serviceCategories.length > 0 ? serviceCategories : SERVICE_CATEGORIES;
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

  cancelBooking: (id) => {
    set((state) => {
      const booking = state.bookings[id];
      if (!booking) return state;
      return {
        bookings: {
          ...state.bookings,
          [id]: { ...booking, status: "cancelled" as const, updatedAt: new Date().toISOString() },
        },
      };
    });
  },

  getBookingById: (id) => {
    const { bookings } = get();
    return bookings[id] || null;
  },

  getUpcomingBookings: () => {
    const { bookings, bookingIds } = get();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return bookingIds
      .map((id) => bookings[id])
      .filter((booking) => {
        if (!booking) return false;
        // Filter by status
        const isUpcomingStatus = booking.status === "pending" || booking.status === "confirmed";
        if (!isUpcomingStatus) return false;

        // Filter by future date
        const bookingDate = new Date(booking.scheduledDate);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate >= now;
      })
      .sort((a, b) => {
        // Sort by scheduled date (earliest first)
        const dateA = new Date(a.scheduledDate);
        const dateB = new Date(b.scheduledDate);
        return dateA.getTime() - dateB.getTime();
      });
  },

  createBooking: (mechanicId, bookingType) => {
    const state = get();
    const mechanic = useMechanicStore.getState().getMechanicById(mechanicId);

    if (!mechanic) {
      throw new Error(`Mechanic with ID ${mechanicId} not found`);
    }

    // Generate unique booking ID
    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get scheduled date/time from appointment or use defaults
    const scheduledDate = state.scheduledAppointment?.date || new Date().toISOString().split("T")[0];
    const scheduledTime = state.scheduledAppointment?.time || "1:00 PM";

    // Create booking object
    const booking: Booking = {
      id: bookingId,
      userId: "current_user_id", // TODO: Get from auth store
      shopId: String(mechanic.shopId),
      vehicleId: useVehicleStore.getState().selectedVehicleId ?? "default_vehicle_id",
      serviceIds: state.selectedServiceIds,
      status: bookingType === "schedule_later" ? "pending" : "confirmed",
      scheduledDate,
      scheduledTime,
      estimatedDuration: 60, // Default 1 hour
      totalPrice: state.getSelectedServicesTotal(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to store
    set((prevState) => ({
      bookings: {
        ...prevState.bookings,
        [bookingId]: booking,
      },
      bookingIds: [...prevState.bookingIds, bookingId],
    }));

    return bookingId;
  },
}));
