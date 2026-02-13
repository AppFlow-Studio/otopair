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
import { View, ScrollView, StyleSheet, Pressable, Alert, Platform, KeyboardAvoidingView, Keyboard } from "react-native";

// 2. Expo & Third-party
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withDelay, Easing } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { AlignLeft, SquarePen } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";

// 3. Shared UI (design system)
import { Text } from "@/components/shared-ui";

// 4. Flow-specific components
import {
  AIGreeting,
  AIMessageBubble,
  AIInputBox,
  AITypingIndicator,
  AIChatHistory,
  PromptSuggestions,
  AIBookingCarousel,
  AIWelcomeScreen,
  AIServicePicker,
  AIToast,
  AIAttachmentPanel,
  AISelectedImages,
  type AIMessage,
  type Suggestion,
  type QuickReply,
  type ServiceOption,
  type SelectedTimeSlot,
} from "@/components/ai-chat";

// 5. Constants, hooks, types, stores
import { BrandColors, Spacing, FontFamily } from "@/constants/theme";
import { useAIChatStore } from "@/stores/useAIChatStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { createInitialState, processUserMessage, WELCOME_SUGGESTIONS } from "@/services/ai/scenarioEngine";
import type { ConversationState, ChatMessage, AIMechanic, SelectedService } from "@/services/ai/types";

// ============================================================================
// CONSTANTS
// ============================================================================

// Default tab bar height fallback (standard iOS/Android tab bar is ~49-83px)
// Increased on Android to account for the new floating tab bar height + its bottom offset
const TAB_BAR_HEIGHT = Platform.OS === 'android' ? 100 : 80;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  // Calculate bottom padding to account for the native tab bar
  const bottomPadding = Math.max(insets.bottom, TAB_BAR_HEIGHT);

  // Welcome screen state (from Zustand store)
  const hasSeenWelcome = useAIChatStore((state) => state.hasSeenWelcome);
  const setHasSeenWelcome = useAIChatStore((state) => state.setHasSeenWelcome);

  // Chat history state (from Zustand store)
  const conversations = useAIChatStore((state) => state.conversations);
  const saveCurrentConversation = useAIChatStore((state) => state.saveCurrentConversation);
  const loadConversation = useAIChatStore((state) => state.loadConversation);
  const startNewConversation = useAIChatStore((state) => state.startNewConversation);

  // Booking store for navigation to payment
  const selectMechanic = useBookingStore((state) => state.selectMechanic);
  const setScheduledAppointment = useBookingStore((state) => state.setScheduledAppointment);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const clearSelectedServices = useBookingStore((state) => state.clearSelectedServices);
  const setBookingStage = useBookingStore((state) => state.setBookingStage);

  // Conversation state (using scenario engine)
  const [state, setState] = useState<ConversationState>(createInitialState);

  // Local UI state
  const [inputValue, setInputValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Toast state
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  
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

  // Animated bottom padding for smooth keyboard transitions
  const animatedBottomPadding = useSharedValue(bottomPadding);

  // Track keyboard visibility with smooth animation
  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => {
      setIsKeyboardVisible(true);
      // Close attachment panel when keyboard opens
      setIsAttachmentOpen(false);
      // Animate to 0 when keyboard shows (keyboard pushes content up)
      animatedBottomPadding.value = withTiming(Spacing.xs, {
        duration: Platform.OS === "ios" ? e.duration : 250,
        easing: Easing.out(Easing.cubic),
      });
    });
    const hideSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", (e) => {
      setIsKeyboardVisible(false);
      // Animate back to tab bar height when keyboard hides
      animatedBottomPadding.value = withTiming(bottomPadding, {
        duration: Platform.OS === "ios" ? e.duration : 250,
        easing: Easing.out(Easing.cubic),
      });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [bottomPadding]);

  // Animated style for input container
  const inputContainerAnimatedStyle = useAnimatedStyle(() => ({
    paddingBottom: animatedBottomPadding.value,
  }));

  // Reduce bottom padding when attachment panel is open
  useEffect(() => {
    if (isAttachmentOpen && !isKeyboardVisible) {
      // Panel opening - remove padding immediately (panel handles tab bar spacing)
      animatedBottomPadding.value = 0;
    } else if (!isKeyboardVisible) {
      // Panel closing - restore padding immediately (no animation to avoid gap)
      animatedBottomPadding.value = bottomPadding;
    }
  }, [isAttachmentOpen, isKeyboardVisible, bottomPadding]);

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

  // Handle microphone press out - stop recording and get transcription
  const handleMicPressOut = useCallback(async () => {
    const transcription = await stopRecording();
    if (transcription) {
      setInputValue(transcription);
      // Auto-send the transcribed message after a brief delay
      setTimeout(() => {
        if (transcription.trim()) {
          // Set input and trigger send
          setInputValue("");
          setIsProcessing(true);

          // Process with scenario engine
          const { newState, response } = processUserMessage(state, transcription);

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
                setTimeout(() => saveCurrentConversation(finalState), 0);
                return finalState;
              });
              setIsProcessing(false);
            }, response.message.length * 30);
          }, 1500);
        }
      }, 300);
    }
  }, [stopRecording, state, saveCurrentConversation]);

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
    setIsProcessing(true);

    // Use a default message for image-only sends
    const messageText = trimmedInput || (hasImages ? "Here's an image for you to analyze" : "");

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
  }, [inputValue, state, isProcessing, saveCurrentConversation, selectedImages]);

  // Handle suggestion press
  const handleSuggestionPress = useCallback(
    (suggestion: Suggestion | string) => {
      const text = typeof suggestion === "string" ? suggestion : suggestion.text;
      const value = typeof suggestion === "string" ? suggestion : suggestion.value || suggestion.text;

      setInputValue(text);

      // Auto-send after brief delay for natural feel
      setTimeout(() => {
        if (value && !isProcessing) {
          setInputValue("");
          setIsProcessing(true);

          const { newState, response } = processUserMessage(state, value);

          setState((prevState) => ({
            ...prevState,
            messages: newState.messages,
            currentStage: newState.currentStage,
            currentScenario: newState.currentScenario,
            selectedPriority: newState.selectedPriority,
            selectedShop: newState.selectedShop,
            selectedTime: newState.selectedTime,
          }));

          setTimeout(() => {
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
              stage: response.nextStage,
              isStreaming: true,
            };

            setState((prevState) => {
              const newStateWithMessage = {
                ...prevState,
                messages: [...prevState.messages, aiMessage],
                suggestions: response.suggestions,
                currentStage: response.nextStage,
              };
              // Save conversation to store after state is set
              queueMicrotask(() => saveCurrentConversation(newStateWithMessage));
              return newStateWithMessage;
            });

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
            }, response.message.length * 30);
          }, 1500);
        }
      }, 100);
    },
    [state, isProcessing, saveCurrentConversation]
  );

  // Handle quick reply selection
  const handleQuickReplySelect = useCallback(
    (reply: QuickReply) => {
      handleSuggestionPress({ id: reply.id, text: reply.text, value: reply.value });
    },
    [handleSuggestionPress]
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

  // Handle service selection from service picker
  const handleServiceSelect = useCallback(
    (services: ServiceOption[]) => {
      if (services.length === 0 || isProcessing) return;

      setIsProcessing(true);

      // Convert ServiceOption to SelectedService
      const selectedServices: SelectedService[] = services.map((s) => ({
        id: s.id,
        name: s.name,
        estimatedPrice: s.price,
      }));

      // Create service names for display
      const serviceNames = services.map((s) => s.name).join(", ");

      // Add user message showing selected services
      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: serviceNames,
        timestamp: new Date().toISOString(),
        stage: "service_selection",
      };

      // Update state with selected services AND user message
      setState((prev) => ({
        ...prev,
        selectedServices,
        messages: [...prev.messages, userMessage],
      }));

      // Simulate AI response delay
      setTimeout(() => {
        // Create AI response confirming selection
        const aiMessage: ChatMessage = {
          id: `ai_${Date.now()}`,
          role: "assistant",
          content: `Great choices! You selected **${serviceNames}**.\n\nHow would you like me to find mechanics?`,
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
          // Save conversation to store after state is set
          queueMicrotask(() => saveCurrentConversation(newStateWithMessage));
          return newStateWithMessage;
        });

        // Stop streaming
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

  // Start new chat
  const startNewChat = useCallback(() => {
    startNewConversation(); // Reset in store (clears currentConversationId)
    setState(createInitialState());
    setInputValue("");
    setIsProcessing(false);
  }, [startNewConversation]);

  // Handle selecting a conversation from history
  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      const loadedState = loadConversation(conversationId);
      if (loadedState) {
        setState(loadedState);
        setInputValue("");
        setIsProcessing(false);
      }
    },
    [loadConversation]
  );

  // Determine if we should show chat greeting (no messages yet)
  const showChatGreeting = state.messages.length === 0;

  // Show welcome screen if not seen
  if (!hasSeenWelcome) {
    return <AIWelcomeScreen onContinue={handleWelcomeContinue} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background Gradient */}
      <View style={styles.backgroundGradient} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => setShowHistory(true)}
          style={({ pressed }) => [styles.headerIcon, pressed && styles.headerIconPressed]}
        >
          <AlignLeft size={22} color={BrandColors.primary} />
        </Pressable>

        <Text style={styles.headerTitle} size="lg" weight="semiBold">
          OtoPair AI
        </Text>

        <Pressable
          onPress={startNewChat}
          style={({ pressed }) => [styles.headerIcon, pressed && styles.headerIconPressed]}
        >
          <SquarePen size={20} color={BrandColors.primary} />
        </Pressable>
      </View>

      {/* Main Content */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Chat Area */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatContainer}
          contentContainerStyle={[styles.chatContent, showChatGreeting && styles.chatContentCentered]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {showChatGreeting ? (
            <AIGreeting suggestions={WELCOME_SUGGESTIONS} onSuggestionPress={handleSuggestionPress} />
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
            </>
          )}
        </ScrollView>

        {/* Suggestions above input (only when in conversation) */}
        {!showChatGreeting && state.suggestions.length > 0 && !isProcessing && !isAttachmentOpen && (
          <PromptSuggestions
            stage={state.currentStage}
            suggestions={state.suggestions}
            onSelect={handleSuggestionPress}
            disabled={isProcessing}
          />
        )}

        {/* Selected Images Preview - above input */}
        <AISelectedImages
          images={selectedImages}
          onRemove={handleRemoveImage}
        />

        {/* Input Area with smooth keyboard animation */}
        <Animated.View style={inputContainerAnimatedStyle}>
          <AIInputBox
            value={inputValue}
            onChangeText={setInputValue}
            onSend={handleSend}
            isLoading={isProcessing}
            disabled={isProcessing}
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
        </Animated.View>

        {/* Attachment Panel (Discord-style) - below input, pushes everything up */}
        <AIAttachmentPanel
          visible={isAttachmentOpen}
          onClose={() => setIsAttachmentOpen(false)}
          selectedImages={selectedImages}
          onToggleImage={handleToggleImage}
        />
      </KeyboardAvoidingView>

      {/* Chat History Sidebar */}
      <AIChatHistory
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
      />

      {/* Toast Notification */}
      <AIToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8ECF0",
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#E8ECF0",
    // Linear gradient effect with opacity layers
    opacity: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
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
    flex: 1,
    color: BrandColors.primary,
    fontFamily: FontFamily.semiBold,
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    flexGrow: 1,
    paddingVertical: Spacing.md,
  },
  chatContentCentered: {
    justifyContent: "center",
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
