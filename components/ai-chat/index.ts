/**
 * AI Chat Components - Barrel Export
 */

// Original components
export { AIGreeting } from "./AIGreeting";
export { AISuggestionTile } from "./AISuggestionTile";
export { AIMessageBubble, type AIMessage } from "./AIMessageBubble";
export { AIInputBox } from "./AIInputBox";
export { AITypingIndicator } from "./AITypingIndicator";
export { AIChatHistory } from "./AIChatHistory";

// New prompt-kit inspired components
export { PromptSuggestions, DEFAULT_SUGGESTIONS, type ConversationStage, type Suggestion } from "./PromptSuggestions";
export { AIReasoning, type ReasoningStep } from "./AIReasoning";
export { AISources, SOURCE_DEFINITIONS, getSourcesForScenario, type Source, type SourceType } from "./AISources";
export { AIQuickReplies, PRIORITY_REPLIES, CONFIRMATION_REPLIES, type QuickReply } from "./AIQuickReplies";
export { AIBookingCarousel, type SelectedTimeSlot } from "./AIBookingCarousel";
export { AIWelcomeScreen } from "./AIWelcomeScreen";
export { AIServicePicker, DEFAULT_SERVICES, type ServiceOption } from "./AIServicePicker";
