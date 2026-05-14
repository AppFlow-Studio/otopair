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
 *   - Service picker for scheduling (AIServicePicker)
 *   - Mechanic carousel for booking (AIBookingCarousel)
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
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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

// 4. Flow-specific components
import {
  AIGreeting,
  AIContextBar,
  AIMessageBubble,
  AIInputBox,
  AITypingIndicator,
  AIChatHistory,
  PromptSuggestions,
  AIBookingCarousel,
  AIWelcomeScreen,
  AIServicePicker,
  AIDiagnosticForm,
  DIAGNOSTIC_SYSTEMS,
  AIRecordConfirmation,
  type RecordConfirmationDecision,
  AIToast,
  AIAttachmentPanel,
  AISelectedImages,
  type AIMessage,
  type Suggestion,
  type QuickReply,
  type ServiceOption,
  type SelectedTimeSlot,
  type VehicleCard,
} from "@/components/ai-chat";
import type { DiagnosticSystem } from "@/lib/diagnostic-checklist-templates";

// 5. Constants, hooks, types, stores
import { BrandColors, Spacing, FontFamily } from "@/constants/theme";
import { useAIChatStore } from "@/stores/useAIChatStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { formatMake } from "@/utils/formatMake";
import { createInitialState, processUserMessage, WELCOME_SUGGESTIONS } from "@/services/ai/scenarioEngine";
import type { ConversationState, ChatMessage, AIMechanic, SelectedService } from "@/services/ai/types";

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
    return rows.map((row: Doc<"ai_conversations">) => ({
      id: row._id as string,
      title:
        row.scenario_detected && row.scenario_detected.length > 0
          ? row.scenario_detected
          : `Conversation ${new Date(row.started_at).toLocaleDateString()}`,
    }));
  }, [convexConversationsRaw]);

  // Booking store for navigation to payment
  const selectMechanic = useBookingStore((state) => state.selectMechanic);
  const setScheduledAppointment = useBookingStore((state) => state.setScheduledAppointment);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const clearSelectedServices = useBookingStore((state) => state.clearSelectedServices);
  const setBookingStage = useBookingStore((state) => state.setBookingStage);

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

  // Local UI state
  const [inputValue, setInputValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Toast state
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  
  // Car selection state — input bar hidden until car confirmed
  const [isCarConfirmed, setIsCarConfirmed] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCard | null>(null);

  // Attachment panel state
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  }, []);

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

        const { text, quickReplies, showDiagnosticForm, showRecordConfirmation } = await sendMessageAction({
          conversationId,
          message: messageText,
          // Pass the frontend's vehicle-picker selection so the action
          // doesn't fall back to "most recently added" when the user has
          // explicitly chosen a different car.
          vehicleVin: selectedVehicleVin ?? undefined,
        });

        const diagnosticFormEnvelope = showDiagnosticForm as
          | { initialSystem?: DiagnosticSystem; initialNotes?: string }
          | undefined;

        // Record-confirmation envelope — fired when Oto detects a symptom
        // contradicts a self_reported maintenance record and wants the user
        // to verify (or correct) the record before reasoning further.
        const recordConfirmEnvelope = showRecordConfirmation as
          | { vehicle_id: string; maintenance_type: import("@/utils/maintenanceStatus").MaintenanceType }
          | undefined;

        const aiMessage: ChatMessage = {
          id: `ai_${Date.now()}`,
          role: "assistant",
          content: text,
          timestamp: new Date().toISOString(),
          isStreaming: true,
          // Render directives emitted by the AI's tool calls — currently
          // `render_quick_replies`, `render_diagnostic_form`, and
          // `render_record_confirmation` are wired.
          quickReplies: quickReplies as QuickReply[] | undefined,
          showDiagnosticForm: diagnosticFormEnvelope,
          showRecordConfirmation: recordConfirmEnvelope,
          stage: diagnosticFormEnvelope ? "diagnostic_form" : undefined,
        };
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, aiMessage],
          currentStage: diagnosticFormEnvelope
            ? "diagnostic_form"
            : prev.currentStage,
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
      const aiMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: "assistant",
        content: response.message,
        timestamp: new Date().toISOString(),
        reasoning: response.reasoning,
        sources: response.sources,
        quickReplies: response.quickReplies,
        sections: response.sections,
        shops: response.shops,
        showServicePicker: response.showServicePicker,
        showDiagnosticForm: response.showDiagnosticForm,
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

  // Handle Book Now from mechanic carousel - navigates to payment screen
  const handleBookNow = useCallback(
    (mechanic: AIMechanic, timeSlot: SelectedTimeSlot) => {
      // Map AI service selection to booking store service IDs
      const serviceIdMapping: Record<string, string> = {
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

      // Clear existing services and add selected ones from AI chat
      clearSelectedServices();

      // Add services from AI state
      state.selectedServices.forEach((service) => {
        const mappedId = serviceIdMapping[service.id] || service.id;
        toggleServiceSelection(mappedId);
      });

      // If no services selected, add a default service based on scenario type
      if (state.selectedServices.length === 0) {
        const scenario = state.currentScenario as string;
        switch (scenario) {
          case "brake_noise":
            toggleServiceSelection("svc_brake_pads");
            break;
          case "check_engine":
            toggleServiceSelection("svc_engine_diagnostic");
            break;
          case "tire_pressure":
            toggleServiceSelection("svc_tire_rotation");
            break;
          case "vague_issue":
            toggleServiceSelection("svc_electrical_check");
            break;
          case "oil_change":
          default:
            toggleServiceSelection("svc_oil_change");
            break;
        }
      }

      // Select the mechanic (use the mechanic's actual ID from mock data)
      selectMechanic(mechanic.id.toString());

      // Set the scheduled appointment from the time slot
      const currentYear = new Date().getFullYear();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const currentMonth = new Date().getMonth();
      const dayNum = parseInt(timeSlot.day);

      // Create ISO date string
      const appointmentDate = new Date(currentYear, currentMonth, dayNum);
      const isoDate = appointmentDate.toISOString().split("T")[0];
      const displayDate = `${dayNum} ${months[currentMonth]} ${currentYear}`;

      setScheduledAppointment({
        date: isoDate,
        time: timeSlot.time,
        displayDate,
      });

      // Set booking stage to payment
      setBookingStage("payment", "forward");

      // Navigate to payment screen
      router.push(`/home/mechanic/${mechanic.id}/payment`);
    },
    [
      state.selectedServices,
      clearSelectedServices,
      toggleServiceSelection,
      selectMechanic,
      setScheduledAppointment,
      setBookingStage,
      router,
    ]
  );

  // Handle service selection from service picker. The user echo goes
  // through sendToOtoAI so Haiku reasons about the actual selection
  // against the user's vehicle context — replaces the previous canned
  // "Great choices!" template that fired regardless of what was picked.
  const handleServiceSelect = useCallback(
    (services: ServiceOption[]) => {
      if (services.length === 0 || isProcessing) return;

      // Keep the SelectedService array on state — the booking flow
      // downstream (handleBookNow) still reads from state.selectedServices.
      const selectedServices: SelectedService[] = services.map((s) => ({
        id: s.id,
        name: s.name,
        estimatedPrice: s.price,
      }));
      setState((prev) => ({ ...prev, selectedServices }));

      const serviceNames = services.map((s) => s.name).join(", ");
      sendToOtoAI(`I'd like to schedule: ${serviceNames}`);
    },
    [isProcessing, sendToOtoAI]
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
      if (decision.kind === "confirmed") {
        echoText = `Confirmed — ${decision.type} record is correct as-is.`;
      } else {
        const dateStr = new Date(decision.lastServiceDate).toLocaleDateString(
          undefined,
          { month: "long", year: "numeric" },
        );
        const mileagePart = decision.lastServiceMileage
          ? ` at ${decision.lastServiceMileage.toLocaleString()} mi`
          : "";
        echoText = `Updated — last ${decision.type} service was actually in ${dateStr}${mileagePart}.`;
      }
      sendToOtoAI(echoText);
    },
    [isProcessing, sendToOtoAI],
  );

  // Handle diagnostic-form confirmation from AIDiagnosticForm
  const handleDiagnosticFormConfirm = useCallback(
    (system: DiagnosticSystem, notes: string) => {
      if (isProcessing) return;
      setIsProcessing(true);

      const label = DIAGNOSTIC_SYSTEMS.find((s) => s.value === system)?.label ?? system;
      const userEcho = notes ? `${label}\n\n${notes}` : label;

      // 1. Push synthetic user message + merge diagnostic state
      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: userEcho,
        timestamp: new Date().toISOString(),
        stage: "diagnostic_form",
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        selectedDiagnosticSystem: system,
        diagnosticNotes: notes,
      }));

      // 2. AI follow-up after the same thinking delay used by handleServiceSelect.
      setTimeout(() => {
        const aiMessage: ChatMessage = {
          id: `ai_${Date.now()}`,
          role: "assistant",
          content: `Got it — locking this in for **${label}**${
            notes ? " with your note attached" : ""
          }.\n\nHow would you like me to find mechanics?`,
          timestamp: new Date().toISOString(),
          quickReplies: [
            { id: "closest", text: "Closest", value: "closest", variant: "default" },
            { id: "best_rated", text: "Best rated", value: "best_rated", variant: "default" },
            { id: "best_price", text: "Best price", value: "best_price", variant: "default" },
          ],
          stage: "priority_selection",
          isStreaming: true,
        };

        setState((prevState) => {
          const newStateWithMessage = {
            ...prevState,
            messages: [...prevState.messages, aiMessage],
            currentStage: "priority_selection" as const,
            suggestions: [
              { id: "closest", text: "Closest", value: "closest" },
              { id: "best_rated", text: "Best rated", value: "best_rated" },
              { id: "best_price", text: "Best price", value: "best_price" },
            ],
          };
          queueMicrotask(() => saveCurrentConversation(newStateWithMessage));
          return newStateWithMessage;
        });

        setTimeout(() => {
          setState((prev) => {
            const finalState = {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === aiMessage.id ? { ...m, isStreaming: false } : m
              ),
            };
            setTimeout(() => saveCurrentConversation(finalState), 0);
            return finalState;
          });
          setIsProcessing(false);
        }, aiMessage.content.length * 30);
      }, 1000);
    },
    [isProcessing, saveCurrentConversation]
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

  // Handle feedback
  const handleLike = useCallback(() => {
    showToast("Thank you for your feedback!");
  }, [showToast]);

  const handleDislike = useCallback(() => {
    showToast("Thank you for your feedback!");
  }, [showToast]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setShowHistory(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  // Determine if we should show chat greeting (no messages yet)
  const showChatGreeting = state.messages.length === 0;

  // Show welcome screen if not seen
  if (!hasSeenWelcome) {
    return <AIWelcomeScreen onContinue={handleWelcomeContinue} />;
  }

  return (
    <View style={styles.drawerRoot}>
      {/* Sidebar gradient — covers full screen behind everything */}
      <LinearGradient
        colors={['#EDEDED', '#EDEDED']}
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

      {/* Background Gradient — fades out when messages exist, revealing white root */}
      <Animated.View style={[StyleSheet.absoluteFillObject, gradientFadeStyle]} pointerEvents="none">
        <LinearGradient
          colors={['#FFFFFF', '#FFFFFF']}
          locations={[0, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* Content wrapper — fades when drawer opens, background stays full opacity */}
      <Animated.View style={[{ flex: 1 }, contentFadeStyle]}>

      {/* Header — absolutely positioned, floats above scroll */}
      {(showOtoMenu || showRightMenu) && <Pressable style={styles.otoMenuOverlay} onPress={closeOtoMenu} />}
      <Animated.View style={[styles.headerFloating, { paddingTop: insets.top }, (showOtoMenu || showRightMenu) && { zIndex: 100 }]}>
        {/* Left: Hamburger circle */}
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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                setSelectedVehicleVin(vin);
                setIsCarConfirmed(true);
                if (vehicle) setSelectedVehicle(vehicle);
                if (vehicle) {
                  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
                  sendToOtoAI(`I'd like to confirm my ${vehicleLabel}`);
                }
              }}
            />
          ) : (
            <>
              {state.messages.map((message) => (
                <View key={message.id}>
                  <AIMessageBubble
                    message={message as AIMessage}
                    onCopy={() => handleCopy(message.content)}
                    onSpeak={() => handleSpeak(message.content)}
                    onLike={handleLike}
                    onDislike={handleDislike}
                    onQuickReplySelect={handleQuickReplySelect}
                  />
                  {/* Service Picker (for service selection) */}
                  {message.role === "assistant" &&
                    message.showServicePicker &&
                    state.currentStage === "service_selection" && (
                      <View style={styles.servicePickerContainer}>
                        <AIServicePicker onConfirm={handleServiceSelect} disabled={isProcessing} />
                      </View>
                    )}
                  {/* Diagnostic Form (pre-filled subsystem + notes) */}
                  {message.role === "assistant" &&
                    message.showDiagnosticForm &&
                    state.currentStage === "diagnostic_form" && (
                      <View style={styles.servicePickerContainer}>
                        <AIDiagnosticForm
                          initialSystem={message.showDiagnosticForm.initialSystem}
                          initialNotes={message.showDiagnosticForm.initialNotes}
                          vehicleId={selectedVehicleVin ?? ""}
                          onConfirm={handleDiagnosticFormConfirm}
                          disabled={isProcessing}
                        />
                      </View>
                    )}
                  {/* Record Confirmation — symptom-vs-record trust protocol */}
                  {message.role === "assistant" &&
                    message.showRecordConfirmation && (
                      <View style={styles.servicePickerContainer}>
                        <AIRecordConfirmation
                          vehicleId={message.showRecordConfirmation.vehicle_id}
                          maintenanceType={message.showRecordConfirmation.maintenance_type}
                          onDecision={handleRecordDecision}
                          disabled={isProcessing}
                        />
                      </View>
                    )}
                  {/* Mechanic Carousel (for mechanic selection messages) */}
                  {message.role === "assistant" && message.shops && message.shops.length > 0 && (
                    <View style={styles.carouselContainer}>
                      <AIBookingCarousel shops={message.shops} onBookNow={handleBookNow} />
                    </View>
                  )}
                </View>
              ))}
              {/* Only show typing indicator if not already shown inside message with reasoning */}
              {isProcessing && !state.messages.some(m => m.role === 'assistant' && m.reasoning && m.reasoning.length > 0 && m.isStreaming) && (
                <View style={styles.typingIndicatorWrapper}>
                  <AITypingIndicator />
                </View>
              )}
              {/* Suggestions directly under AI message */}
              {state.suggestions.length > 0 && !isProcessing && !isAttachmentOpen && (
                <PromptSuggestions
                  stage={state.currentStage}
                  suggestions={state.suggestions}
                  onSelect={handleSuggestionPress}
                  disabled={isProcessing}
                />
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

      {/* Toast Notification */}
      <AIToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />

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
    backgroundColor: '#FFFFFF',
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
  headerSide: {
    width: 50,
    alignItems: "flex-start",
  },
  headerSideRight: {
    width: 50,
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
  carouselContainer: {
    marginBottom: Spacing.md,
  },
  typingIndicatorWrapper: {
    paddingHorizontal: Spacing.lg,
  },
  servicePickerContainer: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
});
