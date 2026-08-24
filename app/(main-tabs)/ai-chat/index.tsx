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
import { View, ScrollView, StyleSheet, Pressable, Alert, Platform, Keyboard, useWindowDimensions, Dimensions, UIManager, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";

// 2. Expo & Third-party
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSpring, Easing, interpolate, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { haptics } from "@/lib/haptics";
import { useToast } from "@/hooks/useToast";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { useCanWrite } from "@/hooks/useConnection";
import { AlignLeft, SquarePen, Ellipsis, History, CarFront, Copy, Volume2, Clock, ImageOff, AlertCircle, WifiOff, type LucideIcon } from "lucide-react-native";
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
import { Image } from "expo-image";
import { ProfileInitialsButton } from "@/components/home/ProfileInitialsButton";

// 4. Flow-specific components
import {
  AIGreeting,
  SymptomTrackerPin,
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

// Persisted flag for the one-time Oto AI welcome/disclaimer. Once the user
// taps Continue, we never show it again — the zustand flag only survives the
// session, so we back it with SecureStore for across-launch memory.
const OTO_WELCOME_SEEN_KEY = "oto_ai_welcome_seen_v1";

// Drawer sidebar constants
const DRAWER_TRANSLATE = Dimensions.get('window').width * 0.78;
const DRAWER_SCALE = 0.92;
const DRAWER_RADIUS = 40;

// Map a thrown Oto/Convex/Anthropic error to a short, human line. The raw
// message carries a full stack trace + provider JSON (credit balance, request
// ids) which must never land in the transcript — we log that for debugging
// and show the user one of these instead.
function friendlyOtoError(err: unknown): string {
  const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (
    raw.includes("credit balance") ||
    raw.includes("billing") ||
    raw.includes("quota") ||
    raw.includes("insufficient")
  ) {
    return "Oto's temporarily unavailable. Please try again a little later.";
  }
  if (
    raw.includes("rate limit") ||
    raw.includes("429") ||
    raw.includes("overloaded") ||
    raw.includes("529")
  ) {
    return "Oto's a bit busy right now — give it a moment and try again.";
  }
  if (
    raw.includes("network") ||
    raw.includes("failed to fetch") ||
    raw.includes("timeout") ||
    raw.includes("timed out")
  ) {
    return "Connection hiccup — check your signal and try again.";
  }
  return "Oto ran into a problem. Please try again in a moment.";
}

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
  // Android: the keyboard event's endCoordinates.height under-reports the
  // occluded area slightly (edge-to-edge window metrics), which left the input
  // card's lower edge clipped under the keyboard (QA: "the text box gets cut
  // off by the keyboard"). Full insets.bottom over-corrects on gesture-nav
  // devices (card floats high) — the right compensation is a small fixed
  // nudge so the card sits flush with the keyboard top. iOS's
  // keyboardWillShow height spans the full occluded area; no nudge needed.
  const keyboardBottomInset = Platform.OS === "android" ? 24 : 0;
  const HEADER_HEIGHT = insets.top + Spacing.md * 2 + 40;

  // Welcome screen state (from Zustand store)
  const hasSeenWelcome = useAIChatStore((state) => state.hasSeenWelcome);
  const setHasSeenWelcome = useAIChatStore((state) => state.setHasSeenWelcome);
  // Gate the welcome decision on the persisted flag so a returning user
  // doesn't flash the disclaimer while SecureStore resolves on a cold launch.
  const [welcomeChecked, setWelcomeChecked] = useState(false);
  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(OTO_WELCOME_SEEN_KEY)
      .then((v) => {
        if (!active) return;
        if (v === "1") setHasSeenWelcome(true);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setWelcomeChecked(true);
      });
    return () => {
      active = false;
    };
  }, [setHasSeenWelcome]);

  // Chat history state — sidebar list now sourced from Convex so Oto-AI-path
  // conversations show up across mounts. saveCurrentConversation/loadConversation
  // still drive the legacy rule-engine paths until those are retired in Phase 2.
  const saveCurrentConversation = useAIChatStore((state) => state.saveCurrentConversation);
  const loadConversation = useAIChatStore((state) => state.loadConversation);
  const startNewConversation = useAIChatStore((state) => state.startNewConversation);

  const convex = useConvex();
  const convexConversationsRaw = useQuery(api.ai_conversations.getByUserId);
  const conversations = React.useMemo(() => {
    // Hide empty conversations from the sidebar. A row is created on first
    // send, but `message_count` only bumps after a successful turn — so a
    // chat where nothing was said (or the send failed) sits at 0 and is
    // just noise ("New conversation") in history. Keep anything with a real
    // message, a user-set title, or an AI summary; drop the rest.
    const rows = (convexConversationsRaw ?? []).filter(
      (row: Doc<"ai_conversations">) =>
        (row.message_count ?? 0) > 0 ||
        !!(row.custom_title && row.custom_title.trim()) ||
        !!(row.arc_summary && row.arc_summary.trim()),
    );
    return rows.map((row: Doc<"ai_conversations">) => {
      // A user-set (renamed) title always wins. Otherwise build a compact,
      // topic-y title from Oto's running summary: strip the "User …" prefix
      // Oto narrates with → take just the first sentence → cap at 32 chars
      // so the sidebar row never gets cut off mid-word by numberOfLines.
      const custom = (row.custom_title ?? "").trim();
      let title = "New conversation";
      if (custom.length > 0) {
        title = custom.length > 32 ? `${custom.slice(0, 32).trim()}…` : custom;
      } else {
        const raw = (row.arc_summary ?? row.scenario_detected ?? "").trim();
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
      }
      return {
        id: row._id as string,
        title,
        pinned: !!row.pinned_at,
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
  const deleteConversation = useMutation(api.ai_conversations.remove);
  const renameConversation = useMutation(api.ai_conversations.rename);
  const setConversationPinned = useMutation(api.ai_conversations.setPinned);
  const [convexConversationId, setConvexConversationId] =
    useState<Id<"ai_conversations"> | null>(null);
  // Issue 2 (Aug-08 QA) — reactive read of the open-symptom ledger for the
  // pinned "Tracking: …" list. Rows appear when the server classifier appends
  // them mid-turn and clear when a booking render marks them addressed.
  const openSymptoms = useQuery(
    api.ai_conversations.getOpenSymptoms,
    convexConversationId ? { id: convexConversationId } : "skip",
  );
  const hasOpenSymptoms = (openSymptoms?.length ?? 0) > 0;
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

  // Single-car auto-confirm (QA p.105): with exactly one car in the garage
  // the chooser is a pointless gate — confirm it automatically so a new chat
  // drops straight into the input. Multi-car garages keep the picker. Also
  // re-fires after startNewChat resets isCarConfirmed, so every new chat
  // skips the gate for single-car users.
  React.useEffect(() => {
    if (
      !isCarConfirmed &&
      greetingVehicles.length === 1 &&
      state.messages.length === 0
    ) {
      setSelectedVehicleVin(greetingVehicles[0].vin);
      setSelectedVehicle(greetingVehicles[0]);
      setIsCarConfirmed(true);
    }
  }, [isCarConfirmed, greetingVehicles, state.messages.length]);

  // Attachment panel state
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  // Unified toast surface (migrated from AIToast — see docs/notifications).
  const toast = useToast();
  const showToast = useCallback(
    (message: string, icon?: LucideIcon) => {
      toast.info(message, undefined, icon ? { icon } : undefined);
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
    // Persist so it never shows again across launches. Non-fatal on failure —
    // worst case the disclaimer reappears next cold launch.
    SecureStore.setItemAsync(OTO_WELCOME_SEEN_KEY, "1").catch(() => {});
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (state.messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [state.messages, isProcessing]);

  // Pin-to-bottom, ChatGPT/Claude style. `scrollToEnd` on message changes
  // alone misses content that grows AFTER the array settles — streaming
  // tokens, the inline booking wizard expanding, images finishing layout.
  // Tracking whether the user is near the bottom lets us auto-follow that
  // growth without yanking them down when they've scrolled up to read.
  const isNearBottomRef = useRef(true);
  const handleChatScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      isNearBottomRef.current = distanceFromBottom < 140;
    },
    [],
  );
  const handleChatContentSizeChange = useCallback(() => {
    if (isNearBottomRef.current) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, []);

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
        showToast("Maximum 10 images allowed", ImageOff);
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

  // Write-gate primitive — declared above the send funnel so `sendToOtoAI`
  // (and every surface that calls it) can hard-stop offline sends.
  const canWrite = useCanWrite();

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
      if (!canWrite) return;
      if (isProcessing) return;
      const hasText = messageText.trim().length > 0;
      const hasImages = !!attachedImages && attachedImages.length > 0;
      if (!hasText && !hasImages) return;

      if (!convexUser?._id) {
        // Auth not ready yet — bail out gracefully.
        showToast("Still signing you in — try again in a sec.", Clock);
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
          assistantMessageId,
          quickReplies,
          showRecordConfirmation,
          showVehicleUpdate,
          bookService,
          linkButton,
          bookingCard,
          bookingsList,
          reasoning,
          sources,
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
        // Suppress the card entirely when the dispatcher sanitized every field
        // away (e.g. Haiku sent only a malformed mileage:"") — otherwise it
        // renders a dead, actionless "Vehicle update" card with Confirm disabled
        // (rows.length === 0). Require at least one surviving payload field.
        const vehicleUpdateHasContent =
          !!showVehicleUpdate &&
          Object.keys(showVehicleUpdate as object).length > 0;
        const vehicleUpdateEnvelope =
          showVehicleUpdate && activeVehicleId && vehicleUpdateHasContent
            ? ({
                ...(showVehicleUpdate as object),
                vehicle_id: activeVehicleId as string,
              } as import("@/services/ai/types").VehicleUpdatePayload)
            : undefined;

        // render_reasoning — map Oto's { title, detail } steps onto the
        // AIReasoning shape ({ id, text, completed }). Without this, a fired
        // render_reasoning produced no visible trace on the mobile bubble.
        const reasoningSteps = Array.isArray(reasoning)
          ? (reasoning as Array<{ title?: string; detail?: string }>).map((s, i) => ({
              id: `oto_reason_${i}`,
              text: s?.detail ? `${s.title ?? ""} — ${s.detail}` : (s?.title ?? ""),
              completed: true,
            }))
          : undefined;
        // render_sources — map Oto's free-form { title, details, url } citations
        // onto a generic "reference" source pill (url surfaces in the tooltip).
        const sourceList = Array.isArray(sources)
          ? (sources as Array<{ title?: string; details?: string; url?: string }>).map((s) => ({
              type: "reference" as const,
              label: s?.title ?? "Source",
              icon: "🔗",
              description: s?.details ?? "Cited reference",
              details: s?.url ?? s?.details,
            }))
          : undefined;

        const nextStage: ChatMessage["stage"] = bookServiceEnvelope
          ? "confirmation"
          : undefined;

        const aiMessage: ChatMessage = {
          id: `ai_${Date.now()}`,
          dbId: (assistantMessageId as string | undefined) ?? undefined,
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
          reasoning: reasoningSteps,
          sources: sourceList,
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
        // Log the raw error (stack + provider JSON) for debugging, but NEVER
        // put it in the transcript — the user gets a short, friendly line.
        console.warn("[Oto] sendMessage failed:", err);
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: `err_${Date.now()}`,
              role: "assistant",
              content: friendlyOtoError(err),
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
      canWrite,
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
      // Push ONLY the canonical established_fact — NO synthetic "Confirmed /
      // Updated / Not now" chat message. Oto reads the outcome from
      // <conversation_state> on its next turn; a user-role echo made Oto misread
      // its OWN confirmation ("that's not something I can do on my own…"). The
      // card's success chip is the user-facing feedback.
      let factText: string;
      if (decision.kind === "confirmed") {
        factText = `confirmed ${decision.type} record current as of now`;
      } else if (decision.kind === "declined") {
        factText = `record_confirmation_declined: ${decision.type} — user did not confirm the on-file record`;
      } else {
        const dateStr = new Date(decision.lastServiceDate).toLocaleDateString(
          undefined,
          { month: "long", year: "numeric" },
        );
        const mileagePart = decision.lastServiceMileage
          ? ` at ${decision.lastServiceMileage.toLocaleString()} mi`
          : "";
        factText = `corrected ${decision.type} last_service to ${dateStr}${mileagePart}`;
      }
      pushFact(factText);
    },
    [pushFact],
  );

  // Handle a successful apply from AIVehicleUpdate. The component already wrote
  // via vehicleTruth.applyVehicleTruth. Push ONLY the canonical fact — NO
  // "Done — …" chat message (Oto misread its own echo). Oto sees the outcome
  // from <conversation_state> next turn; the card's success chip is the feedback.
  const handleVehicleUpdateDecision = useCallback(
    (outcome: VehicleUpdateOutcome) => {
      const parts: string[] = [];
      if (outcome.mileageUpdated) parts.push("updated mileage");
      if (outcome.servicesCompleted.length)
        parts.push(`logged ${outcome.servicesCompleted.join(", ")} as done`);
      if (outcome.servicesFlagged.length)
        parts.push(`flagged ${outcome.servicesFlagged.join(", ")} as due`);
      if (outcome.faultLightsAdded.length)
        parts.push(`logged the ${outcome.faultLightsAdded.join(", ")} light`);
      if (parts.length === 0) return;
      pushFact(`vehicle_truth_applied: ${parts.join("; ")}`);
    },
    [pushFact],
  );

  // Handle a DECLINE of the AIVehicleUpdate card ("Not now" / "Cancel"). Nothing
  // was written — push ONLY the canonical decline fact (no "Not now" chat
  // message) so Oto stops treating its earlier "I'll log that…" as done, without
  // polluting the conversation.
  const handleVehicleUpdateDismiss = useCallback(() => {
    pushFact("vehicle_truth_declined: user tapped Not now — nothing was written");
  }, [pushFact]);

  // Handle copy message
  const handleCopy = useCallback(async (content: string) => {
    try {
      await Clipboard.setStringAsync(content);
      showToast("Message copied", Copy);
    } catch (error) {
      console.error("Copy error:", error);
    }
  }, [showToast]);

  // Edit a sent user message → drop its text back into the composer so the
  // user can tweak and re-send it.
  const handleEditUserMessage = useCallback((content: string) => {
    setInputValue(content);
  }, []);

  // Handle speak message
  const handleSpeak = useCallback((content: string) => {
    Speech.speak(content, {
      language: "en-US",
      rate: 1.0,
    });
    showToast("Playing audio...", Volume2);
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
      showToast("Wait for the current response to finish before starting a new chat.", Clock);
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
          .map((row: any) => {
            // Rebuild the persisted render envelope so inline components
            // (booking flow, quick replies, cards, …) come back instead of a
            // text-only transcript.
            const r = (row.render ?? {}) as Partial<ChatMessage>;
            return {
              id: row._id as string,
              dbId: row._id as string,
              role: row.role === "user" ? "user" : "assistant",
              content: row.content,
              timestamp: new Date(row.timestamp).toISOString(),
              quickReplies: r.quickReplies,
              showRecordConfirmation: r.showRecordConfirmation,
              // W0.4 (formerly mislabeled W3.3): the persisted payload already carries vehicle_id, stamped
              // server-side from the vehicle this turn was actually about. Do
              // NOT re-stamp it from the live picker here — that would rebind an
              // old thread's card to whatever car happens to be selected now.
              showVehicleUpdate: r.showVehicleUpdate,
              bookService: r.bookService,
              linkButton: r.linkButton,
              bookingCard: r.bookingCard,
              bookingsList: r.bookingsList,
              reasoning: r.reasoning,
              sources: r.sources,
              stage: r.bookService ? "confirmation" : undefined,
            } as ChatMessage;
          });
        setState((prev) => ({ ...prev, messages }));
        setConvexConversationId(conversationId as Id<"ai_conversations">);
        setInputValue("");
        setIsProcessing(false);
      } catch (err) {
        showToast("Couldn't load that conversation.", AlertCircle);
      }
    },
    [loadConversation, convex, showToast]
  );

  const handleDeleteConversation = useCallback(
    (conversationId: string) => {
      Alert.alert(
        "Delete conversation?",
        "This permanently removes it and its messages.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteConversation({
                  id: conversationId as Id<"ai_conversations">,
                });
                // If it's the one we're currently viewing, drop back to a
                // fresh chat so we're not showing a deleted conversation.
                if (convexConversationId === conversationId) {
                  startNewChat();
                }
              } catch {
                showToast("Couldn't delete that conversation.", AlertCircle);
              }
            },
          },
        ],
      );
    },
    [deleteConversation, convexConversationId, startNewChat, showToast],
  );

  const handleRenameConversation = useCallback(
    (conversationId: string, currentTitle: string) => {
      Alert.prompt(
        "Rename conversation",
        undefined,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: async (value?: string) => {
              const next = (value ?? "").trim();
              if (!next) return;
              try {
                await renameConversation({
                  id: conversationId as Id<"ai_conversations">,
                  title: next,
                });
              } catch {
                showToast("Couldn't rename that conversation.", AlertCircle);
              }
            },
          },
        ],
        "plain-text",
        currentTitle,
      );
    },
    [renameConversation, showToast],
  );

  const handleTogglePin = useCallback(
    async (conversationId: string, pinned: boolean) => {
      try {
        await setConversationPinned({
          id: conversationId as Id<"ai_conversations">,
          pinned,
        });
      } catch {
        showToast("Couldn't update that conversation.", AlertCircle);
      }
    },
    [setConversationPinned, showToast],
  );

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

  /*
   * The car in discussion owns the header's centre slot. The model selector
   * still lives there as the tap target, so switching Oto Pro / Oto is
   * unchanged — only the pill's face is the vehicle instead of a text label.
   * Falls back to the text label until a vehicle is chosen.
   */
  const headerVehicleSource = selectedVehicle
    ? selectedVehicle.localImage ?? (selectedVehicle.imageUrl ? { uri: selectedVehicle.imageUrl as string } : null)
    : null;

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

  // Outer card: translate + shadow ONLY. Must NOT clip (overflow:hidden
  // masks the shadow away — the reason the swiped page was invisible). The
  // shadow is what makes the page read as a floating layer over the drawer,
  // like Claude/ChatGPT.
  const chatCardStyle = useAnimatedStyle(() => {
    const translateX = interpolate(drawerProgress.value, [0, 1], [0, DRAWER_TRANSLATE]);
    const borderRadius = interpolate(drawerProgress.value, [0, 1], [0, DRAWER_RADIUS]);
    return {
      transform: [{ translateX }],
      borderRadius,
      shadowColor: '#000',
      shadowOffset: { width: -8, height: 0 },
      shadowRadius: 24,
      shadowOpacity: interpolate(drawerProgress.value, [0, 1], [0, 0.18]),
      elevation: interpolate(drawerProgress.value, [0, 1], [0, 16]),
    };
  });

  // Inner layer clips the content to the rounded corners while the shadow
  // lives on the (unclipped) outer view above.
  const chatCardClipStyle = useAnimatedStyle(() => {
    const borderRadius = interpolate(drawerProgress.value, [0, 1], [0, DRAWER_RADIUS]);
    return {
      borderRadius,
      overflow: drawerProgress.value > 0 ? 'hidden' as const : 'visible' as const,
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

  // Show the welcome/disclaimer only the very first time. While the persisted
  // flag is still loading, render nothing (not the welcome) so a returning
  // user never sees a flash of the disclaimer on a cold launch.
  if (!hasSeenWelcome) {
    if (!welcomeChecked) {
      return <View style={[styles.drawerRoot, { backgroundColor: '#F7F8FA' }]} />;
    }
    return <AIWelcomeScreen onContinue={handleWelcomeContinue} />;
  }

  return (
    <View style={styles.drawerRoot}>
      {/* Sidebar background — a subtle off-white so the (white) chat card
          reads as a distinct floating layer when swiped over it. Pure white
          made the two surfaces blend into one; this is the ChatGPT/Claude
          pattern where the drawer sits a shade behind the page. */}
      <LinearGradient
        colors={['#F7F8FA', '#F7F8FA']}
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
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onTogglePinConversation={handleTogglePin}
          paddingTop={insets.top}
        />
      </View>

      {/* Chat card — slides right to reveal sidebar. Outer view carries the
          shadow (unclipped); inner clip rounds the corners. */}
      <GestureDetector gesture={showHistory ? closeGesture : openGesture}>
        <Animated.View style={[styles.container, chatCardStyle]}>
        <Animated.View style={[styles.cardClip, chatCardClipStyle]}>

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
          locations={[0, 0.1, 0.2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* Content wrapper — fades when drawer opens, background stays full opacity */}
      <Animated.View style={[{ flex: 1 }, contentFadeStyle]}>

      {/* Header scrim — a soft gradient that masks the message list scrolling
          behind the translucent floating header, so the top reads clean
          instead of showing chat content bleeding up through the icons. */}
      {!showChatGreeting && (
        <LinearGradient
          pointerEvents="none"
          colors={['#A5CDFF', '#D6E8FF', 'rgba(255,255,255,0)']}
          locations={[0, 0.5, 1]}
          style={[styles.headerScrim, { height: HEADER_HEIGHT + 20 }]}
        />
      )}

      {/* Header — absolutely positioned, floats above scroll */}
      {showRightMenu && <Pressable style={styles.otoMenuOverlay} onPress={closeRightMenu} />}
      <Animated.View style={[styles.headerFloating, { paddingTop: insets.top }, showRightMenu && { zIndex: 100 }]}>
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

        {/* Center: the car in discussion. Display only — deliberately not a
            button. The Oto Pro / Oto model selector used to live here; it was
            decorative (selectedModel drove nothing but its own label) so it was
            removed rather than relocated. */}
        <View style={styles.headerCenter}>
          {headerVehicleSource ? (
            <Image
              source={headerVehicleSource}
              style={styles.headerVehicleImage}
              contentFit="contain"
              transition={0}
            />
          ) : null}
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

      {/* Issue 2 — pinned unresolved-symptom list ("Tracking: …") */}
      {!showChatGreeting && hasOpenSymptoms && (
        <SymptomTrackerPin
          symptoms={openSymptoms ?? []}
          top={HEADER_HEIGHT + 8}
        />
      )}

      {/* Main Content */}
      <View
        style={[
          { flex: 1 },
          showChatGreeting && { overflow: 'visible' },
        ]}
        // Tap-anywhere-outside dismisses the keyboard (QA p.7 — replaces the
        // composer's X button). Capture-phase so it fires no matter what the
        // touch lands on — message bubbles and chips are pressables, so the
        // ScrollView's keyboardShouldPersistTaps="handled" alone never
        // dismissed on them. Returning false declines the responder claim,
        // so children still receive the tap (a chip tap both dismisses AND
        // activates). The composer is an absolutely-positioned SIBLING of
        // this container, so touches in the input never pass through here —
        // no dismiss/refocus flicker when tapping the text field.
        onStartShouldSetResponderCapture={() => {
          if (isKeyboardVisible) Keyboard.dismiss();
          return false;
        }}
      >
        {/* Chat Area */}
        <ScrollView
          ref={scrollViewRef}
          style={[styles.chatContainer, showChatGreeting && styles.chatContainerGreeting]}
          contentContainerStyle={[
            styles.chatContent,
            showChatGreeting ? styles.chatContentCentered : { paddingTop: HEADER_HEIGHT + 16 + (hasOpenSymptoms ? 60 : 0), paddingBottom: (keyboardHeight > 0 ? keyboardHeight + keyboardBottomInset + 8 : bottomPadding + 8) + 70 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          scrollEnabled={!showChatGreeting}
          onScroll={handleChatScroll}
          scrollEventThrottle={16}
          onContentSizeChange={handleChatContentSizeChange}
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
                // bookingsList → linkButton.
                //
                // W3.1 (2026-08-13): this block USED to also strip quickReplies
                // whenever a terminal was set — `{ ...message, quickReplies:
                // undefined }` — on the reasoning that two tap surfaces in one
                // message was a malformed payload. That was the actual cause of
                // the chips inversion (D-6, D-33, I2, L2, the 7-light case):
                // chips disappeared exactly when Oto was ALSO logging a fault or
                // offering a booking, i.e. when the user was deepest in a
                // problem and least able to type. The backend was never the
                // problem — mergeRenderDirectives writes every render field
                // unconditionally, renderToPersist uses independent ifs, and
                // ai_messages.render holds several at once — so no prompt change
                // could ever have fixed it.
                //
                // Two tap surfaces is now the intended shape, not a malformed
                // one. Layout is chips-above-card, which needs no new layout
                // code: the bubble (which owns the chip row) already renders
                // ahead of the card below. Precedent that a bubble can carry
                // several renders at once: `reasoning` and `sources` have always
                // co-existed with chips, because they sit outside this chain.
                //
                // The cards themselves stay mutually exclusive — `terminalKind`
                // still picks exactly one.
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
                // Chips ride along with whatever card fires. Applied to every
                // terminal kind, including `bookService` — see the note in the
                // handoff: the booking flow is a 4-step wizard that already
                // gives the user plenty to tap, so it is the one case where a
                // chip row may be redundant rather than helpful. Reverting just
                // that case is a one-line exemption here, deliberately not taken
                // pre-emptively.
                const messageForBubble = message;
                return (
                  <View key={message.id}>
                    <AIMessageBubble
                      message={messageForBubble as AIMessage}
                      onCopy={() => handleCopy(message.content)}
                      onSpeak={() => handleSpeak(message.content)}
                      onLike={() => openFeedbackModal("thumbs_up", message)}
                      onDislike={() => openFeedbackModal("thumbs_down", message)}
                      onQuickReplySelect={handleQuickReplySelect}
                      onEdit={
                        message.role === "user"
                          ? () => handleEditUserMessage(message.content)
                          : undefined
                      }
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
                          messageDbId={message.dbId ?? null}
                          onDecision={handleVehicleUpdateDecision}
                          onDismiss={handleVehicleUpdateDismiss}
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
                    <AITypingIndicator
                      userMessage={
                        lastMsg?.role === "user" ? lastMsg.content : undefined
                      }
                    />
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
          bottom: keyboardHeight > 0 ? keyboardHeight + keyboardBottomInset + 8 : bottomPadding + 8,
        }}>
          {/* Selected images render inside the composer (AIInputBox) now,
              ChatGPT-style — the standalone AISelectedImages strip was
              dropped in favor of that. Offline note stays. */}
          {!canWrite ? (
            <View style={styles.otoOfflineNote}>
              <WifiOff size={14} color="#6B7280" />
              <Text size="xs" weight="regular" color="#6B7280">
                Oto needs a connection to reply
              </Text>
            </View>
          ) : null}
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
            selectedImages={selectedImages}
            onRemoveImage={handleRemoveImage}
            disabled={!canWrite}
            placeholder={canWrite ? "Ask Oto" : "Reconnect to chat with Oto"}
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
    // White so the outer card casts a clean rounded shadow when swiped
    // (the gradient/content sits on top in the clip layer). When the drawer
    // is closed this is fully covered, so it's invisible at rest.
    backgroundColor: '#FFFFFF',
  },
  cardClip: {
    flex: 1,
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
  // Sits behind the floating header (zIndex 10) but above the scrolling
  // message list, so content fades out under the header instead of
  // colliding with the icons.
  headerScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
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
  headerVehicleImage: {
    width: 72,
    height: 40,
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
  otoOfflineNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 6,
  },
});
