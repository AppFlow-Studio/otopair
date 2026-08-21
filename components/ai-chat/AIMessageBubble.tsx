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
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, ActionSheetIOS, Platform, Alert } from 'react-native';

// 2. Expo & Third-party
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Copy, Volume2, ThumbsUp, ThumbsDown, Check } from 'lucide-react-native';

// 3. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 4. Flow-specific components
import { AIReasoning, type ReasoningStep } from './AIReasoning';
import { AISources, type Source } from './AISources';
import { AITypingIndicator } from './AITypingIndicator';
import { AIQuickReplies, type QuickReply } from './AIQuickReplies';

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
  // Attached images (URIs)
  images?: string[];
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
  /** Long-press a user message → Edit (prefill the composer with its text). */
  onEdit?: () => void;
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
  // QA p.77 ("animates two sentences then pops the rest"): when the parent
  // flips isStreaming off mid-reveal, the old effect snapped the full text in
  // one frame. Track reveal progress in refs so the re-run can FINISH the
  // reveal from where it was — faster (15ms/word vs 50) so long tails don't
  // drag — instead of popping. A text that arrives already-complete (history
  // hydration, non-streaming renders) still shows instantly.
  const revealIndexRef = useRef(0);
  const revealDoneRef = useRef(!isStreaming);
  const prevTextRef = useRef(text);

  useEffect(() => {
    const midReveal =
      prevTextRef.current === text &&
      revealIndexRef.current > 0 &&
      !revealDoneRef.current;
    prevTextRef.current = text;

    if (!isStreaming && !midReveal) {
      revealDoneRef.current = true;
      setDisplayedText(text);
      setIsComplete(true);
      return;
    }

    // Reveal word-by-word; continue from the ref position when the streaming
    // flag flipped mid-animation.
    const words = text.split(' ');
    let currentIndex = midReveal ? revealIndexRef.current : 0;
    revealDoneRef.current = false;

    const interval = setInterval(() => {
      if (currentIndex < words.length) {
        currentIndex++;
        revealIndexRef.current = currentIndex;
        setDisplayedText(words.slice(0, currentIndex).join(' '));
      } else {
        clearInterval(interval);
        revealDoneRef.current = true;
        setIsComplete(true);
      }
    }, isStreaming ? 50 : 15);

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

  // Animate when active state changes
  useEffect(() => {
    if (isActive) {
      // Subtle pop animation - no bounce
      scale.value = withSequence(
        withTiming(1.15, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
    }
  }, [isActive]);

  const pressOpacity = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withTiming(0.9, { duration: 80 });
    pressOpacity.value = withTiming(0.5, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 80 });
    pressOpacity.value = withTiming(1, { duration: 80 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: pressOpacity.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.actionBtn, animatedStyle]}>
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
  onEdit,
}: AIMessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;

  // Long-press a user message → native action sheet with Copy / Edit.
  const showUserActions = () => {
    const doCopy = () => handleCopy();
    const doEdit = () => onEdit?.();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: onEdit ? ['Copy', 'Edit', 'Cancel'] : ['Copy', 'Cancel'],
          cancelButtonIndex: onEdit ? 2 : 1,
        },
        (index) => {
          if (index === 0) doCopy();
          else if (onEdit && index === 1) doEdit();
        },
      );
    } else {
      const buttons: Parameters<typeof Alert.alert>[2] = [
        { text: 'Copy', onPress: doCopy },
      ];
      if (onEdit) buttons.push({ text: 'Edit', onPress: doEdit });
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Message', undefined, buttons);
    }
  };
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
    const hasImages = message.images && message.images.length > 0;
    
    return (
      <Animated.View 
        style={styles.userContainer}
        entering={FadeIn.duration(200)}
      >
        {/* Attached Images */}
        {hasImages && (
          <View style={styles.userImagesContainer}>
            {message.images!.map((uri, index) => (
              <Image 
                key={`${message.id}-img-${index}`}
                source={{ uri }} 
                style={styles.userAttachedImage}
                contentFit="cover"
                transition={150}
              />
            ))}
          </View>
        )}
        
        {/* Message Text (only if there's content beyond the default).
            Long-press → Copy / Edit action sheet. */}
        {message.content && message.content !== "Here's an image for you to analyze" && (
          <Pressable
            style={({ pressed }) => [styles.userBubble, pressed && styles.userBubblePressed]}
            onLongPress={showUserActions}
            delayLongPress={300}
          >
            <Text style={styles.userMessageText}>
              {message.content}
            </Text>
          </Pressable>
        )}
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

        {/* Sources (AI only) — temporarily hidden
        {showContent && message.sources && message.sources.length > 0 && !isStreaming && (
          <AISources sources={message.sources} />
        )}
        */}

        {/* Quick Replies (AI only, after content has settled) */}
        {showContent &&
          !isStreaming &&
          message.quickReplies &&
          message.quickReplies.length > 0 && (
            <AIQuickReplies
              replies={message.quickReplies}
              onSelect={(reply) => onQuickReplySelect?.(reply)}
            />
          )}

        {/* Action Buttons (AI only, when not streaming) */}
        {showContent && !isStreaming && (
          <View style={styles.actionsContainer}>
            <View style={styles.actionButtons}>
              <ActionButton
                icon={<Copy size={18} color="rgba(0,0,0,0.25)" />}
                activeIcon={<Check size={20} color={BrandColors.secondary} />}
                isActive={isCopied}
                onPress={handleCopy}
              />
              <ActionButton
                icon={<Volume2 size={18} color="rgba(0,0,0,0.25)" />}
                onPress={onSpeak}
              />
              <ActionButton
                icon={<ThumbsUp size={18} color="rgba(0,0,0,0.25)" />}
                activeIcon={<ThumbsUp size={18} color={BrandColors.secondary} />}
                isActive={feedback === 'like'}
                onPress={handleLike}
              />
              <ActionButton
                icon={<ThumbsDown size={18} color="rgba(0,0,0,0.25)" />}
                activeIcon={<ThumbsDown size={18} color={BrandColors.secondary} />}
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
    flexDirection: 'column',
    alignItems: 'flex-end',
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
    borderRadius: 18,
    borderBottomRightRadius: 4,
    borderTopRightRadius: 14,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    maxWidth: '80%',
  },
  userBubblePressed: {
    opacity: 0.85,
  },
  // User attached images
  userImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
    maxWidth: '80%',
  },
  userAttachedImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  messageText: {
    color: '#000000',
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
    color: '#000000',
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
    color: '#000000',
    lineHeight: 22,
  },
  // Actions
  actionsContainer: {
    marginTop: Spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
});
