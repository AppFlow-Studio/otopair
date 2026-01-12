/**
 * AI Message Bubble Component
 * Enhanced with Reasoning and Sources integration
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/components/shared-ui';
import { BrandColors, BorderRadius, Spacing, FontFamily, Shadows } from '@/constants/theme';
import { Copy, Volume2, ThumbsUp, ThumbsDown } from 'lucide-react-native';

// Otopair AI Logo (for AI assistant)
const OTOPAIR_AI_LOGO = require('@/assets/images/otopair-ai-logo.png');

import { AIReasoning, type ReasoningStep } from './AIReasoning';
import { AISources, type Source } from './AISources';
import { AIQuickReplies, type QuickReply } from './AIQuickReplies';

// ============================================================================
// TYPES
// ============================================================================

export interface MessageSection {
  title: string;
  content: string;
  type: 'text' | 'list';
  items?: string[];
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  // Enhanced properties
  reasoning?: ReasoningStep[];
  sources?: Source[];
  quickReplies?: QuickReply[];
  sections?: MessageSection[];
  isStreaming?: boolean;
}

interface AIMessageBubbleProps {
  message: AIMessage;
  onCopy?: () => void;
  onSpeak?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onQuickReplySelect?: (reply: QuickReply) => void;
}

// ============================================================================
// STREAMING TEXT COMPONENT
// ============================================================================

function StreamingText({ 
  text, 
  isStreaming 
}: { 
  text: string; 
  isStreaming?: boolean;
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(!isStreaming);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedText(text);
      setIsComplete(true);
      return;
    }

    // Simulate streaming by revealing text progressively
    let currentIndex = 0;
    const words = text.split(' ');
    
    const interval = setInterval(() => {
      if (currentIndex < words.length) {
        setDisplayedText(words.slice(0, currentIndex + 1).join(' '));
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
      }
    }, 50); // 50ms per word

    return () => clearInterval(interval);
  }, [text, isStreaming]);

  return (
    <Text style={styles.messageText}>
      {displayedText}
      {!isComplete && <Text style={styles.cursor}>|</Text>}
    </Text>
  );
}

// ============================================================================
// SECTION VIEW COMPONENT
// ============================================================================

function SectionView({ section }: { section: MessageSection }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} size="xs" weight="bold">
        {section.title.toUpperCase()}
      </Text>
      
      {section.type === 'list' && section.items ? (
        <View style={styles.listContainer}>
          {section.items.map((item, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={styles.listBullet}>•</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.sectionContent}>{section.content}</Text>
      )}
    </View>
  );
}

// ============================================================================
// ACTION BUTTON COMPONENT
// ============================================================================

function ActionButton({
  icon,
  onPress,
}: {
  icon: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
      onPress={onPress}
    >
      {icon}
    </Pressable>
  );
}

// ============================================================================
// HELPER: Calculate reasoning duration
// ============================================================================

function calculateReasoningDuration(reasoning?: ReasoningStep[]): number {
  if (!reasoning || reasoning.length === 0) return 0;
  
  // Each step has:
  // - typing time (20ms per character for summary)
  // - 1500ms reading buffer after typing
  // - Plus final buffer for animations
  let totalDuration = 0;
  
  reasoning.forEach((step) => {
    const typingTime = step.text.length * 20;
    const readingBuffer = 1500;
    totalDuration += typingTime + readingBuffer;
  });
  
  // Add buffer for final animations
  return totalDuration + 500;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIMessageBubble({
  message,
  onCopy,
  onSpeak,
  onLike,
  onDislike,
  onQuickReplySelect,
}: AIMessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const hasReasoning = !isUser && message.reasoning && message.reasoning.length > 0;
  
  // State to track if we should show the main content
  // Content is hidden while reasoning is being displayed
  const [showContent, setShowContent] = useState(!hasReasoning || !isStreaming);
  
  // Calculate and wait for reasoning to complete before showing content
  useEffect(() => {
    // If user message or no reasoning, show content immediately
    if (isUser || !hasReasoning) {
      setShowContent(true);
      return;
    }
    
    // If streaming is done, show content
    if (!isStreaming) {
      setShowContent(true);
      return;
    }
    
    // Calculate how long reasoning will take
    const reasoningDuration = calculateReasoningDuration(message.reasoning);
    
    // Wait for reasoning to complete, then show content
    const timer = setTimeout(() => {
      setShowContent(true);
    }, reasoningDuration);
    
    return () => clearTimeout(timer);
  }, [isUser, hasReasoning, isStreaming, message.reasoning]);

  // User message - clean pill style, no avatar
  if (isUser) {
    return (
      <Animated.View 
        style={styles.userContainer}
        entering={FadeIn.duration(200)}
      >
        <View style={styles.userBubble}>
          <Text style={styles.userMessageText}>
            {message.content}
          </Text>
        </View>
      </Animated.View>
    );
  }

  // AI message - minimal avatar, clean text flow
  return (
    <Animated.View 
      style={styles.container}
      entering={FadeIn.duration(200)}
    >
      {/* Small AI Avatar */}
      <View style={styles.avatar}>
        <Image 
          source={OTOPAIR_AI_LOGO} 
          style={styles.aiAvatarImage}
          resizeMode="cover"
        />
      </View>

      {/* Message Content */}
      <View style={styles.contentWrapper}>
        {/* Reasoning Section (AI only) */}
        {hasReasoning && (
          <AIReasoning
            steps={message.reasoning!}
            isStreaming={isStreaming}
            defaultExpanded={false}
          />
        )}

        {/* Main Text - Clean, no bubble for AI */}
        {showContent && (
          <Animated.View 
            style={styles.aiTextContainer}
            entering={FadeIn.duration(300)}
          >
            {isStreaming && !hasReasoning ? (
              <StreamingText text={message.content} isStreaming={isStreaming} />
            ) : (
              <Text style={styles.messageText}>
                {message.content}
              </Text>
            )}
          </Animated.View>
        )}

        {/* Sections (AI only) - Show after content */}
        {showContent && message.sections && message.sections.length > 0 && (
          <View style={styles.sectionsContainer}>
            {message.sections.map((section, index) => (
              <SectionView key={index} section={section} />
            ))}
          </View>
        )}

        {/* Quick Replies (AI only) - Show after content */}
        {showContent && message.quickReplies && message.quickReplies.length > 0 && (
          <AIQuickReplies
            replies={message.quickReplies}
            onSelect={(reply) => onQuickReplySelect?.(reply)}
            disabled={isStreaming}
          />
        )}

        {/* Sources (AI only) */}
        {showContent && message.sources && message.sources.length > 0 && !isStreaming && (
          <AISources sources={message.sources} />
        )}

        {/* Action Buttons (AI only, when not streaming) */}
        {showContent && !isStreaming && (
          <View style={styles.actionsContainer}>
            <View style={styles.actionButtons}>
              <ActionButton icon={<Copy size={14} color="#9CA3AF" />} onPress={onCopy} />
              <ActionButton icon={<Volume2 size={14} color="#9CA3AF" />} onPress={onSpeak} />
              <ActionButton icon={<ThumbsUp size={14} color="#9CA3AF" />} onPress={onLike} />
              <ActionButton icon={<ThumbsDown size={14} color="#9CA3AF" />} onPress={onDislike} />
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'flex-start',
  },
  userContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: BrandColors.secondary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  aiAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  contentWrapper: {
    flex: 1,
    maxWidth: '90%',
  },
  // AI message - no bubble, clean text
  aiTextContainer: {
    paddingVertical: Spacing.xs,
  },
  // User message - pill style bubble
  userBubble: {
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    maxWidth: '80%',
  },
  messageText: {
    color: BrandColors.primary,
    lineHeight: 22,
    fontSize: 15,
    fontFamily: FontFamily.regular,
  },
  userMessageText: {
    color: BrandColors.white,
    lineHeight: 22,
    fontSize: 15,
    fontFamily: FontFamily.regular,
  },
  cursor: {
    color: BrandColors.secondary,
    fontWeight: 'bold',
  },
  // Sections
  sectionsContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  section: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: BrandColors.secondary,
    ...Shadows.sm,
  },
  sectionTitle: {
    color: BrandColors.secondary,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  sectionContent: {
    color: BrandColors.primary,
    lineHeight: 22,
  },
  listContainer: {
    gap: Spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  listBullet: {
    color: BrandColors.secondary,
    marginRight: Spacing.sm,
    fontSize: 14,
    lineHeight: 22,
  },
  listText: {
    flex: 1,
    color: BrandColors.primary,
    lineHeight: 22,
  },
  // Actions
  actionsContainer: {
    marginTop: Spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  actionBtnPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
});
