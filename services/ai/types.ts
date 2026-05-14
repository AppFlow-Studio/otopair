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
  // Shop carousel data
  shops?: AIShop[];
  // Service picker flag
  showServicePicker?: boolean;
  // Diagnostic form pre-fill (rendered when stage === "diagnostic_form")
  showDiagnosticForm?: {
    initialSystem?: DiagnosticSystem;
    initialNotes?: string;
  };
  // Record confirmation prompt — Oto fires this when a user-described symptom
  // contradicts a self_reported maintenance_record. Component shows the
  // record's stated state and offers Confirm / Update buttons. Trigger-only:
  // the component queries Convex directly for the record contents.
  // See: convex/oto/tools.ts → render_record_confirmation.
  showRecordConfirmation?: {
    vehicle_id: string; // vehicles._id
    maintenance_type: MaintenanceType;
  };
  // Metadata
  scenarioType?: ScenarioType;
  stage?: ConversationStage;
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
