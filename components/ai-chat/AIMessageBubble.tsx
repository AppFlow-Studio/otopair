/**
 * AIMessageBubble
 *
 * PURPOSE: Displays user/AI chat messages with reasoning, sources, sections, and action buttons
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (renders each message in chat)
 *
 * PROPS:
 *   - message (AIMessage): Message object with content, role, reasoning, sources, etc.
 *   - onCopy (() => void): Callback when copy button is pressed
 *   - onSpeak (() => void): Callback when speak button is pressed
 *   - onLike (() => void): Callback when like button is pressed
 *   - onDislike (() => void): Callback when dislike button is pressed
 *   - onQuickReplySelect ((reply: QuickReply) => void): Callback when quick reply is selected
 *
 * EXAMPLE:
 *   <AIMessageBubble
 *     message={{ id: '1', role: 'assistant', content: 'Hello!', timestamp: '...' }}
 *     onCopy={() => copyToClipboard(message.content)}
 *     onQuickReplySelect={(reply) => handleReply(reply)}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';

// 2. Expo & Third-party
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { Copy, Volume2, ThumbsUp, ThumbsDown, Check } from 'lucide-react-native';

// 3. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 4. Flow-specific components
import { AIReasoning, type ReasoningStep } from './AIReasoning';
import { AISources, type Source } from './AISources';
import { AITypingIndicator } from './AITypingIndicator';
import type { QuickReply } from './AIQuickReplies';

// 5. Constants, hooks, types
import { BrandColors, BorderRadius, Spacing, FontFamily, Shadows } from '@/constants/theme';
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
// ACTION BUTTON COMPONENT WITH ANIMATION
// ============================================================================

function ActionButton({
  icon,
  activeIcon,
  isActive,
  onPress,
}: {
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  isActive?: boolean;
  onPress?: () => void;
}) {
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(0);

  // Animate when active state changes
  useEffect(() => {
    if (isActive) {
      // Subtle pop animation - no bounce
      scale.value = withSequence(
        withTiming(1.15, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
      bgOpacity.value = withTiming(1, { duration: 150 });
    } else {
      bgOpacity.value = withTiming(0, { duration: 100 });
    }
  }, [isActive]);

  const handlePressIn = () => {
    scale.value = withTiming(0.9, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 80 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(59, 130, 246, ${bgOpacity.value * 0.12})`,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.actionBtn, animatedStyle, bgStyle]}>
        {isActive && activeIcon ? activeIcon : icon}
      </Animated.View>
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
  
  // State to track action button feedback
  const [isCopied, setIsCopied] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  
  // Handle copy with visual feedback
  const handleCopy = () => {
    setIsCopied(true);
    onCopy?.();
    // Reset after 2 seconds
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  // Handle like with visual feedback
  const handleLike = () => {
    if (feedback === 'like') {
      setFeedback(null); // Toggle off
    } else {
      setFeedback('like');
      onLike?.();
    }
  };
  
  // Handle dislike with visual feedback (toggleable)
  const handleDislike = () => {
    if (feedback === 'dislike') {
      setFeedback(null); // Toggle off
    } else {
      setFeedback('dislike');
      onDislike?.();
    }
  };
  
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

  // AI message - no avatar, left-aligned text
  return (
    <Animated.View 
      style={styles.container}
      entering={FadeIn.duration(200)}
    >
      {/* Message Content - Left aligned, no avatar */}
      <View style={styles.contentWrapper}>
        {/* Thinking Indicator - Above reasoning when streaming */}
        {isStreaming && hasReasoning && (
          <AITypingIndicator />
        )}

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

        {/* Sources (AI only) */}
        {showContent && message.sources && message.sources.length > 0 && !isStreaming && (
          <AISources sources={message.sources} />
        )}

        {/* Action Buttons (AI only, when not streaming) */}
        {showContent && !isStreaming && (
          <View style={styles.actionsContainer}>
            <View style={styles.actionButtons}>
              <ActionButton 
                icon={<Copy size={14} color="#9CA3AF" />} 
                activeIcon={<Check size={14} color={BrandColors.secondary} />}
                isActive={isCopied}
                onPress={handleCopy} 
              />
              <ActionButton 
                icon={<Volume2 size={14} color="#9CA3AF" />} 
                onPress={onSpeak} 
              />
              <ActionButton 
                icon={<ThumbsUp size={14} color="#9CA3AF" />} 
                activeIcon={<ThumbsUp size={14} color={BrandColors.secondary} fill={BrandColors.secondary} />}
                isActive={feedback === 'like'}
                onPress={handleLike} 
              />
              <ActionButton 
                icon={<ThumbsDown size={14} color="#9CA3AF" />} 
                activeIcon={<ThumbsDown size={14} color={BrandColors.secondary} fill={BrandColors.secondary} />}
                isActive={feedback === 'dislike'}
                onPress={handleDislike} 
              />
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
  contentWrapper: {
    flex: 1,
    maxWidth: '95%',
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
});
