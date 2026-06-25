/**
 * AIChatScreen
 *
 * PURPOSE: Main screen for OtoPair AI diagnostic assistant with ChatGPT-style chat interface
 *
 * USED IN: app/(main-tabs)/ai-chat/_layout.tsx (tab navigation)
 *
 * FEATURES:
 *   - Welcome screen on first visit (AIWelcomeScreen)
 *   - Greeting with suggestions when no messages (AIGreeting)
 *   - Message bubbles with reasoning, sources, quick replies (AIMessageBubble)
 *   - Consolidated booking flow rendered when Oto fires render_book_service
 *     (BookServiceComponent — Sprint 4 Day 1 Pass B)
 *   - Maintenance-record trust protocol (AIRecordConfirmation)
 *   - Chat history sidebar (AIChatHistory)
 *   - Scenario-based conversation engine (scenarioEngine)
 *
 * EXAMPLE:
 *   // Rendered via Expo Router tab navigation
 *   <Stack.Screen name="index" />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, ScrollView, StyleSheet, Pressable, Alert, Platform, Keyboard, useWindowDimensions, Dimensions, UIManager } from "react-native";

// 2. Expo & Third-party
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSpring, Easing, interpolate, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { haptics } from "@/lib/haptics";
import { useToast } from "@/hooks/useToast";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { AlignLeft, SquarePen, Ellipsis, Sparkles, History, CarFront, Zap, ChevronDown } from "lucide-react-native";
import { MenuView } from "@react-native-menu/menu";

// Liquid Glass (iOS 26+)
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassEnabled = false;
try {
  const lg = require("@callstack/liquid-glass");
  LiquidGlassView = lg.LiquidGlassView;
  isLiquidGlassEnabled = !!lg.isLiquidGlassSupported;
} catch (e) {}
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";

// 3. Shared UI (design system)
import { Text } from "@/components/shared-ui";
import { ProfileInitialsButton } from "@/components/home/ProfileInitialsButton";

// 4. Flow-specific components
import {
  AIGreeting,
  AIContextBar,
  AIMessageBubble,
  AIInputBox,
  AITypingIndicator,
  AIChatHistory,
  PromptSuggestions,
  AIWelcomeScreen,
  AIRecordConfirmation,
  type RecordConfirmationDecision,
  AIVehicleUpdate,
  type VehicleUpdateOutcome,
  BookServiceComponent,
  LinkButton,
  BookingCard,
  BookingsList,
  AIFeedbackModal,
  type FeedbackRating,
  AIAttachmentPanel,
  AISelectedImages,
  type AIMessage,
  type Suggestion,
  type QuickReply,
  type VehicleCard,
} from "@/components/ai-chat";

// 5. Constants, hooks, types, stores
import { BrandColors, Spacing, FontFamily } from "@/constants/theme";
import { useAIChatStore } from "@/stores/useAIChatStore";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { formatMake } from "@/utils/formatMake";
import { createInitialState, processUserMessage, WELCOME_SUGGESTIONS } from "@/services/ai/scenarioEngine";
import type { ConversationState, ChatMessage } from "@/services/ai/types";

// Oto AI minimal end-to-end loop (Phase 1 spike) — feature-flagged so we can
// flip back to the rule engine instantly.
import { useAction, useMutation, useQuery, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";

// ============================================================================
// CONSTANTS
// ============================================================================

// Feature flag — route chat sends through the Oto AI Convex action instead of
// the rule-based scenario engine. Flip back to `false` to restore the rule
// engine path. The rule-engine code is intentionally left intact below.
const USE_OTO_AI_ACTION = true;

// Match tab layout behavior: iOS 26+ uses native tabs with a slightly smaller effective offset.
const TAB_BAR_HEIGHT =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26
    ? 90
    : 100;

const isMenuViewAvailable = !!UIManager.getViewManagerConfig?.("MenuView");

// Drawer sidebar constants
const DRAWER_TRANSLATE = Dimensions.get('window').width * 0.78;
const DRAWER_SCALE = 0.92;
const DRAWER_RADIUS = 40;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  // Calculate bottom padding to account for the native tab bar
  const bottomPadding = Math.max(insets.bottom, TAB_BAR_HEIGHT);
  const HEADER_HEIGHT = insets.top + Spacing.md * 2 + 40;

  // Welcome screen state (from Zustand store)
  const hasSeenWelcome = useAIChatStore((state) => state.hasSeenWelcome);
  const setHasSeenWelcome = useAIChatStore((state) => state.setHasSeenWelcome);

  // Chat history state — sidebar list now sourced from Convex so Oto-AI-path
  // conversations show up across mounts. saveCurrentConversation/loadConversation
  // still drive the legacy rule-engine paths until those are retired in Phase 2.
  const saveCurrentConversation = useAIChatStore((state) => state.saveCurrentConversation);
  const loadConversation = useAIChatStore((state) => state.loadConversation);
  const startNewConversation = useAIChatStore((state) => state.startNewConversation);

  const convex = useConvex();
  const convexConversationsRaw = useQuery(api.ai_conversations.getByUserId);
  const conversations = React.useMemo(() => {
    const rows = convexConversationsRaw ?? [];
    return rows.map((row: Doc<"ai_conversations">) => {
      // Build a compact, topic-y title from Oto's running summary.
      // Sequence: strip the "User …" prefix Oto narrates with → take
      // just the first sentence → cap at 32 chars so the sidebar row
      // never gets cut off mid-word by numberOfLines.
      const raw = (row.arc_summary ?? row.scenario_detected ?? "").trim();
      let title = "New conversation";
      if (raw.length > 0) {
        let cleaned = raw
          .replace(/^(the\s+user|user)\s+/i, "")
          .replace(/\s+/g, " ")
          .trim();
        // First sentence only — Oto's summaries often stack 2-3 sentences.
        const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
        cleaned = firstSentence.replace(/[.!?]+$/, "").trim();
        if (cleaned.length > 0) {
          cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
          title = cleaned.length > 32 ? `${cleaned.slice(0, 32).trim()}…` : cleaned;
        }
      }
      return {
        id: row._id as string,
        title,
      };
    });
  }, [convexConversationsRaw]);

  // Conversation state (using scenario engine)
  const [state, setState] = useState<ConversationState>(createInitialState);

  // User data for greeting
  const { user: convexUser } = useUserFromConvex();
  const userFirstName = convexUser?.first_name || "User";

  // Oto AI action wiring — feature-flagged.
  const sendMessageAction = useAction(api.oto.chat.sendMessage);
  const createConversation = useMutation(api.ai_conversations.create);
  const [convexConversationId, setConvexConversationId] =
    useState<Id<"ai_conversations"> | null>(null);
  // appendEstablishedFact — mobile-side write into ai_conversations.established_facts
  // so Haiku reads selections from <conversation_state> on the next turn instead of
  // re-deriving them from natural-language history. Decision D: "IDs come from
  // <conversation_state>, NEVER from user text." Wired into every render-target
  // confirmation handler below. Fire-and-forget — mutation is fast (~50ms) and
  // the next Anthropic turn takes much longer to set up, so the race is benign.
  const appendEstablishedFact = useMutation(api.ai_conversations.appendEstablishedFact);
  const pushFact = useCallback(
    (fact: string) => {
      if (!convexConversationId) return;
      appendEstablishedFact({ id: convexConversationId, fact }).catch((e) => {
        console.warn("[ai-chat] appendEstablishedFact failed (non-fatal):", e?.message);
      });
    },
    [appendEstablishedFact, convexConversationId],
  );
  // Stable session id for this mount — used when lazily creating the
  // ai_conversations row on first send.
  const sessionIdRef = useRef<string>(
    `oto_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );

  // Vehicle data for greeting screen
  const { vehicles: rawVehicles } = useVehicleOwnershipFromConvex();
  const [selectedVehicleVin, setSelectedVehicleVin] = useState<string | null>(null);

  const LOCAL_VEHICLE_IMAGES: Record<string, any> = {
    tiguan: require("@/assets/images/tiguan.png"),
    explorer: require("@/assets/images/explorer.png"),
    es: require("@/assets/images/lexus.png"),
  };

  const greetingVehicles: VehicleCard[] = React.useMemo(() => {
    if (!rawVehicles || rawVehicles.length === 0) return [];
    return rawVehicles.map((r: any) => {
      const v = r.vehicle;
      const o = r.ownership;
      const meta = v?.metadata as { make?: string; model?: string } | undefined;
      const make = meta?.make || o?.nickname?.split(" ")[1] || "Vehicle";
      const model = meta?.model || o?.nickname?.split(" ").slice(2).join(" ") || "";
      const cachedUrl = v?.image_url;
      // Only use cached URLs from the new transparent-bg endpoint.
      const imageUrl =
        typeof cachedUrl === "string" && cachedUrl.includes("/transparent/")
          ? cachedUrl
          : null;
      const modelLower = model.toLowerCase();
      const localImage = LOCAL_VEHICLE_IMAGES[modelLower] || null;
      return {
        vin: r.vin,
        year: v?.year ?? 0,
        make: formatMake(make),
        model: model.charAt(0).toUpperCase() + model.slice(1).toLowerCase(),
        imageUrl,
        localImage,
      };
    });
  }, [rawVehicles]);

  // Auto-select primary vehicle
  React.useEffect(() => {
    if (!selectedVehicleVin && greetingVehicles.length > 0) {
      const primary = rawVehicles?.find((r: any) => r.ownership?.is_primary);
      setSelectedVehicleVin(primary?.vin ?? greetingVehicles[0].vin);
    }
  }, [greetingVehicles, selectedVehicleVin, rawVehicles]);

  // Short personalized name for the active vehicle — drives the empty-chat
  // greeting headline ("Hi — how can I help with your <X>?"). Prefer the
  // model (M550i, A4, MKX); fall back to make+model if model alone is
  // ambiguous; final fallback is the generic "car".
  const vehicleShortName = React.useMemo(() => {
    if (!selectedVehicleVin) return "car";
    const v = greetingVehicles.find((r) => r.vin === selectedVehicleVin);
    if (!v) return "car";
    if (v.model && v.model.trim().length > 0) return v.model.trim();
    if (v.make && v.make.trim().length > 0) return v.make.trim();
    return "car";
  }, [selectedVehicleVin, greetingVehicles]);

  // Local UI state
  const [inputValue, setInputValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Car selection state — input bar hidden until car confirmed
  const [isCarConfirmed, setIsCarConfirmed] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCard | null>(null);

  // Attachment panel state
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  // Unified toast surface (migrated from AIToast — see docs/notifications).
  const toast = useToast();
  const showToast = useCallback(
    (message: string) => {
      toast.info(message);
    },
    [toast],
  );

  // Voice recording hook
  const {
    isRecording,
    isTranscribing,
    transcript,
    meteringValue,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecording();

  // Track keyboard height + visibility (plain View, no KAV or Animated.View)
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
        if (isAttachmentOpen) setIsAttachmentOpen(false);
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [isAttachmentOpen]);

  const handleWelcomeContinue = () => {
    setHasSeenWelcome(true);
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (state.messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [state.messages, isProcessing]);

  // Smooth scroll to bottom when input is focused
  const handleInputFocus = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300); // Small delay to ensure keyboard animation starts
  }, []);

  // Handle attachment panel toggle (Discord-style animation)
  const handleToggleAttachment = useCallback(() => {
    if (isAttachmentOpen) {
      // Close the panel
      setIsAttachmentOpen(false);
    } else {
      // Open the panel
      if (isKeyboardVisible) {
        // Keyboard is open - dismiss it first, then show panel after delay
        Keyboard.dismiss();
        // Wait for keyboard to start hiding, then show panel
        setTimeout(() => {
          setIsAttachmentOpen(true);
        }, Platform.OS === "ios" ? 100 : 50);
      } else {
        // Keyboard is closed - just show the panel
        setIsAttachmentOpen(true);
      }
    }
  }, [isAttachmentOpen, isKeyboardVisible]);

  // Handle image selection toggle from attachment panel
  const handleToggleImage = useCallback((uri: string) => {
    setSelectedImages(prev => {
      if (prev.includes(uri)) {
        return prev.filter(u => u !== uri);
      }
      if (prev.length >= 10) {
        showToast("Maximum 10 images allowed");
        return prev;
      }
      return [...prev, uri];
    });
  }, [showToast]);

  // Handle removing a selected image
  const handleRemoveImage = useCallback((uri: string) => {
    setSelectedImages(prev => prev.filter(u => u !== uri));
  }, []);

  // Handle microphone press in - start recording
  const handleMicPressIn = useCallback(async () => {
    if (isProcessing) return;
    await startRecording();
  }, [isProcessing, startRecording]);

  // ──────────────────────────────────────────────────────────────────────
  // sendToOtoAI — single funnel for every user-input surface
  //
  // Lifted from the Oto-AI branch of handleSend so quick-reply taps,
  // service-picker confirms, voice-transcription auto-sends, and welcome-
  // screen suggestion tiles all reach Haiku the same way typed Send does.
  // The Convex chat action loads server-side history for context and
  // persists both turns; this helper only handles the local UI side
  // (snappy user-message echo + AI response merge + processing flag).
  //
  // `attachedImages` is optional because two callers (typed Send + voice
  // transcription) can attach images while quick-reply / service-picker /
  // suggestion-tile paths never do.
  // ──────────────────────────────────────────────────────────────────────
  const sendToOtoAI = useCallback(
    async (messageText: string, attachedImages?: string[]) => {
      if (isProcessing) return;
      const hasText = messageText.trim().length > 0;
      const hasImages = !!attachedImages && attachedImages.length > 0;
      if (!hasText && !hasImages) return;

      if (!convexUser?._id) {
        // Auth not ready yet — bail out gracefully.
        showToast("Still signing you in — try again in a sec.");
        return;
      }

      setIsProcessing(true);

      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: messageText,
        timestamp: new Date().toISOString(),
        images: hasImages ? attachedImages : undefined,
      };

      // Show user message immediately for snappy UX. The Convex action
      // persists both turns server-side — saveCurrentConversation would
      // dual-persist locally, so we deliberately skip it here.
      setState((prev) => ({ ...prev, messages: [...prev.messages, userMessage] }));

      try {
        // Lazy-create the ai_conversations row on the first send. Same
        // guard handleSend used; lives in the helper so every input
        // surface (not just typed Send) gets the same treatment.
        let conversationId = convexConversationId;
        if (!conversationId) {
          conversationId = await createConversation({
            user_id: convexUser._id as Id<"users">,
            session_id: sessionIdRef.current,
          });
          setConvexConversationId(conversationId);
        }

        const {
          text,
          quickReplies,
          showRecordConfirmation,
          showVehicleUpdate,
          bookService,
          linkButton,
          bookingCard,
          bookingsList,
        } = await sendMessageAction({
          conversationId,
          message: messageText,
          // Pass the frontend's vehicle-picker selection so the action
          // doesn't fall back to "most recently added" when the user has
          // explicitly chosen a different car.
          vehicleVin: selectedVehicleVin ?? undefined,
        });

        // Record-confirmation envelope — fired when Oto detects a symptom
        // contradicts a self_reported maintenance record and wants the user
        // to verify (or correct) the record before reasoning further.
        const recordConfirmEnvelope = showRecordConfirmation as
          | { vehicle_id: string; maintenance_type: import("@/utils/maintenanceStatus").MaintenanceType }
          | undefined;

        // Sprint 4 Day 1 Pass B — typed view of the bookService envelope.
        // This is now the only terminal-stage render in the booking flow.
        const bookServiceEnvelope = bookService as
          | import("@/services/ai/types").BookServicePayload
          | undefined;
        // Sprint 3 Day 2/5/6 — other live render envelopes.
        const linkButtonEnvelope = linkButton as
          | import("@/services/ai/types").LinkButtonPayload
          | undefined;
        const bookingCardEnvelope = bookingCard as
          | { booking_id: string }
          | undefined;
        const bookingsListEnvelope = bookingsList as
          | { booking_ids: string[] }
          | undefined;
        // render_vehicle_update — the backend payload carries only the captured
        // truth (mileage / service_claims / fault_lights); resolve the active
        // vehicle's Convex id here from the picker selection (primary fallback)
        // so the card can call applyVehicleTruth(vehicle_id, …).
        const activeVehicleId =
          rawVehicles?.find((r: any) => r.vin === selectedVehicleVin)?.vehicle
            ?._id ??
          rawVehicles?.find((r: any) => r.ownership?.is_primary)?.vehicle?._id;
        const vehicleUpdateEnvelope =
          showVehicleUpdate && activeVehicleId
            ? ({
                ...(showVehicleUpdate as object),
                vehicle_id: activeVehicleId as string,
              } as import("@/services/ai/types").VehicleUpdatePayload)
            : undefined;

        const nextStage: ChatMessage["stage"] = bookServiceEnvelope
          ? "confirmation"
          : undefined;

        const aiMessage: ChatMessage = {
          id: `ai_${Date.now()}`,
          role: "assistant",
          content: text,
          timestamp: new Date().toISOString(),
          isStreaming: true,
          quickReplies: quickReplies as QuickReply[] | undefined,
          showRecordConfirmation: recordConfirmEnvelope,
          showVehicleUpdate: vehicleUpdateEnvelope,
          bookService: bookServiceEnvelope,
          linkButton: linkButtonEnvelope,
          bookingCard: bookingCardEnvelope,
          bookingsList: bookingsListEnvelope,
          stage: nextStage,
        };
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, aiMessage],
          currentStage: nextStage ?? prev.currentStage,
        }));

        // Stop the streaming animation after a beat. Reuses the rule
        // engine's animation cadence so the bubble feels consistent.
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === aiMessage.id ? { ...m, isStreaming: false } : m
            ),
          }));
          setIsProcessing(false);
        }, Math.min(text.length * 30, 3000));
      } catch (err) {
        // Surface the error in-chat so the loop is debuggable without
        // having to open the inspector. Refine before launch.
        const errorMessage =
          err instanceof Error ? err.message : "Something went wrong.";
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: `err_${Date.now()}`,
              role: "assistant",
              content: `(Oto error: ${errorMessage})`,
              timestamp: new Date().toISOString(),
            },
          ],
        }));
        setIsProcessing(false);
      }
    },
    [
      isProcessing,
      convexUser?._id,
      convexConversationId,
      createConversation,
      sendMessageAction,
      selectedVehicleVin,
      rawVehicles,
      showToast,
    ]
  );

  // Handle microphone press out - stop recording and route transcription
  // through the same Oto-AI helper as typed Send.
  const handleMicPressOut = useCallback(async () => {
    const transcription = await stopRecording();
    if (transcription && transcription.trim()) {
      sendToOtoAI(transcription);
    }
  }, [stopRecording, sendToOtoAI]);

  // Handle sending a message
  const handleSend = useCallback(() => {
    const trimmedInput = inputValue.trim();
    const hasImages = selectedImages.length > 0;

    // Allow sending if there's text OR images
    if ((!trimmedInput && !hasImages) || isProcessing) return;

    // Capture images before clearing
    const attachedImages = [...selectedImages];

    setInputValue("");
    setSelectedImages([]); // Clear selected images
    setIsAttachmentOpen(false); // Close attachment panel

    // Use a default message for image-only sends
    const messageText = trimmedInput || (hasImages ? "Here's an image for you to analyze" : "");

    // ── Oto AI path (feature-flagged) ───────────────────────────────────
    // All four user-input surfaces funnel through sendToOtoAI so the
    // Convex action sees a single, history-aware entrypoint regardless of
    // whether the user typed, tapped a quick-reply, dictated, or confirmed
    // a service-picker selection. Rule-engine code below is preserved and
    // re-enabled by flipping USE_OTO_AI_ACTION to false.
    if (USE_OTO_AI_ACTION) {
      sendToOtoAI(messageText, attachedImages.length > 0 ? attachedImages : undefined);
      return;
    }

    setIsProcessing(true);

    // ── Rule-engine path (legacy — left intact for flip-back) ───────────
    // Process with scenario engine
    const { newState, response } = processUserMessage(state, messageText, attachedImages);

    // Add user message immediately
    const updatedState = {
      ...state,
      messages: newState.messages,
      currentStage: newState.currentStage,
      currentScenario: newState.currentScenario,
      selectedPriority: newState.selectedPriority,
      selectedShop: newState.selectedShop,
      selectedTime: newState.selectedTime,
    };
    setState(updatedState);

    // Simulate AI "thinking" delay
    setTimeout(() => {
      // Create AI response message
      // Rule-engine fallback path (USE_OTO_AI_ACTION=false). Booking-related
      // fields (shops / showServicePicker / showDiagnosticForm) were dropped
      // in Sprint 4 Day 1 Pass B — the rule engine no longer drives booking
      // UI; Oto's render_book_service is the only path to BookServiceComponent.
      const aiMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: "assistant",
        content: response.message,
        timestamp: new Date().toISOString(),
        reasoning: response.reasoning,
        sources: response.sources,
        quickReplies: response.quickReplies,
        sections: response.sections,
        stage: response.nextStage,
        isStreaming: true,
      };

      setState((prevState) => {
        const newState = {
          ...prevState,
          messages: [...prevState.messages, aiMessage],
          suggestions: response.suggestions,
          currentStage: response.nextStage,
        };
        // Save conversation to store after state is set
        queueMicrotask(() => saveCurrentConversation(newState));
        return newState;
      });

      // Stop streaming after animation
      setTimeout(() => {
        setState((prev) => {
          const finalState = {
            ...prev,
            messages: prev.messages.map((m) => (m.id === aiMessage.id ? { ...m, isStreaming: false } : m)),
          };
          // Save final state to store after setState completes
          setTimeout(() => saveCurrentConversation(finalState), 0);
          return finalState;
        });
        setIsProcessing(false);
      }, response.message.length * 30); // Approximate streaming time
    }, 1500); // AI thinking delay
  }, [
    inputValue,
    state,
    isProcessing,
    saveCurrentConversation,
    selectedImages,
    sendToOtoAI,
  ]);

  // Welcome-screen suggestion tile tap. Routes through Haiku so prompt
  // suggestions ("Schedule Services for my Vehicle", "Something Feels Off")
  // produce real responses instead of rule-engine catch-alls.
  const handleSuggestionPress = useCallback(
    (suggestion: Suggestion | string) => {
      const text = typeof suggestion === "string" ? suggestion : suggestion.text;
      sendToOtoAI(text);
    },
    [sendToOtoAI]
  );

  // In-conversation quick-reply tap. Uses reply.value (canonical text Haiku
  // should see) with reply.text as the display-label fallback — this is the
  // distinction the v0.6 prompt's render_quick_replies tool relies on.
  const handleQuickReplySelect = useCallback(
    (reply: QuickReply) => {
      const text = reply.value || reply.text;
      sendToOtoAI(text);
    },
    [sendToOtoAI]
  );

  // Handle the user's decision from AIRecordConfirmation. The component has
  // already written to maintenance_records (confirm path stamps
  // confirmedHealthyAt; update path rewrites lastServiceDate + lastServiceMileage
  // with serviceSource: "ai_chat_correction"). All we do here is send a
  // synthetic user message to Oto so it sees the outcome on the next turn
  // and can react to it — e.g., "OK so that record was older than expected,
  // let me adjust the brake recommendation."
  const handleRecordDecision = useCallback(
    (decision: RecordConfirmationDecision) => {
      if (isProcessing) return;
      let echoText: string;
      let factText: string;
      if (decision.kind === "confirmed") {
        echoText = `Confirmed — ${decision.type} record is correct as-is.`;
        factText = `confirmed ${decision.type} record current as of now`;
      } else {
        const dateStr = new Date(decision.lastServiceDate).toLocaleDateString(
          undefined,
          { month: "long", year: "numeric" },
        );
        const mileagePart = decision.lastServiceMileage
          ? ` at ${decision.lastServiceMileage.toLocaleString()} mi`
          : "";
        echoText = `Updated — last ${decision.type} service was actually in ${dateStr}${mileagePart}.`;
        factText = `corrected ${decision.type} last_service to ${dateStr}${mileagePart}`;
      }
      // Decision D: write to established_facts so Oto reads the trust-protocol
      // outcome from <conversation_state>, not from echo-message text. The
      // synthetic echoText still goes through sendToOtoAI for chat-history
      // continuity, but the fact is the canonical state signal.
      pushFact(factText);
      sendToOtoAI(echoText);
    },
    [isProcessing, pushFact, sendToOtoAI],
  );

  // Handle a successful apply from AIVehicleUpdate. The component has already
  // written via vehicleTruth.applyVehicleTruth (mileage guard + pipeline). We
  // send a synthetic user message so Oto sees the outcome on the next turn and
  // can react (e.g. "Thanks — with 100k on it, you're due for…").
  const handleVehicleUpdateDecision = useCallback(
    (outcome: VehicleUpdateOutcome) => {
      if (isProcessing) return;
      const parts: string[] = [];
      if (outcome.mileageUpdated) parts.push("updated my mileage");
      if (outcome.servicesCompleted.length)
        parts.push(`logged ${outcome.servicesCompleted.join(", ")} as done`);
      if (outcome.servicesFlagged.length)
        parts.push(`flagged ${outcome.servicesFlagged.join(", ")} as due`);
      if (outcome.faultLightsAdded.length)
        parts.push(`logged the ${outcome.faultLightsAdded.join(", ")} light`);
      if (parts.length === 0) return;
      const echoText = `Done — ${parts.join(", ")}.`;
      pushFact(`vehicle_truth_applied: ${parts.join("; ")}`);
      sendToOtoAI(echoText);
    },
    [isProcessing, pushFact, sendToOtoAI],
  );

  // Handle copy message
  const handleCopy = useCallback(async (content: string) => {
    try {
      await Clipboard.setStringAsync(content);
      showToast("Message copied");
    } catch (error) {
      console.error("Copy error:", error);
    }
  }, [showToast]);

  // Handle speak message
  const handleSpeak = useCallback((content: string) => {
    Speech.speak(content, {
      language: "en-US",
      rate: 1.0,
    });
    showToast("Playing audio...");
  }, [showToast]);

  // Sprint 4 — thumbs up / down open the feedback modal so the user can add
  // a comment + tags. The modal submits to api.ai_feedback.submit; the row
  // links back to the conversation for owner-side review.
  const [feedbackModalState, setFeedbackModalState] = useState<{
    rating: FeedbackRating;
    messageContent: string;
    messageId?: Id<"ai_messages">;
  } | null>(null);

  const openFeedbackModal = useCallback(
    (rating: FeedbackRating, message: ChatMessage) => {
      // We don't yet persist a stable ai_messages id alongside the in-memory
      // ChatMessage (the persistence is fire-and-forget inside chat.ts). Pass
      // the content snapshot as the durable reference; message_id stays
      // undefined for now.
      setFeedbackModalState({
        rating,
        messageContent: message.content,
      });
    },
    [],
  );

  const closeFeedbackModal = useCallback(() => {
    setFeedbackModalState(null);
  }, []);

  // Start new chat. Guarded while a response is in flight — clearing
  // convexConversationId mid-send would orphan the captured ID in the
  // active sendToOtoAI closure.
  const startNewChat = useCallback(() => {
    if (isProcessing) {
      showToast("Wait for the current response to finish before starting a new chat.");
      return;
    }
    startNewConversation(); // Reset in store (clears currentConversationId)
    setState(createInitialState());
    setInputValue("");
    setIsProcessing(false);
    setIsCarConfirmed(false);
    setSelectedVehicle(null);
    // Reset the Convex-side conversation pointer so the next send via the
    // Oto AI action creates a fresh ai_conversations row instead of appending
    // to the previous one.
    setConvexConversationId(null);
    sessionIdRef.current = `oto_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }, [isProcessing, showToast, startNewConversation]);

  // Handle selecting a conversation from history. The sidebar now lists
  // server-side ai_conversations rows, so by default we hydrate state from
  // Convex; the Zustand path is kept as a fallback for any conversations
  // still living in the legacy rule-engine store.
  const handleSelectConversation = useCallback(
    async (conversationId: string) => {
      const loadedState = loadConversation(conversationId);
      if (loadedState) {
        setState(loadedState);
        setInputValue("");
        setIsProcessing(false);
        return;
      }
      try {
        const rows = await convex.query(api.ai_messages.getByConversationId, {
          conversationId: conversationId as Id<"ai_conversations">,
        });
        const messages: ChatMessage[] = (rows ?? [])
          .slice()
          .sort((a: any, b: any) => a.timestamp - b.timestamp)
          .map((row: any) => ({
            id: row._id as string,
            role: row.role === "user" ? "user" : "assistant",
            content: row.content,
            timestamp: new Date(row.timestamp).toISOString(),
          }));
        setState((prev) => ({ ...prev, messages }));
        setConvexConversationId(conversationId as Id<"ai_conversations">);
        setInputValue("");
        setIsProcessing(false);
      } catch (err) {
        showToast("Couldn't load that conversation.");
      }
    },
    [loadConversation, convex, showToast]
  );

  // Model selector
  const [selectedModel, setSelectedModel] = useState<'pro' | 'flash'>('flash');

  // Oto pill expanding menu (LiquidGlass path)
  const [showOtoMenu, setShowOtoMenu] = useState(false);
  const menuExpand = useSharedValue(0);

  const toggleOtoMenu = useCallback(() => {
    const next = !showOtoMenu;
    setShowOtoMenu(next);
    menuExpand.value = withTiming(next ? 1 : 0, { duration: 280, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  }, [showOtoMenu, menuExpand]);

  const closeOtoMenu = useCallback(() => {
    setShowOtoMenu(false);
    menuExpand.value = withTiming(0, { duration: 220, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
    setShowRightMenu(false);
    rightMenuExpand.value = withTiming(0, { duration: 220, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  }, [menuExpand]);

  const expandedMenuStyle = useAnimatedStyle(() => ({
    height: menuExpand.value * 155,
    width: menuExpand.value * 240,
    opacity: menuExpand.value,
    overflow: "hidden" as const,
  }));

  // Right pill expanding menu (LiquidGlass path)
  const [showRightMenu, setShowRightMenu] = useState(false);
  const rightMenuExpand = useSharedValue(0);

  const toggleRightMenu = useCallback(() => {
    const next = !showRightMenu;
    setShowRightMenu(next);
    rightMenuExpand.value = withTiming(next ? 1 : 0, { duration: 280, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  }, [showRightMenu, rightMenuExpand]);

  const closeRightMenu = useCallback(() => {
    setShowRightMenu(false);
    rightMenuExpand.value = withTiming(0, { duration: 220, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  }, [rightMenuExpand]);

  const rightExpandedStyle = useAnimatedStyle(() => ({
    height: rightMenuExpand.value * 88,
    width: rightMenuExpand.value * 160,
    opacity: rightMenuExpand.value,
    overflow: "hidden" as const,
  }));

  // Drawer sidebar
  const drawerProgress = useSharedValue(0);
  const SCREEN_W = Dimensions.get('window').width;

  const handleDrawerOpen = useCallback(() => {
    setShowHistory(true);
    Keyboard.dismiss();
    haptics.selection();
  }, []);

  const handleDrawerClose = useCallback(() => {
    setShowHistory(false);
    haptics.selection();
  }, []);

  const toggleDrawer = useCallback(() => {
    const isOpen = drawerProgress.value > 0.5;
    drawerProgress.value = withTiming(isOpen ? 0 : 1, { duration: 250, easing: Easing.out(Easing.cubic) });
    if (isOpen) handleDrawerClose();
    else handleDrawerOpen();
  }, [handleDrawerOpen, handleDrawerClose]);

  const openGesture = Gesture.Pan()
    .activeOffsetX(10)
    .failOffsetY([-15, 15])
    .hitSlop({ left: 0, right: -(SCREEN_W - 40), top: 0, bottom: 0 })
    .onUpdate((e) => {
      'worklet';
      const progress = Math.max(0, Math.min(1, e.translationX / DRAWER_TRANSLATE));
      drawerProgress.value = progress;
    })
    .onEnd((e) => {
      'worklet';
      const shouldOpen = drawerProgress.value > 0.3 || e.velocityX > 500;
      drawerProgress.value = withTiming(shouldOpen ? 1 : 0, { duration: 250, easing: Easing.out(Easing.cubic) });
      if (shouldOpen) runOnJS(handleDrawerOpen)();
      else runOnJS(handleDrawerClose)();
    });

  const closeGesture = Gesture.Pan()
    .activeOffsetX(-10)
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      'worklet';
      const progress = Math.max(0, 1 + e.translationX / DRAWER_TRANSLATE);
      drawerProgress.value = progress;
    })
    .onEnd((e) => {
      'worklet';
      const shouldClose = drawerProgress.value < 0.7 || e.velocityX < -500;
      drawerProgress.value = withTiming(shouldClose ? 0 : 1, { duration: 250, easing: Easing.out(Easing.cubic) });
      if (shouldClose) runOnJS(handleDrawerClose)();
    });

  const chatCardStyle = useAnimatedStyle(() => {
    const translateX = interpolate(drawerProgress.value, [0, 1], [0, DRAWER_TRANSLATE]);
    const borderRadius = interpolate(drawerProgress.value, [0, 1], [0, DRAWER_RADIUS]);
    return {
      transform: [{ translateX }],
      borderRadius,
      overflow: drawerProgress.value > 0 ? 'hidden' as const : 'visible' as const,
      shadowColor: '#000',
      shadowOffset: { width: -5, height: 0 },
      shadowRadius: 15,
      shadowOpacity: interpolate(drawerProgress.value, [0, 1], [0, 0.25]),
    };
  });

  const closeDrawer = useCallback(() => {
    drawerProgress.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
    handleDrawerClose();
  }, [handleDrawerClose]);

  // Gradient always visible (same background for greeting + chat)
  const gradientFadeStyle = { opacity: 1 };

  // Fade content (not background) when drawer opens
  const contentFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drawerProgress.value, [0, 1], [1, 0.35]),
  }));

  // Determine if we should show chat greeting. Hide as soon as the user has
  // either picked a car (Sprint 4 — no synthetic first message; the picker
  // sets context and the user types their real first message into the input)
  // or sent at least one message.
  const showChatGreeting = state.messages.length === 0 && !isCarConfirmed;

  // Show welcome screen if not seen
  if (!hasSeenWelcome) {
    return <AIWelcomeScreen onContinue={handleWelcomeContinue} />;
  }

  return (
    <View style={styles.drawerRoot}>
      {/* Sidebar background — solid white so the AIChatHistory list
          reads as a clean panel instead of a gray drawer. */}
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF']}
        locations={[0, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Base layer: Sidebar (always rendered, visible when chat card slides right) */}
      <View style={StyleSheet.absoluteFill}>
        <AIChatHistory
          onClose={closeDrawer}
          conversations={conversations}
          onSelectConversation={(id) => {
            handleSelectConversation(id);
            closeDrawer();
          }}
          paddingTop={insets.top}
        />
      </View>

      {/* Chat card — slides right to reveal sidebar */}
      <GestureDetector gesture={showHistory ? closeGesture : openGesture}>
        <Animated.View style={[styles.container, chatCardStyle]}>

      {/* Tap overlay to close drawer when open */}
      {showHistory && (
        <Pressable
          style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
          onPress={closeDrawer}
        />
      )}

      {/* Ambient gradient — matches the onboarding + about-you palette
          (#7BB8FF → #BFDBFE → #FFFFFF, top to bottom) so the AI surface
          shares the same airy blue-to-white feel as the rest of the
          pre-app flows. Always full opacity; messages render on top. */}
      <Animated.View style={[StyleSheet.absoluteFillObject, gradientFadeStyle]} pointerEvents="none">
        <LinearGradient
          colors={['#A5CDFF', '#D6E8FF', '#FFFFFF']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* Content wrapper — fades when drawer opens, background stays full opacity */}
      <Animated.View style={[{ flex: 1 }, contentFadeStyle]}>

      {/* Header — absolutely positioned, floats above scroll */}
      {(showOtoMenu || showRightMenu) && <Pressable style={styles.otoMenuOverlay} onPress={closeOtoMenu} />}
      <Animated.View style={[styles.headerFloating, { paddingTop: insets.top }, (showOtoMenu || showRightMenu) && { zIndex: 100 }]}>
        {/* Left: Hamburger + Profile avatar */}
        <View style={styles.headerSide}>
          {isLiquidGlassEnabled && LiquidGlassView ? (
            <Pressable onPress={toggleDrawer}>
              <LiquidGlassView interactive effect="regular" style={styles.glassIconPill}>
                <AlignLeft size={20} color="#000000" />
              </LiquidGlassView>
            </Pressable>
          ) : (
            <Pressable
              onPress={toggleDrawer}
              style={({ pressed }) => [styles.headerIcon, pressed && styles.headerIconPressed]}
            >
              <AlignLeft size={22} color="#000000" />
            </Pressable>
          )}
          <ProfileInitialsButton />
        </View>

        {/* Center: Oto model selector */}
        <View style={styles.headerCenter}>
          {isLiquidGlassEnabled && LiquidGlassView ? (
            <Pressable onPress={toggleOtoMenu}>
              <LiquidGlassView interactive effect="regular" style={styles.glassCenterPill}>
                <View style={styles.glassExpandableRow}>
                  <Text style={styles.glassTitleText} size="md" weight="semiBold">
                    {selectedModel === 'pro' ? 'Oto Pro' : 'Oto'}
                  </Text>
                </View>
                <Animated.View style={expandedMenuStyle}>
                  <View style={styles.otoExpandedDivider} />
                  <Pressable
                    onPress={() => { setSelectedModel('pro'); closeOtoMenu(); }}
                    style={({ pressed }) => [styles.modelOptionItem, pressed && { opacity: 0.6 }]}
                  >
                    <View style={styles.modelOptionRow}>
                      <Sparkles size={18} color="#000000" style={{ marginTop: 2 }} />
                      <View style={styles.modelOptionTextContainer}>
                        <View style={styles.modelOptionTitleRow}>
                          <Text size="sm" weight="semiBold" style={styles.otoMenuItemText}>Oto Pro</Text>
                          {selectedModel === 'pro' && <View style={styles.modelSelectedDot} />}
                        </View>
                        <Text size="xs" weight="regular" style={styles.modelOptionDescription}>
                          Maximum quality and reasoning. Prioritizes depth over speed.
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => { setSelectedModel('flash'); closeOtoMenu(); }}
                    style={({ pressed }) => [styles.modelOptionItem, pressed && { opacity: 0.6 }]}
                  >
                    <View style={styles.modelOptionRow}>
                      <Zap size={18} color="#000000" style={{ marginTop: 2 }} />
                      <View style={styles.modelOptionTextContainer}>
                        <View style={styles.modelOptionTitleRow}>
                          <Text size="sm" weight="semiBold" style={styles.otoMenuItemText}>Oto Flash</Text>
                          {selectedModel === 'flash' && <View style={styles.modelSelectedDot} />}
                        </View>
                        <Text size="xs" weight="regular" style={styles.modelOptionDescription}>
                          Fast, everyday responses. Great for quick questions and tasks.
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              </LiquidGlassView>
            </Pressable>
          ) : isMenuViewAvailable ? (
            <MenuView
              onPressAction={({ nativeEvent }) => {
                haptics.selection();
                if (nativeEvent.event === 'pro') setSelectedModel('pro');
                else if (nativeEvent.event === 'flash') setSelectedModel('flash');
              }}
              actions={[
                {
                  id: 'pro',
                  title: 'Oto Pro',
                  subtitle: 'Maximum quality and reasoning. Prioritizes depth over speed.',
                  image: 'sparkles',
                  state: selectedModel === 'pro' ? 'on' : 'off',
                },
                {
                  id: 'flash',
                  title: 'Oto Flash',
                  subtitle: 'Fast, everyday responses. Great for quick questions and tasks.',
                  image: 'bolt.fill',
                  state: selectedModel === 'flash' ? 'on' : 'off',
                },
              ]}
            >
              <View style={styles.modelSelectorButton}>
                <View style={styles.pillContent}>
                  <Text style={styles.glassTitleText} size="md" weight="semiBold">
                    {selectedModel === 'pro' ? 'Oto Pro' : 'Oto'}
                  </Text>
                  <ChevronDown size={12} color="rgba(0,0,0,0.3)" />
                </View>
              </View>
            </MenuView>
          ) : (
            <Pressable
              onPress={() => {
                haptics.selection();
                setSelectedModel((prev) => (prev === 'pro' ? 'flash' : 'pro'));
              }}
              style={({ pressed }) => [styles.modelSelectorButton, pressed && styles.headerIconPressed]}
            >
              <View style={styles.pillContent}>
                <Text style={styles.glassTitleText} size="md" weight="semiBold">
                  {selectedModel === 'pro' ? 'Oto Pro' : 'Oto'}
                </Text>
                <ChevronDown size={12} color="rgba(0,0,0,0.3)" />
              </View>
            </Pressable>
          )}
        </View>

        {/* Right: Compose pill */}
        <View style={styles.headerSideRight}>
          {isLiquidGlassEnabled && LiquidGlassView ? (
            <Pressable onPress={startNewChat} onLongPress={toggleRightMenu}>
              <LiquidGlassView interactive effect="regular" style={styles.glassRightExpandablePill}>
                <View style={styles.glassExpandableRow}>
                  <SquarePen size={18} color="#000000" />
                </View>
                <Animated.View style={rightExpandedStyle}>
                  <View style={styles.otoExpandedDivider} />
                  <Pressable
                    onPress={() => { closeRightMenu(); startNewChat(); }}
                    style={({ pressed }) => [styles.otoExpandedItem, pressed && { opacity: 0.6 }]}
                  >
                    <SquarePen size={16} color="#000000" />
                    <Text size="sm" weight="medium" style={styles.otoMenuItemText}>
                      New Chat
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { closeRightMenu(); }}
                    style={({ pressed }) => [styles.otoExpandedItem, pressed && { opacity: 0.6 }]}
                  >
                    <CarFront size={16} color="#000000" />
                    <Text size="sm" weight="medium" style={styles.otoMenuItemText}>
                      Change Vehicle
                    </Text>
                  </Pressable>
                </Animated.View>
              </LiquidGlassView>
            </Pressable>
          ) : isMenuViewAvailable ? (
            <MenuView
              onPressAction={({ nativeEvent }) => {
                if (nativeEvent.event === 'new_chat') startNewChat();
                if (nativeEvent.event === 'change_vehicle') startNewChat();
              }}
              actions={[
                {
                  id: 'new_chat',
                  title: 'New Chat',
                  image: 'square.and.pencil',
                },
                {
                  id: 'change_vehicle',
                  title: 'Change Vehicle',
                  image: 'car.fill',
                },
              ]}
            >
              <View style={styles.headerIcon}>
                <SquarePen size={20} color="#000000" />
              </View>
            </MenuView>
          ) : (
            <Pressable
              onPress={startNewChat}
              style={({ pressed }) => [styles.headerIcon, pressed && styles.headerIconPressed]}
            >
              <SquarePen size={20} color="#000000" />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Context bar — shows selected vehicle during chat */}
      {!showChatGreeting && selectedVehicle && (
        <AIContextBar
          vehicle={selectedVehicle}
          onChangeVehicle={startNewChat}
          top={HEADER_HEIGHT + 8}
        />
      )}

      {/* Main Content */}
      <View
        style={[
          { flex: 1 },
          showChatGreeting && { overflow: 'visible' },
        ]}
      >
        {/* Chat Area */}
        <ScrollView
          ref={scrollViewRef}
          style={[styles.chatContainer, showChatGreeting && styles.chatContainerGreeting]}
          contentContainerStyle={[
            styles.chatContent,
            showChatGreeting ? styles.chatContentCentered : { paddingTop: HEADER_HEIGHT + 16 + (selectedVehicle ? 52 : 0), paddingBottom: (keyboardHeight > 0 ? keyboardHeight + 8 : bottomPadding + 8) + 70 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!showChatGreeting}
        >
          {showChatGreeting ? (
            <AIGreeting
              userName={userFirstName}
              suggestions={WELCOME_SUGGESTIONS}
              onSuggestionPress={handleSuggestionPress}
              vehicles={greetingVehicles}
              selectedVehicleVin={selectedVehicleVin}
              onVehicleSelect={setSelectedVehicleVin}
              keyboardVisible={isKeyboardVisible && isCarConfirmed}
              onVehicleConfirm={(vin, vehicle) => {
                // Sprint 3 Day 4 §15.12 / Sprint 4 ticket §9 — confirming a
                // car selects vehicle context only. The user types their real
                // first message; the vehicleVin arg on sendMessage carries
                // the context to Oto without a synthetic injection.
                setSelectedVehicleVin(vin);
                setIsCarConfirmed(true);
                if (vehicle) setSelectedVehicle(vehicle);
              }}
            />
          ) : (
            <>
              {/* Empty-state greeting headline — per Sprint 4 brief §3.2,
                  the entry screen should lead with a personalized concierge
                  line, not a booking menu. Shown only on the first turn;
                  vanishes once any message has been sent. */}
              {state.messages.length === 0 && (
                <View style={styles.emptyStateGreetingWrap}>
                  <Text style={styles.emptyStateGreetingHeadline} weight="semiBold">
                    Hi, how can I help with your {vehicleShortName}?
                  </Text>
                </View>
              )}
              {state.messages.map((message) => {
                // Sprint 4 §"Cross-cutting frontend rules" — terminal
                // renders are mutually exclusive. The dispatcher and prompt
                // both enforce this server-side; this guard is defensive
                // insurance against a malformed envelope ever reaching the
                // client. Priority order matches the handoff doc:
                // bookService → showRecordConfirmation → bookingCard /
                // bookingsList → linkButton. When any terminal is set, we
                // also drop quickReplies from the bubble so a confused
                // payload can't double-render a tap surface.
                const isAssistant = message.role === "assistant";
                const terminalKind: "bookService" | "recordConfirm" | "vehicleUpdate" | "bookingCard" | "bookingsList" | "linkButton" | null =
                  isAssistant
                    ? message.bookService
                      ? "bookService"
                      : message.showRecordConfirmation
                        ? "recordConfirm"
                        : message.showVehicleUpdate
                          ? "vehicleUpdate"
                          : message.bookingCard
                            ? "bookingCard"
                            : message.bookingsList
                              ? "bookingsList"
                              : message.linkButton
                                ? "linkButton"
                                : null
                    : null;
                const messageForBubble = terminalKind
                  ? { ...message, quickReplies: undefined }
                  : message;
                return (
                  <View key={message.id}>
                    <AIMessageBubble
                      message={messageForBubble as AIMessage}
                      onCopy={() => handleCopy(message.content)}
                      onSpeak={() => handleSpeak(message.content)}
                      onLike={() => openFeedbackModal("thumbs_up", message)}
                      onDislike={() => openFeedbackModal("thumbs_down", message)}
                      onQuickReplySelect={handleQuickReplySelect}
                    />
                    {terminalKind === "bookService" && message.bookService && (
                      <View style={styles.servicePickerContainer}>
                        <BookServiceComponent
                          payload={message.bookService}
                          disabled={isProcessing}
                          onBookAndPay={(mechanicId) => {
                            pushFact(`selected mechanic_id: ${mechanicId}`);
                          }}
                          onDismiss={() => {
                            pushFact("booking_flow_dismissed");
                          }}
                        />
                      </View>
                    )}
                    {terminalKind === "recordConfirm" && message.showRecordConfirmation && (
                      <View style={styles.servicePickerContainer}>
                        <AIRecordConfirmation
                          vehicleId={message.showRecordConfirmation.vehicle_id}
                          maintenanceType={message.showRecordConfirmation.maintenance_type}
                          onDecision={handleRecordDecision}
                          disabled={isProcessing}
                        />
                      </View>
                    )}
                    {terminalKind === "vehicleUpdate" && message.showVehicleUpdate && (
                      <View style={styles.servicePickerContainer}>
                        <AIVehicleUpdate
                          payload={message.showVehicleUpdate}
                          onDecision={handleVehicleUpdateDecision}
                          disabled={isProcessing}
                        />
                      </View>
                    )}
                    {terminalKind === "bookingCard" && message.bookingCard && (
                      <BookingCard bookingId={message.bookingCard.booking_id} />
                    )}
                    {terminalKind === "bookingsList" && message.bookingsList && (
                      <BookingsList bookingIds={message.bookingsList.booking_ids} />
                    )}
                    {terminalKind === "linkButton" && message.linkButton && (
                      <LinkButton payload={message.linkButton} />
                    )}
                  </View>
                );
              })}
              {/* Typing indicator: show only while we're WAITING for the
                  assistant's reply. The moment any assistant message lands
                  in the list (= last message flips to role 'assistant'),
                  its streaming bubble takes over the visual focus and the
                  indicator hides immediately — independent of whether the
                  message has reasoning, sources, or render envelopes. */}
              {(() => {
                const lastMsg = state.messages[state.messages.length - 1];
                const isWaitingForReply = !lastMsg || lastMsg.role !== "assistant";
                return isProcessing && isWaitingForReply ? (
                  <View style={styles.typingIndicatorWrapper}>
                    <AITypingIndicator />
                  </View>
                ) : null;
              })()}
              {/* Seed suggestions — only on the first turn of a chat, never
                  after the user has sent a message. Visually de-emphasized
                  per brief §3.2: the greeting headline is primary, these
                  are optional shortcuts. */}
              {state.messages.length === 0 &&
                state.suggestions.length > 0 &&
                !isProcessing &&
                !isAttachmentOpen && (
                  <View style={styles.emptyStateSuggestionsWrap}>
                    <Text style={styles.emptyStateSuggestionsCaption}>
                      or pick a shortcut
                    </Text>
                    <PromptSuggestions
                      stage={state.currentStage}
                      suggestions={state.suggestions}
                      onSelect={handleSuggestionPress}
                      disabled={isProcessing}
                    />
                  </View>
                )}
            </>
          )}
        </ScrollView>

      </View>

      {/* Input area — absolutely positioned above keyboard */}
      {!showChatGreeting && (
        <View style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: keyboardHeight > 0 ? keyboardHeight + 8 : bottomPadding + 8,
        }}>
          <AISelectedImages
            images={selectedImages}
            onRemove={handleRemoveImage}
          />
          <AIInputBox
            value={inputValue}
            onChangeText={setInputValue}
            onSend={handleSend}
            isLoading={isProcessing}
            onFocus={handleInputFocus}
            onMicPressIn={handleMicPressIn}
            onMicPressOut={handleMicPressOut}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            meteringValue={meteringValue}
            transcript={transcript}
            isAttachmentOpen={isAttachmentOpen}
            onToggleAttachment={handleToggleAttachment}
            hasImages={selectedImages.length > 0}
          />
          {isAttachmentOpen && (
            <AIAttachmentPanel
              visible={isAttachmentOpen}
              onClose={() => setIsAttachmentOpen(false)}
              selectedImages={selectedImages}
              onToggleImage={handleToggleImage}
            />
          )}
        </View>
      )}

      {/* Toast notifications now surface through the global <ToastProvider> in app/_layout.tsx. */}

      {/* Sprint 4 — per-message feedback modal. Thumbs-up / thumbs-down on
          the message bubble opens this; submit writes to api.ai_feedback. */}
      {feedbackModalState && convexConversationId && (
        <AIFeedbackModal
          visible={true}
          rating={feedbackModalState.rating}
          conversationId={convexConversationId}
          messageId={feedbackModalState.messageId}
          messageContent={feedbackModalState.messageContent}
          onClose={closeFeedbackModal}
        />
      )}

      </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  drawerRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    // transparent so the LinearGradient layer underneath shows through
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerFloating: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    zIndex: 10,
  },
  // Left + right zones share the same width so the centered "Oto" pill
  // stays optically centered. 40 (hamburger) + 10 (gap) + 40 (avatar) =
  // 90 on the left; the right side reserves the same width with the
  // compose pill anchored to the far right.
  headerSide: {
    width: 90,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerSideRight: {
    width: 90,
    alignItems: "flex-end",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerIcon: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerIconPressed: {
    opacity: 0.6,
  },
  headerTitle: {
    color: "#000000",
    fontFamily: FontFamily.semiBold,
    textAlign: "center",
  },
  // Liquid glass header styles
  glassTitleText: {
    color: "#000000",
    fontFamily: FontFamily.semiBold,
  },
  glassIconPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  glassCenterPill: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  modelSelectorButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  glassRightExpandablePill: {
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  // Expanding menus
  otoMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
  },
  glassExpandableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  otoExpandedDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    marginTop: 10,
    marginBottom: 2,
  },
  otoExpandedItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
  },
  otoMenuItemText: {
    color: "#000000",
  },
  modelOptionItem: {
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  modelOptionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  modelOptionTextContainer: {
    flex: 1,
    gap: 2,
  },
  modelOptionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modelOptionDescription: {
    color: "rgba(0, 0, 0, 0.45)",
    lineHeight: 16,
  },
  modelSelectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#007AFF",
  },
  content: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  chatContainerGreeting: {
    overflow: 'visible',
  },
  chatContent: {
    flexGrow: 1,
    paddingVertical: Spacing.md,
  },
  chatContentCentered: {
    justifyContent: 'center',
  },
  chatContentGreeting: {
    flexGrow: 0,
  },
  typingIndicatorWrapper: {
    paddingHorizontal: Spacing.lg,
  },
  servicePickerContainer: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  emptyStateGreetingWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing.md,
    alignItems: "center",
  },
  emptyStateGreetingHeadline: {
    fontSize: 22,
    lineHeight: 30,
    color: "#000000",
    textAlign: "center",
  },
  emptyStateSuggestionsWrap: {
    opacity: 0.7,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  emptyStateSuggestionsCaption: {
    fontSize: 12,
    color: "#000000",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
});
