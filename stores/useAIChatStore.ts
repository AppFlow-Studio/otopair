/**
 * AI Chat Store
 * Zustand store for managing AI chat state
 * Note: The main AI chat screen now uses local state with the scenario engine.
 * This store can be used for persistence or sharing state across components.
 */

import { create } from "zustand";
import type { ConversationState, ChatMessage } from "@/services/ai/types";
import { createInitialState } from "@/services/ai/scenarioEngine";

// ============================================================================
// TYPES
// ============================================================================

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface AIChatStoreState {
  // Current conversation state
  conversationState: ConversationState;

  // Saved conversations (for history)
  conversations: Conversation[];

  // UI state
  isLoadingHistory: boolean;
  
  // Welcome screen
  hasSeenWelcome: boolean;
}

export interface AIChatStoreActions {
  // State management
  setConversationState: (state: ConversationState) => void;
  resetConversation: () => void;

  // Conversation history
  saveConversation: (title?: string) => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  
  // Welcome screen
  setHasSeenWelcome: (seen: boolean) => void;
}

export type AIChatStore = AIChatStoreState & AIChatStoreActions;

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getConversationTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (firstUserMessage) {
    return firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "");
  }
  return "New conversation";
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AIChatStoreState = {
  conversationState: createInitialState(),
  conversations: [],
  isLoadingHistory: false,
  hasSeenWelcome: false,
};

// ============================================================================
// STORE
// ============================================================================

export const useAIChatStore = create<AIChatStore>((set, get) => ({
  ...initialState,

  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------

  setConversationState: (conversationState: ConversationState) => {
    set({ conversationState });
  },

  resetConversation: () => {
    set({ conversationState: createInitialState() });
  },

  // --------------------------------------------------------------------------
  // CONVERSATION HISTORY
  // --------------------------------------------------------------------------

  saveConversation: (title?: string) => {
    const { conversationState, conversations } = get();

    if (conversationState.messages.length === 0) return;

    const conversation: Conversation = {
      id: generateId(),
      title: title || getConversationTitle(conversationState.messages),
      lastMessage: conversationState.messages[conversationState.messages.length - 1]?.content || "",
      updatedAt: new Date().toISOString(),
      messages: conversationState.messages,
    };

    set({
      conversations: [conversation, ...conversations].slice(0, 50), // Keep last 50
    });
  },

  loadConversation: (id: string) => {
    const { conversations } = get();
    const conversation = conversations.find((c) => c.id === id);

    if (conversation) {
      set({
        conversationState: {
          ...createInitialState(),
          messages: conversation.messages,
          currentStage: "welcome", // Reset to welcome for new interactions
        },
      });
    }
  },

  deleteConversation: (id: string) => {
    const { conversations } = get();
    set({
      conversations: conversations.filter((c) => c.id !== id),
    });
  },

  // --------------------------------------------------------------------------
  // WELCOME SCREEN
  // --------------------------------------------------------------------------

  setHasSeenWelcome: (seen: boolean) => {
    set({ hasSeenWelcome: seen });
  },
}));

// ============================================================================
// SELECTORS
// ============================================================================

export const selectConversationState = (state: AIChatStore) => state.conversationState;
export const selectMessages = (state: AIChatStore) => state.conversationState.messages;
export const selectCurrentStage = (state: AIChatStore) => state.conversationState.currentStage;
export const selectSuggestions = (state: AIChatStore) => state.conversationState.suggestions;
export const selectConversations = (state: AIChatStore) => state.conversations;
export const selectIsProcessing = (state: AIChatStore) => state.conversationState.isProcessing;
export const selectHasSeenWelcome = (state: AIChatStore) => state.hasSeenWelcome;
