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
import { filterSelectableServicesForVehicle } from "@/lib/serviceBookability";
import { resolveBasketVehicleVin } from "@/utils/bookingVehicle";
import { useVehicleStore } from "./useVehicleStore";
import type { DiagnosticSystem } from "@/lib/diagnostic-checklist-templates";
import type { Id } from "@/convex/_generated/dataModel";
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
  /** Legacy time_slots id or computed availability window id; booking uses date/time as source of truth. */
  timeSlotId?: string;
  /** Scheduled date YYYY-MM-DD */
  scheduledDate?: string;
  /** Scheduled time (e.g. "09:00") */
  scheduledTime?: string;
}

// ─────────────────────────────────────────────────────────────
// QUOTE ACCEPTANCE CONTEXT TYPE
// ─────────────────────────────────────────────────────────────

/** Set when the customer is picking their own date/time for a shop's
 *  tire/rotor quote, instead of a normal service-selection booking. Read by
 *  pick-datetime/payment/confirming to source the shop, floor, and display
 *  pricing without a normal `selectedServiceIds` cart. `laborCost`/`partsCost`/
 *  `lineItems`/`quoteTotal` are DISPLAY ONLY — the actual price is always
 *  re-read server-side from the quote response row at accept time. */
export interface QuoteAcceptContext {
  bookingId: Id<"bookings">;
  vehicleVin: string;
  quoteType: "tire" | "rotor";
  responseId: string;
  shopId: string;
  shopName: string;
  mechanicId: string | null; // null = "Any"
  /** response.availability.date — inclusive floor */
  minDate: string;
  /** response.availability.time — inclusive floor */
  minTime: string;
  estimatedDurationMinutes?: number;
  laborCost: number;
  partsCost: number;
  lineItems: { label: string; amount: number }[];
  quoteTotal: number;
}

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
  /** One-shot signal: when the user enters the booking flow from a
   *  category-specific entry point (e.g. tapping "Brakes" or "Tires"
   *  on the home More Services grid), this is set so the service
   *  selector mounts with that category tab pre-selected. The consumer
   *  (ServiceSelectionContent) clears it on read. */
  initialServiceCategory: ServiceCategory | null;

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
  /** VIN captured individually when each service enters the cart. */
  selectedServiceVehicleVins: Record<string, string | null>;
  /**
   * VIN of the vehicle this in-flight booking belongs to. Captured the
   * moment the cart goes from empty → first service (snapshotted from
   * `useVehicleStore.selectedVehicleId`), cleared when the cart empties.
   * Lets the home Resume Booking card stay locked to the right vehicle
   * even if the user switches the globally-active car mid-booking.
   */
  selectedVehicleVin: string | null;
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
  /** Customer-facing range snapshot stashed by ReviewPayContent so the
   *  Confirm screen can quote the same band the customer just agreed to.
   *  Format: `$108.42 – $138.67`. Cleared on flow reset. */
  disclosedRangeFormatted: string | null;
  /** True when any service in the agreed-to range resolved to a flat fixed
   *  price for the shop's tier. Drives the "Fixed price" badge on the
   *  Confirm screen so the user sees the same guarantee they did on
   *  Review & Pay. Cleared on flow reset. */
  disclosedRangeIsFixedPrice: boolean;
  /** True when the Pricing v2 quote engine flagged the disclosed range as
   *  estimate-grade — engine refused at least one service, rolled-up
   *  per-quote flags non-empty, labor-hours fell back to default, or no
   *  real per-vehicle parts data. Drives the "Estimate" pill on Review &
   *  Pay and Confirm. Cleared on flow reset. */
  disclosedRangeIsEstimate: boolean;
  /** Whether booking_details was skipped (direct to payment via "Book Now") */
  skippedBookingDetails: boolean;
  /** Selected slot in mechanic selection screen (before booking) */
  selectedMechanicSlot: SelectedMechanicSlot | null;
  /** Set while the customer is picking a date/time for a tire/rotor quote
   *  instead of a normal service-selection booking. Null otherwise. */
  quoteAcceptContext: QuoteAcceptContext | null;
  /** Selected service option per service (maps service_id → option selection with pricing) */
  selectedServiceOptions: Record<string, ServiceOptionSelection>;
  /** When the driver starts this booking from a mechanic recommendation card,
   *  the rec's _id is stashed here and forwarded to bookings.createBatch as
   *  source_recommendation_id so the rec auto-closes on completion. */
  sourceRecommendationId: string | null;
  /** When the driver confirms a mechanic-scheduled date from the Take Action
   *  detail screen, the ms-epoch slot is stashed here so the booking date
   *  picker can pre-select it. Cleared by resetBookingFlow. */
  prefilledScheduledAt: number | null;
  /** Free-text notes from the customer that the mechanic should read before
   *  starting the job (entered on the Review & Pay screen, or on the
   *  diagnostic options screen when the Diagnostic Scan service is selected). */
  customerNotes: string;
  /** Diagnostic area the customer picked when booking a Diagnostic Scan.
   *  Null when no Diagnostic Scan service is in the cart or before the user
   *  picks one of the five areas on the diagnostic options screen. */
  selectedDiagnosticSystem: DiagnosticSystem | null;

  // ═══════════════ SLOT HOLD STATE ═══════════════
  /** Stable id for the current checkout, used to acquire/refresh/consume the
   *  slot hold. Generated lazily; cleared by resetBookingFlow. */
  holdSessionId: string | null;
  /** Active slot hold for the current checkout (null = none / feature off). */
  holdId: string | null;
  /** Absolute ms when the hold expires — powers the countdown. */
  holdExpiresAt: number | null;

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
  /** Set the one-shot initial category for the next mount of the
   *  service selector. ServiceSelectionContent reads and clears this. */
  setInitialServiceCategory: (category: ServiceCategory | null) => void;

  // ═══════════════ MAP ACTIONS ═══════════════
  /** Update map region */
  setMapRegion: (region: BookingState["mapRegion"]) => void;

  // ═══════════════ SERVICE SELECTION ACTIONS ═══════════════
  /** Toggle a service selection (add/remove) */
  toggleServiceSelection: (serviceId: string) => void;
  /** Replace the cart with services allowed for the current vehicle context. */
  replaceSelectedServicesForVehicle: (
    services: Service[],
    options?: { ownershipId?: string | null; bookableIds?: Set<string> | null },
  ) => void;
  /** Clear all selected services */
  clearSelectedServices: () => void;
  /** Explicitly set the in-flight booking's vehicle VIN (call sites that
   *  start a booking without going through toggleServiceSelection). */
  setSelectedVehicleVin: (vin: string | null) => void;
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
  setBookingTypeAndProceed: (type: BookingType, mechanicId: string | null) => void;
  /** Set the scheduled appointment date/time */
  setScheduledAppointment: (appointment: ScheduledAppointment | null) => void;
  /** Stash the disclosed price range so the Confirm screen can re-display it. */
  setDisclosedRangeFormatted: (formatted: string | null) => void;
  /** Stash whether any line in the agreed range was a flat fixed price. */
  setDisclosedRangeIsFixedPrice: (isFixed: boolean) => void;
  /** Stash whether the Pricing v2 engine flagged the disclosed range as
   *  estimate-grade so the Confirm screen can mirror the badge from
   *  Review & Pay without re-running the quote engine hook. */
  setDisclosedRangeIsEstimate: (isEstimate: boolean) => void;
  /** Set whether booking details was skipped */
  setSkippedBookingDetails: (skipped: boolean) => void;
  /** Set selected mechanic slot in mechanic selection screen */
  setSelectedMechanicSlot: (slot: SelectedMechanicSlot | null) => void;
  /** Clear selected mechanic slot */
  clearSelectedMechanicSlot: () => void;
  /** Set/clear the tire/rotor quote-acceptance context (null clears it) */
  setQuoteAcceptContext: (context: QuoteAcceptContext | null) => void;
  /** Set selected service option for a service (with pricing details) */
  setSelectedServiceOption: (serviceId: string, option: ServiceOptionSelection) => void;
  /** Clear all selected service options */
  clearSelectedServiceOptions: () => void;
  /** Set the rec id sourced into the booking flow (null clears it) */
  setSourceRecommendationId: (id: string | null) => void;
  /** Set the pre-confirmed scheduled date sourced from a mechanic rec. */
  setPrefilledScheduledAt: (ms: number | null) => void;
  /** Set the customer notes (passed to the booking row as customer_notes). */
  setCustomerNotes: (notes: string) => void;
  /** Set the diagnostic area selection (null clears it). */
  setSelectedDiagnosticSystem: (system: DiagnosticSystem | null) => void;

  // ═══════════════ SLOT HOLD ACTIONS ═══════════════
  /** Return the session id, generating a fresh one on first call. */
  ensureHoldSessionId: () => string;
  /** Stash the acquired hold (null clears). */
  setSlotHold: (hold: { holdId: string; expiresAt: number } | null) => void;
  /** Clear the hold + session id (call after release/consume). */
  clearSlotHold: () => void;

  /** Reset booking flow to initial state */
  resetBookingFlow: () => void;

  // ═══════════════ BOOKING ACTIONS ═══════════════
  /** Set draft booking */
  setDraftBooking: (draft: Partial<Booking> | null) => void;
  /** Clear all booking state */
  clearBookingState: () => void;
  /** Hydrate available services from Convex (replaces/gates MOCK_SERVICES) */
  setAvailableServices: (services: Service[]) => void;
  /** Hydrate service categories from Convex (for Select Services tabs) */
  setServiceCategories: (categories: ServiceCategoryItem[]) => void;
  /** Hydrate bookings from Convex (cache for user's bookings) */
  setBookingsFromConvex: (bookings: Booking[]) => void;
  /** Cancel a local booking by ID (sets status to "cancelled") */
  cancelBooking: (id: string) => void;
  /** Hard-delete a local booking. Used by the testing trash button. */
  removeBooking: (id: string) => void;
  /** Reschedule a local booking's date/time. `date` = YYYY-MM-DD, `time` = "9:00 AM" */
  rescheduleBooking: (id: string, date: string, time: string) => void;
  /** Flip a booking between "in_progress" (Live Tracker) and "confirmed" (Upcoming). */
  toggleLiveTracker: (id: string) => void;
  /** Flip a booking between pending_quote (Upcoming) and quotes_ready (Quotes). */
  toggleQuotesReady: (id: string) => void;
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
  {
    id: "svc_tire_replacement",
    name: "Tire Replacement",
    description: "Mount and balance new tires to OEM size",
    price: 0,
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
  userLocation: null,
  isLoadingLocation: true,
  preSelectedShopId: null,
  preSelectedServiceIds: [],
  selectedServiceCategory: null, // No service category selected by default
  initialServiceCategory: null, // Cleared after one read by ServiceSelectionContent
  mapRegion: null,
  availableServices: MOCK_SERVICES,
  serviceCategories: [],
  selectedServiceIds: [],
  selectedServiceVehicleVins: {},
  selectedVehicleVin: null,
  skipServiceRemovalConfirm: false,
  bookingStage: "discovery",
  transitionDirection: "forward",
  selectedMechanicId: null,
  bookingType: null,
  scheduledAppointment: null,
  disclosedRangeFormatted: null,
  disclosedRangeIsFixedPrice: false,
  disclosedRangeIsEstimate: false,
  skippedBookingDetails: false,
  selectedMechanicSlot: null,
  quoteAcceptContext: null,
  selectedServiceOptions: {},
  sourceRecommendationId: null,
  prefilledScheduledAt: null,
  customerNotes: "",
  selectedDiagnosticSystem: null,
  holdSessionId: null,
  holdId: null,
  holdExpiresAt: null,
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
  setInitialServiceCategory: (category) =>
    set({
      initialServiceCategory: category,
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
      const nextIds = isSelected
        ? state.selectedServiceIds.filter((id) => id !== serviceId)
        : [...state.selectedServiceIds, serviceId];
      const activeVehicleVin = useVehicleStore.getState().selectedVehicleId ?? null;
      const nextServiceVehicleVins = { ...state.selectedServiceVehicleVins };
      if (isSelected) {
        delete nextServiceVehicleVins[serviceId];
      } else {
        nextServiceVehicleVins[serviceId] = activeVehicleVin;
      }

      // Snapshot the active VIN the moment the cart goes empty → first
      // service so the Resume Booking card on home stays locked to that
      // vehicle. Cross-clear when the cart empties so a fresh booking
      // re-snapshots the (possibly different) active vehicle next time.
      const nextVin = resolveBasketVehicleVin({
        previousServiceCount: state.selectedServiceIds.length,
        nextServiceCount: nextIds.length,
        basketVehicleVin: state.selectedVehicleVin,
        activeVehicleVin,
        remainingServiceVehicleVins: nextIds.map(
          (id) => nextServiceVehicleVins[id] ?? state.selectedVehicleVin,
        ),
      });

      return {
        selectedServiceIds: nextIds,
        selectedServiceVehicleVins: nextServiceVehicleVins,
        selectedVehicleVin: nextVin,
        quoteAcceptContext: null,
      };
    }),

  replaceSelectedServicesForVehicle: (services, options) =>
    set(() => {
      const nextIds = filterSelectableServicesForVehicle(services, {
        ownershipId: options?.ownershipId,
        bookableIds: options?.bookableIds,
      }).map((service) => service.id);
      const activeVehicleVin = useVehicleStore.getState().selectedVehicleId ?? null;

      return {
        selectedServiceIds: nextIds,
        selectedServiceVehicleVins: Object.fromEntries(
          nextIds.map((serviceId) => [serviceId, activeVehicleVin]),
        ),
        selectedVehicleVin: nextIds.length > 0 ? activeVehicleVin : null,
        quoteAcceptContext: null,
      };
    }),

  clearSelectedServices: () =>
    set({
      selectedServiceIds: [],
      selectedServiceVehicleVins: {},
      selectedVehicleVin: null,
      selectedServiceOptions: {},
      selectedDiagnosticSystem: null,
      customerNotes: "",
      quoteAcceptContext: null,
    }),

  setSelectedVehicleVin: (vin) => set({ selectedVehicleVin: vin }),

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

  setDisclosedRangeFormatted: (formatted) =>
    set({
      disclosedRangeFormatted: formatted,
    }),

  setDisclosedRangeIsFixedPrice: (isFixed) =>
    set({
      disclosedRangeIsFixedPrice: isFixed,
    }),

  setDisclosedRangeIsEstimate: (isEstimate) =>
    set({
      disclosedRangeIsEstimate: isEstimate,
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

  setQuoteAcceptContext: (context) =>
    set({
      quoteAcceptContext: context,
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

  setSourceRecommendationId: (id) =>
    set({ sourceRecommendationId: id }),

  setPrefilledScheduledAt: (ms) =>
    set({ prefilledScheduledAt: ms }),

  setCustomerNotes: (notes) =>
    set({ customerNotes: notes }),

  setSelectedDiagnosticSystem: (system) =>
    set({ selectedDiagnosticSystem: system }),

  // ═══════════════ SLOT HOLD ACTIONS ═══════════════
  ensureHoldSessionId: () => {
    const existing = get().holdSessionId;
    if (existing) return existing;
    // A per-checkout correlation id — not cryptographically sensitive, so a
    // timestamp + random suffix is enough. Namespaced server-side by session.
    const id = `hold-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set({ holdSessionId: id });
    return id;
  },

  setSlotHold: (hold) =>
    set({ holdId: hold?.holdId ?? null, holdExpiresAt: hold?.expiresAt ?? null }),

  clearSlotHold: () =>
    set({ holdId: null, holdExpiresAt: null, holdSessionId: null }),

  resetBookingFlow: () =>
    set({
      bookingStage: "discovery",
      transitionDirection: "backward",
      selectedServiceIds: [],
      selectedServiceVehicleVins: {},
      selectedVehicleVin: null,
      selectedMechanicId: null,
      selectedServiceCategory: null,
      initialServiceCategory: null,
      preSelectedShopId: null,
      preSelectedServiceIds: [],
      bookingType: null,
      scheduledAppointment: null,
      disclosedRangeFormatted: null,
      disclosedRangeIsFixedPrice: false,
      disclosedRangeIsEstimate: false,
      skippedBookingDetails: false,
      selectedMechanicSlot: null,
      quoteAcceptContext: null,
      selectedServiceOptions: {},
      sourceRecommendationId: null,
      prefilledScheduledAt: null,
      customerNotes: "",
      selectedDiagnosticSystem: null,
      holdSessionId: null,
      holdId: null,
      holdExpiresAt: null,
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
    const { isLoadingLocation, userLocation } = get();
    if (userLocation) return userLocation.label;
    return isLoadingLocation ? "Finding location..." : "Set Location";
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

  removeBooking: (id) => {
    set((state) => {
      if (!state.bookings[id]) return state;
      const { [id]: _removed, ...rest } = state.bookings;
      return {
        bookings: rest,
        bookingIds: state.bookingIds.filter((bid) => bid !== id),
      };
    });
  },

  rescheduleBooking: (id, date, time) => {
    // TODO(convex): add a rescheduleBooking Convex mutation and call it here so
    // Convex-sourced bookings in the list also reflect the new date/time.
    set((state) => {
      const booking = state.bookings[id];
      if (!booking) return state;
      return {
        bookings: {
          ...state.bookings,
          [id]: {
            ...booking,
            scheduledDate: date,
            scheduledTime: time,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  },

  toggleLiveTracker: (id) => {
    // TODO(convex): mirror this flip with a Convex mutation so Convex bookings
    // can also be promoted/demoted from the Live Tracker tab.
    set((state) => {
      const target = state.bookings[id];
      if (!target) return state;
      const now = new Date().toISOString();

      // Flip OFF: currently live → back to confirmed.
      if (target.status === "in_progress") {
        return {
          bookings: {
            ...state.bookings,
            [id]: { ...target, status: "confirmed" as const, updatedAt: now },
          },
        };
      }

      // Flip ON: demote any other local booking that's currently live, then promote this one.
      const next = { ...state.bookings };
      for (const otherId of state.bookingIds) {
        const other = next[otherId];
        if (other && otherId !== id && other.status === "in_progress") {
          next[otherId] = { ...other, status: "confirmed" as const, updatedAt: now };
        }
      }
      next[id] = { ...target, status: "in_progress" as const, updatedAt: now };
      return { bookings: next };
    });
  },

  toggleQuotesReady: (id) => {
    // Flip a pending_quote booking to quotes_ready (moves it from the
    // Upcoming tab to the Quotes tab) and back. Mirrors toggleLiveTracker.
    set((state) => {
      const target = state.bookings[id];
      if (!target) return state;
      const now = new Date().toISOString();
      const nextStatus =
        target.status === "quotes_ready" ? "pending_quote" : "quotes_ready";
      return {
        bookings: {
          ...state.bookings,
          [id]: { ...target, status: nextStatus, updatedAt: now },
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
}));
