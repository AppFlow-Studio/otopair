/**
 * AI Chat Store
 * Zustand store for managing AI chat state
 */

import { create } from 'zustand';
import type {
  AIChatStore,
  AIChatState,
  ChatMessage,
  Conversation,
  User,
  Vehicle,
  SuggestionTile,
} from '@/services/types/ai.types';
import {
  sendChatMessage,
  getUserData,
  getSuggestions,
  getConversations,
  getConversation,
} from '@/services/api/aiChat';

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AIChatState = {
  messages: [],
  currentConversationId: null,
  conversations: [],
  isLoading: false,
  isLoadingHistory: false,
  user: null,
  vehicle: null,
  suggestions: [],
  greeting: 'Hello',
  isRecording: false,
  selectedImage: null,
};

// ============================================================================
// STORE
// ============================================================================

export const useAIChatStore = create<AIChatStore>((set, get) => ({
  ...initialState,

  // --------------------------------------------------------------------------
  // MESSAGE ACTIONS
  // --------------------------------------------------------------------------

  sendMessage: async (message: string) => {
    const { messages, user, selectedImage } = get();

    // Create user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: selectedImage ? `[Image attached] ${message}` : message,
      timestamp: new Date().toISOString(),
    };

    // Add user message and set loading
    set({
      messages: [...messages, userMessage],
      isLoading: true,
      selectedImage: null, // Clear selected image
    });

    try {
      // Send to API
      const response = await sendChatMessage({
        message,
        conversation_history: messages,
        user_id: user?.id,
      });

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        sections: response.sections,
        functionCall: response.function_call,
      };

      // Update state with response
      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
        currentConversationId: response.conversation_id || state.currentConversationId,
      }));
    } catch (error) {
      console.error('Error sending message:', error);

      // Add error message
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };

      set((state) => ({
        messages: [...state.messages, errorMessage],
        isLoading: false,
      }));
    }
  },

  clearMessages: () => {
    set({
      messages: [],
      currentConversationId: null,
    });
  },

  // --------------------------------------------------------------------------
  // CONVERSATION ACTIONS
  // --------------------------------------------------------------------------

  loadConversation: async (conversationId: string) => {
    set({ isLoadingHistory: true });

    try {
      const conversation = await getConversation(conversationId);

      if (conversation) {
        set({
          messages: conversation.messages,
          currentConversationId: conversation.id,
          isLoadingHistory: false,
        });
      } else {
        set({ isLoadingHistory: false });
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      set({ isLoadingHistory: false });
    }
  },

  loadConversations: async () => {
    set({ isLoadingHistory: true });

    try {
      const response = await getConversations();
      set({
        conversations: response.conversations,
        isLoadingHistory: false,
      });
    } catch (error) {
      console.error('Error loading conversations:', error);
      set({ isLoadingHistory: false });
    }
  },

  startNewChat: () => {
    set({
      messages: [],
      currentConversationId: null,
    });
  },

  // --------------------------------------------------------------------------
  // USER CONTEXT
  // --------------------------------------------------------------------------

  loadUserContext: async () => {
    try {
      const response = await getUserData();
      set({
        user: response.user,
        vehicle: response.vehicle,
      });
    } catch (error) {
      console.error('Error loading user context:', error);
    }
  },

  loadSuggestions: async () => {
    try {
      const response = await getSuggestions();
      set({
        suggestions: response.suggestions,
        greeting: response.greeting,
      });
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  },

  // --------------------------------------------------------------------------
  // MEDIA ACTIONS
  // --------------------------------------------------------------------------

  setRecording: (isRecording: boolean) => {
    set({ isRecording });
  },

  setSelectedImage: (imageUri: string | null) => {
    set({ selectedImage: imageUri });
  },

  // --------------------------------------------------------------------------
  // RESET
  // --------------------------------------------------------------------------

  reset: () => {
    set(initialState);
  },
}));

// ============================================================================
// SELECTORS
// ============================================================================

export const selectMessages = (state: AIChatStore) => state.messages;
export const selectIsLoading = (state: AIChatStore) => state.isLoading;
export const selectUser = (state: AIChatStore) => state.user;
export const selectVehicle = (state: AIChatStore) => state.vehicle;
export const selectSuggestions = (state: AIChatStore) => state.suggestions;
export const selectGreeting = (state: AIChatStore) => state.greeting;
export const selectConversations = (state: AIChatStore) => state.conversations;
export const selectIsRecording = (state: AIChatStore) => state.isRecording;
export const selectSelectedImage = (state: AIChatStore) => state.selectedImage;

