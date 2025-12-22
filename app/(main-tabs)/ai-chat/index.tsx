/**
 * AI Chat Screen
 * Main screen for RepairConnect AI diagnostic assistant
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/shared-ui';
import {
  AIGreeting,
  AIMessageBubble,
  AIInputBox,
  AITypingIndicator,
  AIChatHistory,
} from '@/components/ai-chat';
import { useAIChatStore } from '@/stores/useAIChatStore';
import { BrandColors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { Menu, SquarePen } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Local state
  const [inputValue, setInputValue] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Store state
  const {
    messages,
    isLoading,
    user,
    suggestions,
    greeting,
    conversations,
    isRecording,
    selectedImage,
  } = useAIChatStore();

  // Store actions
  const {
    sendMessage,
    loadUserContext,
    loadSuggestions,
    loadConversations,
    loadConversation,
    startNewChat,
    setRecording,
    setSelectedImage,
  } = useAIChatStore();

  // Initialize on mount
  useEffect(() => {
    loadUserContext();
    loadSuggestions();
    loadConversations();
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isLoading]);

  // Handle sending a message
  const handleSend = useCallback(() => {
    const trimmedInput = inputValue.trim();
    if (trimmedInput || selectedImage) {
      sendMessage(trimmedInput);
      setInputValue('');
    }
  }, [inputValue, selectedImage, sendMessage]);

  // Handle suggestion press
  const handleSuggestionPress = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);

  // Handle copy message
  const handleCopy = useCallback(async (content: string) => {
    try {
      await Clipboard.setStringAsync(content);
      Alert.alert('Copied', 'Message copied to clipboard');
    } catch (error) {
      console.error('Copy error:', error);
    }
  }, []);

  // Handle speak message
  const handleSpeak = useCallback((content: string) => {
    Speech.speak(content, {
      language: 'en-US',
      rate: 1.0,
    });
  }, []);

  // Handle feedback
  const handleLike = useCallback(() => {
    Alert.alert('Thanks!', 'Your feedback helps us improve.');
  }, []);

  const handleDislike = useCallback(() => {
    Alert.alert('Thanks!', 'Your feedback helps us improve.');
  }, []);

  // Handle find mechanics
  const handleFindMechanics = useCallback((serviceType: string, urgency: string) => {
    Alert.alert(
      'Find Mechanics',
      `Searching for mechanics who can handle: ${serviceType}\nUrgency: ${urgency}`,
      [{ text: 'OK' }]
    );
    // TODO: Navigate to mechanic search/booking flow
  }, []);

  // Handle camera press
  const handleCameraPress = useCallback(async () => {
    Alert.alert(
      'Add Photo',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: () => console.log('Camera') },
        { text: 'Choose from Library', onPress: () => console.log('Library') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
    // TODO: Implement with expo-image-picker
  }, []);

  // Handle voice press
  const handleVoicePress = useCallback(() => {
    if (isRecording) {
      setRecording(false);
      // TODO: Stop recording and process
    } else {
      setRecording(true);
      Alert.alert('Voice Input', 'Voice recording started...');
      // TODO: Implement with expo-av
    }
  }, [isRecording, setRecording]);

  // Determine if we should show welcome screen
  const showWelcome = messages.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background Gradient */}
      <View style={styles.backgroundGradient} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => setShowHistory(true)}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
        >
          <Menu size={20} color={BrandColors.white} />
        </Pressable>

        <Text style={styles.headerTitle} size="lg" weight="semiBold">
          RepairConnect AI
        </Text>

        <Pressable
          onPress={startNewChat}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
        >
          <SquarePen size={20} color={BrandColors.white} />
        </Pressable>
      </View>

      {/* Main Content */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Chat Area */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatContainer}
          contentContainerStyle={[
            styles.chatContent,
            showWelcome && styles.chatContentCentered,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {showWelcome ? (
            <AIGreeting
              greeting={greeting}
              suggestions={suggestions}
              onSuggestionPress={handleSuggestionPress}
            />
          ) : (
            <>
              {messages.map((message) => (
                <AIMessageBubble
                  key={message.id}
                  message={message}
                  onCopy={() => handleCopy(message.content)}
                  onSpeak={() => handleSpeak(message.content)}
                  onLike={handleLike}
                  onDislike={handleDislike}
                  onFindMechanics={handleFindMechanics}
                />
              ))}
              {isLoading && <AITypingIndicator />}
            </>
          )}
        </ScrollView>

        {/* Input Area */}
        <AIInputBox
          value={inputValue}
          onChangeText={setInputValue}
          onSend={handleSend}
          onCameraPress={handleCameraPress}
          onVoicePress={handleVoicePress}
          isLoading={isLoading}
          isRecording={isRecording}
          selectedImage={selectedImage}
          onRemoveImage={() => setSelectedImage(null)}
        />
      </KeyboardAvoidingView>

      {/* Chat History Sidebar */}
      <AIChatHistory
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        conversations={conversations}
        onSelectConversation={loadConversation}
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
    backgroundColor: '#E8ECF0',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E8ECF0',
    // Linear gradient effect with opacity layers
    opacity: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: BrandColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  headerBtnPressed: {
    opacity: 0.8,
  },
  headerTitle: {
    color: BrandColors.primary,
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
    justifyContent: 'center',
  },
});

