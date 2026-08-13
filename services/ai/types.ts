/**
 * AI Chat Types
 *
 * PURPOSE: Type definitions for the AI scenario-based chat system
 *
 * USED IN:
 *   - services/ai/scenarioEngine.ts
 *   - services/ai/scenarios.ts
 *   - components/ai-chat/*.tsx
 *   - app/(main-tabs)/ai-chat/index.tsx
 *
 * EXPORTS:
 *   - ConversationStage - Stage type union
 *   - ScenarioType - Scenario type union
 *   - ChatMessage - Message object interface
 *   - ConversationState - Full conversation state interface
 *   - ScenarioResponse - AI response interface
 *   - AIMechanic, TimeSlot, SelectedService, etc.
 *
 * OWNER: Waleed Mansour
 */

import type { ReasoningStep } from "@/components/ai-chat/AIReasoning";
import type { Source } from "@/components/ai-chat/AISources";
import type { QuickReply } from "@/components/ai-chat/AIQuickReplies";
import type { Suggestion } from "@/components/ai-chat/PromptSuggestions";
import type { Shop as StoreShop, Mechanic, MechanicAvailabilitySlot } from "@/stores/types/store.types";
import type { DiagnosticSystem } from "@/lib/diagnostic-checklist-templates";
import type { MaintenanceType } from "@/utils/maintenanceStatus";

// ============================================================================
// CONVERSATION STAGES
// ============================================================================

export type ConversationStage =
  | "welcome"
  | "diagnosis"
  | "question"
  | "service_selection"
  | "diagnostic_form"
  | "priority_selection"
  | "shop_selection"
  | "time_selection"
  | "confirmation"
  | "success";

// ============================================================================
// SCENARIO TYPES
// ============================================================================

export type ScenarioType =
  | "oil_change"
  | "brake_noise"
  | "check_engine"
  | "tire_pressure"
  | "vague_issue"
  | "direct_booking"
  | "new_vehicle";

// ============================================================================
// RE-EXPORT STORE TYPES FOR CONVENIENCE
// ============================================================================

export type { Shop as StoreShop, Mechanic, MechanicAvailabilitySlot } from "@/stores/types/store.types";

// ============================================================================
// MECHANIC & TIME TYPES (Extended for AI Chat)
// ============================================================================

export interface AIMechanic {
  id: number;
  name: string;
  shopName: string;
  address: string;
  rating: number;
  isVerified: boolean;
  photoUrl: string | null;
  distanceMi: number;
  services: string[];
  yearsExperience: number;
  isAvailable: boolean;
  responseTime: "Quick" | "Normal" | "Slow";
  availability: number;
  nextAvailability: Array<{
    dayOfWeek: string;
    day: string;
    time: string;
  }>;
  price?: string;
}

// Legacy alias for backward compatibility
export type AIShop = AIMechanic;

export interface TimeSlot {
  id: string;
  day: string;
  time: string;
  displayText: string;
  dayOfWeek?: string;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface MessageSection {
  title: string;
  content: string;
  type: "text" | "list";
  items?: string[];
}

export interface SelectedService {
  id: string;
  name: string;
  estimatedPrice: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  // Attached images (URIs)
  images?: string[];
  // Enhanced properties for AI messages
  reasoning?: ReasoningStep[];
  sources?: Source[];
  quickReplies?: QuickReply[];
  sections?: MessageSection[];
  isStreaming?: boolean;
  // Record confirmation prompt — Oto fires this when a user-described symptom
  // contradicts a self_reported maintenance_record. Component shows the
  // record's stated state and offers Confirm / Update buttons. Trigger-only:
  // the component queries Convex directly for the record contents.
  // See: convex/oto/tools.ts → render_record_confirmation.
  showRecordConfirmation?: {
    vehicle_id: string; // vehicles._id
    maintenance_type: MaintenanceType;
  };
  // Sprint 4 Day 1 Pass B — render_book_service. Single terminal booking
  // render — mobile BookServiceComponent drives every sub-stage internally
  // (service select → options → notes → mechanic → time → review → pay).
  // See: docs/SPRINT_4_FRONTEND_BOOK_SERVICE_TICKET.md, convex/oto/dispatcher.ts.
  bookService?: BookServicePayload;
  // Sprint 3 Day 2 §14.1 — tap-to-redirect to one of 9 in-app destinations.
  linkButton?: LinkButtonPayload;
  // Sprint 3 Day 5 §14.3 — single booking detail card. Trigger-only: the
  // mobile component queries Convex for the booking row.
  bookingCard?: { booking_id: string };
  // Sprint 3 Day 5 §14.3 — multi-booking list card. Trigger-only.
  bookingsList?: { booking_ids: string[] };
  // render_vehicle_update — vehicle-truth confirm card. Oto fires this when the
  // user states a mileage reading, a named fault light, and/or a service they
  // report due/done. The card writes via vehicleTruth.applyVehicleTruth on
  // confirm. See: convex/oto/tools.ts → render_vehicle_update.
  showVehicleUpdate?: VehicleUpdatePayload;
  // Metadata
  scenarioType?: ScenarioType;
  stage?: ConversationStage;
}

// render_vehicle_update — payload for the Vehicle-Update Confirm card.
// Backend (convex/oto/dispatcher.ts → renderD("showVehicleUpdate", …)) carries
// only the captured truth; `vehicle_id` is stamped on the frontend from the
// active chat vehicle (mirrors how BookServicePayload resolves its vehicle).
export interface VehicleUpdatePayload {
  // vehicles._id — resolved on the frontend, not present in the backend payload.
  vehicle_id: string;
  // CURRENT odometer reading the user stated this turn.
  mileage?: number;
  // Services the user reported. "due"/"light_on" FLAG the service; "completed"
  // RECORDS it done (clears the flag). For a PAST "completed" service, the
  // optional anchors say WHEN / at-what-mileage it was done so the maintenance
  // pipeline re-anchors the due clock to then (not today):
  //   service_mileage  — the service's own odometer ("at 89,000")
  //   service_age_days — days ago ("a week ago" → 7), server-resolved to now − days
  //   service_date     — absolute ms timestamp (wins over service_age_days)
  service_claims?: {
    service_slug: string;
    kind: "due" | "light_on" | "completed";
    service_mileage?: number;
    service_age_days?: number;
    service_date?: number;
    // W4.3 (QA K3) — "hedged" when the user signalled uncertainty ("I think…",
    // "pretty sure…", "like 6 months ago?"). Absent = "certain". Hedged
    // completed claims are written with a softer confidence label server-side
    // and the card shows an explicit "you weren't sure" qualifier.
    stated_confidence?: "certain" | "hedged";
  }[];
  // Named warning lights (e.g. ["check_engine"]).
  fault_lights?: string[];
}

// Sprint 4 Day 1 Pass B — payload for `render_book_service` AI tool.
// Backend produces this via convex/oto/dispatcher.ts → renderD("bookService", …).
// `vehicle_id` is resolved on the frontend from the anchored chat vehicle
// (one-chat-one-car per Sprint 3 Day 4 §15.12), not from this payload.
export interface BookServicePayload {
  // ≥1. Multi-service bundling supported (e.g. ["oil_change","tire_rotation"]).
  service_slugs: string[];
  // Present iff one of the slugs is "diagnostic_scan".
  diagnostic_system?:
    | "brakes"
    | "tires_wheels"
    | "engine"
    | "battery_electrical"
    | "not_sure";
  // 2-3 sentence service-advisor summary. Present iff diagnostic OR Oto has
  // narrowing context worth anchoring.
  customer_notes?: string;
  // Default mechanic-sort order for sub-stage 4 (mechanic selection).
  recommended_priority?: "closest" | "best_rated" | "best_price";
  // Pre-selected mechanic for sub-stage 4 (e.g. user's preferred mechanic).
  recommended_mechanic_id?: string;
}

// Sprint 3 Day 2 §14.1 — payload for `render_link_button`. 9 destinations.
// Backend produces this via convex/oto/dispatcher.ts → renderD("linkButton", …).
export type LinkButtonDestination =
  | "terms_of_service"
  | "privacy_policy"
  | "settings"
  | "profile"
  | "transaction_history"
  | "customer_support"
  | "feedback"
  | "bug_report"
  | "vehicle_onboarding";

export interface LinkButtonPayload {
  destination: LinkButtonDestination;
  // Optional CTA override. When absent, the component picks a default label
  // for the destination.
  label?: string;
}

// ============================================================================
// CONVERSATION STATE
// ============================================================================

export interface ConversationState {
  currentStage: ConversationStage;
  currentScenario: ScenarioType | null;
  messages: ChatMessage[];
  // Selection state
  selectedPriority: string | null;
  selectedShop: AIShop | null;
  selectedTime: TimeSlot | null;
  selectedServices: SelectedService[];
  // Service details
  serviceName: string | null;
  servicePrice: string | null;
  // Diagnostic form state — persists for the rest of the conversation so the
  // AI can reference back to the user's confirmed subsystem and notes.
  selectedDiagnosticSystem?: DiagnosticSystem;
  diagnosticNotes?: string;
  // UI state
  isProcessing: boolean;
  suggestions: Suggestion[];
}

// ============================================================================
// SCENARIO RESPONSE
// ============================================================================

export interface ScenarioResponse {
  message: string;
  reasoning?: ReasoningStep[];
  sources?: Source[];
  quickReplies?: QuickReply[];
  sections?: MessageSection[];
  nextStage: ConversationStage;
  suggestions: Suggestion[];
  // Optional data for specific stages
  shops?: AIShop[];
  timeSlots?: TimeSlot[];
  showServicePicker?: boolean;
  showDiagnosticForm?: {
    initialSystem?: DiagnosticSystem;
    initialNotes?: string;
  };
  showRecordConfirmation?: {
    vehicle_id: string;
    maintenance_type: MaintenanceType;
  };
}

// ============================================================================
// SCENARIO DEFINITION
// ============================================================================

export interface ScenarioStep {
  stage: ConversationStage;
  getMessage: (state: ConversationState, userInput?: string) => ScenarioResponse;
}

export interface Scenario {
  type: ScenarioType;
  triggers: string[];
  steps: ScenarioStep[];
}

// ============================================================================
// BOOKING SUMMARY
// ============================================================================

export interface BookingSummary {
  serviceName: string;
  servicePrice: string;
  platformFee: string;
  total: string;
  shop: AIShop;
  timeSlot: TimeSlot;
}
