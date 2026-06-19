/**
 * BookServiceComponent
 *
 * PURPOSE: Single consolidated booking surface that replaces the prior 6-stage
 * chain (render_service_picker → render_diagnostic_form → render_shop_carousel
 * → render_time_selector → render_booking_confirmation → navigate_to_payment).
 * Renders inline in the AI chat when Oto fires `render_book_service`.
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (when message.bookService is set)
 *
 * SPEC: docs/SPRINT_4_FRONTEND_BOOK_SERVICE_TICKET.md
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

// 2. Expo & Third-party
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { useQuery } from "convex/react";
import Animated, {
  Easing,
  FadeIn,
  FadeInRight,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  Circle,
  Clock,
  Disc,
  Droplet,
  Gauge,
  MapPin,
  Pencil,
  Scan,
  Star,
  Wind,
  Wrench,
  X,
} from "lucide-react-native";

// Per-service icon mapping for Stage 1. Falls back to Wrench for any
// service ID not explicitly mapped here.
const SERVICE_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  svc_oil_change: Droplet,
  svc_air_filter: Wind,
  svc_fluid_check: Droplet,
  svc_tire_rotation: Circle,
  svc_tire_balance: Circle,
  svc_tire_pressure: Gauge,
  svc_brake_inspection: Disc,
  svc_brake_pads: Disc,
  svc_brake_fluid: Disc,
  svc_diagnostic_scan: Scan,
  svc_check_engine: AlertTriangle,
};

// 3. Shared UI (design system)
import { Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BorderRadius, BrandColors, FontFamily, Spacing } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMechanicsFromConvex } from "@/hooks/useMechanicsFromConvex";
import { useDistanceUnit } from "@/hooks/useDistanceUnit";
import { useServicesFromConvex } from "@/hooks/useServicesFromConvex";
import { useShopsFromConvex } from "@/hooks/useShopsFromConvex";
import type { BookServicePayload } from "@/services/ai/types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { formatProximityDistanceFromMiles } from "@/utils/geo";
import { displayTimeToHHMM } from "@/utils/timeSlotUtils";

// Local service catalog (12 entries). Static client-side metadata; the
// authoritative booking-time service rows live in Convex (`services` table)
// and are resolved via LOCAL_ID_TO_STORE_ID at Book & Pay. Keep the slugs in
// SLUG_TO_LOCAL_ID below in sync with this list.
type ServiceCategory = "maintenance" | "tires" | "brakes" | "diagnostics";
interface ServiceOption {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  duration: string;
}
const DEFAULT_SERVICES: ServiceOption[] = [
  { id: "svc_oil_change", name: "Oil Change", description: "Full synthetic oil & filter replacement", category: "maintenance", duration: "30 min" },
  { id: "svc_air_filter", name: "Air Filter", description: "Engine air filter replacement", category: "maintenance", duration: "15 min" },
  { id: "svc_fluid_check", name: "Fluid Top-Off", description: "Check & top off all fluids", category: "maintenance", duration: "20 min" },
  { id: "svc_tire_rotation", name: "Tire Rotation", description: "Rotate tires for even wear", category: "tires", duration: "30 min" },
  { id: "svc_tire_balance", name: "Wheel Balance", description: "Balance all four wheels", category: "tires", duration: "45 min" },
  { id: "svc_tire_pressure", name: "TPMS Check", description: "Tire pressure sensor inspection", category: "tires", duration: "15 min" },
  { id: "svc_brake_inspection", name: "Brake Inspection", description: "Full brake system check", category: "brakes", duration: "30 min" },
  { id: "svc_brake_pads", name: "Brake Pads", description: "Front or rear pad replacement", category: "brakes", duration: "1-2 hrs" },
  { id: "svc_brake_fluid", name: "Brake Fluid", description: "Brake fluid flush & fill", category: "brakes", duration: "45 min" },
  { id: "svc_diagnostic_scan", name: "Diagnostic Scan", description: "Computer scan for error codes", category: "diagnostics", duration: "30 min" },
  { id: "svc_check_engine", name: "Check Engine Light", description: "Diagnose warning light cause", category: "diagnostics", duration: "1 hr" },
  { id: "svc_battery_test", name: "Battery Test", description: "Battery & charging system test", category: "diagnostics", duration: "15 min" },
];

// ============================================================================
// CONSTANTS — service catalog + diagnostic systems + priority chips
// ============================================================================

// Maps Oto's canonical service slugs (the payload contract from
// `render_book_service`) to the local catalog IDs used by DEFAULT_SERVICES
// AND to the booking-store service IDs used by `useCreateBookingConvex`.
// Mirror of the mapping table in `handleBookNow` (ai-chat/index.tsx) so the
// store-population step at Book & Pay produces the same store shape.
const SLUG_TO_LOCAL_ID: Record<string, string> = {
  oil_change: "svc_oil_change",
  air_filter: "svc_air_filter",
  fluid_top_off: "svc_fluid_check",
  tire_rotation: "svc_tire_rotation",
  wheel_balance: "svc_tire_balance",
  tpms_check: "svc_tire_pressure",
  brake_inspection: "svc_brake_inspection",
  brake_pads: "svc_brake_pads",
  brake_fluid: "svc_brake_fluid",
  diagnostic_scan: "svc_diagnostic_scan",
  check_engine_light: "svc_check_engine",
  battery_test: "svc_battery_test",
};

// Booking-store service-id mapping used by `useCreateBookingConvex`. Same
// table as `handleBookNow` lines 695-708 — kept here so the Book & Pay path
// produces the exact same store state the existing pay-screen expects.
const LOCAL_ID_TO_STORE_ID: Record<string, string> = {
  svc_oil_change: "svc_oil_change",
  svc_air_filter: "svc_filter_change",
  svc_fluid_check: "svc_fluid_change",
  svc_tire_rotation: "svc_tire_rotation",
  svc_tire_balance: "svc_tire_balance",
  svc_tire_pressure: "svc_tire_rotation",
  svc_brake_inspection: "svc_brake_pads",
  svc_brake_pads: "svc_brake_pads",
  svc_brake_fluid: "svc_brake_fluid",
  svc_diagnostic_scan: "svc_engine_diagnostic",
  svc_check_engine: "svc_engine_diagnostic",
  svc_battery_test: "svc_electrical_check",
};

type DiagnosticSystem =
  | "brakes"
  | "tires_wheels"
  | "engine"
  | "battery_electrical"
  | "not_sure";

const SYSTEMS: { value: DiagnosticSystem; label: string }[] = [
  { value: "brakes", label: "Brakes" },
  { value: "tires_wheels", label: "Tires & Wheels" },
  { value: "engine", label: "Engine" },
  { value: "battery_electrical", label: "Battery & Electrical" },
  { value: "not_sure", label: "Not Sure" },
];

type Priority = "closest" | "best_rated" | "best_price";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "closest", label: "Closest" },
  { value: "best_rated", label: "Best rated" },
  { value: "best_price", label: "Best price" },
];

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ============================================================================
// TYPES
// ============================================================================

interface BookServiceComponentProps {
  payload: BookServicePayload;
  /**
   * Called when the user dismisses the component mid-flow. The parent should
   * mark the booking as abandoned in conversation state so Oto's next turn
   * sees the user backed out.
   */
  onDismiss?: () => void;
  /**
   * Called when the user completes the flow and is being routed to the
   * pay-screen. The parent can record a `selected mechanic_id` fact for the
   * next Oto turn (matches the existing handleBookNow telemetry).
   */
  onBookAndPay?: (mechanicId: string) => void;
  disabled?: boolean;
}

// Three stages collapse to none when there's no diagnostic + no per-service
// options worth showing; the stepper hides those dots so the visible flow
// stays honest about what's actually pending.
type Stage = 1 | 2 | 3 | 4 | 5 | 6;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BookServiceComponent({
  payload,
  onDismiss,
  onBookAndPay,
  disabled = false,
}: BookServiceComponentProps) {
  const router = useRouter();

  // Hydrate mechanic + shop + services stores in the background (these
  // queries are also used by other surfaces, so they're already warm if the
  // user has been browsing the app). Services in particular must be hydrated
  // here — otherwise a user entering the booking flow directly from AI chat
  // (without visiting Home first) reaches the pay-screen with an empty
  // `availableServices` store and the booking creation rejects with "No
  // services selected" because none of the local catalog ids will match.
  useMechanicsFromConvex();
  useShopsFromConvex();
  useServicesFromConvex();

  const allMechanicsList = useMechanicStore((s) => s.mechanicIds);
  const getMechanicById = useMechanicStore((s) => s.getMechanicById);
  const getShopById = useShopStore((s) => s.getShopById);

  // Booking store actions used at Book & Pay time. We don't drive the store
  // sub-stage-by-sub-stage because the user can back-navigate freely; we
  // commit the whole selection in one shot when they hit Book & Pay.
  const clearSelectedServices = useBookingStore((s) => s.clearSelectedServices);
  const toggleServiceSelection = useBookingStore((s) => s.toggleServiceSelection);
  const selectMechanic = useBookingStore((s) => s.selectMechanic);
  const setScheduledAppointment = useBookingStore((s) => s.setScheduledAppointment);
  const setBookingStage = useBookingStore((s) => s.setBookingStage);
  // Real Convex services list (hydrated globally by useServicesFromConvex).
  // We need the canonical `Id<"services">` values at toggle time — the
  // pay-screen's createBookingConvex filters availableServices by id, and
  // our local catalog ids ("svc_oil_change") will never match.
  const availableConvexServices = useBookingStore((s) => s.availableServices);

  // ──────────────────────────────────────────────────────────────────────
  // Internal state — driven by payload prefill; user can override at any
  // stage and back-nav to revise.
  // ──────────────────────────────────────────────────────────────────────

  // Sub-stage 1: which services are selected. Resolve payload slugs to
  // local catalog IDs; ignore slugs we don't recognize (Oto's vocabulary may
  // outpace the local catalog, but the catalog wins for what we can book).
  const initialSelectedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const slug of payload.service_slugs ?? []) {
      const id = SLUG_TO_LOCAL_ID[slug];
      if (id) ids.add(id);
    }
    return ids;
  }, [payload.service_slugs]);

  const [stage, setStage] = useState<Stage>(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelectedIds);

  // Sub-stage 3: diagnostic notes (only relevant if diagnostic_scan selected).
  const [diagnosticSystem, setDiagnosticSystem] = useState<DiagnosticSystem>(
    payload.diagnostic_system ?? "not_sure",
  );
  const [customerNotes, setCustomerNotes] = useState<string>(payload.customer_notes ?? "");

  // Sub-stage 4: mechanic selection.
  const [priority, setPriority] = useState<Priority>(payload.recommended_priority ?? "best_rated");
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(
    payload.recommended_mechanic_id ?? null,
  );

  // Sub-stage 5: time slot — key is `${slotId}` since we read the canonical
  // slot row out of Convex.
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Inline failure surface — fires when the Book & Pay handoff can't
  // happen because the Convex services list hasn't hydrated or the
  // selected names don't match any Convex row. Surfaces above the
  // footer button so the user sees why nothing is happening instead of
  // a generic "Booking Failed" two screens later.
  const [bookHandoffError, setBookHandoffError] = useState<string | null>(null);

  const hasDiagnostic = selectedIds.has("svc_diagnostic_scan");
  const selectedServiceOptions: ServiceOption[] = useMemo(
    () => DEFAULT_SERVICES.filter((s) => selectedIds.has(s.id)),
    [selectedIds],
  );

  // ──────────────────────────────────────────────────────────────────────
  // Convex queries — mechanic-shop join + time slots for selected mechanic
  // ──────────────────────────────────────────────────────────────────────

  // Selected mechanic's shop_id is needed to query time slots. We resolve it
  // off the mechanic store (populated by `useMechanicsFromConvex` above) so
  // we don't pay a separate fetch.
  const selectedMechanic = selectedMechanicId ? getMechanicById(selectedMechanicId) : null;
  const selectedShopId = selectedMechanic?.shopId ?? null;
  const selectedShop = selectedShopId ? getShopById(selectedShopId) : null;

  // Time slots — fetched once a mechanic is chosen. Skip the query if the
  // mechanic store hasn't hydrated yet or the user hasn't selected a
  // mechanic.
  const isConvexShopId = selectedShopId !== null && selectedShopId.length > 10;
  const slots = useQuery(
    api.time_slots.getNextAvailableByShop,
    selectedMechanicId !== null && isConvexShopId
      ? {
          shopId: selectedShopId as Id<"shops">,
          mechanicId: selectedMechanicId as Id<"mechanics">,
          limit: 12,
        }
      : "skip",
  );

  const selectedSlot = useMemo(
    () => slots?.find((s: { _id: string }) => s._id === selectedSlotId) ?? null,
    [slots, selectedSlotId],
  );

  // ──────────────────────────────────────────────────────────────────────
  // Sorted mechanic list — applies the user's priority chip selection.
  //
  // TODO (multi-service intersection — handoff §1 fixup): when
  // `selectedIds.size > 1`, this should additionally filter to mechanics
  // whose shops offer ALL selected services. The shops_services join
  // doesn't have a server-side `getMechanicsForServices` helper yet, so
  // for now we trust Oto's prompt (which picks shops covering the slugs)
  // and surface every active mechanic. Booking creation will reject any
  // mechanic whose shop doesn't carry the chosen services. Backend
  // (Waleed's lane) needs a join query before we can hide them here.
  // ──────────────────────────────────────────────────────────────────────
  const sortedMechanics = useMemo(() => {
    const all = allMechanicsList
      .map((id) => getMechanicById(id))
      .filter((m): m is NonNullable<ReturnType<typeof getMechanicById>> => m !== undefined && m !== null);

    const arr = [...all];
    if (priority === "closest") {
      arr.sort((a, b) => (a.distanceMi ?? 0) - (b.distanceMi ?? 0));
    } else if (priority === "best_rated") {
      arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else {
      // best_price → labor rate ascending (lower is "better price").
      arr.sort((a, b) => {
        const aRate = getShopById(a.shopId)?.labor_rate ?? Number.POSITIVE_INFINITY;
        const bRate = getShopById(b.shopId)?.labor_rate ?? Number.POSITIVE_INFINITY;
        return aRate - bRate;
      });
    }
    return arr;
  }, [allMechanicsList, getMechanicById, getShopById, priority]);

  // ──────────────────────────────────────────────────────────────────────
  // Navigation helpers
  // ──────────────────────────────────────────────────────────────────────

  // Sub-stage 3 (diagnostic notes) is conditional: skip it if no diagnostic
  // scan is selected. advanceStage / retreatStage walk over the skipped step.
  const advanceStage = useCallback(() => {
    setStage((cur) => {
      const next = (cur + 1) as Stage;
      if (next === 3 && !hasDiagnostic) return 4;
      if (next > 6) return 6;
      return next;
    });
  }, [hasDiagnostic]);

  const retreatStage = useCallback(() => {
    setStage((cur) => {
      if (cur <= 1) return 1;
      const prev = (cur - 1) as Stage;
      if (prev === 3 && !hasDiagnostic) return 2;
      return prev;
    });
  }, [hasDiagnostic]);

  const jumpToStage = useCallback(
    (target: Stage) => {
      if (target === 3 && !hasDiagnostic) return;
      setStage(target);
    },
    [hasDiagnostic],
  );

  // ──────────────────────────────────────────────────────────────────────
  // Per-stage handlers
  // ──────────────────────────────────────────────────────────────────────

  const toggleServiceLocal = useCallback(
    (id: string) => {
      if (disabled) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      // If user removes a previously-selected mechanic-affecting service we
      // could invalidate the chosen slot, but the existing flow re-validates
      // at Book & Pay so we keep this simple.
    },
    [disabled],
  );

  const handleMechanicSelect = useCallback(
    (mechanicId: string) => {
      if (disabled) return;
      // Changing mechanic invalidates the previously chosen slot.
      if (mechanicId !== selectedMechanicId) {
        setSelectedSlotId(null);
      }
      setSelectedMechanicId(mechanicId);
    },
    [disabled, selectedMechanicId],
  );

  const handleBookAndPay = useCallback(() => {
    if (disabled || isSubmitting) return;
    if (!selectedMechanicId || !selectedSlot) return;

    // Resolve each selected local catalog service to its real Convex
    // `Id<"services">` by name match. We must never put a local-catalog
    // string into the booking store — the pay-screen's
    // `useCreateBookingConvex` filters availableServices by Convex `_id`
    // and a missing match throws "No services selected". If the Convex
    // services list hasn't hydrated yet, surface a clear inline error
    // and let the user retry once the data lands.
    const convexIdsToToggle: string[] = [];
    for (const s of selectedServiceOptions) {
      const convexMatch = availableConvexServices.find(
        (cs) => cs.name.trim().toLowerCase() === s.name.trim().toLowerCase(),
      );
      if (convexMatch) {
        convexIdsToToggle.push(convexMatch.id);
      }
    }

    if (convexIdsToToggle.length === 0) {
      setBookHandoffError(
        availableConvexServices.length === 0
          ? "Loading services — try again in a moment."
          : "Couldn't match those services to our catalog. Please pick from the list and try again.",
      );
      return;
    }

    setBookHandoffError(null);
    setIsSubmitting(true);

    // Mirror the existing handleBookNow flow (ai-chat/index.tsx:692-774) so
    // the pay-screen receives the booking store state it expects.

    // 1) Clear + re-toggle services into the booking-store's service IDs.
    clearSelectedServices();
    convexIdsToToggle.forEach((id) => toggleServiceSelection(id));

    // 2) Select mechanic.
    selectMechanic(selectedMechanicId);

    // 3) Stage the scheduled appointment from the chosen slot. `selectedSlot`
    //    is a canonical Convex `time_slots` row, so we have an ISO date +
    //    HH:MM start time directly.
    const isoDate = selectedSlot.date;
    const time = selectedSlot.start_time;
    const [yyyy, mm, dd] = isoDate.split("-");
    const displayDate = `${parseInt(dd, 10)} ${MONTH_LABELS[parseInt(mm, 10) - 1]} ${yyyy}`;
    setScheduledAppointment({
      date: isoDate,
      time,
      displayDate,
    });

    setBookingStage("payment", "forward");

    // 4) Tell the chat surface so it can record a fact for the next Oto turn.
    onBookAndPay?.(selectedMechanicId);

    // 5) Navigate. The pay-screen reads the booking store + creates the
    //    booking row via useCreateBookingConvex. Reset isSubmitting in a
    //    finally block — without this, the chat-message-mounted form
    //    stays stuck on "Booking…" forever after the user returns from
    //    the payment screen.
    try {
      router.push(`/booking/mechanic/${selectedMechanicId}/payment`);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    disabled,
    isSubmitting,
    selectedMechanicId,
    selectedSlot,
    selectedServiceOptions,
    availableConvexServices,
    clearSelectedServices,
    toggleServiceSelection,
    selectMechanic,
    setScheduledAppointment,
    setBookingStage,
    onBookAndPay,
    router,
  ]);

  // ──────────────────────────────────────────────────────────────────────
  // Footer button state (per stage)
  // ──────────────────────────────────────────────────────────────────────
  const footer = useMemo(() => {
    switch (stage) {
      case 1: {
        const count = selectedIds.size;
        return {
          enabled: count > 0,
          label:
            count === 0
              ? "Select services"
              : `Continue with ${count} service${count > 1 ? "s" : ""}`,
          onPress: advanceStage,
        };
      }
      case 2:
        return {
          enabled: true,
          label: "Continue to next step",
          onPress: advanceStage,
        };
      case 3: {
        // Diagnostic notes — both fields are optional but customerNotes is
        // strongly encouraged so we nudge the user with the button label.
        const notesPresent = customerNotes.trim().length > 0;
        return {
          enabled: true,
          label: notesPresent ? "Continue to mechanic" : "Skip notes, continue",
          onPress: advanceStage,
        };
      }
      case 4:
        return {
          enabled: selectedMechanicId !== null,
          label: selectedMechanicId === null ? "Pick a mechanic" : "Continue to time",
          onPress: advanceStage,
        };
      case 5:
        return {
          enabled: selectedSlotId !== null,
          label: selectedSlotId === null ? "Pick a time" : "Review booking",
          onPress: advanceStage,
        };
      case 6:
        return {
          enabled: !isSubmitting && selectedMechanicId !== null && selectedSlot !== null,
          label: isSubmitting ? "Booking…" : "Book & Pay",
          onPress: handleBookAndPay,
        };
    }
  }, [
    stage,
    selectedIds.size,
    customerNotes,
    selectedMechanicId,
    selectedSlotId,
    selectedSlot,
    isSubmitting,
    advanceStage,
    handleBookAndPay,
  ]);

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────

  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.container}>
      {/* Header — back arrow, title, dismiss */}
      <View style={styles.header}>
        {stage > 1 ? (
          <Pressable
            onPress={retreatStage}
            disabled={disabled}
            hitSlop={8}
            style={styles.headerIconButton}
          >
            <ArrowLeft size={18} color="#6B7280" strokeWidth={2} />
          </Pressable>
        ) : (
          <View style={styles.headerIconButton} />
        )}
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} weight="semiBold">
            {stageTitle(stage)}
          </Text>
          {headerSubtitle(
            stage,
            selectedServiceOptions,
            selectedMechanic?.name ?? null,
          ) ? (
            <Text style={styles.headerSubtitle} size="xs">
              {headerSubtitle(
                stage,
                selectedServiceOptions,
                selectedMechanic?.name ?? null,
              )}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onDismiss}
          disabled={disabled}
          hitSlop={8}
          style={styles.headerIconButton}
        >
          <X size={18} color="#6B7280" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Stepper */}
      <Stepper currentStage={stage} hasDiagnostic={hasDiagnostic} onJump={jumpToStage} />

      {/* Stage body — Animated.View wrapper keyed on the stage number so
          the body remounts + slides in from the right whenever the user
          advances. (Going back also re-triggers, which feels right —
          each stage entrance has a fresh sense of motion.) */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <Animated.View
          key={stage}
          entering={FadeInRight.duration(280).easing(Easing.out(Easing.cubic))}
        >
          {stage === 1 && (
            <Stage1Services
              selectedIds={selectedIds}
              onToggle={toggleServiceLocal}
              disabled={disabled}
            />
          )}
          {stage === 2 && <Stage2Options services={selectedServiceOptions} />}
          {stage === 3 && hasDiagnostic && (
            <Stage3Notes
              system={diagnosticSystem}
              notes={customerNotes}
              onSystemChange={setDiagnosticSystem}
              onNotesChange={setCustomerNotes}
              disabled={disabled}
            />
          )}
          {stage === 4 && (
            <Stage4Mechanic
              mechanics={sortedMechanics}
              priority={priority}
              onPriorityChange={setPriority}
              selectedMechanicId={selectedMechanicId}
              onSelect={handleMechanicSelect}
              recommendedMechanicId={payload.recommended_mechanic_id}
              getShopName={(id) => getShopById(id)?.name ?? null}
              disabled={disabled}
            />
          )}
          {stage === 5 && (
            <Stage5Time
              slots={slots ?? []}
              isLoading={slots === undefined && selectedMechanicId !== null}
              mechanicSelected={selectedMechanicId !== null}
              selectedSlotId={selectedSlotId}
              onSelect={setSelectedSlotId}
              disabled={disabled}
            />
          )}
          {stage === 6 && (
            <Stage6Confirm
              services={selectedServiceOptions}
              hasDiagnostic={hasDiagnostic}
              diagnosticSystem={diagnosticSystem}
              customerNotes={customerNotes}
              mechanicName={selectedMechanic ? selectedMechanic.name : null}
              shopName={selectedShop?.name ?? null}
              laborRate={selectedShop?.labor_rate ?? null}
              slotIsoDate={selectedSlot?.date ?? null}
              slotStartTime={selectedSlot?.start_time ?? null}
              onJump={jumpToStage}
            />
          )}
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {bookHandoffError && stage === 6 ? (
          <View style={styles.handoffError}>
            <Text style={styles.handoffErrorText} weight="medium">
              {bookHandoffError}
            </Text>
          </View>
        ) : null}
        <Pressable
          onPress={footer.onPress}
          disabled={!footer.enabled || disabled}
          style={({ pressed }) => [
            styles.footerButton,
            footer.enabled && styles.footerButtonEnabled,
            pressed && footer.enabled && styles.footerButtonPressed,
            (!footer.enabled || disabled) && styles.footerButtonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator
              color={BrandColors.white}
              size="small"
              style={styles.footerSpinner}
            />
          ) : null}
          <Text
            style={[styles.footerButtonText, footer.enabled && styles.footerButtonTextEnabled]}
            weight="semiBold"
          >
            {footer.label}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// STEPPER
// ============================================================================

function Stepper({
  currentStage,
  hasDiagnostic,
}: {
  currentStage: Stage;
  hasDiagnostic: boolean;
  // Kept on the prop list for API stability; the new stepper is read-only.
  onJump?: (s: Stage) => void;
}) {
  // Skipping stage 3 when there's no diagnostic keeps the user's mental
  // count honest — they see "Step 4 of 5" instead of jumping 2→4 of 6.
  const stages: Stage[] = hasDiagnostic ? [1, 2, 3, 4, 5, 6] : [1, 2, 4, 5, 6];
  const totalSteps = stages.length;
  const currentIndex = Math.max(0, stages.indexOf(currentStage));
  // Always fill at least a sliver so step 1 doesn't look empty.
  const targetWidth = ((currentIndex + 1) / totalSteps) * 100;

  const widthSV = useSharedValue(targetWidth);
  useEffect(() => {
    widthSV.value = withTiming(targetWidth, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [targetWidth, widthSV]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${widthSV.value}%`,
  }));

  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel} weight="semiBold">
        Step {currentIndex + 1} of {totalSteps}
      </Text>
      <View style={styles.stepperTrack}>
        <Animated.View style={[styles.stepperFill, barStyle]} />
      </View>
    </View>
  );
}

function stageTitle(stage: Stage): string {
  switch (stage) {
    case 1:
      return "Select services";
    case 2:
      return "Service options";
    case 3:
      return "What's going on?";
    case 4:
      return "Choose a mechanic";
    case 5:
      return "Pick a time";
    case 6:
      return "Review & book";
  }
}

// Dynamic subtitle that updates as the user makes selections, giving
// per-stage context under the title without adding chrome.
function headerSubtitle(
  stage: Stage,
  services: ServiceOption[],
  mechanicName: string | null,
): string | null {
  const count = services.length;
  switch (stage) {
    case 1:
      return null;
    case 2:
    case 3:
      return count > 0
        ? `${count} service${count === 1 ? "" : "s"} selected`
        : null;
    case 4:
      return count > 0
        ? `${count} service${count === 1 ? "" : "s"} · pick who works on it`
        : null;
    case 5:
      return mechanicName ? `Mechanic: ${mechanicName}` : null;
    case 6:
      return "Final review";
  }
}

// ============================================================================
// STAGE 1 — Service selection
// ============================================================================

function Stage1Services({
  selectedIds,
  onToggle,
  disabled,
}: {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.stageBody}>
      <Text style={styles.helperText} size="sm">
        Pre-checked from our chat. Add or remove anything that should ride
        along — bundling saves a shop trip.
      </Text>
      <View style={styles.serviceList}>
        {DEFAULT_SERVICES.map((s, i) => {
          const selected = selectedIds.has(s.id);
          const IconComponent = SERVICE_ICONS[s.id] ?? Wrench;
          return (
            <Animated.View key={s.id} entering={FadeInUp.delay(i * 20).duration(160)}>
              <Pressable
                onPress={() => onToggle(s.id)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.serviceRow,
                  selected && styles.serviceRowSelected,
                  pressed && !disabled && styles.serviceRowPressed,
                ]}
              >
                <View style={styles.serviceIconWrap}>
                  <IconComponent
                    size={18}
                    color={BrandColors.secondary}
                    strokeWidth={2}
                  />
                </View>
                <View style={styles.serviceRowInfo}>
                  <Text
                    style={[styles.serviceName, selected && styles.serviceNameSelected]}
                    weight="semiBold"
                  >
                    {s.name}
                  </Text>
                  <Text style={styles.serviceDescription} size="sm">
                    {s.description}
                  </Text>
                </View>
                <View style={styles.serviceRowMeta}>
                  <Text style={styles.serviceDuration} size="xs">
                    {s.duration}
                  </Text>
                </View>
                <View
                  style={[styles.selectionCircle, selected && styles.selectionCircleSelected]}
                >
                  {selected && <Check size={11} color={BrandColors.white} strokeWidth={3} />}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

// ============================================================================
// STAGE 2 — Per-service options (summary; defaults used for V1)
// ============================================================================

function Stage2Options({ services }: { services: ServiceOption[] }) {
  return (
    <View style={styles.stageBody}>
      <Text style={styles.helperText} size="sm">
        Standard parts and labor are used by default. The mechanic confirms
        specifics (oil grade, tire size, brake pad type) at drop-off.
      </Text>
      <View style={styles.serviceList}>
        {services.map((s, i) => (
          <Animated.View
            key={s.id}
            entering={FadeInUp.delay(i * 25).duration(160)}
            style={styles.optionsRow}
          >
            <View style={styles.serviceRowInfo}>
              <Text style={styles.serviceName} weight="semiBold">
                {s.name}
              </Text>
              <Text style={styles.serviceDescription} size="sm">
                Standard parts · ~{s.duration}
              </Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ============================================================================
// STAGE 3 — Diagnostic notes (system + notes)
// ============================================================================

function Stage3Notes({
  system,
  notes,
  onSystemChange,
  onNotesChange,
  disabled,
}: {
  system: DiagnosticSystem;
  notes: string;
  onSystemChange: (s: DiagnosticSystem) => void;
  onNotesChange: (n: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.stageBody}>
      <Text style={styles.helperText} size="sm">
        What system feels off? Share a couple of sentences about the symptom
        — the mechanic uses this as the starting point.
      </Text>

      <Text style={styles.sectionLabel} size="xs" weight="semiBold">
        System
      </Text>
      <View style={styles.systemRow}>
        {SYSTEMS.map((opt) => {
          const active = opt.value === system;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onSystemChange(opt.value)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.systemPill,
                active && styles.systemPillActive,
                pressed && !disabled && styles.systemPillPressed,
              ]}
            >
              <Text
                style={[styles.systemPillText, active && styles.systemPillTextActive]}
                size="sm"
                weight={active ? "semiBold" : "medium"}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel} size="xs" weight="semiBold">
        Customer notes
      </Text>
      <TextInput
        value={notes}
        onChangeText={onNotesChange}
        editable={!disabled}
        multiline
        placeholder="e.g. grinding noise from the front-left when braking, started this week"
        placeholderTextColor="#A0AEC0"
        style={styles.notesInput}
      />
    </View>
  );
}

// ============================================================================
// STAGE 4 — Mechanic selection
// ============================================================================

function Stage4Mechanic({
  mechanics,
  priority,
  onPriorityChange,
  selectedMechanicId,
  onSelect,
  recommendedMechanicId,
  getShopName,
  disabled,
}: {
  mechanics: Array<{
    id: string;
    name: string;
    title?: string;
    shopId: string;
    rating: number;
    reviewCount?: number;
    distanceMi: number;
  }>;
  priority: Priority;
  onPriorityChange: (p: Priority) => void;
  selectedMechanicId: string | null;
  onSelect: (id: string) => void;
  recommendedMechanicId?: string;
  getShopName: (id: string) => string | null;
  disabled: boolean;
}) {
  const distanceUnit = useDistanceUnit();

  return (
    <View style={styles.stageBody}>
      <Text style={styles.helperText} size="sm">
        {"Sorted by your preference. Oto's pick is highlighted; you can pick any mechanic."}
      </Text>

      <View style={styles.priorityRow}>
        {PRIORITY_OPTIONS.map((opt) => {
          const active = opt.value === priority;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onPriorityChange(opt.value)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.priorityPill,
                active && styles.priorityPillActive,
                pressed && !disabled && styles.priorityPillPressed,
              ]}
            >
              <Text
                style={[styles.priorityPillText, active && styles.priorityPillTextActive]}
                size="sm"
                weight={active ? "semiBold" : "medium"}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.mechanicList}>
        {mechanics.length === 0 ? (
          <Text style={styles.emptyState} size="sm">
            Loading mechanics…
          </Text>
        ) : (
          mechanics.map((m, i) => {
            const selected = m.id === selectedMechanicId;
            const recommended = recommendedMechanicId !== undefined && m.id === recommendedMechanicId;
            const shopName = getShopName(m.shopId);
            const initials = m.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? "")
              .join("");
            const distanceLabel =
              m.distanceMi > 0 ? formatProximityDistanceFromMiles(m.distanceMi, distanceUnit) : null;
            return (
              <Animated.View key={m.id} entering={FadeInUp.delay(i * 20).duration(160)}>
                <Pressable
                  onPress={() => onSelect(m.id)}
                  disabled={disabled}
                  style={({ pressed }) => [
                    styles.mechanicRow,
                    selected && styles.mechanicRowSelected,
                    recommended && !selected && styles.mechanicRowRecommended,
                    pressed && !disabled && styles.mechanicRowPressed,
                  ]}
                >
                  {recommended ? (
                    <View style={styles.otoPickBadge}>
                      <Star
                        size={10}
                        color="#92400E"
                        fill="#92400E"
                        strokeWidth={0}
                      />
                      <Text style={styles.otoPickBadgeText} weight="semiBold">
                        {"Oto's Pick"}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.mechanicAvatar}>
                    <Text style={styles.mechanicAvatarText} weight="semiBold">
                      {initials || "M"}
                    </Text>
                  </View>
                  <View style={styles.mechanicInfo}>
                    <Text
                      style={[styles.mechanicName, selected && styles.mechanicNameSelected]}
                      weight="semiBold"
                    >
                      {m.name}
                    </Text>
                    {shopName ? (
                      <Text style={styles.mechanicShop} size="sm">
                        {shopName}
                      </Text>
                    ) : null}
                    <View style={styles.mechanicMetaRow}>
                      <Star size={11} color="#F59E0B" fill="#F59E0B" />
                      <Text style={styles.mechanicMetaSmall} size="xs">
                        {(m.rating ?? 0).toFixed(1)}
                        {m.reviewCount !== undefined ? ` (${m.reviewCount})` : ""}
                      </Text>
                      {m.title ? (
                        <>
                          <Text style={styles.mechanicMetaDot} size="xs">
                            ·
                          </Text>
                          <Text style={styles.mechanicMetaSmall} size="xs">
                            {m.title}
                          </Text>
                        </>
                      ) : null}
                      {distanceLabel ? (
                        <>
                          <Text style={styles.mechanicMetaDot} size="xs">
                            ·
                          </Text>
                          <Text style={styles.mechanicMetaSmall} size="xs">
                            {distanceLabel}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <View
                    style={[styles.selectionCircle, selected && styles.selectionCircleSelected]}
                  >
                    {selected && <Check size={11} color={BrandColors.white} strokeWidth={3} />}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })
        )}
      </View>
    </View>
  );
}

// ============================================================================
// STAGE 5 — Time slot
// ============================================================================

function Stage5Time({
  slots,
  isLoading,
  mechanicSelected,
  selectedSlotId,
  onSelect,
  disabled,
}: {
  slots: Array<{ _id: string; date: string; start_time: string }>;
  isLoading: boolean;
  mechanicSelected: boolean;
  selectedSlotId: string | null;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  if (!mechanicSelected) {
    return (
      <View style={styles.stageBody}>
        <Text style={styles.emptyState} size="sm">
          Pick a mechanic first to see their availability.
        </Text>
      </View>
    );
  }
  if (isLoading) {
    return (
      <View style={styles.stageBody}>
        <Text style={styles.emptyState} size="sm">
          Loading availability…
        </Text>
      </View>
    );
  }
  if (slots.length === 0) {
    return (
      <View style={styles.stageBody}>
        <Text style={styles.emptyState} size="sm">
          No open slots in the next few days. Try a different mechanic.
        </Text>
      </View>
    );
  }

  // Group by date so the user can scan days.
  const byDate = new Map<string, typeof slots>();
  for (const s of slots) {
    const arr = byDate.get(s.date) ?? [];
    arr.push(s);
    byDate.set(s.date, arr);
  }

  return (
    <View style={styles.stageBody}>
      <Text style={styles.helperText} size="sm">
        Tap a time to reserve it. Shorter slots come up first.
      </Text>
      {Array.from(byDate.entries()).map(([date, daySlots]) => {
        const [yyyy, mm, dd] = date.split("-");
        const label = `${parseInt(dd, 10)} ${MONTH_LABELS[parseInt(mm, 10) - 1]} ${yyyy}`;
        return (
          <View key={date} style={styles.dayBlock}>
            <Text style={styles.dayLabel} size="xs" weight="semiBold">
              {label}
            </Text>
            <View style={styles.slotRow}>
              {daySlots.map((s) => {
                const active = s._id === selectedSlotId;
                return (
                  <Pressable
                    key={s._id}
                    onPress={() => onSelect(s._id)}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.slotChip,
                      active && styles.slotChipActive,
                      pressed && !disabled && styles.slotChipPressed,
                    ]}
                  >
                    <Clock size={11} color={active ? BrandColors.secondary : "#6B7280"} />
                    <Text
                      style={[styles.slotChipText, active && styles.slotChipTextActive]}
                      size="xs"
                      weight={active ? "semiBold" : "medium"}
                    >
                      {displayHHMM(s.start_time)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ============================================================================
// STAGE 6 — Review & confirm
// ============================================================================

function Stage6Confirm({
  services,
  hasDiagnostic,
  diagnosticSystem,
  customerNotes,
  mechanicName,
  shopName,
  laborRate,
  slotIsoDate,
  slotStartTime,
  onJump,
}: {
  services: ServiceOption[];
  hasDiagnostic: boolean;
  diagnosticSystem: DiagnosticSystem;
  customerNotes: string;
  mechanicName: string | null;
  shopName: string | null;
  laborRate: number | null;
  slotIsoDate: string | null;
  slotStartTime: string | null;
  onJump: (s: Stage) => void;
}) {
  const slotLabel = useMemo(() => {
    if (!slotIsoDate || !slotStartTime) return "—";
    const [yyyy, mm, dd] = slotIsoDate.split("-");
    return `${parseInt(dd, 10)} ${MONTH_LABELS[parseInt(mm, 10) - 1]} ${yyyy} at ${displayHHMM(slotStartTime)}`;
  }, [slotIsoDate, slotStartTime]);

  const systemLabel = SYSTEMS.find((s) => s.value === diagnosticSystem)?.label ?? "—";

  return (
    <View style={styles.stageBody}>
      <Text style={styles.helperText} size="sm">
        Final review. Tap any row to edit. Payment confirms on the next screen.
      </Text>

      {/* Hero card — shop + mechanic + appointment all at-a-glance. */}
      <View style={styles.reviewHero}>
        <View style={styles.reviewHeroHeader}>
          <View style={styles.reviewHeroIconWrap}>
            <Wrench size={18} color={BrandColors.secondary} strokeWidth={2} />
          </View>
          <View style={styles.reviewHeroText}>
            <Text style={styles.reviewHeroShop} weight="semiBold" numberOfLines={1}>
              {shopName ?? "Service center"}
            </Text>
            {mechanicName ? (
              <Text style={styles.reviewHeroMechanic} size="sm">
                with {mechanicName}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.reviewHeroDivider} />
        <View style={styles.reviewHeroFooter}>
          <Calendar size={14} color="#6B7280" strokeWidth={2} />
          <Text style={styles.reviewHeroDate} size="sm" weight="medium">
            {slotLabel}
          </Text>
        </View>
      </View>

      {/* Unified summary card — internal dividers between rows. */}
      <View style={styles.reviewSummaryCard}>
        <ReviewSummaryRow
          label="Services"
          value={services.map((s) => s.name).join(" · ") || "—"}
          onEdit={() => onJump(1)}
        />
        {hasDiagnostic && (
          <ReviewSummaryRow
            label="Diagnostic system"
            value={systemLabel}
            onEdit={() => onJump(3)}
            divider
          />
        )}
        {hasDiagnostic && customerNotes.trim() && (
          <ReviewSummaryRow
            label="Notes"
            value={customerNotes.trim()}
            onEdit={() => onJump(3)}
            divider
          />
        )}
        <ReviewSummaryRow
          label="Labor rate"
          value={
            laborRate !== null ? `$${laborRate.toFixed(0)}/hr (shop posted)` : "—"
          }
          divider
        />
      </View>

      <Text style={styles.disclaimer} size="xs">
        {"Final total is calculated on the payment screen from the shop's posted labor rate and parts estimate."}
      </Text>
    </View>
  );
}

function ReviewSummaryRow({
  label,
  value,
  onEdit,
  divider,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
  divider?: boolean;
}) {
  return (
    <View>
      {divider ? <View style={styles.reviewSummaryDivider} /> : null}
      <View style={styles.reviewSummaryRow}>
        <View style={styles.reviewRowText}>
          <Text style={styles.reviewLabel} size="xs" weight="semiBold">
            {label}
          </Text>
          <Text style={styles.reviewValue} size="sm">
            {value}
          </Text>
        </View>
        {onEdit && (
          <Pressable
            onPress={onEdit}
            hitSlop={6}
            style={({ pressed }) => [
              styles.reviewEditIcon,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Pencil size={14} color="#9CA3AF" strokeWidth={2} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function displayHHMM(hhmm: string): string {
  // "13:30" → "1:30 PM"
  const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

// ============================================================================
// STYLES
// ============================================================================

// Color palette is shared with AIDiagnosticForm so the consolidated booking
// surface reads as "more of the same flow" instead of a new bolt-on.
//
//   bg outer       — rgba(255,255,255,0.6)           — the suggestion-pill
//                                                       faded white
//   bg inner card  — BrandColors.white                — solid white inset
//   bg selected    — BrandColors.secondary + "15"     — light blue tint
//   border idle    — #E5E7EB                          — subtle gray hairline
//   border select  — BrandColors.secondary            — blue accent
//   text strong    — BrandColors.primary (#141C24)    — headers
//   text body      — #374151                          — default copy
//   text meta      — #6B7280                          — secondary copy
//   text dim       — #9CA3AF                          — tertiary copy
//   text accent    — BrandColors.secondary (#5299FE)  — selected / links
//
const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  headerIconButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  headerTitle: {
    color: BrandColors.primary,
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    textAlign: "center",
  },
  headerSubtitle: {
    color: "#6B7280",
    fontSize: 11,
    textAlign: "center",
  },
  // Progress strip — visible "Step X of Y" label + filling bar.
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  stepperLabel: {
    fontSize: 13,
    color: BrandColors.primary,
    fontFamily: FontFamily.semiBold,
  },
  stepperTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 2,
    overflow: "hidden",
  },
  stepperFill: {
    height: "100%",
    backgroundColor: BrandColors.secondary,
    borderRadius: 2,
  },
  // Body
  body: {
    maxHeight: 380,
  },
  bodyContent: {
    paddingBottom: Spacing.md,
  },
  stageBody: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  helperText: {
    color: "#6B7280",
    lineHeight: 18,
  },
  sectionLabel: {
    color: BrandColors.primary,
    marginTop: Spacing.sm,
    fontSize: 13,
  },
  emptyState: {
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
  // Service rows (stage 1)
  serviceList: {
    gap: Spacing.xs,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: Spacing.sm + 2,
  },
  serviceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.secondary + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceRowSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: BrandColors.secondary + "0D", // ~5% tint, very soft
  },
  serviceRowPressed: {
    backgroundColor: "#F9FAFB",
  },
  serviceRowInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  serviceRowMeta: {
    alignItems: "flex-end",
    marginRight: Spacing.sm,
  },
  serviceName: {
    color: BrandColors.primary,
    fontSize: 14,
    lineHeight: 18,
  },
  serviceNameSelected: {
    color: BrandColors.secondary,
  },
  serviceDescription: {
    color: "#6B7280",
    marginTop: 2,
    lineHeight: 16,
  },
  serviceDuration: {
    color: "#9CA3AF",
  },
  // Options (stage 2)
  optionsRow: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  // System pills (stage 3) — light tint when active; never solid-fill
  systemRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  systemPill: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  systemPillActive: {
    backgroundColor: BrandColors.secondary + "15",
    borderColor: BrandColors.secondary,
  },
  systemPillPressed: {
    opacity: 0.85,
  },
  systemPillText: {
    color: "#6B7280",
  },
  systemPillTextActive: {
    color: BrandColors.secondary,
  },
  // Notes input
  notesInput: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: 88,
    textAlignVertical: "top",
    color: BrandColors.primary,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  // Priority chips (stage 4) — match service-picker category-tab style
  priorityRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  priorityPill: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  priorityPillActive: {
    backgroundColor: BrandColors.secondary + "15",
    borderColor: BrandColors.secondary,
  },
  priorityPillPressed: {
    opacity: 0.85,
  },
  priorityPillText: {
    color: "#6B7280",
  },
  priorityPillTextActive: {
    color: BrandColors.secondary,
  },
  // Mechanic rows (stage 4) — same card pattern as the deleted carousel
  mechanicList: {
    gap: Spacing.xs,
  },
  mechanicRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    paddingTop: Spacing.md + 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: Spacing.md,
  },
  mechanicRowSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: BrandColors.secondary + "0D",
  },
  mechanicRowRecommended: {
    borderColor: "#FACC15",
    backgroundColor: "#FFFBEB",
  },
  mechanicRowPressed: {
    backgroundColor: "#F9FAFB",
  },
  mechanicAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BrandColors.secondary + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  mechanicAvatarText: {
    color: BrandColors.secondary,
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
  },
  mechanicInfo: {
    flex: 1,
    marginRight: Spacing.sm,
    gap: 2,
  },
  mechanicName: {
    color: BrandColors.primary,
    fontSize: 15,
    lineHeight: 20,
  },
  mechanicNameSelected: {
    color: BrandColors.secondary,
  },
  mechanicShop: {
    color: "#374151",
    fontSize: 13,
    lineHeight: 16,
  },
  mechanicMeta: {
    color: "#6B7280",
    marginTop: 2,
    lineHeight: 16,
  },
  mechanicMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    flexWrap: "wrap",
  },
  mechanicMetaSmall: {
    color: "#6B7280",
  },
  mechanicMetaDot: {
    color: "#D1D5DB",
    marginHorizontal: 1,
  },
  // Oto's Pick badge — gold, top-right, sits over the row's top border.
  otoPickBadge: {
    position: "absolute",
    top: -8,
    right: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    borderRadius: BorderRadius.full,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#FACC15",
    zIndex: 1,
  },
  otoPickBadgeText: {
    color: "#92400E",
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.3,
  },
  // Time slots (stage 5) — chip styling mirrors carousel slot pattern
  dayBlock: {
    gap: Spacing.xs,
  },
  dayLabel: {
    color: BrandColors.primary,
    marginTop: Spacing.xs,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  slotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  slotChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  slotChipActive: {
    backgroundColor: BrandColors.secondary + "15",
    borderColor: BrandColors.secondary,
  },
  slotChipPressed: {
    opacity: 0.85,
  },
  slotChipText: {
    color: "#6B7280",
  },
  slotChipTextActive: {
    color: BrandColors.secondary,
  },
  // Review (stage 6)
  reviewHero: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: Spacing.sm,
  },
  reviewHeroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm + 2,
  },
  reviewHeroIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BrandColors.secondary + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewHeroText: {
    flex: 1,
    gap: 2,
  },
  reviewHeroShop: {
    fontSize: 16,
    color: BrandColors.primary,
    lineHeight: 20,
  },
  reviewHeroMechanic: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 16,
  },
  reviewHeroDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  reviewHeroFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs + 2,
  },
  reviewHeroDate: {
    color: BrandColors.primary,
    fontSize: 13,
  },
  reviewSummaryCard: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  reviewSummaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  reviewSummaryDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginHorizontal: Spacing.md,
  },
  reviewRowText: {
    flex: 1,
    gap: 2,
  },
  reviewLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reviewValue: {
    color: BrandColors.primary,
    lineHeight: 18,
  },
  reviewEditIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  disclaimer: {
    color: "#9CA3AF",
    marginTop: Spacing.xs,
    lineHeight: 16,
    textAlign: "center",
  },
  // Selection circle (stage 1 service rows + stage 4 mechanic rows)
  selectionCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionCircleSelected: {
    backgroundColor: BrandColors.secondary,
    borderColor: BrandColors.secondary,
  },
  // Footer — primary CTA, pill shape (matches AIDiagnosticForm)
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.05)",
  },
  handoffError: {
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: "rgba(254, 226, 226, 0.85)",
    borderRadius: BorderRadius.md,
  },
  handoffErrorText: {
    fontSize: 12,
    color: "#B91C1C",
    fontFamily: FontFamily.medium,
    textAlign: "center",
  },
  footerButton: {
    backgroundColor: "#E4E7EC",
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  footerSpinner: {
    // Aligns the spinner vertically with the label text on the row.
  },
  footerButtonEnabled: {
    backgroundColor: BrandColors.secondary,
  },
  footerButtonPressed: {
    opacity: 0.9,
  },
  footerButtonDisabled: {
    opacity: 1,
  },
  footerButtonText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  footerButtonTextEnabled: {
    color: BrandColors.white,
  },
});
