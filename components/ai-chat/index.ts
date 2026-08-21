/**
 * AI Chat Components - Barrel Export
 *
 * PURPOSE: Central export file for all AI chat components and types
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx
 *
 * COMPONENTS:
 *   - AIGreeting - ChatGPT-style greeting with suggestions
 *   - AIMessageBubble - User/AI message display
 *   - AIInputBox - Text input with send/mic buttons and inline voice recording
 *   - AITypingIndicator - "Thinking" animation
 *   - AIReasoning - Collapsible thinking panel
 *   - AISources - Source citation pills
 *   - AIQuickReplies - In-conversation action buttons
 *   - PromptSuggestions - Stage-aware suggestion pills
 *   - BookServiceComponent - Consolidated booking flow (Sprint 4 Pass B)
 *   - AIRecordConfirmation - Maintenance-record trust protocol
 *   - AIWelcomeScreen - Welcome/disclaimer screen
 *   - AIChatHistory - Chat history sidebar
 *   - AIAttachmentPanel - Discord-style attachment picker panel
 *   - AISelectedImages - Selected images preview with remove buttons
 *
 * OWNER: Waleed Mansour
 */

// ============================================================================
// CORE COMPONENTS
// ============================================================================

export { AIGreeting, type VehicleCard } from "./AIGreeting";
export { AIContextBar } from "./AIContextBar";
export { SymptomTrackerPin, type OpenSymptomRow } from "./SymptomTrackerPin";
export { AIMessageBubble, type AIMessage } from "./AIMessageBubble";
export { AIInputBox } from "./AIInputBox";
export { AITypingIndicator } from "./AITypingIndicator";
export { AIChatHistory } from "./AIChatHistory";
export { AIAttachmentPanel } from "./AIAttachmentPanel";
export { AISelectedImages } from "./AISelectedImages";

// ============================================================================
// PROMPT-KIT INSPIRED COMPONENTS
// ============================================================================

export { PromptSuggestions, DEFAULT_SUGGESTIONS, type ConversationStage, type Suggestion } from "./PromptSuggestions";
export { AIReasoning, type ReasoningStep } from "./AIReasoning";
export { AISources, SOURCE_DEFINITIONS, getSourcesForScenario, type Source, type SourceType } from "./AISources";
export { AIQuickReplies, PRIORITY_REPLIES, CONFIRMATION_REPLIES, type QuickReply } from "./AIQuickReplies";

// ============================================================================
// BOOKING FLOW COMPONENTS
// ============================================================================

export { AIWelcomeScreen } from "./AIWelcomeScreen";
export {
  AIRecordConfirmation,
  type RecordConfirmationDecision,
} from "./AIRecordConfirmation";
// render_vehicle_update — vehicle-truth confirm card (mileage / service claims /
// fault lights). Renders when message.showVehicleUpdate is set.
export {
  AIVehicleUpdate,
  type VehicleUpdateOutcome,
} from "./AIVehicleUpdate";
// Sprint 4 — feedback modal triggered by the thumbs-up / thumbs-down buttons.
export { AIFeedbackModal, type FeedbackRating } from "./AIFeedbackModal";
// Sprint 4 Day 1 Pass B — single consolidated booking surface. Renders when
// message.bookService is set; owns service → options → notes → mechanic →
// time → review → pay-screen handoff internally.
export { BookServiceComponent } from "./BookServiceComponent";
// Sprint 3 Days 2 / 5 — the smaller render surfaces Oto can fire alongside
// the message bubble.
export { LinkButton, BookingCard, BookingsList } from "./OtoRenderTools";

// ============================================================================
// LEGACY (deprecated - use alternatives above)
// ============================================================================

export { AISuggestionTile } from "./AISuggestionTile";
