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
 *   - AIServicePicker - Service selection cards
 *   - AIBookingCarousel - Mechanic booking carousel
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

export { AIGreeting } from "./AIGreeting";
export { AIMessageBubble, type AIMessage } from "./AIMessageBubble";
export { AIInputBox } from "./AIInputBox";
export { AITypingIndicator } from "./AITypingIndicator";
export { AIChatHistory } from "./AIChatHistory";
export { AIToast } from "./AIToast";
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

export { AIBookingCarousel, type SelectedTimeSlot } from "./AIBookingCarousel";
export { AIWelcomeScreen } from "./AIWelcomeScreen";
export { AIServicePicker, DEFAULT_SERVICES, type ServiceOption } from "./AIServicePicker";

// ============================================================================
// LEGACY (deprecated - use alternatives above)
// ============================================================================

export { AISuggestionTile } from "./AISuggestionTile";
