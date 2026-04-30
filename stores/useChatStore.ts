/**
 * useChatStore
 *
 * PURPOSE: Local-only chat state (per-booking conversation with the mechanic).
 *          Keyed by bookingId. Seeds each new thread with a mechanic welcome
 *          message and auto-replies to user messages with a canned ack so the
 *          UI feels alive during development.
 *
 * TODO(convex): swap this for a messages table + subscription when the
 * messaging backend is ready. Keep the same send / subscribe shape.
 */

import { create } from "zustand";

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: "user" | "mechanic";
  text: string;
  timestamp: number;
}

interface ChatState {
  /** All messages keyed by conversationId, oldest first. */
  messages: Record<string, ChatMessage[]>;
  /** Seed a thread with a welcome message if it doesn't exist yet. */
  ensureThread: (conversationId: string, mechanicName: string) => void;
  /** Append a message from the user, optionally schedule a canned mechanic reply. */
  sendMessage: (conversationId: string, text: string) => void;
  getMessages: (conversationId: string) => ChatMessage[];
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const CANNED_REPLIES = [
  "Thanks for the message! I'll take a look shortly.",
  "Got it — checking on that now.",
  "Appreciate the heads up, I'll update you before your appointment.",
  "Sounds good. Anything else you'd like me to note?",
];

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},

  ensureThread: (conversationId, mechanicName) => {
    const existing = get().messages[conversationId];
    if (existing && existing.length > 0) return;
    const welcome: ChatMessage = {
      id: uid(),
      conversationId,
      sender: "mechanic",
      text: `Hi, I'm ${mechanicName.split(" ")[0] ?? "your mechanic"}. Feel free to message me about your booking anytime.`,
      timestamp: Date.now() - 60_000,
    };
    set((state) => ({
      messages: { ...state.messages, [conversationId]: [welcome] },
    }));
  },

  sendMessage: (conversationId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: uid(),
      conversationId,
      sender: "user",
      text: trimmed,
      timestamp: Date.now(),
    };
    set((state) => {
      const prev = state.messages[conversationId] ?? [];
      return { messages: { ...state.messages, [conversationId]: [...prev, userMsg] } };
    });

    // Canned auto-reply after a short delay. Swap for real send when backend is ready.
    const reply = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)];
    setTimeout(() => {
      const mechanicMsg: ChatMessage = {
        id: uid(),
        conversationId,
        sender: "mechanic",
        text: reply,
        timestamp: Date.now(),
      };
      set((state) => {
        const prev = state.messages[conversationId] ?? [];
        return { messages: { ...state.messages, [conversationId]: [...prev, mechanicMsg] } };
      });
    }, 1400 + Math.random() * 600);
  },

  getMessages: (conversationId) => {
    return get().messages[conversationId] ?? [];
  },
}));
